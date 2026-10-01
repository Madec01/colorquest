/* V0.8 course integration. All brush, card, flow, target and menu commands use
 * actual touch input. Terminal fixtures are explicitly isolated below: they
 * test transition/save UI, not whether a human can win a complete course. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const courseKey = 'colorquest.paint.course.v1';
const classicKeys = ['colorquest.match.v1', 'colorquest.campaign.match.v1', 'colorquest.campaign.progress.v1'];
let release = 1;
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.ogg':'audio/ogg', '.webmanifest':'application/manifest+json'};
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/colorquest/')) {response.writeHead(404).end(); return;}
  const relative = decodeURIComponent(pathname.slice('/colorquest/'.length)) || 'index.html';
  if (relative.includes('..')) {response.writeHead(404).end(); return;}
  const file = path.join(root, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {response.writeHead(404).end(); return;}
  let body=fs.readFileSync(file);
  if(relative==='sw.js')body=Buffer.from(body.toString().replace(/COLORQUEST_V\d+_[^']+/, 'COLORQUEST_V08_COURSE_QA_'+release));
  if(relative==='index.html')body=Buffer.from(body.toString().replace('</head>', '<meta name="course-test-release" content="'+release+'"></head>'));
  response.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}).end(body);
});
async function point(page, x, y) {
  return page.evaluate(({x,y}) => {
    const r = document.getElementById('paintCanvas').getBoundingClientRect(), v = CQPaint.view;
    return {x:r.x + v.x + (x + .5) * v.cell, y:r.y + v.y + (y + .5) * v.cell};
  }, {x,y});
}
async function centre(locator) {const b = await locator.boundingBox(); assert(b, 'touch target must be visible'); return {x:b.x + b.width/2, y:b.y + b.height/2};}
async function touchPath(page, points, beforeRelease) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{...points[0], id:1}]});
    for (let j = 1; j < points.length; j++) for (let i = 1; i <= 8; i++) {
      const a = points[j-1], b = points[j];
      await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:a.x + (b.x-a.x)*i/8, y:a.y + (b.y-a.y)*i/8, id:1}]});
    }
    if (beforeRelease) await beforeRelease();
    await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  } finally {await cdp.detach();}
}
async function stroke(page, cells) {
  await page.waitForTimeout(350);
  await page.locator('#paintBrush').tap();
  await touchPath(page, await Promise.all(cells.map(p => point(page, ...p))));
}
async function tapTile(page,x,y) {const p=await point(page,x,y); await page.touchscreen.tap(p.x,p.y);}
async function card(page,id) {
  const index=await page.evaluate(id=>CQPaint.game.hands[1].indexOf(id),id);
  assert(index>=0,id+' must be in the actual hand'); return page.locator(`[data-paint-card="${index}"]`);
}
async function playCard(page,id,x,y) {await touchPath(page,[await centre(await card(page,id)),await point(page,x,y)]);}
async function freeze(page) {
  await page.evaluate(()=>{
    window.courseQATick=CQPaint.course.update.bind(CQPaint.course);
    CQPaint.course.update=()=>{};
  });
}
async function tick(page,seconds) {
  await page.evaluate(seconds=>{
    for(let i=0;i<Math.ceil(seconds*30)&&CQPaint.course.phase==='combat';i++) courseQATick(Math.min(1/30,seconds-i/30));
    CQPaint.updateHUD(true);
  },seconds);
}
async function stored(page,key=courseKey) {return page.evaluate(key=>localStorage.getItem(key),key);}
async function classics(page) {return page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),classicKeys);}
async function makeClassicCheckpoints(page) {
  await page.locator('#play').tap();
  await page.evaluate(()=>{
    game.recruit(1,'fighter'); for(let i=0;i<17;i++) game.update(.1);
    if(!paused) togglePause(); CQCamera.focus(16,33,2.2);
    if(!CQSave.save().ok) throw Error('Cannot create authentic classic checkpoint'); returnToMenu();
  });
  await page.locator('#campaignOpen').tap(); await page.locator('[data-campaign-mission="first-ink"]').tap();
  await page.evaluate(()=>{
    const t=game.tiles.find(t=>game.canBuild(1,'relay',t.x,t.y).ok);
    if(!t||!game.build(1,'relay',t.x,t.y).ok) throw Error('Cannot develop classic campaign fixture');
    for(let i=0;i<17;i++)game.update(.1); if(!paused)togglePause();
    if(!CQSave.save().ok)throw Error('Cannot save classic campaign');returnToMenu();
    localStorage.setItem('colorquest.campaign.progress.v1',JSON.stringify({format:'colorquest-campaign-progress',version:1,completed:['first-ink','source']}));CQCampaign.refreshMenu();
  });
  return classics(page);
}
async function assertNoOverflow(page) {assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'portrait has no horizontal overflow');}
async function terminalFixture(page,winner) {
  // Isolated transition fixture. Remove a core, or create exact-time equality,
  // then invoke real victory and course settlement logic; do not count as play.
  await page.evaluate(winner=>{
    const g=CQPaint.game;
    if(winner===0){
      g.buildings=g.buildings.filter(b=>b.type==='core');g.units=[];
      for(const t of g.tiles)t.owner=0;
      for(const b of g.buildings)g.tile(b.x,b.y).owner=b.team;
      g.overtime=true;g.time=g.duration+g.overtimeDuration;g.accelerated=true;g.hold=[0,0,0];g._holdActive=[false,false,false];
    }else {const core=g.getCore(winner===1?2:1);g._damage(core,core.maxHp);}
    g._removeDead();g.recompute();g._checkVictory(0);courseQATick(0);CQPaint.updateHUD(true);
  },winner);
  await page.waitForFunction(()=>CQPaint.course.phase!=='combat');
  await page.waitForSelector('.paint-course-result strong');
  assert.equal(await page.locator('.paint-course-result strong').innerText(),await page.evaluate(()=>CQPaint.game.winReason),'the result explains the actual reason for victory, defeat or draw');
}

// Main scenarios are appended after controller integration so their assertions
// follow the documented course API rather than guessing implementation details.
async function runPortrait(page, viewport) {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>window.CQPaintCourse&&window.CQPaint);
  const classic=await makeClassicCheckpoints(page);
  await page.locator('#paintCourseStart').tap();
  await page.waitForSelector('#paintCourseFight');
  assert.equal(await page.evaluate(()=>CQPaint.course.phase),'briefing');
  assert.equal(await page.evaluate(()=>CQPaint.course.encounterIndex),0);
  assert.match(await page.locator('#paintDialogContent').innerText(),/1\s*\/\s*3|1 sur 3|Élan|Vif/i);
  await assertNoOverflow(page);
  await page.screenshot({path:`/tmp/colorquest-v08-briefing-${viewport.width}.png`});
  await page.locator('#paintCourseFight').tap();
  await page.waitForFunction(()=>CQPaint.course.phase==='combat'&&!CQPaint.paused);
  await freeze(page);
  const initial=await page.evaluate(()=>({pigment:CQPaint.game.pigment[1],hand:CQPaint.game.hands[1].slice()}));
  assert.equal(await page.locator('[data-paint-card]').count(),4);
  assert.equal(initial.hand.includes('mortar'),false,'new content is introduced progressively');
  await stroke(page,[[9,20],[9,18]]);
  assert.equal(await page.evaluate(()=>CQPaint.game.tile(9,18).owner),1,'course brush really paints');
  assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),initial.pigment-2,'real stroke is paid once');
  await playCard(page,'barracks',9,20);
  const producer=await page.evaluate(()=>CQPaint.game.buildings.find(b=>b.team===1&&b.type==='barracks'));
  assert(producer,'real card creates a producer');
  assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),initial.pigment-2-32);
  await tick(page,5.1);
  assert.equal(await page.evaluate(()=>CQPaint.game.getUnitCount(1)),1,'paid course production is active');
  assert.equal(await page.evaluate(()=>CQPaint.game.events.some(e=>e.type==='spawn'&&e.team===1&&e.cost===6)),true);
  await touchPath(page,[await point(page,9,20),await point(page,9,16)]);
  await tick(page,.4);
  assert.deepEqual(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).flow,producer.id),{x:9,y:16});
  assert(await page.evaluate(()=>CQPaint.game.units.some(u=>u.team===1&&u.path.length>0)),'an actual moving unit has a path to preserve');
  await page.locator('#paintZoomIn').tap();
  await page.locator('#paintPause').tap();
  assert.equal(await page.evaluate(()=>CQPaint.paused),true);
  assert.match(await page.locator('#paintSessionNotice').innerText(),/sauvegard/i);
  await page.evaluate(()=>CQPaint.flushSave());
  const beforeReload=await page.evaluate(()=>CQPaintCourse.snapshot(CQPaint.course));
  const savedRaw=await stored(page);assert(savedRaw);
  assert.deepEqual(await classics(page),classic,'course and classic slots are independent');
  await page.reload();await page.waitForFunction(()=>window.CQPaintCourse&&window.CQPaint);
  assert.match(await page.locator('#paintCourseStart').textContent(),/Reprendre/i);
  await page.locator('#paintCourseStart').tap();
  assert.equal(await page.evaluate(()=>CQPaint.paused),true,'a reloaded combat opens paused');
  const afterReload=await page.evaluate(()=>CQPaintCourse.snapshot(CQPaint.course));
  assert.deepEqual(afterReload.game,beforeReload.game,'time/economy/fog/orders/paths/cooldowns survive reload exactly');
  assert.deepEqual(afterReload.ai,beforeReload.ai,'opponent decision memory survives reload');
  assert.deepEqual(afterReload.view,beforeReload.view,'camera and inspected producer survive reload');
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>CQPaint.game.time),beforeReload.game.time,'no offline catch-up while restored pause is visible');
  await page.locator('#paintContinue').tap();await freeze(page);
  await tick(page,.2);
  assert(await page.evaluate(t=>CQPaint.game.time-t<.3,beforeReload.game.time),'resuming continues only from the saved clock');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>CQPaint.paused),true);
  const backgroundTime=await page.evaluate(()=>CQPaint.game.time);
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>CQPaint.game.time),backgroundTime);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>CQPaint.paused),true);
  await page.locator('#paintContinue').tap();

  // Test the next screen using an explicitly artificial terminal combat state.
  await terminalFixture(page,1);
  await page.waitForSelector('[data-course-reward]');
  assert.equal(await page.locator('[data-course-reward]').count(),3,'exactly three reward choices');
  const offers=await page.evaluate(()=>CQPaint.course.offers);
  assert.equal(new Set(offers.map(o=>o.id)).size,3);
  await page.screenshot({path:`/tmp/colorquest-v08-rewards-${viewport.width}.png`});
  const rewardSaved=await page.evaluate(()=>{const r=CQPaint.flushSave();try{CQPaintCourse.snapshot(CQPaint.course);}catch(e){return{...r,detail:e.message};}return r;});
  assert.equal(rewardSaved.ok,true,JSON.stringify(rewardSaved));
  assert.equal(JSON.parse(await stored(page)).phase,'reward');
  await page.reload();await page.waitForFunction(()=>window.CQPaint);
  await page.locator('#paintCourseStart').tap();
  assert.deepEqual(await page.evaluate(()=>CQPaint.course.offers),offers,'reload never rerolls the three choices');
  const chosenId=await page.locator('[data-course-reward]').first().getAttribute('data-course-reward');
  await page.locator('[data-course-reward]').first().tap();
  await page.waitForSelector('#paintCourseFight');
  assert.equal(await page.evaluate(()=>CQPaint.course.encounterIndex),1);
  assert.equal(await page.evaluate(id=>CQPaint.course.chosenRewards.filter(x=>x===id).length,chosenId),1,'one choice grants one reward');
  assert.equal(await page.evaluate(()=>CQPaint.course.chosenRewards.length),1);
  assert.equal(await page.evaluate(id=>CQPaint.course.chooseReward(id).ok===true,chosenId),false,'stale reward activation is rejected by the course itself');
  await page.locator('#paintCourseFight').tap();await freeze(page);
  assert.equal(await page.evaluate(()=>CQPaint.course.encounterIndex),1);
  await assertNoOverflow(page);
  await page.screenshot({path:`/tmp/colorquest-v08-combat2-${viewport.width}.png`});
  await realMortar(page,viewport);

  await terminalFixture(page,1);await page.waitForSelector('[data-course-reward]');
  assert.equal(await page.locator('[data-course-reward]').count(),3);
  await page.locator('[data-course-reward]').first().tap();await page.locator('#paintCourseFight').tap();await freeze(page);
  assert.equal(await page.evaluate(()=>CQPaint.course.encounterIndex),2);
  assert.equal(await page.evaluate(()=>CQPaint.course.chosenRewards.length),2);
  await terminalFixture(page,0);await page.waitForSelector('#paintCourseRetry');
  const rewards=await page.evaluate(()=>CQPaint.course.chosenRewards.slice());
  await page.locator('#paintCourseRetry').tap();await freeze(page);
  assert.equal(await page.evaluate(()=>CQPaint.course.encounterIndex),2,'draw retries only this encounter');
  assert.deepEqual(await page.evaluate(()=>CQPaint.course.chosenRewards),rewards,'a draw grants no extra rewards');
  assert.equal(await page.evaluate(()=>CQPaint.game.winner),null);
  await terminalFixture(page,1);await page.waitForSelector('#paintCourseAgain');
  assert.equal(await page.evaluate(()=>CQPaint.course.phase),'won');
  assert.equal(await page.locator('[data-course-reward]').count(),0,'the final victory is not a fourth encounter');
  await page.screenshot({path:`/tmp/colorquest-v08-complete-${viewport.width}.png`});
  await page.evaluate(()=>CQPaint.flushSave());await page.reload();await page.waitForFunction(()=>window.CQPaint);
  await page.locator('#paintCourseStart').tap();
  assert.equal(await page.evaluate(()=>CQPaint.course.phase),'won','completion survives reload');
  await page.locator('#paintCourseAgain').tap();
  if(await page.locator('#paintCourseConfirmNew').isVisible())await page.locator('#paintCourseConfirmNew').tap();
  await page.locator('#paintCourseFight').tap();await freeze(page);
  await terminalFixture(page,2);await page.waitForSelector('#paintCourseAgain');
  assert.equal(await page.evaluate(()=>CQPaint.course.phase),'lost');
  assert.deepEqual(await classics(page),classic,'combat/reward/retry/victory/loss never alter classic saves');
  assert.deepEqual(errors,[]);
  console.log(`PASS V0.8 touch ${viewport.width}x${viewport.height}: real painting/card/production/flow, exact paused reload, lifecycle, then isolated terminal fixtures for 3 encounters/reward persistence/draw/completion/loss.`);
}
async function realMortar(page,viewport) {
  assert.equal(await page.evaluate(()=>CQPaint.game.decks[1].includes('mortar')),true,'chosen mortar enters the real eight-card deck');
  assert.match(await page.locator('#paintMixtureHint').textContent(),/bleu|jaune|soin/i);
  // Four legal paid card plays draw the new reward; no replacement hand or
  // pigment fixture is used. Advance only ordinary simulation time for income.
  await playCard(page,'splash',9,20);
  await playCard(page,'bastion',8,21);
  await tick(page,7);
  await playCard(page,'wave',9,20);
  await playCard(page,'bleach',9,20);
  assert.equal(await page.evaluate(()=>CQPaint.game.events.some(e=>e.type==='mixture'&&e.team===1&&e.mixture==='green')),true,'actual adjacent blue/yellow cards create their unlocked mixture');
  await tick(page,25);
  assert.equal(await page.evaluate(()=>CQPaint.game.winner),null);
  const money=await page.evaluate(()=>CQPaint.game.pigment[1]);assert(money>=40);
  await playCard(page,'mortar',9,20);
  const mortar=await page.evaluate(()=>CQPaint.game.buildings.find(b=>b.team===1&&b.type==='mortar'));assert(mortar);
  assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),money-40);
  await tapTile(page,9,20);assert.equal(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).mortarTarget,mortar.id),null,'tap inspects and never begins bombardment');
  await page.locator('#paintMortarTarget').tap();await tapTile(page,9,19);
  assert.equal(await page.evaluate(()=>CQPaint.preview.ok),false,'too-close target is refused');
  assert.match(await page.locator('#paintContextMessage').textContent(),/proche|2,5/i);
  await tapTile(page,9,16);
  assert.deepEqual(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).mortarTarget,mortar.id),{x:9,y:16});
  assert.equal(await page.evaluate(()=>CQPaint.game.shells.length),0,'targeting itself does not invent an immediate impact');
  await tick(page,.2);
  assert.equal(await page.evaluate(()=>CQPaint.game.shells.filter(s=>s.team===1).length),1,'actual tick launches one delayed shell');
  await page.screenshot({path:`/tmp/colorquest-v08-mortar-${viewport.width}.png`});
  await page.locator('#paintPause').tap();
  assert.equal((await page.evaluate(()=>CQPaint.flushSave())).ok,true);
  const snapshot=await page.evaluate(()=>CQPaintCourse.snapshot(CQPaint.course));
  const shell=snapshot.game.shells.find(s=>s.team===1);assert(shell.remaining>0&&shell.remaining<1.2);
  await page.reload();await page.waitForFunction(()=>window.CQPaint);
  await page.locator('#paintCourseStart').tap();assert.equal(await page.evaluate(()=>CQPaint.paused),true);
  assert.deepEqual(await page.evaluate(()=>CQPaintCourse.snapshot(CQPaint.course).game),snapshot.game,'reload retains the committed shell and its exact delay');
  await page.locator('#paintContinue').tap();await freeze(page);
  await tick(page,.3);
  assert.equal(await page.evaluate(id=>CQPaint.game.events.filter(e=>e.type==='mortar-impact'&&e.shellId===id).length,shell.id),0,'restored shell cannot hit early');
  await tick(page,.9);
  assert.equal(await page.evaluate(id=>CQPaint.game.events.filter(e=>e.type==='mortar-impact'&&e.shellId===id).length,shell.id),1,'restored shell hits once at its remaining delay');
  assert.equal(await page.evaluate(()=>CQPaint.game.shells.filter(s=>s.team===1).length),0,'reload never duplicates the shell');
  const hidden=await page.evaluate(id=>{
    const g=CQPaint.game,m=g.buildings.find(b=>b.id===id);
    const t=g.tiles.find(t=>Math.hypot(t.x-m.x,t.y-m.y)<=7&&Math.hypot(t.x-m.x,t.y-m.y)>=2.5&&!g.isVisible(1,t.x,t.y));
    return t&&{x:t.x,y:t.y};
  },mortar.id);assert(hidden,'a hidden target exists inside maximum range');
  await page.locator('#paintMortarTarget').tap();await tapTile(page,hidden.x,hidden.y);
  assert.equal(await page.evaluate(()=>CQPaint.preview.ok),false);
  assert.match(await page.locator('#paintContextMessage').textContent(),/vue/i);
  const independent=await page.evaluate(({id,target})=>{
    const g=CQPaint.game,t=g.tile(target.x,target.y),before=g.previewMortarTarget(1,id,target.x,target.y),old=t.owner;
    t.owner=old===2?0:2;const after=g.previewMortarTarget(1,id,target.x,target.y);t.owner=old;
    return JSON.stringify(before)===JSON.stringify(after);
  },{id:mortar.id,target:hidden});assert.equal(independent,true,'preview does not disclose hidden ownership');
  assert.deepEqual(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).mortarTarget,mortar.id),{x:9,y:16},'hidden target cannot replace the last legal order');
  await page.locator('#paintCancel').tap();await page.locator('#paintMortarClear').tap();
  assert.equal(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).mortarTarget,mortar.id),null,'explicit stop clears the bombardment');
  await page.locator('#paintProducerClose').tap();
}
async function storageGuards(page) {
  const corrupt='{"format":"colorquest-paint-course","version":999,"keep":"preserve exact bytes"}';
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:courseKey,raw:corrupt});
  await page.reload();await page.waitForFunction(()=>window.CQPaint);
  assert.equal(await stored(page),corrupt,'loading an invalid course never overwrites it');
  assert.equal(await page.evaluate(()=>CQPaint.saveStatus.invalid),true);
  assert.match(await page.locator('#paintCourseSaveStatus').innerText(),/illisible|invalide|incompatible|conserv|sauvegarde/i);
  await page.locator('#paintCourseStart').tap();
  if(await page.locator('#paintCourseInvalidNew').isVisible())await page.locator('#paintCourseInvalidNew').tap();
  await page.waitForSelector('#paintCourseConfirmNew');
  assert.equal(await stored(page),corrupt,'starting over requires an explicit choice after corruption');
  await page.locator('#paintCourseKeep').tap();
  assert.equal(await stored(page),corrupt,'canceling recovery preserves the invalid payload');
  assert.equal(await page.evaluate(()=>CQPaint.active),false,'the compatibility click cannot reopen the menu button exposed by canceling');
  await page.locator('#paintCourseStart').tap();
  if(await page.locator('#paintCourseInvalidNew').isVisible())await page.locator('#paintCourseInvalidNew').tap();
  await page.locator('#paintCourseConfirmNew').tap();
  await page.waitForSelector('#paintCourseFight');
  assert.notEqual(await stored(page),corrupt,'explicit replacement may create a clean course');
  const lastGood=await stored(page);
  await page.evaluate(key=>{
    window.originalStorageSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Storage is full','QuotaExceededError');return originalStorageSetItem.call(this,k,v);};
  },courseKey);
  await page.locator('#paintCourseFight').tap();await freeze(page);await tick(page,2);
  const failedSave=await page.evaluate(()=>CQPaint.flushSave());
  assert.equal(failedSave.ok,false);assert.equal(await page.evaluate(()=>CQPaint.saveStatus.ok),false);
  assert.equal(await stored(page),lastGood,'failed persistence never removes the last valid checkpoint');
  assert.match(await page.locator('#paintCourseStatus').innerText(),/sauvegard|fenêtre|mémoire|impossible/i,'failed save is visible in combat');
  const liveTime=await page.evaluate(()=>CQPaint.game.time);
  await page.locator('#paintMenu').tap();await page.locator('#paintCourseStart').tap();
  assert.equal(await page.evaluate(()=>CQPaint.game.time),liveTime,'menu resume retains unsaved in-memory progress, not stale disk state');
  await page.evaluate(()=>{Storage.prototype.setItem=originalStorageSetItem;delete window.originalStorageSetItem;});
  assert.equal((await page.evaluate(()=>CQPaint.flushSave())).ok,true);
  assert.notEqual(await stored(page),lastGood,'saving recovers after quota failure');
  console.log('PASS course storage: invalid payload preserved until explicit reset; quota failure visible, last valid checkpoint preserved, memory resume and later recovery.');
  const other=await page.context().newPage();
  try {
    await other.goto(page.url());await other.waitForFunction(()=>window.CQPaintCourse&&window.CQPaint);
    await other.locator('#paintCourseStart').tap();await other.locator('#paintContinue').tap();
    await freeze(other);await tick(other,2);
    assert.equal((await other.evaluate(()=>CQPaint.flushSave())).ok,true);
    const latest=await stored(other),time=await other.evaluate(()=>CQPaint.game.time);
    await page.waitForFunction(()=>CQPaint.saveStatus.conflict);
    assert.equal(await page.evaluate(()=>CQPaint.paused),true);
    assert.equal((await page.evaluate(()=>CQPaint.flushSave())).ok,false,'an older window refuses to overwrite newer progress');
    assert.equal(await stored(page),latest);
    await page.bringToFront();await page.locator('#paintCourseReload').tap();
    assert.equal(await page.evaluate(()=>CQPaint.game.time),time);
    assert.equal(await page.evaluate(()=>CQPaint.paused),true);
    assert.equal(await page.evaluate(()=>CQPaint.saveStatus.conflict),false);
    console.log('PASS course concurrent windows: older combat pauses, cannot overwrite and resumes the latest checkpoint explicitly.');
  } finally {await other.close();}
}
async function pwaCourse(browser,url) {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(url);await page.waitForFunction(()=>CQInstall.offlineReady&&navigator.serviceWorker.controller&&window.CQPaintCourse);
    await page.locator('#paintCourseStart').tap();await page.locator('#paintCourseFight').tap();await freeze(page);await tick(page,2);
    release=2;
    await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).update());
    await page.waitForFunction(()=>!document.getElementById('updateGame').hidden);
    assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true);
    assert.equal(await page.locator('meta[name="course-test-release"]').getAttribute('content'),'1','waiting update never reloads by itself');
    await page.evaluate(()=>CQInstall.showUpdate());
    assert.equal(await page.evaluate(()=>CQPaint.paused),true);
    assert.match(await page.locator('#installDialog').innerText(),/sauvegard/i);
    const checkpoint=await page.evaluate(()=>CQPaintCourse.snapshot(CQPaint.course));
    await page.evaluate(key=>{
      window.originalStorageSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Storage is full','QuotaExceededError');return originalStorageSetItem.call(this,k,v);};
    },courseKey);
    await page.locator('#confirmGameUpdate').tap();
    assert.equal(await page.locator('meta[name="course-test-release"]').getAttribute('content'),'1','failed course save refuses destructive update reload');
    assert.match(await page.locator('#installDialog').innerText(),/gardez|attendra|impossible/i);
    assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true);
    await page.evaluate(()=>{Storage.prototype.setItem=originalStorageSetItem;delete window.originalStorageSetItem;});
    await Promise.all([page.waitForNavigation(),page.locator('#confirmGameUpdate').tap()]);
    await page.waitForFunction(()=>window.CQPaintCourse&&CQInstall.offlineReady);
    assert.equal(await page.locator('meta[name="course-test-release"]').getAttribute('content'),'2');
    await page.locator('#paintCourseStart').tap();
    assert.equal(await page.evaluate(()=>CQPaint.paused),true);
    assert.deepEqual(await page.evaluate(()=>CQPaintCourse.snapshot(CQPaint.course).game),checkpoint.game,'accepted update retains the precise course combat');
    await page.evaluate(()=>CQPaint.showMenu());
    await context.setOffline(true);await page.goto(url+'?course-offline=1');
    await page.waitForFunction(()=>window.CQPaintCourse&&window.CQPaintTutorial&&CQInstall.offlineReady);
    for(const file of ['paint-course.js','paint-course.css','paint-tutorial.js','paint-tutorial.css'])assert.equal(await page.evaluate(async file=>(await fetch(file)).status,file),200,file+' is precached');
    await page.locator('#paintCourseStart').tap();assert.equal(await page.evaluate(()=>CQPaint.paused),true);
    assert.deepEqual(await page.evaluate(()=>CQPaintCourse.snapshot(CQPaint.course).game),checkpoint.game,'offline navigation restores saved course exactly');
    await page.locator('#paintContinue').tap();
    const t=await page.evaluate(()=>CQPaint.game.time);await page.waitForFunction(t=>CQPaint.game.time>t,t);
    assert.deepEqual(errors,[]);
    console.log('PASS course PWA: explicit update waits on save failure, resumes exact successful checkpoint, offline modules and saved combat run.');
  }finally{await context.close();}
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/colorquest/`;
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
    for(const viewport of [{width:360,height:640},{width:390,height:844}]){
      const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'});
      const page=await context.newPage();await page.goto(url);await runPortrait(page,viewport);
      if(viewport.width===360)await storageGuards(page);
      await context.close();
    }
    await pwaCourse(browser,url);
    const local=await browser.newPage({viewport:{width:360,height:640},isMobile:true,hasTouch:true});
    const localErrors=[];local.on('pageerror',e=>localErrors.push(e.message));
    await local.goto(pathToFileURL(path.join(root,'index.html')).href);
    await local.waitForFunction(()=>window.CQPaintCourse&&window.CQPaint);
    await local.locator('#paintCourseStart').tap();await local.locator('#paintCourseFight').tap();
    assert.equal(await local.evaluate(()=>CQPaint.course.phase==='combat'&&CQPaint.game.duration===240),true);
    assert.deepEqual(localErrors,[]);await local.close();
    console.log('PASS course file://: autonomous course starts without HTTP or external resources.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
