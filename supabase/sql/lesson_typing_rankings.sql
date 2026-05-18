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

delete from public.lesson_typing_rankings
where mode not in ('meteor', 'd_challenge')
   or user_data_id is null
   or user_data_id = '';

with ranked as (
  select
    ctid,
    row_number() over (
      partition by mode, user_data_id
      order by score desc, updated_at asc
    ) as row_number
  from public.lesson_typing_rankings
)
delete from public.lesson_typing_rankings rankings
using ranked
where rankings.ctid = ranked.ctid
  and ranked.row_number > 1;

update public.lesson_typing_rankings
set
  display_label = coalesce(display_label, ''),
  score = coalesce(score, 0),
  updated_at = coalesce(updated_at, now())
where display_label is null
   or score is null
   or updated_at is null;

alter table public.lesson_typing_rankings
alter column mode set not null,
alter column user_data_id set not null,
alter column display_label set not null,
alter column score set not null,
alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_info
    join pg_class class on class.oid = constraint_info.conrelid
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = 'lesson_typing_rankings'
      and constraint_info.contype = 'p'
  ) then
    alter table public.lesson_typing_rankings
    add constraint lesson_typing_rankings_pkey primary key (mode, user_data_id);
  end if;
end $$;

create unique index if not exists lesson_typing_rankings_mode_user_data_id_uidx
on public.lesson_typing_rankings (mode, user_data_id);

alter table public.lesson_typing_rankings enable row level security;

revoke all on public.lesson_typing_rankings from public;
revoke all on public.lesson_typing_rankings from anon;
grant select, insert, update on public.lesson_typing_rankings to authenticated;

create or replace function public.is_safe_typing_ranking_label(label text, target_user_data_id text)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select
      btrim(coalesce(label, '')) as clean_label,
      regexp_replace(lower(coalesce(label, '')), '[[:space:]　]+', '', 'g') as compact_label,
      regexp_replace(lower(coalesce(target_user_data_id, '')), '[[:space:]　]+', '', 'g') as compact_user_id
  )
  select
    clean_label = ''
    or (
      char_length(clean_label) between 1 and 10
      and clean_label !~* '(https?://|www\.|@|[0-9０-９]{4,})'
      and compact_label !~* '(ばか|バカ|あほ|アホ|死ね|しね|ころす|殺す|きもい|うざい|くそ|クソ|fuck|shit|admin|teacher|先生|管理者|学校|小学校|中学校)'
      and (
        compact_label ~ '^児童[0-9]{3}$'
        or not (
          compact_user_id <> ''
          and char_length(compact_label) >= 2
          and position(compact_label in compact_user_id) > 0
        )
      )
    )
  from normalized;
$$;

revoke all on function public.is_safe_typing_ranking_label(text, text) from public;
grant execute on function public.is_safe_typing_ranking_label(text, text) to authenticated;

alter table public.lesson_typing_rankings
drop constraint if exists lesson_typing_rankings_safe_display_label;

alter table public.lesson_typing_rankings
add constraint lesson_typing_rankings_safe_display_label
check (public.is_safe_typing_ranking_label(display_label, user_data_id)) not valid;

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

create or replace function public.keep_lesson_typing_ranking_highscore()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.score < old.score then
    new.score = old.score;
  end if;
  return new;
end;
$$;

revoke all on function public.keep_lesson_typing_ranking_highscore() from public;

drop trigger if exists keep_lesson_typing_ranking_highscore on public.lesson_typing_rankings;
create trigger keep_lesson_typing_ranking_highscore
before update on public.lesson_typing_rankings
for each row
execute function public.keep_lesson_typing_ranking_highscore();

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
with check (
  public.can_write_lesson_typing_ranking(user_data_id)
  and public.is_safe_typing_ranking_label(display_label, user_data_id)
);

drop policy if exists "Students can update their own typing ranking" on public.lesson_typing_rankings;
create policy "Students can update their own typing ranking"
on public.lesson_typing_rankings
for update
to authenticated
using (public.can_write_lesson_typing_ranking(user_data_id))
with check (
  public.can_write_lesson_typing_ranking(user_data_id)
  and public.is_safe_typing_ranking_label(display_label, user_data_id)
);

select mode, display_label, score, updated_at
from public.lesson_typing_rankings
order by mode, score desc, updated_at asc;
