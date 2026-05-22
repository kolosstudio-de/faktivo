-- ============================================================================
-- CATEGORIZATION RULES
-- Per-user rules learned from past confirmed transactions.
-- Used to auto-categorize new bank transactions before AI fallback.
-- ============================================================================

create table if not exists public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Pattern matching the counterparty / merchant name (case-insensitive substring)
  match_pattern text not null,
  -- Matched fields: counterparty | reference | both
  match_field text not null default 'counterparty',
  -- The category + scope this rule maps to
  category_id uuid not null references public.categories(id) on delete cascade,
  scope public.doc_scope not null,
  -- How this rule was created
  source text not null default 'auto', -- auto | manual | suggested
  -- Confidence score 0–100; rules with higher confidence win
  confidence int not null default 80,
  -- How many times this rule was applied (incremented on each match)
  hit_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categorization_rules_user_pattern
  on public.categorization_rules(user_id, lower(match_pattern));
create index if not exists idx_categorization_rules_user_category
  on public.categorization_rules(user_id, category_id);
create index if not exists idx_categorization_rules_user_recent
  on public.categorization_rules(user_id, last_used_at desc nulls last);

alter table public.categorization_rules enable row level security;

drop policy if exists "rules_own_select" on public.categorization_rules;
create policy "rules_own_select" on public.categorization_rules
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "rules_own_modify" on public.categorization_rules;
create policy "rules_own_modify" on public.categorization_rules
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop trigger if exists trg_categorization_rules_updated_at on public.categorization_rules;
create trigger trg_categorization_rules_updated_at
  before update on public.categorization_rules
  for each row execute function public.set_updated_at();

-- Unique-ish pattern per user+field+pattern so upserts work cleanly.
create unique index if not exists uq_categorization_rules_user_field_pattern
  on public.categorization_rules(user_id, match_field, lower(match_pattern));

-- ============================================================================
-- BANK_TRANSACTIONS — store AI/rule suggestions for the preview UI
-- ============================================================================

alter table public.bank_transactions
  add column if not exists suggested_category_id uuid references public.categories(id) on delete set null;

alter table public.bank_transactions
  add column if not exists suggested_scope public.doc_scope;

alter table public.bank_transactions
  add column if not exists suggestion_source text; -- 'rule' | 'ai' | 'none'
