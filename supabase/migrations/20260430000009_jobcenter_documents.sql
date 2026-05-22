-- Uploaded Jobcenter documents + AI parse results.
-- AI Jobcenter Document Parser feature.
-- Stand 2026-05-21

do $$
begin
  if not exists (select 1 from pg_type where typname = 'jobcenter_document_kind') then
    create type jobcenter_document_kind as enum (
      'bewilligung',        -- Bewilligungsbescheid (notice of approval)
      'wba',                -- Weiterbewilligungsantrag confirmation
      'eks_vorlaeufig',     -- Vorläufige Anlage EKS already submitted
      'eks_endgueltig',     -- Endgültige Anlage EKS already submitted
      'vermoegen',          -- Anlage VM (assets)
      'other'
    );
  end if;
end $$;

create table if not exists public.jobcenter_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind jobcenter_document_kind not null,
  filename text not null,
  file_size_bytes int not null,
  storage_path text not null,    -- bucket://jobcenter-docs/<user_id>/<id>.<ext>
  uploaded_at timestamptz not null default now(),
  parsed_at timestamptz,
  parsed_data jsonb,             -- AI-extracted fields
  parse_confidence numeric(5,2), -- 0-100 overall
  parse_warnings text[],
  applied_at timestamptz,        -- when user confirmed & applied to settings
  applied_to_report_id uuid references public.jobcenter_reports(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.jobcenter_documents is
  'Uploaded Jobcenter documents (Bewilligungsbescheid, WBA, EKS, etc.) with AI-extracted fields. User reviews parsed_data and can apply to settings / jobcenter_reports.';

create index if not exists idx_jc_docs_user
  on public.jobcenter_documents(user_id, kind, uploaded_at desc);

alter table public.jobcenter_documents enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'jobcenter_documents'
      and policyname = 'jc_docs_own_select') then
    create policy "jc_docs_own_select" on public.jobcenter_documents
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'jobcenter_documents'
      and policyname = 'jc_docs_own_modify') then
    create policy "jc_docs_own_modify" on public.jobcenter_documents
      for all to authenticated using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- ─── Storage bucket (private, owner-only) ─────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('jobcenter-docs', 'jobcenter-docs', false, 10485760,
          array['application/pdf','image/jpeg','image/png','image/webp','image/heic'])
  on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'jc_docs_own_select_storage') then
    create policy "jc_docs_own_select_storage" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'jobcenter-docs'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
  if not exists (select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'jc_docs_own_insert_storage') then
    create policy "jc_docs_own_insert_storage" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'jobcenter-docs'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
  if not exists (select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'jc_docs_own_delete_storage') then
    create policy "jc_docs_own_delete_storage" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'jobcenter-docs'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;
