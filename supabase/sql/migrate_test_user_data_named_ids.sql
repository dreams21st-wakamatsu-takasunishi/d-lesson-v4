-- Move legacy name-based test_user_data IDs to internal student_ IDs.
-- Run only after taking a JSON backup from the app admin screen.
-- This updates lesson_user_access.user_data_id for matching student rows.

begin;

drop table if exists pg_temp.d_lesson_test_user_id_migration_map;

create temp table d_lesson_test_user_id_migration_map (
  old_id text primary key,
  new_id text not null unique,
  display_name text not null
) on commit drop;

insert into d_lesson_test_user_id_migration_map (old_id, new_id, display_name)
select
  id as old_id,
  'student_' || gen_random_uuid()::text as new_id,
  coalesce(data::jsonb ->> 'displayName', id::text) as display_name
from public.test_user_data
where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and id not like 'student_%';

update public.test_user_data target
set
  id = mapping.new_id,
  data = jsonb_set(
    jsonb_set(
      coalesce(target.data::jsonb, '{}'::jsonb),
      '{displayName}',
      to_jsonb(mapping.display_name),
      true
    ),
    '{userDataId}',
    to_jsonb(mapping.new_id),
    true
  )
from d_lesson_test_user_id_migration_map mapping
where target.id = mapping.old_id;

update public.lesson_user_access access
set user_data_id = mapping.new_id
from d_lesson_test_user_id_migration_map mapping
where access.user_data_id = mapping.old_id;

select
  mapping.old_id,
  mapping.new_id,
  mapping.display_name,
  exists (
    select 1
    from public.test_user_data data_row
    where data_row.id = mapping.new_id
      and data_row.data ->> 'displayName' = mapping.display_name
      and data_row.data ->> 'userDataId' = mapping.new_id
  ) as migrated,
  exists (
    select 1
    from public.lesson_user_access access
    where access.user_data_id = mapping.new_id
  ) as access_row_updated
from d_lesson_test_user_id_migration_map mapping
order by mapping.display_name;

commit;

select id, data ->> 'displayName' as display_name, data ->> 'userDataId' as user_data_id
from public.test_user_data
order by id;
