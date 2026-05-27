-- Allow teachers to manage only the student rows inside their assigned scope.
-- Run after campus_scope_policies.sql.

grant select, insert, update, delete on public.user_data to authenticated;
grant select, insert, update, delete on public.test_user_data to authenticated;

drop policy if exists "Teachers can insert allowed user_data rows" on public.user_data;
drop policy if exists "Teachers can update allowed user_data rows" on public.user_data;
drop policy if exists "Teachers can delete allowed user_data rows" on public.user_data;

create policy "Teachers can insert allowed user_data rows"
on public.user_data
for insert
to authenticated
with check (
  id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.role = 'teacher'
      and public.lesson_access_matches_student(user_data.data, access.scope_type, access.scope_value)
  )
);

create policy "Teachers can update allowed user_data rows"
on public.user_data
for update
to authenticated
using (
  id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.role = 'teacher'
      and public.lesson_access_matches_student(user_data.data, access.scope_type, access.scope_value)
  )
)
with check (
  id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.role = 'teacher'
      and public.lesson_access_matches_student(user_data.data, access.scope_type, access.scope_value)
  )
);

create policy "Teachers can delete allowed user_data rows"
on public.user_data
for delete
to authenticated
using (
  id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.role = 'teacher'
      and public.lesson_access_matches_student(user_data.data, access.scope_type, access.scope_value)
  )
);

drop policy if exists "Teachers can insert allowed test_user_data rows" on public.test_user_data;
drop policy if exists "Teachers can update allowed test_user_data rows" on public.test_user_data;
drop policy if exists "Teachers can delete allowed test_user_data rows" on public.test_user_data;

create policy "Teachers can insert allowed test_user_data rows"
on public.test_user_data
for insert
to authenticated
with check (
  id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.role = 'teacher'
      and public.lesson_access_matches_student(test_user_data.data, access.scope_type, access.scope_value)
  )
);

create policy "Teachers can update allowed test_user_data rows"
on public.test_user_data
for update
to authenticated
using (
  id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.role = 'teacher'
      and public.lesson_access_matches_student(test_user_data.data, access.scope_type, access.scope_value)
  )
)
with check (
  id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.role = 'teacher'
      and public.lesson_access_matches_student(test_user_data.data, access.scope_type, access.scope_value)
  )
);

create policy "Teachers can delete allowed test_user_data rows"
on public.test_user_data
for delete
to authenticated
using (
  id not in ('__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__')
  and exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.role = 'teacher'
      and public.lesson_access_matches_student(test_user_data.data, access.scope_type, access.scope_value)
  )
);

select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_data', 'test_user_data')
  and policyname like 'Teachers can % allowed % rows'
order by tablename, policyname;
