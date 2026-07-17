import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CreateStudentPayload = {
  userDataId: string;
  displayName?: string;
  studentNumber: string | number;
  passcode?: string;
  authUserId?: string;
  mode?: 'create' | 'reset' | 'move';
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '');
}

async function findAuthUserIdByEmail(serviceClient: SupabaseAdminClient, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => String(user.email || '').toLowerCase() === target);
    if (found?.id) return found.id;
    if (data.users.length < 1000) break;
  }
  return '';
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

async function ensureStudentNumberAvailable(
  serviceClient: SupabaseAdminClient,
  userDataTable: string,
  userDataId: string,
  campusId: string,
  studentNumber: string,
) {
  const { data, error } = await serviceClient
    .from(userDataTable)
    .select('id')
    .eq('data->>campusId', campusId)
    .eq('data->>loginNumber', studentNumber)
    .neq('id', userDataId)
    .limit(1);
  if (error) throw error;
  if ((data || []).length > 0) {
    throw new Error(`Campus ${campusId} already has student number ${studentNumber}.`);
  }
}

type AuthSnapshot = {
  email: string;
  userMetadata: Record<string, unknown>;
};

async function restoreMovedAuth(
  serviceClient: SupabaseAdminClient,
  authUserId: string,
  snapshot: AuthSnapshot | null,
) {
  if (!snapshot) return '';
  const { error } = await serviceClient.auth.admin.updateUserById(authUserId, {
    email: snapshot.email,
    email_confirm: true,
    user_metadata: snapshot.userMetadata,
  });
  return error?.message || '';
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
    const mode = payload.mode === 'reset' || payload.mode === 'move' ? payload.mode : 'create';
    if (!userDataId) return jsonResponse({ error: 'userDataId is required.' }, 400);
    if (!studentNumber) return jsonResponse({ error: 'studentNumber is required.' }, 400);
    if (mode !== 'move' && !/^\d{6,32}$/.test(passcode)) {
      return jsonResponse({ error: 'passcode must be 6-32 digits.' }, 400);
    }

    let allowedAccessRows: LessonAccessRow[] = [];
    try {
      allowedAccessRows = await getAllowedLessonAccessRows(serviceClient, authData.user.id, payload);
    } catch (accessError) {
      return jsonResponse({ error: errorMessage(accessError) }, 403);
    }
    if (mode === 'move' && !allowedAccessRows.some((row) => row.role === 'admin')) {
      return jsonResponse({ error: 'Only lesson admins can move a student to another campus.' }, 403);
    }

    const { data: currentRow, error: currentRowError } = await serviceClient
      .from(userDataTable)
      .select('data')
      .eq('id', userDataId)
      .maybeSingle();
    if (currentRowError) return jsonResponse({ error: currentRowError.message }, 400);
    if (mode === 'move' && (!currentRow?.data || typeof currentRow.data !== 'object')) {
      return jsonResponse({ error: `${userDataTable} row was not found for ${userDataId}.` }, 404);
    }

    if (
      currentRow?.data
      && typeof currentRow.data === 'object'
      && !allowedAccessRows.some((row) => row.role === 'admin' || dataMatchesTeacherScope(currentRow.data as Record<string, unknown>, row))
    ) {
      return jsonResponse({ error: 'Teacher access does not match the existing student row.' }, 403);
    }

    const targetCampusId = String(payload.campusId || 'main').trim() || 'main';
    try {
      await ensureStudentNumberAvailable(serviceClient, userDataTable, userDataId, targetCampusId, studentNumber);
    } catch (duplicateError) {
      return jsonResponse({ error: errorMessage(duplicateError) }, 409);
    }

    const email = buildStudentEmail(payload);
    let authUserId = String(payload.authUserId || (currentRow?.data as Record<string, unknown> | undefined)?.authUserId || '').trim();
    let action: 'created' | 'reset' | 'moved' = 'created';
    let movedAuthSnapshot: AuthSnapshot | null = null;

    if (mode === 'reset' || mode === 'move') {
      if (!authUserId && mode === 'reset') authUserId = await findAuthUserIdByEmail(serviceClient, email);
      if (!authUserId) return jsonResponse({ error: `Auth user was not found for ${email}.` }, 404);

      const { data: existingAuthData, error: existingAuthError } = await serviceClient.auth.admin.getUserById(authUserId);
      if (existingAuthError || !existingAuthData.user) {
        return jsonResponse({ error: existingAuthError?.message || `Auth user was not found for ${authUserId}.` }, 404);
      }
      const existingMetadata = (existingAuthData.user.user_metadata || {}) as Record<string, unknown>;
      if (mode === 'move') {
        movedAuthSnapshot = {
          email: String(existingAuthData.user.email || ''),
          userMetadata: existingMetadata,
        };
        if (!movedAuthSnapshot.email) return jsonResponse({ error: 'The current Auth email is missing.' }, 400);
      }

      const { error: updateError } = await serviceClient.auth.admin.updateUserById(authUserId, {
        email,
        ...(mode === 'reset' ? { password: passcode } : {}),
        email_confirm: true,
        user_metadata: {
          ...existingMetadata,
          user_data_id: userDataId,
          display_name: payload.displayName || existingMetadata.display_name || '',
          campus_id: targetCampusId,
          login_number: studentNumber,
        },
      });
      if (updateError) return jsonResponse({ error: getCreateAuthErrorMessage(updateError, email), email }, 400);
      action = mode === 'move' ? 'moved' : 'reset';
    } else {
      const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password: passcode,
        email_confirm: true,
        user_metadata: {
          user_data_id: userDataId,
          display_name: payload.displayName || '',
          campus_id: targetCampusId,
          login_number: studentNumber,
        },
      });
      if (createError) return jsonResponse({ error: getCreateAuthErrorMessage(createError, email), email }, 400);
      authUserId = created.user?.id || '';
      if (!authUserId) return jsonResponse({ error: 'Auth user was not created.' }, 500);
    }

    const { error: accessError } = await serviceClient
      .from('lesson_user_access')
      .upsert({
        auth_user_id: authUserId,
        user_data_id: userDataId,
        role: 'student',
        scope_type: 'all',
        scope_value: '',
      }, { onConflict: 'auth_user_id,user_data_id' });
    if (accessError) {
      const rollbackError = await restoreMovedAuth(serviceClient, authUserId, movedAuthSnapshot);
      return jsonResponse({
        error: accessError.message || 'lesson_user_access update failed.',
        rollbackError: rollbackError || undefined,
      }, rollbackError ? 500 : 400);
    }

    if (currentRow?.data && typeof currentRow.data === 'object') {
      const nextUserData: Record<string, unknown> = {
        ...currentRow.data,
        userDataId,
        campusId: targetCampusId,
        group: payload.group ?? currentRow.data.group ?? '',
        loginNumber: studentNumber,
        authUserId,
      };
      if (mode !== 'move') nextUserData.authPasscodeIssuedAt = new Date().toISOString();

      const { error: updateUserDataError } = await serviceClient
        .from(userDataTable)
        .update({
          data: nextUserData,
        })
        .eq('id', userDataId);
      if (updateUserDataError) {
        const rollbackError = await restoreMovedAuth(serviceClient, authUserId, movedAuthSnapshot);
        return jsonResponse({
          error: updateUserDataError.message || `${userDataTable} update failed.`,
          rollbackError: rollbackError || undefined,
        }, rollbackError ? 500 : 400);
      }
    }

    return jsonResponse({ ok: true, email, authUserId, userDataId, action });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
