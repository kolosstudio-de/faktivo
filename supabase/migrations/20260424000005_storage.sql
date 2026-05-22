-- Storage buckets for PDFs and attachments
-- Bucket names are user-scoped via RLS on storage.objects.

-- ============================================================================
-- BUCKETS
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documents', 'documents', false, 20971520, array['application/pdf'])
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('attachments', 'attachments', false, 20971520,
          array['application/pdf','image/jpeg','image/png','image/webp','image/heic'])
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('logos', 'logos', true, 2097152,
          array['image/png','image/jpeg','image/svg+xml','image/webp'])
  on conflict (id) do nothing;

-- ============================================================================
-- POLICIES — path convention: bucket/<user_id>/<rest>
-- ============================================================================

-- documents: private, owner-only
create policy "documents_own_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "documents_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "documents_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "documents_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- attachments: private, owner-only
create policy "attachments_own_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "attachments_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "attachments_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "attachments_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- logos: public read (for PDF embedding), owner write
create policy "logos_public_select" on storage.objects
  for select to public
  using (bucket_id = 'logos');

create policy "logos_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "logos_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "logos_own_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
