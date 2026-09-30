'use strict';
const assert = require('node:assert/strict');
const { Game } = require('../engine.js');
const M = require('../missions.js');
let passed = 0;
function test(name, fn) { fn(); console.log('✓ ' + name); passed++; }
function advance(game, seconds) { for (let i = 0; i < Math.round(seconds * 10) && game.winner === null; i++) game.update(.1); }
function game(id, seed = 42) { return new Game({ missionId: id, seed }); }
function act(result) { assert.ok(result.ok, result.message); return result; }
function army(g) { return g.units.filter(u => u.team === 1 && u.hp > 0).map(u => u.id); }
function train(g, count, producerId) { for (let i = 0; i < count; i++) act(g.recruit(1, 'fighter', producerId)); }
function bridge(g) { advance(g, 2); act(g.build(1, 'relay', 16, 33)); advance(g, 8); }
function sourceNetwork(g) { bridge(g); act(g.build(1, 'relay', 16, 28)); advance(g, 8); }

test('Five bounded portrait missions have explicit objectives and leave free matches intact', () => {
  assert.equal(M.catalog.length, 5);
  for (const def of M.catalog) {
    const g = game(def.id), b = M.bounds(def.id), status = M.status(g);
    assert.equal(g.mapId, `mission:${def.id}`); assert.equal(g.getCore(1).hp, 950);
    assert.equal(status.index, def.index); assert.ok(status.objective && status.hint && status.target.label);
    assert.ok(b.height > b.width);
    for (const tile of g.tiles) {
      const outside = tile.x < b.x || tile.x >= b.x + b.width || tile.y < b.y || tile.y >= b.y + b.height;
      assert.equal(tile.blocked, outside);
      if (!outside) assert.ok(tile.explored);
    }
    if (def.index < 3) assert.equal(g.units.length, 0);
  }
  const free = new Game(); assert.equal(free.mission, null); assert.ok(M.can(free, 'power', 'bleach')); assert.equal(M.status(free), null);
  assert.throws(() => game('invented'), /inconnue/);
});

test('Locked mechanics cannot be bypassed through engine APIs or spend pigment', () => {
  for (const def of M.catalog) {
    const g = game(def.id), money = g.money[1];
    assert.equal(g.build(1, 'bastion', 12, 39).ok, false);
    assert.equal(g.recruit(1, 'breaker').ok, false);
    assert.equal(g.power(1, 'impulse', 16, 39).ok, false);
    assert.equal(g.upgradeBuilding(1, g.getCore(1).id).ok, false);
    assert.equal(g.chooseSpecialization(1, 'mobility').ok, false);
    assert.equal(g.assignSquad(1, 0, []).ok, false);
    if (def.index < 5) assert.equal(g.build(1, 'barracks', 12, 39).ok, false);
    if (def.index < 3) assert.equal(g.recruit(1, 'fighter').ok, false);
    assert.equal(g.money[1], money); assert.equal(g.getQueuedCount(1), 0);
  }
});

test('Waiting never completes a mission and domination/time cannot replace its objective', () => {
  for (const def of M.catalog) {
    const g = game(def.id); advance(g, 80);
    assert.equal(g.winner, null); assert.equal(M.isComplete(g), false);
    g.time = 719.95; g.scores[1] = .9; g.hold[1] = 44.99; g.update(.1);
    assert.equal(g.winner, null);
    if (def.index < 5) assert.equal(g.mission.raids, 0);
    const fabricated = game(def.id); fabricated.winner = 1; fabricated.mission.stage = 2;
    assert.equal(M.status(fabricated).complete, false);
  }
});

test('Mission 1 completes only after a placed relay really reaches the target', () => {
  const g = game('first-ink'); advance(g, 15);
  assert.equal(g.tile(16, 27).owner, 0); assert.equal(g.winner, null);
  act(g.build(1, 'relay', 16, 33)); assert.equal(g.winner, null);
  advance(g, 10); assert.equal(g.winner, 1); assert.ok(M.isComplete(g));
});

test('Mission 2 requires actual connected extraction; merely claiming the source is insufficient', () => {
  const g = game('source'); sourceNetwork(g);
  assert.equal(g.tile(16, 24).owner, 1); assert.ok(g.tile(16, 24).connected);
  advance(g, 10); assert.equal(g.winner, null);
  const income = g.income[1]; act(g.build(1, 'extractor', 16, 24));
  assert.ok(g.income[1] > income); advance(g, 4); assert.equal(g.winner, null);
  advance(g, 2); assert.equal(g.winner, 1); assert.ok(M.isComplete(g));
});

test('Mission 3 uses real paid training, ordered movement and combat against the post', () => {
  for (const seed of [1, 42, 91]) {
    const g = game('contact', seed); train(g, 4); advance(g, 25);
    assert.equal(g.mission.trained, 4); assert.equal(g.winner, null);
    act(g.command(1, army(g), 'attack', 16, 20)); advance(g, 60);
    assert.equal(g.winner, 1); assert.ok(M.isComplete(g));
    assert.equal(g.buildings.some(b => b.team === 2), false);
    assert.ok(g.events.some(e => e.type === 'destroy' && e.team === 2));
  }
});

