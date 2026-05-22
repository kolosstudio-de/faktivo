-- TrueLayer migration: PSD2 tokens + provider tracking
-- Stand 2026-04-27

alter table public.bank_connections
  add column if not exists provider text not null default 'gocardless'
    check (provider in ('gocardless','truelayer','demo')),
  -- TrueLayer access tokens (encrypted at-rest via SUPABASE Vault or app-level enc).
  -- For local dev wir speichern plain — in prod via service-role-key encryption layer.
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz,
  -- TrueLayer connection.id (different from requisition_id used by GoCardless)
  add column if not exists tl_connection_id text;

create index if not exists bank_connections_provider_idx
  on public.bank_connections (provider, status);

comment on column public.bank_connections.provider is
  'Welcher PSD2-Aggregator wird benutzt: gocardless | truelayer | demo';
comment on column public.bank_connections.refresh_token is
  'OAuth refresh_token für TrueLayer — alle 90 Tage erneuert via SCA-Re-Confirmation.';

-- Webhooks-Tabelle für Real-Time TrueLayer-Events
create table if not exists public.banking_webhook_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null check (provider in ('truelayer','tink','gocardless')),
  event_type text not null,
  payload_jsonb jsonb not null,
  signature text,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists banking_webhook_events_user_idx
  on public.banking_webhook_events (user_id, created_at desc);
create index if not exists banking_webhook_events_unprocessed_idx
  on public.banking_webhook_events (created_at)
  where processed_at is null;

alter table public.banking_webhook_events enable row level security;
create policy banking_webhook_events_read_own on public.banking_webhook_events
  for select using (auth.uid() = user_id);
