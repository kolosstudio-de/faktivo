-- Expand default categories with more granular business + personal cats.
-- 1) Replaces seed_default_categories() so new signups get the full list.
-- 2) Backfills the new categories for ALL existing users (idempotent — uses
--    `where not exists` per (user_id, scope, kind, name)).
--
-- Re-runnable safely.

create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- ─── Business income ──────────────────────────────────────────────────
  insert into public.categories (user_id, scope, kind, name, skr_code, sort_order, color, is_jobcenter_relevant) values
    (p_user_id, 'business', 'income', 'Erlöse Dienstleistungen',     '8400', 10, '#10b981', true),
    (p_user_id, 'business', 'income', 'Erlöse Produktverkauf',       '8410', 20, '#059669', true),
    (p_user_id, 'business', 'income', 'Sonstige betriebliche Erträge','8500', 30, '#14b8a6', true),
    (p_user_id, 'business', 'income', 'Zinserträge',                 '2650', 40, '#06b6d4', false);

  -- ─── Business expenses ────────────────────────────────────────────────
  insert into public.categories (user_id, scope, kind, name, skr_code, sort_order, color, is_jobcenter_relevant) values
    (p_user_id, 'business', 'expense', 'Wareneinkauf',                '3400', 10, '#ef4444', true),
    (p_user_id, 'business', 'expense', 'Fremdleistungen / Subunternehmer','3100', 20, '#dc2626', true),
    (p_user_id, 'business', 'expense', 'Personalkosten (Löhne)',      '4100', 30, '#b91c1c', true),
    (p_user_id, 'business', 'expense', 'Raumkosten (Miete Büro)',     '4210', 40, '#f97316', true),
    (p_user_id, 'business', 'expense', 'Versicherungen (Betrieb)',    '4360', 50, '#ea580c', true),
    (p_user_id, 'business', 'expense', 'KFZ-Kosten (betrieblich)',    '4500', 60, '#c2410c', true),
    (p_user_id, 'business', 'expense', 'Reisekosten',                 '4660', 70, '#f59e0b', true),
    (p_user_id, 'business', 'expense', 'Bewirtung',                   '4650', 80, '#d97706', true),
    (p_user_id, 'business', 'expense', 'Telefon & Internet',          '4920', 90, '#eab308', true),
    (p_user_id, 'business', 'expense', 'Büromaterial',                '4930',100, '#ca8a04', true),
    (p_user_id, 'business', 'expense', 'Software-Abos',               '4909',110, '#a3a3a3', true),
    (p_user_id, 'business', 'expense', 'Werbung & Marketing',         '4610',120, '#8b5cf6', true),
    (p_user_id, 'business', 'expense', 'Beratungskosten (Steuerberater, Anwalt)','4955',130, '#a855f7', true),
    (p_user_id, 'business', 'expense', 'Fortbildung',                 '4940',140, '#ec4899', true),
    (p_user_id, 'business', 'expense', 'Abschreibungen (AfA)',        '4830',150, '#64748b', false),
    (p_user_id, 'business', 'expense', 'Zinsen Bankkredit',           '2110',160, '#475569', false),
    (p_user_id, 'business', 'expense', 'Bankgebühren',                '4970',170, '#334155', true),
    (p_user_id, 'business', 'expense', 'Sonstige Betriebsausgaben',   '4900',180, '#6b7280', true),
    -- New, more granular business expense buckets
    (p_user_id, 'business', 'expense', 'Software-Tools / SaaS-Subscriptions','4909',190, '#7c3aed', true),
    (p_user_id, 'business', 'expense', 'Hardware & Geräte',           '4830',200, '#0ea5e9', true),
    (p_user_id, 'business', 'expense', 'Domain & Hosting',            '4906',210, '#0284c7', true),
    (p_user_id, 'business', 'expense', 'Internet (geschäftlich)',     '4925',220, '#38bdf8', true),
    (p_user_id, 'business', 'expense', 'Mobilfunk (geschäftlich)',    '4926',230, '#22d3ee', true),
    (p_user_id, 'business', 'expense', 'Geschäftsessen',              '4654',240, '#f43f5e', true),
    (p_user_id, 'business', 'expense', 'Coworking & Büromiete-flex',  '4280',250, '#fb923c', true),
    (p_user_id, 'business', 'expense', 'Werbung Online (Google/Meta Ads)','4612',260, '#d946ef', true),
    (p_user_id, 'business', 'expense', 'Buchhaltung / Software',      '4955',270, '#a3e635', true);

  -- ─── Personal income ──────────────────────────────────────────────────
  insert into public.categories (user_id, scope, kind, name, sort_order, color) values
    (p_user_id, 'personal', 'income', 'Gehalt / Lohn',          10, '#10b981'),
    (p_user_id, 'personal', 'income', 'Bürgergeld (Jobcenter)', 20, '#14b8a6'),
    (p_user_id, 'personal', 'income', 'Wohngeld',               30, '#06b6d4'),
    (p_user_id, 'personal', 'income', 'Kindergeld',             40, '#0ea5e9'),
    (p_user_id, 'personal', 'income', 'Geschenke / Sonstiges',  50, '#6366f1'),
    -- New
    (p_user_id, 'personal', 'income', 'Mieteinnahmen (privat)', 60, '#22d3ee'),
    (p_user_id, 'personal', 'income', 'Verkauf privat (eBay etc.)',70, '#a78bfa');

  -- ─── Personal expenses ────────────────────────────────────────────────
  insert into public.categories (user_id, scope, kind, name, sort_order, color) values
    (p_user_id, 'personal', 'expense', 'Miete & Nebenkosten',   10, '#ef4444'),
    (p_user_id, 'personal', 'expense', 'Lebensmittel',          20, '#f97316'),
    (p_user_id, 'personal', 'expense', 'Transport / ÖPNV',      30, '#f59e0b'),
    (p_user_id, 'personal', 'expense', 'Versicherungen (privat)',40, '#eab308'),
    (p_user_id, 'personal', 'expense', 'Krankenkasse',          50, '#84cc16'),
    (p_user_id, 'personal', 'expense', 'Internet & Handy',      60, '#a3e635'),
    (p_user_id, 'personal', 'expense', 'Kleidung',              70, '#22d3ee'),
    (p_user_id, 'personal', 'expense', 'Freizeit & Hobby',      80, '#60a5fa'),
    (p_user_id, 'personal', 'expense', 'Bildung',               90, '#8b5cf6'),
    (p_user_id, 'personal', 'expense', 'Sonstiges',            100, '#94a3b8'),
    -- New, more granular personal expense buckets
    (p_user_id, 'personal', 'expense', 'Strom & Gas',          110, '#facc15'),
    (p_user_id, 'personal', 'expense', 'Wasser & Müll',        120, '#38bdf8'),
    (p_user_id, 'personal', 'expense', 'Restaurants & Cafés',  130, '#fb7185'),
    (p_user_id, 'personal', 'expense', 'Streaming-Dienste',    140, '#d946ef'),
    (p_user_id, 'personal', 'expense', 'Fitness & Sport',      150, '#34d399'),
    (p_user_id, 'personal', 'expense', 'Friseur & Beauty',     160, '#f472b6'),
    (p_user_id, 'personal', 'expense', 'Auto-Tankstelle',      170, '#ef4444'),
    (p_user_id, 'personal', 'expense', 'Auto-Werkstatt & Reparatur',180, '#dc2626'),
    (p_user_id, 'personal', 'expense', 'KFZ-Versicherung',     190, '#fb923c'),
    (p_user_id, 'personal', 'expense', 'KFZ-Steuer',           200, '#f97316'),
    (p_user_id, 'personal', 'expense', 'ÖPNV / Bahn / Bus',    210, '#0ea5e9'),
    (p_user_id, 'personal', 'expense', 'Apotheke',             220, '#14b8a6'),
    (p_user_id, 'personal', 'expense', 'Arzt & Behandlung',    230, '#10b981'),
    (p_user_id, 'personal', 'expense', 'Geschenke',            240, '#a855f7'),
    (p_user_id, 'personal', 'expense', 'Reisen & Urlaub',      250, '#6366f1'),
    (p_user_id, 'personal', 'expense', 'Restaurants (Privat)', 260, '#fda4af'),
    (p_user_id, 'personal', 'expense', 'Haustiere',            270, '#fbbf24'),
    (p_user_id, 'personal', 'expense', 'Möbel & Einrichtung',  280, '#a16207'),
    (p_user_id, 'personal', 'expense', 'Haushaltsartikel',     290, '#ca8a04'),
    (p_user_id, 'personal', 'expense', 'Friseur',              300, '#ec4899'),
    (p_user_id, 'personal', 'expense', 'Spenden',              310, '#22c55e'),
    (p_user_id, 'personal', 'expense', 'Schulgebühren / Kita', 320, '#3b82f6'),
    (p_user_id, 'personal', 'expense', 'Steuerberater (privat)',330, '#7c3aed');
