-- Supabase Storage bucket and policies for D Lesson rhythm-game audio.
-- Run this once in Supabase SQL Editor before uploading audio from the admin UI.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'lesson-rhythm-audio',
  'lesson-rhythm-audio',
  true,
  20971520,
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4',
    'audio/aac'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Lesson users can read rhythm audio" on storage.objects;
create policy "Lesson users can read rhythm audio"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'lesson-rhythm-audio'
  and public.has_lesson_access()
);

drop policy if exists "Lesson admins can upload rhythm audio" on storage.objects;
create policy "Lesson admins can upload rhythm audio"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lesson-rhythm-audio'
  and public.is_lesson_admin()
);

drop policy if exists "Lesson admins can update rhythm audio" on storage.objects;
create policy "Lesson admins can update rhythm audio"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lesson-rhythm-audio'
  and public.is_lesson_admin()
)
with check (
  bucket_id = 'lesson-rhythm-audio'
  and public.is_lesson_admin()
);

drop policy if exists "Lesson admins can delete rhythm audio" on storage.objects;
create policy "Lesson admins can delete rhythm audio"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lesson-rhythm-audio'
  and public.is_lesson_admin()
);

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'lesson-rhythm-audio';
