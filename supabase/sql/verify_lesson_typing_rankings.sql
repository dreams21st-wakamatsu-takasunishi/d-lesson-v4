-- Read-only verification for the optional anonymous typing ranking table.
-- Run this in Supabase SQL Editor after supabase/sql/lesson_typing_rankings.sql.

-- Policy detail rows. This table is useful for review, but the final table below
-- is the OK/NG summary to judge whether the setup passed.
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'lesson_typing_rankings'
order by policyname;

with checks as (
  select
    'table_exists' as check_name,
    to_regclass('public.lesson_typing_rankings') is not null as ok,
    'public.lesson_typing_rankings exists' as detail

  union all
  select
    'rls_enabled',
    exists (
      select 1
      from pg_class class
      join pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = 'lesson_typing_rankings'
        and class.relrowsecurity = true
    ),
    'Row level security is enabled'

  union all
  select
    'primary_key',
    exists (
      select 1
      from pg_constraint constraint_info
      join pg_class class on class.oid = constraint_info.conrelid
      join pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = 'lesson_typing_rankings'
        and constraint_info.contype = 'p'
        and pg_get_constraintdef(constraint_info.oid) like '%PRIMARY KEY (mode, user_data_id)%'
    ),
    'Primary key is (mode, user_data_id)'

  union all
  select
    'authenticated_select_grant',
    case
      when to_regclass('public.lesson_typing_rankings') is not null
        and to_regrole('authenticated') is not null
      then has_table_privilege('authenticated', 'public.lesson_typing_rankings', 'SELECT')
      else false
    end,
    'authenticated can SELECT anonymous rankings'

  union all
  select
    'unique_user_mode_ranking',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'lesson_typing_rankings'
        and indexname = 'lesson_typing_rankings_mode_user_data_id_uidx'
        and indexdef like '%UNIQUE%'
    ) or exists (
      select 1
      from pg_constraint constraint_info
      join pg_class class on class.oid = constraint_info.conrelid
      join pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = 'lesson_typing_rankings'
        and constraint_info.contype in ('p', 'u')
        and pg_get_constraintdef(constraint_info.oid) like '%(mode, user_data_id)%'
    ),
    'Each user has one ranking row per mode'

  union all
  select
    'authenticated_insert_grant',
    case
      when to_regclass('public.lesson_typing_rankings') is not null
        and to_regrole('authenticated') is not null
      then has_table_privilege('authenticated', 'public.lesson_typing_rankings', 'INSERT')
      else false
    end,
    'authenticated can INSERT allowed ranking rows'

  union all
  select
    'authenticated_update_grant',
    case
      when to_regclass('public.lesson_typing_rankings') is not null
        and to_regrole('authenticated') is not null
      then has_table_privilege('authenticated', 'public.lesson_typing_rankings', 'UPDATE')
      else false
    end,
    'authenticated can UPDATE allowed ranking rows'

  union all
  select
    'no_anon_table_grants',
    case
      when to_regclass('public.lesson_typing_rankings') is null then false
      when to_regrole('anon') is null then true
      else (
        not has_table_privilege('anon', 'public.lesson_typing_rankings', 'SELECT')
        and not has_table_privilege('anon', 'public.lesson_typing_rankings', 'INSERT')
        and not has_table_privilege('anon', 'public.lesson_typing_rankings', 'UPDATE')
        and not has_table_privilege('anon', 'public.lesson_typing_rankings', 'DELETE')
      )
    end,
    'anon has no direct table access'

  union all
  select
    'read_policy',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'lesson_typing_rankings'
        and policyname = 'Lesson users can read anonymous typing rankings'
        and cmd = 'SELECT'
    ),
    'Read policy exists'

  union all
  select
    'insert_policy',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'lesson_typing_rankings'
        and policyname = 'Students can insert their own typing ranking'
        and cmd = 'INSERT'
    ),
    'Insert policy exists'

  union all
  select
    'insert_policy_safe_label',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'lesson_typing_rankings'
        and policyname = 'Students can insert their own typing ranking'
        and cmd = 'INSERT'
        and with_check like '%is_safe_typing_ranking_label%'
    ),
    'Insert policy blocks unsafe display labels'

  union all
  select
    'update_policy',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'lesson_typing_rankings'
        and policyname = 'Students can update their own typing ranking'
        and cmd = 'UPDATE'
    ),
    'Update policy exists'

  union all
  select
    'update_policy_safe_label',
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'lesson_typing_rankings'
        and policyname = 'Students can update their own typing ranking'
        and cmd = 'UPDATE'
        and with_check like '%is_safe_typing_ranking_label%'
    ),
    'Update policy blocks unsafe display labels'

  union all
  select
    'helper_functions',
    to_regprocedure('public.has_lesson_access()') is not null
      and to_regprocedure('public.can_write_lesson_typing_ranking(text)') is not null
      and to_regprocedure('public.is_safe_typing_ranking_label(text, text)') is not null
      and to_regprocedure('public.keep_lesson_typing_ranking_highscore()') is not null
      and to_regprocedure('public.set_lesson_typing_rankings_updated_at()') is not null,
    'Required helper functions exist'

  union all
  select
    'safe_label_constraint',
    exists (
      select 1
      from pg_constraint constraint_info
      join pg_class class on class.oid = constraint_info.conrelid
      join pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = 'lesson_typing_rankings'
        and constraint_info.conname = 'lesson_typing_rankings_safe_display_label'
    ),
    'Display label safety constraint exists'

  union all
  select
    'highscore_trigger',
    exists (
      select 1
      from pg_trigger trigger_info
      join pg_class class on class.oid = trigger_info.tgrelid
      join pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = 'lesson_typing_rankings'
        and trigger_info.tgname = 'keep_lesson_typing_ranking_highscore'
        and not trigger_info.tgisinternal
    ),
    'lower scores cannot overwrite a high score'

  union all
  select
    'updated_at_trigger',
    exists (
      select 1
      from pg_trigger trigger_info
      join pg_class class on class.oid = trigger_info.tgrelid
      join pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = 'lesson_typing_rankings'
        and trigger_info.tgname = 'set_lesson_typing_rankings_updated_at'
        and not trigger_info.tgisinternal
    ),
    'updated_at trigger exists'
)
select
  check_name,
  case when ok then 'OK' else 'NG' end as result,
  detail
from checks
order by check_name;
