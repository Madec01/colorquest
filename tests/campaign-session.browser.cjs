/* Two independent saves, real mission checkpoints and per-slot tab ownership. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ogg':'audio/ogg','.webmanifest':'application/manifest+json'};
const server = http.createServer((req,res) => {
  const relative = new URL(req.url, 'http://localhost').pathname.replace(/^\/colorquest\//, '') || 'index.html';
  if (relative.includes('..') || relative.startsWith('/')) {res.writeHead(404).end();return;}
  const file = path.join(root, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404).end();return;}
  res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/colorquest/`;
  const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});
  try {
    for (const viewport of [{width:390,height:844},{width:360,height:640}]) {
      const context = await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.locator('#play').tap();
      const free = await page.evaluate(() => {
        game.recruit(1, 'fighter');
        for (let i = 0; i < 17; i++) game.update(.1);
        if (!paused) togglePause();
        CQSave.save();
        const data = localStorage.getItem(CQSave.KEY);
        returnToMenu(); return data;
      });
      await page.locator('#campaignOpen').tap();
      await page.locator('[data-campaign-mission="first-ink"]').tap();
      assert.equal(await page.evaluate(() => CQSave.kind), 'campaign');
      assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.KEY)), free, 'starting a mission preserves the free match exactly');
      await page.evaluate(() => {
        const t = game.tiles.filter(t => game.canBuild(1, 'relay', t.x, t.y).ok).sort((a,b) => a.y-b.y)[0];
        if (!game.build(1, 'relay', t.x, t.y).ok) throw Error('relay construction failed');
        for (let i = 0; i < 17; i++) game.update(.1);
        CQCamera.focus(16, 33, 2.2);
      });
      await page.locator('#back').tap();
      assert.match(await page.locator('#savePauseStatus').innerText(), /Mission sauvegardée/);
      const expected = await page.evaluate(() => ({snapshot:CQSnapshot.capture(game),camera:CQCamera.capture()}));
      await page.reload();
      assert.equal(await page.locator('#campaignResume').isVisible(), true);
      assert.equal(await page.locator('#continueGame').isVisible(), true);
      await page.locator('#campaignResume').tap();
      assert.equal(await page.evaluate(() => paused), true);
      assert.equal(await page.evaluate(() => CQSave.kind), 'campaign');
      assert.deepEqual(await page.evaluate(() => CQSnapshot.capture(game)), expected.snapshot);
      assert.deepEqual(await page.evaluate(() => CQCamera.capture()), expected.camera);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => game.time), expected.snapshot.state.time, 'no absent time is simulated');
      assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.KEY)), free);
      // Background saving, old exercises and switching modes preserve the other slot.
      await page.evaluate(() => {
        if (paused) togglePause();
        Object.defineProperty(document, 'hidden', {configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await page.evaluate(() => paused), true);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(CQSave.CAMPAIGN_KEY)).snapshot.state.time === game.time), true);
      await page.evaluate(() => {delete document.hidden; returnToMenu();});
      const campaignRaw = await page.evaluate(() => localStorage.getItem(CQSave.CAMPAIGN_KEY));
      await page.locator('#startTutorial').tap();
      await page.evaluate(() => {for(let i=0;i<30;i++)game.update(.1);CQSave.tick();dispatchEvent(new Event('pagehide'));});
      assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.CAMPAIGN_KEY)), campaignRaw);
      assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.KEY)), free);
      await page.evaluate(() => returnToMenu());
      await page.locator('#continueGame').tap();
      assert.equal(await page.evaluate(() => game.mission), null);
      assert.equal(await page.evaluate(() => CQSave.kind), 'free');
      assert.deepEqual(await page.evaluate(() => CQSnapshot.capture(game)), JSON.parse(free).snapshot);
      assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.CAMPAIGN_KEY)), campaignRaw);
      await page.evaluate(() => returnToMenu());
      const preservedFree = await page.evaluate(() => localStorage.getItem(CQSave.KEY));
      await page.evaluate(() => startMission('first-ink'));
      assert.match(await page.locator('#modalContent').innerText(), /Remplacer la mission/);
      await page.locator('#newGameCancel').tap();
      assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.CAMPAIGN_KEY)), campaignRaw);
      await page.evaluate(() => startMission('first-ink'));
      await page.locator('#newGameConfirm').tap();
      assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.KEY)), preservedFree);
      assert.notEqual(await page.evaluate(() => JSON.parse(localStorage.getItem(CQSave.CAMPAIGN_KEY)).id), JSON.parse(campaignRaw).id);
      // Defeat clears this mission without deleting free play or earned unlocks.
      await page.evaluate(() => {game.getCore(1).hp=0;game.update(.1);});
      await page.waitForFunction(() => localStorage.getItem(CQSave.CAMPAIGN_KEY) === null);
      assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.KEY)), preservedFree);
      const production = await page.evaluate(() => {
        startMission('outpost', {replace:true});
        game.money[1] = 500;
        const t = game.tiles.find(t => game.canBuild(1, 'barracks', t.x, t.y).ok);
        const built = game.build(1, 'barracks', t.x, t.y);
        if (!built.ok) throw Error('barracks construction failed');
        game.recruit(1, 'fighter', built.id); game.recruit(1, 'fighter', built.id); game.recruit(1, 'fighter');
        for (let i = 0; i < 17; i++) game.update(.1);
        CQStrategy.setRecruitSource(built.id);
        if (!paused) togglePause(); CQSave.save();
        return {id:built.id,snapshot:CQSnapshot.capture(game),queue:game.getRecruitQueue(1,built.id)};
      });
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(CQSave.CAMPAIGN_KEY)).ui.recruitSource), production.id);
      await page.reload(); await page.locator('#campaignResume').tap();
      assert.equal(await page.evaluate(() => CQStrategy.getRecruitSource()), production.id, 'the selected barracks remains the active producer after reloading');
      assert.equal(await page.locator('#strategyQuickProducer').inputValue(), String(production.id));
      assert.deepEqual(await page.evaluate(id => game.getRecruitQueue(1,id), production.id), production.queue, 'its visible queue resumes with the same partial progress');
      assert.deepEqual(await page.evaluate(() => CQSnapshot.capture(game)), production.snapshot);
      assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.KEY)), preservedFree);
      const sourceChecks = await page.evaluate(() => {
        returnToMenu();
        const raw = localStorage.getItem(CQSave.CAMPAIGN_KEY), baseline = JSON.parse(raw);
        const core = baseline.snapshot.state.buildings.find(b => b.team === 1 && b.type === 'core').id;
        const enemy = baseline.snapshot.state.buildings.find(b => b.team === 2 && b.type === 'core').id;
        const checks = [];
        for (const value of [undefined, String(baseline.ui.recruitSource), 999999, enemy]) {
          const entry = JSON.parse(raw);
          if (value === undefined) delete entry.ui.recruitSource; else entry.ui.recruitSource = value;
          const encoded = JSON.stringify(entry); localStorage.setItem(CQSave.CAMPAIGN_KEY, encoded);
          const read = CQSave.read('campaign');
          checks.push(read.status === 'valid' && read.entry.ui.recruitSource === core && localStorage.getItem(CQSave.CAMPAIGN_KEY) === encoded);
        }
        const removed = JSON.parse(raw);
        removed.snapshot.state.buildings = removed.snapshot.state.buildings.filter(b => b.id !== removed.ui.recruitSource);
        localStorage.setItem(CQSave.CAMPAIGN_KEY, JSON.stringify(removed));
        checks.push(CQSave.read('campaign').entry.ui.recruitSource === core);
        localStorage.setItem(CQSave.CAMPAIGN_KEY, raw);
        return checks;
      });
      assert.deepEqual(sourceChecks, [true,true,true,true,true], 'old, noninteger, missing, enemy and destroyed producer IDs fall back to the core without rewriting storage');
      assert.deepEqual(errors, []);
      console.log(`PASS campaign save ${viewport.width}x${viewport.height}: independent slots, exact paused checkpoint, camera, active barracks/queue, producer fallbacks, background, tutorial isolation, replacement and completion.`);
      await context.close();
    }

    const context = await browser.newContext({serviceWorkers:'block'}), page = await context.newPage();
    await page.goto(url);
    await page.evaluate(() => {start();if(!paused)togglePause();returnToMenu();startMission('first-ink');if(!paused)togglePause();returnToMenu();CQSave.resume('free');togglePause();});
    const second = await context.newPage(); await second.goto(url);
    await second.evaluate(() => CQSave.resume('campaign'));
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => paused), false, 'campaign takeover cannot pause or invalidate a live free match');
    assert.equal(await page.evaluate(() => CQSave.error), '');
    await page.evaluate(() => {togglePause();returnToMenu();CQSave.resume('campaign');});
    await second.waitForFunction(() => CQSave.error.includes('autre fenêtre'));
    assert.equal(await second.evaluate(() => CQSave.save().ok), false, 'old campaign tab cannot overwrite a resumed mission');
    const free = await page.evaluate(() => localStorage.getItem(CQSave.KEY));
    const checkpoint = await page.evaluate(() => localStorage.getItem(CQSave.CAMPAIGN_KEY));
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {if(key===CQSave.CAMPAIGN_KEY)throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};
      game.money[1]+=20;
    });
    assert.equal(await page.evaluate(() => CQSave.save().ok), false);
    assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.CAMPAIGN_KEY)), checkpoint, 'quota failure preserves the previous mission checkpoint');
    assert.equal(await page.evaluate(() => localStorage.getItem(CQSave.KEY)), free);
    await page.reload(); await page.evaluate(() => CQSave.resume('campaign'));
    assert.deepEqual(await page.evaluate(() => CQSnapshot.capture(game)), JSON.parse(checkpoint).snapshot);
    // A wrong-mode envelope must never migrate one slot into the other.
    await page.evaluate(() => {returnToMenu();localStorage.setItem(CQSave.CAMPAIGN_KEY,localStorage.getItem(CQSave.KEY));});
    assert.equal(await page.evaluate(() => CQSave.read('campaign').status), 'invalid');
    assert.equal(await page.evaluate(() => CQSave.read().status), 'valid');
    await context.close();
    console.log('PASS campaign save failures: independent tab ownership, stale writer blocked, atomic quota failure, stable reload and wrong-mode data retained.');
  } finally {await browser.close();await new Promise(resolve => server.close(resolve));}
})().catch(error => {console.error(error);server.close();process.exitCode=1;});
