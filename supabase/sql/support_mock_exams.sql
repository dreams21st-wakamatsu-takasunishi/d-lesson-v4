begin;
create table if not exists public.lesson_mock_exam_catalogs (
 data_table text not null check(data_table in('user_data','test_user_data')),
 campus_id text not null check(length(campus_id) between 1 and 80 and campus_id<>'public'),
 support_project_ref text not null, organization_id uuid not null,
 catalog jsonb not null check(jsonb_typeof(catalog)='array' and jsonb_array_length(catalog)<=100),
 revision integer not null check(revision>0), updated_at timestamptz not null default now(),
 primary key(data_table,campus_id),
 foreign key(support_project_ref,organization_id,data_table,campus_id)
 references public.lesson_support_scopes(support_project_ref,organization_id,data_table,campus_id)
);
alter table public.lesson_mock_exam_catalogs enable row level security;
revoke all on public.lesson_mock_exam_catalogs from public,anon,authenticated;
grant select(data_table,campus_id,catalog,revision,updated_at) on public.lesson_mock_exam_catalogs to authenticated;
grant all on public.lesson_mock_exam_catalogs to service_role;
drop policy if exists lesson_mock_exam_catalogs_read on public.lesson_mock_exam_catalogs;
create policy lesson_mock_exam_catalogs_read on public.lesson_mock_exam_catalogs for select to authenticated using (
 public.can_read_own_lesson_campus_content(data_table,campus_id)
 or (exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid() and a.role='teacher') and (
 (data_table='user_data' and exists(select 1 from public.user_data u where u.id like 'student\_%' escape '\' and coalesce(nullif(u.data->>'campusId',''),nullif(u.data->>'campus',''),'main')=campus_id))
 or (data_table='test_user_data' and exists(select 1 from public.test_user_data u where u.id like 'student\_%' escape '\' and coalesce(nullif(u.data->>'campusId',''),nullif(u.data->>'campus',''),'main')=campus_id))))
);
create table if not exists public.lesson_mock_exam_operations (
 id uuid primary key, support_project_ref text not null, organization_id uuid not null, actor_id uuid not null,
 data_table text not null, campus_id text not null, action text not null check(action in('create','update','delete')),
 item_id text not null, request_hash text not null, revision integer not null, at timestamptz not null default now()
);
alter table public.lesson_mock_exam_operations enable row level security;
revoke all on public.lesson_mock_exam_operations from public,anon,authenticated;
grant all on public.lesson_mock_exam_operations to service_role;
create index if not exists lesson_mock_exam_operations_actor_recent_idx on public.lesson_mock_exam_operations(actor_id,at desc);

create or replace function public.manage_support_mock_exams(p jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_project text:=p->>'supportProjectRef'; v_org uuid:=(p->>'organizationId')::uuid;
 v_actor uuid:=(p->>'actorId')::uuid; v_table text:=p->>'dataTable'; v_campus text:=p->>'campusId';
 v_action text:=p->>'action'; v_item jsonb:=p->'item'; v_id text;
 v_row public.lesson_mock_exam_catalogs%rowtype; v_op public.lesson_mock_exam_operations%rowtype;
 v_catalog jsonb; v_revision integer:=0; v_hash text; v_request text; v_exists boolean;
begin
 if v_table is null or v_table not in('user_data','test_user_data') or v_actor is null or v_org is null
  or v_project is null or v_project !~ '^[a-z0-9]{20}$' or v_campus is null or length(v_campus) not between 1 and 80
  or v_action is null or v_action not in('get','create','update','delete') then raise exception '操作を確認してください。' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('lesson-mock-exams:'||v_table||':'||v_campus,0));
 perform 1 from public.lesson_support_scopes where support_project_ref=v_project and organization_id=v_org and data_table=v_table and campus_id=v_campus and enabled for share;
 if not found or v_campus='public' or exists(select 1 from public.lesson_support_scopes where data_table=v_table and campus_id=v_campus and enabled and (support_project_ref<>v_project or organization_id<>v_org)) then raise exception '校舎の専用連携許可を確認してください。' using errcode='42501'; end if;
 select * into v_row from public.lesson_mock_exam_catalogs where data_table=v_table and campus_id=v_campus for update;
 if found then
  if v_row.support_project_ref<>v_project or v_row.organization_id<>v_org then raise exception '校舎の管理元が一致しません。' using errcode='42501'; end if;
  v_catalog:=v_row.catalog; v_revision:=v_row.revision;
 else v_catalog:=p->'defaults'; end if;
 if v_catalog is null or jsonb_typeof(v_catalog)<>'array' or jsonb_array_length(v_catalog)>100 then raise exception '問題一覧を確認してください。' using errcode='22023'; end if;
 v_hash:=md5(v_catalog::text);
 if v_action='get' then return jsonb_build_object('campusId',v_campus,'revision',v_revision,'fingerprint',v_hash,'catalog',v_catalog); end if;
 if coalesce(p->>'operationId','') !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$'
  or coalesce(p->>'revision','') !~ '^\d{1,9}$' or coalesce(p->>'fingerprint','') !~ '^[a-f0-9]{32}$' then raise exception '配信内容を再確認してください。' using errcode='22023'; end if;
 if v_action='delete' then v_id:=p->>'id';
 else
  if v_item is null or jsonb_typeof(v_item)<>'object' or coalesce(v_item->>'round','') !~ '^[1-9]\d{0,2}$'
   or jsonb_typeof(v_item->'round') is distinct from 'number' or coalesce(v_item->>'id','')<>'round-'||(v_item->>'round')
   or v_item->>'title' is distinct from '第'||(v_item->>'round')||'回過去問題'
   or jsonb_typeof(v_item->'reference') is distinct from 'string' or length(coalesce(v_item->>'reference','')) not between 1 and 6000
   or btrim(v_item->>'reference',E' \t\r\n　')='' or v_item->'permissionConfirmed' is distinct from 'true'::jsonb
   or jsonb_typeof(v_item->'hidden') is distinct from 'boolean' then raise exception '回数・本文・利用許諾を確認してください。' using errcode='22023'; end if;
  v_id:=v_item->>'id';
 end if;
 if v_id is null or v_id !~ '^round-[1-9]\d{0,2}$' then raise exception '対象問題を確認してください。' using errcode='22023'; end if;
 v_request:=md5(jsonb_build_array(v_project,v_org,v_actor,v_table,v_campus,v_action,v_id,v_item,p->'revision',p->'fingerprint')::text);
 select * into v_op from public.lesson_mock_exam_operations where id=(p->>'operationId')::uuid;
 if found then
  if v_op.request_hash<>v_request or v_op.revision<>v_revision then raise exception '保存済み操作または内容が変わっています。再取得してください。' using errcode='PT409'; end if;
  return jsonb_build_object('campusId',v_campus,'revision',v_revision,'fingerprint',v_hash,'catalog',v_catalog,'operationId',v_op.id);
 end if;
 if (p->>'revision')::integer is distinct from v_revision or p->>'fingerprint' is distinct from v_hash then raise exception '別の変更があります。再取得して確認してください。' using errcode='PT409'; end if;
 if (select count(*) from public.lesson_mock_exam_operations where actor_id=v_actor and at>now()-interval '15 minutes')>=30 then raise exception 'しばらく待ってください。' using errcode='PT429'; end if;
 select exists(select 1 from jsonb_array_elements(v_catalog) e where e->>'id'=v_id) into v_exists;
 if (v_action='create' and v_exists) or (v_action<>'create' and not v_exists) then raise exception '同じ回の問題が存在するか、削除されています。再取得してください。' using errcode='PT409'; end if;
 if v_action='create' and jsonb_array_length(v_catalog)>=100 then raise exception '問題数の上限です。' using errcode='22023'; end if;
 if v_action='create' then v_catalog:=v_catalog||jsonb_build_array(v_item);
 elsif v_action='delete' then select coalesce(jsonb_agg(e order by ord),'[]'::jsonb) into v_catalog from jsonb_array_elements(v_catalog) with ordinality t(e,ord) where e->>'id'<>v_id;
 else select jsonb_agg(case when e->>'id'=v_id then v_item else e end order by ord) into v_catalog from jsonb_array_elements(v_catalog) with ordinality t(e,ord); end if;
 v_revision:=v_revision+1;
 insert into public.lesson_mock_exam_catalogs values(v_table,v_campus,v_project,v_org,v_catalog,v_revision,now())
 on conflict(data_table,campus_id) do update set catalog=excluded.catalog,revision=excluded.revision,updated_at=excluded.updated_at;
 insert into public.lesson_mock_exam_operations(id,support_project_ref,organization_id,actor_id,data_table,campus_id,action,item_id,request_hash,revision)
 values((p->>'operationId')::uuid,v_project,v_org,v_actor,v_table,v_campus,v_action,v_id,v_request,v_revision);
 return jsonb_build_object('campusId',v_campus,'revision',v_revision,'fingerprint',md5(v_catalog::text),'catalog',v_catalog,'operationId',p->>'operationId');
end; $$;
revoke all on function public.manage_support_mock_exams(jsonb) from public,anon,authenticated;
grant execute on function public.manage_support_mock_exams(jsonb) to service_role;
commit;
