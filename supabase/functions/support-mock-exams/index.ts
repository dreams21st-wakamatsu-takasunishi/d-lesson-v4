import { createClient } from 'npm:@supabase/supabase-js@2';
import { secretMatches } from '../_shared/support-learning.ts';
import { defaultMockExamCatalog, parseManagedMockExamProblem, parseManagedMockExamCatalog } from '../../../src/utils/mock-exam-catalog.js';
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request => {
  if (request.method !== 'POST') return reply({error:'POSTで送信してください。'},405);
  if (!await secretMatches(request.headers.get('x-lesson-bridge-key') || '',Deno.env.get('D_SUPPORT_BRIDGE_SECRET') || '')) return reply({error:'連携認証を確認してください。'},401);
  try {
    const raw = await request.text(); if (raw.length > 40000) return reply({error:'問題文が長すぎます。'},400);
    const body = JSON.parse(raw), table = Deno.env.get('LESSON_USER_DATA_TABLE') || 'user_data';
    const uuid = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
    if (!body || !['get','create','update','delete'].includes(body.action) || !/^[a-z0-9]{20}$/.test(body.supportProjectRef || '') || !uuid(body.organizationId) || !uuid(body.actorId) || !['user_data','test_user_data'].includes(table)
      || typeof body.campusId !== 'string' || !body.campusId || body.campusId.length > 80 || body.campusId === 'public') return reply({error:'校舎と操作を確認してください。'},400);
    const mutation = body.action !== 'get';
    if (mutation && (body.confirmed !== true || !uuid(body.operationId) || !Number.isSafeInteger(body.revision) || body.revision < 0 || !/^[a-f0-9]{32}$/.test(body.fingerprint || ''))) return reply({error:'配信内容を再確認してください。'},400);
    let item;
    if (body.action === 'create' || body.action === 'update') {try {item = parseManagedMockExamProblem(body.item);} catch {return reply({error:'回数・本文・利用許諾を確認してください。'},400);}}
    if (body.action === 'delete' && !/^round-[1-9]\d{0,2}$/.test(body.id || '')) return reply({error:'削除する問題を確認してください。'},400);
    const client = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const {data,error} = await client.rpc('manage_support_mock_exams',{p:{action:body.action,dataTable:table,supportProjectRef:body.supportProjectRef,organizationId:body.organizationId,actorId:body.actorId,campusId:body.campusId,defaults:defaultMockExamCatalog(),...(mutation?{revision:body.revision,fingerprint:body.fingerprint,operationId:body.operationId}:{}),...(item?{item}:{}),...(body.action==='delete'?{id:body.id}:{})}});
    if (error) return reply({error:['42501','PT409','PT429','22023'].includes(error.code)?error.message:'問題文の保存先を確認してください。'},error.code==='42501'?403:error.code==='PT409'?409:error.code==='PT429'?429:error.code==='22023'?400:503);
    return reply({schemaVersion:1,dataTable:table,...data,catalog:parseManagedMockExamCatalog(data.catalog)});
  } catch {return reply({error:'模擬試験の問題を取得・保存できませんでした。'},503);}
});
