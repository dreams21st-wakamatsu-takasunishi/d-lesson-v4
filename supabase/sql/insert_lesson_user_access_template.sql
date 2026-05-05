-- Insert lesson_user_access rows.
-- Replace the *_AUTH_USER_ID_HERE placeholders with real IDs from auth.users.
-- Do not insert 00000000-0000-0000-0000-000000000000 here.

-- Check the real Auth User IDs first.
select id, email, created_at
from auth.users
order by created_at desc;

-- Register admin, teacher, and student access.
-- For students, use the row ID in user_data/test_user_data.
-- New rows created by the app look like student_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.
-- Teacher rows are broad by default. To limit a teacher by group, run
-- teacher_group_scope_policies.sql first, then update scope_type/scope_value.
insert into public.lesson_user_access (auth_user_id, user_data_id, role)
values
  ('ADMIN_AUTH_USER_ID_HERE', '__admin__', 'admin'),
  ('TEACHER_AUTH_USER_ID_HERE', '__teacher__', 'teacher'),
  ('STUDENT_AUTH_USER_ID_HERE', 'student_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'student')
on conflict (auth_user_id, user_data_id) do update
set role = excluded.role;

-- Optional: limit a teacher to one or more groups.
-- update public.lesson_user_access
-- set scope_type = 'group',
--     scope_value = 'group1,group2'
-- where auth_user_id = 'TEACHER_AUTH_USER_ID_HERE'
--   and user_data_id = '__teacher__'
--   and role = 'teacher';

-- Confirm access rows.
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
order by access.created_at desc;

-- After the first admin row exists, run admin_lesson_user_access_policies.sql
-- if you want to manage these links from the app's admin screen.
