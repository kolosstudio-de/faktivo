-- License System für Desktop-App (Local-First Architektur)
-- Cloud-only: hier liegt NIEMALS Business-Daten der Kunden,
-- nur Email-Login + Lizenz-Schlüssel + Aktivierungs-Heartbeat.
-- Stand 2026-04-27

-- ─── license_keys ────────────────────────────────────────────────────────
-- 1 license = 1 Kunde. Kann auf mehreren Geräten aktiviert sein
-- (Limit über plan).
create table if not exists public.license_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Public Key der angezeigt + eingegeben wird im Desktop-App.
  -- Format: FAK-XXXX-XXXX-XXXX-XXXX (Crockford Base32)
  key text not null unique,
  status text not null default 'active' check (
    status in ('trial', 'active', 'expired', 'revoked', 'pending')
  ),
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  -- Maximale Anzahl gleichzeitig aktiver Geräte (free=1, pro=2, business=5)
  max_devices integer not null default 1,
  -- Wenn null → unbegrenzt gültig (lifetime / Stripe-aboniert).
  -- Wenn datum → läuft ab. Bei trial: heute + 30 Tage.
  expires_at timestamptz,
  -- Stripe subscription id (wenn bezahlt)
  stripe_subscription_id text,
  -- Beim Sperren: Grund (refund, abuse, request)
  revoked_at timestamptz,
  revoke_reason text,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id) -- 1 active license per user
);

create index license_keys_user_idx on public.license_keys (user_id);
create index license_keys_key_idx on public.license_keys (key);
create index license_keys_expires_idx on public.license_keys (expires_at)
  where expires_at is not null;

alter table public.license_keys enable row level security;
create policy license_keys_owner_read on public.license_keys
  for select using (auth.uid() = user_id);
-- Inserts/updates nur via Service-Role (in Stripe-Hook + activate-route)

create trigger trg_license_keys_updated_at
  before update on public.license_keys
  for each row execute function public.set_updated_at();

comment on table public.license_keys is
  'Cloud-only license-system für Desktop-App. NIEMALS Business-Daten hier — nur Aktivierungs-Status.';

-- ─── machine_activations ───────────────────────────────────────────────
-- Eine Zeile pro Gerät auf dem die Lizenz aktiviert wurde.
-- machine_fingerprint = SHA256 aus (board_serial + cpu_brand) — nicht
-- reversible auf personenbezogene Daten.
create table if not exists public.machine_activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.license_keys(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  machine_fingerprint text not null, -- SHA256 hex
  machine_label text, -- "Vasyl's MacBook M3 Pro" — User kann ändern
  os_platform text, -- "darwin"
  app_version text,
  first_activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (license_id, machine_fingerprint)
);

create index machine_activations_license_idx
  on public.machine_activations (license_id, deactivated_at);
create index machine_activations_user_idx
  on public.machine_activations (user_id);

alter table public.machine_activations enable row level security;
create policy machine_activations_owner_read on public.machine_activations
  for select using (auth.uid() = user_id);

comment on column public.machine_activations.machine_fingerprint is
  'SHA256 aus board-serial + cpu-brand. Nicht reversibel auf persönliche Daten.';

-- ─── Helper Function: generate license key ────────────────────────────
-- Erzeugt FAK-XXXX-XXXX-XXXX-XXXX im Crockford Base32.
create or replace function public.generate_license_key()
returns text
language plpgsql
as $$
declare
  alphabet text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; -- Crockford (ohne I/L/O/U)
  i int;
  r int;
  groups text[] := array[]::text[];
  group_str text;
begin
  for g in 1..4 loop
    group_str := '';
    for i in 1..4 loop
      r := floor(random() * 32)::int + 1;
      group_str := group_str || substring(alphabet from r for 1);
    end loop;
    groups := groups || group_str;
  end loop;
  return 'FAK-' || array_to_string(groups, '-');
end;
$$;

-- ─── Trigger: Auto-create license_key beim user signup ────────────────
-- Beim Anlegen einen Trial-Key vergeben (30 Tage).
create or replace function public.create_trial_license_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_key text;
begin
  -- Try up to 5 times to find a unique key
  for i in 1..5 loop
    v_key := public.generate_license_key();
    begin
      insert into public.license_keys (
        user_id, key, status, plan, max_devices,
        expires_at
      ) values (
        new.id, v_key, 'trial', 'free', 1,
        now() + interval '30 days'
      );
      exit; -- success
    exception when unique_violation then
      -- key collision, try again
      continue;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_create_trial_license on auth.users;
create trigger trg_create_trial_license
  after insert on auth.users
  for each row execute function public.create_trial_license_for_new_user();

-- ─── Backfill: existing users ohne license bekommen einen ──────────────
do $$
declare
  u record;
  v_key text;
begin
  for u in
    select au.id from auth.users au
    where not exists (
      select 1 from public.license_keys lk where lk.user_id = au.id
    )
  loop
    v_key := public.generate_license_key();
    insert into public.license_keys (
      user_id, key, status, plan, max_devices, expires_at
    ) values (
      u.id, v_key, 'trial', 'free', 1, now() + interval '30 days'
    ) on conflict do nothing;
  end loop;
end $$;
