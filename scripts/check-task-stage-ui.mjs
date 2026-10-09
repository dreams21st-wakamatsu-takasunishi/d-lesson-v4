import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const args=process.argv.slice(2),cli=args[args.indexOf('--cli')+1];
const url=new URL(args.includes('--url')?args[args.indexOf('--url')+1]:'http://127.0.0.1:5174/');
if(!args.includes('--cli')||!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Local URL and --cli required');
mkdirSync('output/playwright',{recursive:true});
function command(...args){const result=spawnSync(process.execPath,[resolve(cli),'-s=lesson-task-stage',...args],{encoding:'utf8',timeout:120000,maxBuffer:4194304});if(result.status!==0||result.stdout.includes('### Error'))throw Error(result.stdout+result.stderr);return result.stdout;}
async function check(page,url){
 const assert=(condition,label)=>{if(!condition)throw Error(label);};
 const studentId='student_ui_task_stage',authId='11111111-1111-4111-8111-111111111111';
 const auth={id:authId,aud:'authenticated',role:'authenticated',email:'fictional-stage@example.com',user_metadata:{user_data_id:studentId},app_metadata:{provider:'email'}};
 const jwt='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:authId,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fictional';
 const session={access_token:jwt,token_type:'bearer',refresh_token:'fictional-only',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:auth};
 let data={displayName:'架空児童 ステージ試験',campusId:'main',birthdate:'2018-01-01',mouseLevel:7,keyboardSequence:200,alphabetSequence:12,
  coins:0,practiceLogs:[],loginStamps:[new Date().toISOString().slice(0,10)],examRecords:{romaji_daku_exam:1},wordProgress:{},visionCleared:[]};
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 const task=(id,category,stageId,title)=>({id:`22222222-2222-4222-8222-${String(id).padStart(12,'0')}`,revision:1,category,stageId,title,instructions:'試験用の課題',startsOn:today,endsOn:today,active:true,updatedAt:new Date().toISOString()});
 const tasks=[task(1,'mouse','1','課題 M-1'),task(2,'keyboard','4301','課題 ことば'),task(3,'vision','v1_easy','課題 ビジョン'),task(4,'word','w_b1_1','課題 Word'),task(5,'vision','v1_hard','課題 まだのステージ'),task(6,'text',undefined,'課題 分野全体')];
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.context().route('https://*.supabase.co/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  let json;
  if(path==='/auth/v1/user')json=auth;
  else if(path==='/auth/v1/token')json=session;
  else if(path==='/rest/v1/lesson_user_access')json=[{auth_user_id:authId,user_data_id:studentId,role:'student',scope_type:'all',scope_value:''}];
  else if(path==='/rest/v1/user_data'){
   if(request.method()!=='GET'){const body=request.postDataJSON(),row=Array.isArray(body)?body[0]:body;if(row?.id===studentId)data=row.data;}
   json=request.headers().accept?.includes('vnd.pgrst.object')?{id:studentId,data}:[{id:studentId,data}];
  }else if(path==='/rest/v1/lesson_settings')json=null;
  else if(path==='/functions/v1/student-learning-tasks')json={schemaVersion:1,tasks};
  else if(path==='/functions/v1/student-word-review')json={linked:true,requests:[]};
  else {await route.abort();return;}
  await route.fulfill({json});
 });
 await page.addInitScript(({session})=>sessionStorage.setItem('sb-lmonjfdxtefsvgtdixid-d-lesson-auth-token',JSON.stringify(session)),{session});
 await page.goto(url);
 await page.locator('#teacher-task-list li').first().waitFor();
 const openTask=async title=>{await page.locator('#teacher-task-list li').filter({has:page.getByText(title,{exact:true})}).getByRole('button',{name:'このれんしゅうへ'}).click();};
 const home=async()=>{await page.evaluate(async()=>{if(document.getElementById('screen-game').classList.contains('active')){const {backToMenu}=await import('/src/games/core.js');backToMenu(false);}const {showScreen}=await import('/src/ui/screen.js');showScreen('screen-category');const {refreshTeacherTasks}=await import('/src/ui/teacher-tasks.js');await refreshTeacherTasks(true);});};
 await page.setViewportSize({width:1280,height:900});
 await page.locator('#teacher-task-section').scrollIntoViewIfNeeded();
 await page.waitForTimeout(400);
 await page.locator('#teacher-task-section').screenshot({path:'output/playwright/teacher-stage-tasks-desktop.png'});
 await openTask('課題 M-1');assert(await page.locator('#screen-game').evaluate(e=>e.classList.contains('active')),'mouse goes to real game');
 await home();await openTask('課題 ことば');assert(await page.locator('#screen-game').evaluate(e=>e.classList.contains('active')),'word-input goes to real game');
 await page.keyboard.press('Space');
 assert(await page.locator('#keyboard-wrapper').evaluate(e=>e.classList.contains('blind-active')),'learned-hiragana word stage hides keyboard guide');
 await page.locator('#virtual-keyboard').waitFor({state:'hidden'});
 await page.screenshot({path:'output/playwright/teacher-stage-word-input.png',fullPage:true});
 await page.waitForTimeout(1100);
 await page.evaluate(async()=>{const {backToMenu}=await import('/src/games/core.js');backToMenu(true);});
 assert(await page.evaluate(async()=>{const {getPracticeLogs}=await import('/src/api/user.js');return getPracticeLogs().some(log=>log.category==='keyboard'&&log.stageId==='4301');}),'new and normalized logs retain exact stage id');
 await home();await openTask('課題 ビジョン');assert(await page.locator('#screen-game').evaluate(e=>e.classList.contains('active')),'vision goes to real game');
 await home();await openTask('課題 Word');assert(await page.locator('#screen-word-game').evaluate(e=>e.classList.contains('active')),'Word goes to real stage');
 assert((await page.locator('#word-stage-title').textContent()).includes('Word 1-1'),'Word exact stage');
 await home();await openTask('課題 まだのステージ');await page.getByText('このステージは、まだじゅんび中だよ。先生と、今できるれんしゅうをかくにんしてね。',{exact:true}).waitFor();
 assert(!await page.locator('#screen-game').evaluate(e=>e.classList.contains('active')),'locked hard stage not bypassed');
 await page.getByRole('button',{name:'OK',exact:true}).click();
 await home();await openTask('課題 分野全体');assert(await page.locator('#screen-text-menu').evaluate(e=>e.classList.contains('active')),'legacy category task');
 await home();await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
 await page.locator('#teacher-task-section').scrollIntoViewIfNeeded();
 await page.waitForTimeout(400);
 await page.locator('#teacher-task-section').evaluate(e=>e.scrollIntoView({block:'start'}));
 await page.screenshot({path:'output/playwright/teacher-stage-tasks-mobile.png'});
 assert(errors.length===0,errors.join('\n'));
 return {passed:true,cases:['real mouse game','real learned-hiragana word input','keyboard hidden','real vision game','real Word stage','locked stage retained','legacy category','mobile layout'],realCloudAccess:false};
}
try{command('open','about:blank');const output=command('run-code',`async (page)=>await (${check.toString()})(page,${JSON.stringify(url.href)})`);const result=output.match(/### Result\s+([\s\S]*?)\s+### Ran/);if(!result||JSON.parse(result[1]).passed!==true)throw Error(output);console.log(result[1]);}finally{command('close');}