end;
$$;

grant execute on function public.seed_default_categories(uuid) to authenticated;

-- ─── Backfill existing users — idempotent ────────────────────────────────
-- Inserts only the missing rows (per user × scope × kind × name).
-- A temporary lookup of "expected" categories is materialised, then diffed.

do $$
declare
  rec record;
  expected jsonb := jsonb_build_array(
    -- business expense (new ones only — existing rows stay untouched)
    jsonb_build_object('scope','business','kind','expense','name','Software-Tools / SaaS-Subscriptions','skr','4909','sort',190,'color','#7c3aed','jc',true),
    jsonb_build_object('scope','business','kind','expense','name','Hardware & Geräte','skr','4830','sort',200,'color','#0ea5e9','jc',true),
    jsonb_build_object('scope','business','kind','expense','name','Domain & Hosting','skr','4906','sort',210,'color','#0284c7','jc',true),
    jsonb_build_object('scope','business','kind','expense','name','Internet (geschäftlich)','skr','4925','sort',220,'color','#38bdf8','jc',true),
    jsonb_build_object('scope','business','kind','expense','name','Mobilfunk (geschäftlich)','skr','4926','sort',230,'color','#22d3ee','jc',true),
    jsonb_build_object('scope','business','kind','expense','name','Geschäftsessen','skr','4654','sort',240,'color','#f43f5e','jc',true),
    jsonb_build_object('scope','business','kind','expense','name','Coworking & Büromiete-flex','skr','4280','sort',250,'color','#fb923c','jc',true),
    jsonb_build_object('scope','business','kind','expense','name','Werbung Online (Google/Meta Ads)','skr','4612','sort',260,'color','#d946ef','jc',true),
    jsonb_build_object('scope','business','kind','expense','name','Buchhaltung / Software','skr','4955','sort',270,'color','#a3e635','jc',true),
    -- personal income (new ones only)
    jsonb_build_object('scope','personal','kind','income','name','Mieteinnahmen (privat)','skr',null,'sort',60,'color','#22d3ee','jc',false),
    jsonb_build_object('scope','personal','kind','income','name','Verkauf privat (eBay etc.)','skr',null,'sort',70,'color','#a78bfa','jc',false),
    -- personal expense (new ones only)
    jsonb_build_object('scope','personal','kind','expense','name','Strom & Gas','skr',null,'sort',110,'color','#facc15','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Wasser & Müll','skr',null,'sort',120,'color','#38bdf8','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Restaurants & Cafés','skr',null,'sort',130,'color','#fb7185','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Streaming-Dienste','skr',null,'sort',140,'color','#d946ef','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Fitness & Sport','skr',null,'sort',150,'color','#34d399','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Friseur & Beauty','skr',null,'sort',160,'color','#f472b6','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Auto-Tankstelle','skr',null,'sort',170,'color','#ef4444','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Auto-Werkstatt & Reparatur','skr',null,'sort',180,'color','#dc2626','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','KFZ-Versicherung','skr',null,'sort',190,'color','#fb923c','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','KFZ-Steuer','skr',null,'sort',200,'color','#f97316','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','ÖPNV / Bahn / Bus','skr',null,'sort',210,'color','#0ea5e9','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Apotheke','skr',null,'sort',220,'color','#14b8a6','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Arzt & Behandlung','skr',null,'sort',230,'color','#10b981','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Geschenke','skr',null,'sort',240,'color','#a855f7','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Reisen & Urlaub','skr',null,'sort',250,'color','#6366f1','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Restaurants (Privat)','skr',null,'sort',260,'color','#fda4af','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Haustiere','skr',null,'sort',270,'color','#fbbf24','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Möbel & Einrichtung','skr',null,'sort',280,'color','#a16207','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Haushaltsartikel','skr',null,'sort',290,'color','#ca8a04','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Friseur','skr',null,'sort',300,'color','#ec4899','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Spenden','skr',null,'sort',310,'color','#22c55e','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Schulgebühren / Kita','skr',null,'sort',320,'color','#3b82f6','jc',false),
    jsonb_build_object('scope','personal','kind','expense','name','Steuerberater (privat)','skr',null,'sort',330,'color','#7c3aed','jc',false)
  );
begin
  for rec in
    select u.id as user_id, e.value as cat
    from auth.users u
    cross join jsonb_array_elements(expected) e
  loop
    insert into public.categories (
      user_id, scope, kind, name, skr_code, sort_order, color, is_jobcenter_relevant
    )
    select
      rec.user_id,
      (rec.cat->>'scope')::doc_scope,
      (rec.cat->>'kind')::entry_kind,
      rec.cat->>'name',
      rec.cat->>'skr',
      (rec.cat->>'sort')::int,
      rec.cat->>'color',
      coalesce((rec.cat->>'jc')::boolean, false)
    where not exists (
      select 1 from public.categories c
      where c.user_id = rec.user_id
        and c.scope = (rec.cat->>'scope')::doc_scope
        and c.kind  = (rec.cat->>'kind')::entry_kind
        and c.name  = rec.cat->>'name'
    );
  end loop;
end $$;
