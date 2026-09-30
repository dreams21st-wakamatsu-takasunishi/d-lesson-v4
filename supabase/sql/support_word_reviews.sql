begin;
alter table public.lesson_support_students add column if not exists support_link_id uuid;
alter table public.lesson_support_students add column if not exists support_child_id text;
create unique index if not exists lesson_support_bound_student on public.lesson_support_students(data_table,student_id)
  where enabled and support_link_id is not null;

create table if not exists public.lesson_word_requests (
  id uuid primary key,
  data_table text not null check(data_table in ('user_data','test_user_data')),
  student_id text not null,
  stage_id text not null check(stage_id in ('w_b1_1','w_b1_2','w_b1_3','w_b1_4','w_b1_5','w_m4_1','w_m4_2','w_m4_3')),
  support_project_ref text not null,
  organization_id uuid not null,
  link_id uuid not null,
  child_id text not null,
  page text not null check(page='' or page ~ '^[1-9][0-9]{0,3}$'),
  file_path text not null unique,
  file_type text not null check(file_type in ('application/pdf','image/png','image/jpeg')),
  file_size integer not null check(file_size between 1 and 8388608),
  file_hash text,
  status text not null default 'prepared' check(status in ('prepared','pending','approved','returned','expired')),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_id uuid,
  reviewer_name text,
  reason text not null default '',
  reward integer not null default 0 check(reward in(0,500)),
  artifact_deleted_at timestamptz
);
create unique index if not exists lesson_word_one_open_request on public.lesson_word_requests(data_table,student_id,stage_id)
  where status in ('prepared','pending');
create index if not exists lesson_word_request_inbox on public.lesson_word_requests(support_project_ref,organization_id,status,submitted_at);
alter table public.lesson_word_requests enable row level security;
revoke all on public.lesson_word_requests from public,anon,authenticated;
grant all on public.lesson_word_requests to service_role;

