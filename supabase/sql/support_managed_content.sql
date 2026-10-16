begin;
create table if not exists public.lesson_campus_content (
 data_table text not null check(data_table in('user_data','test_user_data')),
 campus_id text not null check(length(campus_id) between 1 and 80 and campus_id<>'public'),
 support_project_ref text not null, organization_id uuid not null,
 content jsonb not null, revision integer not null check(revision>0), updated_at timestamptz not null default now(),
 primary key(data_table,campus_id),
 foreign key(support_project_ref,organization_id,data_table,campus_id)
 references public.lesson_support_scopes(support_project_ref,organization_id,data_table,campus_id)
);
alter table public.lesson_campus_content enable row level security;
revoke all on public.lesson_campus_content from public,anon,authenticated;
grant select(data_table,campus_id,content) on public.lesson_campus_content to authenticated;
grant all on public.lesson_campus_content to service_role;
create or replace function public.can_read_own_lesson_campus_content(p_table text,p_campus text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid() and
  (a.role='admin' or (a.role='student' and exists(select 1 from public.lesson_support_students s
   where s.student_id=a.user_data_id and s.data_table=p_table and s.campus_id=p_campus and s.enabled))));
$$;
revoke all on function public.can_read_own_lesson_campus_content(text,text) from public,anon;
grant execute on function public.can_read_own_lesson_campus_content(text,text) to authenticated;
drop policy if exists lesson_campus_content_read on public.lesson_campus_content;
create policy lesson_campus_content_read on public.lesson_campus_content for select to authenticated using(
 public.can_read_own_lesson_campus_content(data_table,campus_id)
 or (exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid() and a.role='teacher') and (
 (data_table='user_data' and exists(select 1 from public.user_data u where u.id like 'student\_%' escape '\'
   and coalesce(nullif(u.data->>'campusId',''),nullif(u.data->>'campus',''),'main')=campus_id))
 or (data_table='test_user_data' and exists(select 1 from public.test_user_data u where u.id like 'student\_%' escape '\'
   and coalesce(nullif(u.data->>'campusId',''),nullif(u.data->>'campus',''),'main')=campus_id))
 ))
);
create table if not exists public.lesson_reward_grants (
 data_table text not null, campus_id text not null, student_id text not null, reward_id text not null,
 at timestamptz not null default now(), primary key(data_table,student_id,reward_id),
 foreign key(data_table,campus_id) references public.lesson_campus_content(data_table,campus_id) on delete restrict
);
alter table public.lesson_reward_grants enable row level security;
revoke all on public.lesson_reward_grants from public,anon,authenticated;
grant select(data_table,student_id,reward_id) on public.lesson_reward_grants to authenticated;
grant all on public.lesson_reward_grants to service_role;
drop policy if exists lesson_reward_grants_read on public.lesson_reward_grants;
create policy lesson_reward_grants_read on public.lesson_reward_grants for select to authenticated using(
 (data_table='user_data' and exists(select 1 from public.user_data u where u.id=student_id))
 or (data_table='test_user_data' and exists(select 1 from public.test_user_data u where u.id=student_id))
);
create table if not exists public.lesson_content_operations (
 id uuid primary key, support_project_ref text not null, organization_id uuid not null, actor_id uuid not null,
 data_table text not null, campus_id text not null, kind text not null, item_id text not null,
 request_hash text not null, revision integer not null, gifted_count integer not null default 0,
 at timestamptz not null default now()
);
alter table public.lesson_content_operations enable row level security;
revoke all on public.lesson_content_operations from public,anon,authenticated;
grant all on public.lesson_content_operations to service_role;

