'use strict';
const assert = require('node:assert/strict');
const { Game, CARDS, CONFIG, BUILDING_STATS, UNIT_STATS, DEFAULT_DECK, MAPS, MIXTURE, normalizeModifiers } = require('../paint-engine.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('✓', name); }
function close(actual, expected, message) { assert.ok(Math.abs(actual - expected) < 1e-7, message || `${actual} != ${expected}`); }
function play(game, card, x, y, team = 1) {
  const result = game.playCard(team, game.hands[team].indexOf(card), x, y);
  assert.equal(result.ok, true, result.message);
  return result;
}
function unit(game, team, x, y, hp = UNIT_STATS.hp) {
  const result = game._addUnit(team, game.getCore(team), { x: x + .5, y: y + .5 });
  result.hp = hp; result.attackCooldown = 100;
  return result;
}
function mortarGame(options = {}) {
  const game = new Game(Object.assign({ decks: [[], ['mortar', 'barracks', 'extractor', 'splash', 'relay', 'bastion', 'wave', 'bleach'], DEFAULT_DECK] }, options));
  const result = play(game, 'mortar', 9, 21);
  return { game, mortar: game.buildings.find(b => b.id === result.buildingId) };
}
function mixtureGame() {
  return new Game({ mixtures: true, decks: [[], ['relay', 'bleach', 'wave', 'splash', 'bastion', 'extractor', 'barracks', 'barracks'], DEFAULT_DECK] });
}

test('all three public maps are rotationally symmetric and every walkable cell is reachable', () => {
  assert.deepEqual(Object.keys(MAPS), ['canvas', 'narrows', 'crossroads']);
  const geometries = new Set();
  for (const id of Object.keys(MAPS)) {
    const game = new Game({ mapId: id }), start = game.getCore(1), visited = new Set([start.y * game.width + start.x]), queue = [game.tile(start.x, start.y)];
    for (const tile of game.tiles) {
      const mirror = game.tile(game.width - 1 - tile.x, game.height - 1 - tile.y);
      assert.equal(tile.blocked, mirror.blocked, id); assert.equal(tile.source, mirror.source, id);
      assert.ok(!tile.source || !tile.blocked, id + ': source on an obstacle');
    }
    for (const tile of queue) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = game.tile(tile.x + dx, tile.y + dy), key = next && next.y * game.width + next.x;
      if (next && !next.blocked && !visited.has(key)) { visited.add(key); queue.push(next); }
    }
    assert.equal(visited.size, game.tiles.filter(t => !t.blocked).length, id);
    assert.equal(game.scores[1], game.scores[2]); assert.equal(game.income[1], game.income[2]);
    assert.equal(game.perception(1).mapId, id);
    geometries.add(JSON.stringify(game.tiles.map(t => [t.blocked, t.source])));
  }
  assert.equal(geometries.size, 3);
  assert.throws(() => new Game({ mapId: 'toString' }), RangeError);
});

test('free-mode defaults retain the V0.7.1 deck, economy, health and absence of mixtures', () => {
  const game = new Game();
  assert.equal(game.mapId, 'canvas'); assert.equal(game.mixtures, false); assert.deepEqual(game.shells, []);
  assert.deepEqual([...game.hands[1], ...game.decks[1]], DEFAULT_DECK);
  assert.equal(game.getCore(1).maxHp, 240); assert.equal(game.pigment[1], 65);
  assert.equal(game.getBrushLimit(1), 12); assert.equal(CONFIG.unitCost, 6); assert.equal(CONFIG.unitInterval, 5);
  assert.equal(game.getCard(1, 'barracks').cost, 32); assert.equal(game.getCard(1, 'splash').cost, 16);
  assert.equal(game.getCard(0, 'mortar'), null); assert.equal(game.getCard(1, 'toString'), null);
});

test('course decks are copied, consist of exactly eight known cards and preserve cycling', () => {
  const deck = ['mortar', 'barracks', 'extractor', 'splash', 'relay', 'bastion', 'wave', 'bleach'];
  const game = new Game({ decks: [[], deck, DEFAULT_DECK] }); deck[0] = 'bleach';
  assert.equal(game.hands[1][0], 'mortar');
  play(game, 'mortar', 9, 21);
  assert.equal(game.hands[1][0], 'relay'); assert.equal(game.decks[1].at(-1), 'mortar');
  for (const invalid of [[], DEFAULT_DECK.slice(1), [...DEFAULT_DECK, 'relay'], [...DEFAULT_DECK.slice(0, 7), 'constructor'], 'relay']) {
    assert.throws(() => new Game({ decks: [[], invalid, DEFAULT_DECK] }), RangeError);
  }
});