create or replace function public.bind_support_word_student(p_project text,p_org uuid,p_table text,p_student text,p_link uuid,p_child text,p_bind boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_permission public.lesson_support_students%rowtype;
begin
  select * into v_permission from public.lesson_support_students where support_project_ref=p_project and organization_id=p_org
    and data_table=p_table and student_id=p_student for update;
  if not found and not p_bind then return; end if;
  if not found or (p_bind and not v_permission.enabled) or p_link is null or nullif(p_child,'') is null or p_bind is null then raise exception '児童の連携許可を確認してください。' using errcode='42501'; end if;
  if not p_bind and v_permission.support_link_id is distinct from p_link then
    if v_permission.support_link_id is null then return; end if;
    raise exception '連携状態が変更されています。' using errcode='PT409';
  end if;
  if not p_bind or v_permission.support_link_id is distinct from p_link then
    update public.lesson_word_requests set status='expired',revision=revision+1 where link_id=v_permission.support_link_id and status in('prepared','pending');
  end if;
  update public.lesson_support_students set support_link_id=case when p_bind then p_link else null end,
    support_child_id=case when p_bind then p_child else null end where support_project_ref=p_project and organization_id=p_org and data_table=p_table and student_id=p_student;
end; $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lesson-word-work','lesson-word-work',false,8388608,array['application/pdf','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.prepare_support_word_request(
  p_actor uuid,p_student text,p_table text,p_stage text,p_page text,p_id uuid,p_type text,p_size integer
) returns public.lesson_word_requests language plpgsql security definer set search_path=public as $$
declare v_data jsonb; v_permission public.lesson_support_students%rowtype; v_request public.lesson_word_requests%rowtype;
  v_stages text[] := array['w_b1_1','w_b1_2','w_b1_3','w_b1_4','w_b1_5','w_m4_1','w_m4_2','w_m4_3']; v_index integer;
begin
  if p_table not in ('user_data','test_user_data') or p_table is null or p_id is null
    or p_page is null or (p_page<>'' and p_page !~ '^[1-9][0-9]{0,3}$')
    or p_type not in ('application/pdf','image/png','image/jpeg') or p_type is null or p_size is null or p_size not between 1 and 8388608 then
    raise exception '作品の形式・サイズ・ページを確認してください。' using errcode='22023';
  end if;
  if not exists(select 1 from public.lesson_user_access where auth_user_id=p_actor and user_data_id=p_student and role='student') then
    raise exception '児童本人のアカウントで申請してください。' using errcode='42501';
  end if;
  execute format('select data from public.%I where id=$1 for update',p_table) into v_data using p_student;
  select p.* into v_permission from public.lesson_support_students p join public.lesson_support_scopes s
    using(support_project_ref,organization_id,data_table,campus_id)
    where p.data_table=p_table and p.student_id=p_student and p.enabled and s.enabled
      and p.support_link_id is not null and p.support_child_id is not null for share of p,s;
  if not found or v_data is null or coalesce(v_data->>'campusId',v_data->>'campus','main')<>v_permission.campus_id
    or coalesce(v_data->>'publicRegistration','false')='true' or coalesce(v_data->>'isGuest','false')='true'
    or coalesce(v_data->>'isMaster','false')='true' or v_permission.campus_id='public' then
    raise exception 'Dサポートとの児童連携を先生に確認してください。' using errcode='42501';
  end if;
  v_index:=array_position(v_stages,p_stage);
  if v_index is null or coalesce(v_data->'examRecords'->>'romaji_daku_exam','') in ('','false','0','null')
    or (v_index>1 and coalesce(v_data->'wordProgress'->v_stages[v_index-1]->>'status',v_data->'wordProgress'->>v_stages[v_index-1],'')<>'cleared') then
    raise exception '前のステージをクリアしてから申請してください。' using errcode='22023';
  end if;
  if exists(select 1 from public.lesson_word_approvals where data_table=p_table and user_data_id=p_student and stage_id=p_stage) then
    raise exception 'このステージは確認済みです。' using errcode='22023';
  end if;
  select * into v_request from public.lesson_word_requests where id=p_id;
  if found then
    if v_request.student_id<>p_student or v_request.data_table<>p_table or v_request.stage_id<>p_stage
      or v_request.page<>p_page or v_request.file_type<>p_type or v_request.file_size<>p_size
      or v_request.link_id<>v_permission.support_link_id or v_request.status<>'prepared' then
      raise exception '申請内容が変わりました。もう一度選択してください。' using errcode='PT409';
    end if;
    return v_request;
  end if;
  update public.lesson_word_requests set status='expired',revision=revision+1
    where data_table=p_table and student_id=p_student and status='prepared' and created_at<now()-interval '2 hours';
  if exists(select 1 from public.lesson_word_requests where data_table=p_table and student_id=p_student and stage_id=p_stage and status in('prepared','pending')) then
    raise exception 'このステージは申請済みです。結果を確認してください。' using errcode='23505';
  end if;
  if (select count(*) from public.lesson_word_requests where data_table=p_table and student_id=p_student and created_at>now()-interval '1 day')>=10 then
    raise exception '申請回数が多いため、先生に確認してください。' using errcode='22023';
  end if;
  insert into public.lesson_word_requests(id,data_table,student_id,stage_id,support_project_ref,organization_id,link_id,child_id,page,file_path,file_type,file_size)
    values(p_id,p_table,p_student,p_stage,v_permission.support_project_ref,v_permission.organization_id,v_permission.support_link_id,v_permission.support_child_id,p_page,
      p_student||'/'||p_id::text||case p_type when 'application/pdf' then '.pdf' when 'image/png' then '.png' else '.jpg' end,p_type,p_size)
    returning * into v_request;
  return v_request;
end; $$;

create or replace function public.submit_support_word_request(p_actor uuid,p_id uuid,p_hash text)
returns public.lesson_word_requests language plpgsql security definer set search_path=public as $$
declare v_request public.lesson_word_requests%rowtype;
begin
  select * into v_request from public.lesson_word_requests where id=p_id for update;
  if not found or not exists(select 1 from public.lesson_user_access where auth_user_id=p_actor and user_data_id=v_request.student_id and role='student') then
    raise exception '児童本人の申請を確認してください。' using errcode='42501';
  end if;
  if not exists(select 1 from public.lesson_support_students p join public.lesson_support_scopes s using(support_project_ref,organization_id,data_table,campus_id)
    where p.data_table=v_request.data_table and p.student_id=v_request.student_id and p.support_link_id=v_request.link_id and p.enabled and s.enabled) then
    raise exception '児童の連携が解除されています。' using errcode='42501';
  end if;
  if v_request.status='pending' and v_request.file_hash=p_hash then return v_request; end if;
  if v_request.status<>'prepared' or v_request.created_at<now()-interval '2 hours' or p_hash !~ '^[a-f0-9]{64}$' or p_hash is null then
    raise exception '申請の有効期限を確認してください。' using errcode='PT409';
  end if;
  update public.lesson_word_requests set status='pending',submitted_at=now(),file_hash=p_hash,revision=revision+1 where id=p_id returning * into v_request;
  return v_request;
end; $$;

create or replace function public.decide_support_word_request(
  p_project text,p_org uuid,p_link uuid,p_child text,p_id uuid,p_revision integer,p_actor uuid,p_name text,p_decision text,p_reason text
) returns public.lesson_word_requests language plpgsql security definer set search_path=public as $$
declare v_request public.lesson_word_requests%rowtype; v_data jsonb; v_reward integer:=0; v_progress jsonb; v_revision integer;
begin
  select * into v_request from public.lesson_word_requests where id=p_id;
  if not found then raise exception '申請を確認できません。' using errcode='42501'; end if;
  execute format('select data from public.%I where id=$1 for update',v_request.data_table) into v_data using v_request.student_id;
  perform 1 from public.lesson_support_students p join public.lesson_support_scopes s using(support_project_ref,organization_id,data_table,campus_id)
    where p.support_project_ref=p_project and p.organization_id=p_org and p.data_table=v_request.data_table and p.student_id=v_request.student_id
      and p.support_link_id=p_link and p.support_child_id=p_child and p.enabled and s.enabled
      and p.campus_id=coalesce(v_data->>'campusId',v_data->>'campus','main') for share of p,s;
  if not found or v_data is null or v_request.link_id<>p_link or v_request.child_id<>p_child or v_request.organization_id<>p_org
    or v_request.support_project_ref<>p_project or coalesce(v_data->>'publicRegistration','false')='true' then
    raise exception '現在の児童連携を確認してください。' using errcode='42501';
  end if;
  select * into v_request from public.lesson_word_requests where id=p_id for update;
  if v_request.status in('approved','returned') and v_request.status=p_decision and v_request.reviewer_id=p_actor
    and v_request.revision=p_revision+1 and v_request.reason=coalesce(btrim(p_reason),'') then return v_request; end if;
  if v_request.status<>'pending' or v_request.revision is distinct from p_revision then
    raise exception '申請状態が変わりました。更新して確認してください。' using errcode='PT409';
  end if;
  if p_decision not in('approved','returned') or p_decision is null or p_actor is null or nullif(btrim(p_name),'') is null
    or length(p_name)>100 or p_reason is null or length(p_reason)>600 or (p_decision='returned' and nullif(btrim(p_reason),'') is null) then
    raise exception '承認内容・差し戻し理由を確認してください。' using errcode='22023';
  end if;
  if p_decision='approved' then
    insert into public.lesson_word_approvals(data_table,user_data_id,stage_id,approved_by,page,reward)
      values(v_request.data_table,v_request.student_id,v_request.stage_id,p_actor,v_request.page,
        case when coalesce(v_data->'wordProgress'->v_request.stage_id->>'status',v_data->'wordProgress'->>v_request.stage_id,'')='cleared' then 0 else 500 end)
      on conflict(data_table,user_data_id,stage_id) do nothing returning reward into v_reward;
    v_reward:=coalesce(v_reward,0);
    v_progress:=jsonb_build_object('status','cleared','page',v_request.page,'approvedBy',p_actor,'approvedAt',now(),'approvedVia','d-support');
    v_data:=jsonb_set(v_data,'{wordProgress}',(case when jsonb_typeof(v_data->'wordProgress')='object' then v_data->'wordProgress' else '{}'::jsonb end)||jsonb_build_object(v_request.stage_id,v_progress));
    v_data:=jsonb_set(v_data,'{coins}',to_jsonb((case when jsonb_typeof(v_data->'coins')='number' then (v_data->>'coins')::numeric else 0 end)+v_reward));
    v_data:=jsonb_set(v_data,'{supportWordRevision}',to_jsonb(coalesce((v_data->>'supportWordRevision')::integer,0)+1));
    v_data:=jsonb_set(v_data,'{practiceLogs}',jsonb_build_array(jsonb_build_object('id','support-word-'||p_id::text,'at',now(),'category','word',
      'title','Word '||upper(replace(substring(v_request.stage_id from 3),'_','-')),'detail','先生の確認でクリア','amount',v_request.page||'ページまで','coins',v_reward))
      ||case when jsonb_typeof(v_data->'practiceLogs')='array' then v_data->'practiceLogs' else '[]'::jsonb end);
    execute format('update public.%I set data=$1 where id=$2',v_request.data_table) using v_data,v_request.student_id;
  end if;
  update public.lesson_word_requests set status=p_decision,revision=revision+1,reviewed_at=now(),reviewer_id=p_actor,reviewer_name=p_name,
    reason=btrim(p_reason),reward=v_reward where id=p_id returning * into v_request;
  return v_request;
end; $$;

-- Reject stale child snapshots after a remote award, and preserve canonical approvals.
create or replace function public.guard_support_word_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_approval public.lesson_word_approvals%rowtype;
begin
  if auth.uid() is null or not exists(select 1 from public.lesson_user_access where auth_user_id=auth.uid() and user_data_id=new.id and role='student') then return new; end if;
  if (new.data->>'supportWordRevision') is distinct from (old.data->>'supportWordRevision') then
    raise exception 'WORD_REVIEW_CHANGED: 先生の確認結果が届きました。画面を読み直してください。' using errcode='PT409';
  end if;
  for v_approval in select a.* from public.lesson_word_approvals a where a.data_table=tg_table_name and a.user_data_id=new.id
    and exists(select 1 from public.lesson_word_requests r where r.data_table=a.data_table and r.student_id=a.user_data_id and r.stage_id=a.stage_id and r.status='approved') loop
    new.data:=jsonb_set(new.data,'{wordProgress}',(case when jsonb_typeof(new.data->'wordProgress')='object' then new.data->'wordProgress' else '{}'::jsonb end)
      ||jsonb_build_object(v_approval.stage_id,jsonb_build_object('status','cleared','page',v_approval.page,'approvedBy',v_approval.approved_by,'approvedAt',v_approval.approved_at)));
  end loop;
  return new;
end; $$;
drop trigger if exists guard_support_word_snapshot on public.user_data;
create trigger guard_support_word_snapshot before update on public.user_data for each row execute function public.guard_support_word_snapshot();
do $$ begin if to_regclass('public.test_user_data') is not null then
  execute 'drop trigger if exists guard_support_word_snapshot on public.test_user_data';
  execute 'create trigger guard_support_word_snapshot before update on public.test_user_data for each row execute function public.guard_support_word_snapshot()';
end if; end; $$;

revoke all on function public.prepare_support_word_request(uuid,text,text,text,text,uuid,text,integer),
  public.submit_support_word_request(uuid,uuid,text),public.decide_support_word_request(text,uuid,uuid,text,uuid,integer,uuid,text,text,text),
  public.bind_support_word_student(text,uuid,text,text,uuid,text,boolean),public.guard_support_word_snapshot() from public,anon,authenticated;
grant execute on function public.prepare_support_word_request(uuid,text,text,text,text,uuid,text,integer),
  public.submit_support_word_request(uuid,uuid,text),public.decide_support_word_request(text,uuid,uuid,text,uuid,integer,uuid,text,text,text),
  public.bind_support_word_student(text,uuid,text,text,uuid,text,boolean) to service_role;
commit;
