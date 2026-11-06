import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const args=process.argv.slice(2),cli=args[args.indexOf('--cli')+1];
if(!args.includes('--cli'))throw Error('--cli required');mkdirSync('output/playwright',{recursive:true});
function command(...args){const r=spawnSync(process.execPath,[resolve(cli),'-s=one-hand-challenge',...args],{encoding:'utf8',timeout:180000,maxBuffer:4000000});if(r.status||r.stdout.includes('### Error'))throw Error(r.stdout+r.stderr);return r.stdout;}
async function check(page){
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.context().route('https://*.supabase.co/**',async route=>{requests.push(route.request().url());await route.abort();});
 await page.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(utterance){queueMicrotask(()=>utterance.onend?.());}}}));
 await page.goto('http://127.0.0.1:5174/');await page.locator('#guest-login-button').click();await page.locator('#stamp-overlay button').click();
 await page.locator('#screen-category.active').waitFor();await page.setViewportSize({width:1366,height:900});
 const api=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).find(name=>name.includes('/src/api/user.js')));
 const core=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).find(name=>name.includes('/src/games/core.js')));
 const read=()=>page.evaluate(async url=>{const api=await import(url);return JSON.parse(JSON.stringify(api.users[api.currentUser]));},api);
 const roman=async hand=>page.evaluate(async hand=>{const {createRomajiInputMatcher}=await import('/src/utils/romaji-input.js');const {getHandKeys}=await import('/src/data/one-hand.js');return createRomajiInputMatcher(document.getElementById('main-q').textContent,[],{allowedKeys:getHandKeys(hand)}).getSuggestion();},hand);
 await page.evaluate(()=>window.openOneHandMenu('left'));
 assert(await page.locator('#one-hand-stages button').nth(4).isDisabled(),'challenge starts locked');
 await page.evaluate(async url=>(await import(url)).startGame('hand_left_5','keyboard'),core);
 await page.locator('#custom-alert-overlay').waitFor({state:'visible'});await page.locator('#btn-custom-ok').click();
 await page.locator('#one-hand-stages button').nth(3).click();await page.keyboard.press('Space');
 for(let i=0;i<12;i++){await page.keyboard.type(await roman('left'));await page.waitForTimeout(550);}
 await page.locator('#feedback-overlay').waitFor({state:'visible'});
 assert((await read()).oneHandProgress.hand_left_4.clears===1,'test clear saved');
 await page.locator('.feedback-next-button').click();
 await page.clock.install();await page.keyboard.press('Space');await page.waitForTimeout(30);
 assert((await page.locator('#timer-display').textContent()).includes('90'),'90 second countdown');
 assert(!await page.locator('#virtual-keyboard').isVisible()&&!(await page.locator('#romaji-hint').textContent()),'no keyboard or answer hint');
 const before=await read();let correct=0;
 const first=await roman('left');await page.keyboard.type(first[0]);await page.keyboard.press('Backspace');await page.keyboard.type(first[0]);
 await page.keyboard.type('jjjjjjj');await page.keyboard.down('j');await page.keyboard.down('j');await page.keyboard.up('j');await page.keyboard.type('"');
 const misses=9;assert((await page.locator('#mistake-counter').textContent()).includes(String(misses)),'no miss cap and held key ignored');
 await page.keyboard.type(first.slice(1));correct+=first.length;await page.clock.fastForward(20);
 for(let i=0;i<5;i++){const answer=await roman('left');await page.keyboard.type(answer);correct+=answer.length;await page.clock.fastForward(20);}
 assert(!await page.locator('#feedback-overlay').isVisible(),'does not end after a few words');
 await page.clock.fastForward(88000);assert(!await page.locator('#feedback-overlay').isVisible(),'no early finish');
 await page.clock.fastForward(2100);await page.locator('#feedback-overlay').waitFor({state:'visible'});await page.waitForTimeout(50);
 const completed=await read(),record=completed.oneHandChallenges.left;
 assert(record.attempts===1&&record.last.correctChars===correct&&record.last.misses===misses&&record.last.score===Math.max(0,correct-misses),'net input and mistakes determine score');
 assert(!completed.oneHandChallenges.right&&completed.keyboardSequence===before.keyboardSequence,'hand and old progress isolated');
 assert(completed.coins===before.coins,'score stage does not change coins');
 await page.keyboard.type('aaaa');await page.evaluate(async url=>(await import(url)).markClear(),core);
 assert((await read()).oneHandChallenges.left.attempts===1,'no late input or duplicate result');
 await page.clock.resume();await page.waitForTimeout(400);await page.screenshot({path:'output/playwright/one-hand-score-desktop.png'});
 await page.locator('.feedback-next-button').click();await page.keyboard.press('Space');await page.clock.fastForward(90100);
 await page.locator('#feedback-overlay').waitFor({state:'visible'});await page.waitForTimeout(50);
 const again=await read();assert(again.oneHandChallenges.left.attempts===2&&again.oneHandChallenges.left.last.score===0&&again.oneHandChallenges.left.best.score===record.best.score,'lower result preserves high score');
 await page.locator('.feedback-menu-button').click();assert((await page.locator('#one-hand-stages button').nth(4).textContent()).includes(`さいこう ${record.best.score}`),'menu shows high score');
 await page.locator('#one-hand-stages button').nth(4).click();await page.keyboard.press('Space');await page.keyboard.type((await roman('left'))[0]);
 await page.evaluate(()=>window.backToMenu());await page.clock.fastForward(90100);
 assert((await read()).oneHandChallenges.left.attempts===2,'aborted run is not a completed attempt');
 await page.evaluate(()=>window.openOneHandMenu('right'));assert(await page.locator('#one-hand-stages button').nth(4).isDisabled(),'left clear does not unlock right');
 await page.locator('#one-hand-stages button').nth(3).click();await page.keyboard.press('Space');
 for(let i=0;i<12;i++){await page.keyboard.type(await roman('right'));await page.clock.fastForward(600);}
 await page.locator('#feedback-overlay').waitFor({state:'visible'});await page.locator('.feedback-next-button').click();await page.keyboard.press('Space');
 const rightInput=await roman('right');await page.keyboard.type(rightInput);await page.clock.fastForward(20);
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{document.getElementById('main-q').textContent='ひこうきのむこう';document.getElementById('blind-romaji-progress').textContent='HIKOUKINOMUKOU';});
 assert(await page.locator('#main-q').evaluate(e=>e.scrollWidth<=e.clientWidth),'long phrase fits mobile');
 assert(await page.locator('#blind-romaji-progress').evaluate(e=>e.getBoundingClientRect().right<=innerWidth),'typed romaji fits mobile');
 await page.clock.resume();await page.waitForTimeout(300);await page.screenshot({path:'output/playwright/one-hand-long-phrase-mobile.png'});
 await page.clock.fastForward(90100);await page.locator('#feedback-overlay').waitFor({state:'visible'});await page.waitForTimeout(100);
 const final=await read();assert(final.oneHandChallenges.right.best.correctChars===rightInput.length&&final.oneHandChallenges.left.best.score===record.best.score,'right high score stored independently');
 await page.screenshot({path:'output/playwright/one-hand-score-mobile.png'});
 await page.locator('.feedback-next-button').click();await page.keyboard.press('Space');
 const owner=await page.evaluate(async url=>{const api=await import(url);const owner=api.currentUser;api.setCurrentUser(null);return owner;},api);
 await page.clock.fastForward(90100);
 const preserved=await page.evaluate(async({url,owner})=>{const api=await import(url);api.setCurrentUser(owner);return api.users[owner].oneHandChallenges.right.attempts;},{url:api,owner});
 assert(preserved===1,'user switch prevents stale score save');await page.evaluate(()=>window.backToMenu());
 assert(errors.length===0,errors.join('\n'));assert(requests.length===0,'guest test never accesses cloud');
 return {passed:true,realData:false,cases:['unlock after test','100 left/100 right validated separately','90 second deadline','correct minus misses','backspace cannot inflate score','repeat keys ignored','no miss cap','best and last result','hand isolation','abandon and user-switch protection','desktop/mobile']};
}
try{command('open','about:blank');command('snapshot');const output=command('run-code',`async page=>{try{return await (${check.toString()})(page);}catch(error){await page.screenshot({path:'output/playwright/one-hand-score-failure.png'});throw error;}}`);const match=output.match(/### Result\s+([\s\S]*?)\s+### Ran/);if(!match||!JSON.parse(match[1]).passed)throw Error(output);console.log(match[1]);}finally{command('close');}
