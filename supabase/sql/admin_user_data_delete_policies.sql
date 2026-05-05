-- Allow lesson admins to delete student rows from user_data/test_user_data.
-- Required for admin-screen deletion and backup restore pruning.
-- Run after rls_legacy_user_data_baseline.sql and admin_lesson_user_access_policies.sql.

grant select, insert, update, delete on public.user_data to authenticated;
grant select, insert, update, delete on public.test_user_data to authenticated;

drop policy if exists "Lesson admins can delete user_data rows" on public.user_data;
create policy "Lesson admins can delete user_data rows"
on public.user_data
for delete
to authenticated
using (
  public.is_lesson_admin()
  and user_data.id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
);

drop policy if exists "Lesson admins can delete test_user_data rows" on public.test_user_data;
create policy "Lesson admins can delete test_user_data rows"
on public.test_user_data
for delete
to authenticated
using (
  public.is_lesson_admin()
  and test_user_data.id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
);

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in ('user_data', 'test_user_data')
  and cmd = 'DELETE'
order by tablename, policyname;
