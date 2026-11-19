import {createClient} from 'npm:@supabase/supabase-js@2';
import {secretMatches} from '../_shared/support-learning.ts';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request=>{
 if(request.method!=='POST')return reply({error:'POST required'},405);
 if(!await secretMatches(request.headers.get('x-lesson-bridge-key')||'',Deno.env.get('D_SUPPORT_BRIDGE_SECRET')||''))return reply({error:'連携認証を確認してください。'},401);
 try {
  const raw=await request.text();if(raw.length>32768)return reply({error:'送信内容を確認してください。'},400);
  const b=JSON.parse(raw),uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
  if(!['status','archive','restore'].includes(b.action)||!uuid(b.organizationId)||!uuid(b.actorId)
   ||!/^[a-z0-9]{20}$/.test(b.supportProjectRef||'')||!Array.isArray(b.links)||b.links.length>100
   ||(b.action!=='status'&&(b.links.length!==1||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)))
   return reply({error:'対象を確認してください。'},400);
  const table=Deno.env.get('LESSON_USER_DATA_TABLE')||'user_data';
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const results=[];
  for(const link of b.links){
   if(!uuid(link.id)||typeof link.child_id!=='string'||!link.child_id||link.child_id.length>160
    ||!/^student_[A-Za-z0-9_-]{1,140}$/.test(link.source_student_id||'')||link.source_table!==table
    ||typeof link.source_campus_id!=='string'||link.source_campus_id.length>80)return reply({error:'連携対象を確認してください。'},400);
   const {data,error}=await db.rpc('manage_support_student',{p:{action:b.action,actor:b.actorId,org:b.organizationId,project:b.supportProjectRef,
    table,student:link.source_student_id,child:link.child_id,link:link.id,campus:link.source_campus_id,expectedRevision:b.expectedRevision}});
   if(error){
    if(b.action==='status'){results.push({childId:link.child_id,linkId:link.id,unavailable:true});continue;}
    return reply({error:error.code==='PT423'?'合言葉の発行処理を確認してください。':'児童・連携・ログイン設定が変わっています。再取得してください。'},error.code==='42501'?403:409);
   }
   results.push(data);
  }
  return reply({items:results});
 }catch{return reply({error:'児童の管理情報を取得できませんでした。'},503);}
});
