-- payment_method on bank_transactions (auto-detect aus CSV-Type)
-- Erweitert is_kfz_pauschale-Flag (kommt schon aus 006).
-- Stand 2026-04-27

alter table public.bank_transactions
  add column if not exists payment_method text;

create index if not exists bank_transactions_payment_method_idx
  on public.bank_transactions (user_id, payment_method)
  where payment_method is not null;

comment on column public.bank_transactions.payment_method is
  'Auto-detected aus Bank-CSV-Type (z.B. "Card Payment" → ec_karte). Wird beim auto-import in expense_entry übernommen.';