test('modifier validation bounds every buff and cannot discount unrelated cards', () => {
  for (const modifiers of [{ brushBonus: 4 }, { brushBonus: .5 }, { reinforcementSpeed: -.1 }, { reinforcementSpeed: .2 }, { buildingHealth: .3 }, { buildingHealth: NaN }, { cardDiscounts: { barracks: 7 } }, { cardDiscounts: { splash: 4.5 } }, { cardDiscounts: { mortar: 1 } }, { cardDiscounts: null }, []]) {
    assert.throws(() => normalizeModifiers(modifiers), RangeError);
  }
  const input = { brushBonus: 3, cardDiscounts: { barracks: 6, splash: 4 } };
  const game = new Game({ modifiers: [null, input, null] }); input.cardDiscounts.barracks = 0;
  assert.equal(game.getCard(1, 'barracks').cost, 26); assert.equal(game.getCard(2, 'barracks').cost, 32);
  assert.equal(game.getCard(1, 'splash').cost, 12); assert.equal(game.getCard(1, 'mortar').cost, 40);
  assert.equal(CARDS.barracks.cost, 32); assert.equal(CARDS.splash.cost, 16);
});

test('discounts agree in preview, payment and cycling without changing troop costs', () => {
  const game = new Game({ modifiers: [null, { cardDiscounts: { barracks: 6, splash: 4 } }, null] });
  const before = JSON.stringify(game), preview = game.previewCard(1, 1, 9, 21);
  assert.equal(preview.cost, 26); assert.equal(JSON.stringify(game), before);
  play(game, 'barracks', 9, 21); assert.equal(game.pigment[1], 39);
  play(game, 'splash', 9, 18); assert.equal(game.pigment[1], 27);
  game.update(5.1);
  assert.equal(game.events.find(e => e.type === 'spawn').cost, 6);
  assert.equal(game.productionOutflow(1), 1.2);
});

test('the brush varnish extends only its camp’s valid prefix and still charges per new tile', () => {
  for (const bonus of [0, 3]) {
    const game = new Game({ modifiers: [null, { brushBonus: bonus }, null] });
    for (const tile of game.tiles) tile.owner = 0;
    game.tile(9, 3).owner = 2;
    for (let y = 20; y <= 23; y++) game.tile(9, y).owner = 1;
    game.recompute(); game.visibility[1].fill(true);
    const path = Array.from({ length: 16 }, (_, i) => ({ x: 9, y: 20 - i }));
    const result = game.paint(1, path);
    assert.equal(result.ok, true); assert.equal(result.cost, 12 + bonus); assert.equal(game.pigment[1], 65 - 12 - bonus);
    assert.equal(game.getBrushLimit(2), 12); assert.equal(game.perception(1).brushLimit, 12 + bonus);
  }
});

test('the building-health varnish also scales Cœur upgrades but never troop health', () => {
  const game = new Game({ modifiers: [null, { buildingHealth: .2 }, null] });
  assert.equal(game.getCore(1).maxHp, 288); assert.equal(game.getCore(2).maxHp, 240);
  game.pigment[1] = 100; assert.equal(game.upgradeCore(1).ok, true);
  assert.equal(game.getCore(1).maxHp, 384); assert.equal(game.getCore(1).hp, 384);
  assert.equal(game.upgradeCore(1).ok, true); assert.equal(game.getCore(1).maxHp, 480);
  game.pigment[1] = 100;
  const result = play(game, 'barracks', 9, 21), building = game.buildings.find(b => b.id === result.buildingId);
  assert.equal(building.maxHp, 120); assert.equal(unit(game, 1, 8, 22).maxHp, 32);
});

