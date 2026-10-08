import { createClient } from 'npm:@supabase/supabase-js@2';
import { classroomIdentity, practiceForDate, secretMatches, validDate } from '../_shared/support-learning.ts';
import { readBoundProgress } from '../_shared/support-progress.ts';

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

Deno.serve(async request => {
  if (request.method !== 'POST') return reply({ error: 'POSTで送信してください。' }, 405);
  const secret = Deno.env.get('D_SUPPORT_BRIDGE_SECRET') || '';
  if (!await secretMatches(request.headers.get('x-lesson-bridge-key') || '', secret)) return reply({ error: '連携認証を確認してください。' }, 401);
  try {
    const text = await request.text();
    if (text.length > 2048) return reply({ error: '送信内容を確認してください。' }, 400);
    const body = JSON.parse(text);
    const table = Deno.env.get('LESSON_USER_DATA_TABLE') || 'user_data';
    const url = Deno.env.get('SUPABASE_URL') || '';
    const sourceProject = new URL(url).hostname.split('.')[0];
    if (!['inspect', 'history', 'progress'].includes(body?.action) || !/^[a-z0-9]{20}$/.test(body?.supportProjectRef || '')
      || !/^[0-9a-f-]{36}$/i.test(body?.organizationId || '') || !/^student_[A-Za-z0-9_-]{1,140}$/.test(body?.studentId || '')
      || !['user_data', 'test_user_data'].includes(table) || (body.action === 'history' && !validDate(body.date))) {
      return reply({ error: '連携対象と日付を確認してください。' }, 400);
    }
    const client = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    if (body.action === 'progress') {
      if (typeof body.childId !== 'string' || !body.childId || body.childId.length > 160 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.linkId || '')) return reply({ error: '児童と学習連携を確認してください。' }, 400);
      const scopeQuery = () => client.from('lesson_support_scopes').select('campus_id')
        .eq('support_project_ref', body.supportProjectRef).eq('organization_id', body.organizationId).eq('data_table', table).eq('enabled', true);
      const permissionQuery = () => client.from('lesson_support_students').select('campus_id,support_child_id,support_link_id')
        .eq('support_project_ref', body.supportProjectRef).eq('organization_id', body.organizationId).eq('data_table', table)
        .eq('student_id', body.studentId).eq('enabled', true).maybeSingle();
      const result = await readBoundProgress({
        scopes: async () => { const { data, error } = await scopeQuery(); if (error) throw error; return (data || []).map(row => row.campus_id); },
        permission: async () => { const { data, error } = await permissionQuery(); if (error) throw error; return data; },
        learner: async () => { const { data, error } = await client.from(table).select('id,data').eq('id', body.studentId).maybeSingle(); if (error) throw error; return data; },
      }, body, sourceProject, table);
      return reply(result);
    }
    const { data: scopes, error: scopeError } = await client.from('lesson_support_scopes').select('campus_id')
      .eq('support_project_ref', body.supportProjectRef).eq('organization_id', body.organizationId).eq('data_table', table).eq('enabled', true);
    if (scopeError) return reply({ error: '学習側の連携設定を確認できません。' }, 503);
    if (!scopes?.length) return reply({ error: 'この事業所への学習連携は許可されていません。' }, 403);
    const { data: permission, error: permissionError } = await client.from('lesson_support_students').select('campus_id')
      .eq('support_project_ref', body.supportProjectRef).eq('organization_id', body.organizationId)
      .eq('data_table', table).eq('student_id', body.studentId).eq('enabled', true).maybeSingle();
    if (permissionError) return reply({ error: '児童の連携許可を確認できません。' }, 503);
    if (!permission || !scopes.some(scope => scope.campus_id === permission.campus_id)) {
      return reply({ error: '対象の教室児童を確認できません。IDと連携範囲を確認してください。' }, 403);
    }
    const { data: row, error } = await client.from(table).select('id,data').eq('id', body.studentId).maybeSingle();
    if (error) return reply({ error: '学習データを取得できません。' }, 503);
    const identity = row?.data ? classroomIdentity(row.id, row.data, sourceProject, table) : null;
    if (!identity || !identity.displayName || permission.campus_id !== identity.campusId) {
      return reply({ error: '対象の教室児童を確認できません。IDと連携範囲を確認してください。' }, 403);
    }
    return reply({ schemaVersion: 1, identity, ...(body.action === 'history' ? {
      date: body.date, events: practiceForDate(row!.data, body.date), historyComplete: false,
      historyNotice: '保存されている履歴のみです。実績がない場合も未実施とは判断できません。',
    } : {}) });
  } catch (error) {
    return error instanceof Error && 'status' in error && error.status === 403
      ? reply({ error: error.message }, 403) : reply({ error: '連携処理を完了できませんでした。' }, 503);
  }
});
