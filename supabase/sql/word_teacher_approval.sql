-- Word approval is a narrow service-only transaction, independent of the child's session.
begin;

create table if not exists public.lesson_word_approvals (
  data_table text not null,
  user_data_id text not null,
  stage_id text not null,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  page text not null default '',
  reward integer not null check (reward in (0, 500)),
  primary key (data_table, user_data_id, stage_id)
);
alter table public.lesson_word_approvals enable row level security;
revoke all on public.lesson_word_approvals from public, anon, authenticated;
grant all on public.lesson_word_approvals to service_role;

create or replace function public.cleanup_lesson_word_approvals()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.lesson_word_approvals where data_table = tg_table_name and user_data_id = old.id;
  return old;
end;
$$;
revoke all on function public.cleanup_lesson_word_approvals() from public, anon, authenticated;
drop trigger if exists cleanup_lesson_word_approvals on public.user_data;
create trigger cleanup_lesson_word_approvals after delete on public.user_data
for each row execute function public.cleanup_lesson_word_approvals();
do $$ begin
  if to_regclass('public.test_user_data') is not null then
    execute 'drop trigger if exists cleanup_lesson_word_approvals on public.test_user_data';
    execute 'create trigger cleanup_lesson_word_approvals after delete on public.test_user_data for each row execute function public.cleanup_lesson_word_approvals()';
  end if;
end; $$;

create or replace function public.approve_lesson_word(
  p_actor uuid, p_user_id text, p_stage_id text, p_page text,
  p_table text default 'user_data'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_data jsonb;
  v_progress jsonb;
  v_approval public.lesson_word_approvals%rowtype;
  v_stages text[] := array['w_b1_1','w_b1_2','w_b1_3','w_b1_4','w_b1_5','w_m4_1','w_m4_2','w_m4_3'];
  v_index integer;
  v_reward integer := 0;
  v_campus text;
  v_group text;
  v_coins numeric;
begin
  if p_table not in ('user_data', 'test_user_data') or p_table is null
     or p_user_id is null or p_user_id in ('__GLOBAL_SETTINGS__','Master_Debug','__GUEST_USER__') then
    raise exception using message = '承認対象の児童を確認してください。', errcode = '22023';
  end if;
  v_index := array_position(v_stages, p_stage_id);
  if v_index is null or p_page is null or (p_page <> '' and p_page !~ '^[1-9][0-9]{0,3}$') then
    raise exception using message = 'ステージとページ番号（1〜9999）を確認してください。', errcode = '22023';
  end if;
  execute format('select data from public.%I where id = $1 for update', p_table)
    into v_data using p_user_id;
  if v_data is null then
    raise exception using message = '承認対象を確認できません。', errcode = '42501';
  end if;
  v_campus := coalesce(nullif(btrim(v_data->>'campusId'), ''), nullif(btrim(v_data->>'campus'), ''), 'main');
  v_group := coalesce(btrim(v_data->>'group'), '');
  if not exists (
    select 1 from public.lesson_user_access a
    where a.auth_user_id = p_actor and (
      a.role = 'admin' or (a.role = 'teacher' and (
        coalesce(a.scope_type, 'all') = 'all' or
        exists (select 1 from unnest(string_to_array(coalesce(a.scope_value, ''), ',')) s(value)
          where btrim(s.value) <> '' and btrim(s.value) = case a.scope_type
            when 'campus' then v_campus when 'group' then v_group
            when 'campus_group' then v_campus || ':' || v_group end)
      ))
    )
  ) then
    raise exception using message = '担当範囲の先生、または管理者アカウントで確認してください。', errcode = '42501';
  end if;
  if coalesce(v_data->>'isMaster', 'false') <> 'true' and (
    coalesce(v_data->'examRecords'->>'romaji_daku_exam', '') in ('', 'false', '0', 'null') or
    (v_index > 1 and coalesce(v_data->'wordProgress'->v_stages[v_index - 1]->>'status',
      v_data->'wordProgress'->>v_stages[v_index - 1], '') <> 'cleared')
  ) then
    raise exception using message = '前のステージをクリアしてから確認してください。', errcode = '22023';
  end if;
  v_progress := coalesce(v_data->'wordProgress'->p_stage_id, '{}'::jsonb);
  select * into v_approval from public.lesson_word_approvals
    where data_table = p_table and user_data_id = p_user_id and stage_id = p_stage_id;
  if not found then
    v_reward := case when coalesce(v_progress->>'status', v_data->'wordProgress'->>p_stage_id, '') = 'cleared' then 0 else 500 end;
    insert into public.lesson_word_approvals(data_table, user_data_id, stage_id, approved_by, page, reward)
      values (p_table, p_user_id, p_stage_id, p_actor, p_page, v_reward) returning * into v_approval;
    v_data := jsonb_set(v_data, '{practiceLogs}', jsonb_build_array(jsonb_build_object(
      'id', 'word-approval-' || p_stage_id || '-' || extract(epoch from v_approval.approved_at)::text,
      'at', v_approval.approved_at, 'category', 'word', 'title', 'Word ' || replace(substring(p_stage_id from 4), '_', '-'),
      'detail', '先生の確認でクリア', 'amount', case when p_page = '' then 'ページなし' else p_page || 'ページまで' end,
      'coins', v_reward
    )) || case when jsonb_typeof(v_data->'practiceLogs') = 'array' then v_data->'practiceLogs' else '[]'::jsonb end);
  end if;
  v_coins := case when jsonb_typeof(v_data->'coins') = 'number' then (v_data->>'coins')::numeric else 0 end;
  v_data := jsonb_set(v_data, '{coins}', to_jsonb(v_coins + v_reward));
  v_data := jsonb_set(v_data, '{wordProgress}',
    (case when jsonb_typeof(v_data->'wordProgress') = 'object' then v_data->'wordProgress' else '{}'::jsonb end) ||
    jsonb_build_object(p_stage_id, jsonb_build_object('status', 'cleared', 'page', v_approval.page,
      'approvedBy', v_approval.approved_by, 'approvedAt', v_approval.approved_at)));
  execute format('update public.%I set data = $1 where id = $2', p_table) using v_data, p_user_id;
  return jsonb_build_object('userDataId', p_user_id, 'stageId', p_stage_id, 'data', v_data, 'coinGain', v_reward);
end;
$$;
revoke all on function public.approve_lesson_word(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.approve_lesson_word(uuid, text, text, text, text) to service_role;

commit;
