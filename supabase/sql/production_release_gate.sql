-- D Lesson production release gate.
-- Run this read-only SQL in Supabase SQL Editor before switching GitHub Actions
-- from test_user_data to user_data.
--
-- Release is blocked while any row has result = 'NG'.
-- WARN rows are not always blockers, but should be understood before release.

with checks as (
  select
    'user_data_rls_enabled' as check_name,
    case
      when exists (
        select 1
        from pg_class class
        join pg_namespace namespace on namespace.oid = class.relnamespace
        where namespace.nspname = 'public'
          and class.relname = 'user_data'
          and class.relrowsecurity
      ) then 'OK'
      else 'NG'
    end as result,
    case
      when exists (
        select 1
        from pg_class class
        join pg_namespace namespace on namespace.oid = class.relnamespace
        where namespace.nspname = 'public'
          and class.relname = 'user_data'
          and class.relrowsecurity
      ) then 0
      else 1
    end as count_value,
    'Enable RLS on public.user_data.' as required_action

  union all

  select
    'lesson_user_access_rls_enabled',
    case
      when exists (
        select 1
        from pg_class class
        join pg_namespace namespace on namespace.oid = class.relnamespace
        where namespace.nspname = 'public'
          and class.relname = 'lesson_user_access'
          and class.relrowsecurity
      ) then 'OK'
      else 'NG'
    end,
    case
      when exists (
        select 1
        from pg_class class
        join pg_namespace namespace on namespace.oid = class.relnamespace
        where namespace.nspname = 'public'
          and class.relname = 'lesson_user_access'
          and class.relrowsecurity
      ) then 0
      else 1
    end,
    'Enable RLS on public.lesson_user_access.'

  union all

  select
    'lesson_settings_table_ready',
    case
      when exists (
        select 1
        from pg_class class
        join pg_namespace namespace on namespace.oid = class.relnamespace
        where namespace.nspname = 'public'
          and class.relname = 'lesson_settings'
          and class.relrowsecurity
      ) then 'OK'
      else 'WARN'
    end,
    case
      when exists (
        select 1
        from pg_class class
        join pg_namespace namespace on namespace.oid = class.relnamespace
        where namespace.nspname = 'public'
          and class.relname = 'lesson_settings'
          and class.relrowsecurity
      ) then 0
      else 1
    end,
    'Required before setting VITE_ENABLE_SETTINGS_TABLE=true.'

  union all

  select
    'user_data_legacy_name_ids',
    case when count(*) = 0 then 'OK' else 'NG' end,
    count(*)::integer,
    'Run prepare_user_display_names.sql, migrate_user_data_named_ids.sql, then verify_internal_user_ids.sql.'
  from public.user_data
  where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
    and id not like 'student_%'

  union all

  select
    'lesson_user_access_legacy_refs',
    case when count(*) = 0 then 'OK' else 'NG' end,
    count(*)::integer,
    'Update lesson_user_access.user_data_id to internal student_... IDs.'
  from public.lesson_user_access
  where user_data_id not in ('__admin__', '__teacher__', '__GLOBAL_SETTINGS__', 'Master_Debug')
    and user_data_id not like 'student_%'

  union all

  select
    'lesson_user_access_orphan_refs',
    case when count(*) = 0 then 'OK' else 'NG' end,
    count(*)::integer,
    'Every student lesson_user_access.user_data_id must exist in public.user_data.id.'
  from public.lesson_user_access access
  left join public.user_data data_row on data_row.id = access.user_data_id
  where access.user_data_id not in ('__admin__', '__teacher__', '__GLOBAL_SETTINGS__', 'Master_Debug')
    and access.user_data_id like 'student_%'
    and data_row.id is null

  union all

  select
    'lesson_user_access_missing_auth_users',
    case when count(*) = 0 then 'OK' else 'NG' end,
    count(*)::integer,
    'Every lesson_user_access.auth_user_id must exist in auth.users.id.'
  from public.lesson_user_access access
  left join auth.users auth_users on auth_users.id = access.auth_user_id
  where auth_users.id is null

  union all

  select
    'admin_access_rows',
    case when count(*) > 0 then 'OK' else 'NG' end,
    count(*)::integer,
    'At least one admin row is required in lesson_user_access.'
  from public.lesson_user_access
  where role = 'admin'

  union all

  select
    'student_access_rows',
    case when count(*) > 0 then 'OK' else 'WARN' end,
    count(*)::integer,
    'Student rows are required before real student login verification.'
  from public.lesson_user_access
  where role = 'student'

  union all

  select
    'teacher_access_rows',
    case when count(*) > 0 then 'OK' else 'WARN' end,
    count(*)::integer,
    'Teacher rows are required before teacher-scope operation.'
  from public.lesson_user_access
  where role = 'teacher'

  union all

  select
    'open_public_or_anon_policies',
    case when count(*) = 0 then 'OK' else 'NG' end,
    count(*)::integer,
    'Remove public/anon true policies from user_data, test_user_data, lesson_user_access, and lesson_settings.'
  from pg_policies
  where schemaname = 'public'
    and tablename in ('user_data', 'test_user_data', 'lesson_user_access', 'lesson_settings')
    and ('public' = any(roles) or 'anon' = any(roles))
    and (qual = 'true' or with_check = 'true')
)
select
  check_name,
  result,
  count_value,
  required_action
from checks
order by
  case result when 'NG' then 1 when 'WARN' then 2 else 3 end,
  check_name;

-- Details for any NG/WARN rows that usually need manual cleanup.
select
  'legacy_user_data_id' as issue,
  data_row.id as subject,
  null::text as auth_email,
  data_row.data ->> 'displayName' as detail
from public.user_data data_row
where data_row.id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and data_row.id not like 'student_%'

union all

select
  'legacy_access_ref',
  access.user_data_id,
  auth_users.email,
  access.role
from public.lesson_user_access access
left join auth.users auth_users on auth_users.id = access.auth_user_id
where access.user_data_id not in ('__admin__', '__teacher__', '__GLOBAL_SETTINGS__', 'Master_Debug')
  and access.user_data_id not like 'student_%'

union all

select
  'orphan_access_ref',
  access.user_data_id,
  auth_users.email,
  access.role
from public.lesson_user_access access
left join public.user_data data_row on data_row.id = access.user_data_id
left join auth.users auth_users on auth_users.id = access.auth_user_id
where access.user_data_id not in ('__admin__', '__teacher__', '__GLOBAL_SETTINGS__', 'Master_Debug')
  and access.user_data_id like 'student_%'
  and data_row.id is null

union all

select
  'missing_auth_user',
  access.auth_user_id::text,
  null::text,
  access.role::text || ':' || access.user_data_id
from public.lesson_user_access access
left join auth.users auth_users on auth_users.id = access.auth_user_id
where auth_users.id is null
order by issue, subject;
