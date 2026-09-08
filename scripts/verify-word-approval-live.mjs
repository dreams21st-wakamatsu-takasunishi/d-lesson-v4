import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Explicitly opted-in integration test. No email is sent; all synthetic accounts are removed in finally.
if (!process.argv.includes('--allow-test-accounts')) throw new Error('Pass --allow-test-accounts to create temporary test accounts in the linked project.');
const ref = readFileSync(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8').trim();
assert.match(ref, /^[a-z0-9]+$/);
const args = `npx.cmd supabase projects api-keys --project-ref ${ref} --output json`;
let keys;
try {
    keys = JSON.parse(execFileSync('cmd.exe', ['/d','/s','/c',args], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }));
} catch { throw new Error('Could not obtain linked-project credentials from the authenticated Supabase CLI.'); }
const serviceKey = keys.find(key => key.name === 'service_role')?.api_key;
const anonKey = keys.find(key => key.name === 'anon')?.api_key;
assert.ok(serviceKey && anonKey, 'Required API keys unavailable');
const url = `https://${ref}.supabase.co`;
const options = { auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false} };
const service = createClient(url,serviceKey,options);
const prefix = 'word-verification-' + randomUUID();
const rowId = '__' + prefix;
const created = [];
const sessions = [];
const check = response => { if (response.error) throw new Error(response.error.code || 'Supabase request failed'); return response.data; };
const call = async (token, body) => {
    const response = await fetch(`${url}/functions/v1/approve-word-stage`, {
        method:'POST', headers:{apikey:anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify(body)
    });
    return {status:response.status, data:await response.json()};
};
try {
    for (const role of ['student','teacher']) {
        const password = randomUUID() + 'Aa9!';
        const email = `${prefix}-${role}@example.invalid`;
        const auth = check(await service.auth.admin.createUser({email,password,email_confirm:true}));
        created.push(auth.user.id);
        check(await service.from('lesson_user_access').insert({auth_user_id:auth.user.id,user_data_id:rowId,role,scope_type:role === 'teacher' ? 'campus_group' : 'all',scope_value:role === 'teacher' ? 'word-verification:A' : ''}));
        const client = createClient(url,anonKey,options);
        const signIn = check(await client.auth.signInWithPassword({email,password}));
        sessions.push({client,role,token:signIn.session.access_token,userId:auth.user.id});
    }
    check(await service.from('user_data').insert({id:rowId,data:{displayName:'Word verification',campusId:'word-verification',group:'A',coins:25,mouseLevel:3,examRecords:{romaji_daku_exam:true}}}));
    const student = sessions.find(session => session.role === 'student');
    const teacher = sessions.find(session => session.role === 'teacher');
    const body = {userDataId:rowId,stageId:'w_b1_1',page:'5',table:'user_data'};
    assert.equal((await call(anonKey,body)).status,401, 'Unauthenticated approval');
    assert.equal((await call(student.token,body)).status,403, 'Student approval');
    const rls = await student.client.rpc('approve_lesson_word',{p_actor:teacher.userId,p_user_id:rowId,p_stage_id:'w_b1_1',p_page:'5'});
    assert.ok(rls.error, 'Student invoked service-only RPC');
    assert.equal((await call(teacher.token,{...body,table:'test_user_data'})).status,400,'Mismatched table');
    assert.equal((await call(teacher.token,{...body,stageId:'w_b1_2'})).status,400,'Locked stage');
    check(await service.from('lesson_user_access').update({scope_value:'word-verification:B'}).eq('auth_user_id',teacher.userId));
    assert.equal((await call(teacher.token,body)).status,403,'Out-of-scope teacher');
    check(await service.from('lesson_user_access').update({scope_value:'word-verification:A'}).eq('auth_user_id',teacher.userId));
    const result = await call(teacher.token,body);
    assert.equal(result.status,200, result.data.error || 'Teacher approval failed');
    assert.equal(result.data.coinGain,500);
    assert.equal(result.data.data.coins,525);
    assert.equal(result.data.data.mouseLevel,3);
    const repeat = await call(teacher.token,body);
    assert.equal(repeat.status,200);
    assert.equal(repeat.data.coinGain,0);
    assert.equal(repeat.data.data.coins,525);
    assert.equal((await student.client.auth.getUser()).data.user.id,student.userId,'Child session changed');
    const stored = check(await student.client.from('user_data').select('data').eq('id',rowId).single());
    assert.equal(stored.data.wordProgress.w_b1_1.approvedBy,teacher.userId);
    const parallel = await Promise.all([call(teacher.token,{...body,stageId:'w_b1_2'}),call(teacher.token,{...body,stageId:'w_b1_2'})]);
    assert.deepEqual(parallel.map(item => item.data.coinGain).sort((a,b)=>a-b),[0,500],'Concurrent reward duplication');
    console.log('Live Auth / Edge / RLS / scoped approval / concurrent idempotency / child-session tests passed.');
} finally {
    for (const session of sessions) await session.client.auth.signOut({scope:'local'});
    const failures = [];
    const deletion = await service.from('user_data').delete().eq('id',rowId);
    if (deletion.error) failures.push('test row');
    const audit = await service.from('lesson_word_approvals').delete().eq('user_data_id',rowId);
    if (audit.error) failures.push('test approvals');
    for (const id of created) if ((await service.auth.admin.deleteUser(id)).error) failures.push(id);
    if (failures.length) throw new Error('Cleanup needs attention: '+failures.join(', '));
    console.log('All temporary users and approval records removed.');
}