create or replace function public.manage_support_content(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_project text:=p->>'supportProjectRef'; v_org uuid:=(p->>'organizationId')::uuid;
 v_table text:=p->>'dataTable'; v_campus text:=p->>'campusId'; v_actor uuid:=(p->>'actorId')::uuid;
 v_content jsonb; v_global jsonb; v_row public.lesson_campus_content%rowtype;
 v_op public.lesson_content_operations%rowtype; v_kind text:=p->>'kind'; v_item jsonb:=p->'item';
 v_old jsonb; v_hash text; v_request text; v_revision integer:=0; v_gifts integer:=0;
begin
 if v_table not in('user_data','test_user_data') or v_actor is null or v_org is null or v_project !~ '^[a-z0-9]{20}$'
  or p->>'action' not in('list','get','save') then raise exception '操作を確認してください。' using errcode='22023'; end if;
 if p->>'action'='list' then
  return jsonb_build_object('campuses',coalesce((select jsonb_agg(jsonb_build_object('id',s.campus_id,'name',coalesce((select c.name from public.lesson_campuses c where c.id=s.campus_id),s.campus_id)) order by s.campus_id)
   from public.lesson_support_scopes s where s.support_project_ref=v_project and s.organization_id=v_org and s.data_table=v_table and s.enabled
   and not exists(select 1 from public.lesson_support_scopes other where other.data_table=s.data_table and other.campus_id=s.campus_id and other.enabled
    and (other.support_project_ref<>v_project or other.organization_id<>v_org))
   and not exists(select 1 from public.lesson_campus_content c where c.data_table=s.data_table and c.campus_id=s.campus_id
    and (c.support_project_ref<>v_project or c.organization_id<>v_org))), '[]'::jsonb));
 end if;
 perform pg_advisory_xact_lock(hashtextextended('lesson-content:'||v_table||':'||v_campus,0));
 perform 1 from public.lesson_support_scopes where support_project_ref=v_project and organization_id=v_org and data_table=v_table and campus_id=v_campus and enabled for share;
 if not found or v_campus='public' or exists(select 1 from public.lesson_support_scopes where data_table=v_table and campus_id=v_campus and enabled
  and (support_project_ref<>v_project or organization_id<>v_org)) then raise exception '校舎の専用連携許可を確認してください。' using errcode='42501'; end if;
 select * into v_row from public.lesson_campus_content where data_table=v_table and campus_id=v_campus for update;
 if found then
  if v_row.support_project_ref<>v_project or v_row.organization_id<>v_org then raise exception '校舎の管理元が一致しません。' using errcode='42501'; end if;
  v_content:=v_row.content; v_revision:=v_row.revision;
 else
  select data into v_global from public.lesson_settings where key=v_table||':global' for share;
  if v_global is null then execute format('select data from public.%I where id=$1 for share',v_table) into v_global using '__GLOBAL_SETTINGS__'; end if;
  v_content:=jsonb_build_object('textTasks',coalesce(v_global->'textTasks','[]'::jsonb),
   'customThemes',coalesce(v_global#>'{globalMistakes,customThemes}','[]'::jsonb),
   'customEffects',coalesce(v_global#>'{globalMistakes,customEffects}','[]'::jsonb));
 end if;
 v_hash:=md5(v_content::text);
 if p->>'action'='get' then return jsonb_build_object('campusId',v_campus,'revision',v_revision,'fingerprint',v_hash,'content',v_content); end if;
 if v_kind not in('textTasks','customThemes','customEffects') or jsonb_typeof(v_item)<>'object'
  or coalesce(v_item->>'id','') !~ '^[A-Za-z0-9_-]{1,100}$' or length(v_item::text)>130000
  or jsonb_typeof(v_item->'hidden')<>'boolean' then raise exception '教材の内容を確認してください。' using errcode='22023'; end if;
 if v_kind='textTasks' then
  if length(coalesce(v_item->>'title','')) not between 1 and 160 or length(coalesce(v_item->>'content','')) not between 1 and 20000
   or coalesce(v_item->>'time','') !~ '^([1-9]|[1-5][0-9]|60)$' or coalesce(v_item->>'star','') !~ '^[1-5]$'
   or length(coalesce(v_item->>'targetGroup',''))>80 then raise exception '文章課題を確認してください。' using errcode='22023'; end if;
 else
  if length(coalesce(v_item->>'name','')) not between 1 and 80 or coalesce(v_item->>'distribution','') not in('present','gacha')
   or left(v_item->>'id',3)<>(case when v_kind='customThemes' then 'ct_' else 'ce_' end)
   then raise exception 'ごほうびを確認してください。' using errcode='22023'; end if;
  if v_kind='customThemes' and (coalesce(v_item->>'bg','') !~ '^#[a-fA-F0-9]{6}$' or coalesce(v_item->>'text','') !~ '^#[a-fA-F0-9]{6}$'
   or coalesce(v_item->>'btnBg','') !~ '^#[a-fA-F0-9]{6}$' or coalesce(v_item->>'btnText','') !~ '^#[a-fA-F0-9]{6}$') then raise exception '色を確認してください。' using errcode='22023'; end if;
  if v_kind='customEffects' and (jsonb_typeof(v_item->'emojis')<>'array' or jsonb_array_length(v_item->'emojis') not between 1 and 3
   or exists(select 1 from jsonb_array_elements(v_item->'emojis') e where jsonb_typeof(e)<>'string' or length(e#>>'{}') not between 1 and 32)) then raise exception '演出を確認してください。' using errcode='22023'; end if;
 end if;
 v_request:=md5(jsonb_build_array(v_project,v_org,v_table,v_campus,v_actor,v_kind,v_item,p->'revision',p->'fingerprint')::text);
 select * into v_op from public.lesson_content_operations where id=(p->>'operationId')::uuid;
 if found then
  if v_op.request_hash<>v_request or v_op.revision<>v_revision then raise exception '保存済み操作または内容が変わっています。再取得してください。' using errcode='PT409'; end if;
  return jsonb_build_object('campusId',v_campus,'revision',v_revision,'fingerprint',v_hash,'content',v_content,'operationId',v_op.id,'giftedCount',v_op.gifted_count);
 end if;
 if (p->>'revision')::integer is distinct from v_revision or p->>'fingerprint' is distinct from v_hash then raise exception '別の変更があります。再取得して確認してください。' using errcode='PT409'; end if;
 if (select count(*) from public.lesson_content_operations where actor_id=v_actor and at>now()-interval '15 minutes')>=30 then raise exception 'しばらく待ってください。' using errcode='PT429'; end if;
 select e into v_old from jsonb_array_elements(v_content->v_kind) e where e->>'id'=v_item->>'id';
 if v_old is null and v_kind<>'textTasks' and v_item->>'distribution'='present' and (v_item->>'hidden')::boolean then raise exception 'プレゼントは表示する状態で作成してください。' using errcode='22023'; end if;
 if v_old is null and jsonb_array_length(v_content->v_kind)>=(case when v_kind='textTasks' then 300 else 100 end) then raise exception '作成数の上限です。' using errcode='22023'; end if;
 if v_old is not null and v_kind<>'textTasks' and coalesce(v_old->>'distribution','gacha')<>v_item->>'distribution' then raise exception '配布方法は変更できません。' using errcode='22023'; end if;
 v_content:=jsonb_set(v_content,array[v_kind],case when v_old is null then (v_content->v_kind)||jsonb_build_array(v_item)
  else (select jsonb_agg(case when e->>'id'=v_item->>'id' then v_item else e end order by ord) from jsonb_array_elements(v_content->v_kind) with ordinality t(e,ord)) end);
 v_revision:=v_revision+1;
 insert into public.lesson_campus_content values(v_table,v_campus,v_project,v_org,v_content,v_revision,now())
 on conflict(data_table,campus_id) do update set content=excluded.content,revision=excluded.revision,updated_at=excluded.updated_at;
 -- Keep gifts outside the progress JSON so an already-open learner tab cannot erase them.
 if v_old is null and v_kind<>'textTasks' and v_item->>'distribution'='present' and not (v_item->>'hidden')::boolean then
  execute format('insert into public.lesson_reward_grants(data_table,campus_id,student_id,reward_id)
   select $4,$5,u.id,$1 from public.%I u
   where u.id in(select student_id from public.lesson_support_students where support_project_ref=$2 and organization_id=$3 and data_table=$4 and campus_id=$5 and enabled and support_link_id is not null and support_child_id is not null)
   and coalesce(nullif(u.data->>''campusId'',''''),nullif(u.data->>''campus'',''''),''main'')=$5
   and coalesce(u.data->>''publicRegistration'',''false'')<>''true'' and coalesce(u.data->>''isGuest'',''false'')<>''true''
   and coalesce(u.data->>''isMaster'',''false'')<>''true'' on conflict do nothing',v_table)
   using v_item->>'id',v_project,v_org,v_table,v_campus;
  get diagnostics v_gifts=row_count;
 end if;
 insert into public.lesson_content_operations(id,support_project_ref,organization_id,actor_id,data_table,campus_id,kind,item_id,request_hash,revision,gifted_count)
 values((p->>'operationId')::uuid,v_project,v_org,v_actor,v_table,v_campus,v_kind,v_item->>'id',v_request,v_revision,v_gifts);
 return jsonb_build_object('campusId',v_campus,'revision',v_revision,'fingerprint',md5(v_content::text),'content',v_content,'operationId',p->>'operationId','giftedCount',v_gifts);
end; $$;
revoke all on function public.manage_support_content(jsonb) from public,anon,authenticated;
grant execute on function public.manage_support_content(jsonb) to service_role;
commit;
