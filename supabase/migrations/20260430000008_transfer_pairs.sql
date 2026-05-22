-- Self-transfer detection: when a user moves money between their own
-- accounts, the AI classifier currently marks both legs as separate
-- income/expense. This inflates EKS and EÜR by the full transfer amount.
--
-- Solution: a boolean flag + a symmetric pair pointer on bank_transactions.
-- Both legs reference each other; analytics queries should treat
-- `is_transfer = true` as an exclusion filter (the money never left or
-- entered the household — it just shifted accounts).
--
-- Detection logic lives in src/lib/banking/transfer-detector.ts and runs:
--   1. inline after every PDF commit (commit/route.ts)
--   2. as a backfill via POST /api/banking/detect-transfers
--
-- Stand 2026-05-21
--

alter table public.bank_transactions
  add column if not exists is_transfer boolean not null default false,
  add column if not exists transfer_pair_id uuid references public.bank_transactions(id) on delete set null;

create index if not exists idx_bank_transactions_transfer_pair
  on public.bank_transactions(user_id, is_transfer) where is_transfer;

comment on column public.bank_transactions.is_transfer is
  'Self-transfer between own accounts. Excluded from EKS / EÜR / analytics aggregates.';
comment on column public.bank_transactions.transfer_pair_id is
  'Other leg of the same transfer. Both legs reference each other (FK is symmetric).';
