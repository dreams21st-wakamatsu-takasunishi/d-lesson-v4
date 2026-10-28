import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const args=process.argv.slice(2),cli=args[args.indexOf('--cli')+1];
if(!args.includes('--cli'))throw Error('--cli required');
mkdirSync('output/playwright',{recursive:true});
function command(...args){const r=spawnSync(process.execPath,[resolve(cli),'-s=lesson-word-paper',...args],{encoding:'utf8',timeout:120000,maxBuffer:4194304});if(r.status!==0||r.stdout.includes('### Error'))throw Error(r.stdout+r.stderr);return r.stdout;}
async function check(page,jwt){
 const assert=(v,label)=>{if(!v)throw Error(label);};
 const studentId='student_paper_fixture',authId='11111111-1111-4111-8111-111111111111';
 const auth={id:authId,aud:'authenticated',role:'authenticated',email:'paper-fixture@example.invalid',user_metadata:{user_data_id:studentId},app_metadata:{provider:'email'}};
 const session={access_token:jwt,token_type:'bearer',refresh_token:'fixture',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:auth};
 let data={displayName:'架空児童 ページ試験',campusId:'main',mouseLevel:7,keyboardSequence:200,coins:50,practiceLogs:[],loginStamps:[new Date().toISOString().slice(0,10)],examRecords:{romaji_daku_exam:1},wordProgress:{w_b1_1:{status:'working',page:'12'}},visionCleared:[]};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.context().route('https://*.supabase.co/**',async route=>{
  const req=route.request(),path=await page.evaluate(url=>new URL(url).pathname,req.url());let json;
  if(path==='/auth/v1/user')json=auth;
  else if(path==='/auth/v1/token')json=session;
  else if(path==='/rest/v1/lesson_user_access')json=[{auth_user_id:authId,user_data_id:studentId,role:'student',scope_type:'all',scope_value:''}];
  else if(path==='/rest/v1/user_data'){
   if(req.method()!=='GET'){const body=req.postDataJSON(),row=Array.isArray(body)?body[0]:body;if(row?.id===studentId)data=row.data;}
   json=req.headers().accept?.includes('vnd.pgrst.object')?{id:studentId,data}:[{id:studentId,data}];
  }else if(path==='/rest/v1/lesson_settings')json=null;
  else if(path==='/functions/v1/student-learning-tasks')json={schemaVersion:1,tasks:[]};
  else if(path==='/functions/v1/student-word-review')json={linked:true,requests:[]};
  else {await route.abort();return;}
  await route.fulfill({json});
 });
 await page.addInitScript(({session})=>sessionStorage.setItem('sb-lmonjfdxtefsvgtdixid-d-lesson-auth-token',JSON.stringify(session)),{session});
 await page.goto('http://127.0.0.1:5174/');
 await page.getByRole('button',{name:'スタート',exact:true}).waitFor();
 await page.evaluate(async studentId=>{const {login,users}=await import('/src/api/user.js');if(!users[studentId])throw Error('Fixture not loaded');login(studentId);},studentId);
 await page.locator('#screen-category.active').waitFor({timeout:10000}).catch(async()=>{throw Error(await page.locator('body').innerText());});
 const open=async()=>{await page.evaluate(async()=>{const {goToWordMenu}=await import('/src/games/word.js');goToWordMenu();});await page.locator('#word-menu-content .stage-btn').filter({hasText:'Word 1-1'}).click();};
 await page.setViewportSize({width:1280,height:900});await open();
 assert((await page.locator('#word-page-saved').textContent()).includes('12ページまで'),'previous book page');
 assert(await page.getByRole('heading',{name:'紙のテキスト',exact:true}).isVisible(),'paper textbook');
 assert(await page.locator('[onclick="openWordText()"]').count()===0,'no textbook PDF entry');
 await page.locator('#word-page-input').fill('18');await page.getByRole('button',{name:'ページをきろく',exact:true}).click();
 await page.getByText('18ページまで きろくしました！',{exact:true}).waitFor();
 assert(data.wordProgress.w_b1_1.page==='18','saved book page');assert(data.coins===50,'no automatic reward');
 await page.getByRole('button',{name:'OK',exact:true}).click();
 await page.locator('#word-menu-content .stage-btn').filter({hasText:'Word 1-1'}).click();
 assert((await page.locator('#word-page-saved').textContent()).includes('18ページまで'),'reopened saved page');
 await page.locator('.word-workspace').screenshot({path:'output/playwright/word-paper-desktop.png'});
 await page.locator('#word-page-input').fill('');await page.getByRole('button',{name:'ページをきろく',exact:true}).click();
 assert(await page.locator('#word-page-input').evaluate(e=>!e.validity.valid),'blank rejected');
 await page.locator('#word-page-input').fill('18');await page.getByRole('button',{name:'先生にみてもらう',exact:true}).click();
 await page.locator('#word-submission-dialog').waitFor();
 assert((await page.locator('#word-submission-dialog [data-stage]').textContent()).includes('18ページまで'),'submission page');
 assert((await page.locator('#word-submission-dialog input[type=file]').getAttribute('accept')).includes('application/pdf'),'work PDF upload retained');
 await page.locator('#word-submission-dialog').screenshot({path:'output/playwright/word-paper-submission.png'});
 await page.locator('#word-submission-dialog').getByRole('button',{name:'やめる',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
 assert(await page.evaluate(()=>{const actions=document.querySelector('.word-workspace-actions').getBoundingClientRect(),back=document.querySelector('#screen-word-game > .bottom-back-btn').getBoundingClientRect();return back.top>=actions.bottom;}),'mobile back button must not overlap page or approval actions');
 await page.locator('.word-workspace').screenshot({path:'output/playwright/word-paper-mobile.png'});
 assert(errors.length===0,errors.join('\n'));
 return {passed:true,realCloudAccess:false,cases:['paper book','page save','page reopen','blank rejection','no reward','work PDF submission retained','390px layout']};
}
const jwt='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:'11111111-1111-4111-8111-111111111111',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
try{command('open','about:blank');const output=command('run-code',`async(page)=>await (${check.toString()})(page,${JSON.stringify(jwt)})`);const match=output.match(/### Result\s+([\s\S]*?)\s+### Ran/);if(!match||!JSON.parse(match[1]).passed)throw Error(output);console.log(match[1]);}finally{command('close');}
