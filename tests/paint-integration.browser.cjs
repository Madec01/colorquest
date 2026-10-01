/* V0.7 integration only: classic isolation, ephemeral sessions, palette and PWA. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
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
  let body = fs.readFileSync(file);
  if (relative === 'sw.js') body = Buffer.from(body.toString().replace(/COLORQUEST_V\d+_[^']+/, 'COLORQUEST_V07_INTEGRATION_' + release));
  if (relative === 'index.html') body = Buffer.from(body.toString().replace('</head>', '<meta name="paint-test-release" content="' + release + '"></head>'));
  response.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'}).end(body);
});

async function storedClassics(page) {
  return page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), classicKeys);
}

async function makeClassicCheckpoints(page) {
  // These are authentic engine/session checkpoints, not invented localStorage blobs.
  await page.locator('#play').tap();
  await page.evaluate(() => {
    game.recruit(1, 'fighter');
    for (let i = 0; i < 17; i++) game.update(.1);
    if (!paused) togglePause();
    CQCamera.focus(16, 33, 2.2);
    if (!CQSave.save().ok) throw Error('Could not save classic free match');
    returnToMenu();
  });
  await page.locator('#campaignOpen').tap();
  await page.locator('[data-campaign-mission="first-ink"]').tap();
  await page.evaluate(() => {
    const t = game.tiles.find(t => game.canBuild(1, 'relay', t.x, t.y).ok);
    if (!t || !game.build(1, 'relay', t.x, t.y).ok) throw Error('Could not develop the classic campaign fixture');
    for (let i = 0; i < 17; i++) game.update(.1);
    if (!paused) togglePause();
    if (!CQSave.save().ok) throw Error('Could not save classic campaign');
    returnToMenu();
    // A valid earned-prefix fixture ensures prototype entry cannot erase unlocks.
    localStorage.setItem('colorquest.campaign.progress.v1', JSON.stringify({format:'colorquest-campaign-progress',version:1,completed:['first-ink','source']}));
    CQCampaign.refreshMenu();
  });
  return storedClassics(page);
}

async function enterPrototype(page) {
  await page.locator('#paintStart').tap();
  if (await page.locator('#paintBegin').isVisible()) await page.locator('#paintBegin').tap();
  await page.waitForFunction(() => CQPaint.active && !CQPaint.paused && CQPaint.game);
}

async function assertClassicsUnchanged(page, expected, detail) {
  assert.deepEqual(await storedClassics(page), expected, detail);
}

async function twoFrames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/colorquest/`;
  let browser;
  try {
    browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});
    for (const viewport of [{width:390,height:844},{width:360,height:640}]) {
      const context = await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => window.CQPaint && window.CQPaintEngine && window.CQPaintRenderer);
      assert.equal(await page.locator('#paintResume').isVisible(), false, 'a fresh page must not promise a persistent prototype checkpoint');
      const classics = await makeClassicCheckpoints(page);
      assert.equal(await page.locator('#continueGame').isVisible(), true);
      assert.equal(await page.locator('#campaignResume').isVisible(), true);
      await page.locator('[data-palette="violet"]').tap();
      const classicEngine = await page.evaluate(() => CQSnapshot.capture(game));
      await enterPrototype(page);
      assert.equal(await page.evaluate(() => playing), false, 'the classical frame loop stays inactive in the prototype');
      assert.equal(await page.evaluate(() => CQPaint.game instanceof CQPaintEngine.Game), true);
      assert.equal(await page.evaluate(() => CQPaint.game === game), false, 'the controller never replaces the classic game global');
      assert.equal(await page.evaluate(() => CQPalette.key), 'violet', 'prototype inherits the selected camp palette');
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--player-color').trim() === CQPalette.current.player), true);
      const paintedPalette = await page.evaluate(async () => {
        const context = document.getElementById('paintCanvas').getContext('2d');
        const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
        const fills = new Set();
        Object.defineProperty(context, 'fillStyle', {configurable:true,get(){return descriptor.get.call(this);},set(value){fills.add(value);descriptor.set.call(this,value);}});
        try {
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return {fills:[...fills], expected:CQPalette.current.playerFill};
        } finally {delete context.fillStyle;}
      });
      assert(paintedPalette.fills.includes(paintedPalette.expected), 'the actual prototype canvas uses the selected camp colour');
      await assertClassicsUnchanged(page, classics, 'prototype start preserves both classic checkpoints and campaign progress byte for byte');
      const runningTime = await page.evaluate(() => CQPaint.game.time);
      await page.waitForFunction(t => CQPaint.game.time > t, runningTime);

      // Explicit pause, install help and the browser background must all freeze the actual match.
      await page.locator('#paintPause').tap();
      assert.equal(await page.evaluate(() => CQPaint.paused), true);
      assert.match(await page.locator('#paintSessionNotice').innerText(), /fenêtre|onglet/i);
      assert.match(await page.locator('#paintSessionNotice').innerText(), /recharg|ferm/i);
      const pausedTime = await page.evaluate(() => CQPaint.game.time);
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => CQPaint.game.time), pausedTime);
      await page.evaluate(() => CQInstall.showHelp());
      assert.match(await page.locator('#installDialog').innerText(), /prototype/i);
      assert.match(await page.locator('#installDialog').innerText(), /recharg|ferm/i);
      await page.locator('#installHelpDone').tap();
      assert.equal(await page.evaluate(() => CQPaint.paused), true, 'closing install help must preserve an existing player pause');
      await page.locator('#paintContinue').tap();
      await page.waitForFunction(() => !CQPaint.paused);
      await page.evaluate(() => CQInstall.showHelp());
      assert.equal(await page.evaluate(() => CQPaint.paused), true, 'install instructions pause a running prototype');
      const installTime = await page.evaluate(() => CQPaint.game.time);
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => CQPaint.game.time), installTime);
      await page.locator('#installHelpDone').tap();
      await page.waitForFunction(() => !CQPaint.paused);

      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await page.evaluate(() => CQPaint.paused), true, 'backgrounding pauses the prototype');
      const backgroundTime = await page.evaluate(() => CQPaint.game.time);
      await page.waitForTimeout(850);
      assert.equal(await page.evaluate(() => CQPaint.game.time), backgroundTime, 'background time never advances the engine');
      await page.evaluate(() => {delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.evaluate(() => CQPaint.paused), true, 'returning to the foreground waits for explicit resume');
      await page.locator('#paintContinue').tap();
      await twoFrames(page);
      assert(await page.evaluate(t => CQPaint.game.time - t < .3, backgroundTime), 'resuming never simulates the time spent away');
      await page.evaluate(() => dispatchEvent(new Event('pagehide')));
      assert.equal(await page.evaluate(() => CQPaint.paused), true, 'pagehide also freezes the match');
      await page.evaluate(() => CQPaint.showMenu());
      assert.equal(await page.evaluate(() => CQPaint.active), false);
      assert.equal(await page.evaluate(() => CQPaint.hasMatch), true);
      assert.equal(await page.locator('#paintResume').isVisible(), true, 'a paused in-memory match is resumable in the same document');
      await assertClassicsUnchanged(page, classics, 'pauses, install help, background and menu never write to classic storage');
      assert.deepEqual(await page.evaluate(() => CQSnapshot.capture(game)), classicEngine, 'classic simulation stays frozen throughout prototype play');
      const menuTime = await page.evaluate(() => CQPaint.game.time);
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(() => CQPaint.game.time), menuTime);
      await page.locator('#paintResume').tap();
      assert.equal(await page.evaluate(() => CQPaint.game.time), menuTime, 'session resume preserves the same combat');
      assert.equal(await page.evaluate(() => CQPaint.paused), true, 'session resume opens paused');
      await page.evaluate(() => CQPaint.showMenu());
      await page.reload();
      assert.equal(await page.evaluate(() => CQPaint.hasMatch), false, 'prototype does not invent persistence across reload');
      assert.equal(await page.locator('#paintResume').isVisible(), false);
      await assertClassicsUnchanged(page, classics, 'reloading the prototype leaves authentic classic saves intact');
      assert.equal(await page.evaluate(() => CQPalette.key), 'violet', 'the shared palette survives a reload');

      // Re-enter both historical paths through their visible menu controls.
      await page.locator('#continueGame').tap();
      assert.equal(await page.evaluate(() => paused), true);
      assert.equal(await page.evaluate(() => CQPaint.active), false);
      assert.deepEqual(await page.evaluate(() => CQSnapshot.capture(game)), JSON.parse(classics[classicKeys[0]]).snapshot);
      await page.evaluate(() => returnToMenu());
      await page.locator('#campaignResume').tap();
      assert.equal(await page.evaluate(() => paused), true);
      assert.deepEqual(await page.evaluate(() => CQSnapshot.capture(game)), JSON.parse(classics[classicKeys[1]]).snapshot);
      assert.equal(await page.evaluate(() => localStorage.getItem('colorquest.campaign.progress.v1')), classics[classicKeys[2]]);
      await page.evaluate(() => returnToMenu());
      await page.locator('#startTutorial').tap();
      assert.equal(await page.evaluate(() => CQTutorial.active), true);
      assert.equal(await page.evaluate(() => CQPaint.active), false);
      assert.equal(await page.evaluate(() => localStorage.getItem('colorquest.campaign.progress.v1')), classics[classicKeys[2]]);
      assert.deepEqual(errors, []);
      console.log(`PASS paint integration ${viewport.width}x${viewport.height}: exact classic isolation, background/no catch-up, session-only resume, shared palette, installation pause and classic/campaign/tutorial re-entry.`);
      await context.close();
    }

    // The actual service worker must cache every new module, and a waiting update
    // must be explicit about discarding the unsaved prototype before reloading.
    const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => CQInstall.offlineReady && navigator.serviceWorker.controller);
    const classics = await makeClassicCheckpoints(page);
    await enterPrototype(page);
    release = 2;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
    const beforeUpdate = await page.evaluate(() => CQPaint.game.time);
    await page.waitForTimeout(150);
    assert(await page.evaluate(t => CQPaint.game.time > t, beforeUpdate), 'a waiting update never pauses or reloads combat by itself');
    assert.equal(await page.locator('meta[name="paint-test-release"]').getAttribute('content'), '1');
    await page.evaluate(() => CQInstall.showUpdate());
    assert.equal(await page.evaluate(() => CQPaint.paused), true);
    const warning = await page.locator('#installDialog').innerText();
    assert.match(warning, /prototype/i);
    assert.match(warning, /perd|effac|abandonn|recommenc/i, 'the update must clearly announce loss of an in-memory prototype');
    const pausedUpdateTime = await page.evaluate(() => CQPaint.game.time);
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => CQPaint.game.time), pausedUpdateTime);
    await page.locator('#cancelGameUpdate').tap();
    await page.waitForFunction(() => !CQPaint.paused);
    await assertClassicsUnchanged(page, classics, 'canceling an update keeps classical saves unchanged');
    await page.evaluate(() => {CQPaint.showMenu(); CQInstall.showUpdate();});
    assert.match(await page.locator('#installDialog').innerText(), /prototype/i, 'a prototype left in memory at the menu also receives the reload-loss warning');
    await Promise.all([page.waitForNavigation(), page.locator('#confirmGameUpdate').tap()]);
    await page.waitForFunction(() => CQInstall.offlineReady && window.CQPaint);
    assert.equal(await page.locator('meta[name="paint-test-release"]').getAttribute('content'), '2');
    assert.equal(await page.evaluate(() => CQPaint.hasMatch), false);
    await assertClassicsUnchanged(page, classics, 'the accepted update preserves both existing classic slots and progression');
    await context.setOffline(true);
    await page.goto(url + '?paint-offline=1');
    await page.waitForFunction(() => CQInstall.offlineReady && window.CQPaintEngine && window.CQPaintAI && window.CQPaintRenderer && window.CQPaint);
    await enterPrototype(page);
    const offlineTime = await page.evaluate(() => CQPaint.game.time);
    await page.waitForFunction(t => CQPaint.game.time > t, offlineTime);
    assert.equal(await page.evaluate(async () => (await fetch('assets/audio/select_001.ogg')).status), 200);
    await assertClassicsUnchanged(page, classics, 'offline prototype play also preserves classic saves');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS paint PWA: new modules load offline, waiting update stays passive, dialog freezes/resumes prototype, explicit reload-loss warning and intact classic saves.');

    const local = await browser.newPage({viewport:{width:360,height:640},isMobile:true,hasTouch:true});
    const localErrors = []; local.on('pageerror', error => localErrors.push(error.message));
    await local.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await enterPrototype(local);
    assert.equal(await local.evaluate(() => CQPaint.active && CQPaint.game.duration === 240), true);
    assert.deepEqual(localErrors, []);
    await local.close();
    console.log('PASS paint file://: autonomous prototype starts without an HTTP server.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error);server.close();process.exitCode=1;});
