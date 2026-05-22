-- Kolos Digital Finanzverwaltung — Initial Schema
-- Compliance: §14 UStG, §19 UStG, GoBD, DSGVO
-- Money is stored as bigint cents (never numeric/float for money).
-- All tables have user_id and RLS with user_id = auth.uid().

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type client_type as enum ('person', 'company');
create type doc_scope as enum ('business', 'personal');
create type doc_number_kind as enum ('invoice', 'quote', 'credit_note');
create type quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted');
create type invoice_status as enum ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled');
create type line_parent_kind as enum ('quote', 'invoice');
create type entry_kind as enum ('income', 'expense');
create type jobcenter_status as enum ('draft', 'submitted', 'approved', 'rejected');

-- ============================================================================
-- IDENTITY / CONFIG
-- ============================================================================

create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null default '',
  address jsonb not null default '{}'::jsonb,
  tax_id text,                          -- Steuernummer
  ust_id text,                          -- USt-IdNr.
  is_kleinunternehmer boolean not null default true,
  iban text,
  bic text,
  bank_name text,
  default_vat_rate numeric(4,2) not null default 19.00,
  default_currency text not null default 'EUR',
  logo_url text,
  pdf_theme jsonb not null default '{}'::jsonb,
  fiscal_year_start date not null default '2026-01-01',
  locale text not null default 'de',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.number_sequences (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind doc_number_kind not null,
  year int not null,
  prefix text not null default 'KD',
  next_value int not null default 1,
  width int not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, year)
);

-- ============================================================================
-- CRM
-- ============================================================================

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type client_type not null default 'company',
  company_name text,
  first_name text,
  last_name text,
  email citext,
  phone text,
  address jsonb not null default '{}'::jsonb,   -- {street,zip,city,country}
  tax_id text,
  ust_id text,
  country text not null default 'DE',
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_user on public.clients(user_id) where archived_at is null;
create index idx_clients_user_name on public.clients(user_id, company_name, last_name);

-- ============================================================================
-- SALES DOCUMENTS
-- ============================================================================

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  number text,                          -- null while draft, set on finalize
  issue_date date not null default current_date,
  valid_until date,
  status quote_status not null default 'draft',
  subtotal_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  total_cents bigint not null default 0,
  currency text not null default 'EUR',
  notes text,
  internal_notes text,
  pdf_url text,
  converted_invoice_id uuid,            -- FK added after invoices table
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);

create index idx_quotes_user_status on public.quotes(user_id, status, issue_date desc);
create index idx_quotes_client on public.quotes(client_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,
  number text,                          -- null while draft, set on finalize
  issue_date date not null default current_date,
  delivery_date date,                   -- Leistungsdatum (§14 UStG required)
  due_date date,
  status invoice_status not null default 'draft',
  subtotal_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  total_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  currency text not null default 'EUR',
  is_kleinunternehmer_at_issue boolean not null default true,  -- GoBD snapshot
  reverse_charge boolean not null default false,               -- §13b UStG
  payment_terms text,
  notes text,
  internal_notes text,
  pdf_url text,
  pdf_hash text,                        -- SHA-256 of PDF for GoBD immutability
  cancelled_by_invoice_id uuid references public.invoices(id) on delete set null,
  cancels_invoice_id uuid references public.invoices(id) on delete set null,
  locked_at timestamptz,                -- immutable after finalize
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);

-- Now that invoices exists, add the converted_invoice_id FK on quotes
alter table public.quotes
  add constraint quotes_converted_invoice_id_fkey
  foreign key (converted_invoice_id)
  references public.invoices(id)
  on delete set null;

create index idx_invoices_user_status on public.invoices(user_id, status, due_date);
create index idx_invoices_user_issued on public.invoices(user_id, issue_date desc);
create index idx_invoices_client on public.invoices(client_id);
create index idx_invoices_user_kleinunt on public.invoices(user_id, is_kleinunternehmer_at_issue);

