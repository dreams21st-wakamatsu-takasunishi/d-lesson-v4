begin;

-- Service-to-service only. Existing learner/teacher RLS and storage are unchanged.
create or replace function public.read_support_learning_day(
  p_project text, p_org uuid, p_table text, p_student text, p_date date
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_data jsonb;
  v_logs jsonb;
  v_start text := pg_catalog.to_char(p_date::timestamp - interval '9 hours', 'YYYY-MM-DD"T"HH24:MI:SS');
  v_end text := pg_catalog.to_char(p_date::timestamp + interval '15 hours', 'YYYY-MM-DD"T"HH24:MI:SS');
begin
  if p_table is null or p_table not in ('user_data', 'test_user_data') or p_date is null then
    raise exception 'invalid history request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.lesson_support_students p
    join public.lesson_support_scopes s using (support_project_ref, organization_id, data_table, campus_id)
    where p.support_project_ref = p_project and p.organization_id = p_org
      and p.data_table = p_table and p.student_id = p_student and p.enabled and s.enabled
  ) then return null;
  end if;
  execute pg_catalog.format('select data from public.%I where id = $1', p_table)
    into v_data using p_student;
  if v_data is null then return null; end if;

  -- Normal writes use Date.toISOString(). Keep legacy timestamp formats for
  -- the existing JS date parser, so they cannot disappear from import.
  select coalesce(pg_catalog.jsonb_agg(e.value order by e.position), '[]'::jsonb)
    into v_logs
    from pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(v_data->'practiceLogs') = 'array'
        then v_data->'practiceLogs' else '[]'::jsonb end
    ) with ordinality as e(value, position)
    cross join lateral (select e.value->>'at' as stamp) t
    where pg_catalog.jsonb_typeof(e.value) = 'object'
      and case
        when p_date >= date '0002-01-01' and t.stamp ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$' then
          pg_catalog.substring(t.stamp, 9, 2)::int >
            extract(day from pg_catalog.make_date(pg_catalog.substring(t.stamp, 1, 4)::int, pg_catalog.substring(t.stamp, 6, 2)::int, 1)
              + interval '1 month - 1 day')
          or (pg_catalog.left(t.stamp, 19) collate pg_catalog."C" >= v_start and pg_catalog.left(t.stamp, 19) collate pg_catalog."C" < v_end)
        else t.stamp is not null
      end;

  return pg_catalog.jsonb_build_object('id', p_student, 'data', pg_catalog.jsonb_build_object(
    'campusId', v_data->'campusId', 'campus', v_data->'campus', 'displayName', v_data->'displayName',
    'name', v_data->'name', 'studentName', v_data->'studentName', 'birthdate', v_data->'birthdate', 'birth', v_data->'birth',
    'isMaster', v_data->'isMaster', 'isGuest', v_data->'isGuest', 'publicRegistration', v_data->'publicRegistration',
    'registrationSource', v_data->'registrationSource', 'registration_source', v_data->'registration_source',
    'accountType', v_data->'accountType', 'practiceLogs', v_logs
  ));
end
$$;
revoke all on function public.read_support_learning_day(text, uuid, text, text, date) from public, anon, authenticated;
grant execute on function public.read_support_learning_day(text, uuid, text, text, date) to service_role;
commit;
