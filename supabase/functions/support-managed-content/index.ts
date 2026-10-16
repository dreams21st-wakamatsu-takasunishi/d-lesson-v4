import {createClient} from 'npm:@supabase/supabase-js@2';
import {secretMatches} from '../_shared/support-learning.ts';
import {parseContentCatalog,parseContentItem} from '../../../src/utils/managed-content.js';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request=>{
 if(request.method!=='POST')return reply({error:'POSTで送信してください。'},405);
 if(!await secretMatches(request.headers.get('x-lesson-bridge-key')||'',Deno.env.get('D_SUPPORT_BRIDGE_SECRET')||''))return reply({error:'連携認証を確認してください。'},401);
 try{
  const raw=await request.text();if(raw.length>140000)return reply({error:'内容が長すぎます。'},400);
  const body=JSON.parse(raw),table=Deno.env.get('LESSON_USER_DATA_TABLE')||'user_data';
  const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
  if(!['list','get','save'].includes(body.action)||!/^[a-z0-9]{20}$/.test(body.supportProjectRef||'')
   ||!uuid(body.organizationId)||!uuid(body.actorId)||!['user_data','test_user_data'].includes(table))return reply({error:'連携の対象を確認してください。'},400);
  if(body.action!=='list'&&(typeof body.campusId!=='string'||!body.campusId||body.campusId.length>80||body.campusId==='public'))return reply({error:'校舎を選択してください。'},400);
  let item;
  if(body.action==='save'){
   if(!Number.isSafeInteger(body.revision)||body.revision<0||!/^[a-f0-9]{32}$/.test(body.fingerprint||'')||!uuid(body.operationId)||body.confirmed!==true)return reply({error:'内容を再取得して確認してください。'},400);
   try{item=parseContentItem(body.kind,body.item);}catch{return reply({error:'教材・ごほうびの入力内容を確認してください。'},400);}
  }
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  if(item){
   const base=await client.rpc('manage_support_content',{p:{action:'get',supportProjectRef:body.supportProjectRef,organizationId:body.organizationId,actorId:body.actorId,dataTable:table,campusId:body.campusId}});
   if(base.error)return reply({error:'校舎の連携許可と教材を再取得してください。'},base.error.code==='42501'?403:503);
   parseContentCatalog(base.data.content);
  }
  const {data,error}=await client.rpc('manage_support_content',{p:{action:body.action,supportProjectRef:body.supportProjectRef,organizationId:body.organizationId,actorId:body.actorId,dataTable:table,
   ...(body.action!=='list'?{campusId:body.campusId}:{}),...(item?{kind:body.kind,item,revision:body.revision,fingerprint:body.fingerprint,operationId:body.operationId}:{})}});
  if(error)return reply({error:['42501','PT409','PT429','22023'].includes(error.code)?error.message:'教材の保存先を確認してください。'},error.code==='42501'?403:error.code==='PT409'?409:error.code==='PT429'?429:503);
  return reply({schemaVersion:1,dataTable:table,...data,...(data.content?{content:parseContentCatalog(data.content)}:{})});
 }catch{return reply({error:'教材・ごほうびを取得・保存できませんでした。'},503);}
});
