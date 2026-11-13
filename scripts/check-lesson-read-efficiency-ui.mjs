// Use a Vite instance at :5183 with the fake Supabase origin below.
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const cli=process.argv[process.argv.indexOf('--cli')+1], session='lesson-read-'+process.pid;
if(!process.argv.includes('--cli'))throw Error('--cli required');
function command(...args){
 const r=spawnSync(process.execPath,[resolve(cli),'-s='+session,...args],{encoding:'utf8',timeout:110000,maxBuffer:4194304});
 if(r.status!==0||r.stdout.includes('### Error'))throw Error(r.stdout+r.stderr);
 return r.stdout;
}
async function check(page, tokens){
 const assert=(ok,label)=>{if(!ok)throw Error(label);};
 const web='http://127.0.0.1:5183',backend='https://lesson-fixture.invalid';
 const settings='__GLOBAL_SETTINGS__', roster=[{id:'student_fixture',data:{displayName:'架空児童',campusId:'main',birthdate:'2018-01-01',practiceLogs:[],examRecords:{},loginStamps:[new Date().toISOString().slice(0,10)]}}];
 const errors=[],calls=[],writes=[];
 let role='teacher',failRoster=true;
 page.on('pageerror',error=>errors.push(error.message));
 await page.context().route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===web)return route.continue();
  if(url.origin!==backend)return route.abort();
  const idFilter=url.searchParams.get('id');
  calls.push({path:url.pathname,idFilter,method:req.method()});
  let json;
  switch(url.pathname){
   case '/auth/v1/user':json=tokens[role].user;break;
   case '/rest/v1/lesson_user_access':json=[{auth_user_id:tokens[role].user.id,user_data_id:role==='student'?'student_fixture':'__teacher__',role,scope_type:'all',scope_value:''}];break;
   case '/rest/v1/user_data':
    if(idFilter==='eq.'+settings){json=[{id:settings,data:{isMaster:true}}];break;}
    json=roster;break;
   case '/rest/v1/rpc/read_lesson_staff_roster':
    if(failRoster)return route.fulfill({status:503,json:{message:'fixture unavailable'}});
    json=roster;break;
   case '/rest/v1/rpc/read_own_lesson_snapshot':json={data:roster[0].data,revision:'1'};break;
   case '/rest/v1/rpc/patch_own_lesson_snapshot':writes.push(req.postDataJSON());json='2';break;
   case '/rest/v1/lesson_settings':json=null;break;
   case '/rest/v1/lesson_campuses':json=[{id:'main',name:'架空校舎',code:'main',active:true,registration_enabled:true}];break;
   case '/rest/v1/lesson_campus_content':
   case '/rest/v1/lesson_reward_grants':
   case '/rest/v1/rpc/get_lesson_student_management_status':json=[];break;
   case '/functions/v1/student-learning-tasks':json={schemaVersion:1,tasks:[]};break;
   default:return route.abort();
  }
  return route.fulfill({json});
 });
 await page.addInitScript(({teacher,student})=>sessionStorage.setItem('sb-lesson-fixture-d-lesson-auth-token',JSON.stringify(location.search.includes('student')?student:teacher)),tokens);
 await page.goto(web);
 const teacher=page.locator('#title-teacher-menu-btn');
 await teacher.waitFor({timeout:10000});
 const rosterCalls=()=>calls.filter(c=>c.path==='/rest/v1/user_data');
 assert(rosterCalls().length===1&&rosterCalls()[0].idFilter==='eq.'+settings,'teacher startup fetched the full roster');
 await teacher.click();
 await page.getByText('児童情報を読み込めませんでした。通信状態を確認して、先生メニューをもう一度開いてください。',{exact:true}).waitFor({timeout:10000});
 await page.locator('#custom-alert-overlay button').last().click();
 failRoster=false;
 await teacher.click();
 await page.locator('#screen-teacher-menu.active').waitFor({timeout:10000});
 assert(calls.filter(c=>c.path==='/rest/v1/rpc/read_lesson_staff_roster').length===2&&rosterCalls().length===1,'retry did not request only the summary');
 assert((await page.locator('#teacher-menu-scope').innerText()).includes('1人'),'teacher totals unavailable after load');
 role='student';
 calls.length=0;
 await page.goto(web+'/?student');
 await page.locator('#screen-category.active').waitFor({timeout:10000}).catch(()=>{throw Error('Student view not reached: '+JSON.stringify({calls,errors}));});
 assert(rosterCalls().length===1&&rosterCalls()[0].idFilter==='eq.'+settings&&calls.filter(c=>c.path==='/rest/v1/rpc/read_own_lesson_snapshot').length===1,'student startup not scoped');
 const saved=await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').map(entry=>entry.name).find(name=>name.includes('/src/api/user.js'));
  const api=await import(url);
  api.users[api.currentUser].coins=10;
  return api.saveUsers(false);
 });
 assert(saved&&writes.length===1&&writes[0].p_revision==='1'&&writes[0].p_patch.coins===10,'student delta not written');
 assert(!Object.hasOwn(writes[0].p_patch,'displayName')&&!rosterCalls().some(x=>x.method==='POST'),'unchanged identity or full row sent');
 assert(!errors.length,errors.join('\n'));
 return {passed:true,fictional:true};
}
const createToken=role=>{
 const user={id:role==='student'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',aud:'authenticated',role:'authenticated',email:role+'@example.invalid',app_metadata:{provider:'email'},user_metadata:{}};
 const exp=Math.floor(Date.now()/1000)+3600, encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 return {access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp,role:'authenticated'})+'.fixture',refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:exp,user};
};
try{
 command('open','about:blank');command('snapshot');
 const output=command('run-code',`async(page)=>await (${check.toString()})(page,${JSON.stringify({teacher:createToken('teacher'),student:createToken('student')})})`);
 const result=output.match(/### Result\s+([\s\S]*?)\s+### Ran/);
 if(!result||!JSON.parse(result[1]).passed)throw Error(output);
 console.log(result[1]);
}finally{command('close');}
