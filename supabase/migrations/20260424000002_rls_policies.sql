-- Row Level Security
-- Every table enforces: user_id = auth.uid()
-- Exception: audit_log is read-only via authenticated role (append from server only).

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

alter table public.settings          enable row level security;
alter table public.number_sequences  enable row level security;
alter table public.clients           enable row level security;
alter table public.quotes            enable row level security;
alter table public.invoices          enable row level security;
alter table public.line_items        enable row level security;
alter table public.payments          enable row level security;
alter table public.categories        enable row level security;
alter table public.income_entries    enable row level security;
alter table public.expense_entries   enable row level security;
alter table public.jobcenter_reports enable row level security;
alter table public.document_archive  enable row level security;
alter table public.audit_log         enable row level security;
alter table public.attachments       enable row level security;

-- ============================================================================
-- POLICIES — simple "own rows only" pattern
-- ============================================================================

-- settings
create policy "settings_own" on public.settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- number_sequences (read only via RPC usually, but allow direct CRUD for settings UI)
create policy "number_sequences_own" on public.number_sequences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- clients
create policy "clients_own" on public.clients
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- quotes
create policy "quotes_own" on public.quotes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- invoices
create policy "invoices_own" on public.invoices
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- line_items
create policy "line_items_own" on public.line_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- payments
create policy "payments_own" on public.payments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- categories
create policy "categories_own" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- income_entries
create policy "income_entries_own" on public.income_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- expense_entries
create policy "expense_entries_own" on public.expense_entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- jobcenter_reports
create policy "jobcenter_reports_own" on public.jobcenter_reports
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- document_archive — read-only for user (inserts happen via security-definer function)
create policy "document_archive_read_own" on public.document_archive
  for select to authenticated
  using (user_id = (select auth.uid()));

-- audit_log — read only for user
create policy "audit_log_read_own" on public.audit_log
  for select to authenticated
  using (user_id = (select auth.uid()));

-- attachments
create policy "attachments_own" on public.attachments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============================================================================
-- AUTO-CREATE SETTINGS ON SIGNUP
-- When a new auth.user row appears, seed the settings row.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_year int := extract(year from current_date);
begin
  insert into public.settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

  insert into public.number_sequences (user_id, kind, year, prefix, next_value, width)
    values
      (new.id, 'invoice', v_year, 'KD', 1, 4),
      (new.id, 'quote', v_year, 'AN', 1, 4),
      (new.id, 'credit_note', v_year, 'GS', 1, 4)
    on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
