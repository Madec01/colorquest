'use strict';
const assert = require('node:assert/strict');
const { Game, WIDTH, HEIGHT, UNIT_STATS } = require('../engine.js');
const Maps = require('../maps.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ ' + name); }
const shape = tile => [tile.blocked, tile.source, tile.terrain, tile.rich, tile.cache];
function advance(game, seconds) { for (let n = 0; n < Math.round(seconds * 10) && game.winner === null; n++) game.update(.1); }
function clone(game) { return Object.assign(Object.create(Game.prototype), JSON.parse(JSON.stringify(game))); }

// A single flood fill checks every traversable tile, rather than just finding
// one route to a few objectives and overlooking inaccessible side pockets.
function reachable(game, core) {
  const seen = new Set([core.y * WIDTH + core.x]), queue = [[core.x, core.y]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t = game.tile(x + dx, y + dy), key = t && t.y * WIDTH + t.x;
      if (t && !t.blocked && !seen.has(key)) { seen.add(key); queue.push([t.x, t.y]); }
    }
  }
  return seen;
}

test('Three distinct mirrored maps are fully connected and start both camps fairly', () => {
  assert.deepEqual(Maps.catalog.map(map => map.name), ['La Plaine', 'Les Couloirs', 'Le Carrefour']);
  const layouts = [];
  for (const map of Maps.catalog) {
    const game = new Game({ mapId: map.id, seed: 42 });
    assert.equal(game.mapId, map.id);
    assert.equal(game.tiles.length, WIDTH * HEIGHT);
    layouts.push(JSON.stringify(game.tiles.map(shape)));
    const reached = reachable(game, game.getCore(1));
    assert.ok(reached.has(game.getCore(2).y * WIDTH + game.getCore(2).x));
    for (const t of game.tiles) {
      assert.deepEqual(shape(t), shape(game.tile(t.x, HEIGHT - 1 - t.y)), `${map.id}: asymmetric ${t.x},${t.y}`);
      if (!t.blocked) assert.ok(reached.has(t.y * WIDTH + t.x), `${map.id}: isolated ${t.x},${t.y}`);
      if (t.source || t.cache) assert.equal(t.blocked, false);
      if (t.rich) assert.equal(t.source, true);
      assert.ok(!t.source || !t.cache);
      const opposite = game.tile(t.x, HEIGHT - 1 - t.y);
      assert.equal(t.owner === 1, opposite.owner === 2);
      assert.equal(t.visible, opposite.aiVisible);
    }
    assert.equal(game.tiles.filter(t => t.source).length, 8);
    assert.equal(game.tiles.filter(t => t.rich).length, 2);
    assert.equal(game.tiles.filter(t => t.cache).length, 6);
    assert.ok(game.tiles.some(t => t.terrain === 'smooth'));
    assert.ok(game.tiles.some(t => t.terrain === 'absorbent'));
    assert.ok(game.units.every(u => !game.tile(u.x, u.y).blocked));
    assert.deepEqual(new Game({ mapId: map.id, seed: 7 }).tiles.map(shape), game.tiles.map(shape), 'Layout cannot vary with combat RNG');
    assert.deepEqual(Maps.createLayout(map.id).map(shape), game.tiles.map(shape), 'Preview must use the actual board');
  }
  assert.equal(new Set(layouts).size, 3);
});

test('Legacy geometry remains available without new terrain or reserve rewards', () => {
  const legacy = new Game({ mapId: 'legacy', seed: 42 });
  assert.equal(legacy.mapId, 'legacy');
  assert.equal(legacy.tile(7, 37).source, true);
  assert.equal(legacy.tile(16, 31).source, true);
  assert.ok(legacy.tiles.every(t => t.terrain === 'plain' && !t.rich && !t.cache));
  assert.ok(legacy.tiles.every(t => typeof t.aiVisible === 'boolean' && typeof t.aiExplored === 'boolean'));
  assert.equal(new Game({ mapId: 'invalid' }).mapId, Maps.DEFAULT_MAP);
  assert.equal(new Game().mapId, 'plain');
});

