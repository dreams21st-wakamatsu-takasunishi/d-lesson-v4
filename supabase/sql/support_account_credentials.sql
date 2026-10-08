begin;
create table if not exists public.lesson_support_account_operations (
  id uuid primary key, support_project_ref text not null, organization_id uuid not null,
  data_table text not null check(data_table in('user_data','test_user_data')), student_id text not null,
  child_id text not null, link_id uuid not null, actor_id uuid not null,
  action text not null check(action in('issue','reset')), campus_id text not null, login_number text not null,
  original_primary text, phase text not null default 'reserved' check(phase in('reserved','auth-pending','auth-ready','completed','denied')),
  auth_user_id uuid, target_email text, campus_code text,
  lease_id uuid, lease_until timestamptz, error_code text,
  at timestamptz not null default now(), updated_at timestamptz not null default now(), finished_at timestamptz
);
create unique index if not exists lesson_support_account_pending on public.lesson_support_account_operations(data_table,student_id)
  where phase not in('completed','denied');
alter table public.lesson_support_account_operations enable row level security;
revoke all on public.lesson_support_account_operations from public,anon,authenticated;
grant all on public.lesson_support_account_operations to service_role;

create or replace function public.claim_support_account_operation(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.lesson_support_account_operations%rowtype; d jsonb; campus text; n text;
begin
  if p->>'action' not in('issue','reset') or p->>'table' not in('user_data','test_user_data') then raise exception 'Invalid operation' using errcode='PT409'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lesson-credential:'||(p->>'table')||':'||(p->>'student'),0));
  select s.campus_id into campus from public.lesson_support_students s join public.lesson_support_scopes c
    on c.support_project_ref=s.support_project_ref and c.organization_id=s.organization_id and c.data_table=s.data_table and c.campus_id=s.campus_id and c.enabled
    where s.support_project_ref=p->>'project' and s.organization_id=(p->>'org')::uuid and s.data_table=p->>'table' and s.student_id=p->>'student'
      and s.support_child_id=p->>'child' and s.support_link_id=(p->>'link')::uuid and s.enabled for share of s,c;
  if not found then raise exception 'Binding changed' using errcode='42501'; end if;
  execute format('select data from public.%I where id=$1 for update',p->>'table') into d using p->>'student';
  if d is null or coalesce(d->>'campusId',d->>'campus','main')<>campus or campus='public' or coalesce(d->>'isMaster','false')='true'
    or coalesce(d->>'isGuest','false')='true' or coalesce(d->>'publicRegistration','false')='true'
    or coalesce(d->>'accountType','') in('public','guest') or coalesce(d->>'registrationSource',d->>'registration_source','')='public'
    then raise exception 'Invalid learner' using errcode='PT409'; end if;
  n:=d->>'loginNumber';
  if n is null or n !~ '^\d{1,3}$' or n::integer not between 1 and 50 then raise exception 'Invalid number' using errcode='PT409'; end if;
  select * into v from public.lesson_support_account_operations where id=(p->>'id')::uuid for update;
  if found then
    if v.support_project_ref<>p->>'project' or v.organization_id<>(p->>'org')::uuid or v.data_table<>p->>'table' or v.student_id<>p->>'student'
      or v.child_id<>p->>'child' or v.link_id<>(p->>'link')::uuid or v.actor_id<>(p->>'actor')::uuid or v.action<>p->>'action'
      or v.campus_id<>campus or v.login_number<>n or (coalesce(d->>'authUserId','')<>coalesce(v.original_primary,'') and coalesce(d->>'authUserId','')<>coalesce(v.auth_user_id::text,''))
      or v.phase='denied' then raise exception 'Operation changed' using errcode='PT409'; end if;
    if v.phase='completed' and v.finished_at<now()-interval '24 hours' then raise exception 'Recovery expired' using errcode='PT409'; end if;
    if v.lease_until>now() then raise exception 'Operation in progress' using errcode='PT423'; end if;
  else
    if exists(select 1 from public.lesson_support_account_operations where data_table=p->>'table' and student_id=p->>'student' and phase not in('completed','denied'))
      then raise exception 'Resume the existing operation' using errcode='PT409'; end if;
    if (select count(*) from public.lesson_support_account_operations where actor_id=(p->>'actor')::uuid and at>now()-interval '15 minutes')>=10
      then raise exception 'Too many operations' using errcode='PT429'; end if;
    insert into public.lesson_support_account_operations(id,support_project_ref,organization_id,data_table,student_id,child_id,link_id,actor_id,action,campus_id,login_number,original_primary)
      values((p->>'id')::uuid,p->>'project',(p->>'org')::uuid,p->>'table',p->>'student',p->>'child',(p->>'link')::uuid,(p->>'actor')::uuid,p->>'action',campus,n,d->>'authUserId') returning * into v;
  end if;
  update public.lesson_support_account_operations set lease_id=(p->>'lease')::uuid,lease_until=now()+interval '3 minutes',updated_at=now() where id=v.id returning * into v;
  return to_jsonb(v);
end; $$;

create or replace function public.lookup_support_account_email(p_email text)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'app_metadata',raw_app_meta_data)), '[]'::jsonb) from auth.users where lower(email)=lower(p_email);
$$;

