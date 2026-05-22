-- Jobcenter-Rückforderungsrechner: zusätzliche Felder in settings + reminders-Tabelle
-- Stand 2026-04-27

-- ─── 1. Settings erweitern ─────────────────────────────────────────────────
alter table public.settings
  add column if not exists has_minor_children boolean not null default false,
  add column if not exists regelbedarf_stufe smallint check (regelbedarf_stufe between 1 and 6),
  -- Bedarf der BG in Cent: Regelbedarf + KdU + ggf. Mehrbedarfe.
  -- Die App rechnet damit, NICHT mit reinem Regelbedarf (nutzer kennt seine KdU).
  add column if not exists buergergeld_bedarf_monatlich_cents integer
    check (buergergeld_bedarf_monatlich_cents is null or buergergeld_bedarf_monatlich_cents >= 0),
  -- Prognose-Einkommen: { "2026-01-01": 25000, "2026-02-01": 60000, ... } (Cent)
  add column if not exists vorlaeufige_prognose_jsonb jsonb not null default '{}'::jsonb,
  -- Wann hat der Nutzer den letzten Monat (vorläufig) gemeldet → für Erinnerungen.
  add column if not exists last_eks_submitted_for_month date,
  -- Steuererklärungs-Status — für jährliche Reminder
  add column if not exists last_steuererklaerung_for_year smallint;

comment on column public.settings.buergergeld_bedarf_monatlich_cents is
  'Monatlicher Gesamtbedarf der BG (Regelbedarf + KdU + Mehrbedarfe) in Cent. Basis für die Auszahlungs-Berechnung.';
comment on column public.settings.vorlaeufige_prognose_jsonb is
  'Vorläufige EKS-Prognose: { "YYYY-MM-01": cents }. Wird mit Ist-Werten zur Rückforderung verglichen.';

-- ─── 2. Reminders-Tabelle ──────────────────────────────────────────────────
-- Geplante / versendete Erinnerungen. Cron-Job liest "due" und schickt via Resend.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'eks_monthly',           -- monatliche Anlage EKS einreichen
    'eks_endgueltig',        -- Endgültige EKS am Ende des BWZ
    'steuererklaerung',      -- Einkommensteuererklärung bis 31.07.
    'ust_voranmeldung',      -- USt-Voranmeldung 10. des Folgemonats
    'eu_zm'                  -- Zusammenfassende Meldung B2B-EU
  )),
  due_date date not null,
  payload_jsonb jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reminders_user_due_idx
  on public.reminders (user_id, due_date)
  where sent_at is null and dismissed_at is null;

create index if not exists reminders_due_idx
  on public.reminders (due_date)
  where sent_at is null and dismissed_at is null;

alter table public.reminders enable row level security;

create policy reminders_select_own on public.reminders
  for select using (auth.uid() = user_id);
create policy reminders_insert_own on public.reminders
  for insert with check (auth.uid() = user_id);
create policy reminders_update_own on public.reminders
  for update using (auth.uid() = user_id);
create policy reminders_delete_own on public.reminders
  for delete using (auth.uid() = user_id);

-- ─── 3. Belege-Tabelle für OCR ────────────────────────────────────────────
-- Quellbeleg (Foto) → OCR → Vorschlag für expense_entry.
create table if not exists public.belege (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  file_size_bytes integer,
  -- OCR-Ergebnis (von Claude Vision)
  ocr_amount_cents integer,
  ocr_vat_rate smallint,
  ocr_vendor text,
  ocr_date date,
  ocr_category_hint text,
  ocr_description text,
  ocr_raw_jsonb jsonb,
  ocr_confidence real,
  ocr_processed_at timestamptz,
  -- Verknüpfung mit erstelltem expense_entry (falls Nutzer importiert)
  expense_entry_id uuid references public.expense_entries(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists belege_user_created_idx
  on public.belege (user_id, created_at desc);

alter table public.belege enable row level security;

create policy belege_select_own on public.belege
  for select using (auth.uid() = user_id);
create policy belege_insert_own on public.belege
  for insert with check (auth.uid() = user_id);
create policy belege_update_own on public.belege
  for update using (auth.uid() = user_id);
create policy belege_delete_own on public.belege
  for delete using (auth.uid() = user_id);
