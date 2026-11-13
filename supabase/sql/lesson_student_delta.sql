begin;
-- SECURITY INVOKER: both reads and writes remain subject to the existing row policies and triggers.
create or replace function public.read_own_lesson_snapshot(p_table text,p_id text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v jsonb;
begin
 if p_table is null or p_table not in ('user_data','test_user_data') or p_id is null
   or p_id in ('__GLOBAL_SETTINGS__','Master_Debug')
   or not exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid() and a.role='student' and a.user_data_id=p_id)
 then raise insufficient_privilege; end if;
 execute pg_catalog.format('select jsonb_build_object(''data'',data,''revision'',xmin::text) from public.%I where id=$1',p_table)
   into v using p_id;
 return v;
end $$;

create or replace function public.patch_own_lesson_snapshot(
 p_table text,p_id text,p_revision text,p_patch jsonb,p_removed text[]
) returns text language plpgsql security invoker set search_path='' as $$
declare v_revision text;
begin
 if p_table is null or p_table not in ('user_data','test_user_data') or p_id is null
   or p_id in ('__GLOBAL_SETTINGS__','Master_Debug')
   or not exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid() and a.role='student' and a.user_data_id=p_id)
 then raise insufficient_privilege; end if;
 if p_revision is null or p_revision !~ '^[0-9]{1,10}$' or jsonb_typeof(p_patch) is distinct from 'object'
   or p_removed is null or cardinality(p_removed)>100
 then raise exception using errcode='22023',message='INVALID_LESSON_PATCH'; end if;
 execute pg_catalog.format('update public.%I set data=(data-$4)||$3 where id=$1 and xmin::text=$2 returning xmin::text',p_table)
   into v_revision using p_id,p_revision,p_patch,p_removed;
 if v_revision is null then raise exception using errcode='PT409',message='LESSON_SNAPSHOT_CHANGED'; end if;
 return v_revision;
end $$;
revoke all on function public.read_own_lesson_snapshot(text,text),public.patch_own_lesson_snapshot(text,text,text,jsonb,text[]) from public,anon;
grant execute on function public.read_own_lesson_snapshot(text,text),public.patch_own_lesson_snapshot(text,text,text,jsonb,text[]) to authenticated;
commit;