create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid not null,
  parent_kind line_parent_kind not null,
  position int not null default 1,
  description text not null,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'Stk',           -- "Stk", "Std", "h", "Tag", "Pauschale"
  unit_code text,                              -- UN/ECE Rec.20 code for E-Rechnung
  unit_price_cents bigint not null default 0,
  vat_rate numeric(4,2) not null default 19.00,
  discount_pct numeric(5,2) not null default 0,
  line_subtotal_cents bigint not null default 0,
  line_vat_cents bigint not null default 0,
  line_total_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_line_items_parent on public.line_items(parent_id, parent_kind, position);
create index idx_line_items_user on public.line_items(user_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  paid_at date not null default current_date,
  amount_cents bigint not null check (amount_cents > 0),
  method text not null default 'bank_transfer',   -- bank_transfer, cash, paypal, card
  reference text,                                  -- Verwendungszweck / IBAN reference
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_invoice on public.payments(invoice_id, paid_at desc);
create index idx_payments_user_date on public.payments(user_id, paid_at desc);

-- ============================================================================
-- LEDGERS (business + personal, income + expense)
-- ============================================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope doc_scope not null,
  kind entry_kind not null,
  name text not null,
  skr_code text,                         -- SKR03/SKR04 code for DATEV export
  parent_id uuid references public.categories(id) on delete set null,
  color text,
  sort_order int not null default 0,
  is_jobcenter_relevant boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_categories_user on public.categories(user_id, scope, kind, sort_order);

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope doc_scope not null default 'business',
  occurred_on date not null default current_date,
  amount_cents bigint not null,
  currency text not null default 'EUR',
  category_id uuid references public.categories(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  source text,
  description text,
  attachment_url text,
  jobcenter_relevant boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_income_user_date on public.income_entries(user_id, occurred_on desc);
create index idx_income_user_scope_date on public.income_entries(user_id, scope, occurred_on desc);
create index idx_income_jobcenter on public.income_entries(user_id, jobcenter_relevant, occurred_on) where scope = 'business';

create table public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope doc_scope not null default 'business',
  occurred_on date not null default current_date,
  amount_cents bigint not null,
  currency text not null default 'EUR',
  category_id uuid references public.categories(id) on delete set null,
  vendor text,
  description text,
  payment_method text,
  vat_cents bigint not null default 0,
  vat_rate numeric(4,2) not null default 0,
  is_deductible boolean not null default true,
  attachment_url text,
  mileage_km numeric(10,2),
  private_share_pct numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expense_user_date on public.expense_entries(user_id, occurred_on desc);
create index idx_expense_user_scope_date on public.expense_entries(user_id, scope, occurred_on desc);

-- ============================================================================
-- COMPLIANCE / REPORTING
-- ============================================================================

create table public.jobcenter_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  submitted_at timestamptz,
  income_cents bigint not null default 0,
  expenses_cents bigint not null default 0,
  net_cents bigint not null default 0,
  payload jsonb not null default '{}'::jsonb,
  pdf_url text,
  status jobcenter_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start, period_end)
);

create index idx_jobcenter_user on public.jobcenter_reports(user_id, period_start desc);

create table public.document_archive (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_kind text not null,              -- invoice, quote, credit_note, jobcenter_report
  doc_id uuid not null,
  snapshot_json jsonb not null,        -- immutable snapshot at finalize
  pdf_hash text,
  retention_until date not null,       -- 10 years for invoices (GoBD), 6 for letters
  created_at timestamptz not null default now()
);

create index idx_archive_user on public.document_archive(user_id, doc_kind, created_at desc);
create index idx_archive_retention on public.document_archive(retention_until);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor uuid,                          -- who did the action (auth.uid())
  action text not null,                -- create, update, delete, finalize, send, storno
  entity text not null,                -- invoice, quote, payment, client, ...
  entity_id uuid,
  diff jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_user on public.audit_log(user_id, created_at desc);
create index idx_audit_entity on public.audit_log(entity, entity_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime text,
  size_bytes bigint,
  sha256 text,
  created_at timestamptz not null default now()
);

create index idx_attachments_user on public.attachments(user_id, created_at desc);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
create trigger trg_number_sequences_updated_at before update on public.number_sequences
  for each row execute function public.set_updated_at();