test('Reserves pay once, need a conquering unit and cannot be stolen while contested', () => {
  const game = new Game(), cache = game.tiles.find(t => t.cache);
  game.units = [];
  const engineer = game._unit(1, 'engineer', cache.x + .5, cache.y + .5);
  const before = game.money[1];
  game._collectCaches();
  assert.equal(game.money[1], before);
  const scout = game._unit(1, 'scout', cache.x + .5, cache.y + .5);
  const enemy = game._unit(2, 'fighter', cache.x + 2.5, cache.y + .5);
  game._collectCaches();
  assert.equal(cache.cache, 60);
  enemy.hp = 0;
  game._collectCaches();
  assert.equal(cache.cache, 0);
  assert.equal(game.money[1], before + 60);
  assert.equal(game.events.at(-1).type, 'cache');
  assert.equal(game.events.at(-1).team, 1);
  game._collectCaches();
  assert.equal(game.money[1], before + 60);
  const second = game.tiles.find(t => t.cache);
  game.units = [game._unit(2, 'saboteur', second.x + .5, second.y + .5)];
  const enemyMoney = game.money[2];
  game._collectCaches();
  assert.equal(game.money[2], enemyMoney + 60);
  assert.equal(second.cache, 0);
});

test('Rich extractors apply 1.6× at every level and stop producing when disconnected', () => {
  const game = new Game(), tile = game.tiles.find(t => t.rich);
  const extractor = game._building(1, 'extractor', tile.x, tile.y);
  for (const [level, income] of [[1, 4.96], [2, 7.2], [3, 9.6]]) {
    extractor.level = level;
    assert.ok(Math.abs(game.getBuildingStats(extractor).income - income) < 1e-9);
    const raw = JSON.parse(JSON.stringify(game));
    assert.equal(Game.prototype.getBuildingStats.call(raw, extractor).income, game.getBuildingStats(extractor).income);
    game._updateIncome();
    assert.ok(Math.abs(game.income[1] - game.getBuildingStats(game.getCore(1)).income - income) < 1e-9);
  }
  extractor.connected = false;
  game._updateIncome();
  assert.equal(game.income[1], 2.6);
});

test('Smooth paper accelerates movement by 30%; absorbent paper halves passive spread only', () => {
  const game = new Game();
  game.units = [];
  const u = game._unit(1, 'fighter', 10.5, 20.5);
  const origin = game.tile(u.x, u.y);
  origin.terrain = 'plain';
  u.path = [{ x: 20.5, y: 20.5 }]; game._moveUnit(u, 2, .1);
  const plain = u.x - 10.5;
  u.x = 10.5; origin.terrain = 'smooth'; game._moveUnit(u, 2, .1);
  assert.ok(Math.abs((u.x - 10.5) / plain - 1.3) < 1e-10);
  for (const tile of game.tiles) { tile.owner = 0; tile.blocked = false; tile.terrain = 'plain'; }
  const core = game.getCore(1); core.x = 16; core.y = 20;
  game.tile(16, 20).owner = 1;
  const absorbent = game.tile(16, 19); absorbent.terrain = 'absorbent';
  game.recompute(); game.time = 1; game._spreadTerritory();
  assert.equal(absorbent.owner, 0);
  assert.equal(game.tile(17, 20).owner, 1);
  game.time = 2; game._spreadTerritory();
  assert.equal(absorbent.owner, 1);
  const manual = game.tile(18, 20); manual.owner = 0; manual.terrain = 'absorbent';
  game.time = 3; u.x = 18.5; u.y = 20.5; game._captureTerritory();
  assert.equal(manual.owner, 1);
});

test('Fog uses equal living-unit/building radii and remembers explored ground after leaving', () => {
  const game = new Game();
  for (const tile of game.tiles) { tile.owner = 0; tile.connected = false; tile.explored = false; tile.aiExplored = false; }
  game.buildings = []; game.units = [];
  for (const team of [1, 2]) game._unit(team, 'scout', 16.5, 24.5);
  game.updateVisibility();
  for (const tile of game.tiles) {
    const within = Math.hypot(tile.x - 16, tile.y - 24) <= UNIT_STATS.scout.vision;
    assert.equal(tile.visible, within);
    assert.equal(tile.aiVisible, within);
  }
  const remembered = game.tile(16, 24);
  game.units.forEach(u => { u.y = 4.5; });
  game.updateVisibility();
  assert.equal(remembered.visible, false); assert.equal(remembered.aiVisible, false);
  assert.equal(remembered.explored, true); assert.equal(remembered.aiExplored, true);
  game.units.forEach(u => { u.hp = 0; }); game.updateVisibility();
  assert.equal(game.tiles.filter(t => t.visible || t.aiVisible).length, 0);
});

