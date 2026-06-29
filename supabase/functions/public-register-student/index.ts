import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type PublicRegisterPayload = {
  displayName?: string;
  email?: string;
  password?: string;
  birthdate?: string;
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

function sanitizeDisplayName(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 24);
}

function sanitizeBirthdate(value: unknown) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createUserDataId() {
  return `student_${crypto.randomUUID()}`;
}

function createStudentRecord(userDataId: string, payload: Required<Pick<PublicRegisterPayload, 'displayName'>> & PublicRegisterPayload) {
  const campusId = String(Deno.env.get('PUBLIC_STUDENT_CAMPUS_ID') || 'public').trim() || 'public';
  const group = String(Deno.env.get('PUBLIC_STUDENT_GROUP') || 'public').trim() || 'public';
  const birthdate = sanitizeBirthdate(payload.birthdate);
  return {
    displayName: payload.displayName,
    userDataId,
    birthdate,
    campusId,
    mouseLevel: 0,
    keyboardSequence: 0,
    coins: 0,
    items: [],
    tickets: [],
    loginStamps: [],
    group,
    publicRegistration: true,
  };
}

async function authEmailExists(serviceClient: SupabaseAdminClient, email: string) {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const authUsers = data?.users || [];
    if (authUsers.some((user) => String(user.email || '').toLowerCase() === target)) return true;
    if (authUsers.length < perPage) return false;
  }
  throw new Error('登録済みメールアドレスの確認件数が上限を超えました。管理者に連絡してください。');
}

function getCreateAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/already|registered|exists|duplicate/i.test(message)) {
    return 'このメールアドレスはすでに登録されています。通常ログインしてください。';
  }
  return message || '登録に失敗しました。';
}

function shouldRequireEmailConfirmation() {
  return Deno.env.get('PUBLIC_REGISTER_REQUIRE_EMAIL_CONFIRMATION') === 'true';
}

async function createAuthUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: { email: string; password: string; displayName: string; userDataId: string },
) {
  const requireEmailConfirmation = shouldRequireEmailConfirmation();
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  if (!requireEmailConfirmation) {
    const { data: created, error } = await serviceClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        user_data_id: payload.userDataId,
        display_name: payload.displayName,
        registration_source: 'public',
      },
    });
    if (error) return { serviceClient, error };
    return {
      serviceClient,
      authUserId: created.user?.id,
      needsEmailConfirmation: false,
    };
  }

  const anonKey = requiredEnv('SUPABASE_ANON_KEY');
  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const emailRedirectTo = String(Deno.env.get('PUBLIC_REGISTER_EMAIL_REDIRECT_TO') || '').trim();
  const signUpOptions: {
    data: Record<string, string>;
    emailRedirectTo?: string;
  } = {
    data: {
      user_data_id: payload.userDataId,
      display_name: payload.displayName,
      registration_source: 'public',
    },
  };
  if (emailRedirectTo) signUpOptions.emailRedirectTo = emailRedirectTo;

  const { data, error } = await publicClient.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: signUpOptions,
  });
  if (error) return { serviceClient, error };

  if (data.session) {
    const authUserId = data.user?.id;
    if (authUserId) await serviceClient.auth.admin.deleteUser(authUserId);
    return {
      serviceClient,
      error: new Error('Supabase Auth email confirmation is not enabled. Enable Confirm email before requiring public email confirmation.'),
    };
  }

  return {
    serviceClient,
    authUserId: data.user?.id,
    needsEmailConfirmation: true,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    if (Deno.env.get('PUBLIC_STUDENT_REGISTRATION_ENABLED') !== 'true') {
      return jsonResponse({ error: 'Public student registration is disabled.' }, 403);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const userDataTable = Deno.env.get('LESSON_USER_DATA_TABLE') || 'user_data';
    const payload = await req.json() as PublicRegisterPayload;

    const displayName = sanitizeDisplayName(payload.displayName);
    const email = String(payload.email || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const birthdate = sanitizeBirthdate(payload.birthdate);

    if (!displayName) return jsonResponse({ error: 'ニックネームを入力してください。' }, 400);
    if (!isValidEmail(email)) return jsonResponse({ error: 'メールアドレスを確認してください。' }, 400);
    if (!birthdate) return jsonResponse({ error: '生年月日を入力してください。' }, 400);
    if (await authEmailExists(createClient(supabaseUrl, serviceRoleKey), email)) {
      return jsonResponse({ error: 'このメールアドレスはすでに登録されています。通常ログインしてください。' }, 400);
    }

    const userDataId = createUserDataId();
    const {
      serviceClient,
      authUserId,
      needsEmailConfirmation,
      error: createError,
    } = await createAuthUser(supabaseUrl, serviceRoleKey, {
      email,
      password,
      displayName,
      userDataId,
    });
    if (createError) return jsonResponse({ error: getCreateAuthErrorMessage(createError) }, 400);

    if (!authUserId) return jsonResponse({ error: 'Auth user was not created.' }, 500);

    try {
      const studentRecord = createStudentRecord(userDataId, { ...payload, displayName, birthdate });
      const { error: userDataError } = await serviceClient
        .from(userDataTable)
        .insert({ id: userDataId, data: { ...studentRecord, authUserId } });
      if (userDataError) throw userDataError;

      const { error: accessError } = await serviceClient
        .from('lesson_user_access')
        .insert({
          auth_user_id: authUserId,
          user_data_id: userDataId,
          role: 'student',
          scope_type: 'all',
          scope_value: '',
        });
      if (accessError) throw accessError;
    } catch (error) {
      await serviceClient.from(userDataTable).delete().eq('id', userDataId);
      await serviceClient.auth.admin.deleteUser(authUserId);
      throw error;
    }

    return jsonResponse({ ok: true, userDataId, authUserId, needsEmailConfirmation });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
