-- AI-Klassifizierung von Banking-Transaktionen via Claude Vision/Sonnet.
-- Stand 2026-04-27

alter table public.bank_transactions
  add column if not exists ai_scope text check (ai_scope in ('business', 'private')),
  add column if not exists ai_category text,
  add column if not exists ai_skr03 text,
  add column if not exists ai_vat_rate numeric(5,2),
  add column if not exists ai_confidence numeric(3,2) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  add column if not exists ai_reasoning text,
  add column if not exists ai_classified_at timestamptz,
  add column if not exists ai_auto_imported_at timestamptz;

create index if not exists bank_transactions_ai_idx
  on public.bank_transactions (user_id, ai_classified_at)
  where ai_classified_at is not null;

comment on column public.bank_transactions.ai_scope is
  'AI-Klassifizierung: "business" oder "private". Hohe Confidence ≥ 0.8 → auto-import als expense_entry.';
comment on column public.bank_transactions.ai_confidence is
  '0..1 — Vertrauen der AI in Scope+Category. Bei ≥ 0.8 wird automatisch ein expense_entry angelegt (siehe ai_auto_imported_at).';
