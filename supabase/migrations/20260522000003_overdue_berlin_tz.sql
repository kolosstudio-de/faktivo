-- Overdue-Status soll auf den Berliner Kalendertag prüfen, nicht UTC.
--
-- Vorher: `recalc_invoice_payment` nutzte `current_date`, das in Supabase
-- der Session-Timezone (UTC) folgt. Zwischen 22:00 und 24:00 Uhr Berlin
-- (= UTC nächster Tag) sprang `current_date` schon einen Tag voraus →
-- Rechnungen wurden zu früh als "überfällig" markiert; umgekehrt nach
-- Mitternacht Berlin blieb der Status noch einen Stunde "sent".
--
-- Jetzt: konsequente Konversion via `(now() at time zone 'Europe/Berlin')::date`.

create or replace function public.recalc_invoice_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_total bigint;
  v_paid bigint;
  v_due_date date;
  v_status invoice_status;
  v_locked timestamptz;
  v_today_berlin date := (now() at time zone 'Europe/Berlin')::date;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select total_cents, due_date, status, locked_at
    into v_total, v_due_date, v_status, v_locked
    from public.invoices
    where id = v_invoice_id;

  select coalesce(sum(amount_cents), 0)
    into v_paid
    from public.payments
    where invoice_id = v_invoice_id;

  -- Only auto-update for locked (issued) invoices, not drafts
  if v_locked is not null then
    if v_paid >= v_total then
      v_status := 'paid';
    elsif v_paid > 0 then
      v_status := 'partially_paid';
    elsif v_due_date is not null and v_due_date < v_today_berlin then
      v_status := 'overdue';
    else
      v_status := 'sent';
    end if;
  end if;

  update public.invoices
    set paid_cents = v_paid, status = v_status
    where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;
