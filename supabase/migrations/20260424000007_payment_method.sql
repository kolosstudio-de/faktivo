-- Track how an invoice was paid: cash (Bar), card (Karte), bank_transfer (Überweisung), paypal, null.
-- This is a summary cached from payments — automatically kept in sync by recalc trigger.

alter table public.invoices
  add column if not exists payment_method text;

-- Extend the payment recalc trigger to also update invoice.payment_method
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
  v_method text;
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

  -- Latest payment method wins (most recent paid_at, tiebreak by created_at)
  select method
    into v_method
    from public.payments
    where invoice_id = v_invoice_id
    order by paid_at desc, created_at desc
    limit 1;

  if v_locked is not null then
    if v_paid >= v_total then
      v_status := 'paid';
    elsif v_paid > 0 then
      v_status := 'partially_paid';
    elsif v_due_date is not null and v_due_date < current_date then
      v_status := 'overdue';
    else
      v_status := 'sent';
    end if;
  end if;

  update public.invoices
    set paid_cents = v_paid, status = v_status, payment_method = v_method
    where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;
