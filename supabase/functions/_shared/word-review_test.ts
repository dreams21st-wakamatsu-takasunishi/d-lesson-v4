import {artifactHash,publicRequest,validArtifact,uuid} from './word-review.ts';
const assert=(condition:unknown)=>{if(!condition)throw Error('assertion failed');};
Deno.test('accepts only matching PDF/PNG/JPEG bytes and bounded size',()=>{
  assert(validArtifact(new TextEncoder().encode('%PDF-1.7'),'application/pdf'));
  assert(!validArtifact(new TextEncoder().encode('<html>'),'application/pdf'));
  assert(validArtifact(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'));
  assert(validArtifact(new Uint8Array([255,216,255]),'image/jpeg'));
  assert(!validArtifact(new Uint8Array(8388609),'application/pdf'));
});
Deno.test('hash detects a changed artifact',async()=>{assert(await artifactHash(new Uint8Array([1]))!==await artifactHash(new Uint8Array([2])));});
Deno.test('public request excludes source path, account IDs and private metadata',()=>{
  const result=publicRequest({id:'a',file_path:'private',reviewer_id:'secret',email:'secret',file_hash:'secret'});
  assert(!('file_path' in result)&&!('reviewer_id' in result)&&!('email' in result)&&!('file_hash' in result));
  assert(!uuid('not-a-uuid'));
});
