-- Optional settings table for global D Lesson settings.
-- This separates app-wide settings from student rows while keeping the legacy
-- __GLOBAL_SETTINGS__ row as a fallback during migration.

create table if not exists public.lesson_settings (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lesson_settings enable row level security;

grant select, insert, update, delete on public.lesson_settings to authenticated;

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

create or replace function public.has_lesson_access()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lesson_user_access access
    where access.auth_user_id = (select auth.uid())
  );
$$;

revoke all on function public.has_lesson_access() from public;
grant execute on function public.has_lesson_access() to authenticated;

create or replace function public.set_lesson_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_lesson_settings_updated_at on public.lesson_settings;
create trigger set_lesson_settings_updated_at
before update on public.lesson_settings
for each row
execute function public.set_lesson_settings_updated_at();

drop policy if exists "Lesson users can read settings" on public.lesson_settings;
create policy "Lesson users can read settings"
on public.lesson_settings
for select
to authenticated
using (public.has_lesson_access());

drop policy if exists "Lesson admins can insert settings" on public.lesson_settings;
create policy "Lesson admins can insert settings"
on public.lesson_settings
for insert
to authenticated
with check (public.is_lesson_admin());

drop policy if exists "Lesson admins can update settings" on public.lesson_settings;
create policy "Lesson admins can update settings"
on public.lesson_settings
for update
to authenticated
using (public.is_lesson_admin())
with check (public.is_lesson_admin());

drop policy if exists "Lesson admins can delete settings" on public.lesson_settings;
create policy "Lesson admins can delete settings"
on public.lesson_settings
for delete
to authenticated
using (public.is_lesson_admin());

-- Copy legacy settings rows into table-specific settings keys.
-- The app reads key = '<current user table>:global', for example:
--   test_user_data:global
--   user_data:global
insert into public.lesson_settings (key, data)
select 'test_user_data:global', data
from public.test_user_data
where id = '__GLOBAL_SETTINGS__'
on conflict (key) do update
set data = excluded.data,
    updated_at = now();

insert into public.lesson_settings (key, data)
select 'user_data:global', data
from public.user_data
where id = '__GLOBAL_SETTINGS__'
on conflict (key) do update
set data = excluded.data,
    updated_at = now();

select key, data, created_at, updated_at
from public.lesson_settings
order by key;
