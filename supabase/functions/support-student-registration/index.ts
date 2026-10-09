import { createClient } from 'npm:@supabase/supabase-js@2';
import { secretMatches, serviceDate } from '../_shared/support-learning.ts';
import { operationUuid } from '../_shared/support-account-credentials.ts';
import { registrationCampuses, safeCampusId, validRegistrationChild } from '../_shared/support-student-registration.ts';
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async request => {
  if (request.method !== 'POST') return reply({ error: 'POSTで送信してください。' }, 405);
  if (!await secretMatches(request.headers.get('x-lesson-bridge-key') || '', Deno.env.get('D_SUPPORT_BRIDGE_SECRET') || '')) return reply({ error: '連携認証を確認してください。' }, 401);
  try {
    const raw = await request.text(); if (raw.length > 4096) return reply({ error: '送信内容を確認してください。' }, 400);
    const body = JSON.parse(raw), table = Deno.env.get('LESSON_USER_DATA_TABLE') || 'user_data';
    if (!['campuses', 'prepare'].includes(body.action) || !/^[a-z0-9]{20}$/.test(body.supportProjectRef || '') || !operationUuid(body.organizationId) || !['user_data', 'test_user_data'].includes(table)) return reply({ error: '操作と所属を確認してください。' }, 400);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: scopes, error } = await client.from('lesson_support_scopes').select('campus_id').eq('support_project_ref', body.supportProjectRef).eq('organization_id', body.organizationId).eq('data_table', table).eq('enabled', true).limit(101);
    if (error || !scopes || scopes.length > 100) throw Error('Scope configuration');
    const settings = await client.from('lesson_settings').select('data').eq('key', `${table}:global`).maybeSingle();
    if (settings.error) throw Error('Campus configuration');
    let global = settings.data?.data;
    if (!global) { const legacy = await client.from(table).select('data').eq('id', '__GLOBAL_SETTINGS__').maybeSingle(); if (legacy.error) throw Error('Campus configuration'); global = legacy.data?.data; }
    const campuses = registrationCampuses(scopes, global), domain = (Deno.env.get('STUDENT_LOGIN_EMAIL_DOMAIN') || '').replace(/^@/, ''), prefix = Deno.env.get('STUDENT_LOGIN_EMAIL_PREFIX') || 'dlesson-student-', pad = Number(Deno.env.get('STUDENT_LOGIN_NUMBER_PAD') || '3');
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain) || !/^[a-zA-Z0-9_-]{1,80}$/.test(prefix) || !Number.isInteger(pad) || pad < 1 || pad > 8) throw Error('Login configuration');
    if (body.action === 'campuses') return reply({ campuses: campuses.map(({ id, name }) => ({ id, name })) });
    if (!operationUuid(body.operationId) || !operationUuid(body.linkId) || !operationUuid(body.actorId) || !safeCampusId(body.campusId)
      || typeof body.childId !== 'string' || !body.childId || body.childId.length > 160 || !validRegistrationChild(body.displayName, body.birthDate, serviceDate(new Date().toISOString()))) return reply({ error: '児童の氏名・生年月日・校舎を確認してください。' }, 400);
    const campus = campuses.find(value => value.id === body.campusId);
    if (!campus) return reply({ error: 'この校舎への登録は許可されていません。' }, 403);
    const { data, error: registrationError } = await client.rpc('prepare_support_student_registration', { p: { id: body.operationId, link: body.linkId, actor: body.actorId,
      project: body.supportProjectRef, org: body.organizationId, table, child: body.childId, campus: campus.id, code: campus.code,
      name: body.displayName, birth: body.birthDate, domain, prefix, pad } });
    if (registrationError) {
      const code = registrationError.code, status = code === '42501' ? 403 : code === 'PT422' ? 422 : ['PT409', 'PT412', '23505'].includes(code) ? 409 : 503;
      // A failed SQL preparation is atomic. Only an absent source receipt proves no learner was created.
      const existing = await client.from('lesson_support_registrations').select('id').eq('id', body.operationId).maybeSingle();
      const denied = !existing.error && !existing.data && status !== 503;
      return reply({ error: code === 'PT412' ? '同名・同生年月日、または生年月日未登録の既存データがあります。新規作成せず既存アカウントを確認してください。' : code === 'PT422' ? '児童情報または空き児童番号を確認してください。児童番号は校舎ごとに1〜50です。' : '既存の登録・連携・校舎許可を確認してください。', operationId: body.operationId, resumable: !denied }, status);
    }
    return reply({ schemaVersion: 1, operationId: body.operationId, childId: body.childId, linkId: body.linkId,
      loginNumber: data.loginNumber, identity: { ...data, sourceProjectRef: new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0] } });
  } catch { return reply({ error: '新規登録の結果を確認できません。同じ操作を再確認してください。' }, 503); }
});
