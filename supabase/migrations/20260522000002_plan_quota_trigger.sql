-- Server-Side Plan-Quota für Free-Tier (3 Rechnungen / Monat).
--
-- Vorher: Limit wurde NUR im Server-Component `/invoices/new/page.tsx` geprüft.
-- Ein Angreifer (oder ein versehentlich offen gelassener anon-Token) konnte
-- via PostgREST direkt insertieren und an der UI vorbei beliebig viele
-- Rechnungen anlegen → Free → Pro-Umsatz-Bypass.
--
-- Jetzt: BEFORE INSERT-Trigger auf `invoices`. Storno-Rechnungen
-- (cancels_invoice_id IS NOT NULL) zählen nicht. Pro/Business sind unbegrenzt.

-- ─── Quota-Check Function ────────────────────────────────────────────────
create or replace function public.check_invoice_quota(
  p_user_id uuid,
  p_issue_date date,
  p_is_storno boolean
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_plan plan_tier;
  v_count int;
  v_month_start date;
  v_month_end date;
  v_limit int := 3; -- Free-Tier: 3 Rechnungen / Monat (siehe lib/billing/plans.ts)
begin
  -- Storno zählt nie zur Quota (Korrektur einer existierenden Rechnung)
  if p_is_storno then
    return;
  end if;

  -- Plan aus settings — wenn kein Eintrag existiert, fallen wir auf 'free'
  -- zurück (defensive). Bei NULL plan ebenfalls Free.
  select coalesce(plan, 'free'::plan_tier)
    into v_plan
    from public.settings
    where user_id = p_user_id;

  if v_plan in ('pro', 'business') then
    return;
  end if;

  -- Free-Tier: zähle Rechnungen im selben Kalendermonat wie issue_date
  v_month_start := date_trunc('month', p_issue_date)::date;
  v_month_end := (v_month_start + interval '1 month')::date;

  select count(*)
    into v_count
    from public.invoices
    where user_id = p_user_id
      and cancels_invoice_id is null
      and issue_date >= v_month_start
      and issue_date < v_month_end;

  if v_count >= v_limit then
    raise exception
      'Free-Tier-Limit erreicht: max % Rechnungen / Monat. Upgrade auf Pro unter /billing.',
      v_limit
      using errcode = 'check_violation';
  end if;
end;
$$;

grant execute on function public.check_invoice_quota(uuid, date, boolean) to authenticated, service_role;

-- ─── Trigger ─────────────────────────────────────────────────────────────
create or replace function public.enforce_invoice_quota()
returns trigger
language plpgsql
as $$
begin
  perform public.check_invoice_quota(
    new.user_id,
    new.issue_date,
    new.cancels_invoice_id is not null
  );
  return new;
end;
$$;

drop trigger if exists trg_invoice_quota on public.invoices;
create trigger trg_invoice_quota
  before insert on public.invoices
  for each row execute function public.enforce_invoice_quota();
