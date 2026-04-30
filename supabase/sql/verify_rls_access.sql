-- RLS access verification template.
-- Replace the UUID placeholders before running.
-- Run each block separately in Supabase SQL Editor.
-- The browser test is still the final source of truth; this file is a quick policy sanity check.

-- 1. Confirm access mapping rows.
select
  access.auth_user_id,
  auth_users.email,
  access.user_data_id,
  access.role,
  access.created_at
from public.lesson_user_access access
left join auth.users auth_users on auth_users.id = access.auth_user_id
order by access.created_at desc;

-- 1.5. Confirm RLS metadata.
-- Expected: rls_enabled = true for test_user_data.
select
  namespace.nspname as table_schema,
  class.relname as table_name,
  class.relrowsecurity as rls_enabled,
  class.relforcerowsecurity as rls_forced
from pg_class class
join pg_namespace namespace on namespace.oid = class.relnamespace
where namespace.nspname = 'public'
  and class.relname in ('test_user_data', 'user_data', 'lesson_user_access')
order by class.relname;

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
  and tablename in ('test_user_data', 'user_data', 'lesson_user_access')
order by tablename, policyname;

-- 1.6. Check whether this SQL Editor session actually switched role/JWT.
-- If current_user remains postgres, the data-select blocks below may bypass RLS.
begin;
set local role authenticated;
select
  current_user,
  current_role,
  current_setting('role', true) as configured_role,
  auth.uid() as auth_uid_before_claim;
rollback;

-- 2. Simulate the student account.
-- Expected: only the student's row, plus __GLOBAL_SETTINGS__ when it exists.
-- Important: If the unregistered UUID block still returns rows, treat SQL Editor simulation as bypassed
-- and use browser login verification as the final check.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'STUDENT_AUTH_USER_ID_HERE', true);
select set_config('request.jwt.claims', '{"sub":"STUDENT_AUTH_USER_ID_HERE","role":"authenticated"}', true);

select id, data
from public.test_user_data
order by id;
rollback;

-- 3. Simulate the teacher account.
-- Expected: rows allowed by the current teacher policy.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'TEACHER_AUTH_USER_ID_HERE', true);
select set_config('request.jwt.claims', '{"sub":"TEACHER_AUTH_USER_ID_HERE","role":"authenticated"}', true);

select id, data
from public.test_user_data
order by id;
rollback;

-- 4. Simulate the admin account.
-- Expected: all test_user_data rows.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ADMIN_AUTH_USER_ID_HERE', true);
select set_config('request.jwt.claims', '{"sub":"ADMIN_AUTH_USER_ID_HERE","role":"authenticated"}', true);

select id, data
from public.test_user_data
order by id;
rollback;

-- 5. Simulate an authenticated user with no lesson_user_access row.
-- Expected: no rows.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);

select id, data
from public.test_user_data
order by id;
rollback;
