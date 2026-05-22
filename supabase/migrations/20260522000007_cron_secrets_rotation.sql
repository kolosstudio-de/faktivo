-- Rotation-fähige Cron-Secrets.
--
-- Vorher: ein einziges CRON_SECRET-Env-Var. Rotieren = alle Caller (Vercel
-- Cron-Job, GitHub Actions, manuelle curl-Scripts) parallel updaten — kaum
-- machbar ohne Ausfall.
--
-- Jetzt: Mehrere aktive Secrets in der DB, jedes mit eigenem Label + Ablaufdatum.
-- Cron-Routes prüfen erst gegen DB, dann (als Fallback) gegen CRON_SECRET-Env.
-- Rotation = neues Row insertieren, alten Row mit revoked_at markieren, alle
-- Caller auf neues Secret umziehen lassen, dann alten löschen.

create table if not exists public.cron_secrets (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  secret_hash text not null,           -- sha256(secret), nie plaintext
  created_at timestamptz not null default now(),
  expires_at timestamptz,              -- null = unbegrenzt
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count bigint not null default 0
);

-- Nur service-role darf rotieren / sehen. Authenticated User nichts.
alter table public.cron_secrets enable row level security;
-- (keine Policy → niemand außer service-role sieht etwas)

-- pgcrypto ist bereits in initial_schema.sql ins public-Schema erstellt;
-- digest() ist daher als public.digest erreichbar.
create or replace function public.verify_cron_secret(p_secret text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_hash text;
  v_row_id uuid;
begin
  if p_secret is null or p_secret = '' then return false; end if;
  v_hash := encode(digest(p_secret, 'sha256'), 'hex');

  select id into v_row_id
    from public.cron_secrets
    where secret_hash = v_hash
      and revoked_at is null
      and (expires_at is null or expires_at > now())
    limit 1;

  if v_row_id is null then return false; end if;

  update public.cron_secrets
    set last_used_at = now(),
        use_count = use_count + 1
    where id = v_row_id;

  return true;
end;
$$;

grant execute on function public.verify_cron_secret(text) to service_role;
