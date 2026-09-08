-- Synthetic records live only inside this transaction. Always roll back.
begin;
do $$
declare
  v_teacher uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_id text := '__word_test_' || gen_random_uuid()::text;
  v_result jsonb;
  v_count integer;
begin
  assert not has_function_privilege('anon', 'public.approve_lesson_word(uuid,text,text,text,text)', 'execute');
  assert not has_function_privilege('authenticated', 'public.approve_lesson_word(uuid,text,text,text,text)', 'execute');
  assert not has_table_privilege('authenticated', 'public.lesson_word_approvals', 'insert');
  insert into auth.users(id) values (v_teacher), (v_student), (v_admin);
  insert into public.user_data(id, data) values (v_id, jsonb_build_object(
    'displayName','Approval test', 'campusId','approval-test', 'group','A', 'coins', 20,
    'examRecords',jsonb_build_object('romaji_daku_exam',true), 'wordProgress','{}'::jsonb, 'mouseLevel',3));
  insert into public.lesson_user_access(auth_user_id,user_data_id,role,scope_type,scope_value) values
    (v_teacher, v_id, 'teacher','campus','different-campus'),
    (v_student, v_id, 'student','all',''), (v_admin,v_id,'admin','all','');
  begin
    perform public.approve_lesson_word(v_student,v_id,'w_b1_1','3');
    raise exception 'Student unexpectedly approved';
  exception when insufficient_privilege then null; end;
  begin
    perform public.approve_lesson_word(v_teacher,v_id,'w_b1_1','3');
    raise exception 'Out-of-scope teacher unexpectedly approved';
  exception when insufficient_privilege then null; end;
  update public.lesson_user_access set scope_type = 'group', scope_value = ' , ' where auth_user_id = v_teacher;
  begin
    perform public.approve_lesson_word(v_teacher,v_id,'w_b1_1','3');
    raise exception 'Blank scope unexpectedly approved';
  exception when insufficient_privilege then null; end;
  update public.lesson_user_access set scope_type = 'campus_group', scope_value = 'approval-test:A' where auth_user_id = v_teacher;
  begin
    perform public.approve_lesson_word(v_teacher,v_id,'w_b1_2','3');
    raise exception 'Locked stage unexpectedly approved';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.approve_lesson_word(v_teacher,v_id,'w_b1_1','-1');
    raise exception 'Invalid page unexpectedly approved';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.approve_lesson_word(v_teacher,v_id,'bad-stage','3');
    raise exception 'Invalid stage unexpectedly approved';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.approve_lesson_word(v_teacher,'__GLOBAL_SETTINGS__','w_b1_1','3');
    raise exception 'System row unexpectedly approved';
  exception when invalid_parameter_value then null; end;
  v_result := public.approve_lesson_word(v_teacher,v_id,'w_b1_1','3');
  assert (v_result->>'coinGain')::integer = 500;
  assert v_result->'data'->'wordProgress'->'w_b1_1'->>'status' = 'cleared';
  assert v_result->'data'->>'mouseLevel' = '3';
  assert v_result->'data'->>'coins' = '520';
  assert v_result->'data'->'wordProgress'->'w_b1_1'->>'approvedBy' = v_teacher::text;
  v_result := public.approve_lesson_word(v_teacher,v_id,'w_b1_1','4');
  assert (v_result->>'coinGain')::integer = 0;
  assert v_result->'data'->>'coins' = '520';
  assert jsonb_array_length(v_result->'data'->'practiceLogs') = 1;
  assert v_result->'data'->'wordProgress'->'w_b1_1'->>'page' = '3';
  v_result := public.approve_lesson_word(v_admin,v_id,'w_b1_2','');
  assert (v_result->>'coinGain')::integer = 500;
  update public.user_data set data = jsonb_set(data, '{wordProgress,w_b1_3}', '"cleared"'::jsonb) where id = v_id;
  v_result := public.approve_lesson_word(v_teacher,v_id,'w_b1_3','9');
  assert (v_result->>'coinGain')::integer = 0, 'Legacy clear must not grant another reward';
  select count(*) into v_count from public.lesson_word_approvals where user_data_id = v_id;
  assert v_count = 3;
  delete from public.user_data where id = v_id;
  assert not exists (select 1 from public.lesson_word_approvals where user_data_id = v_id), 'Deleted student left approval records';
end;
$$;
rollback;
select 'Word approval permissions, progression, reward idempotency and legacy records passed; all fixtures rolled back' as result;
