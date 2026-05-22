-- Seed default SKR03-aligned categories for new users.
-- Called from handle_new_user() trigger.
-- SKR03 codes are German "Standard-Kontenrahmen" for DATEV export later.

create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Business income categories
  insert into public.categories (user_id, scope, kind, name, skr_code, sort_order, color, is_jobcenter_relevant) values
    (p_user_id, 'business', 'income', 'Erlöse Dienstleistungen',    '8400', 10, '#10b981', true),
    (p_user_id, 'business', 'income', 'Erlöse Produktverkauf',      '8410', 20, '#059669', true),
    (p_user_id, 'business', 'income', 'Sonstige betriebliche Erträge','8500', 30, '#14b8a6', true),
    (p_user_id, 'business', 'income', 'Zinserträge',                '2650', 40, '#06b6d4', false);

  -- Business expense categories (Jobcenter EKS-relevant ones flagged)
  insert into public.categories (user_id, scope, kind, name, skr_code, sort_order, color, is_jobcenter_relevant) values
    (p_user_id, 'business', 'expense', 'Wareneinkauf',               '3400', 10, '#ef4444', true),
    (p_user_id, 'business', 'expense', 'Fremdleistungen / Subunternehmer','3100', 20, '#dc2626', true),
    (p_user_id, 'business', 'expense', 'Personalkosten (Löhne)',     '4100', 30, '#b91c1c', true),
    (p_user_id, 'business', 'expense', 'Raumkosten (Miete Büro)',    '4210', 40, '#f97316', true),
    (p_user_id, 'business', 'expense', 'Versicherungen (Betrieb)',   '4360', 50, '#ea580c', true),
    (p_user_id, 'business', 'expense', 'KFZ-Kosten (betrieblich)',   '4500', 60, '#c2410c', true),
    (p_user_id, 'business', 'expense', 'Reisekosten',                '4660', 70, '#f59e0b', true),
    (p_user_id, 'business', 'expense', 'Bewirtung',                  '4650', 80, '#d97706', true),
    (p_user_id, 'business', 'expense', 'Telefon & Internet',         '4920', 90, '#eab308', true),
    (p_user_id, 'business', 'expense', 'Büromaterial',               '4930', 100, '#ca8a04', true),
    (p_user_id, 'business', 'expense', 'Software-Abos',              '4909', 110, '#a3a3a3', true),
    (p_user_id, 'business', 'expense', 'Werbung & Marketing',        '4610', 120, '#8b5cf6', true),
    (p_user_id, 'business', 'expense', 'Beratungskosten (Steuerberater, Anwalt)','4955', 130, '#a855f7', true),
    (p_user_id, 'business', 'expense', 'Fortbildung',                '4940', 140, '#ec4899', true),
    (p_user_id, 'business', 'expense', 'Abschreibungen (AfA)',       '4830', 150, '#64748b', false),
    (p_user_id, 'business', 'expense', 'Zinsen Bankkredit',          '2110', 160, '#475569', false),
    (p_user_id, 'business', 'expense', 'Bankgebühren',               '4970', 170, '#334155', true),
    (p_user_id, 'business', 'expense', 'Sonstige Betriebsausgaben',  '4900', 180, '#6b7280', true);

  -- Personal income
  insert into public.categories (user_id, scope, kind, name, sort_order, color) values
    (p_user_id, 'personal', 'income', 'Gehalt / Lohn',        10, '#10b981'),
    (p_user_id, 'personal', 'income', 'Bürgergeld (Jobcenter)',20, '#14b8a6'),
    (p_user_id, 'personal', 'income', 'Wohngeld',             30, '#06b6d4'),
    (p_user_id, 'personal', 'income', 'Kindergeld',           40, '#0ea5e9'),
    (p_user_id, 'personal', 'income', 'Geschenke / Sonstiges',50, '#6366f1');

  -- Personal expense
  insert into public.categories (user_id, scope, kind, name, sort_order, color) values
    (p_user_id, 'personal', 'expense', 'Miete & Nebenkosten', 10, '#ef4444'),
    (p_user_id, 'personal', 'expense', 'Lebensmittel',        20, '#f97316'),
    (p_user_id, 'personal', 'expense', 'Transport / ÖPNV',    30, '#f59e0b'),
    (p_user_id, 'personal', 'expense', 'Versicherungen (privat)',40, '#eab308'),
    (p_user_id, 'personal', 'expense', 'Krankenkasse',        50, '#84cc16'),
    (p_user_id, 'personal', 'expense', 'Internet & Handy',    60, '#a3e635'),
    (p_user_id, 'personal', 'expense', 'Kleidung',            70, '#22d3ee'),
    (p_user_id, 'personal', 'expense', 'Freizeit & Hobby',    80, '#60a5fa'),
    (p_user_id, 'personal', 'expense', 'Bildung',             90, '#8b5cf6'),
    (p_user_id, 'personal', 'expense', 'Sonstiges',          100, '#94a3b8');
end;
$$;

grant execute on function public.seed_default_categories(uuid) to authenticated;

-- Extend handle_new_user to also seed categories
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

  perform public.seed_default_categories(new.id);

  return new;
end;
$$;
