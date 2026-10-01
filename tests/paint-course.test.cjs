'use strict';
const assert = require('node:assert/strict');
const C = require('../paint-course.js');
const E = require('../paint-engine.js');
const AI = require('../paint-ai.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('✓', name); }
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function start(seed = 8) { const run = C.create({ seed }); run.startFight(); return run; }
function advance(run, seconds) { for (let i = 0; i < Math.round(seconds * 30); i++) run.update(1 / 30); }
function finish(run, winner = 1) {
  const game = run.game;
  for (const team of winner === 0 ? [1, 2] : [3 - winner]) game._damage(game.getCore(team), 10000);
  game._removeDead(); game.recompute(); game._checkVictory(0); run.update(0);
  assert.equal(game.winner, winner);
}
function roundTrip(run) {
  const snapshot = C.snapshot(run);
  assert.equal(C.validate(snapshot), true);
  const restored = C.restore(JSON.stringify(snapshot));
  assert.deepEqual(C.snapshot(restored), snapshot);
  return restored;
}
function select(run, id) {
  finish(run);
  assert.equal(run.chooseReward(id || run.offers[0].id).ok, true);
  run.startFight();
  return run;
}
function seedOffering(id) {
  for (let seed = 0; seed < 100; seed++) {
    const run = start(seed); finish(run);
    if (run.offers.some(r => r.id === id)) return seed;
  }
  throw new Error('Reward not found: ' + id);
}
// Test fixtures may place a card in hand without altering the eight-card
// multiset. The actual placement, price, mixture and aiming still use actions.
function bringCard(game, id, handIndex = 0, team = 1) {
  const current = game.hands[team].indexOf(id);
  if (current >= 0) [game.hands[team][handIndex], game.hands[team][current]] = [game.hands[team][current], game.hands[team][handIndex]];
  else {
    const deckIndex = game.decks[team].indexOf(id); assert.notEqual(deckIndex, -1, id);
    [game.hands[team][handIndex], game.decks[team][deckIndex]] = [game.decks[team][deckIndex], game.hands[team][handIndex]];
  }
}
function play(game, id, x, y, team = 1) {
  bringCard(game, id, 0, team);
  const result = game.playCard(team, 0, x, y);
  assert.equal(result.ok, true, result.message);
  return result.buildingId ? game.buildings.find(b => b.id === result.buildingId) : result;
}
function connectedFixture(game, team, cells) {
  for (const [x, y] of cells) { const tile = game.tile(x, y); assert.equal(tile.blocked, false); tile.owner = team; }
  game.recompute();
}

test('three distinct encounters start progressively with the original eight cards', () => {
  const run = C.create({ seed: 71 });
  assert.equal(run.phase, 'briefing'); assert.equal(run.game, null); assert.equal(run.seed, 71);
  assert.equal(C.ENCOUNTERS.length, 3);
  assert.deepEqual(C.ENCOUNTERS.map(e => e.mapId), ['canvas', 'narrows', 'crossroads']);
  assert.deepEqual(C.ENCOUNTERS.map(e => e.profile), ['rapid', 'builder', 'eraser']);
  assert.deepEqual(run.deck, E.DEFAULT_DECK);
  roundTrip(run);
  const game = run.startFight();
  assert.equal(game, run.game); assert.equal(run.phase, 'combat');
  assert.equal(game.mixtures, false); assert.equal(game.mapId, 'canvas'); assert.equal(run.aiState.profile, 'rapid');
  assert.equal(game.duration, 240); assert.equal(game.pigment[1], 65); roundTrip(run);
});

test('a fight cannot be reset in progress and an unavailable reward changes nothing', () => {
  const run = start(); advance(run, 2);
  const before = C.serialize(run);
  assert.throws(() => run.startFight(), /déjà lancé/);
  assert.equal(run.chooseReward('mortar').ok, false);
  assert.equal(C.serialize(run), before);
});

test('the first choice always offers a card, varnish and upgrade, fixed across reloads', () => {
  const run = start(217); finish(run);
  assert.equal(run.phase, 'reward'); assert.equal(run.offers.length, 3);
  assert.deepEqual(run.offers.map(r => r.type), ['card', 'varnish', 'upgrade']);
  const restored = roundTrip(run); const offers = restored.offers.map(r => r.id);
  for (let i = 0; i < 10; i++) restored.update(1000);
  assert.deepEqual(restored.offers.map(r => r.id), offers);
  assert.equal(restored.chooseReward('mortar').ok, true);
  const once = C.serialize(restored);
  assert.equal(restored.chooseReward('mortar').ok, false);
  assert.equal(C.serialize(restored), once);
  const next = C.restore(once);
  assert.equal(next.phase, 'briefing'); assert.equal(next.encounterIndex, 1);
  assert.deepEqual(next.chosenRewards, ['mortar']);
  assert.equal(next.deck.length, 8); assert.equal(next.deck.filter(id => id === 'barracks').length, 1);
  assert.equal(next.deck[7], 'mortar');
});

test('each new fight resets combat supplies and introduces only persistent chosen rewards', () => {
  const run = start(); const first = run.game;
  play(first, 'barracks', 9, 21); first.getCore(1).hp -= 25;
  assert.ok(first.pigment[1] < 65); finish(run);
  run.chooseReward('mortar'); roundTrip(run); run.startFight();
  assert.equal(run.game.mapId, 'narrows'); assert.equal(run.game.mixtures, true);
  assert.equal(run.aiState.profile, 'builder'); assert.equal(run.game.pigment[1], 65);
  assert.equal(run.game.getCore(1).hp, 240); assert.equal(run.game.units.length, 0);
  assert.equal(run.game.buildings.length, 2); assert.equal(run.game.time, 0);
  assert.deepEqual(run.game.hands[1].concat(run.game.decks[1]), run.deck);
  roundTrip(run);
});

test('all offered varnishes and discounts affect the next fight and survive a reload', () => {
  for (const id of ['long-brush', 'swift-stream', 'hard-coat', 'barracks-discount', 'splash-discount']) {
    const run = select(start(seedOffering(id)), id); const game = run.game;
    if (id === 'long-brush') assert.equal(game.getBrushLimit(1), 15);
    if (id === 'swift-stream') assert.equal(game.modifiers[1].reinforcementSpeed, .15);
    if (id === 'hard-coat') {
      assert.equal(game.getCore(1).maxHp, 288); assert.equal(game.upgradeCore(1).ok, true);
      assert.equal(game.getCore(1).maxHp, 384);
    }
    if (id === 'barracks-discount') assert.equal(game.getCard(1, 'barracks').cost, 26);
    if (id === 'splash-discount') assert.equal(game.getCard(1, 'splash').cost, 12);
    roundTrip(run);
  }
});

test('the second reward remains eligible and completion grants no fourth fight', () => {
  const run = select(start(4), 'mortar'); finish(run);
  assert.equal(run.phase, 'reward'); assert.equal(run.presentation().wins, 2);
  assert.equal(run.offers.length, 3); assert.equal(run.offers.some(r => r.id === 'mortar'), false);
  const restored = roundTrip(run); const id = restored.offers[1].id;
  assert.equal(restored.chooseReward(id).ok, true); roundTrip(restored);
  restored.startFight(); assert.equal(restored.encounterIndex, 2); assert.equal(restored.game.mapId, 'crossroads');
  assert.equal(restored.game.hands[2].concat(restored.game.decks[2]).includes('mortar'), true);
  assert.equal(restored.aiState.profile, 'eraser'); finish(restored);
  assert.equal(restored.phase, 'won'); assert.equal(restored.presentation().wins, 3); assert.equal(restored.offers.length, 0);
  roundTrip(restored); assert.throws(() => restored.startFight());
});

test('a real defeat ends the course and cannot be turned into a free retry', () => {
  const run = start(); finish(run, 2);
  assert.equal(run.phase, 'lost'); assert.equal(run.offers.length, 0); assert.equal(run.chooseReward('mortar').ok, false);
  const restored = roundTrip(run); assert.throws(() => restored.startFight());
  const bad = C.snapshot(run); bad.phase = 'draw'; bad.draws = 1;
  assert.throws(() => C.restore(bad), /résultat/);
});

test('a genuine overtime draw retries the same encounter without a reward or reroll', () => {
  const run = start(98), game = run.game;
  game.time = 270; game.overtime = true; game.accelerated = true; game.recompute(); game._checkVictory(0); run.update(0);
  assert.equal(game.winner, 0); assert.equal(run.phase, 'draw'); assert.equal(run.draws, 1); assert.equal(run.offers.length, 0);
  const restored = roundTrip(run); const seed = restored.game.seed; restored.startFight();
  assert.equal(restored.phase, 'combat'); assert.equal(restored.encounterIndex, 0); assert.equal(restored.game.seed, seed);
  assert.equal(restored.chosenRewards.length, 0); assert.equal(restored.game.time, 0); roundTrip(restored);
});

test('combat continues identically after JSON restore, including AI decisions and fractional time', () => {
  const original = start(19);
  play(original.game, 'barracks', 9, 21);
  original.game.setFlow(1, original.game.buildings.find(b => b.team === 1 && b.type === 'barracks').id, 9, 18);
  advance(original, 37); original.update(.017);
  const restored = roundTrip(original);
  assert.equal(restored.game.events.length, 0);
  for (let i = 0; i < 3500 && original.phase === 'combat'; i++) {
    const dt = [1 / 60, 1 / 30, .047, .011][i % 4]; original.update(dt); restored.update(dt);
    if (i % 450 === 0) assert.deepEqual(C.snapshot(restored), C.snapshot(original));
  }
  assert.deepEqual(C.snapshot(restored), C.snapshot(original));
  assert.ok(original.game.time > 110);
});

test('saving a held gesture cancels only transient protection without spending or elapsed time', () => {
  const run = start(); const barracks = play(run.game, 'barracks', 9, 21); advance(run, 4.9);
  run.game.setSpendingHeld(1, true); const before = run.game.pigment[1], time = run.game.time;
  const saved = C.snapshot(run);
  assert.equal(run.game.spendingHeld[1], true); assert.equal(saved.game.spendingHeld[1], false);
  assert.equal(saved.game.buildings.find(b => b.id === barracks.id).productionState, 'running');
  const restored = C.restore(JSON.stringify(saved));
  assert.equal(restored.game.time, time); assert.equal(restored.game.pigment[1], before); assert.equal(restored.game.events.length, 0);
  assert.equal(restored.game.spendingHeld[1], false); advance(restored, .2);
  assert.equal(restored.game.units.filter(u => u.team === 1).length, 1);
  assert.equal(restored.game.events.filter(e => e.type === 'spawn' && e.team === 1).length, 1);
});

test('a launched mortar shell and blue-yellow mixture candidate resume on their exact next tick', () => {
  const run = select(start(8), 'mortar'), game = run.game;
  const mortar = play(game, 'mortar', 9, 21); game.pigment[1] = 100;
  assert.equal(game.setMortarTarget(1, mortar.id, 9, 17).ok, true);
  play(game, 'wave', 9, 20); run.update(1 / 30);
  assert.equal(game.shells.length, 1); assert.equal(game._mixtureLast[1].color, 'blue');
  const shell = copy(game.shells[0]), restored = roundTrip(run);
  assert.deepEqual(restored.game.shells[0], shell); assert.equal(restored.game.events.length, 0);
  for (const current of [run, restored]) {
    play(current.game, 'bleach', 9, 20);
    assert.equal(current.game._mixtureLast[1], null);
    advance(current, 2);
  }
  assert.deepEqual(C.snapshot(restored), C.snapshot(run));
  assert.equal(restored.game.events.filter(e => e.type === 'mortar-impact').length, 1);
  assert.equal(restored.game.events.filter(e => e.type === 'mixture').length, 1);
});

test('visible obstacle ground can be aimed at and saved while a shell flies toward it', () => {
  const run = select(start(8), 'mortar'), game = run.game;
  connectedFixture(game, 1, [[9, 19], [9, 18], [9, 17], [8, 17], [7, 17]]);
  const mortar = play(game, 'mortar', 7, 17);
  assert.equal(game.tile(6, 14).blocked, true);
  assert.equal(game.setMortarTarget(1, mortar.id, 6, 14).ok, true); run.update(1 / 30);
  assert.equal(game.shells.length, 1); roundTrip(run);
});

test('camera, selected producer and fog history survive; old events never replay', () => {
  const run = start(); const producer = play(run.game, 'barracks', 9, 21);
  run.view = { camera: { zoom: 2.2, cx: 8.4, cy: 19.5 }, selectedProducer: producer.id };
  advance(run, 12); const before = C.snapshot(run); const restored = roundTrip(run);
  assert.deepEqual(restored.view, run.view); assert.deepEqual(restored.game.explored, before.game.explored);
  assert.deepEqual(restored.game.tiles.map(t => t.lastSeenOwner), before.game.tiles.map(t => t.lastSeenOwner));
  assert.equal(restored.game.events.length, 0); assert.equal(restored.game._eventId, before.game._eventId);
  run.game._damage(producer, 1000); run.game._removeDead(); run.game.recompute();
  assert.equal(C.snapshot(run).view.selectedProducer, null); roundTrip(run);
});

test('unknown versions, oversized text, extra keys, accessors and exotic prototypes are rejected safely', () => {
  const source = C.snapshot(C.create({ seed: 2 }));
  const future = copy(source); future.version = 99; const raw = JSON.stringify(future);
  assert.throws(() => C.restore(raw), /autre version/); assert.equal(JSON.stringify(future), raw);
  assert.throws(() => C.restore('x'.repeat(C.MAX_SAVE_BYTES + 1)), /taille/);
  assert.throws(() => C.restore('{no json'), /illisible/);
  const extra = copy(source); extra.offlineTime = 500; assert.throws(() => C.restore(extra), /champs/);
  const polluted = copy(source); Object.setPrototypeOf(polluted.view, { harmless: true }); assert.throws(() => C.restore(polluted), /prototype/);
  let reads = 0; const accessor = copy(source); Object.defineProperty(accessor, 'seed', { enumerable: true, get() { reads++; return 2; } });
  assert.throws(() => C.restore(accessor), /valeur simple/); assert.equal(reads, 0);
  const sparse = copy(source); sparse.chosenRewards = new Array(1); assert.throws(() => C.restore(sparse));
});

test('invalid combat fields, geometry, hidden information, arrays and derived totals are rejected', () => {
  const run = start(); play(run.game, 'barracks', 9, 21); advance(run, 10);
  const source = C.snapshot(run);
  const mutations = [
    s => { s.game.time = Infinity; },
    s => { s.game.time = -1; },
    s => { s.game.pigment[1] = 101; },
    s => { s.game.scores[1] = .8; },
    s => { s.game.income[1] = 7; },
    s => { s.game.tiles[0].blocked = true; },
    s => { s.game.tiles[0].connected = true; },
    s => { s.game.tiles[0].lastSeenOwner[1] = 2; },
    s => { s.game.visibility[1][0] = true; },
    s => { s.game.buildings[0].hp = 999; },
    s => { s.game.buildings[0].maxHp = 999; },
    s => { s.game.buildings[1].id = s.game.buildings[0].id; },
    s => { s.game.units[0].producerId = s.game.getCore; },
    s => { s.game.units[0].attackCooldown = -1; },
    s => { s.game.units[0].path = Array(600).fill({ x: .5, y: .5 }); },
    s => { s.game.hands[1][0] = 'mortar'; },
    s => { s.game.modifiers[1].brushBonus = 3; },
    s => { s.game.spendingHeld[1] = true; },
    s => { s.game._eventId = 2000000; },
    s => { s.game.tiles.push(copy(s.game.tiles[0])); }
  ];
  mutations.forEach((mutate, index) => { const bad = copy(source); mutate(bad); assert.throws(() => C.restore(bad), undefined, 'mutation ' + index); });
});

test('AI profile, timing, unknown memory fields and repeated memories are bounded', () => {
  const run = start(); advance(run, 35); const source = C.snapshot(run);
  for (const mutate of [
    s => { s.ai.profile = 'eraser'; },
    s => { s.ai.state.nextThink = 999999; },
    s => { s.ai.state.lastBrush = -Infinity; },
    s => { s.ai.state.cheat = true; },
    s => { s.ai.state.pausedByAI = [2, 2]; },
    s => { s.ai.state.orders = [[2, { x: 999, y: 0 }]]; },
    s => { s.ai.state.observations = [[9999, { id: 9999, x: 1, y: 1, type: 'core', seenAt: 0 }]]; }
  ]) { const bad = copy(source); mutate(bad); assert.throws(() => C.restore(bad)); }
});

test('phase, winning condition, chosen history and reward offers must agree', () => {
  const run = start(8); finish(run); const source = C.snapshot(run);
  for (const mutate of [
    s => { s.phase = 'won'; },
    s => { s.offerIds.reverse(); },
    s => { s.chosenRewards = ['mortar']; },
    s => { s.seed++; },
    s => { s.game.winner = 2; },
    s => { s.encounterIndex = 1; }
  ]) { const bad = copy(source); mutate(bad); assert.throws(() => C.restore(bad)); }
  const alive = C.snapshot(start(8)); alive.phase = 'reward'; alive.game.winner = 1; alive.game.winReason = 'Inventé'; alive.offerIds = source.offerIds;
  assert.throws(() => C.restore(alive), /condition de victoire/);
});

test('restoring does not modify its input or advance time, and returned state is independent', () => {
  const run = start(31); advance(run, 8); const saved = C.snapshot(run), before = copy(saved);
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  freeze(saved); const restored = C.restore(saved);
  assert.deepEqual(saved, before); assert.equal(restored.game.time, before.game.time);
  restored.game.pigment[1]--; restored.game.tiles[0].owner = 2;
  assert.deepEqual(saved, before);
  assert.equal(restored.aiState.profile, 'rapid'); assert.notEqual(restored.aiState.state, saved.ai.state);
});

console.log(checks + ' paint course checks passed.');
