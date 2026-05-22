-- Waitlist for landing-page pre-registrations (before public launch)

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  locale text,                     -- 'de' | 'en' | 'ru' | 'ua'
  segment text,                    -- 'freelancer' | 'agency' | 'aufstocker' | 'other'
  referrer text,
  utm jsonb default '{}'::jsonb,
  invited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_waitlist_created on public.waitlist(created_at desc);

alter table public.waitlist enable row level security;

-- Public can INSERT (no select/update/delete) — for landing-page form
drop policy if exists "waitlist_public_insert" on public.waitlist;
create policy "waitlist_public_insert" on public.waitlist
  for insert to anon, authenticated
  with check (true);

-- Admin can read
drop policy if exists "waitlist_admin_read" on public.waitlist;
create policy "waitlist_admin_read" on public.waitlist
  for select to authenticated
  using (
    exists (
      select 1 from auth.users u
      where u.id = (select auth.uid())
        and u.email in ('kolosvasiliysergeevich@gmail.com')
    )
  );

-- Notify admin on new waitlist signup
create or replace function public.notify_waitlist()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.admin_notifications (kind, user_email, payload)
  values (
    'waitlist',
    new.email,
    jsonb_build_object(
      'locale', new.locale,
      'segment', new.segment,
      'referrer', new.referrer,
      'utm', new.utm
    )
  );
  return new;
end;
$$;

drop trigger if exists on_waitlist_insert_notify on public.waitlist;
create trigger on_waitlist_insert_notify
  after insert on public.waitlist
  for each row execute function public.notify_waitlist();
