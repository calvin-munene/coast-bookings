-- Run once in each Supabase project's SQL editor after database migrations.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-property-images', 'public-property-images', true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('private-host-documents', 'private-host-documents', false, 15728640, array['application/pdf','image/jpeg','image/png']),
  ('private-booking-documents', 'private-booking-documents', false, 15728640, array['application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('private-support-attachments', 'private-support-attachments', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy public_listing_images_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'public-property-images');

-- Uploads/deletes and every private read intentionally go through server routes
-- using the service role after permission checks. The browser receives only a
-- short-lived signed URL, so there is no broad direct-object policy to bypass.
