import {createClient} from 'npm:@supabase/supabase-js@2';
import {classroomIdentity,secretMatches} from '../_shared/support-learning.ts';
import {artifactHash,publicRequest,uuid,wordBucket} from '../_shared/word-review.ts';
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
Deno.serve(async request=>{
  if(request.method!=='POST')return reply({error:'POSTで送信してください。'},405);
  if(!await secretMatches(request.headers.get('x-lesson-bridge-key')||'',Deno.env.get('D_SUPPORT_BRIDGE_SECRET')||''))return reply({error:'連携認証を確認してください。'},401);
  try{
    const raw=await request.text();if(raw.length>32768)return reply({error:'送信内容を確認してください。'},400);
    const body=JSON.parse(raw),table=Deno.env.get('LESSON_USER_DATA_TABLE')||'user_data',url=Deno.env.get('SUPABASE_URL')!;
    if(!/^[a-z0-9]{20}$/.test(body?.supportProjectRef||'')||!uuid(body?.organizationId)||!['user_data','test_user_data'].includes(table)
      ||!['bind','unbind','inbox','artifact','decide'].includes(body?.action))return reply({error:'操作と連携先を確認してください。'},400);
    const client=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const checkPermission=async(studentId:string,linkId?:string,childId?:string)=>{
      const {data:p,error}=await client.from('lesson_support_students').select('*').eq('support_project_ref',body.supportProjectRef).eq('organization_id',body.organizationId).eq('data_table',table).eq('student_id',studentId).eq('enabled',true).maybeSingle();
      if(error||!p)return null;
      const {data:scope}=await client.from('lesson_support_scopes').select('enabled').eq('support_project_ref',body.supportProjectRef).eq('organization_id',body.organizationId).eq('data_table',table).eq('campus_id',p.campus_id).eq('enabled',true).maybeSingle();
      if(!scope||(linkId&&p.support_link_id!==linkId)||(childId&&p.support_child_id!==childId))return null;
      const {data:row}=await client.from(table).select('id,data').eq('id',studentId).maybeSingle();
      const identity=row?.data?classroomIdentity(row.id,row.data,new URL(url).hostname.split('.')[0],table):null;
      return identity&&identity.campusId===p.campus_id?p:null;
    };
    if(body.action==='bind'||body.action==='unbind'){
      if(!uuid(body.linkId)||typeof body.childId!=='string'||!body.childId||body.childId.length>160)return reply({error:'連携対象を確認してください。'},400);
      if(typeof body.studentId!=='string'||!/^student_[A-Za-z0-9_-]{1,140}$/.test(body.studentId))return reply({error:'児童を確認してください。'},400);
      if(body.action==='bind'&&!await checkPermission(body.studentId))return reply({error:'児童の連携許可を確認してください。'},403);
      const {error}=await client.rpc('bind_support_word_student',{p_project:body.supportProjectRef,p_org:body.organizationId,p_table:table,p_student:body.studentId,p_link:body.linkId,p_child:body.childId,p_bind:body.action==='bind'});
      return error?reply({error:'連携状態を保存できませんでした。'},409):reply({ok:true});
    }
    if(body.action==='inbox'){
      if(!Array.isArray(body.links)||body.links.length>100)return reply({error:'連携対象を確認してください。'},400);
      if(!body.links.length)return reply({requests:[]});
      for(const link of body.links){
        if(!uuid(link.id)||typeof link.child_id!=='string'||typeof link.source_student_id!=='string')return reply({error:'連携対象を確認してください。'},400);
      }
      const {data:permissions,error:pError}=await client.from('lesson_support_students').select('*').eq('support_project_ref',body.supportProjectRef).eq('organization_id',body.organizationId).eq('data_table',table).eq('enabled',true).in('student_id',body.links.map((link:{source_student_id:string})=>link.source_student_id));
      const {data:scopes,error:sError}=await client.from('lesson_support_scopes').select('campus_id').eq('support_project_ref',body.supportProjectRef).eq('organization_id',body.organizationId).eq('data_table',table).eq('enabled',true);
      const {data:learners,error:lError}=await client.from(table).select('id,data').in('id',body.links.map((link:{source_student_id:string})=>link.source_student_id));
      if(pError||sError||lError)return reply({error:'児童の連携範囲を確認できませんでした。'},503);
      const permitted=body.links.filter((link:{id:string;child_id:string;source_student_id:string})=>{
        const p=permissions?.find(p=>p.student_id===link.source_student_id&&p.support_link_id===link.id&&p.support_child_id===link.child_id);
        const learner=learners?.find(row=>row.id===link.source_student_id);
        const identity=learner?.data?classroomIdentity(learner.id,learner.data,new URL(url).hostname.split('.')[0],table):null;
        return p&&identity&&identity.campusId===p.campus_id&&scopes?.some(s=>s.campus_id===p.campus_id);
      });
      if(!permitted.length)return reply({requests:[]});
      const base=()=>client.from('lesson_word_requests').select('*').eq('support_project_ref',body.supportProjectRef).eq('organization_id',body.organizationId).eq('data_table',table).in('link_id',permitted.map((link:{id:string})=>link.id));
      const {data:pending,error:pendingError}=await base().eq('status','pending').order('created_at',{ascending:false}).limit(1000);
      const {data:completed,error:completedError}=await base().in('status',['approved','returned','expired']).not('submitted_at','is',null).order('created_at',{ascending:false}).limit(200);
      if(pendingError||completedError)return reply({error:'申請一覧を取得できませんでした。'},503);
      return reply({requests:[...(pending||[]),...(completed||[])].map(publicRequest)});
    }
    if(!uuid(body.requestId)||!uuid(body.linkId)||!uuid(body.actorId)||typeof body.actorName!=='string'||body.actorName.length>100)return reply({error:'確認対象と職員を確認してください。'},400);
    const {data:row,error}=await client.from('lesson_word_requests').select('*').eq('id',body.requestId).eq('support_project_ref',body.supportProjectRef).eq('organization_id',body.organizationId).eq('link_id',body.linkId).eq('child_id',body.childId).maybeSingle();
    if(error||!row||!await checkPermission(row.student_id,body.linkId,body.childId))return reply({error:'申請と現在の児童連携を確認してください。'},403);
    if(body.action==='artifact'){
      if(row.artifact_deleted_at)return reply({error:'作品の保管期間が終了しています。'},410);
      const {data:signed,error}=await client.storage.from(wordBucket).createSignedUrl(row.file_path,120);
      return error?reply({error:'作品を開けませんでした。'},503):reply({url:signed.signedUrl,fileType:row.file_type,requestId:row.id,revision:row.revision,fileHash:row.file_hash});
    }
    if(body.reviewed!==true||body.fileHash!==row.file_hash)return reply({error:'この版の作品を確認してから承認してください。'},409);
    const {data:file,error:fileError}=await client.storage.from(wordBucket).download(row.file_path);
    if(fileError||!file||await artifactHash(new Uint8Array(await file.arrayBuffer()))!==row.file_hash)return reply({error:'作品の版を確認できません。'},409);
    const {data:saved,error:saveError}=await client.rpc('decide_support_word_request',{p_project:body.supportProjectRef,p_org:body.organizationId,p_link:body.linkId,p_child:body.childId,
      p_id:body.requestId,p_revision:body.revision,p_actor:body.actorId,p_name:body.actorName,p_decision:body.decision,p_reason:body.reason});
    if(saveError)return reply({error:['42501','22023','PT409'].includes(saveError.code)?saveError.message:'確認結果を保存できませんでした。'},saveError.code==='42501'?403:409);
    return reply({request:publicRequest(saved)});
  }catch{return reply({error:'Word確認を完了できませんでした。通信と設定を確認してください。'},503);}
});
