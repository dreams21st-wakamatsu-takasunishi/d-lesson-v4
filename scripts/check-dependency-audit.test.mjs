import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAudit,auditDependencies} from './audit-dependencies.mjs';
const result=(counts={},status=0)=>({status,stdout:JSON.stringify({metadata:{vulnerabilities:{info:0,low:0,moderate:0,high:0,critical:0,total:0,...counts}}})});
test('only a successful well-formed audit can pass',()=>{
 assert.equal(classifyAudit(result()).state,'passed');
 for(const input of [{status:0,stdout:''},{status:0,stdout:'{}'},result({},1),result({total:-1})])
  assert.equal(classifyAudit(input).state,'unavailable');
 assert.equal(classifyAudit(result({high:1,total:1})).state,'vulnerable');
 assert.equal(classifyAudit(result({critical:1,total:1},1)).state,'vulnerable');
});
test('known vulnerabilities block immediately without retry',async()=>{
 let calls=0;
 await assert.rejects(()=>auditDependencies(()=>{calls++;return result({high:1,total:1},1);},()=>assert.fail('must not retry'),()=>{}),/High\/Critical/);
 assert.equal(calls,1);
});
test('unavailable external audit retries then blocks, never assumes safety',async()=>{
 let calls=0,pauses=0;
 await assert.rejects(()=>auditDependencies(()=>{calls++;return {status:1,stdout:'registry unavailable'};},async()=>{pauses++;},()=>{}),/Release remains blocked/);
 assert.equal(calls,3);assert.equal(pauses,2);
 calls=0;
 const recovered=await auditDependencies(()=>++calls===1?{status:1,stdout:''}:result(),async()=>{},()=>{});
 assert.equal(recovered.state,'passed');assert.equal(calls,2);
});
