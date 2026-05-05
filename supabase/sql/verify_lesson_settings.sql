-- lesson_settings verification template.
-- This is read-only. It does not change lesson_settings, user_data, or test_user_data.

-- 1. List settings rows.
select
  key,
  data ? 'ticketConfig' as has_ticket_config,
  data ? 'textTasks' as has_text_tasks,
  data #> '{globalMistakes,customThemes}' is not null as has_custom_themes,
  data #> '{globalMistakes,customEffects}' is not null as has_custom_effects,
  created_at,
  updated_at
from public.lesson_settings
order by key;

-- 2. Compare table-specific lesson_settings rows with legacy __GLOBAL_SETTINGS__ rows.
with legacy_settings as (
  select 'test_user_data:global' as key, data
  from public.test_user_data
  where id = '__GLOBAL_SETTINGS__'
  union all
  select 'user_data:global' as key, data
  from public.user_data
  where id = '__GLOBAL_SETTINGS__'
),
settings_rows as (
  select key, data
  from public.lesson_settings
  where key in ('test_user_data:global', 'user_data:global')
)
select
  legacy_settings.key,
  settings_rows.key is not null as has_lesson_settings_row,
  legacy_settings.data = settings_rows.data as same_as_legacy_row,
  md5(legacy_settings.data::text) as legacy_hash,
  md5(settings_rows.data::text) as settings_hash
from legacy_settings
left join settings_rows on settings_rows.key = legacy_settings.key
order by legacy_settings.key;

-- 3. Confirm lesson_settings RLS and policies.
select
  namespace.nspname as table_schema,
  class.relname as table_name,
  class.relrowsecurity as rls_enabled,
  class.relforcerowsecurity as rls_forced
from pg_class class
join pg_namespace namespace on namespace.oid = class.relnamespace
where namespace.nspname = 'public'
  and class.relname = 'lesson_settings';

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'lesson_settings'
order by policyname;

-- 4. Optional: simulate registered/unregistered Auth users.
-- Uncomment these blocks and replace REGISTERED_AUTH_USER_ID_HERE before running.
-- If SQL Editor still returns rows for an unregistered UUID, treat SQL Editor
-- simulation as bypassed and verify in the browser instead.

-- Registered user. Expected: lesson_settings rows are visible.
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', 'REGISTERED_AUTH_USER_ID_HERE', true);
-- select set_config('request.jwt.claims', '{"sub":"REGISTERED_AUTH_USER_ID_HERE","role":"authenticated"}', true);
--
-- select key, data
-- from public.lesson_settings
-- order by key;
-- rollback;

-- Unregistered user. Expected: no rows.
-- begin;
-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
-- select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
--
-- select key, data
-- from public.lesson_settings
-- order by key;
-- rollback;
