'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args:['--no-sandbox']});
  try {
    for (const viewport of [{width:390,height:844}, {width:360,height:640}]) {
      const page = await browser.newPage({viewport, isMobile:true, hasTouch:true});
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url);
      await page.waitForFunction(() => window.CQPalette);
      assert.equal(await page.locator('[data-palette]').count(), 6);
      assert.equal(await page.evaluate(() => CQPalette.key), 'cyan');
      for (const key of ['cyan','blue','violet','rose','green','amber']) {
        const button = page.locator(`[data-palette="${key}"]`);
        await button.tap();
        const state = await page.evaluate(() => ({
          key:CQPalette.key, current:CQPalette.current,
          canvasColours:{player:C.cyan,enemy:C.coral},
          cssPlayer:getComputedStyle(document.documentElement).getPropertyValue('--player-color').trim(),
          cssEnemy:getComputedStyle(document.documentElement).getPropertyValue('--enemy-color').trim(),
          width:document.documentElement.scrollWidth, viewport:innerWidth
        }));
        assert.equal(state.key, key);
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('[data-palette][aria-pressed="true"]').count(), 1);
        assert.equal(state.canvasColours.player, state.current.player);
        assert.equal(state.canvasColours.enemy, state.current.enemy);
        assert.equal(state.cssPlayer, state.current.player);
        assert.equal(state.cssEnemy, state.current.enemy);
        assert.notEqual(state.current.player, state.current.enemy);
        const rect = await button.boundingBox();
        assert.ok(rect.width >= 44 && rect.height >= 44, '44 px touch target');
        assert.ok(state.width <= state.viewport, 'no horizontal overflow');
      }
      await page.reload();
      assert.equal(await page.evaluate(() => CQPalette.key), 'amber', 'choice survives reopening');
      assert.equal(await page.evaluate(() => CQPalette.select('unknown')), false);
      assert.equal(await page.evaluate(() => CQPalette.key), 'amber', 'invalid selection keeps choice');
      await page.locator('#play').tap();
      await page.evaluate(() => {if(!paused) togglePause()});
      const stable = await page.evaluate(() => ({time:game.time,money:[...game.money],units:game.units.length,buildings:game.buildings.length}));
      for (const key of ['cyan','blue','violet','rose','green','amber']) {
        const rendering = await page.evaluate(key => {
          CQPalette.select(key);
          const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle');
          const fills = new Set();
          Object.defineProperty(ctx, 'fillStyle', {
            configurable:true,
            get(){return descriptor.get.call(this)},
            set(value){fills.add(value); descriptor.set.call(this,value)}
          });
          // Reveal one enemy tile so its palette is exercised without changing ownership.
          const tile = game.tiles.find(t => t.owner === 2 && !t.blocked), explored = tile.explored;
          tile.explored = true;
          try { drawMap(0, 0); } finally {delete ctx.fillStyle; tile.explored = explored;}
          return {playerFill:CQPalette.current.playerFill,enemyFill:CQPalette.current.enemyFill,fills:[...fills]};
        }, key);
        assert.ok(rendering.fills.includes(rendering.playerFill), `${key} player territory painted with chosen colour`);
        assert.ok(rendering.fills.includes(rendering.enemyFill), `${key} enemy territory painted with paired colour`);
      }
      assert.deepEqual(await page.evaluate(() => ({time:game.time,money:[...game.money],units:game.units.length,buildings:game.buildings.length})), stable, 'palette has no gameplay effect');
      assert.deepEqual(errors, []);
      console.log(`PASS palette touch ${viewport.width}x${viewport.height}: six choices, 44 px controls, camp preview, persistence, map colours, cosmetic-only changes.`);
      await page.close();
    }
    const invalid = await browser.newPage();
    await invalid.addInitScript(() => {localStorage.setItem('colorquest:palette:v1','not-a-preset')});
    await invalid.goto(url);
    assert.equal(await invalid.evaluate(() => CQPalette.key), 'cyan', 'corrupt preference safely resets');
    await invalid.close();
    const blocked = await browser.newPage({viewport:{width:360,height:640},isMobile:true,hasTouch:true});
    const errors = [];
    blocked.on('pageerror', e => errors.push(e.message));
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', {get(){throw new DOMException('Storage blocked','SecurityError')}}));
    await blocked.goto(url);
    await blocked.locator('[data-palette="violet"]').tap();
    assert.equal(await blocked.evaluate(() => CQPalette.key), 'violet');
    assert.equal(await blocked.locator('#paletteStorageNote').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS palette storage: invalid preference falls back, denied storage still allows a session choice with clear feedback.');
    await blocked.close();
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exit(1)});
