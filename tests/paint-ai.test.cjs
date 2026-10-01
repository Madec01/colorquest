'use strict';
const assert = require('node:assert/strict');
const { Game, BUILDING_STATS } = require('../paint-engine.js');
const AI = require('../paint-ai.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('✓ ' + name); }
function advance(game, seconds, update = (g, dt) => AI.update(g, dt)) {
  for (let n = 0; n < Math.round(seconds * 10) && game.winner === null; n++) {
    game.update(.1); update(game, .1);
  }
}
const commands = ['paint', 'playCard', 'setFlow', 'toggleProduction', 'upgradeCore', 'setMortarTarget'];
function record(game) {
  const calls = [];
  for (const name of commands) {
    const original = game[name];
    if (typeof original !== 'function') continue;
    game[name] = function (...args) {
      const result = original.apply(this, args);
      calls.push({ name, args: structuredClone(args), ok: result.ok });
      return result;
    };
  }
  return calls;
}

test('The AI uses safe perception and ordinary actions, without raw world getters', () => {
  const game = new Game({ seed: 7 });
  const calls = record(game);
  const forbidden = new Set(['tiles', 'buildings', 'units', 'visibility', 'explored', 'hands', 'decks', 'pigment', 'income']);
  const safeGame = new Proxy(game, {
    get(target, property) {
      assert.ok(!forbidden.has(property), 'Unsafe AI access: ' + String(property));
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, property) { throw new Error('AI may not assign game.' + String(property)); }
  });
  advance(game, 40, (_, dt) => AI.update(safeGame, dt));
  assert.ok(calls.some(call => call.name === 'playCard' && call.ok), 'Develops with real cards');
  assert.ok(calls.some(call => call.name === 'paint' && call.ok), 'Paints through the paid brush API');
  assert.ok(calls.some(call => call.name === 'setFlow' && call.ok), 'Commands a real producer');
  assert.ok(game.units.some(unit => unit.team === 2), 'A paid producer has created troops');
  assert.ok(game.pigment[2] >= 0 && game.pigment[2] <= 100);
});

test('Changing hidden enemy ownership, troops, buildings and resources does not change a decision', () => {
  for (const profile of Object.keys(AI.PROFILES)) for (const elapsed of [0, 12, 35, 65]) {
    const a = new Game({ seed: 13 });
    const b = new Game({ seed: 13 });
    AI.configure(a, 2, { profile }); AI.configure(b, 2, { profile });
    advance(a, elapsed);
    advance(b, elapsed);
    const pa = a.perception(2), pb = b.perception(2);
    assert.deepEqual(pa, pb);
    const unseen = pb.tiles.filter(tile => !tile.visible && !tile.blocked && tile.y > 20);
    assert.ok(unseen.length > 0, 'The fixture needs real unseen ground');
    const spot = unseen[0];
    for (const tile of unseen.slice(0, 5)) b.tile(tile.x, tile.y).owner = tile.owner === 1 ? 0 : 1;
    const hiddenCore = b.getCore(1);
    if (hiddenCore && !pb.buildings.some(building => building.id === hiddenCore.id)) hiddenCore.hp = 1;
    b.pigment[1] = 100;
    b.hands[1].reverse();
    b.buildings.push({ id: 90001, team: 1, type: 'barracks', x: spot.x, y: spot.y, hp: 1, maxHp: 100,
      connected: true, level: 1, productionPaused: true, productionProgress: 0, flow: null });
    b.units.push({ id: 90002, team: 1, producerId: 90001, x: spot.x + .5, y: spot.y + .5,
      hp: 1, maxHp: 30, target: null });
    // Do not recompute the world or advance those fixture units: this assertion
    // concerns the next decision with an identical current observation.
    assert.deepEqual(a.perception(2), b.perception(2));
    const callsA = record(a), callsB = record(b);
    a.time += 1; b.time += 1;
    AI.update(a, 1); AI.update(b, 1);
    assert.deepEqual(callsA, callsB, `Hidden-state dependence for ${profile} at ${elapsed}s`);
  }
});

test('An unchanged simulation clock does not allow extra AI actions while paused', () => {
  const game = new Game({ seed: 7 });
  const calls = record(game);
  advance(game, 5);
  const before = structuredClone(calls);
  for (let frame = 0; frame < 1000; frame++) AI.update(game, .1);
  assert.deepEqual(calls, before);
});

test('A public domination threat redirects troops toward an actually visible connection', () => {
  const game = new Game({ seed: 7 });
  assert.equal(game.playCard(2, game.hands[2].indexOf('barracks'), 9, 5).ok, true);
  advance(game, 6, () => {});
  for (const tile of game.tiles) if (!tile.blocked && (tile.y >= 14 || (tile.x === 9 && tile.y >= 8))) tile.owner = 1;
  game.recompute();
  assert.ok(game.scores[1] > .42);
  const before = game.perception(2);
  assert.ok(before.units.some(unit => unit.team === 2));
  const calls = record(game);
  AI.update(game, 0);
  game.update(.9); AI.update(game, .9);
  const flow = calls.find(call => call.name === 'setFlow' && call.ok);
  assert.ok(flow, 'The defender responds to the public domination bar');
  const destination = before.tiles[flow.args[3] * game.width + flow.args[2]];
  assert.equal(destination.visible, true);
  assert.equal(destination.owner, 1, 'Targets a seen enemy line, rather than an invented hidden weak point');
});

test('No AI orders or state reads are emitted after the match has ended', () => {
  const game = { winner: 2, get time() { throw new Error('Read after winner'); },
    perception() { throw new Error('Observed after winner'); } };
  AI.update(game, 100);
});

test('Reset makes a replay reproduce its opening decisions', () => {
  const a = new Game({ seed: 42 }), b = new Game({ seed: 42 });
  const callsA = record(a), callsB = record(b);
  AI.reset(a); AI.reset(b);
  advance(a, 15); advance(b, 15);
  assert.deepEqual(callsA, callsB);
  assert.deepEqual(a.perception(2), b.perception(2));
});

test('Course profiles configure decisions without changing any world statistic or card', () => {
  for (const profile of Object.keys(AI.PROFILES)) {
    const game = new Game({ seed: 53 });
    const before = structuredClone({ ...game });
    assert.equal(AI.configure(game, 2, { profile }), true);
    assert.deepEqual({ ...game }, before);
    const data = AI.snapshot(game);
    assert.equal(data.profile, profile);
    assert.equal(data.state.lastTime, 0);
    assert.ok(data.state.nextThink > 0 && data.state.nextThink <= 1);
    assert.deepEqual(JSON.parse(JSON.stringify(data)), data, 'No NaN, Infinity, undefined, Map or Set in a save');
  }
});

test('Saving, serializing and restoring every profile continues the same choices and simulation', () => {
  for (const profile of Object.keys(AI.PROFILES)) {
    const a = new Game({ seed: 79 });
    AI.configure(a, 2, { profile });
    advance(a, 63);
    const savedWorld = structuredClone({ ...a }), data = JSON.parse(JSON.stringify(AI.snapshot(a)));
    const b = Object.assign(new Game({ seed: 79 }), savedWorld);
    assert.equal(AI.restore(b, data), true);
    assert.deepEqual(AI.snapshot(a), AI.snapshot(b));
    const callsA = record(a), callsB = record(b);
    advance(a, 52); advance(b, 52);
    assert.deepEqual(callsA, callsB, profile + ' decisions after loading');
    assert.deepEqual(a.perception(1), b.perception(1), profile + ' observed world after loading');
    assert.deepEqual(a.perception(2), b.perception(2));
    assert.deepEqual(AI.snapshot(a), AI.snapshot(b));
  }
});

test('Invalid AI saves are refused without replacing live decision memory', () => {
  const game = new Game({ seed: 7 });
  AI.configure(game, 2, { profile: 'eraser' }); advance(game, 14);
  const before = AI.snapshot(game);
  assert.equal(AI.configure(game, 2, { profile: 'constructor' }), false);
  assert.equal(AI.configure(game, 2, { profile: 'toString' }), false);
  assert.deepEqual(AI.snapshot(game), before);
  for (const mutate of [d => { d.version = 99; }, d => { d.profile = 'omniscient'; },
    d => { d.profile = 'constructor'; }, d => { d.profile = 'toString'; }, d => { d.team = 1; }, d => { d.state.lastBrush = NaN; }, d => { d.state.nextThink = game.time + 3; },
    d => { d.state.orders = [[3, { x: -1, y: 4 }]]; }, d => { d.state.pausedByAI = [3, 3]; },
    d => { d.state.observations = [[999, { id: 999, x: 3, y: 3, type: 'core', seenAt: game.time + 5 }]]; }]) {
    const data = structuredClone(before); mutate(data);
    assert.equal(AI.restore(game, data), false);
    assert.deepEqual(AI.snapshot(game), before);
  }
  const saved = AI.snapshot(game);
  assert.equal(AI.restore(game, saved), true);
  saved.state.orders.push([987654, { x: 1, y: 1 }]);
  assert.deepEqual(AI.snapshot(game), before, 'Live memory is not aliased to the input');
});

test('The three named opponents make genuinely different ordinary choices', () => {
  const signatures = [];
  for (const profile of ['rapid', 'builder', 'eraser']) {
    const game = new Game({ seed: 17 }); AI.configure(game, 2, { profile });
    const calls = record(game); advance(game, 70);
    assert.ok(calls.some(call => call.name === 'paint' && call.ok));
    assert.ok(calls.some(call => call.name === 'playCard' && call.ok));
    signatures.push(JSON.stringify(calls));
  }
  assert.equal(new Set(signatures).size, 3);
});

test('An effective card discount is respected rather than testing the catalogue price', () => {
  const game = new Game({ seed: 7, modifiers: { 2: { cardDiscounts: { barracks: 6 } } } });
  game.pigment[2] = 26;
  AI.configure(game, 2, { profile: 'rapid' }); game.time = .8; AI.update(game, .8);
  assert.ok(game.buildings.some(b => b.team === 2 && b.type === 'barracks'));
  assert.equal(game.pigment[2], 0);
});

test('An available mortar is paid for and aimed only at a visible siege target', () => {
  const deck = ['mortar', 'barracks', 'extractor', 'wave', 'splash', 'relay', 'bleach', 'bastion'];
  const game = new Game({ seed: 7, decks: { 2: deck } });
  const producer = game._addBuilding(2, 'barracks', 9, 5);
  for (let y = 6; y <= 13; y++) game.tile(10, y).owner = 2;
  const hostile = game._addBuilding(1, 'bastion', 9, 16);
  game.tile(9, 16).owner = 1;
  game._addUnit(2, producer, { x: 10.5, y: 13.5 });
  game.time = 80; game.pigment[2] = 100; game.recompute();
  assert.ok(game.perception(2).buildings.some(b => b.id === hostile.id));
  AI.configure(game, 2, { profile: 'eraser' });
  const calls = record(game); game.time += .8; AI.update(game, .8);
  const mortar = game.buildings.find(b => b.team === 2 && b.type === 'mortar');
  assert.ok(mortar, 'Ordinary mortar placement from the hand');
  assert.equal(game.pigment[2], 100 - game.getCard(2, 'mortar').cost);
  game.time += .8; AI.update(game, .8);
  const aim = calls.find(call => call.name === 'setMortarTarget' && call.ok);
  assert.ok(aim);
  assert.deepEqual(aim.args.slice(2), [hostile.x, hostile.y]);
  assert.equal(game.previewMortarTarget(2, mortar.id, ...aim.args.slice(2)).ok, true);
});

test('A visible mortar warning prompts a legal escape order without exposing its hidden launcher', () => {
  const game = new Game({ seed: 7 });
  const producer = game._addBuilding(2, 'barracks', 9, 5);
  game._addUnit(2, producer, { x: 9.5, y: 7.5 }); game.recompute();
  const shell = { id: 9001, team: 1, x: 9.5, y: 7.5, sourceId: 9999,
    fromX: 15.5, fromY: 20.5, remaining: 1.2, total: 1.2, radius: 1.5 };
  game.shells.push(shell);
  const seen = game.perception(2).shells[0];
  assert.equal(seen.sourceId, undefined); assert.equal(seen.fromX, undefined);
  AI.configure(game, 2, { profile: 'eraser' }); game.time = .8;
  const calls = record(game); AI.update(game, .8);
  const order = calls.find(call => call.name === 'setFlow' && call.args[1] === producer.id && call.ok);
  assert.ok(order);
  assert.ok(Math.hypot(order.args[2] + .5 - shell.x, order.args[3] + .5 - shell.y) > shell.radius + .6);
});

test('The AI can complete a paid blue/yellow mixture to heal nearby wounded units', () => {
  const deck = ['wave', 'bleach', 'barracks', 'splash', 'extractor', 'relay', 'bastion', 'barracks'];
  const game = new Game({ seed: 7, mixtures: true, decks: { 2: deck } });
  const producer = game._addBuilding(2, 'barracks', 9, 5);
  const wounded = game._addUnit(2, producer, { x: 9.5, y: 5.5 }); wounded.hp = 10; game.recompute();
  assert.equal(game.playCard(2, game.hands[2].indexOf('wave'), 9, 5).ok, true);
  const pigment = game.pigment[2];
  AI.configure(game, 2, { profile: 'builder' }); game.time = .8; AI.update(game, .8);
  assert.equal(wounded.hp, 22);
  assert.equal(game.pigment[2], pigment - game.getCard(2, 'bleach').cost);
  assert.ok(game.events.some(event => event.type === 'mixture' && event.team === 2 && event.healed === 12));
});

console.log(`Paint AI: ${checks} checks passed.`);
