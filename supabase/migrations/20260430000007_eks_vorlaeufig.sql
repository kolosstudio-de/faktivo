-- Vorläufige Anlage EKS — START of BWZ submission.
--
-- The user files an Anlage EKS *twice* per Bewilligungszeitraum:
--   1. at the START with estimated monthly income (vorläufig) — basis for
--      reduced monthly Bürgergeld payments during the BWZ
--   2. at the END with actual numbers (endgültig) — basis for refund / payback
--
-- Up to now `jobcenter_reports` only stored the endgültig variant. This
-- migration introduces:
--   - eks_report_kind enum to distinguish vorläufig / endgültig
--   - kind column (default endgueltig — preserves existing rows)
--   - prognose_payload jsonb to hold per-month estimates for vorläufig rows
--
-- §41a SGB II — Vorläufige Entscheidung
-- §3 ALG II-V    — Selbständige Einkünfte
-- Stand 2026-05-21
--

do $$
begin
  if not exists (select 1 from pg_type where typname = 'eks_report_kind') then
    create type eks_report_kind as enum ('vorlaeufig', 'endgueltig');
  end if;
end $$;

alter table public.jobcenter_reports
  add column if not exists kind eks_report_kind not null default 'endgueltig',
  add column if not exists prognose_payload jsonb;

comment on column public.jobcenter_reports.kind is
  'vorlaeufig (Prognose am Anfang BWZ) vs. endgueltig (Festsetzung am Ende BWZ).';
comment on column public.jobcenter_reports.prognose_payload is
  'Per-month estimates for vorläufige Anlage EKS: { months: [{ month, einnahmenCents, ausgabenCents }] }.';

-- Composite index for fast lookup of the latest vorläufig per user.
create index if not exists idx_jobcenter_reports_user_kind
  on public.jobcenter_reports(user_id, kind, period_start desc);
