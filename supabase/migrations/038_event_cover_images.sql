-- Event-specific cover photos for hosted events and imported listings.
alter table public.events add column if not exists cover_image_url text;
alter table public.events add column if not exists cover_image_path text;

alter table public.events drop constraint if exists events_cover_image_url_length_check;
alter table public.events add constraint events_cover_image_url_length_check
  check (cover_image_url is null or char_length(cover_image_url) <= 1200);
alter table public.events drop constraint if exists events_cover_image_path_length_check;
alter table public.events add constraint events_cover_image_path_length_check
  check (cover_image_path is null or char_length(cover_image_path) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Event images are publicly readable" on storage.objects;
create policy "Event images are publicly readable" on storage.objects
  for select to public
  using (bucket_id = 'event-images');

drop policy if exists "Active users can upload event photos" on storage.objects;
create policy "Active users can upload event photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_account_active()
  );

drop policy if exists "Event photo uploaders can remove files" on storage.objects;
create policy "Event photo uploaders can remove files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_app_admin())
  );