function rememberedTarget() {
  const game = new Game({ difficulty: 'normal', seed: 47 });
  const scout = game.units.find(u => u.team === 2 && u.type === 'scout');
  const relay = game._building(1, 'relay', 16, 22);
  scout.x = 16.5; scout.y = 19.5; game.time = 20; game.updateVisibility();
  assert.ok(game.aiMemory.some(b => b.id === relay.id));
  scout.x = 16.5; scout.y = 8.5; game.time = 200; game.updateVisibility();
  assert.equal(game.tile(relay.x, relay.y).aiVisible, false);
  for (let n = 0; n < 3; n++) game._unit(2, 'fighter', 15.5 + n, 10.5);
  game.money[2] = 0;
  return { game, relay, scout };
}
const intent = game => ({ memory: game.aiMemory, orders: game.units.filter(u => u.team === 2).map(u => ({ id: u.id, order: u.order, path: u.path })), rally: game.rally, seed: game.seed });

test('Hidden building moves/destruction cannot alter AI orders; last-known memory clears only on observation', () => {
  const { game, relay } = rememberedTarget();
  const moved = clone(game), destroyed = clone(game);
  Object.assign(moved.buildings.find(b => b.id === relay.id), { x: 29, y: 44 });
  destroyed.buildings = destroyed.buildings.filter(b => b.id !== relay.id);
  game._aiThink(); moved._aiThink(); destroyed._aiThink();
  assert.deepEqual(intent(moved), intent(game));
  assert.deepEqual(intent(destroyed), intent(game));
  assert.deepEqual(game.aiMemory.find(b => b.id === relay.id), { id: relay.id, type: 'relay', x: 16, y: 22, seenAt: 20 });
  assert.ok(game.units.some(u => u.team === 2 && u.order?.x === 16.5 && u.order?.y === 22.5));
  const scout = destroyed.units.find(u => u.team === 2 && u.type === 'scout');
  scout.x = 16.5; scout.y = 19.5; destroyed.updateVisibility();
  assert.equal(destroyed.aiMemory.some(b => b.id === relay.id), false);
});

test('Unseen enemy units cannot influence strategy; an observed invader can trigger defense', () => {
  const game = new Game({ difficulty: 'easy' }), changed = clone(game);
  for (const g of [game, changed]) { g.money[2] = 0; g.time = 60; }
  for (const u of changed.units.filter(u => u.team === 1)) { u.x = 29.5; u.y = 44.5; }
  game._aiThink(); changed._aiThink();
  assert.deepEqual(intent(changed), intent(game));
  const invader = changed.units.find(u => u.team === 1 && u.type === 'fighter');
  invader.x = 16.5; invader.y = 9.5; changed._aiThink();
  assert.equal(changed.tile(invader.x, invader.y).aiVisible, true);
  assert.ok(changed.units.filter(u => u.team === 2 && u.type === 'fighter').every(u => u.stance === 'attack'));
});

test('Scouts explore without omniscient resource selection, keep moving after a claim and collect real reserves', () => {
  const game = new Game({ difficulty: 'easy', seed: 42 });
  const scout = game.units.find(u => u.team === 2 && u.type === 'scout');
  game.money[2] = 0;
  // Keep identical navigation while changing only undiscovered objective data.
  const changed = clone(game);
  for (const tile of changed.tiles.filter(t => !t.aiExplored)) { tile.source = !tile.source; tile.rich = false; tile.cache = tile.source ? 0 : 60; }
  game._aiThink(); changed._aiThink();
  assert.deepEqual(intent(changed), intent(game));
  assert.ok(scout.path.length);
  const before = game.tiles.filter(t => t.aiExplored).length;
  let collected = 0;
  const collect = game._collectCaches;
  game._collectCaches = function () { const before = this.money[2]; collect.call(this); collected += this.money[2] - before; };
  advance(game, 120);
  assert.ok(game.tiles.filter(t => t.aiExplored).length > before + 200);
  assert.ok(collected >= 60, 'AI must actually contest observed reserves');
  assert.ok(game.buildings.some(b => b.team === 2 && b.type === 'extractor'));
});

test('Long-range bastions need allied vision beyond their own seven-tile sight', () => {
  const game = new Game();
  for (const tile of game.tiles) { tile.owner = 0; tile.connected = false; }
  game.units = []; game.buildings = [];
  const bastion = game._building(2, 'bastion', 4, 24); bastion.level = 3;
  const enemy = game._unit(1, 'fighter', 12, 24.5); enemy.stance = 'hold';
  game._aiThink = () => {}; game.updateVisibility();
  const hp = enemy.hp; game.update(.1);
  assert.equal(enemy.hp, hp, 'An unseen target inside upgraded firing range must remain untargetable');
  game._unit(2, 'scout', 7.5, 24.5); game.updateVisibility(); game.update(.1);
  assert.ok(enemy.hp < hp);
});

console.log(`${passed} V0.5 world and perception checks passed.`);
