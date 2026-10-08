import { createClient } from 'npm:@supabase/supabase-js@2';
import { classroomIdentity, secretMatches } from '../_shared/support-learning.ts';
import { inspectOwnedAccounts, lessonLoginUrl, validCardPasscode, type AccountAccess, type AccountUser } from '../_shared/support-accounts.ts';
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async request => {
  if (request.method !== 'POST') return reply({ error: 'POSTで送信してください。' }, 405);
  if (!await secretMatches(request.headers.get('x-lesson-bridge-key') || '', Deno.env.get('D_SUPPORT_BRIDGE_SECRET') || '')) return reply({ error: '連携認証を確認してください。' }, 401);
  let auditId: string | null = null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const finish = async (outcome: string) => {
    if (!auditId) return;
    const { error } = await client.from('lesson_support_account_checks').update({ outcome, finished_at: new Date().toISOString() }).eq('id', auditId).eq('outcome', 'started');
    if (error) throw Error('audit failed');
  };
  try {
    const raw = await request.text(); if (raw.length > 2048) return reply({ error: '送信内容を確認してください。' }, 400);
    const body = JSON.parse(raw), table = Deno.env.get('LESSON_USER_DATA_TABLE') || 'user_data';
    if (!['inspect', 'verify-card'].includes(body.action) || !/^[a-z0-9]{20}$/.test(body.supportProjectRef || '') || !uuid(body.organizationId)
      || !uuid(body.actorId) || !uuid(body.linkId) || typeof body.childId !== 'string' || !body.childId || body.childId.length > 160
      || !/^student_[A-Za-z0-9_-]{1,140}$/.test(body.studentId || '') || !['user_data', 'test_user_data'].includes(table)
      || (body.action === 'verify-card' && !validCardPasscode(body.passcode))) return reply({ error: '児童と合言葉を確認してください。' }, 400);
    const binding = async () => {
      const { data: p, error: pError } = await client.from('lesson_support_students').select('campus_id').eq('support_project_ref', body.supportProjectRef)
        .eq('organization_id', body.organizationId).eq('data_table', table).eq('student_id', body.studentId).eq('support_child_id', body.childId).eq('support_link_id', body.linkId).eq('enabled', true).maybeSingle();
      if (pError) throw Error('permission read failed');
      if (!p) return null;
      const { data: scope, error } = await client.from('lesson_support_scopes').select('campus_id').eq('support_project_ref', body.supportProjectRef).eq('organization_id', body.organizationId)
        .eq('data_table', table).eq('campus_id', p.campus_id).eq('enabled', true).maybeSingle();
      if (error) throw Error('scope read failed'); return scope ? p.campus_id : null;
    };
    const campusId = await binding(); if (!campusId) return reply({ error: '有効な児童連携がありません。' }, 403);
    const { data: row, error } = await client.from(table).select('id,data').eq('id', body.studentId).maybeSingle();
    if (error) throw Error('learner read failed');
    const identity = row?.data ? classroomIdentity(row.id, row.data, new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0], table) : null;
    if (!identity?.displayName || identity.campusId !== campusId) return reply({ error: '教室児童の所属を確認してください。' }, 403);
    const { data: reserved, error: reserveError } = await client.rpc('begin_support_account_check', { p_project: body.supportProjectRef, p_org: body.organizationId,
      p_table: table, p_student: body.studentId, p_child: body.childId, p_link: body.linkId, p_actor: body.actorId, p_action: body.action });
    if (reserveError) return reply({ error: reserveError.code === 'PT429' ? '確認回数が上限に達しました。15分ほど空けてください。' : 'アカウント確認の監査設定を確認してください。' }, reserveError.code === 'PT429' ? 429 : 503);
    auditId = reserved;
    const { data: rows, error: accessError } = await client.from('lesson_user_access').select('auth_user_id,user_data_id,role').eq('user_data_id', body.studentId).limit(11);
    if (accessError) throw Error('access read failed');
    const accesses = (rows || []) as AccountAccess[], users: AccountUser[] = [], byAuth = new Map<string, AccountAccess[]>();
    if (accesses.length <= 10) for (const id of [...new Set(accesses.map(row => row.auth_user_id))]) {
      const { data, error: authError } = await client.auth.admin.getUserById(id);
      if (authError && authError.status !== 404) throw Error('auth read failed');
      if (data.user) users.push(data.user as AccountUser);
      const { data: owned, error: ownError } = await client.from('lesson_user_access').select('auth_user_id,user_data_id,role').eq('auth_user_id', id).limit(11);
      if (ownError) throw Error('ownership read failed'); byAuth.set(id, (owned || []) as AccountAccess[]);
    }
    const { data: settingsRow, error: settingsError } = await client.from('lesson_settings').select('data').eq('key', `${table}:global`).maybeSingle();
    if (settingsError) throw Error('campus settings read failed');
    let campusSettings = settingsRow?.data;
    if (!campusSettings) {
      const { data: legacy, error } = await client.from(table).select('data').eq('id', '__GLOBAL_SETTINGS__').maybeSingle();
      if (error) throw Error('legacy campus settings read failed'); campusSettings = legacy?.data;
    }
    const campusRecord = Array.isArray(campusSettings?.campuses) ? campusSettings.campuses.find((campus: { id?: string; campusId?: string; code?: string }) => (campus.id || campus.campusId || campus.code) === campusId) : null;
    const inspection = inspectOwnedAccounts(body.studentId, row!.data, accesses, users, byAuth, { domain: (Deno.env.get('STUDENT_LOGIN_EMAIL_DOMAIN') || '').replace(/^@/, ''),
      prefix: Deno.env.get('STUDENT_LOGIN_EMAIL_PREFIX') || 'dlesson-student-', pad: Number(Deno.env.get('STUDENT_LOGIN_NUMBER_PAD') || '3'), campusCode: typeof campusRecord?.code === 'string' ? campusRecord.code : campusId });
    let card: { loginNumber: string; loginUrl: string; verified: true } | null = null;
    let verifiedAuthId: string | null = null;
    if (body.action === 'verify-card') {
      if (inspection.status !== 'ready') { await finish('denied'); return reply({ error: '教室ログインの設定を確認できません。管理者に確認してください。' }, 409); }
      for (const candidate of inspection.candidates) {
        const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error: loginError } = await auth.auth.signInWithPassword({ email: candidate.user.email!, password: body.passcode });
        if (data.session && (await auth.auth.signOut({ scope: 'local' })).error) throw Error('verification session cleanup failed');
        if (!loginError && data.user?.id === candidate.user.id) { verifiedAuthId = candidate.user.id; card = { loginNumber: inspection.loginNumber!, loginUrl: lessonLoginUrl(candidate.campusCode), verified: true }; break; }
        if (loginError && !['invalid_credentials', 'email_not_confirmed', 'user_banned'].includes(loginError.code || '')) throw Error('verification unavailable');
      }
      if (!card) { await finish('denied'); return reply({ error: 'この児童の合言葉と一致しません。合言葉は変更していません。' }, 400); }
    }
    if (await binding() !== campusId) { await finish('denied'); return reply({ error: '児童の連携状態が変更されました。' }, 409); }
    if (verifiedAuthId) {
      const { data: currentAccess, error: currentAccessError } = await client.from('lesson_user_access').select('user_data_id,role').eq('auth_user_id', verifiedAuthId).limit(11);
      const { data: currentRow, error: currentRowError } = await client.from(table).select('data').eq('id', body.studentId).maybeSingle();
      const currentIdentity = currentRow?.data ? classroomIdentity(body.studentId, currentRow.data, identity.sourceProjectRef, table) : null;
      if (currentAccessError || currentRowError || !currentAccess?.length || currentAccess.some(access => access.role !== 'student' || access.user_data_id !== body.studentId)
        || currentIdentity?.campusId !== campusId || Number(currentRow?.data?.loginNumber) !== Number(inspection.loginNumber)) {
        await finish('denied'); return reply({ error: 'Authまたは児童情報が変更されました。再確認してください。' }, 409);
      }
    }
    await finish(card ? 'verified' : 'checked');
    return reply({ schemaVersion: 1, identity, childId: body.childId, linkId: body.linkId, account: { status: inspection.status, authCount: inspection.authCount, loginNumber: inspection.loginNumber }, card });
  } catch {
    try { await finish('failed'); } catch { /* No credentials or Auth errors are logged. */ }
    return reply({ error: 'アカウント確認を完了できませんでした。設定と通信を確認してください。' }, 503);
  }
});
