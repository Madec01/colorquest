/* V0.7.1 real mobile controls. Only the simulation clock is controlled: every
 * territory, card, flow and retreat command below comes from touch input. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

async function point(page, x, y) {
  return page.evaluate(({x,y}) => {
    const r = document.getElementById('paintCanvas').getBoundingClientRect(), v = CQPaint.view;
    return {x:r.x + v.x + (x + .5) * v.cell, y:r.y + v.y + (y + .5) * v.cell};
  }, {x,y});
}
async function centre(locator) { const b=await locator.boundingBox(); assert(b,'touch target must be visible'); return{x:b.x+b.width/2,y:b.y+b.height/2}; }
async function tapTile(page,x,y) { const p=await point(page,x,y); await page.touchscreen.tap(p.x,p.y); }
async function touchPath(page,points,beforeRelease,canceled=false) {
  const cdp=await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});
    for(let j=1;j<points.length;j++)for(let i=1;i<=8;i++){
      const a=points[j-1],b=points[j];
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8,id:1}]});
    }
    if(beforeRelease)await beforeRelease();
    await cdp.send('Input.dispatchTouchEvent',{type:canceled?'touchCancel':'touchEnd',touchPoints:[]});
  }finally{await cdp.detach();}
}
async function stroke(page,coordinates,beforeRelease,canceled){
  // Independent strokes deliberately wait past the button double-tap window.
  if(await page.evaluate(()=>CQPaint.mode!=='brush')){await page.waitForTimeout(350);await page.locator('#paintBrush').tap();}
  await touchPath(page,await Promise.all(coordinates.map(p=>point(page,...p))),beforeRelease,canceled);
}
async function cardButton(page,id){const i=await page.evaluate(id=>CQPaint.game.hands[1].indexOf(id),id);assert(i>=0,id+' must be in hand');return page.locator(`[data-paint-card="${i}"]`);}
async function cardTap(page,id,x,y){await(await cardButton(page,id)).tap();await tapTile(page,x,y);}
async function freeze(page){await page.evaluate(()=>{window.paintTestStep=CQPaint.game.update.bind(CQPaint.game);CQPaint.game.update=()=>{};window.paintRealAI||=CQPaintAI;window.CQPaintAI={...paintRealAI,update(){}};});}
async function fresh(page){await page.evaluate(()=>CQPaint.start({replace:true,tutorial:false,seed:7}));await freeze(page);}
async function step(page,seconds,withAI=false){
  await page.evaluate(({seconds,withAI})=>{for(let i=0;i<Math.ceil(seconds*30)&&CQPaint.game.winner==null;i++){const dt=Math.min(1/30,seconds-i/30);if(withAI)paintRealAI.update(CQPaint.game,dt);paintTestStep(dt);}CQPaint.updateHUD(true);},{seconds,withAI});
}
async function economy(page){return page.evaluate(()=>({money:CQPaint.game.pigment[1],tiles:CQPaint.game.tiles.map(t=>t.owner),hand:CQPaint.game.hands[1].slice(),deck:CQPaint.game.decks[1].slice(),buildings:CQPaint.game.buildings.map(b=>b.id)}));}
async function building(page,id){return page.evaluate(id=>CQPaint.game.buildings.find(b=>b.id===id),id);}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    for(const viewport of [{width:360,height:640},{width:390,height:844}]){
      const page=await browser.newPage({viewport,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);await page.waitForFunction(()=>window.CQPaint);
      await page.locator('#paintFreePlay').tap();await freeze(page);
      assert.equal(await page.evaluate(()=>CQPaint.paused),false);
      assert.equal(await page.locator('[data-paint-card]').count(),4,'four cards plus permanent brush');
      assert.match(await page.locator('#paintNext').textContent(),/Bastion/);
      const canvasBox=await page.locator('#paintCanvas').boundingBox();assert(canvasBox.height/viewport.height>=.60,'canvas occupies at least 60% of portrait');
      assert.equal(await page.evaluate(()=>document.getElementById('paintGame').scrollWidth>innerWidth),false,'no horizontal overflow');
      for(const id of ['paintMenu','paintPause','paintHelp','paintBrush','paintNavigate','paintZoomIn','paintZoomOut']){const b=await page.locator('#'+id).boundingBox();assert(b.width>=44&&b.height>=44,id+' has 44px target');}

      // Preview is read-only; lift commits only the visible valid prefix.
      const first=await economy(page);let price=0;
      await stroke(page,[[9,20],[9,15]],async()=>{
        assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),true);
        assert.deepEqual(await economy(page),first,'aim preview is read-only');
        price=await page.evaluate(()=>CQPaint.preview.cost);assert.equal(price,2);
        assert.match(await page.locator('#paintContextMessage').textContent(),/vue|visible/i);
        await page.screenshot({path:`/tmp/colorquest-v071-partial-${viewport.width}.png`});
      });
      assert.equal(await page.evaluate(()=>CQPaint.game.tile(9,18).owner),1);
      assert.equal(await page.evaluate(()=>CQPaint.game.tile(9,17).owner),0);
      assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),first.money-price);
      assert.equal(await page.evaluate(()=>CQPaint.mode),'navigate','release restores navigation');
      assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),false);
      assert.equal(await page.locator('#paintConfirm').count(),0,'no second confirmation');
      const canceled=await economy(page);
      await stroke(page,[[9,18],[10,18],[9,18]]);assert.deepEqual(await economy(page),canceled,'return to start cancels');
      await stroke(page,[[0,0],[1,0]]);assert.deepEqual(await economy(page),canceled,'invalid stroke spends nothing');
      await stroke(page,[[9,18],[10,18]],null,true);assert.deepEqual(await economy(page),canceled,'pointer cancellation never paints');
      assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),false);

      await page.waitForTimeout(350);await page.locator('#paintBrush').tap();await page.locator('#paintBrush').tap();
      assert.equal(await page.evaluate(()=>CQPaint.brushLocked),true);
      assert.match(await page.locator('#paintBrush').textContent(),/🔒|verrou/i);
      await touchPath(page,[await point(page,9,18),await point(page,10,18)]);
      assert.equal(await page.evaluate(()=>CQPaint.game.tile(10,18).owner),1);
      assert.equal(await page.evaluate(()=>CQPaint.mode),'brush');
      await page.locator('#paintBrush').tap();assert.equal(await page.evaluate(()=>CQPaint.brushLocked),false);assert.equal(await page.evaluate(()=>CQPaint.mode),'navigate');

      // Card out-and-back cancels, drop pays/cycles once, tap+tile also works.
      const relay=await cardButton(page,'relay'),relayStart=await centre(relay),relayTarget=await point(page,9,18),beforeCard=await economy(page);
      await touchPath(page,[relayStart,relayTarget,relayStart]);assert.deepEqual(await economy(page),beforeCard,'return to hand cancels without cycling');
      assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),false);
      await touchPath(page,[relayStart,relayTarget],async()=>{assert.deepEqual(await economy(page),beforeCard);assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),true);});
      const relayId=await page.evaluate(()=>CQPaint.game.buildings.find(b=>b.team===1&&b.type==='relay').id);
      assert.equal(await page.evaluate(()=>CQPaint.game.pigment[1]),beforeCard.money-12);
      assert.equal(await page.evaluate(()=>CQPaint.game.hands[1][0]),'bastion');assert.match(await page.locator('#paintNext').textContent(),/Vague/);
      const played=await economy(page);
      await page.evaluate(()=>{const b=document.querySelector('[data-paint-card="0"]');b.dispatchEvent(new PointerEvent('click',{bubbles:true,detail:1,pointerType:'touch',pointerId:1}));b.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));});
      assert.deepEqual(await economy(page),played,'compatibility clicks cannot replay or cycle card');assert.equal(await page.evaluate(()=>CQPaint.mode),'navigate');
      await tapTile(page,9,18);assert.equal(await page.evaluate(()=>CQPaint.selectedProducer),relayId,'non-producer inspection');
      assert.match(await page.locator('#paintContextTitle').textContent(),/Relais/i);assert.equal(await page.locator('#paintProductionToggle').isVisible(),false);await page.locator('#paintProducerClose').tap();
      await cardTap(page,'barracks',8,19);
      const producerId=await page.evaluate(()=>CQPaint.game.buildings.find(b=>b.team===1&&b.type==='barracks').id);assert(producerId);
      await step(page,5.1);assert.equal(await page.evaluate(()=>CQPaint.game.getUnitCount(1)),1,'one real paid spawn');
      await page.waitForSelector('.paint-payment',{timeout:1500});
      assert.equal(await page.locator('.paint-payment').first().textContent(),'−6','actual spawn has visible payment feedback');
      await tapTile(page,8,19);assert.equal((await building(page,producerId)).productionPaused,false,'tap inspects without pause');
      assert.match(await page.locator('#paintContextMessage').textContent(),/5\s*s/);assert.match(await page.locator('#paintContextMessage').textContent(),/6\s*pigment/);
      assert.match(await page.locator('#paintOutflow').textContent(),/−1,2\/s prévu/,'automatic outflow is shown as a forecast');
      await page.locator('#paintProductionToggle').tap();assert.equal((await building(page,producerId)).productionPaused,true);
      const count=await page.evaluate(()=>CQPaint.game.getUnitCount(1));await step(page,6);assert.equal(await page.evaluate(()=>CQPaint.game.getUnitCount(1)),count);

      // A displaced action touch cannot become a tap through a late click.
      const toggle=await centre(page.locator('#paintProductionToggle'));
      await touchPath(page,[toggle,{x:toggle.x+30,y:toggle.y},toggle]);
      await page.evaluate(()=>document.getElementById('paintProductionToggle').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1})));
      assert.equal((await building(page,producerId)).productionPaused,true);
      await page.locator('#paintProductionToggle').focus();await page.keyboard.press('Enter');assert.equal((await building(page,producerId)).productionPaused,false,'keyboard remains available');
      await page.keyboard.press('Space');assert.equal((await building(page,producerId)).productionPaused,true,'Space activates the focused producer action');
      assert.equal(await page.evaluate(()=>CQPaint.paused),false,'Space on a button does not pause the whole combat');
      await page.keyboard.press('Space');assert.equal((await building(page,producerId)).productionPaused,false);
      await page.locator('#paintProducerClose').tap();
      const home=await point(page,8,19),destination=await point(page,9,16);
      await touchPath(page,[home,destination]);assert.deepEqual((await building(page,producerId)).flow,{x:9,y:16});
      assert.equal(await page.evaluate(id=>CQPaint.game.units.filter(u=>u.producerId===id).every(u=>u.target.x===9&&u.target.y===16),producerId),true);
      await step(page,1);await page.locator('#paintProducerClose').tap();await touchPath(page,[home,destination,home]);
      assert.deepEqual((await building(page,producerId)).flow,{x:8,y:19},'drag back recalls');
      assert.equal((await building(page,producerId)).flowMode,'defend');
      assert.equal(await page.evaluate(id=>CQPaint.game.units.filter(u=>u.producerId===id).every(u=>u.retreating),producerId),true,'recall emits a true retreat');
      assert.equal((await building(page,producerId)).productionPaused,false,'recall keeps production running');
      await page.screenshot({path:`/tmp/colorquest-v071-flow-${viewport.width}.png`});await page.locator('#paintProducerClose').tap();

      // Invalid card target stays correctable; aiming freezes auto spending.
      await cardTap(page,'extractor',9,21);assert.equal(await page.evaluate(()=>CQPaint.mode),'card');assert.equal(await page.evaluate(()=>CQPaint.preview.ok),false);
      const heldCount=await page.evaluate(()=>CQPaint.game.getUnitCount(1));await step(page,7);
      assert.equal(await page.evaluate(()=>CQPaint.game.getUnitCount(1)),heldCount);assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),true);
      await page.locator('#paintCancel').tap();await step(page,5.1);assert(await page.evaluate(()=>CQPaint.game.getUnitCount(1))>heldCount);

      // A second finger cancels aiming; neither lift may commit after zoom.
      await page.waitForTimeout(350);await page.locator('#paintBrush').tap();
      const a=await point(page,9,16),b=await point(page,11,16),snapshot=await economy(page),flows=await page.evaluate(()=>CQPaint.game.getProducers(1).map(p=>p.flow));
      const cdp=await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1},{...b,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x-30,y:a.y,id:1},{x:b.x+30,y:b.y,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:a.x-30,y:a.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      assert.equal(await page.evaluate(()=>CQPaint.mode),'navigate');assert.equal(await page.evaluate(()=>CQPaint.preview),null);assert(await page.evaluate(()=>CQPaint.zoom)>1);
      assert.deepEqual(await economy(page),snapshot,'pinch cannot spend or paint');assert.deepEqual(await page.evaluate(()=>CQPaint.game.getProducers(1).map(p=>p.flow)),flows);assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),false);
      while(await page.locator('#paintZoomOut').isEnabled())await page.locator('#paintZoomOut').tap();
      await(await cardButton(page,'extractor')).tap();await touchPath(page,[await point(page,10,22)],null,true);
      assert.equal(await page.evaluate(()=>CQPaint.mode),'navigate');assert.equal(await page.evaluate(()=>CQPaint.game.spendingHeld[1]),false);

      // Real clock: equal untouched camps get overtime, then a draw.
      await fresh(page);await step(page,240);assert.equal(await page.evaluate(()=>CQPaint.game.winner),null);
      assert.match(await page.locator('#paintHold').textContent(),/prolongation|écart/i);
      await step(page,30);await page.waitForSelector('#paintAgain');assert.equal(await page.evaluate(()=>CQPaint.game.time),270);assert.equal(await page.evaluate(()=>CQPaint.game.winner),0);
      await page.locator('#paintAgain').tap();assert.equal(await page.evaluate(()=>CQPaint.game.winner),null);assert.equal(await page.evaluate(()=>CQPaint.paused),false);
      // A real AI match also reaches terminal UI and replay, without a winner fixture.
      await fresh(page);await step(page,270,true);await page.waitForSelector('#paintAgain');assert.equal(await page.evaluate(()=>CQPaint.game.winner),2);
      await page.locator('#paintAgain').tap();assert.equal(await page.evaluate(()=>CQPaint.game.winner),null);assert.deepEqual(errors,[]);
      console.log('PASS V0.7.1 touch release/partial/cancel/lock, cards, inspection/pause, flow/retreat, spending hold, pinch, keyboard/dedup, overtime and real-AI replay',viewport.width+'x'+viewport.height);
      await page.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
