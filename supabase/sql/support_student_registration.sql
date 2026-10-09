begin;
create table if not exists public.lesson_support_registrations (
  id uuid primary key, support_project_ref text not null, organization_id uuid not null,
  data_table text not null check(data_table in('user_data','test_user_data')),
  child_id text not null, link_id uuid not null, actor_id uuid not null,
  campus_id text not null, student_id text not null unique, login_number integer not null check(login_number between 1 and 50),
  display_name text not null, birth_date date not null, at timestamptz not null default now(),
  unique(support_project_ref,organization_id,child_id), unique(data_table,campus_id,login_number)
);
alter table public.lesson_support_registrations enable row level security;
revoke all on public.lesson_support_registrations from public,anon,authenticated;
grant all on public.lesson_support_registrations to service_role;

create or replace function public.prepare_support_student_registration(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.lesson_support_registrations%rowtype; d jsonb; n integer; used boolean; v_email text; candidate integer; student text;
begin
  if p->>'table' not in('user_data','test_user_data') or nullif(btrim(p->>'name'),'') is null or length(p->>'name')>160
    or p->>'birth' !~ '^\d{4}-\d{2}-\d{2}$' or (p->>'birth')::date>current_date
    or p->>'campus' !~ '^[a-zA-Z0-9_-]{1,80}$' or p->>'campus'='public'
    or p->>'code' !~ '^[a-zA-Z0-9_-]{1,80}$' or p->>'prefix' !~ '^[a-zA-Z0-9_-]{1,80}$'
    or p->>'domain' !~ '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' or (p->>'pad')::integer not between 1 and 8
    then raise exception 'Invalid registration' using errcode='PT422'; end if;
  perform pg_advisory_xact_lock(hashtextextended('lesson-register-child:'||(p->>'project')||':'||(p->>'org')||':'||(p->>'child'),0));
  perform pg_advisory_xact_lock(hashtextextended('lesson-register-table:'||(p->>'table'),0));
  perform pg_advisory_xact_lock(hashtextextended('lesson-register-campus:'||(p->>'table')||':'||(p->>'campus'),0));
  perform 1 from public.lesson_support_scopes where support_project_ref=p->>'project' and organization_id=(p->>'org')::uuid and data_table=p->>'table' and campus_id=p->>'campus' and enabled for share;
  if not found then raise exception 'Campus not authorized' using errcode='42501'; end if;
  student:='student_support_'||replace((p->>'id')::uuid::text,'-','');
  select * into v from public.lesson_support_registrations where id=(p->>'id')::uuid for update;
  if found then
    if v.support_project_ref<>p->>'project' or v.organization_id<>(p->>'org')::uuid or v.child_id<>p->>'child' or v.link_id<>(p->>'link')::uuid
      or v.actor_id<>(p->>'actor')::uuid or v.campus_id<>p->>'campus' or v.data_table<>p->>'table' or v.display_name<>p->>'name' or v.birth_date<>(p->>'birth')::date
      then raise exception 'Registration changed' using errcode='PT409'; end if;
    execute format('select data from public.%I where id=$1',v.data_table) into d using v.student_id;
    if d is null or d->>'userDataId' is distinct from v.student_id or d->>'displayName' is distinct from v.display_name or d->>'birthdate' is distinct from v.birth_date::text
      or d->>'campusId' is distinct from v.campus_id or d->>'loginNumber' is distinct from v.login_number::text
      or not exists(select 1 from public.lesson_support_students where support_project_ref=v.support_project_ref and organization_id=v.organization_id and data_table=v.data_table and student_id=v.student_id and campus_id=v.campus_id and support_child_id=v.child_id and support_link_id=v.link_id and enabled)
      then raise exception 'Existing registration needs review' using errcode='PT409'; end if;
    return jsonb_build_object('studentId',v.student_id,'loginNumber',v.login_number::text,'dataTable',v.data_table,'campusId',v.campus_id,'displayName',v.display_name,'birthDate',v.birth_date::text);
  end if;
  if exists(select 1 from public.lesson_support_registrations where support_project_ref=p->>'project' and organization_id=(p->>'org')::uuid and child_id=p->>'child')
    or exists(select 1 from public.lesson_support_students where support_project_ref=p->>'project' and organization_id=(p->>'org')::uuid and support_child_id=p->>'child')
    then raise exception 'Existing child binding' using errcode='PT409'; end if;
  -- Do not infer a new identity when the same name/birthday (or a missing birthday) exists.
  execute format('select exists(select 1 from public.%I where id like ''student_%%'' and coalesce(data->>''campusId'',data->>''campus'',''main'')<>''public''
    and regexp_replace(normalize(coalesce(data->>''displayName'',data->>''name'',data->>''studentName'',''''),NFKC),''[[:space:]　]+'','''',''g'')=regexp_replace(normalize($1,NFKC),''[[:space:]　]+'','''',''g'')
    and (nullif(coalesce(data->>''birthdate'',data->>''birth'',''''),'''') is null or coalesce(data->>''birthdate'',data->>''birth'')=$2))',p->>'table') into used using p->>'name',p->>'birth';
  if used then raise exception 'Existing learner needs verification' using errcode='PT412'; end if;
  for candidate in 1..50 loop
    execute format('select exists(select 1 from public.%I where coalesce(data->>''campusId'',data->>''campus'',''main'')=$1
      and case when data->>''loginNumber'' ~ ''^\d{1,3}$'' then (data->>''loginNumber'')::integer end=$2)',p->>'table') into used using p->>'campus',candidate;
    if used or exists(select 1 from public.lesson_support_registrations where data_table=p->>'table' and campus_id=p->>'campus' and login_number=candidate) then continue; end if;
    v_email:=lower((p->>'prefix')||(p->>'code')||'-'||lpad(candidate::text,greatest(length(candidate::text),(p->>'pad')::integer),'0')||'@'||(p->>'domain'));
    if exists(select 1 from auth.users where lower(auth.users.email) in(v_email,
      lower((p->>'prefix')||lpad(candidate::text,greatest(length(candidate::text),(p->>'pad')::integer),'0')||'@'||(p->>'domain')),
      lower((p->>'prefix')||(p->>'campus')||'-'||lpad(candidate::text,greatest(length(candidate::text),(p->>'pad')::integer),'0')||'@'||(p->>'domain')))) then continue; end if;
    n:=candidate; exit;
  end loop;
  if n is null then raise exception 'No classroom number available' using errcode='PT422'; end if;
  d:=jsonb_build_object('displayName',p->>'name','userDataId',student,'birthdate',p->>'birth','campusId',p->>'campus','loginNumber',n::text,'group','',
    'mouseLevel',0,'keyboardSequence',0,'coins',0,'items','[]'::jsonb,'tickets','[]'::jsonb,'loginStamps','[]'::jsonb,
    'practiceLogs','[]'::jsonb,'visionCleared','[]'::jsonb,'wordProgress','{}'::jsonb,'examRecords','{}'::jsonb,'globalMistakes','{}'::jsonb);
  execute format('insert into public.%I(id,data) values($1,$2)',p->>'table') using student,d;
  insert into public.lesson_support_students(support_project_ref,organization_id,data_table,campus_id,student_id,enabled)
    values(p->>'project',(p->>'org')::uuid,p->>'table',p->>'campus',student,true);
  perform public.bind_support_word_student(p->>'project',(p->>'org')::uuid,p->>'table',student,(p->>'link')::uuid,p->>'child',true);
  insert into public.lesson_support_registrations(id,support_project_ref,organization_id,data_table,child_id,link_id,actor_id,campus_id,student_id,login_number,display_name,birth_date)
    values((p->>'id')::uuid,p->>'project',(p->>'org')::uuid,p->>'table',p->>'child',(p->>'link')::uuid,(p->>'actor')::uuid,p->>'campus',student,n,p->>'name',(p->>'birth')::date);
  return jsonb_build_object('studentId',student,'loginNumber',n::text,'dataTable',p->>'table','campusId',p->>'campus','displayName',p->>'name','birthDate',p->>'birth');
end; $$;
revoke all on function public.prepare_support_student_registration(jsonb) from public,anon,authenticated;
grant execute on function public.prepare_support_student_registration(jsonb) to service_role;
commit;
