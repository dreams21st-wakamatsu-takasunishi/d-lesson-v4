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
test('daily monitoring flags every severity while the release threshold stays high',async()=>{
 const monitor={monitor:true};
 for (const severity of ['info','low','moderate','high','critical']) {
  const audit=result({[severity]:1,total:1});
  assert.equal(classifyAudit(audit,monitor).state,'vulnerable');
  assert.equal(classifyAudit(audit).state,['high','critical'].includes(severity)?'vulnerable':'passed');
  await assert.rejects(()=>auditDependencies(()=>({...audit,status:1}),()=>assert.fail('known finding must not retry'),()=>{},monitor),/warnings require review/);
 }
 assert.equal(classifyAudit(result(),monitor).state,'passed');
});
test('invalid totals or a failed request with no findings never pass',()=>{
 const monitor={monitor:true};
 assert.equal(classifyAudit(result({low:1,total:0}),monitor).state,'unavailable');
 assert.equal(classifyAudit(result({},1),monitor).state,'unavailable');
 const report=classifyAudit(result({low:1,total:1,unexpected:'not for public output'}),monitor);
 assert.equal(Object.hasOwn(report.counts,'unexpected'),false);
});
