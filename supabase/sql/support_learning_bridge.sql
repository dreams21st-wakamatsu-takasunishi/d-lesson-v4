begin;
create table if not exists public.lesson_support_scopes (
  support_project_ref text not null check (support_project_ref ~ '^[a-z0-9]{20}$'),
  organization_id uuid not null,
  data_table text not null check (data_table in ('user_data', 'test_user_data')),
  campus_id text not null check (length(campus_id) between 1 and 80 and campus_id <> 'public'),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (support_project_ref, organization_id, data_table, campus_id)
);
alter table public.lesson_support_scopes enable row level security;
revoke all on public.lesson_support_scopes from public, anon, authenticated;
grant all on public.lesson_support_scopes to service_role;
create table if not exists public.lesson_support_students (
  support_project_ref text not null,
  organization_id uuid not null,
  data_table text not null,
  campus_id text not null,
  student_id text not null check (student_id ~ '^student_[A-Za-z0-9_-]{1,140}$'),
  enabled boolean not null default false,
  verified_at timestamptz not null default now(),
  primary key (support_project_ref, organization_id, data_table, student_id),
  foreign key (support_project_ref, organization_id, data_table, campus_id)
    references public.lesson_support_scopes(support_project_ref, organization_id, data_table, campus_id)
    on delete cascade
);
alter table public.lesson_support_students enable row level security;
revoke all on public.lesson_support_students from public, anon, authenticated;
grant all on public.lesson_support_students to service_role;
-- No default authorization. An operator must explicitly approve organization/campus pairs.
commit;
