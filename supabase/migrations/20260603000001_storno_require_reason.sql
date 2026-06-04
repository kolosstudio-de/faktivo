-- Storno-Begründung serverseitig erzwingen
--
-- BIS HIER war p_reason optional (default NULL) und der ≥ 3-Zeichen-Check nur
-- im Client (`invoice-actions.tsx:404,426`). Ein Power-User, der den RPC direkt
-- aus dem Supabase-SQL-Editor oder via supabase-js aufruft, umging den Gate
-- vollständig — eine Stornorechnung ohne Begründung verstößt jedoch gegen
-- § 14 Abs. 6 UStG i.V.m. § 14c UStG (Pflicht zur Korrekturangabe).
--
-- Fix: gleiche Funktion neu definieren, `default null` entfernen und einen
-- harten Check vorne im Body einbauen, der `null`, leeren String und Strings
-- kürzer als 3 Zeichen ablehnt. Codes bleiben kompatibel mit dem bestehenden
-- Frontend-Aufruf (`storno_invoice(p_invoice_id := id, p_reason := text)`).
--
-- Idempotent (CREATE OR REPLACE).
-- Stand 2026-06-03

create or replace function public.storno_invoice(p_invoice_id uuid, p_reason text)
returns public.invoices
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_orig public.invoices;
  v_storno public.invoices;
  v_storno_id uuid;
  v_number text;
  v_year int;
  v_reason_clean text;
begin
  if v_user_id is null then
    raise exception 'storno_invoice: not authenticated' using errcode = '28000';
  end if;

  -- § 14 Abs. 6 UStG: Stornierungsgrund ist Pflicht. Mindestens 3 Zeichen
  -- nach trim — verhindert "...", "x", " " als Pseudo-Begründungen.
  v_reason_clean := trim(coalesce(p_reason, ''));
  if length(v_reason_clean) < 3 then
    raise exception 'storno_invoice: reason required (min 3 chars after trim)'
      using errcode = '22023', -- invalid_parameter_value
            hint = 'Pass a non-empty p_reason describing why the invoice is being cancelled.';
  end if;

  select * into v_orig
    from public.invoices
    where id = p_invoice_id and user_id = v_user_id
    for update;

  if not found then
    raise exception 'Invoice % not found', p_invoice_id using errcode = '42501';
  end if;

  if v_orig.locked_at is null then
    raise exception 'Cannot Storno a draft — just delete it' using errcode = 'check_violation';
  end if;

  if v_orig.status = 'cancelled' then
    raise exception 'Invoice already cancelled' using errcode = 'check_violation';
  end if;

  v_year := extract(year from current_date)::int;
  v_number := public.allocate_number('credit_note', v_year);
  v_storno_id := gen_random_uuid();

  insert into public.invoices (
    id, user_id, client_id, quote_id, number,
    issue_date, delivery_date, due_date,
    status, subtotal_cents, vat_cents, total_cents, currency,
    is_kleinunternehmer_at_issue, reverse_charge, payment_terms,
    notes, internal_notes, cancels_invoice_id, locked_at, sent_at
  ) values (
    v_storno_id, v_user_id, v_orig.client_id, v_orig.quote_id, v_number,
    current_date, v_orig.delivery_date, current_date,
    'sent',
    -1 * v_orig.subtotal_cents, -1 * v_orig.vat_cents, -1 * v_orig.total_cents, v_orig.currency,
    v_orig.is_kleinunternehmer_at_issue, v_orig.reverse_charge, v_orig.payment_terms,
    'Stornorechnung zu ' || v_orig.number || E'\n' || v_reason_clean,
    v_orig.internal_notes, p_invoice_id, now(), now()
  );

  insert into public.line_items (
    user_id, parent_id, parent_kind, position, description,
    quantity, unit, unit_code, unit_price_cents, vat_rate, discount_pct,
    line_subtotal_cents, line_vat_cents, line_total_cents
  )
  select user_id, v_storno_id, 'invoice', position, description,
    -1 * quantity, unit, unit_code, unit_price_cents, vat_rate, discount_pct,
    -1 * line_subtotal_cents, -1 * line_vat_cents, -1 * line_total_cents
  from public.line_items
  where parent_id = p_invoice_id and parent_kind = 'invoice';

  update public.invoices
    set cancelled_by_invoice_id = v_storno_id,
        status = 'cancelled'
    where id = p_invoice_id;

  -- 8 years retention per BEG IV
  insert into public.document_archive (user_id, doc_kind, doc_id, snapshot_json, retention_until)
    select v_user_id, 'credit_note', v_storno_id,
      jsonb_build_object('invoice', row_to_json(i), 'cancels', p_invoice_id, 'reason', v_reason_clean),
      (current_date + interval '8 years')::date
    from public.invoices i where i.id = v_storno_id;

  insert into public.audit_log (user_id, actor, action, entity, entity_id, diff)
    values (v_user_id, v_user_id, 'storno', 'invoice', p_invoice_id,
            jsonb_build_object('storno_id', v_storno_id, 'reason', v_reason_clean));

  select * into v_storno from public.invoices where id = v_storno_id;
  return v_storno;
end;
$$;

-- Re-grant execute (signature changed: dropped default → different proc oid)
grant execute on function public.storno_invoice(uuid, text) to authenticated;

-- Sanity test (commented — un-comment locally to verify):
-- do $$ begin
--   perform public.storno_invoice('00000000-0000-0000-0000-000000000000'::uuid, '');
--   raise exception 'expected reason-required failure but got none';
-- exception
--   when sqlstate '22023' then null; -- expected
--   when others then raise;
-- end $$;
