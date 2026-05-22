-- Recurring Expenses (Verträge / Abos / Kredite / Mieten),
-- AI Category Rules (Lernen aus User-Korrekturen),
-- Steuerberater ZIP-Audit-Trail.
-- Stand 2026-04-27

-- ─── recurring_expenses ──────────────────────────────────────────────────
-- Eine Zeile pro wiederkehrender Verpflichtung. Cron erzeugt monatlich/jährlich
-- expense_entries draus.
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope public.doc_scope not null default 'business',
  kind text not null check (kind in (
    'subscription',     -- Spotify, Netflix, GitHub
    'rent',             -- Miete Wohnung / Büro
    'utility',          -- Strom, Wasser, Internet
    'loan',             -- Ratenkredit
    'insurance',        -- Versicherung
    'membership',       -- Verein, Sport
    'leasing',          -- Auto-Leasing
    'other'
  )),
  -- Display
  name text not null,                    -- "Spotify Family", "Auto-Kredit Renault"
  vendor text,                            -- Lieferant / Bank
  category_id uuid references public.categories(id) on delete set null,
  -- Recurrence
  frequency text not null check (frequency in ('monthly', 'quarterly', 'yearly')),
  amount_cents bigint not null check (amount_cents > 0),
  vat_rate numeric(4,2) not null default 19,
  payment_method text,                   -- bar/ec_karte/lastschrift/...
  -- Schedule
  start_date date not null default current_date,
  end_date date,                          -- für Kredite: letzter Tag
  next_due_date date not null,
  last_posted_date date,                 -- letzter erstellter expense_entry
  remaining_payments integer,            -- nur für Kredite (Restanzahl)
  -- For loans: what's still owed
  total_amount_cents bigint,             -- Gesamthöhe Kredit (10000€)
  remaining_amount_cents bigint,         -- noch offen (z.B. 3500€)
  -- Auto-detection from banking
  auto_detected boolean not null default false,
  auto_detection_confidence numeric(3,2),
  -- Toggle
  active boolean not null default true,
  paused_until date,
  -- Notes
  notes text,
  -- timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_expenses_user_idx
  on public.recurring_expenses (user_id, active, next_due_date);
create index recurring_expenses_scope_idx
  on public.recurring_expenses (user_id, scope);

alter table public.recurring_expenses enable row level security;
create policy recurring_expenses_owner on public.recurring_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_recurring_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

comment on table public.recurring_expenses is
  'Wiederkehrende Verpflichtungen — Abos, Mieten, Kredite, Versicherungen. Cron erzeugt monatlich expense_entries.';

-- ─── recurring_postings ─────────────────────────────────────────────────
-- Audit-Trail: welche expense_entries kamen aus welchem recurring.
create table if not exists public.recurring_postings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_id uuid not null references public.recurring_expenses(id) on delete cascade,
  expense_entry_id uuid references public.expense_entries(id) on delete set null,
  posted_for_date date not null,        -- der "next_due_date" zum Zeitpunkt
  amount_cents bigint not null,
  created_at timestamptz not null default now(),
  unique (recurring_id, posted_for_date)
);

create index recurring_postings_user_idx
  on public.recurring_postings (user_id, posted_for_date desc);

alter table public.recurring_postings enable row level security;
create policy recurring_postings_owner on public.recurring_postings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── category_rules (AI Learning aus User-Korrekturen) ──────────────────
-- Wenn User 3+ mal "REWE" als private/Lebensmittel markiert → Regel speichern,
-- nächstes "REWE" ohne AI-Call direkt klassifizieren.
create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern text not null,                  -- z.B. "rewe" (lowercased substring match)
  match_field text not null check (match_field in ('counterparty_name', 'remittance_info', 'vendor')),
  scope public.doc_scope not null,
  category_id uuid references public.categories(id) on delete set null,
  category_label text,
  vat_rate numeric(4,2) not null default 19,
  is_deductible boolean not null default false,
  jobcenter_relevant boolean not null default false,
  hits integer not null default 1,        -- wie oft angewendet
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pattern, match_field)
);

create index category_rules_user_idx
  on public.category_rules (user_id);

alter table public.category_rules enable row level security;
create policy category_rules_owner on public.category_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_category_rules_updated_at
  before update on public.category_rules
  for each row execute function public.set_updated_at();

-- ─── expense_entries: Kfz-Pauschale Mileage Tracking ────────────────────
-- mileage_km existiert schon (siehe initial_schema). Wir fügen nur einen
-- Auto-flag hinzu, ob der amount_cents aus mileage berechnet wurde.
alter table public.expense_entries
  add column if not exists is_kfz_pauschale boolean not null default false,
  add column if not exists recurring_source_id uuid references public.recurring_expenses(id) on delete set null;

comment on column public.expense_entries.is_kfz_pauschale is
  'true wenn amount_cents aus mileage_km × 0.30 €/km berechnet wurde (Steuerpauschale §9 EStG).';

-- ─── bank_transactions: Link to recurring suggestion ────────────────────
alter table public.bank_transactions
  add column if not exists recurring_suggestion_id uuid references public.recurring_expenses(id) on delete set null;
