-- Gap-Free Sequential Numbering RPC
-- §14 UStG requires invoice numbers to be unique and plausibly gap-free.
-- We allocate via FOR UPDATE on number_sequences inside a transaction.
-- Called only at finalize time, inside the same tx that sets locked_at.

-- ============================================================================
-- allocate_number: reserve the next invoice/quote/credit_note number
-- ============================================================================

create or replace function public.allocate_number(
  p_kind doc_number_kind,
  p_year int default null
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_year int := coalesce(p_year, extract(year from current_date)::int);
  v_prefix text;
  v_next int;
  v_width int;
  v_number text;
begin
  if v_user_id is null then
    raise exception 'allocate_number: not authenticated' using errcode = '28000';
  end if;

  -- Lock the row (or create it if this is a new year)
  select prefix, next_value, width
    into v_prefix, v_next, v_width
    from public.number_sequences
    where user_id = v_user_id and kind = p_kind and year = v_year
    for update;

  if not found then
    -- Initialize sequence for this year
    insert into public.number_sequences (user_id, kind, year, prefix, next_value, width)
      values (v_user_id, p_kind, v_year, 'KD', 1, 4)
      returning prefix, next_value, width into v_prefix, v_next, v_width;
  end if;

  v_number := format('%s-%s-%s', v_prefix, v_year, lpad(v_next::text, v_width, '0'));

  update public.number_sequences
    set next_value = next_value + 1
    where user_id = v_user_id and kind = p_kind and year = v_year;

  return v_number;
end;
$$;

grant execute on function public.allocate_number(doc_number_kind, int) to authenticated;

-- ============================================================================
-- finalize_invoice: atomic "issue" action
-- Sets number, locked_at, status='sent', archives snapshot.
-- This is the ONLY safe place where numbers are allocated for invoices.
-- ============================================================================

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

  -- Snapshot for GoBD archive (10-year retention for invoices)
  select jsonb_build_object(
      'invoice', row_to_json(v_invoice),
      'line_items', coalesce(jsonb_agg(row_to_json(li) order by li.position), '[]'::jsonb),
      'client', (select row_to_json(c) from public.clients c where c.id = v_invoice.client_id),
      'settings_snapshot', (select row_to_json(s) from public.settings s where s.user_id = v_user_id)
    ) into v_snapshot
    from public.line_items li
    where li.parent_id = p_invoice_id and li.parent_kind = 'invoice';

  insert into public.document_archive (user_id, doc_kind, doc_id, snapshot_json, retention_until)
    values (
      v_user_id,
      'invoice',
      p_invoice_id,
      v_snapshot,
      (v_invoice.issue_date + interval '10 years')::date
    );

  insert into public.audit_log (user_id, actor, action, entity, entity_id)
    values (v_user_id, v_user_id, 'finalize', 'invoice', p_invoice_id);

  return v_invoice;
end;
$$;

grant execute on function public.finalize_invoice(uuid) to authenticated;

-- ============================================================================
-- finalize_quote: simpler — allocates quote number, sets status='sent'.
-- Quotes are NOT locked immutable; they can be re-sent.
-- ============================================================================

create or replace function public.finalize_quote(p_quote_id uuid)
returns public.quotes
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_quote public.quotes;
  v_year int;
  v_number text;
begin
  if v_user_id is null then
    raise exception 'finalize_quote: not authenticated' using errcode = '28000';
  end if;

  select * into v_quote
    from public.quotes
    where id = p_quote_id and user_id = v_user_id
    for update;

  if not found then
    raise exception 'Quote % not found or not owned', p_quote_id using errcode = '42501';
  end if;

  if v_quote.number is null then
    v_year := extract(year from v_quote.issue_date)::int;
    v_number := public.allocate_number('quote', v_year);
    update public.quotes
      set number = v_number,
          status = 'sent'
      where id = p_quote_id
      returning * into v_quote;
  else
    update public.quotes
      set status = 'sent'
      where id = p_quote_id
      returning * into v_quote;
  end if;

  insert into public.audit_log (user_id, actor, action, entity, entity_id)
    values (v_user_id, v_user_id, 'send', 'quote', p_quote_id);

  return v_quote;
end;
$$;

grant execute on function public.finalize_quote(uuid) to authenticated;

-- ============================================================================
-- storno_invoice: create a negative (cancellation) invoice
-- Links both via cancelled_by_invoice_id / cancels_invoice_id.
-- Original invoice gets status='cancelled'. Storno receives its own next number.
-- ============================================================================

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

  -- Copy line items with negative quantities
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

  -- Mark original as cancelled (direct UPDATE bypassing lock check — special path)
  update public.invoices
    set cancelled_by_invoice_id = v_storno_id,
        status = 'cancelled'
    where id = p_invoice_id;

  -- Archive the Storno
  insert into public.document_archive (user_id, doc_kind, doc_id, snapshot_json, retention_until)
    select v_user_id, 'credit_note', v_storno_id,
      jsonb_build_object('invoice', row_to_json(i), 'cancels', p_invoice_id, 'reason', p_reason),
      (current_date + interval '10 years')::date
    from public.invoices i where i.id = v_storno_id;

  insert into public.audit_log (user_id, actor, action, entity, entity_id, diff)
    values (v_user_id, v_user_id, 'storno', 'invoice', p_invoice_id,
            jsonb_build_object('storno_id', v_storno_id, 'reason', p_reason));

  select * into v_storno from public.invoices where id = v_storno_id;
  return v_storno;
end;
$$;

grant execute on function public.storno_invoice(uuid, text) to authenticated;

-- ============================================================================
-- Special exception: storno path needs to set cancelled_by_invoice_id + status
-- on a locked invoice. Adjust enforce_invoice_lock to allow these specific fields.
-- (Done here as a correction to the earlier lock function.)
-- ============================================================================

create or replace function public.enforce_invoice_lock()
returns trigger
language plpgsql
as $$
begin
  if old.locked_at is not null then
    -- Allow status changes + payment-related + storno linking
    if (new.issue_date is distinct from old.issue_date)
      or (new.delivery_date is distinct from old.delivery_date)
      or (new.due_date is distinct from old.due_date)
      or (new.client_id is distinct from old.client_id)
      or (new.subtotal_cents is distinct from old.subtotal_cents)
      or (new.vat_cents is distinct from old.vat_cents)
      or (new.total_cents is distinct from old.total_cents)
      or (new.number is distinct from old.number)
      or (new.is_kleinunternehmer_at_issue is distinct from old.is_kleinunternehmer_at_issue)
      or (new.reverse_charge is distinct from old.reverse_charge)
      or (new.notes is distinct from old.notes)
      or (new.payment_terms is distinct from old.payment_terms)
      or (new.pdf_hash is distinct from old.pdf_hash and old.pdf_hash is not null)
      or (new.cancels_invoice_id is distinct from old.cancels_invoice_id)
    then
      raise exception 'Invoice % is locked (GoBD immutability). Create a Storno instead.', old.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
