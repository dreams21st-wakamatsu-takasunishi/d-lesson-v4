begin;
create or replace function public.read_lesson_staff_roster(p_table text)
returns table(id text,data jsonb)
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_table is null or p_table not in ('user_data','test_user_data')
   or not exists(select 1 from public.lesson_user_access a where a.auth_user_id=auth.uid() and a.role in ('admin','teacher'))
 then raise insufficient_privilege; end if;
 -- Keep the latest activity for badges; never use the summary as a write snapshot.
 return query execute pg_catalog.format($q$
   select u.id,(u.data-'practiceLogs') || jsonb_build_object('practiceLogs',
     coalesce((select jsonb_build_array(e.value)
       from jsonb_array_elements(case when jsonb_typeof(u.data->'practiceLogs')='array' then u.data->'practiceLogs' else '[]'::jsonb end)
         with ordinality as e(value,position)
       where jsonb_typeof(e.value)='object'
       order by e.position limit 1),'[]'::jsonb))
   from public.%I u where u.id <> '__GLOBAL_SETTINGS__' order by u.id$q$,p_table);
end $$;
revoke all on function public.read_lesson_staff_roster(text) from public,anon;
grant execute on function public.read_lesson_staff_roster(text) to authenticated;
commit;
