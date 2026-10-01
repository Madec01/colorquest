/* All six lessons through actual mobile controls. Accelerate only the ordinary
 * lesson clock; never set stage/success flags, territory, units or the winner. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const url = pathToFileURL(path.resolve(__dirname,'../index.html')).href;
const classicKeys=['colorquest.match.v1','colorquest.campaign.match.v1','colorquest.campaign.progress.v1'];
async function point(page,x,y){return page.evaluate(({x,y})=>{const b=document.getElementById('paintCanvas').getBoundingClientRect(),v=CQPaint.view;return{x:b.x+v.x+(x+.5)*v.cell,y:b.y+v.y+(y+.5)*v.cell};},{x,y});}
async function centre(locator){const b=await locator.boundingBox();assert(b);return{x:b.x+b.width/2,y:b.y+b.height/2};}
async function touchPath(page,points){
  const cdp=await page.context().newCDPSession(page);
  try{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});
    for(let j=1;j<points.length;j++)for(let i=1;i<=8;i++){
      const a=points[j-1],b=points[j];
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8,id:1}]});
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }finally{await cdp.detach();}
}
async function brush(page,path){await page.waitForTimeout(350);await page.locator('#paintBrush').tap();await touchPath(page,await Promise.all(path.map(p=>point(page,...p))));}
async function tapTile(page,x,y){const p=await point(page,x,y);await page.touchscreen.tap(p.x,p.y);}
async function card(page,id){const i=await page.evaluate(id=>CQPaint.game.hands[1].indexOf(id),id);assert(i>=0);return page.locator(`[data-paint-card="${i}"]`);}
async function tick(page,seconds){await page.evaluate(s=>{paintLessonTick(s);CQPaint.updateHUD(true);},seconds);}
async function status(page){return page.evaluate(()=>CQPaint.tutorial.presentation());}
async function next(page,expected){assert.equal((await status(page)).success,true);await page.locator('#paintTutorialNext').tap();assert.equal((await status(page)).step,expected);assert.equal((await status(page)).success,false);}
async function expectSuccess(page){assert.equal((await status(page)).success,true,JSON.stringify(await status(page)));assert.equal(await page.locator('#paintTutorialNext').isVisible(),true);}
async function classics(page){return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),classicKeys);}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    for(const viewport of [{width:360,height:640},{width:390,height:844}]){
      const page=await browser.newPage({viewport,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);await page.waitForFunction(()=>window.CQPaintTutorial&&window.CQPaint);
      const stored=await classics(page);
      const launch=await page.locator('#paintStart').boundingBox();assert(launch.y+launch.height<viewport.height,'guided entry is visible without scrolling');
      await page.locator('#paintStart').tap();
      await page.waitForFunction(()=>CQPaint.tutorial&&!CQPaint.paused);
      await page.evaluate(()=>{window.paintLessonTick=CQPaint.tutorial.update.bind(CQPaint.tutorial);CQPaint.tutorial.update=()=>{};});
      assert.equal((await status(page)).step,0);assert.match(await page.locator('#paintTutorialTitle').textContent(),/Peins jusqu.*source/i);
      assert.equal(await page.locator('#paintHand').isVisible(),false,'first objective hides all cards');
      assert.equal(await page.locator('#paintTutorialNext').isVisible(),false,'cannot skip objectives using Next');
      assert.equal(await page.evaluate(()=>document.getElementById('paintGame').scrollWidth>innerWidth),false);
      const before=await page.evaluate(()=>CQPaint.game.pigment[1]);
      await brush(page,[[8,20],[8,19]]);assert.equal((await status(page)).success,false,'wrong start stays a recoverable error');
      assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),before);
      const invalidStart=await page.locator('#paintToast').textContent();
      await brush(page,[[9,22],[9,18]]);await expectSuccess(page);
      assert(await page.locator('#paintToast').isHidden()||await page.locator('#paintToast').textContent()!==invalidStart,'successful recovery clears the previous error toast');
      assert.equal(await page.evaluate(()=>CQPaint.game.tile(9,18).owner===1&&CQPaint.game.tile(9,18).connected),true);
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.some(b=>b.type==='extractor')),false,'connecting a source does not invent extraction');
      assert.match(await page.locator('#paintTutorialNotice').textContent(),/Source reliée/i);
      const successTime=await page.evaluate(()=>CQPaint.game.time);await tick(page,3);assert.equal(await page.evaluate(()=>CQPaint.game.time),successTime,'success freezes before Continue');
      await page.screenshot({path:`/tmp/colorquest-v071-tutorial-source-${viewport.width}.png`});

      await next(page,1);assert.equal(await page.locator('[data-paint-card]:visible').count(),1);
      assert.match(await page.locator('[data-paint-card]:visible').textContent(),/Extracteur/);
      const initialIncome=await page.evaluate(()=>CQPaint.game.income[1]),extractor=await card(page,'extractor');
      await touchPath(page,[await centre(extractor),await point(page,9,23)]);
      assert.equal((await status(page)).success,false,'off-source placement is refused');
      assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),65);
      await tapTile(page,9,18);await expectSuccess(page);
      assert(await page.evaluate(()=>CQPaint.game.income[1])>=initialIncome+.85);
      assert.match(await page.locator('#paintTutorialNotice').textContent(),/exploitée|0,85/i);

      await next(page,2);assert.match(await page.locator('#paintTutorialTitle').textContent(),/caserne/i);
      await(await card(page,'barracks')).tap();await tapTile(page,9,20);
      assert.equal((await status(page)).phase,'spawn');assert.equal(await page.evaluate(()=>CQPaint.game.getUnitCount(1)),0);
      await tick(page,5.1);assert.equal((await status(page)).paidSpawnSeen,true);
      assert.equal(await page.evaluate(()=>CQPaint.game.events.some(e=>e.type==='spawn'&&e.team===1&&e.cost===6)),true,'lesson observes a real paid spawn');
      await touchPath(page,[await point(page,9,20),await point(page,9,15)]);
      assert.equal((await status(page)).flowIssued,true);
      for(let i=0;i<60&&!(await status(page)).success;i++)await tick(page,1);
      await expectSuccess(page);
      assert.equal(await page.evaluate(()=>CQPaint.game.tile(9,15).owner),1,'the army really captured the enemy post');
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.some(b=>b.team===2&&b.x===9&&b.y===15)),false);

      await next(page,3);await tick(page,1);
      assert.equal((await status(page)).cutSeen,true,'real enemy occupation cuts the network');
      assert.equal(await page.evaluate(()=>CQPaint.game.tile(9,20).owner),2);
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.find(b=>b.id===CQPaint.tutorial.barracksId).connected),false);
      await brush(page,[[9,21],[8,21],[8,20],[8,19],[9,19]]);await expectSuccess(page);
      assert.equal(await page.evaluate(()=>CQPaint.game.tile(9,20).owner),2,'reconnection uses neutral detour, never enemy repaint');
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.find(b=>b.id===CQPaint.tutorial.barracksId).connected),true);
      assert.doesNotMatch(await page.locator('#paintTutorialNotice').textContent(),/dispara|perte dans/);
      await page.screenshot({path:`/tmp/colorquest-v071-tutorial-reconnected-${viewport.width}.png`});

      await next(page,4);
      const home=await point(page,9,18);await touchPath(page,[home,await point(page,10,19),home]);
      assert.equal((await status(page)).recallIssued,true,'drag out/back produces actual recall');
      assert.equal(await page.evaluate(()=>CQPaint.game.units.filter(u=>CQPaint.tutorial.returningIds.includes(u.id)).every(u=>u.retreating)),true);
      for(let i=0;i<60&&!(await status(page)).success&&!(await status(page)).failed;i++)await tick(page,1);
      await expectSuccess(page);assert.equal((await status(page)).returnedSeen,true);
      assert.equal(await page.evaluate(()=>CQPaint.game.units.some(u=>CQPaint.tutorial.waveIds.includes(u.id))),false,'wave is defeated by returning defenders');

      await next(page,5);assert.equal(await page.evaluate(()=>CQPaint.game.scores[1]>.5),false);
      assert.match(await page.locator('#paintPlayerShare').textContent(),/49,7\s*%/,'near-threshold score does not round into a false 50%');
      await brush(page,[[9,13],[8,13],[7,13]]);assert.equal(await page.evaluate(()=>CQPaint.game.scores[1]>.5),true);
      assert.match(await page.locator('#paintPlayerShare').textContent(),/50,1\s*%/,'strict domination visibly exceeds 50%');
      assert.equal(await page.evaluate(()=>document.getElementById('paintGame').scrollWidth>innerWidth),false,'decimal domination labels fit the portrait');
      await tick(page,14);assert.equal((await status(page)).success,false,'objective waits for actual 15-second domination');
      assert.match(await page.locator('#paintHold').textContent(),/victoire dans/i);
      await tick(page,1.1);await expectSuccess(page);assert.equal(await page.evaluate(()=>CQPaint.game.winner),1);
      assert.equal(await page.locator('#paintAgain').count(),0,'tutorial final win has its own continuation, not free-match result');
      await page.screenshot({path:`/tmp/colorquest-v071-tutorial-complete-${viewport.width}.png`});
      await page.locator('#paintTutorialNext').tap();
      assert.equal(await page.evaluate(()=>CQPaint.tutorial),null);assert.equal(await page.evaluate(()=>CQPaint.paused),false);
      assert.equal(await page.evaluate(()=>CQPaint.game.duration),240);assert.equal(await page.locator('[data-paint-card]:visible').count(),4);
      assert.deepEqual(await classics(page),stored,'all six lessons leave classic saves/progression untouched');assert.deepEqual(errors,[]);
      console.log('PASS six actual mobile lessons: source connection/extraction, paid producer, enemy capture, neutral reconnection, true retreat/defense, timed domination and free-combat continuation',viewport.width+'x'+viewport.height);
      await page.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
