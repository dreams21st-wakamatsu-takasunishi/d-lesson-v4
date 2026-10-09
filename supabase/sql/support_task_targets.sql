begin;
create or replace function public.read_support_task_targets(p_project text,p_org uuid,p_table text,p_targets jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if p_table not in('user_data','test_user_data') or p_project !~ '^[a-z0-9]{20}$' or p_org is null
  or jsonb_typeof(p_targets) is distinct from 'array' or jsonb_array_length(p_targets)>100 then
  raise exception '課題の対象を確認してください。' using errcode='22023';
 end if;
 execute format($query$
 select coalesce(jsonb_agg(jsonb_build_object('childId',r."childId",'linkId',r."linkId",'available',u.id is not null,
  'group',case when u.id is not null and jsonb_typeof(u.data->'group')='string' and length(btrim(u.data->>'group'))<=80 then btrim(u.data->>'group') else '' end)), '[]'::jsonb)
 from jsonb_to_recordset($1) as r("childId" text,"linkId" uuid,"studentId" text,"campusId" text)
 left join public.lesson_support_students p on p.support_project_ref=$2 and p.organization_id=$3 and p.data_table=$4
  and p.student_id=r."studentId" and p.enabled and p.support_link_id=r."linkId" and p.support_child_id=r."childId" and p.campus_id=r."campusId"
 left join public.lesson_support_scopes s on s.support_project_ref=$2 and s.organization_id=$3 and s.data_table=$4 and s.campus_id=p.campus_id and s.enabled
 left join public.%I u on s.enabled and u.id=r."studentId" and coalesce(u.data->>'campusId',u.data->>'campus','main')=p.campus_id and p.campus_id<>'public'
  and coalesce(u.data->>'isMaster','false')<>'true' and coalesce(u.data->>'isGuest','false')<>'true' and coalesce(u.data->>'publicRegistration','false')<>'true'
  and coalesce(u.data->>'registrationSource','')<>'public' and coalesce(u.data->>'registration_source','')<>'public' and coalesce(u.data->>'accountType','') not in('public','guest')
  and (u.data->'group' is null or jsonb_typeof(u.data->'group')='null' or (jsonb_typeof(u.data->'group')='string' and length(btrim(u.data->>'group'))<=80))
 $query$,p_table) into result using p_targets,p_project,p_org,p_table;
 return result;
end; $$;
revoke all on function public.read_support_task_targets(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.read_support_task_targets(text,uuid,text,jsonb) to service_role;
commit;
