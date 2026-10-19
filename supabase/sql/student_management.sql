-- Run before releasing the new UI. No learner/Auth IDs, memberships or progress are migrated.
begin;
alter table public.lesson_campuses add column if not exists registration_enabled boolean not null default true;

-- One authoritative registry. Abort on conflicting IDs/codes rather than guessing.
do $$
declare c jsonb;
begin
 for c in select value from public.lesson_settings s
   cross join lateral jsonb_array_elements(coalesce(s.data->'campuses','[]'::jsonb))
   where s.key='user_data:global'
 loop
   if coalesce(c->>'id','')='' or coalesce(c->>'name','')='' or coalesce(c->>'code',c->>'id','')='' then
     raise exception 'CAMPUS_REGISTRY_INVALID';
   end if;
   if exists(select 1 from public.lesson_campuses r where r.id=c->>'id'
      and (r.name is distinct from c->>'name' or r.code is distinct from coalesce(c->>'code',c->>'id')))
      or exists(select 1 from public.lesson_campuses r where r.code=coalesce(c->>'code',c->>'id') and r.id<>c->>'id') then
     raise exception 'CAMPUS_REGISTRY_CONFLICT';
   end if;
   insert into public.lesson_campuses(id,name,code) values(c->>'id',c->>'name',coalesce(c->>'code',c->>'id'))
     on conflict(id) do nothing;
 end loop;
end $$;
-- Keep legacy/test accounts usable, but do not suggest the legacy default for new accounts.
update public.lesson_campuses set registration_enabled=false
where id='main' and exists(select 1 from public.lesson_campuses where id not in ('main','public') and active);

-- Classroom membership is separate from permission to share a child's records with D Support.
create table if not exists public.lesson_student_campuses (
 data_table text not null check(data_table in ('user_data','test_user_data')),
 student_id text not null, campus_id text not null references public.lesson_campuses(id),
 primary key(data_table,student_id)
);
alter table public.lesson_student_campuses enable row level security;
revoke all on public.lesson_student_campuses from public,anon,authenticated;
grant all on public.lesson_student_campuses to service_role;
do $$
declare t text;
begin
 foreach t in array array['user_data','test_user_data'] loop
   execute format($q$insert into public.lesson_student_campuses(data_table,student_id,campus_id)
    select distinct $1,u.id,c.id from public.%I u
    join public.lesson_campuses c on c.id=coalesce(nullif(u.data->>'campusId',''),nullif(u.data->>'campus',''),'main')
    join public.lesson_user_access a on a.user_data_id=u.id and a.role='student'
    join auth.users au on au.id=a.auth_user_id and au.id::text=u.data->>'authUserId'
      and au.raw_user_meta_data->>'campus_id'=c.id
    where u.id like 'student\_%%' escape '\' on conflict do nothing$q$,t) using t;
 end loop;
end $$;
create or replace function public.can_read_own_lesson_campus_content(p_table text,p_campus text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid() and
  (a.role='admin' or (a.role='student' and (
    exists(select 1 from public.lesson_student_campuses m where m.data_table=p_table and m.student_id=a.user_data_id and m.campus_id=p_campus)
    or exists(select 1 from public.lesson_support_students s where s.student_id=a.user_data_id and s.data_table=p_table and s.campus_id=p_campus and s.enabled)
  ))));
$$;
revoke all on function public.can_read_own_lesson_campus_content(text,text) from public,anon;
grant execute on function public.can_read_own_lesson_campus_content(text,text) to authenticated;

create or replace function public.patch_lesson_student(p_table text,p_student text,p_patch jsonb,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d jsonb; k text;
begin
 if p_table not in ('user_data','test_user_data') or p_student in ('__GLOBAL_SETTINGS__','Master_Debug')
    or jsonb_typeof(p_patch) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object'
    or p_patch='{}'::jsonb then raise exception 'INVALID_STUDENT_PATCH'; end if;
 execute format('select data from public.%I where id=$1 for update',p_table) into d using p_student;
 if d is null then raise exception 'STUDENT_NOT_FOUND'; end if;
 if not exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid()
   and (a.role='admin' or (a.role='teacher' and public.lesson_access_matches_student(d,a.scope_type,a.scope_value)))) then
   raise exception using errcode='42501',message='この児童を変更する権限がありません。';
 end if;
 for k in select jsonb_object_keys(p_patch) loop
   if k not in ('displayName','birthdate','grade','group','studentState') then raise exception 'FIELD_NOT_ALLOWED'; end if;
   if not (p_expected ? k) or coalesce(d->k,'null'::jsonb) is distinct from p_expected->k then
     raise exception using errcode='PT409',message='別の操作で情報が変更されました。再読み込みして確認してください。';
   end if;
   if jsonb_typeof(p_patch->k) is distinct from 'string' then raise exception 'INVALID_FIELD'; end if;
 end loop;
 if p_patch ? 'displayName' and (length(btrim(p_patch->>'displayName')) not between 1 and 100) then raise exception 'INVALID_NAME'; end if;
 if p_patch ? 'birthdate' then
   if (p_patch->>'birthdate') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_BIRTHDATE'; end if;
   perform (p_patch->>'birthdate')::date;
 end if;
 if p_patch ? 'studentState' and p_patch->>'studentState' not in ('active','paused','left') then raise exception 'INVALID_STATE'; end if;
 if length(coalesce(p_patch->>'group',''))>80 then raise exception 'INVALID_GROUP'; end if;
 d := d || p_patch;
 if not exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid()
   and (a.role='admin' or (a.role='teacher' and public.lesson_access_matches_student(d,a.scope_type,a.scope_value)))) then
   raise exception using errcode='42501',message='担当範囲外への変更は管理者が行ってください。';
 end if;
 execute format('update public.%I set data=$2 where id=$1',p_table) using p_student,d;
 return d;
