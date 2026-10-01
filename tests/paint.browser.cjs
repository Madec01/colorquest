/* Real touch/pointer paths for the new combat. The simulation is stepped by
 * the test only when measuring prices, spawn timing or a terminal clock. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const url = pathToFileURL(path.resolve(__dirname,'../index.html')).href;

async function point(page, x, y) {
  return page.evaluate(({x,y}) => { const r=document.getElementById('paintCanvas').getBoundingClientRect(),v=CQPaint.view;return{x:r.x+v.x+(x+.5)*v.cell,y:r.y+v.y+(y+.5)*v.cell}; },{x,y});
}
async function tapTile(page,x,y) { const p=await point(page,x,y);await page.touchscreen.tap(p.x,p.y); }
async function touchDrag(page,from,to) {
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
async function brush(page,from,to) {
  await page.locator('#paintBrush').tap();await touchDrag(page,await point(page,...from),await point(page,...to));
}
async function step(page,seconds) {
  await page.evaluate(seconds=>{for(let i=0;i<Math.ceil(seconds*30)&&CQPaint.game.winner==null;i++)window.paintTestStep(Math.min(1/30,seconds-i/30));CQPaint.updateHUD(true);},seconds);
}
async function findCard(page,id) {return page.evaluate(id=>CQPaint.game.hands[1].indexOf(id),id);}
async function cardTap(page,id,x,y) {await page.locator(`[data-paint-card="${await findCard(page,id)}"]`).tap();await tapTile(page,x,y);}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try {
    for(const viewport of [{width:360,height:640},{width:390,height:844}]){
      const page=await browser.newPage({viewport,isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);await page.waitForFunction(()=>window.CQPaint);
      const launch=await page.locator('#paintStart').boundingBox();assert.ok(launch.y+launch.height<viewport.height,'prototype entry is immediately visible');
      await page.locator('#paintStart').tap();assert.equal(await page.evaluate(()=>CQPaint.paused),true,'intro freezes combat');
      await page.locator('#paintBegin').tap();assert.equal(await page.evaluate(()=>CQPaint.paused),false);
      await page.evaluate(()=>{window.paintTestStep=CQPaint.game.update.bind(CQPaint.game);CQPaint.game.update=()=>{};});
      assert.equal(await page.locator('[data-paint-card]').count(),4,'permanent brush is outside four real cards');
      assert.match(await page.locator('#paintNext').textContent(),/Bastion/);
      const canvasBox=await page.locator('#paintCanvas').boundingBox();assert.ok(canvasBox.height/viewport.height>=.60,'canvas occupies at least 60% of portrait');
      assert.equal(await page.evaluate(()=>document.getElementById('paintGame').scrollWidth>innerWidth),false,'no horizontal overflow');
      for(const id of ['paintMenu','paintPause','paintHelp','paintBrush','paintNavigate','paintZoomIn','paintZoomOut']){const box=await page.locator('#'+id).boundingBox();assert.ok(box.width>=44&&box.height>=44,id+' keeps 44px touch target');}
      const hint=await page.locator('#paintHint').boundingBox(),core=await point(page,9,23);assert.ok(core.y>hint.y+hint.height,'help never covers the starting core');
      await page.screenshot({path:`/tmp/colorquest-v07-play-${viewport.width}.png`});

      const paintBefore=await page.evaluate(()=>({money:CQPaint.game.pigment[1],owner:CQPaint.game.tile(9,18).owner}));
      await brush(page,[9,20],[9,18]);assert.equal(await page.evaluate(()=>CQPaint.preview.ok),true,await page.locator('#paintContextMessage').textContent());
      assert.equal(await page.evaluate(()=>CQPaint.game.tile(9,18).owner),paintBefore.owner,'release previews without painting');
      assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),paintBefore.money,'preview spends nothing');
      assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),true);
      const price=await page.evaluate(()=>CQPaint.preview.cost);await page.screenshot({path:`/tmp/colorquest-v07-brush-${viewport.width}.png`});
      await page.locator('#paintConfirm').tap();assert.equal(await page.evaluate(()=>CQPaint.game.tile(9,18).owner),1);assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),paintBefore.money-price);
      assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),false);assert.equal(await page.evaluate(()=>CQPaint.tutorialStep),1);

      await cardTap(page,'relay',9,18);assert.equal(await page.locator('#paintConfirm').isEnabled(),true);
      const buildings=await page.evaluate(()=>CQPaint.game.buildings.length);await page.locator('#paintCancel').tap();
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.length),buildings,'cancel does not build or cycle card');
      assert.equal(await page.evaluate(()=>CQPaint.game.hands[1][0]),'relay');
      await cardTap(page,'relay',9,18);
      const confirmBox=await page.locator('#paintConfirm').boundingBox(),playMoney=await page.evaluate(()=>CQPaint.game.pigment[1]);
      await touchDrag(page,{x:confirmBox.x+confirmBox.width/2,y:confirmBox.y+confirmBox.height/2},{x:2,y:confirmBox.y+confirmBox.height/2});
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.length),buildings,'a touch leaving the confirmation button never commits');
      assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),playMoney);
      await page.evaluate(()=>document.getElementById('paintConfirm').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})));
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.length),buildings,'late compatibility click cannot rescue a rejected drag');
      const tapSession=await page.context().newCDPSession(page),tapStart={x:confirmBox.x+confirmBox.width/2,y:confirmBox.y+confirmBox.height/2,id:5};
      await tapSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tapStart]});
      await tapSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...tapStart,x:tapStart.x+30}]});
      await tapSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[tapStart]});
      await tapSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await tapSession.detach();
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.length),buildings,'moving away then back is still a drag, never a confirm tap');
      await page.evaluate(()=>document.getElementById('paintConfirm').addEventListener('pointerup',e=>{window.paintLastConfirmPointer=e.pointerId;},{capture:true,once:true}));
      await page.locator('#paintConfirm').tap();
      await page.waitForFunction(()=>CQPaint.game.buildings.some(b=>b.team===1&&b.type==='relay'&&b.x===9&&b.y===18));
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.some(b=>b.team===1&&b.type==='relay'&&b.x===9&&b.y===18)),true);
      assert.equal(await page.evaluate(()=>CQPaint.game.hands[1][0]),'bastion');assert.match(await page.locator('#paintNext').textContent(),/Vague/);
      assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),playMoney-12,'one confirm tap charges exactly one card');
      const afterCard=await page.evaluate(()=>({money:CQPaint.game.pigment[1],hands:CQPaint.game.hands[1].slice(),deck:CQPaint.game.decks[1].slice()}));
      await page.evaluate(()=>{document.getElementById('paintConfirm').dispatchEvent(new PointerEvent('click',{bubbles:true,detail:1,pointerType:'touch',pointerId:window.paintLastConfirmPointer}));document.getElementById('paintConfirm').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));});
      assert.deepEqual(await page.evaluate(()=>({money:CQPaint.game.pigment[1],hands:CQPaint.game.hands[1].slice(),deck:CQPaint.game.decks[1].slice()})),afterCard,'compatibility click cannot double charge or cycle');

      const barracksButton=page.locator(`[data-paint-card="${await findCard(page,'barracks')}"]`),buttonBox=await barracksButton.boundingBox();
      await touchDrag(page,{x:buttonBox.x+buttonBox.width/2,y:buttonBox.y+buttonBox.height/2},await point(page,8,19));
      assert.equal(await page.locator('#paintConfirm').isEnabled(),true,await page.locator('#paintContextMessage').textContent());
      assert.equal(await page.evaluate(()=>CQPaint.game.buildings.filter(b=>b.team===1&&b.type==='barracks').length),0,'card drop still asks for confirmation');
      await page.locator('#paintConfirm').tap();await page.waitForFunction(()=>CQPaint.game.buildings.some(b=>b.team===1&&b.type==='barracks'));assert.equal(await page.evaluate(()=>CQPaint.tutorialStep),2);
      const producerId=await page.evaluate(()=>CQPaint.game.buildings.find(b=>b.team===1&&b.type==='barracks').id);
      await step(page,5.1);assert.equal(await page.evaluate(()=>CQPaint.game.getUnitCount(1)),1,'paid real production produces a unit');
      await page.locator('#paintNavigate').tap();await tapTile(page,8,19);
      assert.equal(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).productionPaused,producerId),true,'short tap pauses only production');
      const count=await page.evaluate(()=>CQPaint.game.getUnitCount(1));await step(page,6);assert.equal(await page.evaluate(()=>CQPaint.game.getUnitCount(1)),count);
      await page.locator('#paintProductionToggle').tap();
      assert.equal(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).productionPaused,producerId),false);
      await page.locator('#paintProducerClose').tap();
      await touchDrag(page,await point(page,8,19),await point(page,9,16));
      assert.deepEqual(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).flow,producerId),{x:9,y:16});
      assert.equal(await page.evaluate(()=>CQPaint.tutorialStep),3);
      assert.equal(await page.evaluate(id=>CQPaint.game.units.filter(u=>u.team===1&&u.producerId===id).every(u=>u.target.x===9&&u.target.y===16),producerId),true,'flow redirects already spawned units');
      await page.screenshot({path:`/tmp/colorquest-v07-flow-${viewport.width}.png`});
      await page.locator('#paintRecall').tap();assert.deepEqual(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).flow,producerId),{x:8,y:19});
      await page.locator('#paintProducerClose').tap();
      const cdp=await page.context().newCDPSession(page),p=await point(page,8,19);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});await page.waitForTimeout(600);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal(await page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id).productionPaused,producerId),false,'long press recalls without toggling production');
      await page.locator('#paintProducerClose').tap();

      // An armed card reserves payment while aiming. Cancelling releases the
      // producer immediately, without a free spawn or an extra card charge.
      await page.locator(`[data-paint-card="${await findCard(page,'extractor')}"]`).tap();await tapTile(page,9,21);
      assert.equal(await page.locator('#paintConfirm').isEnabled(),false,'extractor cannot be built off a source');
      const heldCount=await page.evaluate(()=>CQPaint.game.getUnitCount(1));await step(page,7);
      assert.equal(await page.evaluate(()=>CQPaint.game.getUnitCount(1)),heldCount,'aiming holds automatic spawn spending');
      await page.locator('#paintCancel').tap();await step(page,5.1);assert.ok(await page.evaluate(()=>CQPaint.game.getUnitCount(1))>heldCount);

      // Two fingers cancel the brush, zoom and never finish the interrupted
      // paint or dispatch a flow when either finger lifts.
      await page.locator('#paintBrush').tap();const a=await point(page,9,16),b=await point(page,11,16);
      const snap=await page.evaluate(()=>({money:CQPaint.game.pigment[1],tiles:CQPaint.game.tiles.map(t=>t.owner),flow:CQPaint.game.getProducers(1).map(p=>p.flow)}));
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y,id:1},{x:b.x,y:b.y,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x-30,y:a.y,id:1},{x:b.x+30,y:b.y,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:a.x-30,y:a.y,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal(await page.evaluate(()=>CQPaint.mode),'navigate');assert.equal(await page.evaluate(()=>CQPaint.preview),null);assert.ok(await page.evaluate(()=>CQPaint.zoom)>1);
      assert.deepEqual(await page.evaluate(()=>({money:CQPaint.game.pigment[1],tiles:CQPaint.game.tiles.map(t=>t.owner),flow:CQPaint.game.getProducers(1).map(p=>p.flow)})),snap,'pinch cannot paint, spend or send troops');
      assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),false);
      while(await page.locator('#paintZoomOut').isEnabled())await page.locator('#paintZoomOut').tap();

      // Browser pointer cancellation likewise releases an armed card.
      await page.locator(`[data-paint-card="${await findCard(page,'extractor')}"]`).tap();
      const cancelPoint=await point(page,10,22);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cancelPoint.x,y:cancelPoint.y,id:3}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      assert.equal(await page.evaluate(()=>CQPaint.mode),'navigate');assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),false);
      await cdp.detach();

      // Keyboard activation remains available even in the short compatibility
      // mouse-event suppression window after a rejected touch gesture.
      await cardTap(page,'splash',9,21);
      assert.equal(await page.locator('#paintConfirm').isEnabled(),true);
      const keyboardBox=await page.locator('#paintConfirm').boundingBox(),keyboardMoney=await page.evaluate(()=>CQPaint.game.pigment[1]);
      await touchDrag(page,{x:keyboardBox.x+keyboardBox.width/2,y:keyboardBox.y+22},{x:2,y:keyboardBox.y+22});
      await page.locator('#paintConfirm').focus();await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),keyboardMoney-16,'native keyboard detail-0 activation is never suppressed');

      // Finish a fresh real engine match using its clock, never injecting a
      // winner. The terminal UI must then lead back to a playable new match.
      await page.evaluate(()=>{CQPaint.start({replace:true,tutorial:false,seed:7});window.paintTestStep=CQPaint.game.update.bind(CQPaint.game);CQPaint.game.update=()=>{};});
      await step(page,240);await page.evaluate(()=>{CQPaint.game.update=window.paintTestStep;});
      await page.waitForSelector('#paintAgain',{timeout:5000});
      assert.equal(await page.evaluate(()=>CQPaint.game.time),240);assert.ok(await page.evaluate(()=>CQPaint.game.winner!==null));
      assert.match(await page.locator('#paintDialogContent').textContent(),/territoire|égalité/i);
      await page.locator('#paintAgain').tap();assert.equal(await page.evaluate(()=>CQPaint.game.winner),null);
      assert.equal(await page.evaluate(()=>CQPaint.paused),false);
      assert.deepEqual(errors,[]);await page.close();
      console.log('PASS paint touch, real paint/cards/production/flow, safe pinch/cancel, layout and terminal lifecycle',viewport.width+'x'+viewport.height);
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
