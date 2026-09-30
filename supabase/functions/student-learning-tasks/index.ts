import {createClient} from 'npm:@supabase/supabase-js@2';
import {classroomIdentity} from '../_shared/support-learning.ts';
import {publicTask} from '../_shared/learning-tasks.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(request.method!=='POST')return reply({error:'POSTで送信してください。'},405);
 try{
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:auth,error:authError}=await client.auth.getUser(token);
  if(authError||!auth.user)return reply({error:'児童本人のアカウントでログインしてください。'},401);
  const raw=await request.text();if(raw.length>1024)return reply({error:'児童を確認してください。'},400);
  const body=JSON.parse(raw),table=Deno.env.get('LESSON_USER_DATA_TABLE')||'user_data';
  if(!['user_data','test_user_data'].includes(table)||!(/^student_[A-Za-z0-9_-]{1,140}$/).test(body.studentId||''))return reply({error:'児童を確認してください。'},400);
  const {data:access,error:aError}=await client.from('lesson_user_access').select('user_data_id').eq('auth_user_id',auth.user.id).eq('user_data_id',body.studentId).eq('role','student');
  if(aError)return reply({error:'ログイン状態を取得できません。'},503);
  if(!access?.length)return reply({error:'児童本人のアカウントで操作してください。'},403);
  const {data:learner,error:lError}=await client.from(table).select('id,data').eq('id',body.studentId).maybeSingle();
  const identity=learner?.data?classroomIdentity(learner.id,learner.data,new URL(Deno.env.get('SUPABASE_URL')!).hostname.split('.')[0],table):null;
  if(lError)return reply({error:'学習アカウントを取得できません。'},503);
  if(!identity)return reply({schemaVersion:1,tasks:[]});
  const {data:permits,error:pError}=await client.from('lesson_support_students').select('*').eq('data_table',table).eq('student_id',body.studentId).eq('campus_id',identity.campusId).eq('enabled',true).not('support_link_id','is',null);
  if(pError)return reply({error:'先生との連携を取得できません。'},503);
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),tasks=[];
  for(const p of permits||[]){
   const {data:scope,error:sError}=await client.from('lesson_support_scopes').select('enabled').eq('support_project_ref',p.support_project_ref).eq('organization_id',p.organization_id).eq('data_table',table).eq('campus_id',p.campus_id).eq('enabled',true).maybeSingle();
   if(sError)return reply({error:'先生との連携を取得できません。'},503);
   if(!scope)continue;
   const {data:rows,error}=await client.from('lesson_learning_tasks').select('*').eq('support_project_ref',p.support_project_ref).eq('organization_id',p.organization_id).eq('data_table',table).eq('student_id',body.studentId).eq('link_id',p.support_link_id).eq('child_id',p.support_child_id).eq('active',true).lte('starts_on',today).gte('ends_on',today).order('created_at',{ascending:true}).limit(20);
   if(error)return reply({error:'先生からの課題を取得できません。'},503);
   tasks.push(...(rows||[]).map(publicTask));
  }
  return reply({schemaVersion:1,tasks});
 }catch{return reply({error:'先生からの課題を取得できませんでした。'},503);}
});