create or replace function public.prepare_support_account_operation(p_id uuid,p_lease uuid,p_auth uuid,p_email text,p_code text)
returns void language plpgsql security definer set search_path=public as $$
declare v public.lesson_support_account_operations%rowtype; collision boolean;
begin
  select * into v from public.lesson_support_account_operations where id=p_id and lease_id=p_lease and lease_until>now() and phase='reserved' for update;
  if not found then raise exception 'Operation changed' using errcode='PT409'; end if;
  execute format('select exists(select 1 from public.%I where id<>$1 and coalesce(data->>''campusId'',data->>''campus'',''main'')=$2 and data->>''loginNumber'' ~ ''^\d{1,3}$'' and case when data->>''loginNumber'' ~ ''^\d{1,3}$'' then (data->>''loginNumber'')::integer end=$3)',v.data_table)
    into collision using v.student_id,v.campus_id,v.login_number::integer;
  if collision then raise exception 'Number collision' using errcode='PT409'; end if;
  if v.action='issue' and (p_auth is not null or exists(select 1 from public.lesson_user_access where user_data_id=v.student_id)
    or exists(select 1 from auth.users where lower(email)=lower(p_email))) then raise exception 'Existing account' using errcode='PT409'; end if;
  if v.action='reset' and (p_auth is null or (select count(*) from public.lesson_user_access where user_data_id=v.student_id)<>1
    or not exists(select 1 from public.lesson_user_access where auth_user_id=p_auth and user_data_id=v.student_id and role='student')
    or exists(select 1 from public.lesson_user_access where auth_user_id=p_auth and (user_data_id<>v.student_id or role<>'student')))
    then raise exception 'Ownership changed' using errcode='PT409'; end if;
  update public.lesson_support_account_operations set auth_user_id=p_auth,target_email=p_email,campus_code=p_code,phase='auth-pending',updated_at=now() where id=v.id;
end; $$;