create trigger trg_clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger trg_quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();
create trigger trg_invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger trg_line_items_updated_at before update on public.line_items
  for each row execute function public.set_updated_at();
create trigger trg_payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger trg_income_entries_updated_at before update on public.income_entries
  for each row execute function public.set_updated_at();
create trigger trg_expense_entries_updated_at before update on public.expense_entries
  for each row execute function public.set_updated_at();
create trigger trg_jobcenter_reports_updated_at before update on public.jobcenter_reports
  for each row execute function public.set_updated_at();

-- ============================================================================
-- INVOICE LOCK ENFORCEMENT (GoBD §14c UStG)
-- Once locked_at is set, only payments/status flip through payment trigger allowed.
-- ============================================================================

create or replace function public.enforce_invoice_lock()
returns trigger
language plpgsql
as $$
begin
  -- Allow only these fields to change after locked_at is set:
  --   status (by payment trigger), paid_cents (by payment trigger),
  --   cancelled_by_invoice_id (by storno), pdf_url (first PDF upload only if null -> set), updated_at
  if old.locked_at is not null then
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
    then
      raise exception 'Invoice % is locked (GoBD immutability). Create a Storno instead.', old.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_invoice_lock before update on public.invoices
  for each row execute function public.enforce_invoice_lock();

-- Prevent deletion of locked invoices (must use Storno)
create or replace function public.prevent_locked_invoice_delete()
returns trigger
language plpgsql
as $$
begin
  if old.locked_at is not null then
    raise exception 'Locked invoice % cannot be deleted (GoBD). Create a Storno.', old.id
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger trg_invoice_prevent_delete before delete on public.invoices
  for each row execute function public.prevent_locked_invoice_delete();

-- Prevent editing of line_items when parent invoice is locked
create or replace function public.enforce_line_item_lock()
returns trigger
language plpgsql
as $$
declare
  v_locked_at timestamptz;
begin
  if new.parent_kind = 'invoice' then
    select locked_at into v_locked_at from public.invoices where id = new.parent_id;
    if v_locked_at is not null then
      raise exception 'Cannot modify line items of a locked invoice %', new.parent_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_line_item_lock before insert or update on public.line_items
  for each row execute function public.enforce_line_item_lock();

create or replace function public.enforce_line_item_delete_lock()
returns trigger
language plpgsql
as $$
declare
  v_locked_at timestamptz;
begin
  if old.parent_kind = 'invoice' then
    select locked_at into v_locked_at from public.invoices where id = old.parent_id;
    if v_locked_at is not null then
      raise exception 'Cannot delete line items of a locked invoice %', old.parent_id
        using errcode = 'check_violation';
    end if;
  end if;
  return old;
end;
$$;

create trigger trg_line_item_delete_lock before delete on public.line_items
  for each row execute function public.enforce_line_item_delete_lock();

-- ============================================================================
-- PAYMENT STATUS AUTO-UPDATE
-- ============================================================================

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
    elsif v_due_date is not null and v_due_date < current_date then
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

create trigger trg_payment_recalc after insert or update or delete on public.payments
  for each row execute function public.recalc_invoice_payment();
-- Row Level Security
-- Every table enforces: user_id = auth.uid()
-- Exception: audit_log is read-only via authenticated role (append from server only).

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

alter table public.settings          enable row level security;
alter table public.number_sequences  enable row level security;
alter table public.clients           enable row level security;
alter table public.quotes            enable row level security;
alter table public.invoices          enable row level security;
alter table public.line_items        enable row level security;
alter table public.payments          enable row level security;
alter table public.categories        enable row level security;
alter table public.income_entries    enable row level security;
alter table public.expense_entries   enable row level security;
alter table public.jobcenter_reports enable row level security;
alter table public.document_archive  enable row level security;
alter table public.audit_log         enable row level security;
alter table public.attachments       enable row level security;

-- ============================================================================
-- POLICIES — simple "own rows only" pattern
-- ============================================================================

