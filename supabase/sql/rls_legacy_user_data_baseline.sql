-- Security baseline for the current legacy user_data table.
-- Do not run this until Supabase Auth users and lesson_user_access rows exist.
-- With RLS enabled and no matching access row, browser clients cannot read/write rows.

create table if not exists public.lesson_user_access (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  user_data_id text not null,
  role text not null check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  primary key (auth_user_id, user_data_id)
);

alter table public.lesson_user_access enable row level security;

drop policy if exists "Users can read their own lesson access" on public.lesson_user_access;
create policy "Users can read their own lesson access"
on public.lesson_user_access
for select
to authenticated
using ((select auth.uid()) = auth_user_id);

alter table public.user_data enable row level security;
alter table public.test_user_data enable row level security;

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
        or access.user_data_id = user_data.id
        or (access.role = 'teacher' and user_data.id <> '__GLOBAL_SETTINGS__')
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
        or access.user_data_id = user_data.id
        or (access.role = 'teacher' and user_data.id <> '__GLOBAL_SETTINGS__')
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
        or access.user_data_id = user_data.id
        or (access.role = 'teacher' and user_data.id <> '__GLOBAL_SETTINGS__')
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
        or access.user_data_id = user_data.id
        or (access.role = 'teacher' and user_data.id <> '__GLOBAL_SETTINGS__')
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
        or access.user_data_id = test_user_data.id
        or (access.role = 'teacher' and test_user_data.id <> '__GLOBAL_SETTINGS__')
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
        or access.user_data_id = test_user_data.id
        or (access.role = 'teacher' and test_user_data.id <> '__GLOBAL_SETTINGS__')
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
        or access.user_data_id = test_user_data.id
        or (access.role = 'teacher' and test_user_data.id <> '__GLOBAL_SETTINGS__')
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
        or access.user_data_id = test_user_data.id
        or (access.role = 'teacher' and test_user_data.id <> '__GLOBAL_SETTINGS__')
      )
  )
);
