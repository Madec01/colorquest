/* Real damage and network transitions, actionable touch alerts and silent resume. */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
      const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.locator('#play').tap();
      assert.equal(await page.evaluate(() => typeof CQAlerts), 'object', 'alerts integrated into the game');
      const scene = async (type = 'core') => page.evaluate(type => {
        paused = true; updatePauseUI(); game._aiThink = () => {};
        game.units = []; game.buildings = game.buildings.filter(b => b.type === 'core');
        let b = game.getCore(1);
        b.hp = b.maxHp; delete b.lastHit;
        if (type !== 'core') {
          for (let y = 37; y <= 41; y++) {
            const t = game.tile(16, y); t.owner = 1; t.blocked = false;
          }
          b = game._building(1, type, 16, 37);
          if (type === 'extractor') game.tile(b.x, b.y).source = true;
        }
        game.recompute(); CQAlerts.onGameStart(game); window.__target = b.id;
        CQCamera.focus(16, 24, 1);
        return { id: b.id, x: b.x, y: b.y, hp: b.hp };
      }, type);
      const hit = async (type = 'fighter') => page.evaluate(type => {
        const b = game.buildings.find(b => b.id === __target);
        game.units = [];
        game._unit(2, type, b.x + .5, b.y + (type === 'breaker' ? -2.5 : -.5));
        game.update(.05); game.units = []; CQAlerts.update(true);
      }, type);

      // Alert data is never inferred from events, hostile buildings or unexplored enemy activity.
      await scene();
      await page.evaluate(() => {
        const enemy = game._building(2, 'extractor', 5, 5);
        game.emit('destroy', 'Fausse alerte', 2, 2, 1);
        game.emit('shot', 'Fausse attaque', 1, 1, 2);
        CQAlerts.update(true); enemy.hp = 0;
        game.buildings = game.buildings.filter(b => b.hp > 0);
        CQAlerts.update(true);
      });
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), false, 'enemy losses and old events reveal nothing');

      for (const [type, name] of [['core', 'Cœur'], ['relay', 'Relais'], ['extractor', 'Extracteur'], ['bastion', 'Bastion']]) {
        const target = await scene(type); await hit();
        assert.ok(await page.evaluate(id => game.buildings.find(b => b.id === id).hp, target.id) < target.hp);
        assert.equal(await page.locator('#tacticalAlertTitle').innerText(), name + ' attaqué');
        assert.equal(await page.locator('#networkAlert').getAttribute('data-alert-kind'), 'attack');
        assert.equal(await page.locator('#tacticalAlerts').getAttribute('data-count'), '1');
        // Both camera focus and selection are safe while paused or in an order placement mode.
        await page.evaluate(() => {
          window.__calls = { order: 0, command: 0, focus: null };
          const focus = CQCamera.focus;
          CQCamera.focus = (...args) => { __calls.focus = args; return focus(...args); };
          const order = game.order, command = game.command;
          game.order = function (...args) { __calls.order++; return order.apply(this, args); };
          game.command = function (...args) { __calls.command++; return command.apply(this, args); };
          setMode({ kind: 'move' });
          paused = true; updatePauseUI();
        });
        await page.locator('#networkAlert').tap();
        const focused = await page.evaluate(() => ({ calls: __calls, paused, selected: CQUI.selectedBuilding, mode, zoom: CQCamera.zoom }));
        assert.equal(focused.paused, true); assert.equal(focused.selected, target.id);
        assert.equal(focused.mode, null); assert.equal(focused.calls.order, 0); assert.equal(focused.calls.command, 0);
        assert.deepEqual(focused.calls.focus.slice(0, 2), [target.x + .5, target.y + .5]);
        assert.ok(focused.zoom >= 2.3);
        await hit(); assert.equal(await page.locator('#tacticalAlerts').getAttribute('data-count'), '1', 'rapid hits group into one alert');
        await page.locator('#tacticalAlertDismiss').tap();
        await hit(); assert.equal(await page.locator('#tacticalAlerts').isVisible(), false, 'dismissal respects the 10 second attack cooldown');
      }

      await scene(); await hit();
      await page.locator('#tacticalAlertDismiss').tap();
      await page.evaluate(() => { game.time += 10.1; }); await hit();
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), true, 'continued attacks can notify after cooldown');
      await page.waitForTimeout(220);
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), true, 'paused alerts do not expire in wall time');
      await page.evaluate(() => { game.time += 25.1; CQAlerts.update(true); });
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), false, 'old alerts expire after 25 simulation seconds');

      const extractor = await scene('extractor');
      await page.evaluate(() => {
        game.buildings.find(b => b.id === __target).hp = 40;
        CQAlerts.onGameStart(game);
      });
      await hit('breaker');
      assert.equal(await page.locator('#tacticalAlertTitle').innerText(), 'Source perdue');
      assert.equal(await page.evaluate(id => game.buildings.some(b => b.id === id), extractor.id), false);
      await page.evaluate(() => { CQCamera.focus(16, 24, 1); });
      await page.locator('#networkAlert').tap();
      assert.equal(await page.evaluate(() => CQUI.selectedBuilding), null, 'destroyed buildings are never reselected');
      assert.equal(await page.evaluate(() => paused), true);
      assert.ok(await page.evaluate(() => CQCamera.zoom >= 2.3));

      // Real connected corridor, one tile cut, then reconnected: both economic and network consequences.
      await scene();
      const network = await page.evaluate(() => {
        for (const t of game.tiles) if (t.owner === 1) t.owner = 0;
        for (let y = 30; y <= 41; y++) {
          const t = game.tile(16, y); t.owner = 1; t.blocked = false;
        }
        const relay = game._building(1, 'relay', 16, 33);
        const extractor = game._building(1, 'extractor', 16, 30); game.tile(16, 30).source = true;
        game.recompute(); CQAlerts.onGameStart(game);
        game.tile(16, 35).owner = 0; game.recompute(); CQAlerts.update(true);
        return { relay: relay.id, extractor: extractor.id };
      });
      assert.equal(await page.locator('#networkAlert').getAttribute('data-alert-kind'), 'network');
      assert.equal(await page.locator('#tacticalAlerts').getAttribute('data-count'), '2');
      assert.match(await page.locator('#tacticalAlertDetail').innerText(), /2 bâtiments isolés/);
      await page.locator('#networkAlert').tap();
      assert.equal(await page.evaluate(() => CQUI.selectedBuilding), network.relay);
      assert.match(await page.locator('#objectState').innerText(), /ISOLÉ/);
      await page.locator('#tacticalAlertNext').tap();
      assert.equal(await page.locator('#tacticalAlertTitle').innerText(), 'Source isolée');
      await page.locator('#networkAlert').tap();
      assert.equal(await page.evaluate(() => CQUI.selectedBuilding), network.extractor);

      // Fit 44-pixel controls alongside the camera on the smallest supported portrait viewport.
      const dimensions = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth, width: innerWidth,
        panel: document.getElementById('tacticalAlerts').getBoundingClientRect().toJSON(),
        camera: document.querySelector('.camera-tools').getBoundingClientRect().toJSON(),
        buttons: [...document.querySelectorAll('#tacticalAlerts button')].filter(b => !b.hidden).map(b => b.getBoundingClientRect().toJSON())
      }));
      assert.ok(dimensions.page <= dimensions.width);
      assert.ok(dimensions.panel.right < dimensions.camera.left, 'alerts leave the camera controls free');
      assert.ok(dimensions.buttons.every(b => b.width >= 44 && b.height >= 44), 'every alert action is a full touch target');
      await page.screenshot({ path: `/tmp/colorquest-alerts-${viewport.width}.png` });

      await page.evaluate(() => { game.tile(16, 35).owner = 1; game.recompute(); CQAlerts.update(true); });
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), false, 'reconnected source and network alerts clear');

      await page.evaluate(() => {
        for (let i = 0; i < 7; i++) game._building(1, 'relay', 3 + i * 3, 35);
        CQAlerts.onGameStart(game);
        for (const b of game.buildings.filter(b => b.team === 1)) b.hp -= 1;
        CQAlerts.update(true);
      });
      assert.equal(await page.locator('#tacticalAlerts').getAttribute('data-count'), '4', 'bounded history under simultaneous attacks');
      assert.equal(await page.locator('#tacticalAlertTitle').innerText(), 'Cœur attaqué', 'Cœur danger has display priority');

      // Priming an existing damaged/isolated match never replays the previous session's danger.
      await page.evaluate(() => { CQAlerts.onGameStart(game); CQAlerts.update(true); });
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), false);
      await page.evaluate(() => { CQAlerts.reset(); CQAlerts.update(true); });
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), false);
      await page.evaluate(() => start({ replace: true }));
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), false, 'new game clears old locations and cooldowns');
      await scene(); await hit();
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), true);
      assert.equal(await page.evaluate(() => CQSave.save().ok), true);
      await page.reload(); await page.locator('#continueGame').tap();
      assert.equal(await page.evaluate(() => paused), true);
      assert.equal(await page.locator('#tacticalAlerts').isVisible(), false, 'real page reload and resume never replay old damage events');
      assert.deepEqual(errors, []);
      console.log(`PASS alerts ${viewport.width}x${viewport.height}: four building attacks, real destruction/cut/reconnection, fog filtering, cooldowns, priorities, bounded history, expiry, tap focus/pause, reset and touch geometry.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
