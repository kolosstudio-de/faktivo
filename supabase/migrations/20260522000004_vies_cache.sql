-- VIES-Cache für EU-USt-IdNr.-Validierung.
--
-- Warum: bei jedem B2B-Rechnungsentwurf mit Reverse-Charge (§ 13b UStG)
-- müssen wir die USt-IdNr. des EU-Kunden gegen das VIES-Register prüfen.
-- VIES-Endpoint ist langsam und rate-limited; wir cachen Antworten 24 h
-- (lt. EU-Empfehlung) und teilen den Cache global zwischen allen Usern.

create table if not exists public.vies_cache (
  vat_id text primary key,
  is_valid boolean not null,
  name text,
  address text,
  request_date timestamptz,
  fetched_at timestamptz not null default now(),
  -- TTL: nach 24h gilt der Eintrag als veraltet. Wir lassen ihn drin für
  -- Audit/Stats, aber Code refresht ihn.
  fresh_until timestamptz not null default (now() + interval '24 hours')
);

create index if not exists vies_cache_fresh_until_idx
  on public.vies_cache (fresh_until);

-- Service-Role schreibt; alle authenticated lesen.
alter table public.vies_cache enable row level security;
create policy vies_cache_read on public.vies_cache
  for select to authenticated
  using (true);
-- INSERT/UPDATE nur via service_role (API-Route bypasst RLS bewusst).
