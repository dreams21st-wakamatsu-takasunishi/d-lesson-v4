-- Add optional group-based access scopes for teacher accounts.
-- Existing teacher rows stay broad because scope_type defaults to 'all'.
-- Teacher rows are read-only. Student progress writes are limited to admins or the student account itself.

alter table public.lesson_user_access
  add column if not exists scope_type text not null default 'all';

alter table public.lesson_user_access
  add column if not exists scope_value text not null default '';

alter table public.lesson_user_access
  drop constraint if exists lesson_user_access_scope_type_check;

alter table public.lesson_user_access
  add constraint lesson_user_access_scope_type_check
  check (scope_type in ('all', 'group'));

update public.lesson_user_access
set scope_type = 'all'
where scope_type is null or scope_type = '';

update public.lesson_user_access
set scope_value = ''
where scope_value is null;

create or replace function public.lesson_access_matches_group(
  row_group text,
  scope_type text,
  scope_value text
)
returns boolean
language sql
immutable
as $$
  select coalesce(scope_type, 'all') = 'all'
    or (
      scope_type = 'group'
      and coalesce(row_group, '') <> ''
      and coalesce(row_group, '') = any(regexp_split_to_array(coalesce(scope_value, ''), '\s*,\s*'))
    );
$$;

revoke all on function public.lesson_access_matches_group(text, text, text) from public;
grant execute on function public.lesson_access_matches_group(text, text, text) to authenticated;

drop policy if exists "Authenticated users can read allowed user_data rows" on public.user_data;
create policy "Authenticated users can read allowed user_data rows"
on public.user_data
for select
to authenticated
using (
  exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and (
        access.role = 'admin'
        or (
          access.role = 'student'
          and access.user_data_id = user_data.id
        )
        or (
          access.role = 'teacher'
          and user_data.id <> '__GLOBAL_SETTINGS__'
          and public.lesson_access_matches_group(user_data.data ->> 'group', access.scope_type, access.scope_value)
        )
        or (user_data.id = '__GLOBAL_SETTINGS__')
      )
  )
);

drop policy if exists "Authenticated users can update allowed user_data rows" on public.user_data;
create policy "Authenticated users can update allowed user_data rows"
on public.user_data
for update
to authenticated
using (
  exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and (
        access.role = 'admin'
        or (
          access.role = 'student'
          and access.user_data_id = user_data.id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and (
        access.role = 'admin'
        or (
          access.role = 'student'
          and access.user_data_id = user_data.id
        )
      )
  )
);

drop policy if exists "Authenticated users can insert allowed user_data rows" on public.user_data;
create policy "Authenticated users can insert allowed user_data rows"
on public.user_data
for insert
to authenticated
with check (
  exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and (
        access.role = 'admin'
        or (
          access.role = 'student'
          and access.user_data_id = user_data.id
        )
      )
  )
);

drop policy if exists "Authenticated users can read allowed test_user_data rows" on public.test_user_data;
create policy "Authenticated users can read allowed test_user_data rows"
on public.test_user_data
for select
to authenticated
using (
  exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and (
        access.role = 'admin'
        or (
          access.role = 'student'
          and access.user_data_id = test_user_data.id
        )
        or (
          access.role = 'teacher'
          and test_user_data.id <> '__GLOBAL_SETTINGS__'
          and public.lesson_access_matches_group(test_user_data.data ->> 'group', access.scope_type, access.scope_value)
        )
        or (test_user_data.id = '__GLOBAL_SETTINGS__')
      )
  )
);

drop policy if exists "Authenticated users can update allowed test_user_data rows" on public.test_user_data;
create policy "Authenticated users can update allowed test_user_data rows"
on public.test_user_data
for update
to authenticated
using (
  exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and (
        access.role = 'admin'
        or (
          access.role = 'student'
          and access.user_data_id = test_user_data.id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and (
        access.role = 'admin'
        or (
          access.role = 'student'
          and access.user_data_id = test_user_data.id
        )
      )
  )
);

drop policy if exists "Authenticated users can insert allowed test_user_data rows" on public.test_user_data;
create policy "Authenticated users can insert allowed test_user_data rows"
on public.test_user_data
for insert
to authenticated
with check (
  exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
      and (
        access.role = 'admin'
        or (
          access.role = 'student'
          and access.user_data_id = test_user_data.id
        )
      )
  )
);

select auth_user_id, user_data_id, role, scope_type, scope_value, created_at
from public.lesson_user_access
order by created_at desc;
