-- Production user_data migration from name-based row IDs to internal student_ IDs.
-- Run only after:
-- 1. App JSON backup has been exported from the admin screen.
-- 2. test_user_data migration has been verified.
-- 3. verify_internal_user_ids.sql shows the exact legacy user_data rows you intend to move.
--
-- This script stores a private audit record in private.d_lesson_user_data_id_migration_audit.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

do $$
begin
  if exists (
    select 1
    from public.test_user_data
    where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
      and id not like 'student_%'
  ) then
    raise exception 'Stop: test_user_data still has legacy name-based IDs. Finish the test migration first.';
  end if;
end $$;

create table if not exists private.d_lesson_user_data_id_migration_audit (
  batch_id uuid not null,
  table_name text not null check (table_name = 'user_data'),
  old_id text not null,
  new_id text not null,
  display_name text not null,
  old_data jsonb not null,
  new_data jsonb not null,
  access_rows_updated integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (batch_id, table_name, old_id),
  unique (table_name, new_id)
);

drop table if exists pg_temp.d_lesson_user_id_migration_batch;
drop table if exists pg_temp.d_lesson_user_id_migration_map;
drop table if exists pg_temp.d_lesson_user_id_migration_access_counts;

create temp table d_lesson_user_id_migration_batch (
  batch_id uuid not null
) on commit preserve rows;

insert into d_lesson_user_id_migration_batch (batch_id)
values (gen_random_uuid());

create temp table d_lesson_user_id_migration_map (
  old_id text primary key,
  new_id text not null unique,
  display_name text not null,
  old_data jsonb not null,
  new_data jsonb not null
) on commit preserve rows;

with source_rows as (
  select
    id as old_id,
    coalesce(nullif(data::jsonb ->> 'displayName', ''), id::text) as display_name,
    coalesce(data::jsonb, '{}'::jsonb) as old_data
  from public.user_data
  where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
    and id not like 'student_%'
),
mapped_rows as (
  select
    old_id,
    'student_' || gen_random_uuid()::text as new_id,
    display_name,
    old_data
  from source_rows
)
insert into d_lesson_user_id_migration_map (old_id, new_id, display_name, old_data, new_data)
select
  old_id,
  new_id,
  display_name,
  old_data,
  jsonb_set(
    jsonb_set(
      old_data,
      '{displayName}',
      to_jsonb(display_name),
      true
    ),
    '{userDataId}',
    to_jsonb(new_id),
    true
  ) as new_data
from mapped_rows;

insert into private.d_lesson_user_data_id_migration_audit (
  batch_id,
  table_name,
  old_id,
  new_id,
  display_name,
  old_data,
  new_data
)
select
  batch.batch_id,
  'user_data',
  mapping.old_id,
  mapping.new_id,
  mapping.display_name,
  mapping.old_data,
  mapping.new_data
from d_lesson_user_id_migration_map mapping
cross join d_lesson_user_id_migration_batch batch;

update public.user_data target
set
  id = mapping.new_id,
  data = mapping.new_data
from d_lesson_user_id_migration_map mapping
where target.id = mapping.old_id;

create temp table d_lesson_user_id_migration_access_counts (
  old_id text primary key,
  updated_count integer not null
) on commit preserve rows;

with updated as (
  update public.lesson_user_access access
  set user_data_id = mapping.new_id
  from d_lesson_user_id_migration_map mapping
  where access.user_data_id = mapping.old_id
  returning mapping.old_id
)
insert into d_lesson_user_id_migration_access_counts (old_id, updated_count)
select old_id, count(*)::integer
from updated
group by old_id;

update private.d_lesson_user_data_id_migration_audit audit
set access_rows_updated = counts.updated_count
from d_lesson_user_id_migration_batch batch
join d_lesson_user_id_migration_access_counts counts on true
where audit.batch_id = batch.batch_id
  and audit.table_name = 'user_data'
  and audit.old_id = counts.old_id;

select
  batch.batch_id,
  mapping.old_id,
  mapping.new_id,
  mapping.display_name,
  exists (
    select 1
    from public.user_data data_row
    where data_row.id = mapping.new_id
      and data_row.data ->> 'displayName' = mapping.display_name
      and data_row.data ->> 'userDataId' = mapping.new_id
  ) as migrated,
  coalesce(counts.updated_count, 0) as access_rows_updated
from d_lesson_user_id_migration_map mapping
cross join d_lesson_user_id_migration_batch batch
left join d_lesson_user_id_migration_access_counts counts on counts.old_id = mapping.old_id
order by mapping.display_name;

commit;

select
  id,
  data ->> 'displayName' as display_name,
  data ->> 'userDataId' as user_data_id
from public.user_data
where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
order by display_name, id;
