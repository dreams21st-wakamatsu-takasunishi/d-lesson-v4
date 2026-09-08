import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'POSTで送信してください。' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return reply({ error: '先生アカウントで認証してください。' }, 401);
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: '認証の有効期限が切れました。もう一度確認してください。' }, 401);
    const { data: access, error: accessError } = await client.from('lesson_user_access')
      .select('role').eq('auth_user_id', auth.user.id).in('role', ['admin', 'teacher']);
    if (accessError) return reply({ error: '権限を確認できませんでした。時間をおいて再試行してください。' }, 503);
    if (!access?.length) return reply({ error: '先生または管理者アカウントで確認してください。' }, 403);
    let payload;
    try {
      const body = await req.text();
      if (body.length > 2048) return reply({ error: '送信内容が長すぎます。' }, 400);
      payload = JSON.parse(body);
    } catch { return reply({ error: '送信内容を確認してください。' }, 400); }
    const table = Deno.env.get('LESSON_USER_DATA_TABLE') || 'user_data';
    if (!payload || payload.table !== table || typeof payload.userDataId !== 'string' || payload.userDataId.length > 160
      || typeof payload.stageId !== 'string' || typeof payload.page !== 'string') {
      return reply({ error: '承認対象と保存先を確認してください。' }, 400);
    }
    const { data, error } = await client.rpc('approve_lesson_word', {
      p_actor: auth.user.id, p_user_id: payload.userDataId, p_stage_id: payload.stageId, p_page: payload.page, p_table: table,
    });
    if (error) {
      if (error.code === '42501' || error.code === '22023') return reply({ error: error.message }, error.code === '42501' ? 403 : 400);
      return reply({ error: '承認を保存できませんでした。先生にサーバー設定の確認をお願いしてください。' }, 503);
    }
    return reply(data);
  } catch {
    return reply({ error: '通信に失敗しました。時間をおいてもう一度確認してください。' }, 503);
  }
});
