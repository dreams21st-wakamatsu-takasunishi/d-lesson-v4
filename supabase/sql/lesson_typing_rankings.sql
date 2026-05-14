-- Optional anonymous typing-game ranking table.
-- This table stores only game mode, internal user_data_id, anonymous display label,
-- score, and timestamp. It does not store student names.

create table if not exists public.lesson_typing_rankings (
  mode text not null check (mode in ('meteor', 'd_challenge')),
  user_data_id text not null,
  display_label text not null default '',
  score integer not null default 0 check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (mode, user_data_id)
);

alter table public.lesson_typing_rankings enable row level security;

grant select, insert, update on public.lesson_typing_rankings to authenticated;

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

create or replace function public.can_write_lesson_typing_ranking(target_user_data_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_lesson_admin()
    or exists (
      select 1
      from public.lesson_user_access access
      where access.auth_user_id = (select auth.uid())
        and access.user_data_id = target_user_data_id
        and access.role = 'student'
    );
$$;

revoke all on function public.can_write_lesson_typing_ranking(text) from public;
grant execute on function public.can_write_lesson_typing_ranking(text) to authenticated;

create or replace function public.set_lesson_typing_rankings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_lesson_typing_rankings_updated_at on public.lesson_typing_rankings;
create trigger set_lesson_typing_rankings_updated_at
before update on public.lesson_typing_rankings
for each row
execute function public.set_lesson_typing_rankings_updated_at();

drop policy if exists "Lesson users can read anonymous typing rankings" on public.lesson_typing_rankings;
create policy "Lesson users can read anonymous typing rankings"
on public.lesson_typing_rankings
for select
to authenticated
using (public.has_lesson_access());

drop policy if exists "Students can insert their own typing ranking" on public.lesson_typing_rankings;
create policy "Students can insert their own typing ranking"
on public.lesson_typing_rankings
for insert
to authenticated
with check (public.can_write_lesson_typing_ranking(user_data_id));

drop policy if exists "Students can update their own typing ranking" on public.lesson_typing_rankings;
create policy "Students can update their own typing ranking"
on public.lesson_typing_rankings
for update
to authenticated
using (public.can_write_lesson_typing_ranking(user_data_id))
with check (public.can_write_lesson_typing_ranking(user_data_id));

select mode, display_label, score, updated_at
from public.lesson_typing_rankings
order by mode, score desc, updated_at asc;
