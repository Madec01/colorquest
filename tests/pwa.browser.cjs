/* node tests/pwa.browser.cjs — HTTP subpath, offline, install UI and safe update. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let release = 1, failAsset = false;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ogg': 'audio/ogg' };
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (!url.pathname.startsWith('/colorquest/')) { response.writeHead(404).end(); return; }
  let name = decodeURIComponent(url.pathname.slice('/colorquest/'.length)) || 'index.html';
  if (name.includes('..') || (failAsset && name === 'assets/audio/select_001.ogg')) { response.writeHead(404).end(); return; }
  const file = path.join(root, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
  let body = fs.readFileSync(file);
  if (name === 'sw.js') body = Buffer.from(body.toString().replace(/COLORQUEST_V03_[^']+/, 'COLORQUEST_V03_TEST_' + release));
  if (name === 'index.html') body = Buffer.from(body.toString().replace('</head>', '<meta name="pwa-test-release" content="' + release + '"></head>'));
  response.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  response.end(body);
});

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
  assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.orientation, 'portrait');
  for (const icon of manifest.icons) {
    const png = fs.readFileSync(path.join(root, icon.src));
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), height);
  }
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const files = [...sw.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  files.forEach(file => assert(fs.existsSync(path.join(root, file === './' ? 'index.html' : file)), 'Missing precached file: ' + file));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const url = origin + '/colorquest/';
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => window.CQInstall?.offlineReady === true);
    assert.equal(await page.evaluate(async () => new URL((await navigator.serviceWorker.getRegistration()).scope).pathname), '/colorquest/');
    assert.match(await page.locator('#offlineStatus').innerText(), /Prêt à jouer hors ligne/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    // One-time browser prompt: never prompt on load, never claim installation from acceptance alone.
    await page.evaluate(() => {
      window.__installCalls = 0;
      const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = async () => { window.__installCalls++; return { outcome: 'accepted' }; };
      dispatchEvent(event);
    });
    assert.equal(await page.evaluate(() => window.__installCalls), 0);
    await page.locator('#installGame').tap();
    assert.equal(await page.evaluate(() => window.__installCalls), 1);
    assert.equal(await page.evaluate(() => CQInstall.installed), false);
    await page.locator('#installHelpDone').tap();
    await page.evaluate(() => dispatchEvent(new Event('appinstalled')));
    assert.equal(await page.locator('#installGame').isVisible(), false);

    // New release waits. Cancel keeps the running match; confirmation reloads the full new release.
    await page.evaluate(async () => (await caches.open('another-app-cache')).put('/other', new Response('keep')));
    release = 2;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.locator('#updateGame').waitFor({ state: 'visible' });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()).waiting);
    assert.equal(await page.locator('meta[name="pwa-test-release"]').getAttribute('content'), '1');
    await page.locator('#play').tap();
    await page.evaluate(() => CQInstall.showUpdate());
    assert.equal(await page.evaluate(() => paused), true, JSON.stringify(await page.evaluate(() => ({ playing, paused, ended, dialogOpen: document.getElementById('installDialog').open, modalHidden: document.getElementById('modal').classList.contains('hidden') }))) + ' errors=' + JSON.stringify(errors));
    await page.locator('#cancelGameUpdate').tap();
    await page.waitForFunction(() => !paused);
    assert.equal(await page.evaluate(() => paused), false);
    assert.equal(await page.evaluate(() => playing), true);
    await page.evaluate(() => CQInstall.showUpdate());
    await Promise.all([page.waitForNavigation(), page.locator('#confirmGameUpdate').tap()]);
    await page.waitForFunction(() => CQInstall.offlineReady === true);
    assert.equal(await page.locator('meta[name="pwa-test-release"]').getAttribute('content'), '2');
    const names = await page.evaluate(() => caches.keys());
    assert(names.includes('another-app-cache'), 'Update must preserve other apps on this origin');
    assert.equal(names.filter(name => name.startsWith('colorquest:/colorquest/:')).length, 1);

    // A cold navigation with the network disabled still loads the whole game and local audio.
    await context.setOffline(true);
    await page.goto(url + '?offline=1');
    await page.waitForFunction(() => CQInstall.offlineReady === true);
    await page.locator('#play').tap();
    assert.equal(await page.evaluate(() => playing && !!game && !!CQEngine), true);
    assert.equal(await page.evaluate(async () => (await fetch('assets/audio/select_001.ogg')).status), 200);
    assert.deepEqual(errors, []);
    await context.close();

    const ios = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
    await ios.addInitScript(() => addEventListener('beforeinstallprompt', event => { event.preventDefault(); event.stopImmediatePropagation(); }));
    const iphone = await ios.newPage();
    await iphone.goto(url); await iphone.locator('#installGame').tap();
    assert.match(await iphone.locator('#installDialog').innerText(), /Safari/);
    assert.match(await iphone.locator('#installDialog').innerText(), /écran d’accueil/);
    assert.match(await iphone.locator('#installDialog').innerText(), /n’est pas encore sauvegardée/);
    assert.equal(await iphone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await ios.close();

    const standaloneContext = await browser.newContext();
    await standaloneContext.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    const installedPage = await standaloneContext.newPage();
    await installedPage.goto(url);
    assert.equal(await installedPage.locator('#installGame').isVisible(), false);
    await standaloneContext.close();

    // A failed asset must not produce a false "ready offline" success.
    failAsset = true;
    const broken = await browser.newContext(), brokenPage = await broken.newPage();
    await brokenPage.goto(url);
    await brokenPage.waitForFunction(() => document.getElementById('offlineStatus').textContent.includes('indisponible'));
    assert.equal(await brokenPage.evaluate(() => CQInstall.offlineReady), false);
    await broken.close(); failAsset = false;

    const local = await browser.newPage();
    const localErrors = []; local.on('pageerror', error => localErrors.push(error.message));
    await local.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await local.locator('#installGame').click();
    assert.match(await local.locator('#installDialog').innerText(), /fichier HTML local/);
    assert.deepEqual(localErrors, []);
    await local.close();
    console.log('PWA: assets, scoped cache, offline launch, deferred prompt, iOS guide, standalone, safe updates, failed precache and file:// all passed.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
