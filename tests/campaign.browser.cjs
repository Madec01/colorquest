/* Campaign progression through real touch controls; no synthetic victories. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const url = pathToFileURL(path.resolve(__dirname,'../index.html')).href;
const PROGRESS = 'colorquest.campaign.progress.v1';
async function advance(page, seconds) {
  await page.evaluate(seconds => { for(let i=0;i<seconds*10 && game.winner===null;i++) game.update(.1); updateHUD();CQUI.update(true);CQCampaign.update(true);CQStrategy.update(true);CQCamera.update(); },seconds);
}
async function tapTile(page,x,y) {
  const point = () => page.evaluate(({x,y}) => { const r=canvas.getBoundingClientRect(),px=r.x+view.x+(x+.5)*view.cell,py=r.y+view.y+(y+.5)*view.cell;return {x:px,y:py,visible:px>=r.x+4&&px<=r.right-4&&py>=r.y+4&&py<=r.bottom-4}; },{x,y});
  let p = await point();
  if(!p.visible){await page.locator('#cameraOverview').tap();p=await point();}
  await page.touchscreen.tap(p.x,p.y);
}
async function build(page,type,x,y) {
  if (await page.locator('button[data-tab="build"]').isVisible()) await page.locator('button[data-tab="build"]').tap();
  await page.locator(`[data-build="${type}"]`).tap();
  const before=await page.evaluate(()=>game.buildings.length);
  await tapTile(page,x,y);
  await page.waitForFunction(()=>!document.getElementById('placementConfirmActions').hidden);
  assert.equal(await page.evaluate(()=>game.buildings.length),before,'first tap is a preview, never an accidental build');
  assert.equal(await page.locator('#confirmBuild').isEnabled(),true,await page.locator('#buildPreviewMessage').textContent());
  await page.locator('#confirmBuild').tap();
  assert.equal(await page.evaluate(({type,x,y})=>game.buildings.some(b=>b.team===1&&b.type===type&&b.x===x&&b.y===y),{type,x,y}),true);
}
async function chooseMission(page,id) {
  await page.locator('#campaignOpen').tap();
  await page.locator(`[data-campaign-mission="${id}"]`).tap();
  if(await page.locator('#newGameConfirm').isVisible())await page.locator('#newGameConfirm').tap();
  await page.waitForFunction(id=>playing&&game.mission?.id===id,id);
}
async function train(page,count=4) {
  await page.locator('button[data-tab="units"]').tap();
  for(let i=0;i<count;i++)await page.locator('[data-recruit="fighter"]').tap();
  await advance(page,count*6+2);
}
async function attack(page,x,y) {
  await page.locator('#selectAll').tap(); await page.locator('#moveOrder').tap(); await tapTile(page,x,y);
}
async function waitWin(page,max=100) {
  for(let i=0;i<max;i+=5){if(await page.evaluate(()=>game.winner!==null))break;await advance(page,5);}
  assert.equal(await page.evaluate(()=>game.winner),1,JSON.stringify(await page.evaluate(()=>({time:game.time,mission:game.mission,units:game.units,buildings:game.buildings.map(b=>({type:b.type,team:b.team,x:b.x,y:b.y,hp:b.hp,connected:b.connected}))}))));
  await page.waitForSelector('#campaignReplay');
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:390,height:844},{width:360,height:640}]){
   const page=await browser.newPage({viewport,isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.waitForFunction(()=>window.CQCampaign&&window.CQMissions);
   await page.screenshot({path:`/tmp/colorquest-v06-menu-${viewport.width}.png`});
   const menuBox=await page.locator('#campaignOpen').boundingBox();assert.ok(menuBox.y+menuBox.height<=viewport.height,'campaign launch visible without scrolling');
   assert.equal(await page.evaluate(()=>CQCampaign.start('source')),false,'locked mission cannot start via UI API');
   await page.locator('#campaignOpen').tap();
   assert.equal(await page.locator('[data-campaign-mission]').count(),5);
   assert.equal(await page.locator('[data-campaign-mission]:disabled').count(),4);
   await page.screenshot({path:`/tmp/colorquest-v06-missions-${viewport.width}.png`});
   await page.locator('[data-campaign-mission="first-ink"]').tap();
   assert.equal(await page.evaluate(()=>game.mission.id),'first-ink');
   assert.equal(await page.locator('#buildButtons [data-build]:visible').count(),1);
   assert.equal(await page.locator('.mobile-tabs').isVisible(),false);
   assert.equal(await page.locator('#strategyOpen').isVisible(),false);
   assert.equal(await page.locator('.scoreboard').isVisible(),false);
   assert.equal(await page.locator('#worldLegendOpen').isVisible(),false);
   const focus=await page.locator('#campaignFocus').boundingBox();assert.ok(focus.width>=44&&focus.height>=44);
   await advance(page,40);assert.equal(await page.evaluate(()=>game.winner),null,'waiting alone does not finish the first lesson');
   assert.equal(await page.evaluate(()=>CQCampaign.completed.length),0);
   await page.screenshot({path:`/tmp/colorquest-v06-first-ink-${viewport.width}.png`});
   await page.locator('#campaignFocus').tap();assert.ok(await page.evaluate(()=>CQCamera.zoom>=1.7));
   assert.equal(await page.evaluate(()=>paused),false,'seeing the objective never pauses the mission');
   await page.locator('#mobileHelp').tap();assert.equal(await page.evaluate(()=>paused),true);
   assert.doesNotMatch(await page.locator('#modalContent').textContent(),/spécialisation|Décoloration|60 %/,'help only describes the current lesson');
   await page.locator('#campaignHelpDone').tap();assert.equal(await page.evaluate(()=>paused),true,'help returns to a clearly paused mission');
   await page.locator('#pauseFlag').tap();
   await build(page,'relay',16,33);await waitWin(page,30);
   assert.deepEqual(await page.evaluate(()=>CQCampaign.completed),['first-ink']);
   assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).completed,PROGRESS),['first-ink']);
   assert.match(await page.locator('.campaign-unlock strong').textContent(),/source.*extracteur/i,'result names the next actual mechanic');
   await page.locator('#campaignNext').tap();
   assert.equal(await page.evaluate(()=>game.mission.id),'source');
   assert.equal(await page.locator('#buildButtons [data-build]:visible').count(),2);
   assert.equal(await page.locator('#unitButtons').isVisible(),false);
   await advance(page,2);await build(page,'relay',16,33);await advance(page,10);
   await build(page,'relay',16,28);await advance(page,10);
   await build(page,'extractor',16,24);await waitWin(page,10);
   assert.deepEqual(await page.evaluate(()=>CQCampaign.completed),['first-ink','source']);
   await page.locator('#campaignNext').tap();
   assert.equal(await page.evaluate(()=>game.mission.id),'contact');
   await train(page,4);assert.ok(await page.evaluate(()=>game.units.filter(u=>u.team===1).length>=4));
   await page.screenshot({path:`/tmp/colorquest-v06-contact-${viewport.width}.png`});
   await attack(page,16,20);await waitWin(page,100);
   assert.deepEqual(await page.evaluate(()=>CQCampaign.completed),['first-ink','source','contact']);
   await page.locator('#campaignNext').tap();
   assert.equal(await page.evaluate(()=>game.mission.id),'link');
   await advance(page,2);await build(page,'relay',16,33);await advance(page,10);
   await train(page,4);await attack(page,16,23);await waitWin(page,100);
   assert.deepEqual(await page.evaluate(()=>CQCampaign.completed),['first-ink','source','contact','link']);
   await page.locator('#campaignNext').tap();
   assert.equal(await page.evaluate(()=>game.mission.id),'outpost');
   assert.equal(await page.locator('[data-build="barracks"]').isVisible(),true);
   // A mid-mission save uses its own slot and returns paused with exact state.
   await advance(page,2);await build(page,'relay',16,33);await advance(page,10);
   await page.locator('#pause').tap();
   const snapshot=await page.evaluate(()=>CQSnapshot.capture(game));
   await page.reload();await page.locator('#campaignResume').tap();
   assert.equal(await page.evaluate(()=>paused),true);
   assert.deepEqual(await page.evaluate(()=>CQSnapshot.capture(game)),snapshot);
   assert.equal(await page.locator('#campaignObjective').isVisible(),true);
   await page.locator('#pauseFlag').tap();
   await build(page,'relay',16,28);await advance(page,10);
   await build(page,'barracks',13,25);
   await page.locator('button[data-tab="units"]').tap();
   const source=await page.evaluate(()=>game.buildings.find(b=>b.type==='barracks'&&b.team===1).id);
   assert.equal(await page.locator('#strategyQuickProducer').inputValue(),String(source));
   await train(page,3);await attack(page,16,23);await advance(page,8);
   if(!await page.evaluate(()=>game.buildings.some(b=>b.type==='extractor'&&b.x===16&&b.y===23)))await build(page,'extractor',16,23);
   await page.locator('#campaignHold').tap();
   await waitWin(page,100);
   assert.deepEqual(await page.evaluate(()=>CQCampaign.completed),['first-ink','source','contact','link','outpost']);
   assert.equal(await page.locator('#campaignNext').count(),0,'no nonexistent sixth mission');
   await page.locator('#campaignEndMenu').tap();
   assert.equal(await page.locator('[data-campaign-mission]:disabled').count(),0);
   await page.locator('[data-campaign-mission="first-ink"]').tap();
   assert.equal(await page.locator('#buildButtons [data-build]:visible').count(),1,'replay keeps lesson restrictions');
   assert.equal(await page.locator('#unitButtons').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);
   console.log(`PASS campaign ${viewport.width}×${viewport.height}: five genuine touch victories, progressive tools, build preview/confirmation, locks/unlocks, barracks producer, objective, independent pause/resume and restricted replay.`);
   await page.close();
  }
  // Progress writes may fail without turning a real victory into a fake saved result.
  const quota=await browser.newPage({viewport:{width:360,height:640},isMobile:true,hasTouch:true});
  await quota.goto(url);await chooseMission(quota,'first-ink');
  await quota.evaluate(key=>{window.progressSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Full','QuotaExceededError');return progressSetItem.call(this,k,v);};},PROGRESS);
  await advance(quota,2);await build(quota,'relay',16,33);await waitWin(quota,30);
  assert.equal(await quota.evaluate(()=>CQCampaign.canClearFinished),false);
  assert.equal(await quota.evaluate(key=>localStorage.getItem(key),PROGRESS),null);
  assert.equal(await quota.evaluate(()=>CQSave.read('campaign').status),'valid','failed progress preserves the preceding mission checkpoint');
  assert.match(await quota.locator('#campaignResultSave').textContent(),/non enregistrée/);
  assert.equal(await quota.evaluate(()=>CQCampaign.isUnlocked('source')),true,'session unlock is allowed and clearly marked unsaved');
  await quota.evaluate(()=>{Storage.prototype.setItem=progressSetItem;});
  await quota.locator('#campaignRetryProgress').tap();
  assert.equal(await quota.evaluate(()=>CQCampaign.canClearFinished),true);
  assert.equal(await quota.evaluate(()=>CQSave.read('campaign').status),'none');
  assert.deepEqual(await quota.evaluate(key=>JSON.parse(localStorage.getItem(key)).completed,PROGRESS),['first-ink']);
  await quota.close();
  const invalid=await browser.newPage({viewport:{width:360,height:640},isMobile:true,hasTouch:true});
  await invalid.addInitScript(key=>localStorage.setItem(key,'{"format":"unknown","version":99,"completed":["outpost"]}'),PROGRESS);
  await invalid.goto(url);const raw=await invalid.evaluate(key=>localStorage.getItem(key),PROGRESS);
  assert.equal(await invalid.evaluate(()=>CQCampaign.isUnlocked('source')),false);
  assert.match(await invalid.locator('#campaignMenuNote').textContent(),/illisible/);
  await chooseMission(invalid,'first-ink');await advance(invalid,2);await build(invalid,'relay',16,33);await waitWin(invalid,30);
  assert.equal(await invalid.evaluate(key=>localStorage.getItem(key),PROGRESS),raw,'unknown progression is never silently overwritten');
  assert.equal(await invalid.evaluate(()=>CQCampaign.canClearFinished),false);
  await invalid.close();
  const guard=await browser.newPage({viewport:{width:360,height:640},isMobile:true,hasTouch:true});
  await guard.goto(url);await chooseMission(guard,'first-ink');
  assert.equal(await guard.evaluate(()=>CQCampaign.onFinished(game)),false,'running mission cannot complete through UI handler');
  // Deliberately inconsistent winner is only used to probe the completion guard.
  await guard.evaluate(()=>{game.winner=1;updateHUD();});
  assert.deepEqual(await guard.evaluate(()=>CQCampaign.completed),[]);
  assert.equal(await guard.evaluate(key=>localStorage.getItem(key),PROGRESS),null);
  await guard.close();
  console.log('PASS campaign progress: failed writes retain checkpoint, retry recovers, unknown data is preserved, locks are checked and inconsistent victories do not unlock levels.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
