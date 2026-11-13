// Synthetic data only. Run with npm exec --package=@electric-sql/pglite.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {delimiter,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {practiceForDate} from '../supabase/functions/_shared/support-learning.ts';
const runtime=(process.env.PATH||'').split(delimiter).map(path=>resolve(path,'..','@electric-sql/pglite/dist/index.js')).find(existsSync);
if(!runtime)throw Error('PGlite is not available');
const {PGlite}=await import(pathToFileURL(runtime).href),db=new PGlite();
const read=path=>readFileSync(new URL('../supabase/sql/'+path,import.meta.url),'utf8');
const project='abcdefghijklmnopqrst',org='33333333-3333-4333-8333-333333333333';
const event=(id,at)=>({id,at,category:'keyboard',title:'架空練習'});
const practiceLogs=[
 event('before','2026-10-31T14:59:59.999Z'),event('start','2026-10-31T15:00:00.000Z'),
 event('end','2026-11-01T14:59:59.999Z'),event('after','2026-11-01T15:00:00.000Z'),
 event('offset','2026-11-01T06:00:00+09:00'),event('legacy','2026-11-01T12:00:00Z'),
 event('invalid','invalid-date'),event('offset','2026-11-01T06:00:00+09:00'),
 ...Array.from({length:290},(_,i)=>({...event('other'+i,'2026-10-01T12:00:00.000Z'),detail:'架空の別日履歴'.repeat(20)})),
];
const data={campusId:'main',displayName:'架空児童',birthdate:'2018-01-01',practiceLogs,privateNote:'must not leave the database'};
const day=async(table='user_data',organization=org,date='2026-11-01')=>(await db.query('select public.read_support_learning_day($1,$2,$3,$4,$5) as day',[project,organization,table,'student_fixture',date])).rows[0].day;
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create table public.user_data(id text primary key,data jsonb);
   create table public.test_user_data(id text primary key,data jsonb);
   grant select on public.user_data,public.test_user_data to service_role;`);
 await db.exec(read('support_learning_bridge.sql'));
 await db.exec(read('support_learning_day_history.sql'));
 await db.query('insert into user_data values($1,$2)',['student_fixture',data]);
 await db.query('insert into lesson_support_scopes(support_project_ref,organization_id,data_table,campus_id,enabled) values($1,$2,$3,$4,true)',[project,org,'user_data','main']);
 await db.query('insert into lesson_support_students(support_project_ref,organization_id,data_table,campus_id,student_id,enabled) values($1,$2,$3,$4,$5,true)',[project,org,'user_data','main','student_fixture']);
 for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(()=>day(),error=>error.code==='42501');
   await db.exec('reset role');
 }
 await db.exec('set role service_role');
 const actual=await day();
 assert.deepEqual(practiceForDate(actual.data,'2026-11-01'),practiceForDate(data,'2026-11-01'));
 assert.deepEqual(practiceForDate(actual.data,'2026-11-01').map(x=>x.id),['end','legacy','offset','start']);
 assert.ok(!Object.hasOwn(actual.data,'privateNote'));
 assert.ok(Buffer.byteLength(JSON.stringify(actual))<Buffer.byteLength(JSON.stringify(data))/20);
 assert.equal(await day('test_user_data'),null);
 assert.equal(await day('user_data','44444444-4444-4444-8444-444444444444'),null);
 await assert.rejects(()=>day('other_table'),error=>error.code==='22023');
 await db.exec("update lesson_support_students set enabled=false");
 assert.equal(await day(),null);
 await db.exec("reset role");
 assert.deepEqual((await db.query("select data from user_data where id='student_fixture'")).rows[0].data,data);
 console.log('Lesson day history: Japan boundaries, legacy parity, authorization, and synthetic payload reduction passed');
}finally{await db.close();}
