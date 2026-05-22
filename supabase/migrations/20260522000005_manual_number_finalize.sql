-- Manuelle Rechnungsnummer beim Finalisieren respektieren +
-- allocate_number: Präfix vom Vorjahr übernehmen statt 'KD' hardcoden.
--
-- Vorher (Bug 1): Auch wenn der User in einem Draft `manual_number` gesetzt
-- hatte, überschrieb `finalize_invoice` die Nummer unconditional via
-- `allocate_number` → die manuelle Eingabe ging verloren. Schlimmer noch:
-- die Sequenz wurde inkrementiert, aber der manuelle Wert blieb ungenutzt
-- → Lücken in der laufenden Nummerierung, was §14 UStG-Pflicht zur
-- gap-free numbering verletzt.
--
-- Vorher (Bug 2): allocate_number setzte beim Jahreswechsel `prefix = 'KD'`
-- hardcoded. Wenn der User in den Settings auf 'RE' gewechselt hatte, fiel
-- die Nummerierung am 1. Januar zurück auf 'KD' → unbeabsichtigte Serie.
--
-- Jetzt:
--   1. Wenn das Draft schon eine `number` hat → wir behalten sie.
--   2. Wir parsen "PREFIX-YYYY-NNNN" und ziehen number_sequences.next_value
--      auf NNNN+1 hoch, falls noch dahinter. So gehen Auto-Nummern danach
--      lückenlos weiter.
--   3. Wenn das Format unparseable ist (z.B. "REKL-A123") behalten wir die
--      Nummer trotzdem, aber loggen den Sonderfall in audit_log.

-- ─── allocate_number: prefix vom letzten Jahr übernehmen ────────────────
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
  v_last_prefix text;
begin
  if v_user_id is null then
    raise exception 'allocate_number: not authenticated' using errcode = '28000';
  end if;

  select prefix, next_value, width
    into v_prefix, v_next, v_width
    from public.number_sequences
    where user_id = v_user_id and kind = p_kind and year = v_year
    for update;

  if not found then
    -- Beim Jahreswechsel: nimm den Präfix vom zuletzt verwendeten Jahr
    -- des gleichen kind. Fallback auf 'KD' nur wenn der User den
    -- Sequenz-Typ noch nie benutzt hat.
    select prefix into v_last_prefix
      from public.number_sequences
      where user_id = v_user_id and kind = p_kind
      order by year desc
      limit 1;

    insert into public.number_sequences (user_id, kind, year, prefix, next_value, width)
      values (
        v_user_id,
        p_kind,
        v_year,
        coalesce(v_last_prefix, 'KD'),
        1,
        4
      )
      returning prefix, next_value, width into v_prefix, v_next, v_width;
  end if;

  v_number := format('%s-%s-%s', v_prefix, v_year, lpad(v_next::text, v_width, '0'));

  update public.number_sequences
    set next_value = next_value + 1
    where user_id = v_user_id and kind = p_kind and year = v_year;

  return v_number;
end;
$$;

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
  v_manual text;
  v_parsed_prefix text;
  v_parsed_year int;
  v_parsed_value int;
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
  v_manual := nullif(trim(coalesce(v_invoice.number, '')), '');

  if v_manual is not null then
    -- Manueller Override — behalten und Sequenz nachziehen damit künftige
    -- Auto-Nummern nicht in dieselbe Lücke springen.
    v_number := v_manual;

    -- Versuch zu parsen: "PREFIX-YYYY-NNNN" (case-insensitive prefix)
    select
      (regexp_match(v_manual, '^([A-Za-z]+)-(\d{4})-(\d+)$'))[1],
      (regexp_match(v_manual, '^([A-Za-z]+)-(\d{4})-(\d+)$'))[2]::int,
      (regexp_match(v_manual, '^([A-Za-z]+)-(\d{4})-(\d+)$'))[3]::int
      into v_parsed_prefix, v_parsed_year, v_parsed_value;

    if v_parsed_value is not null and v_parsed_year = v_year then
      -- Sequenz nachziehen: next_value = max(next_value, v_parsed_value + 1)
      insert into public.number_sequences (user_id, kind, year, prefix, next_value, width)
        values (v_user_id, 'invoice', v_year, coalesce(v_parsed_prefix, 'KD'), v_parsed_value + 1, 4)
        on conflict (user_id, kind, year) do update
        set next_value = greatest(public.number_sequences.next_value, excluded.next_value);
    else
      -- Sonderfall: manueller Wert ist unparseable. Wir notieren das im
      -- audit_log, damit der User später nachvollziehen kann warum die
      -- Sequenz nicht nachgezogen wurde.
      insert into public.audit_log (user_id, actor, action, entity, entity_id, diff)
        values (
          v_user_id,
          v_user_id,
          'finalize_manual_unparseable',
          'invoice',
          p_invoice_id,
          jsonb_build_object('manual_number', v_manual)
        );
    end if;
  else
    -- Kein Override → normale Auto-Allokation.
    v_number := public.allocate_number('invoice', v_year);
  end if;

  update public.invoices
    set number = v_number,
        status = 'sent',
        locked_at = now(),
        sent_at = coalesce(sent_at, now())
    where id = p_invoice_id
    returning * into v_invoice;

  -- GoBD-Snapshot
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

-- ─── Same Treatment für Quotes ──────────────────────────────────────────
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
  v_parsed_prefix text;
  v_parsed_year int;
  v_parsed_value int;
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

  v_year := extract(year from v_quote.issue_date)::int;

  if v_quote.number is null then
    v_number := public.allocate_number('quote', v_year);
  else
    -- Manueller Override → respektieren + Sequenz nachziehen
    v_number := v_quote.number;
    select
      (regexp_match(v_number, '^([A-Za-z]+)-(\d{4})-(\d+)$'))[1],
      (regexp_match(v_number, '^([A-Za-z]+)-(\d{4})-(\d+)$'))[2]::int,
      (regexp_match(v_number, '^([A-Za-z]+)-(\d{4})-(\d+)$'))[3]::int
      into v_parsed_prefix, v_parsed_year, v_parsed_value;
    if v_parsed_value is not null and v_parsed_year = v_year then
      insert into public.number_sequences (user_id, kind, year, prefix, next_value, width)
        values (v_user_id, 'quote', v_year, coalesce(v_parsed_prefix, 'AN'), v_parsed_value + 1, 4)
        on conflict (user_id, kind, year) do update
        set next_value = greatest(public.number_sequences.next_value, excluded.next_value);
    end if;
  end if;

  update public.quotes
    set number = v_number,
        status = 'sent'
    where id = p_quote_id
    returning * into v_quote;

  insert into public.audit_log (user_id, actor, action, entity, entity_id)
    values (v_user_id, v_user_id, 'send', 'quote', p_quote_id);

  return v_quote;
end;
$$;
