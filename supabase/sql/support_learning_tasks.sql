create table if not exists public.lesson_learning_tasks (
 id uuid primary key, support_project_ref text not null, organization_id uuid not null,
 data_table text not null check(data_table in('user_data','test_user_data')),
 student_id text not null, link_id uuid not null, child_id text not null,
 category text not null check(category in('mouse','keyboard','text','word','vision','minigame')),
 title text not null check(length(btrim(title)) between 1 and 80),
 instructions text not null default '' check(length(instructions)<=500),
 starts_on date not null, ends_on date not null check(ends_on>=starts_on and ends_on-starts_on<=90),
 active boolean not null default true, revision integer not null default 1 check(revision>0),
 updated_by uuid not null, updated_by_name text not null check(length(updated_by_name)<=100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(support_project_ref,organization_id,data_table,student_id)
  references public.lesson_support_students(support_project_ref,organization_id,data_table,student_id) on delete cascade
);
create index if not exists lesson_learning_tasks_student on public.lesson_learning_tasks(data_table,student_id,active,starts_on);
create table if not exists public.lesson_learning_task_audit (
 id bigint generated always as identity primary key, task_id uuid not null references public.lesson_learning_tasks(id) on delete cascade,
 support_project_ref text not null, organization_id uuid not null, actor_id uuid not null,
 snapshot jsonb not null, created_at timestamptz not null default now()
);
alter table public.lesson_learning_tasks enable row level security;
alter table public.lesson_learning_task_audit enable row level security;
revoke all on public.lesson_learning_tasks,public.lesson_learning_task_audit from anon,authenticated;
grant all on public.lesson_learning_tasks,public.lesson_learning_task_audit to service_role;
grant usage,select on sequence public.lesson_learning_task_audit_id_seq to service_role;

create or replace function public.save_support_learning_task(
 p_project text,p_org uuid,p_table text,p_student text,p_link uuid,p_child text,
 p_id uuid,p_revision integer,p_category text,p_title text,p_instructions text,
 p_start date,p_end date,p_active boolean,p_actor uuid,p_name text
) returns public.lesson_learning_tasks language plpgsql security definer set search_path=public as $$
declare permission public.lesson_support_students%rowtype; existing public.lesson_learning_tasks%rowtype; saved public.lesson_learning_tasks%rowtype; learner jsonb;
begin
 select * into permission from public.lesson_support_students where support_project_ref=p_project and organization_id=p_org
  and data_table=p_table and student_id=p_student for update;
 if not found or not permission.enabled or permission.support_link_id is distinct from p_link or permission.support_child_id is distinct from p_child
  or not exists(select 1 from public.lesson_support_scopes where support_project_ref=p_project and organization_id=p_org and data_table=p_table and campus_id=permission.campus_id and enabled) then
  raise exception '児童の連携許可を確認してください。' using errcode='42501';
 end if;
 if p_table not in('user_data','test_user_data') then raise exception '保存先を確認してください。' using errcode='22023'; end if;
 execute format('select data from public.%I where id=$1',p_table) into learner using p_student;
 if learner is null or coalesce(learner->>'campusId',learner->>'campus','main')<>permission.campus_id
  or coalesce(learner->>'publicRegistration','false')='true' or coalesce(learner->>'isGuest','false')='true'
  or coalesce(learner->>'isMaster','false')='true' or learner->>'registrationSource'='public'
  or learner->>'accountType' in('public','guest') or permission.campus_id='public' then
  raise exception '教室の学習アカウントを確認してください。' using errcode='42501';
 end if;
 if p_actor is null or p_name is null or length(p_name)>100 or p_id is null or p_revision is null or p_revision<0
  or p_category is null or p_category not in('mouse','keyboard','text','word','vision','minigame')
  or p_title is null or length(btrim(p_title)) not between 1 and 80 or p_instructions is null or length(p_instructions)>500
  or p_start is null or p_end is null or p_end<p_start or p_end-p_start>90 or p_active is null then
  raise exception '課題の分野・内容・期間を確認してください。' using errcode='22023';
 end if;
 select * into existing from public.lesson_learning_tasks where id=p_id for update;
 if found then
  if existing.support_project_ref<>p_project or existing.organization_id<>p_org or existing.data_table<>p_table or existing.student_id<>p_student
   or existing.link_id<>p_link or existing.child_id<>p_child then raise exception '本人の課題を選択してください。' using errcode='42501'; end if;
  if existing.revision<>p_revision then
   if existing.revision=p_revision+1 and existing.category=p_category and existing.title=btrim(p_title) and existing.instructions=p_instructions
    and existing.starts_on=p_start and existing.ends_on=p_end and existing.active=p_active and existing.updated_by=p_actor then return existing; end if;
   raise exception '別の職員が更新しました。再取得してください。' using errcode='PT409';
  end if;
 elsif p_revision<>0 then raise exception '課題を再取得してください。' using errcode='PT409';
 end if;
 if p_active and (existing.id is null or not existing.active) and
  (select count(*) from public.lesson_learning_tasks where support_project_ref=p_project and organization_id=p_org and data_table=p_table and student_id=p_student and active)>=20 then
  raise exception '有効な課題は20件までです。終了した課題を停止してください。' using errcode='22023';
 end if;
 if existing.id is null then
  insert into public.lesson_learning_tasks(id,support_project_ref,organization_id,data_table,student_id,link_id,child_id,category,title,instructions,starts_on,ends_on,active,updated_by,updated_by_name)
  values(p_id,p_project,p_org,p_table,p_student,p_link,p_child,p_category,btrim(p_title),p_instructions,p_start,p_end,p_active,p_actor,p_name) returning * into saved;
 else
  update public.lesson_learning_tasks set category=p_category,title=btrim(p_title),instructions=p_instructions,starts_on=p_start,ends_on=p_end,
   active=p_active,updated_by=p_actor,updated_by_name=p_name,revision=revision+1,updated_at=now() where id=p_id returning * into saved;
 end if;
 insert into public.lesson_learning_task_audit(task_id,support_project_ref,organization_id,actor_id,snapshot) values(p_id,p_project,p_org,p_actor,to_jsonb(saved));
 return saved;
end; $$;
revoke all on function public.save_support_learning_task(text,uuid,text,text,uuid,text,uuid,integer,text,text,text,date,date,boolean,uuid,text) from public,anon,authenticated;
grant execute on function public.save_support_learning_task(text,uuid,text,text,uuid,text,uuid,integer,text,text,text,date,date,boolean,uuid,text) to service_role;
