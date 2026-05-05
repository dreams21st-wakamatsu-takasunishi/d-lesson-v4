-- Read-only public release preflight for D Lesson.
-- Run this in Supabase SQL Editor before moving from test_user_data to real user_data.
-- Result should have no NG rows before real student data is published.

with checks as (
  select
    'user_data_legacy_name_ids' as check_name,
    count(*)::integer as count_value,
    case when count(*) = 0 then 'OK' else 'NG' end as result,
    'user_data rows whose id is still a display name instead of student_...' as detail
  from public.user_data
  where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
    and id not like 'student_%'

  union all

  select
    'test_user_data_legacy_name_ids',
    count(*)::integer,
    case when count(*) = 0 then 'OK' else 'WARN' end,
    'test_user_data rows still using display-name ids. This must be fixed before using test data as a production source.'
  from public.test_user_data
  where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
    and id not like 'student_%'

  union all

  select
    'lesson_user_access_legacy_refs',
    count(*)::integer,
    case when count(*) = 0 then 'OK' else 'NG' end,
    'lesson_user_access rows whose user_data_id still points to a display-name id.'
  from public.lesson_user_access
  where user_data_id not in ('__admin__', '__teacher__', '__GLOBAL_SETTINGS__', 'Master_Debug')
    and user_data_id not like 'student_%'

  union all

  select
    'public_user_data_policies',
    count(*)::integer,
    case when count(*) = 0 then 'OK' else 'NG' end,
    'public role policies with true qual/with_check on user_data or test_user_data.'
  from pg_policies
  where schemaname = 'public'
    and tablename in ('user_data', 'test_user_data')
    and 'public' = any(roles)
    and (qual = 'true' or with_check = 'true')

  union all

  select
    'auth_access_rows',
    count(*)::integer,
    case when count(*) > 0 then 'OK' else 'NG' end,
    'lesson_user_access must contain admin/teacher/student access rows before public operation.'
  from public.lesson_user_access

  union all

  select
    'admin_access_rows',
    count(*)::integer,
    case when count(*) > 0 then 'OK' else 'NG' end,
    'At least one admin access row is required.'
  from public.lesson_user_access
  where role = 'admin'
)
select *
from checks
order by
  case result when 'NG' then 1 when 'WARN' then 2 else 3 end,
  check_name;

-- Detail rows for any remaining legacy production IDs.
select
  id,
  data ->> 'displayName' as display_name,
  data ->> 'userDataId' as user_data_id
from public.user_data
where id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and id not like 'student_%'
order by display_name, id;

-- Detail rows for access records that still point to legacy IDs.
select
  access.auth_user_id,
  auth_users.email,
  access.user_data_id,
  access.role,
  access.scope_type,
  access.scope_value,
  access.created_at
from public.lesson_user_access access
left join auth.users auth_users on auth_users.id = access.auth_user_id
where access.user_data_id not in ('__admin__', '__teacher__', '__GLOBAL_SETTINGS__', 'Master_Debug')
  and access.user_data_id not like 'student_%'
order by access.created_at desc;
