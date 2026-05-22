-- TrueLayer Webhook: replay-protection via event_id
-- Vorher: jeder POST landete unconditional in banking_webhook_events; ein
-- Angreifer (oder ein flackerndes TrueLayer-Retry) konnte denselben Payload
-- mehrfach durchprocessen → doppelte Transaktionen.
--
-- Lösung: event_id aus dem Payload extrahieren (oder Tl-Webhook-Id Header),
-- via unique-Constraint pro Provider deduplizieren. Bestehende Zeilen ohne
-- event_id bleiben unverändert (NULL ist im Unique-Constraint nicht doppelt).

alter table public.banking_webhook_events
  add column if not exists event_id text;

create unique index if not exists banking_webhook_events_provider_event_id_uidx
  on public.banking_webhook_events (provider, event_id)
  where event_id is not null;

-- Replay-Protection-Sicht: Events der letzten 24h, die schon processed wurden.
-- Vom Webhook-Handler benutzt um vor dem Insert zu prüfen.
create or replace function public.banking_webhook_event_seen(
  p_provider text,
  p_event_id text
) returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.banking_webhook_events
    where provider = p_provider
      and event_id = p_event_id
      and created_at > now() - interval '24 hours'
  );
$$;

grant execute on function public.banking_webhook_event_seen(text, text) to authenticated, service_role;
