import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type DeleteAuthUserPayload = {
  userDataId?: string;
  authUserId?: string;
  email?: string;
};

type LessonAccessRow = {
  auth_user_id: string;
  user_data_id: string;
  role: string;
};

type SupabaseAdminClient = ReturnType<typeof createClient<any, 'public', any>>;

const SYSTEM_USER_DATA_IDS = new Set(['__GLOBAL_SETTINGS__', 'Master_Debug', '__admin__', '__teacher__']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function normalizeUuid(value: unknown) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : '';
}

function normalizeUserDataId(value: unknown) {
  return String(value || '').trim();
}

async function requireAdmin(serviceClient: SupabaseAdminClient, authUserId: string) {
  const { data, error } = await serviceClient
    .from('lesson_user_access')
    .select('role')
    .eq('auth_user_id', authUserId)
    .eq('role', 'admin')
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Admin lesson access is required.');
}

async function findAuthUserIdByEmail(serviceClient: SupabaseAdminClient, email: string) {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const authUsers = data?.users || [];
    const found = authUsers.find((user) => String(user.email || '').toLowerCase() === target);
    if (found?.id) return found.id;
    if (authUsers.length < perPage) return '';
  }
  throw new Error('Authユーザーの検索件数が上限を超えました。');
}

async function collectTargetAuthIds(
  serviceClient: SupabaseAdminClient,
  payload: DeleteAuthUserPayload,
) {
  const authIds = new Set<string>();
  const userDataId = normalizeUserDataId(payload.userDataId);
  const explicitAuthUserId = normalizeUuid(payload.authUserId);
  const email = String(payload.email || '').trim().toLowerCase();

  if (explicitAuthUserId) authIds.add(explicitAuthUserId);
  if (email) {
    const foundByEmail = await findAuthUserIdByEmail(serviceClient, email);
    if (foundByEmail) authIds.add(foundByEmail);
  }
  if (userDataId) {
    const { data, error } = await serviceClient
      .from('lesson_user_access')
      .select('auth_user_id,user_data_id,role')
      .eq('user_data_id', userDataId);
    if (error) throw error;
    ((data || []) as LessonAccessRow[]).forEach((row) => {
      if (row.auth_user_id) authIds.add(row.auth_user_id);
    });

    const userDataTable = Deno.env.get('LESSON_USER_DATA_TABLE') || 'user_data';
    const { data: userRow, error: userRowError } = await serviceClient
      .from(userDataTable)
      .select('data')
      .eq('id', userDataId)
      .maybeSingle();
    if (userRowError) throw userRowError;
    const rowAuthUserId = normalizeUuid((userRow?.data as Record<string, unknown> | null | undefined)?.authUserId);
    if (rowAuthUserId) authIds.add(rowAuthUserId);
  }

  return Array.from(authIds);
}

async function assertOnlyStudentTargets(serviceClient: SupabaseAdminClient, targetAuthIds: string[], callerAuthUserId: string) {
  if (targetAuthIds.length === 0) return;
  if (targetAuthIds.includes(callerAuthUserId)) throw new Error('ログイン中の管理者自身は削除できません。');

  const { data, error } = await serviceClient
    .from('lesson_user_access')
    .select('auth_user_id,user_data_id,role')
    .in('auth_user_id', targetAuthIds);
  if (error) throw error;

  const accessRows = (data || []) as LessonAccessRow[];
  const protectedRow = accessRows.find((row) => row.role !== 'student');
  if (protectedRow) {
    throw new Error('管理者または先生ロールを持つAuthユーザーは、この画面から削除できません。');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const userDataTable = Deno.env.get('LESSON_USER_DATA_TABLE') || 'user_data';
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return jsonResponse({ error: 'Authorization header is required.' }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return jsonResponse({ error: 'Invalid session.' }, 401);
    await requireAdmin(serviceClient, authData.user.id);

    const payload = await req.json() as DeleteAuthUserPayload;
    const userDataId = normalizeUserDataId(payload.userDataId);
    if (SYSTEM_USER_DATA_IDS.has(userDataId)) return jsonResponse({ error: 'System user cannot be deleted.' }, 400);

    const targetAuthIds = await collectTargetAuthIds(serviceClient, payload);
    if (!userDataId && targetAuthIds.length === 0) {
      return jsonResponse({ error: '削除対象のAuthユーザーが見つかりません。' }, 400);
    }
    await assertOnlyStudentTargets(serviceClient, targetAuthIds, authData.user.id);

    const deletedAuthUserIds: string[] = [];
    for (const authUserId of targetAuthIds) {
      const { error } = await serviceClient.auth.admin.deleteUser(authUserId);
      if (error) throw error;
      deletedAuthUserIds.push(authUserId);
    }

    if (userDataId) {
      await serviceClient.from('lesson_user_access').delete().eq('user_data_id', userDataId);
      const { error: deleteUserDataError } = await serviceClient.from(userDataTable).delete().eq('id', userDataId);
      if (deleteUserDataError) throw deleteUserDataError;
    } else {
      await serviceClient.from('lesson_user_access').delete().in('auth_user_id', targetAuthIds).eq('role', 'student');
    }

    return jsonResponse({ ok: true, userDataId, deletedAuthUserIds });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
