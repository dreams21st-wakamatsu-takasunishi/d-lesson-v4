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

type SupabaseAdminClient = ReturnType<typeof createClient<any, 'public', any>>;

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

function getCreateAuthErrorMessage(error: unknown, email: string) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/already|registered|exists|duplicate/i.test(message)) {
    return `この児童番号のAuthアカウントはすでに存在します。児童番号または校舎を確認してください。(${email})`;
  }
  return message || 'Auth user creation failed.';
}

type LessonAccessRow = {
  role: string;
  scope_type?: string | null;
  scope_value?: string | null;
};

function parseScopeValues(value: string | null | undefined) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function payloadMatchesTeacherScope(payload: CreateStudentPayload, row: LessonAccessRow) {
  if (row.role !== 'teacher') return false;
  const scopeType = row.scope_type || 'all';
  if (scopeType === 'all') return true;

  const campusId = String(payload.campusId || 'main').trim() || 'main';
  const group = String(payload.group || '').trim();
  const values = parseScopeValues(row.scope_value);

  if (scopeType === 'campus') return values.includes(campusId);
  if (scopeType === 'group') return values.includes(group);
  if (scopeType === 'campus_group') return values.includes(`${campusId}:${group}`);
  return false;
}

function dataMatchesTeacherScope(data: Record<string, unknown>, row: LessonAccessRow) {
  return payloadMatchesTeacherScope({
    userDataId: String(data.userDataId || ''),
    studentNumber: '',
    passcode: '',
    campusId: String(data.campusId || data.campus || 'main'),
    group: String(data.group || ''),
  }, row);
}

async function getAllowedLessonAccessRows(serviceClient: SupabaseAdminClient, authUserId: string, payload: CreateStudentPayload) {
  const { data, error } = await serviceClient
    .from('lesson_user_access')
    .select('role,scope_type,scope_value')
    .eq('auth_user_id', authUserId)
    .in('role', ['admin', 'teacher']);

  if (error) throw error;
  const rows = (data || []) as LessonAccessRow[];
  if (rows.some((row) => row.role === 'admin')) return rows;
  const teacherRows = rows.filter((row) => payloadMatchesTeacherScope(payload, row));
  if (teacherRows.length > 0) return teacherRows;
  throw new Error('Admin or scoped teacher lesson access is required.');
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
    const payload = await req.json() as CreateStudentPayload;
    const userDataId = String(payload.userDataId || '').trim();
    const passcode = String(payload.passcode || '').trim();
    const studentNumber = String(payload.studentNumber || '').replace(/\D/g, '');
    if (!userDataId) return jsonResponse({ error: 'userDataId is required.' }, 400);
    if (!studentNumber) return jsonResponse({ error: 'studentNumber is required.' }, 400);
    if (!/^\d{6,32}$/.test(passcode)) return jsonResponse({ error: 'passcode must be 6-32 digits.' }, 400);

    const allowedAccessRows = await getAllowedLessonAccessRows(serviceClient, authData.user.id, payload);
    const { data: currentRow } = await serviceClient
      .from(userDataTable)
      .select('data')
      .eq('id', userDataId)
      .maybeSingle();

    if (
      currentRow?.data
      && typeof currentRow.data === 'object'
      && !allowedAccessRows.some((row) => row.role === 'admin' || dataMatchesTeacherScope(currentRow.data as Record<string, unknown>, row))
    ) {
      return jsonResponse({ error: 'Teacher access does not match the existing student row.' }, 403);
    }

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
    if (createError) return jsonResponse({ error: getCreateAuthErrorMessage(createError, email), email }, 400);

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
