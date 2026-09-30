/* Resume real matches through reload, menu, lifecycle events and storage failures. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ogg':'audio/ogg'};
const server = http.createServer((req,res) => {
  let file = new URL(req.url,'http://localhost').pathname.replace(/^\/colorquest\//,'') || 'index.html';
  if (file.includes('..') || file.startsWith('/')) {res.writeHead(404).end();return;}
  file = path.join(root,file);
  if(!fs.existsSync(file) || !fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(fs.readFileSync(file));
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/colorquest/`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    for(const viewport of [{width:390,height:844},{width:360,height:640}]){
      const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'});
      const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto(url);await p.locator('[data-palette="violet"]').tap();await p.locator('#play').tap();
      // Use engine actions to create technology, specialists, a partial queue and live orders.
      await p.evaluate(()=>{
        game.money[1]=1500;
        game.upgradeBuilding(1,game.getCore(1).id);game.chooseSpecialization(1,'mobility');
        game.recruit(1,'engineer');game.recruit(1,'fighter');game.recruit(1,'scout');
        game.setRally(1,16,36);
        const ids=game.units.filter(u=>u.team===1&&u.type==='fighter').map(u=>u.id);
        game.assignSquad(1,0,ids);game.command(1,ids,'attack',14,37);selection=ids;
        for(let i=0;i<16;i++)game.update(.1);
        CQCamera.focus(16,35,2.6);
      });
      await p.locator('#back').tap();
      assert.match(await p.locator('#savePauseStatus').innerText(),/Partie sauvegardée/);
      const expected=await p.evaluate(()=>({snapshot:CQSnapshot.capture(game),camera:CQCamera.capture(),selection:[...selection],id:JSON.parse(localStorage.getItem(CQSave.KEY)).id}));
      await p.reload();assert.equal(await p.locator('#continueGame').isVisible(),true);
      assert.equal(await p.evaluate(()=>CQPalette.key),'violet');
      await p.locator('#continueGame').tap();
      assert.equal(await p.evaluate(()=>paused),true);
      assert.deepEqual(await p.evaluate(()=>CQSnapshot.capture(game)),expected.snapshot,'all game state restored without simulating absence');
      assert.deepEqual(await p.evaluate(()=>CQCamera.capture()),expected.camera,'camera restored');
      assert.deepEqual(await p.evaluate(()=>selection),expected.selection,'selection restored');
      await p.waitForTimeout(200);
      assert.equal(await p.evaluate(()=>game.time),expected.snapshot.state.time,'resume waits for player');
      await p.locator('#pauseFlag').tap();await p.waitForFunction(t=>game.time>t,expected.snapshot.state.time);
      // Periodic saving captures current state without requiring the player to open a menu.
      const previousSave=await p.evaluate(()=>CQSave.lastSavedAt);
      await p.evaluate(()=>{for(let i=0;i<110;i++)game.update(.1)});
      await p.waitForFunction(t=>CQSave.lastSavedAt>t,previousSave);
      await p.evaluate(()=>{
        Object.defineProperty(document,'hidden',{configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await p.evaluate(()=>paused),true,'app switch pauses');
      assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem(CQSave.KEY)).snapshot.state.time===game.time),true,'app switch flushes');
      await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
      assert.equal(await p.evaluate(()=>paused),true,'foreground never resumes automatically');
      await p.locator('#back').tap();await p.locator('#exit').tap();
      assert.equal(await p.locator('#continueGame').isVisible(),true);
      const raw=await p.evaluate(()=>localStorage.getItem(CQSave.KEY));
      await p.locator('#play').tap();await p.locator('#newGameCancel').tap();
      assert.equal(await p.evaluate(()=>localStorage.getItem(CQSave.KEY)),raw,'cancelling new match preserves save');
      await p.locator('#startTutorial').tap();
      await p.evaluate(()=>{for(let i=0;i<110;i++)game.update(.1);CQSave.tick();dispatchEvent(new Event('pagehide'))});
      assert.equal(await p.evaluate(()=>localStorage.getItem(CQSave.KEY)),raw,'tutorial does not replace saved match');
      await p.locator('#back').tap();await p.locator('#exit').tap();await p.locator('#continueGame').tap();
      assert.equal(await p.evaluate(()=>game.specializations[1]),'mobility');
      // Resumed queues progress exactly once and refunds remain usable.
      const waiting=await p.evaluate(()=>game.queues[1][1]?.id);
      if(waiting){assert.equal(await p.evaluate(id=>game.cancelRecruit(1,id).ok,waiting),true);}
      await p.locator('#back').tap();await p.locator('#exit').tap();await p.locator('#play').tap();await p.locator('#newGameConfirm').tap();
      assert.equal(await p.evaluate(()=>game.specializations[1]),null);
      assert.notEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem(CQSave.KEY)).id),expected.id);
      await p.evaluate(()=>{game.winner=1;game.winReason='Domination territoriale'});
      await p.locator('#endMenu').tap();assert.equal(await p.locator('#continueGame').isVisible(),false,'finished matches cannot be resumed');
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
      console.log(`PASS session ${viewport.width}x${viewport.height}: full resume, camera/palette, pause, periodic/background save, confirmation, tutorial isolation, queues and completion.`);
      await context.close();
    }
    const context=await browser.newContext({serviceWorkers:'block'}),p=await context.newPage();
    await p.goto(url);await p.locator('#play').click();await p.locator('#pause').click();
    const good=await p.evaluate(()=>localStorage.getItem(CQSave.KEY));
    await p.evaluate(()=>{
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===CQSave.KEY)throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value)};
      game.money[1]+=20;
    });
    await p.locator('#back').click();assert.match(await p.locator('#savePauseStatus').innerText(),/Sauvegarde impossible/);
    assert.equal(await p.evaluate(()=>localStorage.getItem(CQSave.KEY)),good,'failed write preserves previous save');
    await p.locator('#exit').click();assert.equal(await p.evaluate(()=>playing),true,'failed save does not silently quit');
    await p.locator('#exitWithoutSave').click();await p.reload();await p.locator('#continueGame').click();
    assert.equal(await p.evaluate(()=>game.money[1]),JSON.parse(good).snapshot.state.money[1]);
    const second=await context.newPage();await second.goto(url);await second.locator('#continueGame').click();
    await p.waitForFunction(()=>CQSave.error.includes('autre fenêtre'));
    assert.equal(await p.evaluate(()=>paused),true);
    assert.equal(await p.evaluate(()=>CQSave.save().ok),false,'older open tab cannot overwrite resumed state');
    await second.evaluate(()=>{
      const changed=JSON.parse(localStorage.getItem(CQSave.KEY));changed.writer='another-window-before-event';
      changed.snapshot.state.money[1]+=99;localStorage.setItem(CQSave.KEY,JSON.stringify(changed));
    });
    assert.equal(await second.evaluate(()=>CQSave.save().ok),false,'owner check works even before a storage event is dispatched');
    assert.equal(await second.evaluate(()=>JSON.parse(localStorage.getItem(CQSave.KEY)).writer),'another-window-before-event');
    await second.close();await context.close();
    const corrupt=await browser.newContext({serviceWorkers:'block'}),bad=await corrupt.newPage();
    await bad.goto(url);await bad.evaluate(()=>localStorage.setItem(CQSave.KEY,'{broken'));await bad.reload();
    assert.equal(await bad.locator('#continueGame').isVisible(),false);
    assert.match(await bad.locator('#saveMenuStatus').innerText(),/illisible ou incompatible/);
    assert.equal(await bad.evaluate(()=>localStorage.getItem(CQSave.KEY)),'{broken');
    await bad.locator('#play').click();await bad.locator('#newGameConfirm').click();
    assert.equal(await bad.evaluate(()=>CQSave.read().status),'valid');await corrupt.close();
    const denied=await browser.newContext({serviceWorkers:'block'});
    await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}}));
    const no=await denied.newPage(),errors=[];no.on('pageerror',e=>errors.push(e.message));await no.goto(url);
    assert.match(await no.locator('#saveMenuStatus').innerText(),/indisponible/);
    await no.locator('#play').click();assert.equal(await no.evaluate(()=>playing),true);await no.locator('#back').click();
    assert.match(await no.locator('#savePauseStatus').innerText(),/Sauvegarde impossible/);assert.deepEqual(errors,[]);await denied.close();
    console.log('PASS session failures: atomic quota failure, safe exit, corrupt save retained, replacement confirmation, denied storage and multiple tabs.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
