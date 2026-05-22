-- Extended profile schema for SaaS-ready product:
-- personal identity, legal form, branche, KSK, Jobcenter, Steuerberater, PDF/Mahnwesen, billing.
-- Plus onboarding_progress table.

-- Enums
do $$ begin
  create type legal_form as enum (
    'freiberufler',
    'einzelunternehmen',
    'gbr',
    'ug',
    'gmbh',
    'ohg',
    'kg',
    'kuenstler',
    'andere'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tax_regime as enum ('kleinunternehmer','regelbesteuerung','durchschnittssatz');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vat_scheme as enum ('ist','soll');
exception when duplicate_object then null; end $$;

do $$ begin
  create type skr_chart as enum ('SKR03','SKR04');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_tier as enum ('free','pro','business','trial');
exception when duplicate_object then null; end $$;

-- Extend settings
alter table public.settings
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists email_from_invoice text,
  add column if not exists email_signature text,
  add column if not exists signature_image_url text,

  add column if not exists legal_form legal_form,
  add column if not exists trade_register_number text,
  add column if not exists trade_register_court text,
  add column if not exists branche_wz_code text,
  add column if not exists branche_label text,
  add column if not exists is_ksk_mitglied boolean not null default false,
  add column if not exists is_ksk_abgabepflichtig boolean not null default false,
  add column if not exists ksk_nummer text,

  add column if not exists tax_regime tax_regime default 'kleinunternehmer',
  add column if not exists vat_scheme vat_scheme default 'ist',
  add column if not exists finanzamt_id text,
  add column if not exists finanzamt_name text,
  add column if not exists skr_chart skr_chart default 'SKR03',

  add column if not exists receives_buergergeld boolean not null default false,
  add column if not exists jobcenter_name text,
  add column if not exists jobcenter_bg_nummer text,
  add column if not exists bewilligungszeitraum_start date,
  add column if not exists bewilligungszeitraum_end date,

  add column if not exists steuerberater_name text,
  add column if not exists steuerberater_email text,
  add column if not exists steuerberater_datev_id text,

  add column if not exists pdf_template text default 'minimal',
  add column if not exists pdf_accent_color text default '#0f766e',
  add column if not exists pdf_footer_text text,
  add column if not exists invoice_language_default text default 'de',

  add column if not exists enable_auto_mahnung boolean not null default true,
  add column if not exists mahnung_1_days_after_due int not null default 7,
  add column if not exists mahnung_2_days_after_due int not null default 14,
  add column if not exists mahnung_3_days_after_due int not null default 21,
  add column if not exists mahngebuehr_1_cents bigint not null default 0,
  add column if not exists mahngebuehr_2_cents bigint not null default 500,
  add column if not exists mahngebuehr_3_cents bigint not null default 1000,
  add column if not exists verzugspauschale_cents bigint not null default 4000,  -- §288 V BGB

  add column if not exists onboarding_step int not null default 0,
  add column if not exists onboarding_completed_at timestamptz,

  add column if not exists plan plan_tier not null default 'free',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- Onboarding progress — persists partial answers while user navigates
create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  step int not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.onboarding_progress enable row level security;

drop policy if exists "onboarding_own" on public.onboarding_progress;
create policy "onboarding_own" on public.onboarding_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger trg_onboarding_updated_at before update on public.onboarding_progress
  for each row execute function public.set_updated_at();

-- Auto-create onboarding_progress row on user signup
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
      (new.id, 'invoice', v_year, 'RE', 1, 4),
      (new.id, 'quote', v_year, 'AN', 1, 4),
      (new.id, 'credit_note', v_year, 'GS', 1, 4)
    on conflict do nothing;

  insert into public.onboarding_progress (user_id, step, data)
    values (new.id, 0, '{}'::jsonb)
    on conflict (user_id) do nothing;

  perform public.seed_default_categories(new.id);

  return new;
end;
$$;
