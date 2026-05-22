-- Mahnwesen (dunning) — 3 stages per §286 BGB.
-- Legally NOT required to have 3 stages (1 Mahnung suffices for Verzug), but
-- customary and effective.

do $$ begin
  create type mahnung_stufe as enum ('1','2','3');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mahnung_status as enum ('draft','sent','paid','escalated');
exception when duplicate_object then null; end $$;

create table if not exists public.mahnungen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  stufe mahnung_stufe not null,
  issued_at timestamptz not null default now(),
  due_at date,
  base_amount_cents bigint not null default 0,
  fee_cents bigint not null default 0,
  verzugszinsen_cents bigint not null default 0,
  verzugspauschale_cents bigint not null default 0,  -- €40 per §288 V BGB (B2B only)
  total_cents bigint not null default 0,
  status mahnung_status not null default 'draft',
  pdf_url text,
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, stufe)
);

create index if not exists idx_mahnungen_invoice on public.mahnungen(invoice_id);
create index if not exists idx_mahnungen_user on public.mahnungen(user_id, issued_at desc);

alter table public.mahnungen enable row level security;

drop policy if exists "mahnungen_own" on public.mahnungen;
create policy "mahnungen_own" on public.mahnungen
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger trg_mahnungen_updated_at before update on public.mahnungen
  for each row execute function public.set_updated_at();

-- RPC: create_mahnung(invoice_id, stufe)
-- Calculates fees per settings + BGB §288 Verzugszinsen.
create or replace function public.create_mahnung(
  p_invoice_id uuid,
  p_stufe mahnung_stufe
)
returns public.mahnungen
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invoice public.invoices;
  v_settings public.settings;
  v_fee bigint;
  v_pauschale bigint := 0;
  v_days_overdue int;
  v_basiszins numeric(5,2) := 3.62;  -- Basiszinssatz 2025-H1, update twice per year
  v_zinssatz numeric(5,2);
  v_zinsen bigint := 0;
  v_outstanding bigint;
  v_is_b2b boolean := false;
  v_mahnung public.mahnungen;
  v_client_type text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_invoice
    from public.invoices
    where id = p_invoice_id and user_id = v_user_id;
  if not found then
    raise exception 'invoice not found' using errcode = '42501';
  end if;
  if v_invoice.locked_at is null then
    raise exception 'Rechnung ist noch Entwurf' using errcode = 'check_violation';
  end if;

  select * into v_settings
    from public.settings
    where user_id = v_user_id;

  select type into v_client_type
    from public.clients
    where id = v_invoice.client_id;
  v_is_b2b := v_client_type = 'company';

  -- Outstanding
  v_outstanding := v_invoice.total_cents - v_invoice.paid_cents;
  if v_outstanding <= 0 then
    raise exception 'Rechnung ist bereits bezahlt' using errcode = 'check_violation';
  end if;

  -- Fee by stufe
  v_fee := case p_stufe
    when '1' then v_settings.mahngebuehr_1_cents
    when '2' then v_settings.mahngebuehr_2_cents
    when '3' then v_settings.mahngebuehr_3_cents
  end;

  -- €40 Verzugspauschale applies only once per invoice and only B2B (§288 V BGB)
  if v_is_b2b and p_stufe = '1' then
    v_pauschale := v_settings.verzugspauschale_cents;
  end if;

  -- Verzugszinsen §288 BGB:
  --   Consumer: Basiszinssatz + 5 p.p.
  --   B2B: Basiszinssatz + 9 p.p.
  v_zinssatz := v_basiszins + case when v_is_b2b then 9 else 5 end;

  if v_invoice.due_date is not null then
    v_days_overdue := greatest(0, (current_date - v_invoice.due_date)::int);
    v_zinsen := round(v_outstanding * v_zinssatz / 100 * v_days_overdue / 365);
  end if;

  -- Due date for the Mahnung itself — 7-14 days from now
  insert into public.mahnungen (
    user_id, invoice_id, stufe, due_at,
    base_amount_cents, fee_cents, verzugszinsen_cents,
    verzugspauschale_cents, total_cents, status
  ) values (
    v_user_id, p_invoice_id, p_stufe,
    (current_date + case p_stufe when '1' then 14 when '2' then 10 else 7 end),
    v_outstanding, v_fee, v_zinsen, v_pauschale,
    v_outstanding + v_fee + v_zinsen + v_pauschale,
    'draft'
  )
  on conflict (invoice_id, stufe) do update
    set base_amount_cents = excluded.base_amount_cents,
        fee_cents = excluded.fee_cents,
        verzugszinsen_cents = excluded.verzugszinsen_cents,
        verzugspauschale_cents = excluded.verzugspauschale_cents,
        total_cents = excluded.total_cents,
        issued_at = now()
  returning * into v_mahnung;

  insert into public.audit_log (user_id, actor, action, entity, entity_id, diff)
    values (v_user_id, v_user_id, 'create_mahnung', 'mahnung', v_mahnung.id,
            jsonb_build_object('invoice_id', p_invoice_id, 'stufe', p_stufe));

  return v_mahnung;
end;
$$;

grant execute on function public.create_mahnung(uuid, mahnung_stufe) to authenticated;
