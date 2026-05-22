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
