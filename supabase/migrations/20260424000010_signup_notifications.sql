-- Signup notifications for the founder (admin).
-- Every new auth.users → row in admin_notifications.
-- Admin page reads from here.

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- 'signup', 'upgrade', 'churn', 'error'
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  payload jsonb not null default '{}'::jsonb,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_notifications_created
  on public.admin_notifications(created_at desc);
create index if not exists idx_admin_notifications_unseen
  on public.admin_notifications(seen_at) where seen_at is null;

-- Only admin emails may read. Hardcode for now; later move to an admins table.
alter table public.admin_notifications enable row level security;

drop policy if exists "admin_notifications_admin_read" on public.admin_notifications;
create policy "admin_notifications_admin_read" on public.admin_notifications
  for select to authenticated
  using (
    exists (
      select 1 from auth.users u
      where u.id = (select auth.uid())
        and u.email in ('kolosvasiliysergeevich@gmail.com')
    )
  );

-- Trigger: on auth.users insert, push signup notification
create or replace function public.notify_signup()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
begin
  insert into public.admin_notifications (kind, user_id, user_email, payload)
  values (
    'signup',
    new.id,
    new.email,
    jsonb_build_object(
      'created_at', new.created_at,
      'raw_user_meta_data', new.raw_user_meta_data,
      'app_metadata', new.raw_app_meta_data
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_signup_notify on auth.users;
create trigger on_auth_user_signup_notify
  after insert on auth.users
  for each row execute function public.notify_signup();

-- Helper: mark as seen
create or replace function public.mark_notifications_seen()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.admin_notifications
    set seen_at = now()
    where seen_at is null;
end;
$$;
grant execute on function public.mark_notifications_seen() to authenticated;
