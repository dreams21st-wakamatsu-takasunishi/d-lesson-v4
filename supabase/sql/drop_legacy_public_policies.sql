-- Remove legacy public policies that make RLS allow every browser client.
-- Run this once after confirming lesson_user_access rows exist.

alter table public.user_data enable row level security;
alter table public.test_user_data enable row level security;

drop policy if exists "Allow public read" on public.user_data;
drop policy if exists "Allow public insert" on public.user_data;
drop policy if exists "Allow public update" on public.user_data;
drop policy if exists "Allow public delete" on public.user_data;

drop policy if exists "Allow public read test" on public.test_user_data;
drop policy if exists "Allow public insert test" on public.test_user_data;
drop policy if exists "Allow public update test" on public.test_user_data;
drop policy if exists "Allow public delete test" on public.test_user_data;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_data', 'test_user_data')
order by tablename, policyname;
