import { createClient } from 'npm:@supabase/supabase-js@2';
import { artifactHash, publicRequest, uuid, validArtifact, wordBucket } from '../_shared/word-review.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(request.method!=='POST')return reply({error:'POSTで送信してください。'},405);
  try{
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    const {data:auth,error:authError}=await client.auth.getUser(token);
    if(authError||!auth.user)return reply({error:'児童本人のアカウントでログインしてください。'},401);
    const raw=await request.text();if(raw.length>4096)return reply({error:'送信内容を確認してください。'},400);
    const body=JSON.parse(raw),table=Deno.env.get('LESSON_USER_DATA_TABLE')||'user_data';
    if(!['user_data','test_user_data'].includes(table)||!['status','prepare','submit','cancel'].includes(body?.action)
      ||typeof body.studentId!=='string'||!/^student_[A-Za-z0-9_-]{1,140}$/.test(body.studentId))return reply({error:'申請対象を確認してください。'},400);
    const {data:access,error:accessError}=await client.from('lesson_user_access').select('user_data_id').eq('auth_user_id',auth.user.id).eq('user_data_id',body.studentId).eq('role','student');
    if(accessError||!access?.length)return reply({error:'児童本人のアカウントで操作してください。'},403);
    if(body.action==='status'){
      const {data:permissions,error}=await client.from('lesson_support_students').select('support_project_ref,organization_id,campus_id,support_link_id').eq('student_id',body.studentId).eq('data_table',table).eq('enabled',true).not('support_link_id','is',null);
      if(error)return reply({error:'先生との連携状態を取得できませんでした。'},503);
      let linked=false;
      for(const permission of permissions||[]){const {data:scope}=await client.from('lesson_support_scopes').select('enabled').eq('support_project_ref',permission.support_project_ref).eq('organization_id',permission.organization_id).eq('campus_id',permission.campus_id).eq('data_table',table).eq('enabled',true).maybeSingle();if(scope)linked=true;}
      const {data:rows,error:rowError}=await client.from('lesson_word_requests').select('*').eq('data_table',table).eq('student_id',body.studentId).neq('status','prepared').order('created_at',{ascending:false}).limit(100);
      if(rowError)return reply({error:'申請結果を取得できませんでした。'},503);
      return reply({linked,requests:(rows||[]).map(publicRequest)});
    }
    if(!uuid(body.requestId))return reply({error:'申請番号を確認してください。'},400);
    if(body.action==='prepare'){
      const {data:row,error}=await client.rpc('prepare_support_word_request',{p_actor:auth.user.id,p_student:body.studentId,p_table:table,
        p_stage:body.stageId,p_page:body.page,p_id:body.requestId,p_type:body.fileType,p_size:body.fileSize});
      if(error)return reply({error:['42501','22023','23505','PT409'].includes(error.code)?error.message:'申請を準備できませんでした。'},error.code==='42501'?403:409);
      const {data:upload,error:uploadError}=await client.storage.from(wordBucket).createSignedUploadUrl(row.file_path,{upsert:false});
      if(uploadError)return reply({error:'作品の送信先を用意できませんでした。'},503);
      return reply({request:publicRequest(row),upload:{path:upload.path,token:upload.token}});
    }
    const {data:row,error}=await client.from('lesson_word_requests').select('*').eq('id',body.requestId).eq('student_id',body.studentId).eq('data_table',table).maybeSingle();
    if(error||!row)return reply({error:'児童本人の申請を確認してください。'},403);
    if(body.action==='cancel'){
      if(row.status!=='prepared')return reply({error:'申請済みの作品は取り消せません。結果を確認してください。'},409);
      const {data:cancelled,error:cancelError}=await client.from('lesson_word_requests').update({status:'expired',revision:row.revision+1}).eq('id',row.id).eq('status','prepared').eq('revision',row.revision).select('id').maybeSingle();
      if(cancelError||!cancelled)return reply({error:'申請状態が変わりました。結果を確認してください。'},409);
      await client.storage.from(wordBucket).remove([row.file_path]);return reply({ok:true});
    }
    if(row.status==='pending')return reply({request:publicRequest(row)});
    if(row.status!=='prepared')return reply({error:'申請状態が変わりました。結果を確認してください。'},409);
    const {data:file,error:fileError}=await client.storage.from(wordBucket).download(row.file_path);
    if(fileError||!file)return reply({error:'作品の送信が完了していません。もう一度確認してください。'},409);
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(bytes.length!==row.file_size||!validArtifact(bytes,row.file_type))return reply({error:'PDF・PNG・JPEGの作品を選択してください。'},400);
    const {data:saved,error:saveError}=await client.rpc('submit_support_word_request',{p_actor:auth.user.id,p_id:row.id,p_hash:await artifactHash(bytes)});
    if(saveError)return reply({error:['42501','22023','PT409'].includes(saveError.code)?saveError.message:'申請の保存結果を確認できませんでした。'},saveError.code==='42501'?403:409);
    return reply({request:publicRequest(saved)});
  }catch{return reply({error:'申請を完了できませんでした。通信を確認してください。'},503);}
});
