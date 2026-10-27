-- Reversible suspension: retain all audio objects, charts and learner records.
-- Service-role maintenance remains possible; no browser role may read or upload.
begin;

update storage.buckets
set public = false
where id = 'lesson-rhythm-audio';

drop policy if exists "Rhythm distribution suspended" on storage.objects;
create policy "Rhythm distribution suspended"
on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'lesson-rhythm-audio')
with check (bucket_id <> 'lesson-rhythm-audio');

commit;

select id, public from storage.buckets where id = 'lesson-rhythm-audio';
