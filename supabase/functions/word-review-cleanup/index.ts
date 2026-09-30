import {createClient} from 'npm:@supabase/supabase-js@2';
import {wordBucket} from '../_shared/word-review.ts';
import {artifactDue,preparedLifetimeMs,pendingLifetimeMs} from '../_shared/word-retention.ts';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request=>{
  if(request.method!=='POST')return reply({error:'POST required'},405);
  const secret=Deno.env.get('WORD_REVIEW_CLEANUP_SECRET');
  if(!secret||request.headers.get('x-cleanup-secret')!==secret)return reply({error:'Not authorized'},403);
  try{
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}}),now=Date.now();
    // Expiration and decisions use the same row locks and version checks.
    const {error:expireError}=await client.rpc('expire_support_word_requests',{p_prepared_before:new Date(now-preparedLifetimeMs).toISOString(),p_pending_before:new Date(now-pendingLifetimeMs).toISOString()});
    if(expireError)throw expireError;
    const {data:rows,error}=await client.from('lesson_word_requests').select('id,status,file_path,created_at,submitted_at,reviewed_at,artifact_deleted_at').is('artifact_deleted_at',null).in('status',['approved','returned','expired']).order('created_at').limit(500);
    if(error)throw error;
    let removed=0;
    for(const row of rows||[]){
      if(!artifactDue(row,now))continue;
      const {error:removeError}=await client.storage.from(wordBucket).remove([row.file_path]);if(removeError)throw removeError;
      const {error:markError}=await client.from('lesson_word_requests').update({artifact_deleted_at:new Date(now).toISOString()}).eq('id',row.id);if(markError)throw markError;removed++;
    }
    return reply({ok:true,removed});
  }catch{return reply({error:'Word cleanup failed; retry required'},503);}
});
