begin;
create or replace function public.expire_support_word_requests(p_prepared_before timestamptz,p_pending_before timestamptz)
returns void language sql security definer set search_path=public,pg_temp as $$
  update lesson_word_requests set status='expired',revision=revision+1
  where (status='prepared' and created_at < least(p_prepared_before,now()-interval '2 hours'))
     or (status='pending' and submitted_at < least(p_pending_before,now()-interval '30 days'));
$$;
revoke all on function public.expire_support_word_requests(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.expire_support_word_requests(timestamptz,timestamptz) to service_role;
commit;