create or replace function public.guard_support_account_operation(p_id uuid,p_lease uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v public.lesson_support_account_operations%rowtype; d jsonb;
begin
  select * into v from public.lesson_support_account_operations where id=p_id and lease_id=p_lease and lease_until>now() for share;
  if not found then raise exception 'Lease changed' using errcode='PT409'; end if;
  perform 1 from public.lesson_support_students s join public.lesson_support_scopes c on c.support_project_ref=s.support_project_ref and c.organization_id=s.organization_id and c.data_table=s.data_table and c.campus_id=s.campus_id and c.enabled
    where s.support_project_ref=v.support_project_ref and s.organization_id=v.organization_id and s.data_table=v.data_table and s.student_id=v.student_id and s.support_child_id=v.child_id and s.support_link_id=v.link_id and s.enabled and s.campus_id=v.campus_id for share of s,c;
  if not found then raise exception 'Binding changed' using errcode='42501'; end if;
  execute format('select data from public.%I where id=$1 for update',v.data_table) into d using v.student_id;
  if d is null or coalesce(d->>'campusId',d->>'campus','main')<>v.campus_id or d->>'loginNumber'<>v.login_number
    or (coalesce(d->>'authUserId','')<>coalesce(v.original_primary,'') and coalesce(d->>'authUserId','')<>coalesce(v.auth_user_id::text,''))
    or coalesce(d->>'isMaster','false')='true' or coalesce(d->>'isGuest','false')='true' or coalesce(d->>'publicRegistration','false')='true'
    or coalesce(d->>'accountType','') in('public','guest') or coalesce(d->>'registrationSource',d->>'registration_source','')='public'
    then raise exception 'Learner changed' using errcode='PT409'; end if;
end; $$;

create or replace function public.complete_support_account_operation(p_id uuid,p_lease uuid,p_auth uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v public.lesson_support_account_operations%rowtype; d jsonb;
begin
  perform public.guard_support_account_operation(p_id,p_lease);
  select * into v from public.lesson_support_account_operations where id=p_id and lease_id=p_lease and lease_until>now() and phase in('auth-pending','auth-ready','completed') for update;
  if not found then raise exception 'Operation changed' using errcode='PT409'; end if;
  perform 1 from public.lesson_support_students s join public.lesson_support_scopes c on c.support_project_ref=s.support_project_ref and c.organization_id=s.organization_id and c.data_table=s.data_table and c.campus_id=s.campus_id and c.enabled
    where s.support_project_ref=v.support_project_ref and s.organization_id=v.organization_id and s.data_table=v.data_table and s.student_id=v.student_id and s.support_child_id=v.child_id and s.support_link_id=v.link_id and s.enabled and s.campus_id=v.campus_id for share of s,c;
  if not found then raise exception 'Binding changed' using errcode='42501'; end if;
  execute format('select data from public.%I where id=$1 for update',v.data_table) into d using v.student_id;
  if d is null or coalesce(d->>'campusId',d->>'campus','main')<>v.campus_id or d->>'loginNumber'<>v.login_number
    or (coalesce(d->>'authUserId','')<>coalesce(v.original_primary,'') and coalesce(d->>'authUserId','')<>p_auth::text)
    then raise exception 'Learner changed' using errcode='PT409'; end if;
  if not exists(select 1 from auth.users where id=p_auth and lower(email)=lower(v.target_email) and raw_app_meta_data->>'lesson_credential_operation'=v.id::text
    and raw_user_meta_data->>'user_data_id'=v.student_id)
    or exists(select 1 from public.lesson_user_access where auth_user_id=p_auth and (user_data_id<>v.student_id or role<>'student'))
    or exists(select 1 from public.lesson_user_access where user_data_id=v.student_id and auth_user_id<>p_auth)
    or (v.auth_user_id is not null and v.auth_user_id<>p_auth) then raise exception 'Auth changed' using errcode='PT409'; end if;
  if v.phase<>'completed' then
    insert into public.lesson_user_access(auth_user_id,user_data_id,role,scope_type,scope_value) values(p_auth,v.student_id,'student','all','') on conflict(auth_user_id,user_data_id) do nothing;
    d:=jsonb_set(jsonb_set(d,'{authUserId}',to_jsonb(p_auth::text)),'{authPasscodeIssuedAt}',to_jsonb(to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
    execute format('update public.%I set data=$1 where id=$2',v.data_table) using d,v.student_id;
    update public.lesson_support_account_operations set auth_user_id=p_auth,phase='completed',finished_at=now(),error_code=null,updated_at=now() where id=v.id;
  end if;
end; $$;

revoke all on function public.claim_support_account_operation(jsonb),public.lookup_support_account_email(text),public.prepare_support_account_operation(uuid,uuid,uuid,text,text),public.guard_support_account_operation(uuid,uuid),public.complete_support_account_operation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_support_account_operation(jsonb),public.lookup_support_account_email(text),public.prepare_support_account_operation(uuid,uuid,uuid,text,text),public.guard_support_account_operation(uuid,uuid),public.complete_support_account_operation(uuid,uuid,uuid) to service_role;
commit;
