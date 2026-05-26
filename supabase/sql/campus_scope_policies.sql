-- Campus/group access foundation for public D Lesson operation.
-- Run this after the existing RLS baseline. It keeps legacy group scopes working
-- and adds campus scopes for teachers and future campus-specific student setup.

alter table public.lesson_user_access
    add column if not exists scope_type text not null default 'all',
    add column if not exists scope_value text not null default '';

do $$
declare
    constraint_name text;
begin
    select con.conname
      into constraint_name
      from pg_constraint con
      join pg_class cls on cls.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = cls.relnamespace
     where nsp.nspname = 'public'
       and cls.relname = 'lesson_user_access'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%scope_type%'
     limit 1;

    if constraint_name is not null then
        execute format('alter table public.lesson_user_access drop constraint %I', constraint_name);
    end if;
end $$;

alter table public.lesson_user_access
    add constraint lesson_user_access_scope_type_check
    check (scope_type in ('all', 'campus', 'group', 'campus_group'));

create table if not exists public.lesson_campuses (
    id text primary key,
    name text not null,
    code text not null unique,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.lesson_campuses (id, name, code)
values ('main', '本校', 'main')
on conflict (id) do nothing;

alter table public.lesson_campuses enable row level security;

drop policy if exists "Lesson users can read campuses" on public.lesson_campuses;
drop policy if exists "Lesson admins can insert campuses" on public.lesson_campuses;
drop policy if exists "Lesson admins can update campuses" on public.lesson_campuses;
drop policy if exists "Lesson admins can delete campuses" on public.lesson_campuses;

create policy "Lesson users can read campuses"
on public.lesson_campuses
for select
to authenticated
using (has_lesson_access());

create policy "Lesson admins can insert campuses"
on public.lesson_campuses
for insert
to authenticated
with check (is_lesson_admin());

create policy "Lesson admins can update campuses"
on public.lesson_campuses
for update
to authenticated
using (is_lesson_admin())
with check (is_lesson_admin());

create policy "Lesson admins can delete campuses"
on public.lesson_campuses
for delete
to authenticated
using (is_lesson_admin());

create or replace function public.lesson_scope_value_matches(candidate text, scope_value text)
returns boolean
language sql
stable
as $$
    select coalesce(candidate, '') = any (
        select trim(value)
        from regexp_split_to_table(coalesce(scope_value, ''), ',') as value
        where trim(value) <> ''
    );
$$;

create or replace function public.lesson_access_matches_student(
    row_data jsonb,
    scope_type text,
    scope_value text
)
returns boolean
language sql
stable
as $$
    select case coalesce(scope_type, 'all')
        when 'all' then true
        when 'campus' then public.lesson_scope_value_matches(
            coalesce(row_data ->> 'campusId', row_data ->> 'campus', 'main'),
            scope_value
        )
        when 'group' then public.lesson_scope_value_matches(
            coalesce(row_data ->> 'group', ''),
            scope_value
        )
        when 'campus_group' then public.lesson_scope_value_matches(
            concat_ws(':',
                coalesce(row_data ->> 'campusId', row_data ->> 'campus', 'main'),
                coalesce(row_data ->> 'group', '')
            ),
            scope_value
        )
        else false
    end;
$$;

drop policy if exists "Teachers can read allowed user_data rows" on public.user_data;
drop policy if exists "Teachers can read allowed test_user_data rows" on public.test_user_data;

create policy "Teachers can read allowed user_data rows"
on public.user_data
for select
to authenticated
using (
    id <> '__GLOBAL_SETTINGS__'
    and exists (
        select 1
        from public.lesson_user_access access
        where access.auth_user_id = auth.uid()
          and access.role = 'teacher'
          and public.lesson_access_matches_student(user_data.data, access.scope_type, access.scope_value)
    )
);

create policy "Teachers can read allowed test_user_data rows"
on public.test_user_data
for select
to authenticated
using (
    id <> '__GLOBAL_SETTINGS__'
    and exists (
        select 1
        from public.lesson_user_access access
        where access.auth_user_id = auth.uid()
          and access.role = 'teacher'
          and public.lesson_access_matches_student(test_user_data.data, access.scope_type, access.scope_value)
    )
);
