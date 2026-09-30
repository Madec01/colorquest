/* Map choice, touch inspection and fog presentation; run node tests/world.browser.cjs. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

async function startSelected(page) {
  await page.locator('#play').tap();
  if (await page.locator('#newGameConfirm').isVisible()) await page.locator('#newGameConfirm').tap();
  await page.waitForFunction(() => playing && game);
}
async function tapTile(page, condition) {
  const point = await page.evaluate(condition => {
    const tile = game.tiles.find(new Function('tile', 'return ' + condition));
    if (!tile) throw new Error('No tile matching browser fixture');
    tile.explored = true; tile.visible = true; selection = []; CQCamera.focus(tile.x + .5, tile.y + .5, 3);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x + view.x + (tile.x + .5) * view.cell, y: rect.y + view.y + (tile.y + .5) * view.cell, tileX: tile.x, tileY: tile.y };
  }, condition);
  await page.touchscreen.tap(point.x, point.y);
  return point;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
      const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { localStorage.setItem('colorquest.v03.discovered', '1'); });
      await page.goto(url);
      await page.waitForFunction(() => window.CQWorldUI && window.CQMaps);
      assert.equal(await page.evaluate(() => CQWorldUI.selectedId), 'plain');
      assert.equal(await page.evaluate(() => CQWorldUI.selectMap('unknown')), false);
      assert.equal(await page.evaluate(() => CQWorldUI.selectMap('legacy')), false, 'legacy is reserved for prior saves/tutorial');
      for (const id of ['plain', 'lanes', 'crossroads']) {
        await page.locator('#worldMapPicker').tap();
        assert.equal(await page.locator('[data-world-map]').count(), 3);
        for (const option of await page.locator('[data-world-map]').all()) {
          const rect = await option.boundingBox(); assert.ok(rect.width >= 44 && rect.height >= 44, 'map options are touch-sized');
        }
        if (id === 'plain') await page.screenshot({ path: `/tmp/colorquest-v05-map-picker-${viewport.width}.png` });
        await page.locator(`[data-world-map="${id}"]`).tap();
        assert.equal(await page.evaluate(() => CQWorldUI.selectedId), id);
        assert.equal(await page.evaluate(() => CQWorldUI.isOpen), false);
        await startSelected(page);
        assert.equal(await page.evaluate(() => game.mapId), id, 'menu choice launches the actual map');
        assert.equal(await page.locator('#worldMapName').textContent(), await page.evaluate(id => CQMaps.get(id).name, id));
        assert.equal(await page.evaluate(id => {
          const layout = CQMaps.createLayout(id);
          return game.tiles.every((tile, index) => ['terrain', 'rich', 'blocked', 'source'].every(key => tile[key] === layout[index][key]));
        }, id), true, 'selected map is the shared preview layout');
        await page.evaluate(() => { if (!paused) togglePause(); });
        await page.locator('#worldLegendOpen').tap();
        assert.equal(await page.evaluate(() => paused), true, 'opening legend preserves an existing pause');
        assert.equal(await page.locator('#worldLiveLabel').textContent(), 'La partie est en pause');
        await page.locator('#worldClose').tap();
        assert.equal(await page.evaluate(() => paused), true, 'closing legend does not resume a paused match');
        if (id !== 'crossroads') await page.evaluate(() => returnToMenu());
      }

      // Persistence is per-map choice; resuming an older map does not replace it.
      assert.equal(await page.evaluate(() => CQSave.save().ok), true);
      await page.evaluate(() => returnToMenu());
      await page.locator('#worldMapPicker').tap(); await page.locator('[data-world-map="lanes"]').tap();
      await page.reload();
      assert.equal(await page.evaluate(() => CQWorldUI.selectedId), 'lanes', 'next-map preference persists');
      assert.match(await page.locator('#resumeDetails').textContent(), /Le Carrefour/, 'save summary names its own map');
      await page.locator('#continueGame').tap();
      assert.equal(await page.evaluate(() => game.mapId), 'crossroads');
      assert.equal(await page.evaluate(() => CQWorldUI.selectedId), 'lanes', 'resuming does not change next-map preference');
      assert.equal(await page.evaluate(() => paused), true);

      await page.locator('#worldLegendOpen').tap();
      assert.equal(await page.locator('#worldTitle').textContent(), 'Le Carrefour');
      await page.screenshot({ path: `/tmp/colorquest-v05-map-legend-${viewport.width}.png` });
      await page.locator('#worldPause').tap();
      assert.equal(await page.evaluate(() => paused), false, 'legend has an explicit resume control');
      await page.locator('#worldClose').tap();
      assert.equal(await page.evaluate(() => paused), false, 'closing preserves the explicitly chosen live state');
      await page.locator('#worldLegendOpen').tap();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'worldPause', 'focus stays in the dialog');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'worldClose');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => CQWorldUI.isOpen), false);

      // Freeze simulation, not input, so these gestures probe the UI instead of AI timing.
      await page.evaluate(() => { game.update = () => {}; game.aiEnabled = false; selection = []; mode = null; });
      const terrainPoint = await tapTile(page, "tile.terrain === 'smooth' && tile.y === 16 && tile.x === 14");
      assert.equal(await page.locator('#worldTitle').textContent(), 'Terrain lisse');
      assert.match(await page.locator('#worldContent').textContent(), /30 %/);
      assert.equal(await page.evaluate(() => paused), false);
      await page.locator('#worldClose').tap();
      await tapTile(page, "tile.terrain === 'absorbent' && !tile.blocked && tile.x === 8 && tile.y === 17");
      assert.equal(await page.locator('#worldTitle').textContent(), 'Papier absorbant');
      await page.locator('#worldClose').tap();
      await tapTile(page, 'tile.cache === 60 && tile.y < 24');
      assert.equal(await page.locator('#worldTitle').textContent(), 'Réserve de pigment');
      assert.match(await page.locator('#worldContent').textContent(), /\+60 pigment/);
      await page.locator('#worldClose').tap();
      await tapTile(page, 'tile.rich && tile.y < 24');
      assert.equal(await page.locator('#worldTitle').textContent(), 'Source riche');
      assert.match(await page.locator('#worldContent').textContent(), /60 %/);
      await page.locator('#worldClose').tap();

      // A selected army and explicit map modes must never turn into terrain inspection.
      const commands = await page.evaluate(({ tileX, tileY }) => {
        const tile = game.tile(tileX, tileY); tile.explored = true; tile.visible = true;
        window.worldCalls = { orders: 0, builds: 0 };
        const order = game.order.bind(game), build = game.build.bind(game);
        game.order = (...args) => { worldCalls.orders++; return order(...args); };
        game.build = (...args) => { worldCalls.builds++; return build(...args); };
        selection = game.units.filter(unit => unit.team === 1).map(unit => unit.id);
        CQCamera.focus(tileX + .5, tileY + .5, 3);
        const rect = canvas.getBoundingClientRect();
        return { x: rect.x + view.x + (tileX + .5) * view.cell, y: rect.y + view.y + (tileY + .5) * view.cell };
      }, terrainPoint);
      await page.touchscreen.tap(commands.x, commands.y);
      assert.equal(await page.evaluate(() => CQWorldUI.isOpen), false, 'selected units keep their command workflow');
      assert.equal(await page.evaluate(() => worldCalls.orders), 0, 'inspection does not add implicit movement');
      await page.evaluate(() => setMode({ kind: 'move' }));
      await page.touchscreen.tap(commands.x, commands.y);
      assert.equal(await page.evaluate(() => worldCalls.orders), 1);
      assert.equal(await page.evaluate(() => CQWorldUI.isOpen), false, 'movement takes precedence');
      await page.evaluate(() => { selection = []; setMode({ kind: 'build', type: 'relay' }); });
      await page.touchscreen.tap(commands.x, commands.y);
      assert.equal(await page.evaluate(() => worldCalls.builds), 1);
      assert.equal(await page.evaluate(() => CQWorldUI.isOpen), false, 'construction takes precedence');

      const fog = await page.evaluate(() => {
        setMode(null); selection = [];
        let count = 0;
        const probe = { save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, stroke() { count++; }, fill() { count++; } };
        const originalTiles = game.tiles;
        const tile = { x: 10, y: 20, explored: true, visible: false, owner: 0, terrain: 'plain', rich: false, cache: 60, source: false };
        const worldView = { x: 0, y: 0, cell: 10, w: 320, h: 480 };
        let hidden, revealed, unknownRich, rememberedRich;
        try {
          game.tiles = [tile]; CQWorldUI.drawObjectives(probe, worldView); hidden = count;
          count = 0; tile.visible = true; CQWorldUI.drawObjectives(probe, worldView); revealed = count;
          count = 0; Object.assign(tile, { cache: 0, rich: true, source: true, explored: false, visible: false }); CQWorldUI.drawObjectives(probe, worldView); unknownRich = count;
          count = 0; tile.explored = true; CQWorldUI.drawObjectives(probe, worldView); rememberedRich = count;
        } finally { game.tiles = originalTiles; }
        const hiddenCache = game.tiles.find(tile => tile.cache > 0); hiddenCache.explored = true; hiddenCache.visible = false; hiddenCache.owner = 0;
        const inspection = CQWorldUI.inspectTile(hiddenCache.x, hiddenCache.y);
        return { hidden, revealed, unknownRich, rememberedRich, inspection };
      });
      assert.equal(fog.hidden, 0, 'hidden reserves are not rendered from their current mutable state');
      assert.ok(fog.revealed > 0);
      assert.equal(fog.unknownRich, 0, 'unknown rich sources are not revealed');
      assert.ok(fog.rememberedRich > 0, 'discovered static sources remain known');
      assert.equal(fog.inspection, false, 'inspection cannot reveal a reserve through fog');

      await page.evaluate(() => activateGame(new CQEngine.Game({ mapId: 'legacy', seed: 42 }), { resume: true }));
      assert.equal(await page.locator('#worldMapName').textContent(), await page.evaluate(() => CQMaps.get('legacy').name));
      await page.locator('#worldLegendOpen').tap();
      assert.match(await page.locator('#worldContent').textContent(), /ancienne partie/);
      assert.doesNotMatch(await page.locator('#worldContent').textContent(), /Réserve de pigment/, 'legacy does not promise new objectives');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');
      const legendRect = await page.locator('#worldLegendOpen').boundingBox();
      assert.ok(legendRect.height >= 44);
      await page.locator('#worldPause').tap();
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        delete document.hidden;
      });
      await page.waitForFunction(() => document.getElementById('worldLiveLabel').textContent === 'La partie est en pause');
      assert.equal(await page.evaluate(() => paused), true, 'backgrounding updates the open legend pause state');
      await page.evaluate(() => { game.winner = 1; updateHUD(); });
      assert.equal(await page.evaluate(() => CQWorldUI.isOpen), false, 'result dismisses the map dialog');
      assert.equal(await page.locator('#modal').isVisible(), true, 'the end-of-match result remains reachable');
      assert.deepEqual(errors, []);
      console.log(`PASS world touch ${viewport.width}×${viewport.height}: three maps, exact layouts, save identity, pause/backgrounding, inspection, explicit orders/building, fog, legacy, keyboard focus and match result.`);
      await page.close();
    }

    const blocked = await browser.newPage({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
    const errors = []; blocked.on('pageerror', error => errors.push(error.message));
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } }));
    await blocked.goto(url);
    await blocked.locator('#worldMapPicker').tap(); await blocked.locator('[data-world-map="crossroads"]').tap();
    assert.equal(await blocked.evaluate(() => CQWorldUI.selectedId), 'crossroads');
    await blocked.locator('#worldMapPicker').tap();
    assert.match(await blocked.locator('#worldFooter').textContent(), /session/);
    assert.deepEqual(errors, []);
    await blocked.close();
    console.log('PASS world preference: blocked storage leaves map selection usable with a session-only notice.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
