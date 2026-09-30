import {assertEquals} from 'jsr:@std/assert@1';
import {artifactDue,artifactLifetimeMs} from './word-retention.ts';
Deno.test('Word artifacts expire after review, but not while awaiting review',()=>{
  const now=Date.now(),old=new Date(now-artifactLifetimeMs-1).toISOString();
  assertEquals(artifactDue({status:'pending',submitted_at:old},now),false);
  assertEquals(artifactDue({status:'approved',reviewed_at:old},now),true);
  assertEquals(artifactDue({status:'returned',reviewed_at:new Date(now).toISOString()},now),false);
  assertEquals(artifactDue({status:'expired',submitted_at:null},now),true);
  assertEquals(artifactDue({status:'approved',reviewed_at:old,artifact_deleted_at:old},now),false);
});
