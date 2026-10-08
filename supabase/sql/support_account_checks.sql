begin;
create table if not exists public.lesson_support_account_checks (
  id uuid primary key default gen_random_uuid(), support_project_ref text not null,
  organization_id uuid not null, data_table text not null check(data_table in('user_data','test_user_data')),
  student_id text not null, child_id text not null, link_id uuid not null, actor_id uuid not null,
  action text not null check(action in('inspect','verify-card')),
  outcome text not null default 'started' check(outcome in('started','checked','verified','denied','failed')),
  at timestamptz not null default now(), finished_at timestamptz
);
create index if not exists lesson_support_account_checks_rate on public.lesson_support_account_checks(support_project_ref,organization_id,actor_id,at);
alter table public.lesson_support_account_checks enable row level security;
revoke all on public.lesson_support_account_checks from public,anon,authenticated;
grant all on public.lesson_support_account_checks to service_role;

create or replace function public.begin_support_account_check(
  p_project text,p_org uuid,p_table text,p_student text,p_child text,p_link uuid,p_actor uuid,p_action text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if p_action not in('inspect','verify-card') or p_actor is null then raise exception '操作を確認してください。' using errcode='22023'; end if;
  perform 1 from public.lesson_support_students p join public.lesson_support_scopes s
    using(support_project_ref,organization_id,data_table,campus_id)
    where p.support_project_ref=p_project and p.organization_id=p_org and p.data_table=p_table and p.student_id=p_student
      and p.support_child_id=p_child and p.support_link_id=p_link and p.enabled and s.enabled for share of p,s;
  if not found then raise exception '有効な児童連携がありません。' using errcode='42501'; end if;
  if p_action='verify-card' then
    perform pg_advisory_xact_lock(hashtextextended(p_project||p_org::text||p_actor::text,0));
    if (select count(*) from public.lesson_support_account_checks where support_project_ref=p_project and organization_id=p_org
        and actor_id=p_actor and action='verify-card' and at>now()-interval '15 minutes')>=20
      or (select count(*) from public.lesson_support_account_checks where support_project_ref=p_project and organization_id=p_org
        and student_id=p_student and action='verify-card' and at>now()-interval '15 minutes')>=5 then
      raise exception '確認回数が上限に達しました。15分ほど空けてください。' using errcode='PT429';
    end if;
  end if;
  insert into public.lesson_support_account_checks(support_project_ref,organization_id,data_table,student_id,child_id,link_id,actor_id,action)
    values(p_project,p_org,p_table,p_student,p_child,p_link,p_actor,p_action) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.begin_support_account_check(text,uuid,text,text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_support_account_check(text,uuid,text,text,text,uuid,uuid,text) to service_role;
commit;
