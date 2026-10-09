begin;
create table if not exists public.lesson_support_task_changes (
 operation_id uuid not null, task_id uuid not null references public.lesson_learning_tasks(id) on delete cascade,
 parent_id uuid not null, actor_id uuid not null, request jsonb not null, snapshot jsonb not null,
 at timestamptz not null default now(), primary key(operation_id,task_id)
);
create index if not exists lesson_support_task_changes_parent on public.lesson_support_task_changes(parent_id,task_id);
alter table public.lesson_support_task_changes enable row level security;
revoke all on public.lesson_support_task_changes from public,anon,authenticated;
grant all on public.lesson_support_task_changes to service_role;

create or replace function public.read_support_task_batch_current(p_project text,p_org uuid,p_table text,p_parent uuid,p_targets jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if p_table not in('user_data','test_user_data') or p_parent is null or p_org is null or p_project !~ '^[a-z0-9]{20}$'
  or jsonb_typeof(p_targets) is distinct from 'array' or jsonb_array_length(p_targets)>100
 then raise exception '課題の対象を確認してください。' using errcode='22023'; end if;
 execute format($query$
 select coalesce(jsonb_agg(jsonb_build_object('childId',r."childId",'linkId',r."linkId",
  'available',u.id is not null and t.id is not null,
  'group',case when u.id is not null then coalesce(btrim(u.data->>'group'),'') else '' end,
  'task',case when u.id is not null then to_jsonb(t) else null end,
  'managedRevision',case when u.id is not null and t.id is not null then coalesce((select max((h.snapshot->>'revision')::integer)
   from public.lesson_support_task_changes h where h.parent_id=$5 and h.task_id=t.id),1) else null end)), '[]'::jsonb)
 from jsonb_to_recordset($1) r("childId" text,"linkId" uuid,"studentId" text,"campusId" text,"taskId" uuid)
 left join public.lesson_support_students p on p.support_project_ref=$2 and p.organization_id=$3 and p.data_table=$4
  and p.student_id=r."studentId" and p.enabled and p.support_link_id=r."linkId" and p.support_child_id=r."childId" and p.campus_id=r."campusId"
 left join public.lesson_support_scopes s on s.support_project_ref=$2 and s.organization_id=$3 and s.data_table=$4 and s.campus_id=p.campus_id and s.enabled
 left join public.%I u on s.enabled and u.id=r."studentId" and coalesce(u.data->>'campusId',u.data->>'campus','main')=p.campus_id and p.campus_id<>'public'
  and coalesce(u.data->>'isMaster','false')<>'true' and coalesce(u.data->>'isGuest','false')<>'true' and coalesce(u.data->>'publicRegistration','false')<>'true'
  and coalesce(u.data->>'registrationSource','')<>'public' and coalesce(u.data->>'registration_source','')<>'public' and coalesce(u.data->>'accountType','') not in('public','guest')
  and (u.data->'group' is null or jsonb_typeof(u.data->'group')='null' or (jsonb_typeof(u.data->'group')='string' and length(btrim(u.data->>'group'))<=80))
 left join public.lesson_learning_tasks t on u.id is not null and t.id=r."taskId" and t.support_project_ref=$2 and t.organization_id=$3
  and t.data_table=$4 and t.student_id=r."studentId" and t.link_id=r."linkId" and t.child_id=r."childId"
 $query$,p_table) into result using p_targets,p_project,p_org,p_table,p_parent;
 return result;
end; $$;

create or replace function public.apply_support_task_batch_change(p jsonb)
returns public.lesson_learning_tasks language plpgsql security definer set search_path=public as $$
declare v_op uuid:=(p->>'operationId')::uuid; v_parent uuid:=(p->>'parentId')::uuid; v_actor uuid:=(p->>'actorId')::uuid;
 v_id uuid:=(p->'task'->>'id')::uuid; v_org uuid:=(p->>'organizationId')::uuid; v_table text:=p->>'dataTable';
 v_permission public.lesson_support_students%rowtype; v_current public.lesson_learning_tasks%rowtype;
 v_saved public.lesson_learning_tasks%rowtype; v_receipt public.lesson_support_task_changes%rowtype; v_learner jsonb; v_managed integer;
begin
 if v_op is null or v_parent is null or v_actor is null or v_id is null or v_org is null or v_table not in('user_data','test_user_data')
  or coalesce(p->>'kind','') not in('edit','stop') or coalesce((p->'task'->>'active')::boolean,false) is distinct from (p->>'kind'='edit')
  or (p->'task'->>'revision')::integer<1 then raise exception '変更内容を確認してください。' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('lesson-task-change:'||v_op::text||':'||v_id::text,0));
 select * into v_permission from public.lesson_support_students where support_project_ref=p->>'supportProjectRef' and organization_id=v_org
  and data_table=v_table and student_id=p->>'studentId' for update;
 if not found or not v_permission.enabled or v_permission.support_link_id is distinct from (p->>'linkId')::uuid or v_permission.support_child_id is distinct from p->>'childId'
  or not exists(select 1 from public.lesson_support_scopes where support_project_ref=p->>'supportProjectRef' and organization_id=v_org and data_table=v_table and campus_id=v_permission.campus_id and enabled)
 then raise exception '児童の連携許可を確認してください。' using errcode='42501'; end if;
 execute format('select data from public.%I where id=$1 for share',v_table) into v_learner using p->>'studentId';
 if v_learner is null or coalesce(v_learner->>'campusId',v_learner->>'campus','main')<>v_permission.campus_id
  or v_permission.campus_id='public' or coalesce(v_learner->>'publicRegistration','false')='true' or coalesce(v_learner->>'isGuest','false')='true'
  or coalesce(v_learner->>'isMaster','false')='true' or coalesce(v_learner->>'registrationSource',v_learner->>'registration_source','')='public'
  or v_learner->>'accountType' in('public','guest') then raise exception '教室児童を確認してください。' using errcode='42501'; end if;
 if v_permission.campus_id is distinct from p->>'expectedCampus' or coalesce(btrim(v_learner->>'group'),'') is distinct from p->>'expectedGroup'
 then raise exception '児童の所属が変更されています。' using errcode='PT412'; end if;
 select * into v_receipt from public.lesson_support_task_changes where operation_id=v_op and task_id=v_id;
 if found then
  if v_receipt.parent_id<>v_parent or v_receipt.actor_id<>v_actor or v_receipt.request is distinct from (p-'actorName')
  then raise exception '同じ変更操作の内容が一致しません。' using errcode='PT409'; end if;
  -- Return the historical receipt without reverting any subsequent individual edit.
  select * into v_saved from jsonb_populate_record(null::public.lesson_learning_tasks,v_receipt.snapshot);
  return v_saved;
 end if;
 select * into v_current from public.lesson_learning_tasks where id=v_id for update;
 if not found or v_current.support_project_ref<>p->>'supportProjectRef' or v_current.organization_id<>v_org or v_current.data_table<>v_table
  or v_current.student_id<>p->>'studentId' or v_current.child_id<>p->>'childId' or v_current.link_id<>(p->>'linkId')::uuid
 then raise exception '本人の課題を確認してください。' using errcode='42501'; end if;
 select coalesce(max((snapshot->>'revision')::integer),1) into v_managed from public.lesson_support_task_changes where parent_id=v_parent and task_id=v_id;
 if not v_current.active or v_current.revision<>(p->'task'->>'revision')::integer or v_current.revision<>v_managed
 then raise exception '課題が個別に変更・停止されています。' using errcode='PT409'; end if;
 if p->>'kind'='stop' and (v_current.category is distinct from p->'task'->>'category' or v_current.stage_id is distinct from p->'task'->>'stageId'
  or v_current.title is distinct from p->'task'->>'title' or v_current.instructions is distinct from p->'task'->>'instructions'
  or v_current.starts_on is distinct from (p->'task'->>'startsOn')::date or v_current.ends_on is distinct from (p->'task'->>'endsOn')::date)
 then raise exception '停止操作では課題内容を変更できません。' using errcode='PT409'; end if;
 v_saved:=public.save_support_learning_task(p->>'supportProjectRef',v_org,v_table,p->>'studentId',(p->>'linkId')::uuid,p->>'childId',v_id,
  (p->'task'->>'revision')::integer,p->'task'->>'category',p->'task'->>'title',p->'task'->>'instructions',(p->'task'->>'startsOn')::date,(p->'task'->>'endsOn')::date,
  (p->'task'->>'active')::boolean,v_actor,p->>'actorName',p->'task'->>'stageId',p->>'expectedGroup',p->>'expectedCampus');
 insert into public.lesson_support_task_changes(operation_id,task_id,parent_id,actor_id,request,snapshot) values(v_op,v_id,v_parent,v_actor,p-'actorName',to_jsonb(v_saved));
 return v_saved;
end; $$;
revoke all on function public.read_support_task_batch_current(text,uuid,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.apply_support_task_batch_change(jsonb) from public,anon,authenticated;
grant execute on function public.read_support_task_batch_current(text,uuid,text,uuid,jsonb),public.apply_support_task_batch_change(jsonb) to service_role;
commit;