test('Mission 4 reconnects real income but requires a surviving defending group to finish', () => {
  const g = game('link'); assert.equal(g.buildings.find(b => b.type === 'extractor').connected, false);
  const initialIncome = g.income[1]; bridge(g);
  assert.equal(g.buildings.find(b => b.type === 'extractor').connected, true);
  assert.ok(g.income[1] > initialIncome); advance(g, 20); assert.equal(g.winner, null);
  train(g, 4); advance(g, 25); act(g.command(1, army(g), 'attack', 19, 23)); advance(g, 40);
  assert.equal(g.winner, 1); assert.ok(M.isComplete(g));
});

test('A slowly discovered isolated sector can be recovered after all its original ink decays', () => {
  const g = game('link'); advance(g, 40);
  assert.equal(g.tile(16, 23).owner, 0);
  bridge(g); advance(g, 12);
  assert.ok(g.buildings.find(b => b.type === 'extractor').connected);
  train(g, 4); advance(g, 25); act(g.command(1, army(g), 'attack', 19, 23)); advance(g, 40);
  assert.ok(M.isComplete(g));
});

test('Mission 5 adds paid enemy waves and requires training from a forward barracks', () => {
  for (const seed of [1, 42, 91]) {
    const g = game('outpost', seed); sourceNetwork(g);
    const result = act(g.build(1, 'barracks', 13, 25)); train(g, 3, result.id); advance(g, 22);
    assert.equal(g.mission.barracksTrained, 3); assert.equal(g.mission.hold, 0);
    act(g.command(1, army(g), 'attack', 16, 23)); advance(g, 8);
    act(g.build(1, 'extractor', 16, 23)); act(g.command(1, army(g), 'hold')); advance(g, 60);
    assert.equal(g.winner, 1); assert.ok(M.isComplete(g)); assert.ok(g.mission.raids >= 1);
    assert.equal(g.mission.hold, 20);
    assert.ok(g.events.some(e => e.type === 'recruit' && e.team === 2));
  }
});

test('Home production cannot stand in for the forward training objective, and a lost barracks stops the hold', () => {
  const g = game('outpost'); train(g, 2); advance(g, 12);
  assert.equal(g.mission.trained, 2); assert.equal(g.mission.barracksTrained, 0);
  const home = act(g.build(1, 'barracks', 12, 39)); train(g, 1, home.id); advance(g, 6);
  assert.equal(g.mission.barracksTrained, 0);
  sourceNetwork(g); advance(g, 55); const forward = act(g.build(1, 'barracks', 13, 25)); train(g, 2, forward.id); advance(g, 12);
  assert.equal(g.mission.barracksTrained, 2);
  // Prior successful training must not leave a wiped-out army with an
  // impossible movement hint. Fresh core reinforcements are now sufficient.
  for (const unit of g.units.filter(u => u.team === 1)) unit.hp = 0;
  g.update(.1);
  assert.equal(army(g).length, 0);
  assert.equal(g.mission.barracksTrained, 2);
  assert.deepEqual(M.status(g).action, { kind: 'recruit', type: 'fighter' });
  assert.match(M.status(g).hint, /caserne ou au Cœur/);
  g.mission.hold = 12; g.buildings.find(b => b.id === forward.id).hp = 0; g.update(.1);
  assert.equal(g.mission.hold, 0); assert.equal(g.winner, null);
  assert.deepEqual(M.status(g).action, { kind: 'recruit', type: 'fighter' });
  assert.match(M.status(g).hint, /au Cœur/);
  const reinforcement = act(g.recruit(1, 'fighter'));
  advance(g, 6);
  assert.ok(g.units.some(u => u.id === reinforcement.id));
  assert.deepEqual(M.status(g).action, { kind: 'recruit', type: 'fighter' });
  assert.equal(g.winner, null);
  assert.ok(g.money[1] > 0);
});

test('Every mission can lose its player core without reporting a victory; losing enemy core is not the objective', () => {
  for (const def of M.catalog) {
    const g = game(def.id); g.getCore(1).hp = 0; g.update(.1);
    assert.equal(g.winner, 2); assert.equal(M.isComplete(g), false);
  }
  const g = game('outpost'); g.getCore(2).hp = 0; g.update(.1);
  assert.equal(g.winner, null); assert.equal(M.isComplete(g), false);
});

test('Failed assaults remain recoverable with core income and repeatable recruitment', () => {
  const g = game('contact'); train(g, 2); advance(g, 12);
  for (const unit of g.units.filter(u => u.team === 1)) unit.hp = 0;
  g.update(.1); advance(g, 50); assert.equal(g.winner, null);
  train(g, 4); advance(g, 25); act(g.command(1, army(g), 'attack', 16, 20)); advance(g, 60);
  assert.ok(M.isComplete(g));
});

console.log(`${passed} mission simulation checks passed.`);