-- settings
create policy "settings_own" on public.settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- number_sequences (read only via RPC usually, but allow direct CRUD for settings UI)
create policy "number_sequences_own" on public.number_sequences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- clients
create policy "clients_own" on public.clients
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- quotes
create policy "quotes_own" on public.quotes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- invoices
create policy "invoices_own" on public.invoices
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- line_items
create policy "line_items_own" on public.line_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- payments
create policy "payments_own" on public.payments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- categories
create policy "categories_own" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- income_entries
create policy "income_entries_own" on public.income_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- expense_entries
create policy "expense_entries_own" on public.expense_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- jobcenter_reports
create policy "jobcenter_reports_own" on public.jobcenter_reports
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- document_archive — read-only for user (inserts happen via security-definer function)
create policy "document_archive_read_own" on public.document_archive
  for select to authenticated
  using (user_id = (select auth.uid()));

-- audit_log — read only for user
create policy "audit_log_read_own" on public.audit_log
  for select to authenticated
  using (user_id = (select auth.uid()));

-- attachments
create policy "attachments_own" on public.attachments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============================================================================
-- AUTO-CREATE SETTINGS ON SIGNUP
-- When a new auth.user row appears, seed the settings row.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_year int := extract(year from current_date);
begin
  insert into public.settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

  insert into public.number_sequences (user_id, kind, year, prefix, next_value, width)
    values
      (new.id, 'invoice', v_year, 'KD', 1, 4),
      (new.id, 'quote', v_year, 'AN', 1, 4),
      (new.id, 'credit_note', v_year, 'GS', 1, 4)
    on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
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
-- Seed default SKR03-aligned categories for new users.
-- Called from handle_new_user() trigger.
-- SKR03 codes are German "Standard-Kontenrahmen" for DATEV export later.

