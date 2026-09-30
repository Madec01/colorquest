/* Recruitment locations are usable from Mobiliser, with independent queues. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--no-sandbox'] });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
      const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('colorquest.v03.discovered', '1'));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.evaluate(() => start({ replace: true }));
      const scene = async () => page.evaluate(() => {
        paused = true; updatePauseUI(); game._aiThink = () => {};
        game._spreadTerritory = () => {}; game._captureTerritory = () => {};
        game.units = []; game.money[1] = 3000;
        for (const tile of game.tiles) if (tile.y >= 35 && tile.x >= 10 && tile.x <= 25) {
          tile.owner = 1; tile.blocked = false; tile.source = false;
        }
        game.recompute();
        const result = game.build(1, 'barracks', 20, 38);
        if (!result.ok) throw Error(result.message);
        window.__barracksId = result.id;
        CQStrategy.onGameStart(); CQAlerts.onGameStart(game);
        return { barracks: result.id, core: game.getCore(1).id };
      });
      const ids = await scene();
      const pause = async value => page.evaluate(value => {
        paused = value; updatePauseUI(); CQStrategy.update(true);
      }, value);
      const tapTile = async (x, y) => {
        const point = await page.evaluate(({ x, y }) => {
          CQCamera.focus(x + .5, y + .5, 3);
          const rect = canvas.getBoundingClientRect();
          return { x: rect.x + view.x + (x + .5) * view.cell,
            y: rect.y + view.y + (y + .5) * view.cell };
        }, { x, y });
        await page.touchscreen.tap(point.x, point.y);
      };
      await page.locator('[data-tab="units"]').tap();
      assert.equal(await page.locator('#strategyRecruitSource').isVisible(), true);
      for (const id of ['strategyQuickProducer', 'strategyQuickRally']) {
        const rect = await page.locator('#' + id).boundingBox();
        assert.ok(rect.width >= 44 && rect.height >= 44, id + ' has a touch-sized target');
      }

      // The quick recruitment button uses the chosen building, even without Camp.
      await page.locator('#strategyQuickProducer').selectOption(String(ids.barracks));
      await pause(false); await page.locator('[data-recruit="fighter"]').tap(); await pause(true);
      let queues = await page.evaluate(() => ({ core: game.queues[1], barracks: CQStrategy.jobs() }));
      assert.equal(queues.core.length, 0); assert.equal(queues.barracks.length, 1);
      assert.equal(queues.barracks[0].type, 'fighter');
      const barracksUnitId = queues.barracks[0].unitId;
      await page.locator('#strategyQuickProducer').selectOption(String(ids.core));
      await pause(false); await page.locator('[data-recruit="scout"]').tap(); await pause(true);
      const coreUnitId = await page.evaluate(() => game.queues[1][0].unitId);
      assert.equal(await page.evaluate(() => game.queues[1].length), 1);
      assert.equal(await page.locator('#strategyQueueBadge').textContent(), '2', 'badge counts every producer');

      // Pausing and changing panels do not consume recruitment time.
      const stopped = await page.evaluate(() => [game.queues[1][0].remaining, game.buildings.find(b => b.id === __barracksId).queue[0].remaining]);
      await page.locator('#strategyOpen').tap();
      await page.locator('#strategyProducerSelect').selectOption(String(ids.barracks));
      assert.match(await page.locator('#strategyQueueTitle').textContent(), /Caserne 1/);
      assert.equal(await page.locator('#strategyQueue .strategy-queue-item').count(), 1);
      assert.match(await page.locator('#strategyQueue').textContent(), /Combattant/);
      await page.locator('#strategyProducerSelect').selectOption(String(ids.core));
      assert.match(await page.locator('#strategyQueue').textContent(), /Éclaireur/);
      await page.locator('#strategyClose').tap();
      assert.deepEqual(await page.evaluate(() => [game.queues[1][0].remaining, game.buildings.find(b => b.id === __barracksId).queue[0].remaining]), stopped);
      assert.equal(await page.evaluate(() => paused), true);

      // Cutting the actual ownership path suspends only the isolated producer.
      await page.evaluate(() => {
        for (const tile of game.tiles) if (tile.y === 40) tile.owner = 0;
        game.recompute();
        const b = game.buildings.find(b => b.id === __barracksId);
        if (b.connected) throw Error('The controlled cut did not isolate the barracks.');
        game._updateRecruitment(1, .75); CQStrategy.update(true);
      });
      assert.equal(await page.evaluate(() => game.buildings.find(b => b.id === __barracksId).queue[0].remaining), stopped[1]);
      assert.ok(await page.evaluate(() => game.queues[1][0].remaining) < stopped[0] - .7);
      await page.locator('#strategyQuickProducer').selectOption(String(ids.barracks));
      assert.match(await page.locator('#strategyQuickProducer option:checked').textContent(), /Coupée/);
      await page.locator('#strategyOpen').tap();
      assert.match(await page.locator('#strategyProducerIntro').textContent(), /Réseau coupé/);
      assert.equal(await page.locator('[data-strategy-recruit="fighter"]').isDisabled(), true);
      await page.locator('#strategyClose').tap();
      await page.evaluate(() => {
        for (const tile of game.tiles) if (tile.y === 40 && tile.x >= 10 && tile.x <= 25) tile.owner = 1;
        game.recompute(); CQStrategy.update(true);
      });

      // A rally belongs to the selected producer; formation still happens beside it.
      await pause(false); await page.locator('#strategyQuickRally').tap();
      assert.equal(await page.evaluate(() => mode.producerId), ids.barracks);
      await tapTile(20, 34); await pause(true);
      assert.deepEqual(await page.evaluate(() => game.buildings.find(b => b.id === __barracksId).rally), { x: 20, y: 34 });
      assert.equal(await page.evaluate(() => game.rally[1]), null);
      await page.evaluate(() => { game._updateRecruitment(1, 7); CQStrategy.update(true); });
      const ready = await page.evaluate(({ barracksUnitId, coreUnitId }) => {
        const b = game.buildings.find(b => b.id === __barracksId), c = game.getCore(1);
        const bu = game.units.find(u => u.id === barracksUnitId), cu = game.units.find(u => u.id === coreUnitId);
        return { barracksDistance: Math.hypot(bu.x - b.x - .5, bu.y - b.y - .5),
          coreDistance: Math.hypot(cu.x - c.x - .5, cu.y - c.y - .5), barracksOrder: bu.order, coreOrder: cu.order };
      }, { barracksUnitId, coreUnitId });
      assert.ok(ready.barracksDistance < 1.5 && ready.coreDistance < 1.5);
      assert.ok(ready.barracksOrder); assert.equal(ready.coreOrder, null);

      // Queued/active refunds remain local to the chosen file.
      await pause(false); await page.locator('[data-recruit="fighter"]').tap();
      await page.locator('[data-recruit="fighter"]').tap(); await pause(true);
      await page.locator('#strategyOpen').tap();
      const pending = await page.evaluate(() => ({ id: CQStrategy.jobs()[1].id, money: game.money[1] }));
      await page.locator(`[data-strategy-cancel="${pending.id}"]`).tap();
      assert.equal(await page.evaluate(() => game.money[1]), pending.money + 35);
      await page.locator('#strategyClose').tap();
      const activeMoney = await page.evaluate(() => game.money[1]);
      await page.locator('#strategyQuickCancel').tap();
      assert.equal(await page.evaluate(() => game.money[1]), activeMoney + 17);
      assert.equal(await page.evaluate(() => CQStrategy.jobs().length), 0);

      // 35 live units + one barracks formation also prevents a core recruitment.
      await page.evaluate(() => {
        game.units = [];
        for (let i = 0; i < 35; i++) game._unit(1, 'fighter', 16.5 + i % 5, 42.5 + Math.floor(i / 5) / 2);
        game.recruit(1, 'fighter', __barracksId); CQStrategy.setRecruitSource(game.getCore(1).id);
        paused = false; updatePauseUI(); CQStrategy.update(true);
      });
      await page.locator('#strategyOpen').tap();
      assert.equal(await page.locator('[data-strategy-recruit="fighter"]').isDisabled(), true);
      assert.match(await page.locator('[data-unit-lock="fighter"]').textContent(), /36 unités/);
      await page.locator('#strategyClose').tap(); await pause(true);
      await page.evaluate(() => {
        game.units = [];
        game.recruit(1, 'fighter', __barracksId); CQStrategy.setRecruitSource(__barracksId);
      });
      const destroy = await page.evaluate(() => {
        const b = game.buildings.find(b => b.id === __barracksId), count = b.queue.length;
        b.hp = 0; game.update(.05); CQStrategy.update(true);
        return { count, source: CQStrategy.getRecruitSource(), core: game.getCore(1).id,
          refund: game.events.find(e => e.type === 'refund')?.text || game.events.find(e => e.type === 'refund')?.label,
          queues: game.getQueuedCount(1) };
      });
      assert.equal(destroy.count, 2); assert.equal(destroy.source, destroy.core);
      assert.match(destroy.refund, /52 pigments/, 'destroyed barracks refunds its active and pending jobs');
      assert.equal(destroy.queues, 0);
      assert.equal(await page.locator('#strategyQuickProducer option').count(), 1, 'destroyed producer is removed');
      assert.equal(await page.locator('#strategyQuickCancel').isVisible(), false);

      // Missions 3/4 have a single producer: feedback fits inside the unit button.
      for (const id of ['contact', 'link']) {
        await page.evaluate(id => startMission(id, { replace: true }), id);
        await page.locator('[data-tab="units"]').tap();
        assert.equal(await page.locator('#strategyRecruitSource').isVisible(), false);
        assert.equal(await page.locator('#strategyOpen').isVisible(), false);
        assert.match(await page.locator('[data-recruit="fighter"] small').textContent(), /Formation au Cœur/);
        await page.locator('[data-recruit="fighter"]').tap();
        await page.locator('[data-recruit="fighter"]').tap(); await pause(true);
        assert.match(await page.locator('[data-recruit="fighter"] small').textContent(), /2 en file/);
        assert.equal(await page.locator('#strategySimpleCancel').isVisible(), true);
        const compact = await page.evaluate(() => {
          const r = document.getElementById('strategySimpleCancel').getBoundingClientRect();
          return { panel: document.querySelector('.command-panel').getBoundingClientRect().height,
            width: r.width, height: r.height, bottom: r.bottom, before: game.money[1] };
        });
        assert.ok(compact.panel < 190, 'single-producer learning keeps the map taller');
        assert.ok(compact.width >= 44 && compact.height >= 44 && compact.bottom <= viewport.height);
        await page.locator('#strategySimpleCancel').tap();
        assert.equal(await page.evaluate(() => game.money[1]), compact.before + 17);
        assert.equal(await page.evaluate(() => CQStrategy.jobs().length), 1);
        if (id === 'contact') await page.screenshot({ path: `/tmp/colorquest-v06-recruit-compact-${viewport.width}.png` });
        await page.locator('#strategySimpleCancel').tap();
        assert.equal(await page.locator('#strategySimpleCancel').count(), 0);
        assert.match(await page.locator('[data-recruit="fighter"] small').textContent(), /Formation au Cœur/);
      }

      // The fifth mission keeps this workflow but does not expose the full Camp.
      await page.evaluate(() => startMission('outpost', { replace: true }));
      await page.evaluate(() => {
        paused = true; updatePauseUI(); game.money[1] = 500;
        for (let y = 36; y <= 40; y++) for (let x = 17; x <= 22; x++) {
          const tile = game.tile(x, y); tile.owner = 1; tile.blocked = false;
        }
        game.recompute();
        const result = game.build(1, 'barracks', 20, 37);
        if (!result.ok) throw Error(result.message);
        window.__missionBarracks = result.id; CQStrategy.setRecruitSource(result.id);
      });
      await page.locator('[data-tab="units"]').tap();
      assert.equal(await page.locator('#strategyOpen').isVisible(), false);
      assert.equal(await page.locator('#strategyQuickProducer').isVisible(), true);
      assert.equal(await page.locator('#strategyQuickRally').isVisible(), true);
      await pause(false); await page.locator('[data-recruit="fighter"]').tap(); await pause(true);
      assert.equal(await page.evaluate(() => game.buildings.find(b => b.id === __missionBarracks).queue.length), 1);
      assert.equal(await page.evaluate(() => game.queues[1].length), 0);
      await page.evaluate(() => CQStrategy.open('develop'));
      assert.equal(await page.evaluate(() => CQStrategy.isOpen), false);
      const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth,
        controls: ['strategyQuickProducer', 'strategyQuickRally', 'strategyQuickCancel'].map(id => {
          const r = document.getElementById(id).getBoundingClientRect(); return { width: r.width, height: r.height, bottom: r.bottom };
        }) }));
      assert.ok(layout.width <= viewport.width);
      assert.ok(layout.controls.every(r => r.width >= 44 && r.height >= 44 && r.bottom <= viewport.height));
      await page.screenshot({ path: `/tmp/colorquest-v06-barracks-${viewport.width}.png` });
      assert.deepEqual(errors, []);
      console.log(`PASS V0.6 barracks ${viewport.width}x${viewport.height}: producer choice, separate queues, pause/cut/reconnect, local rally, refunds, global cap, destruction, compact missions 3/4, mission 5 quick recruitment.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
