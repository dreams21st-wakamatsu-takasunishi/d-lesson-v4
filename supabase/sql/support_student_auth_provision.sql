begin;
create or replace function public.provision_support_student_access(p_student text,p_actor uuid,p_campus text,p_number text)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_data jsonb;v_metadata jsonb;
begin
  select data into v_data from public.user_data where id=p_student for update;
  select raw_user_meta_data into v_metadata from auth.users where id=p_actor;
  if p_student !~ '^student_[A-Za-z0-9_-]{1,140}$' or v_data is null or v_metadata is null
    or coalesce(v_data->>'campusId',v_data->>'campus','main')<>p_campus or v_data->>'loginNumber' is distinct from p_number
    or p_campus not in('main','wakamatsu-takasunishi') or coalesce(v_data->>'publicRegistration','false')='true'
    or coalesce(v_data->>'isGuest','false')='true' or coalesce(v_data->>'isMaster','false')='true'
    or v_metadata->>'user_data_id' is distinct from p_student or v_metadata->>'campus_id' is distinct from p_campus
    or v_metadata->>'login_number' is distinct from p_number then
    raise exception '児童本人のAuth・校舎・児童番号を確認してください。' using errcode='42501';
  end if;
  if exists(select 1 from public.lesson_user_access where auth_user_id=p_actor and (role<>'student' or user_data_id<>p_student))
    or exists(select 1 from public.lesson_user_access where user_data_id=p_student and role='student' and auth_user_id<>p_actor) then
    raise exception '既存のAuth連携が異なります。' using errcode='PT409';
  end if;
  insert into public.lesson_user_access(auth_user_id,user_data_id,role,scope_type,scope_value)
    values(p_actor,p_student,'student','all','') on conflict(auth_user_id,user_data_id) do nothing;
  update public.user_data set data=jsonb_set(jsonb_set(data,'{authUserId}',to_jsonb(p_actor::text)),'{userDataId}',to_jsonb(p_student)) where id=p_student;
end; $$;
revoke all on function public.provision_support_student_access(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.provision_support_student_access(text,uuid,text,text) to service_role;
commit;
