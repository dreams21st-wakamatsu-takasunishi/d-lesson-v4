begin;
-- Office-only lifecycle metadata. Learning results and Auth records are never deleted.
create table if not exists public.lesson_support_archives(
 data_table text not null check(data_table in('user_data','test_user_data')),
 student_id text not null,
 support_project_ref text not null,
 organization_id uuid not null,
 child_id text not null,
 link_id uuid not null,
 revision integer not null default 1 check(revision>0),
 archived boolean not null default false,
 previous_state text,
 accesses jsonb not null default '[]',
 actor_id uuid not null,
 updated_at timestamptz not null default now(),
 primary key(data_table,student_id)
);
create table if not exists public.lesson_support_lifecycle_audit(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, support_project_ref text not null,
 data_table text not null, student_id text not null, child_id text not null, link_id uuid not null,
 actor_id uuid not null, action text not null check(action in('archive','restore')), at timestamptz not null default now()
);
alter table public.lesson_support_archives enable row level security;
alter table public.lesson_support_lifecycle_audit enable row level security;
revoke all on public.lesson_support_archives,public.lesson_support_lifecycle_audit from public,anon,authenticated;
grant all on public.lesson_support_archives,public.lesson_support_lifecycle_audit to service_role;

create or replace function public.manage_support_student(p jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 permission public.lesson_support_students%rowtype;
 v public.lesson_support_archives%rowtype;
 d jsonb; saved_access jsonb; next_revision integer; cmd text:=p->>'action'; next_state text;
begin
 if cmd is null or cmd not in ('status','archive','restore') or p->>'table' not in ('user_data','test_user_data')
   or nullif(p->>'actor','') is null then raise exception 'INVALID_ACTION' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('lesson-credential:'||(p->>'table')||':'||(p->>'student'),0));
 select s.* into permission from public.lesson_support_students s
   join public.lesson_support_scopes c using(support_project_ref,organization_id,data_table,campus_id)
   where s.support_project_ref=p->>'project' and s.organization_id=(p->>'org')::uuid and s.data_table=p->>'table'
     and s.student_id=p->>'student' and s.support_child_id=p->>'child' and s.support_link_id=(p->>'link')::uuid
     and s.enabled and c.enabled for share of s,c;
 if not found then raise exception 'BINDING_CHANGED' using errcode='42501'; end if;
 execute format('select data from public.%I where id=$1 for update',p->>'table') into d using p->>'student';
 if d is null or coalesce(d->>'campusId',d->>'campus','main')<>permission.campus_id
   or permission.campus_id is distinct from p->>'campus'
   or coalesce(d->>'isMaster','false')='true' or coalesce(d->>'isGuest','false')='true'
   or coalesce(d->>'publicRegistration','false')='true' or coalesce(d->>'accountType','') in ('public','guest')
   then raise exception 'LEARNER_CHANGED' using errcode='PT409'; end if;
 select * into v from public.lesson_support_archives where data_table=p->>'table' and student_id=p->>'student' for update;
 if v.student_id is not null and (v.organization_id<>permission.organization_id or v.support_project_ref<>permission.support_project_ref
   or v.child_id<>permission.support_child_id or v.link_id<>permission.support_link_id) then
   raise exception 'ARCHIVE_BINDING_CHANGED' using errcode='PT409'; end if;
 if cmd<>'status' then
   if p->>'expectedRevision' is null or (p->>'expectedRevision')::integer<>coalesce(v.revision,0)
     then raise exception 'REVISION_CHANGED' using errcode='PT409'; end if;
   if exists(select 1 from public.lesson_support_account_operations where data_table=p->>'table' and student_id=p->>'student'
     and phase not in ('completed','denied')) then raise exception 'CREDENTIAL_PENDING' using errcode='PT423'; end if;
   if cmd='archive' then
     if coalesce(v.archived,false) then raise exception 'ALREADY_ARCHIVED' using errcode='PT409'; end if;
     select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into saved_access from public.lesson_user_access a where a.user_data_id=p->>'student';
     if jsonb_array_length(saved_access)>10 or exists(select 1 from public.lesson_user_access a where a.user_data_id=p->>'student' and (
       a.role<>'student' or exists(select 1 from public.lesson_user_access other where other.auth_user_id=a.auth_user_id and (other.user_data_id<>a.user_data_id or other.role<>'student'))))
       then raise exception 'AUTH_OWNERSHIP_CONFLICT' using errcode='PT409'; end if;
     next_revision:=coalesce(v.revision,0)+1;
     insert into public.lesson_support_archives(data_table,student_id,support_project_ref,organization_id,child_id,link_id,revision,archived,previous_state,accesses,actor_id)
       values(p->>'table',p->>'student',permission.support_project_ref,permission.organization_id,permission.support_child_id,permission.support_link_id,
       next_revision,true,d->>'studentState',saved_access,(p->>'actor')::uuid)
       on conflict(data_table,student_id) do update set revision=excluded.revision,archived=true,previous_state=excluded.previous_state,
         accesses=excluded.accesses,actor_id=excluded.actor_id,updated_at=now();
     delete from public.lesson_user_access where user_data_id=p->>'student' and role='student';
     next_state:='left';
   else
     if v.student_id is null or not v.archived then raise exception 'NOT_ARCHIVED' using errcode='PT409'; end if;
     if exists(select 1 from public.lesson_user_access where user_data_id=p->>'student')
       or exists(select 1 from jsonb_array_elements(v.accesses) x
         where not exists(select 1 from auth.users where id=(x->>'auth_user_id')::uuid)
         or exists(select 1 from public.lesson_user_access where auth_user_id=(x->>'auth_user_id')::uuid))
       then raise exception 'RESTORE_OWNERSHIP_CONFLICT' using errcode='PT409'; end if;
     insert into public.lesson_user_access(auth_user_id,user_data_id,role,scope_type,scope_value)
       select (x->>'auth_user_id')::uuid,p->>'student','student',x->>'scope_type',x->>'scope_value'
       from jsonb_array_elements(v.accesses) x;
     update public.lesson_support_archives set archived=false,revision=revision+1,actor_id=(p->>'actor')::uuid,updated_at=now()
       where data_table=v.data_table and student_id=v.student_id;
     next_state:=v.previous_state;
   end if;
   execute format('update public.%I set data=case when $2::text is null then data-''studentState'' else jsonb_set(data,''{studentState}'',to_jsonb($2::text)) end where id=$1',p->>'table')
     using p->>'student',next_state;
   insert into public.lesson_support_lifecycle_audit(organization_id,support_project_ref,data_table,student_id,child_id,link_id,actor_id,action)
     values(permission.organization_id,permission.support_project_ref,p->>'table',p->>'student',permission.support_child_id,permission.support_link_id,(p->>'actor')::uuid,cmd);
   select * into v from public.lesson_support_archives where data_table=p->>'table' and student_id=p->>'student';
 end if;
 return jsonb_build_object('childId',permission.support_child_id,'linkId',permission.support_link_id,'revision',coalesce(v.revision,0),
   'archived',coalesce(v.archived,false),'loginNumber',coalesce(d->>'loginNumber',''),'lastIssuedAt',d->'authPasscodeIssuedAt');
end $$;
revoke all on function public.manage_support_student(jsonb) from public,anon,authenticated;
grant execute on function public.manage_support_student(jsonb) to service_role;
commit;
