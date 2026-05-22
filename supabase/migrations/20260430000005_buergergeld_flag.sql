-- ─── Bürgergeld flag on bank_transactions ───────────────────────────────
-- Enables Faktivo to separate Bürgergeld credits from regular personal
-- income (relevant for EKS calculations: Bürgergeld is NOT an "Einkommen"
-- in the EKS sense — it's the benefit being topped up).

alter table public.bank_transactions
  add column if not exists is_buergergeld boolean not null default false;

create index if not exists idx_bank_transactions_buergergeld
  on public.bank_transactions(user_id, is_buergergeld) where is_buergergeld;
