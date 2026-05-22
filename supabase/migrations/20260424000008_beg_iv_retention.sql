-- Bürokratieentlastungsgesetz IV (BGBl. I 2024 Nr. 323, in force 2025-01-01)
-- Reduces retention for invoices / Buchungsbelege from 10 years to 8 years.
-- Update finalize_invoice RPC accordingly and backfill existing archives.

-- 1. Fix the retention calculation in finalize_invoice
create or replace function public.finalize_invoice(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invoice public.invoices;
  v_year int;
  v_number text;
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception 'finalize_invoice: not authenticated' using errcode = '28000';
  end if;

  select * into v_invoice
    from public.invoices
    where id = p_invoice_id and user_id = v_user_id
    for update;

  if not found then
    raise exception 'Invoice % not found or not owned', p_invoice_id using errcode = '42501';
  end if;

  if v_invoice.locked_at is not null then
    raise exception 'Invoice % already finalized', p_invoice_id using errcode = 'check_violation';
  end if;

  if v_invoice.status = 'cancelled' then
    raise exception 'Cannot finalize a cancelled invoice' using errcode = 'check_violation';
  end if;

  v_year := extract(year from v_invoice.issue_date)::int;
  v_number := public.allocate_number('invoice', v_year);

  update public.invoices
    set number = v_number,
        status = 'sent',
        locked_at = now(),
        sent_at = coalesce(sent_at, now())
    where id = p_invoice_id
    returning * into v_invoice;

  select jsonb_build_object(
      'invoice', row_to_json(v_invoice),
      'line_items', coalesce(jsonb_agg(row_to_json(li) order by li.position), '[]'::jsonb),
      'client', (select row_to_json(c) from public.clients c where c.id = v_invoice.client_id),
      'settings_snapshot', (select row_to_json(s) from public.settings s where s.user_id = v_user_id)
    ) into v_snapshot
    from public.line_items li
    where li.parent_id = p_invoice_id and li.parent_kind = 'invoice';

  -- 8 years retention per BEG IV (was 10 years pre-2025).
  insert into public.document_archive (user_id, doc_kind, doc_id, snapshot_json, retention_until)
    values (
      v_user_id,
      'invoice',
      p_invoice_id,
      v_snapshot,
      (v_invoice.issue_date + interval '8 years')::date
    );

  insert into public.audit_log (user_id, actor, action, entity, entity_id)
    values (v_user_id, v_user_id, 'finalize', 'invoice', p_invoice_id);

  return v_invoice;
end;
$$;

-- 2. Same in storno path
create or replace function public.storno_invoice(p_invoice_id uuid, p_reason text default null)
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
begin
  if v_user_id is null then
    raise exception 'storno_invoice: not authenticated' using errcode = '28000';
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
    coalesce('Stornorechnung zu ' || v_orig.number || coalesce(E'\n' || p_reason, ''), v_orig.notes),
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
      jsonb_build_object('invoice', row_to_json(i), 'cancels', p_invoice_id, 'reason', p_reason),
      (current_date + interval '8 years')::date
    from public.invoices i where i.id = v_storno_id;

  insert into public.audit_log (user_id, actor, action, entity, entity_id, diff)
    values (v_user_id, v_user_id, 'storno', 'invoice', p_invoice_id,
            jsonb_build_object('storno_id', v_storno_id, 'reason', p_reason));

  select * into v_storno from public.invoices where id = v_storno_id;
  return v_storno;
end;
$$;

-- 3. Backfill existing archives (set retention to issue_date + 8 years)
update public.document_archive da
set retention_until = (
  case
    when da.doc_kind in ('invoice','credit_note') then
      (da.created_at + interval '8 years')::date
    else da.retention_until
  end
)
where doc_kind in ('invoice','credit_note');
