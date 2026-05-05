-- Allow lesson admins to manage Auth-to-user-data links from the browser.
-- Run rls_legacy_user_data_baseline.sql and bootstrap one admin row first.

grant select, insert, update, delete on public.lesson_user_access to authenticated;

create or replace function public.is_lesson_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.role = 'admin'
  );
$$;

revoke all on function public.is_lesson_admin() from public;
grant execute on function public.is_lesson_admin() to authenticated;

drop policy if exists "Lesson admins can read all lesson access" on public.lesson_user_access;
create policy "Lesson admins can read all lesson access"
on public.lesson_user_access
for select
to authenticated
using (public.is_lesson_admin());

drop policy if exists "Lesson admins can insert lesson access" on public.lesson_user_access;
create policy "Lesson admins can insert lesson access"
on public.lesson_user_access
for insert
to authenticated
with check (public.is_lesson_admin());

drop policy if exists "Lesson admins can update lesson access" on public.lesson_user_access;
create policy "Lesson admins can update lesson access"
on public.lesson_user_access
for update
to authenticated
using (public.is_lesson_admin())
with check (public.is_lesson_admin());

drop policy if exists "Lesson admins can delete lesson access" on public.lesson_user_access;
create policy "Lesson admins can delete lesson access"
on public.lesson_user_access
for delete
to authenticated
using (public.is_lesson_admin());

select auth_user_id, user_data_id, role, scope_type, scope_value, created_at
from public.lesson_user_access
order by created_at desc;
