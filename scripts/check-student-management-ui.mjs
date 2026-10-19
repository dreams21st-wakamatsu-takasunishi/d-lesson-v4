import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const args=process.argv.slice(2),cli=args[args.indexOf('--cli')+1];
if(!args.includes('--cli'))throw Error('--cli required');
mkdirSync('output/playwright',{recursive:true});
writeFileSync('output/student-management.html',readFileSync('index.html','utf8').replace(/<script type="module" src="[^"]*main.js"><\/script>/,'<script type="module" src="/tests/fixtures/student-management.js"></script>'));
function command(...args){const r=spawnSync(process.execPath,[resolve(cli),'-s=student-management',...args],{encoding:'utf8',timeout:120000,maxBuffer:4194304});if(r.status!==0||r.stdout.includes('### Error'))throw Error(r.stdout+r.stderr);return r.stdout;}
async function check(page){
 const assert=(ok,label)=>{if(!ok)throw Error(label);}; const errors=[]; const patches=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.context().route('https://*.supabase.co/**',r=>r.abort());
 await page.context().route('**/rest/v1/lesson_user_access?*',r=>r.fulfill({json:[{auth_user_id:'11111111-1111-4111-8111-111111111111',user_data_id:'__admin__',role:'admin',scope_type:'all',scope_value:''}]}));
 await page.context().route('**/rest/v1/rpc/get_lesson_student_management_status',r=>r.fulfill({json:[{id:'student_classroom',loginReady:true,supportLinked:false},{id:'student_legacy',loginReady:false,supportLinked:true}]}));
 await page.context().route('**/rest/v1/rpc/patch_lesson_student',async r=>{
   const body=r.request().postDataJSON(); patches.push(body);
   const data=await page.evaluate(({id,patch})=>({...window.__managementFixture.api.users[id],...patch}),{id:body.p_student,patch:body.p_patch});
   await r.fulfill({json:data});
 });
 await page.goto('http://127.0.0.1:5178/output/student-management.html');
 await page.locator('body[data-fixture-ready="true"]').waitFor();
 assert(await page.locator('#admin-registration-campus').textContent()==='登録先：架空の運用校','single registry selection');
 assert(await page.locator('#admin-add-campus option').count()===1,'legacy campus excluded from new registration');
 assert(await page.locator('#admin-add-login-number').inputValue()==='2','next free number');
 assert(await page.locator('#current-campus-badge').textContent()==='管理校舎：架空の運用校','context badge');
 assert(await page.getByText('古い設定名',{exact:true}).count()===0,'authoritative registry');
 await page.locator('#admin-user-search').fill('あおい'); await page.locator('#admin-user-search').dispatchEvent('input');
 const row=page.locator('#admin-user-tbody tr').first();
 assert((await row.textContent()).includes('ログイン設定確認済み'),'account state');
 assert((await row.textContent()).includes('未連携'),'sharing state independent from membership');
 const name=row.locator('input[type=text]').first();await name.fill('架空児童 更新');await name.dispatchEvent('change');
 await page.waitForFunction(()=>window.__managementFixture.api.users.student_classroom.displayName==='架空児童 更新');
 assert(Object.keys(patches[0].p_patch).join(',')==='displayName','field-only write');
 assert(!('coins' in patches[0].p_patch),'no learning payload');
 assert(await page.evaluate(()=>window.__managementFixture.api.users.student_classroom.coins)===9,'progress preserved');
 await page.locator('#admin-user-search').fill('');await page.locator('#admin-user-search').dispatchEvent('input');
 await page.getByLabel('架空児童 更新の利用状態').selectOption('paused');
 await page.waitForFunction(()=>window.__managementFixture.api.users.student_classroom.studentState==='paused');
 await page.locator('#admin-add-name').fill('<img src=x onerror=alert(1)>');
 await page.locator('#admin-add-birth').fill('2016-02-01');
 await page.getByRole('button',{name:'登録内容を確認',exact:true}).click();
 await page.locator('#custom-confirm-overlay').waitFor({state:'visible'});
 assert(await page.locator('#custom-confirm-overlay img').count()===0,'registration preview escaped');
 await page.getByRole('button',{name:'いいえ',exact:true}).click();
 assert(await page.evaluate(()=>Object.keys(window.__managementFixture.api.users).length)===3,'cancel leaves no new learner');
 await page.locator('#admin-add-name').fill('');
 await page.locator('#admin-add-name').blur();await page.evaluate(()=>{document.getElementById('game-container').scrollTop=0;document.getElementById('admin-panel-content').scrollTop=0;document.querySelector('#screen-admin > .screen-content').scrollTop=0;});
 await page.setViewportSize({width:1366,height:900});await page.screenshot({path:'output/playwright/student-management-laptop.png',fullPage:true});
 await page.setViewportSize({width:768,height:1024});await page.screenshot({path:'output/playwright/student-management-tablet.png',fullPage:true});
 assert(errors.length===0,errors.join('\n'));
 return {passed:true,fictional:true,patches:patches.length,cancelSafe:true,registry:true};
}
try{command('open','about:blank');console.log(command('run-code',`async page => (${check.toString()})(page)`));}finally{command('close');}
