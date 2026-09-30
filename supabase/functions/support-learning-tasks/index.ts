import {createClient} from 'npm:@supabase/supabase-js@2';
import {classroomIdentity,secretMatches} from '../_shared/support-learning.ts';
import {uuid} from '../_shared/word-review.ts';
import {publicTask} from '../_shared/learning-tasks.ts';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request=>{
 if(request.method!=='POST')return reply({error:'POSTで送信してください。'},405);
 if(!await secretMatches(request.headers.get('x-lesson-bridge-key')||'',Deno.env.get('D_SUPPORT_BRIDGE_SECRET')||''))return reply({error:'連携認証を確認してください。'},401);
 try{
  const raw=await request.text();if(raw.length>4096)return reply({error:'課題の内容を確認してください。'},400);
  const body=JSON.parse(raw),table=Deno.env.get('LESSON_USER_DATA_TABLE')||'user_data',url=Deno.env.get('SUPABASE_URL')!;
  if(!['list','save'].includes(body.action)||!uuid(body.organizationId)||!uuid(body.linkId)||!uuid(body.actorId)
   ||!(/^[a-z0-9]{20}$/).test(body.supportProjectRef||'')||!(/^student_[A-Za-z0-9_-]{1,140}$/).test(body.studentId||'')
   ||typeof body.childId!=='string'||!body.childId||body.childId.length>160||!['user_data','test_user_data'].includes(table))return reply({error:'課題の対象を確認してください。'},400);
  const client=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:p,error}=await client.from('lesson_support_students').select('*').eq('support_project_ref',body.supportProjectRef).eq('organization_id',body.organizationId).eq('data_table',table).eq('student_id',body.studentId).eq('enabled',true).eq('support_link_id',body.linkId).eq('support_child_id',body.childId).maybeSingle();
  if(error)return reply({error:'児童の連携許可を取得できません。'},503);
  if(!p)return reply({error:'児童の連携許可を確認してください。'},403);
  const {data:scope,error:scopeError}=await client.from('lesson_support_scopes').select('enabled').eq('support_project_ref',body.supportProjectRef).eq('organization_id',body.organizationId).eq('data_table',table).eq('campus_id',p.campus_id).eq('enabled',true).maybeSingle();
  const {data:learner,error:learnerError}=await client.from(table).select('id,data').eq('id',body.studentId).maybeSingle();
  const identity=learner?.data?classroomIdentity(learner.id,learner.data,new URL(url).hostname.split('.')[0],table):null;
  if(scopeError||learnerError)return reply({error:'学習アカウントを取得できません。'},503);
  if(!scope||!identity||identity.campusId!==p.campus_id)return reply({error:'教室の連携範囲を確認してください。'},403);
  if(body.action==='list'){
   const {data:rows,error}=await client.from('lesson_learning_tasks').select('*').eq('support_project_ref',body.supportProjectRef).eq('organization_id',body.organizationId).eq('data_table',table).eq('student_id',body.studentId).eq('link_id',body.linkId).eq('child_id',body.childId).order('active',{ascending:false}).order('updated_at',{ascending:false}).limit(100);
   return error?reply({error:'課題を取得できません。'},503):reply({schemaVersion:1,tasks:(rows||[]).map(publicTask)});
  }
  const t=body.task;
  if(!t||!uuid(t.id)||!Number.isSafeInteger(t.revision)||typeof t.active!=='boolean')return reply({error:'課題を再取得してください。'},400);
  const {data:saved,error:saveError}=await client.rpc('save_support_learning_task',{p_project:body.supportProjectRef,p_org:body.organizationId,p_table:table,p_student:body.studentId,p_link:body.linkId,p_child:body.childId,p_id:t.id,p_revision:t.revision,p_category:t.category,p_title:t.title,p_instructions:t.instructions,p_start:t.startsOn,p_end:t.endsOn,p_active:t.active,p_actor:body.actorId,p_name:body.actorName});
  return saveError?reply({error:['42501','22023','PT409'].includes(saveError.code)?saveError.message:'課題を保存できませんでした。'},saveError.code==='42501'?403:409):reply({schemaVersion:1,task:publicTask(saved)});
 }catch{return reply({error:'課題を取得・保存できませんでした。通信を確認してください。'},503);}
});