test('reinforcements gain speed only while standing on their own connected territory', () => {
  const game = new Game({ modifiers: [null, { reinforcementSpeed: .15 }, null] }), own = unit(game, 1, 9, 22);
  game.recompute(); game._move(own, { x: 9.5, y: 21.5 }, .2);
  close(22.5 - own.y, UNIT_STATS.speed * 1.15 * .2);
  for (const owner of [0, 1, 2]) {
    own.x = 9.5; own.y = 17.5; own.path = []; own.pathTarget = null; game.tile(9, 17).owner = owner; game.recompute();
    assert.equal(game.tile(9, 17).connected, false);
    game._move(own, { x: 9.5, y: 16.5 }, .2);
    close(17.5 - own.y, UNIT_STATS.speed * .2);
  }
});

test('mortar placement pays once, creates no producer and requires a deliberate order', () => {
  const { game, mortar } = mortarGame();
  assert.equal(game.pigment[1], 25); assert.equal(mortar.maxHp, 80); assert.equal(mortar.mortarTarget, null);
  assert.equal(game.getProducers(1).some(b => b.id === mortar.id), false);
  assert.equal(game.toggleProduction(1, mortar.id).ok, false); assert.equal(game.setFlow(1, mortar.id, 9, 17).ok, false);
  game.update(6); assert.equal(game.shells.length, 0); assert.equal(game.getUnitCount(1), 0);
  assert.equal(game.productionOutflow(1), 0);
});

test('mortar previews reject fog, minimum range, long range and foreign orders without mutation', () => {
  const { game, mortar } = mortarGame();
  assert.equal(game.setMortarTarget(1, mortar.id, 9, 17).ok, true);
  const before = JSON.stringify(game);
  assert.equal(game.previewMortarTarget(1, mortar.id, 9, 20).ok, false);
  assert.equal(game.setMortarTarget(2, mortar.id, 9, 17).ok, false);
  const hidden = game.previewMortarTarget(1, mortar.id, 9, 10);
  assert.equal(hidden.message, 'Zone hors de vue.'); assert.equal(JSON.stringify(game), before);
  game.tile(9, 10).owner = 2; game.tile(9, 10).blocked = true;
  assert.deepEqual(game.previewMortarTarget(1, mortar.id, 9, 10), hidden);
  game.visibility[1][13 * game.width + 9] = true;
  assert.match(game.previewMortarTarget(1, mortar.id, 9, 13).message, /trop loin/);
  assert.deepEqual(mortar.mortarTarget, { x: 9, y: 17 });
});

test('a mortar shell is telegraphed for 1.2 seconds, then damages enemies without repainting or friendly fire', () => {
  const { game, mortar } = mortarGame(), foe = unit(game, 2, 9, 17), ally = unit(game, 1, 10, 17);
  game.tile(9, 17).owner = 2; game.tile(10, 17).owner = 1;
  const enemyBuilding = game._addBuilding(2, 'relay', 9, 16), friendBuilding = game._addBuilding(1, 'relay', 10, 16);
  game.recompute(); assert.equal(game.setMortarTarget(1, mortar.id, 9, 17).ok, true);
  assert.equal(game.shells.length, 0); game.update(CONFIG.step);
  assert.equal(game.shells.length, 1); assert.equal(foe.hp, 32);
  const shell = game.shells[0]; close(shell.remaining, 1.2); assert.deepEqual([shell.fromX, shell.fromY, shell.x, shell.y], [9.5, 21.5, 9.5, 17.5]);
  game.update(1.1); assert.equal(foe.hp, 32); assert.equal(game.shells.length, 1);
  const owners = game.tiles.map(t => t.owner); game.update(.1);
  assert.equal(game.shells.length, 0); assert.equal(foe.hp, 14); assert.equal(enemyBuilding.hp, 58);
  assert.equal(ally.hp, 32); assert.equal(friendBuilding.hp, 70); assert.deepEqual(game.tiles.map(t => t.owner), owners);
  assert.equal(game.events.filter(e => e.type === 'mortar-shot').length, 1);
  const impact = game.events.find(e => e.type === 'mortar-impact'); assert.ok(impact);
  assert.equal(Object.hasOwn(impact, 'targetId'), false); assert.equal(Object.hasOwn(impact, 'victims'), false);
});

