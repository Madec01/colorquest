'use strict';
const assert = require('node:assert/strict');
const { Game } = require('../paint-engine.js');
const AI = require('../paint-ai.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('✓ ' + name); }
function advance(game, seconds, update = (g, dt) => AI.update(g, dt)) {
  for (let n = 0; n < Math.round(seconds * 10) && game.winner === null; n++) {
    game.update(.1); update(game, .1);
  }
}
const commands = ['paint', 'playCard', 'setFlow', 'toggleProduction', 'upgradeCore'];
function record(game) {
  const calls = [];
  for (const name of commands) {
    const original = game[name];
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
  for (const elapsed of [0, 12, 35, 65]) {
    const a = new Game({ seed: 13 });
    const b = new Game({ seed: 13 });
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
    assert.deepEqual(callsA, callsB, `Hidden-state dependence at ${elapsed}s`);
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

console.log(`Paint AI: ${checks} checks passed.`);
