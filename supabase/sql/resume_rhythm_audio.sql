-- Operator-authorized restoration of rhythm audio only. Word is unchanged.
-- Retain all audio objects, charts, learner records and existing admin policies.
begin;

update storage.buckets
set public = true
where id = 'lesson-rhythm-audio';

drop policy if exists "Rhythm distribution suspended" on storage.objects;

commit;

select id, public from storage.buckets where id = 'lesson-rhythm-audio';
