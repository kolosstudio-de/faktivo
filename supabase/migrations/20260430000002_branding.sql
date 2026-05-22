-- Branding: Logo, Unterschrift, Stempel auf Rechnungen / Angeboten
--
-- 1) settings: signature_url + stamp_url (logo_url existiert schon)
-- 2) Storage-Buckets für signatures + stamps (privat — RLS owner-only)
-- 3) Default-Toggle pro Document: zeige Unterschrift / Stempel
--    → invoices.show_signature, invoices.show_stamp (gleich für quotes)
--
-- Re-runnable.

-- ─── Settings columns ────────────────────────────────────────────────────
alter table public.settings
  add column if not exists signature_url text,
  add column if not exists stamp_url text;

-- ─── Buckets (privat, kleine Dateien) ─────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('signatures', 'signatures', false, 1048576,
      array['image/png','image/jpeg','image/svg+xml','image/webp']),
    ('stamps', 'stamps', false, 1048576,
      array['image/png','image/jpeg','image/svg+xml','image/webp'])
  on conflict (id) do nothing;

-- ─── RLS policies (owner-only) ────────────────────────────────────────────
do $$ begin
  -- signatures
  if not exists (select 1 from pg_policies where policyname = 'signatures_own_select') then
    create policy "signatures_own_select" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'signatures'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'signatures_own_insert') then
    create policy "signatures_own_insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'signatures'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'signatures_own_update') then
    create policy "signatures_own_update" on storage.objects
      for update to authenticated
      using (
        bucket_id = 'signatures'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'signatures_own_delete') then
    create policy "signatures_own_delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'signatures'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
  -- stamps
  if not exists (select 1 from pg_policies where policyname = 'stamps_own_select') then
    create policy "stamps_own_select" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'stamps'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'stamps_own_insert') then
    create policy "stamps_own_insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'stamps'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'stamps_own_update') then
    create policy "stamps_own_update" on storage.objects
      for update to authenticated
      using (
        bucket_id = 'stamps'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'stamps_own_delete') then
    create policy "stamps_own_delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'stamps'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;

-- ─── Per-document toggle: show signature / stamp ──────────────────────────
alter table public.invoices
  add column if not exists show_signature boolean not null default false,
  add column if not exists show_stamp boolean not null default false;

alter table public.quotes
  add column if not exists show_signature boolean not null default false,
  add column if not exists show_stamp boolean not null default false;

comment on column public.settings.signature_url is
  'Public/signed URL of user signature image (PNG transparent recommended). Embedded in PDF if invoice.show_signature = true.';
comment on column public.settings.stamp_url is
  'Public/signed URL of user stamp image. Embedded in PDF if invoice.show_stamp = true. Stamp has NO legal weight in Germany — purely visual.';