test('a queued mortar target waits when it is no longer visible or the mortar is disconnected', () => {
  for (const cause of ['fog', 'cut']) {
    const { game, mortar } = mortarGame(), scout = unit(game, 1, 9, 15);
    game.recompute(); assert.equal(game.setMortarTarget(1, mortar.id, 9, 14).ok, true);
    if (cause === 'fog') { scout.hp = 0; game._removeDead(); }
    else {
      for (const tile of game.tiles) if (tile.owner === 1) tile.owner = 0;
      game.tile(9, 23).owner = 1; game.tile(9, 21).owner = 1;
    }
    game.recompute(); game.update(.1);
    assert.equal(game.shells.length, 0, cause); assert.deepEqual(mortar.mortarTarget, { x: 9, y: 14 });
    assert.equal(game.setMortarTarget(1, mortar.id, null, null).ok, true); assert.equal(mortar.mortarTarget, null);
  }
});

test('an already launched shell still lands after losing vision and its launcher', () => {
  const { game, mortar } = mortarGame(), scout = unit(game, 1, 9, 15), enemy = game._addBuilding(2, 'relay', 9, 14);
  game.recompute(); assert.equal(game.setMortarTarget(1, mortar.id, 9, 14).ok, true); game.update(CONFIG.step);
  assert.equal(game.shells.length, 1); scout.hp = 0; mortar.hp = 0; game._removeDead(); game.recompute();
  assert.equal(game.isVisible(1, 9, 14), false); assert.equal(game.perception(1).shells.length, 1, 'Own committed target stays known');
  game.update(1.2); assert.equal(enemy.hp, 58); assert.equal(game.shells.length, 0);
  assert.equal(game.perception(1).buildings.some(b => b.id === enemy.id), false);
});

test('shell perception shows visible danger without disclosing an unseen launcher or hidden target', () => {
  const game = new Game(), source = game.getCore(2);
  game.shells.push({ id: game._id++, team: 2, sourceId: source.id, fromX: 9.5, fromY: 3.5, x: 9.5, y: 22.5, remaining: .8, total: 1.2, radius: 1.5 });
  const seen = game.perception(1).shells[0];
  assert.equal(seen.team, 2); assert.equal(Object.hasOwn(seen, 'sourceId'), false); assert.equal(Object.hasOwn(seen, 'fromX'), false);
  game.shells[0].fromX = 2.5; game.shells[0].fromY = 4.5;
  assert.deepEqual(game.perception(1).shells[0], seen);
  game.shells[0].x = 2.5; game.shells[0].y = 4.5; assert.deepEqual(game.perception(1).shells, []);
  game.shells[0].team = 1; assert.equal(game.perception(1).shells.length, 1);
});

test('repeated mortar orders cannot bypass its five-second cadence', () => {
  const { game, mortar } = mortarGame();
  for (let i = 0; i < 110; i++) { assert.equal(game.setMortarTarget(1, mortar.id, 9, 17).ok, true); game.update(.1); }
  const shots = game.events.filter(e => e.type === 'mortar-shot');
  assert.equal(shots.length, 3); close(shots[1].time - shots[0].time, 5); close(shots[2].time - shots[1].time, 5);
  assert.equal(game.events.filter(e => e.type === 'spawn').length, 0);
});

test('a visible obstacle is valid mortar ground and its blast can hit an adjacent enemy', () => {
  const { game, mortar } = mortarGame({ mapId: 'narrows' });
  for (let y = 15; y < 21; y++) game.tile(9, y).owner = 1;
  mortar.x = 9; mortar.y = 15;
  const enemy = game._addBuilding(2, 'relay', 6, 13);
  game.recompute(); assert.equal(game.tile(6, 14).blocked, true);
  assert.equal(game.setMortarTarget(1, mortar.id, 6, 14).ok, true);
  game.update(CONFIG.step); assert.deepEqual([game.shells[0].x, game.shells[0].y], [6.5, 14.5]);
  game.update(1.2); assert.equal(enemy.hp, 58); assert.equal(game.tile(6, 14).owner, 0);
});

test('blue plus yellow heals only nearby living allied units, capped at maximum health', () => {
  const game = mixtureGame(), wounded = unit(game, 1, 9, 20, 10), nearlyFull = unit(game, 1, 10, 20, 31), distant = unit(game, 1, 15, 22, 10), enemy = unit(game, 2, 9, 19, 10);
  game.recompute(); play(game, 'relay', 9, 21);
  const owners = game.tiles.map(t => t.owner), result = play(game, 'bleach', 9, 20);
  assert.equal(result.mixture, 'green'); assert.equal(result.healed, 13);
  assert.equal(wounded.hp, 22); assert.equal(nearlyFull.hp, 32); assert.equal(distant.hp, 10); assert.equal(enemy.hp, 10);
  assert.deepEqual(game.tiles.map(t => t.owner), owners); assert.equal(game._mixtureLast[1], null);
  const event = game.events.find(e => e.type === 'mixture'); assert.equal(event.radius, MIXTURE.radius); assert.equal(event.healed, 13);
  play(game, 'wave', 9, 20); assert.equal(game.events.filter(e => e.type === 'mixture').length, 1, 'Consumed pair cannot trigger again');
});

