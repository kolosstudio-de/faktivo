-- ─── Bank Account Metadata: cards / display / color / notes ─────────────
-- Adds compact display fields used by the new "Konten & Karten" page.

alter table public.bank_accounts
  add column if not exists last_4 text,
  add column if not exists card_color text default '#10b981',
  add column if not exists notes text;

-- Backfill last_4 from existing IBANs.
update public.bank_accounts
  set last_4 = right(replace(iban, ' ', ''), 4)
  where last_4 is null and iban is not null;
