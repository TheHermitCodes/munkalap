-- =============================================================================
-- Attachments: a private bucket. Object names follow
--   {org_id}/{work_order_id}/{random-uuid}-{file name}
-- and private.can_access_attachment() checks both folders against a real work
-- order in one of the caller's organizations.
--
-- Files go straight from the browser to Storage (never through the Next.js
-- server), and are downloaded through short-lived signed URLs.
--
-- Deletes must go through the Storage API (deleting rows here in SQL would
-- leave the actual files behind). The API runs its queries as the caller, so
-- these policies apply there too.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'text/plain']
)
on conflict (id) do nothing;

create policy "Members read their work orders' attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and private.can_access_attachment(name));

create policy "Members attach files to their work orders"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and private.can_access_attachment(name));

-- Uploaders delete their own files, owners any file in their org. Once a work
-- order is gone its path no longer matches, which is why the app removes
-- attachments *before* deleting the work order.
create policy "Uploaders and owners delete attachments"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and private.can_delete_attachment(name, owner_id));