test('yellow then blue also mixes, and an intervening red card does not break the advertised window', () => {
  const reverse = mixtureGame(), a = unit(reverse, 1, 9, 20, 10);
  reverse.recompute(); play(reverse, 'bleach', 9, 21); assert.equal(play(reverse, 'wave', 9, 20).mixture, 'green'); assert.equal(a.hp, 22);
  const interleaved = mixtureGame(), b = unit(interleaved, 1, 9, 20, 10);
  interleaved.recompute(); play(interleaved, 'relay', 9, 21); play(interleaved, 'splash', 9, 18);
  assert.equal(interleaved._mixtureLast[1].color, 'blue'); assert.equal(play(interleaved, 'bleach', 9, 20).mixture, 'green'); assert.equal(b.hp, 22);
});

test('expired, distant or disabled combinations cannot heal, and invalid cards cannot prime a mix', () => {
  for (const cause of ['expired', 'distant', 'disabled']) {
    const game = mixtureGame(), wounded = unit(game, 1, 9, 20, 10);
    if (cause === 'disabled') game.mixtures = false;
    game.recompute(); play(game, 'relay', 9, 21);
    if (cause === 'expired') game.update(4.1);
    const result = play(game, 'bleach', 9, cause === 'distant' ? 18 : 20);
    assert.equal(result.mixture, undefined, cause); assert.equal(wounded.hp, 10, cause);
  }
  const game = mixtureGame();
  assert.equal(game.playCard(1, 1, 9, 3).ok, false); assert.equal(game._mixtureLast[1], null);
  play(game, 'relay', 9, 21); const pending = structuredClone(game._mixtureLast[1]);
  assert.equal(game.playCard(1, 1, 9, 3).ok, false); assert.deepEqual(game._mixtureLast[1], pending);
});

test('mixture state is independent per camp and perceptions cannot mutate live targets', () => {
  const game = mixtureGame();
  play(game, 'relay', 9, 21); assert.equal(game._mixtureLast[2], null);
  const view = game.perception(1); view.mixtureLast.color = 'yellow'; assert.equal(game._mixtureLast[1].color, 'blue');
  const { game: mortarWorld, mortar } = mortarGame(); mortarWorld.setMortarTarget(1, mortar.id, 9, 17);
  mortarWorld.perception(1).buildings.find(b => b.id === mortar.id).mortarTarget.y = 5;
  assert.deepEqual(mortar.mortarTarget, { x: 9, y: 17 });
});

test('maps, vernis and shells continue deterministically across frame slicing', () => {
  const options = { mapId: 'crossroads', mixtures: true, modifiers: [null, { brushBonus: 3, reinforcementSpeed: .15, buildingHealth: .2 }, null] };
  const a = mortarGame(options), b = mortarGame(options);
  for (const state of [a, b]) { assert.equal(state.game.setMortarTarget(1, state.mortar.id, 9, 17).ok, true); }
  a.game.update(13.2); for (let i = 0; i < 132; i++) b.game.update(.1);
  const snapshot = g => { const value = JSON.parse(JSON.stringify(g)); delete value._accumulator; return value; };
  assert.deepEqual(snapshot(a.game), snapshot(b.game)); close(a.game._accumulator, b.game._accumulator);
});

test('a terminal power played between simulation ticks clears residual time for saving', () => {
  const game = new Game(), enemy = game.getCore(2);
  for (let y = 4; y <= 20; y++) game.tile(9, y).owner = 1;
  enemy.hp = 1; game.recompute(); game.update(.01);
  assert.ok(game._accumulator > 0); assert.equal(game.winner, null);
  play(game, 'splash', 9, 3);
  assert.equal(game.winner, 1); assert.equal(game._accumulator, 0);
});

console.log(`\n${checks} paint course-engine checks passed.`);