create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Business income categories
  insert into public.categories (user_id, scope, kind, name, skr_code, sort_order, color, is_jobcenter_relevant) values
    (p_user_id, 'business', 'income', 'Erlöse Dienstleistungen',    '8400', 10, '#10b981', true),
    (p_user_id, 'business', 'income', 'Erlöse Produktverkauf',      '8410', 20, '#059669', true),
    (p_user_id, 'business', 'income', 'Sonstige betriebliche Erträge','8500', 30, '#14b8a6', true),
    (p_user_id, 'business', 'income', 'Zinserträge',                '2650', 40, '#06b6d4', false);

  -- Business expense categories (Jobcenter EKS-relevant ones flagged)
  insert into public.categories (user_id, scope, kind, name, skr_code, sort_order, color, is_jobcenter_relevant) values
    (p_user_id, 'business', 'expense', 'Wareneinkauf',               '3400', 10, '#ef4444', true),
    (p_user_id, 'business', 'expense', 'Fremdleistungen / Subunternehmer','3100', 20, '#dc2626', true),
    (p_user_id, 'business', 'expense', 'Personalkosten (Löhne)',     '4100', 30, '#b91c1c', true),
    (p_user_id, 'business', 'expense', 'Raumkosten (Miete Büro)',    '4210', 40, '#f97316', true),
    (p_user_id, 'business', 'expense', 'Versicherungen (Betrieb)',   '4360', 50, '#ea580c', true),
    (p_user_id, 'business', 'expense', 'KFZ-Kosten (betrieblich)',   '4500', 60, '#c2410c', true),
    (p_user_id, 'business', 'expense', 'Reisekosten',                '4660', 70, '#f59e0b', true),
    (p_user_id, 'business', 'expense', 'Bewirtung',                  '4650', 80, '#d97706', true),
    (p_user_id, 'business', 'expense', 'Telefon & Internet',         '4920', 90, '#eab308', true),
    (p_user_id, 'business', 'expense', 'Büromaterial',               '4930', 100, '#ca8a04', true),
    (p_user_id, 'business', 'expense', 'Software-Abos',              '4909', 110, '#a3a3a3', true),
    (p_user_id, 'business', 'expense', 'Werbung & Marketing',        '4610', 120, '#8b5cf6', true),
    (p_user_id, 'business', 'expense', 'Beratungskosten (Steuerberater, Anwalt)','4955', 130, '#a855f7', true),
    (p_user_id, 'business', 'expense', 'Fortbildung',                '4940', 140, '#ec4899', true),
    (p_user_id, 'business', 'expense', 'Abschreibungen (AfA)',       '4830', 150, '#64748b', false),
    (p_user_id, 'business', 'expense', 'Zinsen Bankkredit',          '2110', 160, '#475569', false),
    (p_user_id, 'business', 'expense', 'Bankgebühren',               '4970', 170, '#334155', true),
    (p_user_id, 'business', 'expense', 'Sonstige Betriebsausgaben',  '4900', 180, '#6b7280', true);

  -- Personal income
  insert into public.categories (user_id, scope, kind, name, sort_order, color) values
    (p_user_id, 'personal', 'income', 'Gehalt / Lohn',        10, '#10b981'),
    (p_user_id, 'personal', 'income', 'Bürgergeld (Jobcenter)',20, '#14b8a6'),
    (p_user_id, 'personal', 'income', 'Wohngeld',             30, '#06b6d4'),
    (p_user_id, 'personal', 'income', 'Kindergeld',           40, '#0ea5e9'),
    (p_user_id, 'personal', 'income', 'Geschenke / Sonstiges',50, '#6366f1');

  -- Personal expense
  insert into public.categories (user_id, scope, kind, name, sort_order, color) values
    (p_user_id, 'personal', 'expense', 'Miete & Nebenkosten', 10, '#ef4444'),
    (p_user_id, 'personal', 'expense', 'Lebensmittel',        20, '#f97316'),
    (p_user_id, 'personal', 'expense', 'Transport / ÖPNV',    30, '#f59e0b'),
    (p_user_id, 'personal', 'expense', 'Versicherungen (privat)',40, '#eab308'),
    (p_user_id, 'personal', 'expense', 'Krankenkasse',        50, '#84cc16'),
    (p_user_id, 'personal', 'expense', 'Internet & Handy',    60, '#a3e635'),
    (p_user_id, 'personal', 'expense', 'Kleidung',            70, '#22d3ee'),
    (p_user_id, 'personal', 'expense', 'Freizeit & Hobby',    80, '#60a5fa'),
    (p_user_id, 'personal', 'expense', 'Bildung',             90, '#8b5cf6'),
    (p_user_id, 'personal', 'expense', 'Sonstiges',          100, '#94a3b8');
end;
$$;

grant execute on function public.seed_default_categories(uuid) to authenticated;

-- Extend handle_new_user to also seed categories
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_year int := extract(year from current_date);
begin
  insert into public.settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

  insert into public.number_sequences (user_id, kind, year, prefix, next_value, width)
    values
      (new.id, 'invoice', v_year, 'KD', 1, 4),
      (new.id, 'quote', v_year, 'AN', 1, 4),
      (new.id, 'credit_note', v_year, 'GS', 1, 4)
    on conflict do nothing;

  perform public.seed_default_categories(new.id);

  return new;
end;
$$;
-- Storage buckets for PDFs and attachments
-- Bucket names are user-scoped via RLS on storage.objects.

-- ============================================================================
-- BUCKETS
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documents', 'documents', false, 20971520, array['application/pdf'])
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('attachments', 'attachments', false, 20971520,
          array['application/pdf','image/jpeg','image/png','image/webp','image/heic'])
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('logos', 'logos', true, 2097152,
          array['image/png','image/jpeg','image/svg+xml','image/webp'])
  on conflict (id) do nothing;

-- ============================================================================
-- POLICIES — path convention: bucket/<user_id>/<rest>
-- ============================================================================

-- documents: private, owner-only
create policy "documents_own_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "documents_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "documents_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "documents_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- attachments: private, owner-only
create policy "attachments_own_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "attachments_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "attachments_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "attachments_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- logos: public read (for PDF embedding), owner write
create policy "logos_public_select" on storage.objects
  for select to public
  using (bucket_id = 'logos');

create policy "logos_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "logos_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "logos_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
