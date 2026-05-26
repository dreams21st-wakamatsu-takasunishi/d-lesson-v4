import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CreateStudentPayload = {
  userDataId: string;
  displayName?: string;
  studentNumber: string | number;
  passcode: string;
  campusId?: string;
  campusCode?: string;
  group?: string;
};

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

function cleanCode(value: unknown) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

function padNumber(value: string | number) {
  const pad = Number.parseInt(Deno.env.get('STUDENT_LOGIN_NUMBER_PAD') || '3', 10);
  return String(value).replace(/\D/g, '').padStart(Number.isFinite(pad) ? pad : 3, '0');
}

function buildStudentEmail(payload: CreateStudentPayload) {
  const domain = requiredEnv('STUDENT_LOGIN_EMAIL_DOMAIN').replace(/^@/, '');
  const prefix = Deno.env.get('STUDENT_LOGIN_EMAIL_PREFIX') || 'dlesson-student-';
  const campusCode = cleanCode(payload.campusCode || payload.campusId || Deno.env.get('STUDENT_LOGIN_CAMPUS_CODE') || '');
  const campusPart = campusCode ? `${campusCode}-` : '';
  return `${prefix}${campusPart}${padNumber(payload.studentNumber)}@${domain}`;
}

async function assertLessonAdmin(serviceClient: ReturnType<typeof createClient>, authUserId: string) {
  const { data, error } = await serviceClient
    .from('lesson_user_access')
    .select('role')
    .eq('auth_user_id', authUserId)
    .eq('role', 'admin')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Admin lesson access is required.');
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
    await assertLessonAdmin(serviceClient, authData.user.id);

    const payload = await req.json() as CreateStudentPayload;
    const userDataId = String(payload.userDataId || '').trim();
    const passcode = String(payload.passcode || '').trim();
    const studentNumber = String(payload.studentNumber || '').replace(/\D/g, '');
    if (!userDataId) return jsonResponse({ error: 'userDataId is required.' }, 400);
    if (!studentNumber) return jsonResponse({ error: 'studentNumber is required.' }, 400);
    if (!/^\d{6,32}$/.test(passcode)) return jsonResponse({ error: 'passcode must be 6-32 digits.' }, 400);

    const email = buildStudentEmail(payload);
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password: passcode,
      email_confirm: true,
      user_metadata: {
        user_data_id: userDataId,
        display_name: payload.displayName || '',
        campus_id: payload.campusId || 'main',
      },
    });
    if (createError) return jsonResponse({ error: createError.message, email }, 400);

    const authUserId = created.user?.id;
    if (!authUserId) return jsonResponse({ error: 'Auth user was not created.' }, 500);

    const { error: accessError } = await serviceClient
      .from('lesson_user_access')
      .upsert({
        auth_user_id: authUserId,
        user_data_id: userDataId,
        role: 'student',
        scope_type: 'all',
        scope_value: '',
      }, { onConflict: 'auth_user_id,user_data_id' });
    if (accessError) throw accessError;

    const { data: currentRow } = await serviceClient
      .from(userDataTable)
      .select('data')
      .eq('id', userDataId)
      .maybeSingle();

    if (currentRow?.data && typeof currentRow.data === 'object') {
      await serviceClient
        .from(userDataTable)
        .update({
          data: {
            ...currentRow.data,
            userDataId,
            campusId: payload.campusId || currentRow.data.campusId || 'main',
            group: payload.group ?? currentRow.data.group ?? '',
            loginNumber: studentNumber,
            authUserId,
          },
        })
        .eq('id', userDataId);
    }

    return jsonResponse({ ok: true, email, authUserId, userDataId });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
