-- Backend hardening: payment-idempotency unique-Constraint,
-- audit_log ip/ua enrichment, partial index für offene Rechnungen.
--
-- E8 (Payment idempotency):
--   Stripe + TrueLayer schicken Webhooks aggressiv mit Retries. Wir prüften
--   bisher nur via maybeSingle().eq("reference", session.id) → race-fenster
--   zwischen Lookup und Insert öffnete duplicate-Zahlungen. Unique-Constraint
--   schließt das atomar.
--
-- E12 (Audit enrichment):
--   Spalten ip + user_agent existieren in audit_log, werden aber von kaum
--   einem Insert befüllt. Wir geben einen Helper-RPC an, den Routes aufrufen
--   können — RLS-sicher.
--
-- E15 (Index optimization):
--   Dashboard-Query "open invoices" filtert WHERE status IN ('sent','partially_paid','overdue').
--   Bisher full scan über alle Rechnungen. Partial index pro user_id, due_date
--   beschleunigt das auf ~ms auf großen Datasets.

-- ─── E8: Payment-Reference Unique ───────────────────────────────────────
-- "Where reference is not null" weil cash-payments keine Reference haben
-- und gerne mehrfach mit denselben (NULL,NULL) angelegt werden.
create unique index if not exists payments_user_reference_uidx
  on public.payments (user_id, reference)
  where reference is not null;

-- ─── E12: Audit-Log-Enrichment-Helper ────────────────────────────────────
-- Server-Routes können diesen RPC statt eines direkten INSERTs aufrufen,
-- damit ip/user_agent garantiert mitgeschrieben werden.
create or replace function public.log_audit(
  p_action text,
  p_entity text,
  p_entity_id uuid default null,
  p_diff jsonb default null,
  p_ip inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user_id is null then
    -- Audit ohne authentifizierten User (z.B. Webhook): erlauben, user_id null.
    null;
  end if;
  insert into public.audit_log (
    user_id, actor, action, entity, entity_id, diff, ip, user_agent
  ) values (
    v_user_id, v_user_id, p_action, p_entity, p_entity_id, p_diff, p_ip, p_user_agent
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_audit(text, text, uuid, jsonb, inet, text)
  to authenticated, service_role;

-- ─── E15: Open-Invoices Partial Index ────────────────────────────────────
create index if not exists invoices_open_user_due_idx
  on public.invoices (user_id, due_date)
  where status in ('sent', 'partially_paid', 'overdue');

-- Sekundärindex für Filter nach payment_method (Dashboard-Chips)
create index if not exists invoices_user_payment_method_idx
  on public.invoices (user_id, payment_method)
  where payment_method is not null;

-- Bank-Transaktionen: häufigster Filter im Banking-Feed
-- (user_id + booking_date desc + WHERE payment_id IS NULL)
create index if not exists bank_transactions_user_unmatched_idx
  on public.bank_transactions (user_id, booking_date desc)
  where payment_id is null;
