-- Insert lesson_user_access rows.
-- Replace the *_AUTH_USER_ID_HERE placeholders with real IDs from auth.users.
-- Do not insert 00000000-0000-0000-0000-000000000000 here.

-- Check the real Auth User IDs first.
select id, email, created_at
from auth.users
order by created_at desc;

-- Register admin, teacher, and student access.
insert into public.lesson_user_access (auth_user_id, user_data_id, role)
values
  ('ADMIN_AUTH_USER_ID_HERE', '__admin__', 'admin'),
  ('TEACHER_AUTH_USER_ID_HERE', '__teacher__', 'teacher'),
  ('STUDENT_AUTH_USER_ID_HERE', 'テスト太郎', 'student')
on conflict (auth_user_id, user_data_id) do update
set role = excluded.role;

-- Confirm access rows.
select
  access.auth_user_id,
  auth_users.email,
  access.user_data_id,
  access.role,
  access.created_at
from public.lesson_user_access access
left join auth.users auth_users on auth_users.id = access.auth_user_id
order by access.created_at desc;

