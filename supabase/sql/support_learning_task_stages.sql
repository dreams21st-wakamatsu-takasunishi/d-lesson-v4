begin;
alter table public.lesson_learning_tasks add column if not exists stage_id text
 check(stage_id is null or stage_id ~ '^[a-zA-Z0-9_]{1,40}$');
drop function if exists public.save_support_learning_task(text,uuid,text,text,uuid,text,uuid,integer,text,text,text,date,date,boolean,uuid,text);
drop function if exists public.save_support_learning_task(text,uuid,text,text,uuid,text,uuid,integer,text,text,text,date,date,boolean,uuid,text,text);
drop function if exists public.save_support_learning_task(text,uuid,text,text,uuid,text,uuid,integer,text,text,text,date,date,boolean,uuid,text,text,text);
create or replace function public.save_support_learning_task(
 p_project text,p_org uuid,p_table text,p_student text,p_link uuid,p_child text,
 p_id uuid,p_revision integer,p_category text,p_title text,p_instructions text,
 p_start date,p_end date,p_active boolean,p_actor uuid,p_name text,p_stage text default null,p_expected_group text default null,p_expected_campus text default null
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
 execute format('select data from public.%I where id=$1 for share',p_table) into learner using p_student;
 if learner is null or coalesce(learner->>'campusId',learner->>'campus','main')<>permission.campus_id
  or coalesce(learner->>'publicRegistration','false')='true' or coalesce(learner->>'isGuest','false')='true'
  or coalesce(learner->>'isMaster','false')='true' or learner->>'registrationSource'='public'
  or learner->>'accountType' in('public','guest') or permission.campus_id='public' then
  raise exception '教室の学習アカウントを確認してください。' using errcode='42501';
 end if;
 if p_expected_group is not null and (length(p_expected_group)>80 or coalesce(btrim(learner->>'group'),'') is distinct from p_expected_group) then
  raise exception '児童のグループが変更されています。対象を再確認してください。' using errcode='PT412';
 end if;
 if p_expected_campus is not null and permission.campus_id is distinct from p_expected_campus then
  raise exception '児童の校舎が変更されています。対象を再確認してください。' using errcode='PT412';
 end if;
 if p_actor is null or p_name is null or length(p_name)>100 or p_id is null or p_revision is null or p_revision<0
  or p_category is null or p_category not in('mouse','keyboard','text','word','vision','minigame')
  or p_title is null or length(btrim(p_title)) not between 1 and 80 or p_instructions is null or length(p_instructions)>500
  or p_start is null or p_end is null or p_end<p_start or p_end-p_start>90 or p_active is null
  or (p_stage is not null and (p_stage !~ '^[a-zA-Z0-9_]{1,40}$' or p_category not in('mouse','keyboard','word','vision'))) then
  raise exception '課題の分野・ステージ・内容・期間を確認してください。' using errcode='22023';
 end if;
 select * into existing from public.lesson_learning_tasks where id=p_id for update;
 if found then
  if existing.support_project_ref<>p_project or existing.organization_id<>p_org or existing.data_table<>p_table or existing.student_id<>p_student
   or existing.link_id<>p_link or existing.child_id<>p_child then raise exception '本人の課題を選択してください。' using errcode='42501'; end if;
  if existing.revision<>p_revision then
   if existing.revision=p_revision+1 and existing.category=p_category and existing.stage_id is not distinct from p_stage
    and existing.title=btrim(p_title) and existing.instructions=p_instructions and existing.starts_on=p_start
    and existing.ends_on=p_end and existing.active=p_active and existing.updated_by=p_actor then return existing; end if;
   raise exception '別の職員が更新しました。再取得してください。' using errcode='PT409';
  end if;
 elsif p_revision<>0 then raise exception '課題を再取得してください。' using errcode='PT409';
 end if;
 if p_active and (existing.id is null or not existing.active) and
  (select count(*) from public.lesson_learning_tasks where support_project_ref=p_project and organization_id=p_org and data_table=p_table and student_id=p_student and active)>=20 then
  raise exception '有効な課題は20件までです。終了した課題を停止してください。' using errcode='22023';
 end if;
 if existing.id is null then
  insert into public.lesson_learning_tasks(id,support_project_ref,organization_id,data_table,student_id,link_id,child_id,category,stage_id,title,instructions,starts_on,ends_on,active,updated_by,updated_by_name)
  values(p_id,p_project,p_org,p_table,p_student,p_link,p_child,p_category,p_stage,btrim(p_title),p_instructions,p_start,p_end,p_active,p_actor,p_name) returning * into saved;
 else
  update public.lesson_learning_tasks set category=p_category,stage_id=p_stage,title=btrim(p_title),instructions=p_instructions,starts_on=p_start,ends_on=p_end,
   active=p_active,updated_by=p_actor,updated_by_name=p_name,revision=revision+1,updated_at=now() where id=p_id returning * into saved;
 end if;
 insert into public.lesson_learning_task_audit(task_id,support_project_ref,organization_id,actor_id,snapshot) values(p_id,p_project,p_org,p_actor,to_jsonb(saved));
 return saved;
end; $$;
revoke all on function public.save_support_learning_task(text,uuid,text,text,uuid,text,uuid,integer,text,text,text,date,date,boolean,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_support_learning_task(text,uuid,text,text,uuid,text,uuid,integer,text,text,text,date,date,boolean,uuid,text,text,text,text) to service_role;
commit;