end $$;
revoke all on function public.patch_lesson_student(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.patch_lesson_student(text,text,jsonb,jsonb) to authenticated;

create or replace function public.get_lesson_student_management_status(p_table text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if p_table not in ('user_data','test_user_data') then raise exception 'INVALID_TABLE'; end if;
 if not exists(select 1 from public.lesson_user_access where auth_user_id=auth.uid() and role in ('admin','teacher')) then
   raise exception using errcode='42501',message='職員権限が必要です。'; end if;
 execute format($q$select coalesce(jsonb_agg(jsonb_build_object('id',u.id,
   'loginReady',exists(select 1 from public.lesson_user_access a join auth.users au on au.id=a.auth_user_id
      where a.user_data_id=u.id and a.role='student' and (au.banned_until is null or au.banned_until<now())
      and au.id::text=u.data->>'authUserId'),
   'campusReady',exists(select 1 from public.lesson_student_campuses m where m.data_table=$1 and m.student_id=u.id
      and m.campus_id=coalesce(nullif(u.data->>'campusId',''),nullif(u.data->>'campus',''),'main'))
      or exists(select 1 from public.lesson_support_students s where s.data_table=$1 and s.student_id=u.id and s.enabled
      and s.campus_id=coalesce(nullif(u.data->>'campusId',''),nullif(u.data->>'campus',''),'main')),
   'supportLinked',exists(select 1 from public.lesson_support_students s where s.data_table=$1 and s.student_id=u.id
      and s.enabled and s.support_child_id is not null and s.support_link_id is not null)
  )),'[]'::jsonb) from public.%I u where u.id not in ('__GLOBAL_SETTINGS__','Master_Debug')
    and coalesce(u.data->>'isMaster','false')<>'true' and exists(select 1 from public.lesson_user_access a
      where a.auth_user_id=auth.uid() and (a.role='admin' or (a.role='teacher'
         and public.lesson_access_matches_student(u.data,a.scope_type,a.scope_value))))$q$,p_table)
 into result using p_table;
 return result;
end $$;
revoke all on function public.get_lesson_student_management_status(text) from public,anon;
grant execute on function public.get_lesson_student_management_status(text) to authenticated;

-- Service-only narrow write after Auth provisioning, preserving concurrent learning progress.
create or replace function public.patch_lesson_login_fields(p_table text,p_student text,p_patch jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare k text; affected integer;
begin
 if p_table not in ('user_data','test_user_data') or jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'INVALID_LOGIN_PATCH'; end if;
 for k in select jsonb_object_keys(p_patch) loop
   if k not in ('userDataId','campusId','loginNumber','authUserId','authPasscodeIssuedAt') then raise exception 'INVALID_LOGIN_FIELD'; end if;
 end loop;
 execute format('update public.%I set data=data || $2 where id=$1',p_table) using p_student,p_patch;
 get diagnostics affected = row_count;
 if affected<>1 then raise exception 'STUDENT_NOT_FOUND'; end if;
 if p_patch ? 'campusId' then
   insert into public.lesson_student_campuses(data_table,student_id,campus_id)
    values(p_table,p_student,p_patch->>'campusId') on conflict(data_table,student_id) do update set campus_id=excluded.campus_id;
 end if;
end $$;
revoke all on function public.patch_lesson_login_fields(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.patch_lesson_login_fields(text,text,jsonb) to service_role;

-- Do not let older learner tabs overwrite staff-managed identity/state fields.
create or replace function public.protect_lesson_student_identity()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare k text;
begin
 if auth.uid() is null or public.is_lesson_admin() then return new; end if;
 if exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid()
    and a.role='teacher' and public.lesson_access_matches_student(old.data,a.scope_type,a.scope_value)) then return new; end if;
 if coalesce(old.data->>'studentState','active') in ('paused','left') then
   raise exception using errcode='42501',message='利用休止・在籍終了のため保存できません。先生に確認してください。';
 end if;
 foreach k in array array['displayName','birthdate','birth','grade','group','campusId','campus','studentState','authUserId','loginNumber','userDataId','authPasscodeIssuedAt'] loop
   if old.data ? k then new.data := jsonb_set(new.data,array[k],old.data->k,true);
   else new.data := new.data-k; end if;
 end loop;
 return new;
end $$;
revoke all on function public.protect_lesson_student_identity() from public,anon,authenticated;
drop trigger if exists lesson_student_identity_guard on public.user_data;
create trigger lesson_student_identity_guard before update on public.user_data for each row execute function public.protect_lesson_student_identity();
drop trigger if exists lesson_student_identity_guard on public.test_user_data;
create trigger lesson_student_identity_guard before update on public.test_user_data for each row execute function public.protect_lesson_student_identity();
commit;
