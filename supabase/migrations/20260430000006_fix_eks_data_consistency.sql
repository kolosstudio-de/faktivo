-- Data-integrity backfill for the EKS report path.
--
-- Audit checks (cf. PASS-1 audit, May 2026) showed that all entries today are
-- consistent, but the schema does not yet PREVENT future drift. This
-- migration:
--
--   1. Backfills the few cases where an entry's scope diverged from its
--      category's scope (most common cause: user moved a transaction between
--      scopes via the popover, but only updated `category_id`, not `scope`).
--
--   2. Normalises Bürgergeld income — when a bank_transactions row is flagged
--      `is_buergergeld=true`, the linked income_entries row must be
--      scope='personal' and jobcenter_relevant=false (Bürgergeld is NOT
--      self-employment income).
--
--   3. Caps NULL `category_id` rows by assigning a fallback "Sonstiges" /
--      "Sonstige Betriebsausgaben" category per (user, scope, kind).
--
--   4. Adds a trigger that prevents future entry/category scope drift on
--      INSERT / UPDATE: setting the entry.scope to category.scope automatically.

begin;

-- ─── 1) Align entry.scope to category.scope (idempotent) ─────────────────
update public.expense_entries e
   set scope = c.scope
  from public.categories c
 where e.category_id = c.id
   and e.scope <> c.scope;

update public.income_entries i
   set scope = c.scope
  from public.categories c
 where i.category_id = c.id
   and i.scope <> c.scope;

-- ─── 2) Bürgergeld normalisation (idempotent) ────────────────────────────
update public.income_entries i
   set scope = 'personal',
       jobcenter_relevant = false
  from public.bank_transactions bt
 where bt.income_entry_id = i.id
   and bt.is_buergergeld = true
   and (i.scope <> 'personal' or i.jobcenter_relevant = true);

-- ─── 3) NULL category_id → fallback "Sonstiges" / "Sonstige Betriebs…" ────
update public.expense_entries e
   set category_id = (
         select c.id from public.categories c
          where c.user_id = e.user_id
            and c.scope = e.scope
            and c.kind = 'expense'
            and c.name in ('Sonstige Betriebsausgaben', 'Sonstiges')
          order by case when c.name = 'Sonstige Betriebsausgaben' then 0 else 1 end
          limit 1
       )
 where e.category_id is null;

update public.income_entries i
   set category_id = (
         select c.id from public.categories c
          where c.user_id = i.user_id
            and c.scope = i.scope
            and c.kind = 'income'
            and c.name in ('Sonstige betriebliche Erträge', 'Geschenke / Sonstiges', 'Sonstiges')
          order by case when c.name = 'Sonstige betriebliche Erträge' then 0
                        when c.name = 'Geschenke / Sonstiges' then 1
                        else 2 end
          limit 1
       )
 where i.category_id is null;

-- ─── 4) Triggers to keep scope in lock-step with category.scope ──────────
create or replace function public.sync_entry_scope_with_category()
returns trigger
language plpgsql
as $$
declare
  cat_scope public.doc_scope;
begin
  if new.category_id is null then
    return new;
  end if;
  select c.scope into cat_scope from public.categories c
   where c.id = new.category_id and c.user_id = new.user_id;
  if cat_scope is not null and cat_scope <> new.scope then
    new.scope := cat_scope;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_expense_scope on public.expense_entries;
create trigger trg_sync_expense_scope
  before insert or update of category_id, scope on public.expense_entries
  for each row execute function public.sync_entry_scope_with_category();

drop trigger if exists trg_sync_income_scope on public.income_entries;
create trigger trg_sync_income_scope
  before insert or update of category_id, scope on public.income_entries
  for each row execute function public.sync_entry_scope_with_category();

commit;
