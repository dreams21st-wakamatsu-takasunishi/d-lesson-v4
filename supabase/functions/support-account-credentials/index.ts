import { createClient } from 'npm:@supabase/supabase-js@2';
import { classroomIdentity, secretMatches } from '../_shared/support-learning.ts';
import { lessonLoginUrl, type AccountAccess, type AccountUser } from '../_shared/support-accounts.ts';
import { credentialPlan, operationPasscode, operationUuid } from '../_shared/support-account-credentials.ts';

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const failure = (status: number) => Object.assign(Error('Credential operation failed'), { status });
type Operation = { id: string; phase: string; auth_user_id: string | null; target_email: string | null; campus_code: string | null; login_number: string };
type AuthUser = AccountUser & { app_metadata?: Record<string, unknown> };

Deno.serve(async request => {
  if (request.method !== 'POST') return reply({ error: 'POSTで送信してください。' }, 405);
  const bridgeSecret = Deno.env.get('D_SUPPORT_BRIDGE_SECRET') || '';
  if (!await secretMatches(request.headers.get('x-lesson-bridge-key') || '', bridgeSecret)) return reply({ error: '連携認証を確認してください。' }, 401);
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) },
  });
  const lease = crypto.randomUUID();
  let operation: Operation | null = null;
  try {
    const raw = await request.text(); if (raw.length > 2048) throw failure(400);
    const body = JSON.parse(raw), table = Deno.env.get('LESSON_USER_DATA_TABLE') || 'user_data';
    if (!['issue', 'reset'].includes(body.action) || !operationUuid(body.operationId) || !operationUuid(body.actorId) || !operationUuid(body.organizationId) || !operationUuid(body.linkId)
      || !/^[a-z0-9]{20}$/.test(body.supportProjectRef || '') || !/^student_[A-Za-z0-9_-]{1,140}$/.test(body.studentId || '')
      || typeof body.childId !== 'string' || !body.childId || body.childId.length > 160 || !['user_data', 'test_user_data'].includes(table)) throw failure(400);
    const { data: claimed, error: claimError } = await service.rpc('claim_support_account_operation', { p: {
      id: body.operationId, lease, action: body.action, actor: body.actorId, org: body.organizationId, project: body.supportProjectRef,
      student: body.studentId, child: body.childId, link: body.linkId, table,
    } });
    if (claimError) throw failure(({ PT423: 423, PT429: 429, PT409: 409, '42501': 403 } as Record<string, number>)[claimError.code] || 503);
    operation = claimed;
    if (!operation) throw failure(503);
    const learner = async () => {
      const { data, error } = await service.from(table).select('id,data').eq('id', body.studentId).single();
      if (error) throw failure(409); return data;
    };
    const row = await learner();
    const identity = classroomIdentity(row.id, row.data, new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0], table);
    if (!identity?.displayName) throw failure(409);
    const accountRows = async () => {
      const { data, error } = await service.from('lesson_user_access').select('auth_user_id,user_data_id,role').eq('user_data_id', body.studentId).limit(11);
      if (error) throw failure(503); return (data || []) as AccountAccess[];
    };
    if (operation.phase === 'reserved') {
      const rows = await accountRows(), users: AuthUser[] = [], owned = new Map<string, AccountAccess[]>();
      if (rows.length > 10) throw failure(409);
      for (const id of [...new Set(rows.map(row => row.auth_user_id))]) {
        const { data, error } = await service.auth.admin.getUserById(id);
        if (error || !data.user) throw failure(409); users.push(data.user as AuthUser);
        const result = await service.from('lesson_user_access').select('auth_user_id,user_data_id,role').eq('auth_user_id', id).limit(11);
        if (result.error) throw failure(503); owned.set(id, result.data || []);
      }
      const { data: setting, error } = await service.from('lesson_settings').select('data').eq('key', `${table}:global`).maybeSingle();
      if (error) throw failure(503);
      let globalSettings = setting?.data;
      if (!globalSettings) {
        const legacy = await service.from(table).select('data').eq('id', '__GLOBAL_SETTINGS__').maybeSingle();
        if (legacy.error) throw failure(503); globalSettings = legacy.data?.data;
      }
      const campus = Array.isArray(globalSettings?.campuses) ? globalSettings.campuses.find((value: { id?: string; campusId?: string; code?: string }) => (value.id || value.campusId || value.code) === identity.campusId) : null;
      let plan;
      try { plan = credentialPlan(body.action, body.studentId, row.data, rows, users, owned, {
        domain: (Deno.env.get('STUDENT_LOGIN_EMAIL_DOMAIN') || '').replace(/^@/, ''), prefix: Deno.env.get('STUDENT_LOGIN_EMAIL_PREFIX') || 'dlesson-student-',
        pad: Number(Deno.env.get('STUDENT_LOGIN_NUMBER_PAD') || '3'), campusCode: typeof campus?.code === 'string' ? campus.code : identity.campusId,
      }); } catch { throw failure(409); }
      const { error: prepareError } = await service.rpc('prepare_support_account_operation', { p_id: operation.id, p_lease: lease, p_auth: plan.authId, p_email: plan.email, p_code: plan.campusCode });
      if (prepareError) throw failure(409);
      operation = { ...operation, phase: 'auth-pending', auth_user_id: plan.authId, target_email: plan.email, campus_code: plan.campusCode };
    }
    if (!operation.target_email || operation.campus_code === null) throw failure(409);
    const { error: guardError } = await service.rpc('guard_support_account_operation', { p_id: operation.id, p_lease: lease });
    if (guardError) throw failure(guardError.code === '42501' ? 403 : 409);
    const passcode = await operationPasscode(bridgeSecret, operation.id, body.studentId);
    let authId = operation.auth_user_id;
    if (operation.phase === 'auth-pending') {
      if (body.action === 'issue') {
        const { data: matches, error } = await service.rpc('lookup_support_account_email', { p_email: operation.target_email });
        if (error || !Array.isArray(matches) || matches.length > 1) throw failure(409);
        if (matches.length === 1) {
          if (matches[0].app_metadata?.lesson_credential_operation !== operation.id) throw failure(409);
          authId = matches[0].id;
        } else {
          const { data, error: createError } = await service.auth.admin.createUser({ email: operation.target_email, password: passcode, email_confirm: true,
            app_metadata: { lesson_credential_operation: operation.id }, user_metadata: { user_data_id: body.studentId, campus_id: identity.campusId, login_number: operation.login_number } });
          if (createError || !data.user) throw failure(503); authId = data.user.id;
        }
      } else {
        if (!authId) throw failure(409);
        const { data, error } = await service.auth.admin.getUserById(authId);
        const owned = await service.from('lesson_user_access').select('user_data_id,role').eq('auth_user_id', authId).limit(11);
        const studentAccess = await accountRows();
        const user = data.user;
        if (error || !user || user.email?.toLowerCase() !== operation.target_email.toLowerCase() || (user.banned_until && Date.parse(user.banned_until) > Date.now())
          || owned.error || owned.data?.length !== 1 || owned.data.some(access => access.user_data_id !== body.studentId || access.role !== 'student')
          || studentAccess.length !== 1 || studentAccess[0].auth_user_id !== authId || (user.user_metadata?.user_data_id && user.user_metadata.user_data_id !== body.studentId)) throw failure(409);
        if (user.app_metadata?.lesson_credential_operation !== operation.id) {
          const { error: resetError } = await service.auth.admin.updateUserById(authId, { password: passcode,
            app_metadata: { ...user.app_metadata, lesson_credential_operation: operation.id }, user_metadata: { ...user.user_metadata, user_data_id: body.studentId } });
          if (resetError) throw failure(503);
        }
      }
      const saved = await service.from('lesson_support_account_operations').update({ phase: 'auth-ready', auth_user_id: authId, updated_at: new Date().toISOString() })
        .eq('id', operation.id).eq('lease_id', lease).gt('lease_until', new Date().toISOString()).eq('phase', 'auth-pending').select('id').single();
      if (saved.error) throw failure(409); operation.phase = 'auth-ready'; operation.auth_user_id = authId;
    }
    if (!authId) throw failure(409);
    const { error: completionError } = await service.rpc('complete_support_account_operation', { p_id: operation.id, p_lease: lease, p_auth: authId });
    if (completionError) throw failure(completionError.code === '42501' ? 403 : 409);
    operation.phase = 'completed';
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: login, error: loginError } = await auth.auth.signInWithPassword({ email: operation.target_email, password: passcode });
    if (login.session && (await auth.auth.signOut({ scope: 'local' })).error) throw failure(503);
    if (loginError || login.user?.id !== authId) throw failure(409);
    const final = await learner();
    const finalIdentity = classroomIdentity(final.id, final.data, identity.sourceProjectRef, table);
    const { error: finalError } = await service.rpc('complete_support_account_operation', { p_id: operation.id, p_lease: lease, p_auth: authId });
    if (finalError || !finalIdentity || finalIdentity.campusId !== identity.campusId) throw failure(409);
    const released = await service.from('lesson_support_account_operations').update({ lease_id: null, lease_until: null, error_code: null }).eq('id', operation.id).eq('lease_id', lease).select('id').single();
    if (released.error) throw failure(503);
    return reply({ schemaVersion: 1, operationId: operation.id, action: body.action, childId: body.childId, linkId: body.linkId, identity: finalIdentity,
      account: { status: 'ready', authCount: 1, loginNumber: String(Number(operation.login_number)) },
      card: { verified: true, loginNumber: String(Number(operation.login_number)), loginUrl: lessonLoginUrl(operation.campus_code), passcode } });
  } catch (error) {
    const status = (error as { status?: number }).status || 503;
    if (operation) await service.from('lesson_support_account_operations').update({ lease_id: null, lease_until: null, error_code: `HTTP_${status}`,
      ...(operation.phase === 'reserved' ? { phase: 'denied', finished_at: new Date().toISOString() } : {}) }).eq('id', operation.id).eq('lease_id', lease);
    const messages: Record<number, string> = { 400: '児童と操作を確認してください。', 403: '児童の連携許可を確認してください。', 409: 'Auth・児童番号・連携状態を要確認です。新しい操作を始めず、操作履歴を確認してください。',
      423: '同じ発行操作を処理中です。しばらく待って同じ操作を再確認してください。', 429: '発行操作が多すぎます。15分ほど空けてください。' };
    return reply({ error: messages[status] || '発行結果を確認できませんでした。同じ操作を再確認してください。', ...(operation ? { operationId: operation.id, resumable: operation.phase !== 'reserved' } : {}) }, status);
  }
});
