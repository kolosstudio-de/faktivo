-- Banking (PSD2 / GoCardless Bank Account Data) + Mehrbedarfe-Settings
-- Stand 2026-04-27

-- ─── 1. Banking-Verbindungen (Nordigen/GoCardless requisitions) ────────────
create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  /** GoCardless requisition.id (uuid string from API) */
  requisition_id text not null,
  institution_id text not null,           -- z.B. "SPARKASSE_HAMBURG_HASPDEHHXXX"
  institution_name text,
  institution_logo_url text,
  status text not null default 'created'  -- created | pending | linked | expired | revoked | error
    check (status in ('created','pending','linked','expired','revoked','error')),
  /** End-User Agreement: 90 Tage default bei GoCardless free tier */
  agreement_id text,
  agreement_max_days smallint default 90,
  /** Reference, das wir an GoCardless senden (= unser internal id) */
  reference text not null,
  /** Wann läuft die Verbindung ab (90 Tage). */
  expires_at timestamptz,
  /** Vom User akzeptiert? Wann? */
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bank_connections_requisition_idx
  on public.bank_connections (requisition_id);

create index if not exists bank_connections_user_idx
  on public.bank_connections (user_id, status);

alter table public.bank_connections enable row level security;
create policy bank_connections_own on public.bank_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_bank_connections_updated_at before update on public.bank_connections
  for each row execute function public.set_updated_at();

-- ─── 2. Bank-Konten (1 Connection → N Konten) ─────────────────────────────
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.bank_connections(id) on delete cascade,
  /** GoCardless account.id (uuid string) */
  account_id text not null,
  iban text,
  bic text,
  currency text not null default 'EUR',
  /** Account-Owner-Name (optional, von Bank gemeldet) */
  owner_name text,
  /** Display-Name vom User (z.B. "Geschäftskonto Volksbank") */
  display_name text,
  /** Letzter bekannter Saldo. */
  balance_cents integer,
  balance_at timestamptz,
  /** Letzter erfolgreicher Sync. */
  last_synced_at timestamptz,
  /** Soll dieses Konto mit Geschäftsausgaben/Einnahmen abgeglichen werden? */
  scope text not null default 'business' check (scope in ('business','personal')),
  /** Konto auto-sync deaktivieren */
  sync_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bank_accounts_account_idx
  on public.bank_accounts (account_id);
create index if not exists bank_accounts_user_idx
  on public.bank_accounts (user_id);

alter table public.bank_accounts enable row level security;
create policy bank_accounts_own on public.bank_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger trg_bank_accounts_updated_at before update on public.bank_accounts
  for each row execute function public.set_updated_at();

-- ─── 3. Bank-Transaktionen ───────────────────────────────────────────────
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  /** GoCardless transactionId or internalTransactionId — eindeutig pro Konto */
  external_id text not null,
  /** booked = bestätigt / pending = vorgemerkt */
  status text not null default 'booked' check (status in ('booked','pending')),
  /** Buchungsdatum (geld vom/aufs Konto bewegt) */
  booking_date date not null,
  /** Wertstellungsdatum (für Berechnungen relevant) */
  value_date date,
  /** Betrag in Cent, negativ = Belastung, positiv = Gutschrift */
  amount_cents integer not null,
  currency text not null default 'EUR',
  /** Originale Referenzen (z.B. SEPA "Verwendungszweck") */
  remittance_info text,
  /** Gegenpartei: bei Gutschrift = Debtor, bei Belastung = Creditor */
  counterparty_name text,
  counterparty_iban text,
  counterparty_bic text,
  /** Bank-Code aus camt.053: "PMT", "RCT", "CHK", etc. */
  transaction_code text,
  /** Auto-Kategorisierung */
  category_hint text,
  is_business boolean not null default true,
  /** Verknüpfung mit erstelltem expense_entry oder income_entry oder payment */
  expense_entry_id uuid references public.expense_entries(id) on delete set null,
  income_entry_id uuid references public.income_entries(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  /** Vom User als ignoriert markiert */
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists bank_transactions_external_idx
  on public.bank_transactions (account_id, external_id);
create index if not exists bank_transactions_user_idx
  on public.bank_transactions (user_id, booking_date desc);
create index if not exists bank_transactions_unmatched_idx
  on public.bank_transactions (user_id)
  where expense_entry_id is null
    and income_entry_id is null
    and payment_id is null
    and dismissed_at is null;

alter table public.bank_transactions enable row level security;
create policy bank_transactions_own on public.bank_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── 4. Mehrbedarfe in settings als JSONB ─────────────────────────────────
alter table public.settings
  add column if not exists mehrbedarfe_jsonb jsonb not null default '{}'::jsonb;

comment on column public.settings.mehrbedarfe_jsonb is
  'Mehrbedarfe nach §21 SGB II: { schwanger: bool, behinderung: bool, dezentrale_warmwasser: bool, ernaehrung_cents: int, alleinerziehend_kinder: { anzahl: int, juengstes_kind_alter: int } | null }';
