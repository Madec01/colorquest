'use strict';
const assert = require('node:assert/strict');
const E = require('../engine.js');
let passed = 0;
function test(name, fn) { fn(); console.log('✓ ' + name); passed++; }
function advance(game, seconds) { for (let i = 0; i < Math.round(seconds * 10) && game.winner === null; i++) game.update(.1); }
function arena() { const game = new E.Game({ seed: 42 }); game._aiThink = () => {}; game.money[1] = 10000; return game; }
function barracks(game, x = 12, y = 41) {
  const result = game.build(1, 'barracks', x, y); assert.ok(result.ok, result.message);
  return game.buildings.find(b => b.id === result.id);
}

test('Barracks are paid connected buildings; read-only placement never changes state', () => {
  const game = arena(), before = JSON.stringify(game);
  assert.ok(game.canBuild(1, 'barracks', 12, 41).ok);
  assert.equal(game.canBuild(1, 'barracks', 0, 0).ok, false);
  assert.equal(JSON.stringify(game), before);
  const money = game.money[1], building = barracks(game);
  assert.equal(game.money[1], money - E.COSTS.barracks);
  assert.equal(building.hp, 220); assert.equal(game.getBuildingStats(building).radius, 3);
  assert.deepEqual(building.queue, []); assert.equal(building.rally, null);
  assert.equal(game.getUpgradeCost(building.id), null);
  assert.equal(game.upgradeBuilding(1, building.id).ok, false);
});

test('Core and barracks train simultaneously with original prices and independent IDs', () => {
  const game = arena(), building = barracks(game), money = game.money[1];
  const coreJob = game.recruit(1, 'fighter'), remoteJob = game.recruit(1, 'fighter', building.id);
  assert.ok(coreJob.ok && remoteJob.ok);
  assert.equal(game.money[1], money - 2 * E.COSTS.fighter);
  assert.notEqual(coreJob.id, remoteJob.id);
  advance(game, 3);
  assert.ok(game.queues[1][0].remaining < 3.01);
  assert.equal(game.queues[1][0].remaining, building.queue[0].remaining);
  advance(game, 3);
  for (const [job, origin] of [[coreJob, game.getCore(1)], [remoteJob, building]]) {
    const unit = game.units.find(u => u.id === job.id);
    assert.ok(unit); assert.ok(Math.hypot(unit.x - origin.x - .5, unit.y - origin.y - .5) < 2);
  }
  assert.equal(game.queues[1].length, 0); assert.equal(building.queue.length, 0);
});

test('Each producer accepts six formations while every queue reserves the shared population', () => {
  const game = arena(), producers = [game.getCore(1)];
  while (producers.length < 6) {
    const tile = game.tiles.find(t => game.canBuild(1, 'barracks', t.x, t.y).ok);
    assert.ok(tile); producers.push(barracks(game, tile.x, tile.y));
  }
  const start = game.units.filter(u => u.team === 1).length;
  for (let i = 0; i < E.UNIT_LIMIT - start; i++) assert.ok(game.recruit(1, 'fighter', producers[Math.floor(i / 6)].id).ok);
  assert.equal(game.getQueuedCount(1) + start, E.UNIT_LIMIT);
  const money = game.money[1];
  assert.equal(game.recruit(1, 'fighter', producers.at(-1).id).ok, false);
  assert.equal(game.money[1], money);
  const firstQueue = game.getRecruitQueue(1, producers[1].id);
  assert.equal(firstQueue.length, 6);
  assert.equal(game.recruit(1, 'fighter', producers[1].id).ok, false);
  assert.ok(game.cancelRecruit(1, firstQueue[5].id, producers[1].id).ok);
  assert.ok(game.recruit(1, 'fighter', producers.at(-1).id).ok);
});

test('A real severed network pauses a started formation and a reconnection resumes it', () => {
  const game = arena(), building = barracks(game), job = game.recruit(1, 'fighter', building.id);
  assert.ok(job.ok); advance(game, 2);
  const remaining = building.queue[0].remaining;
  for (const tile of game.tiles) if (tile.x === 14) tile.owner = 2;
  game.recompute(); assert.equal(building.connected, false);
  advance(game, 2);
  assert.equal(building.queue[0].remaining, remaining);
  const money = game.money[1]; assert.equal(game.recruit(1, 'fighter', building.id).ok, false); assert.equal(game.money[1], money);
  game.tile(14, 41).owner = 1; game.recompute(); assert.equal(building.connected, true);
  advance(game, 4); assert.ok(game.units.some(u => u.id === job.id));
});

test('Cancellation is producer-scoped and pays the same active/waiting refund as the core', () => {
  const game = arena(), building = barracks(game);
  const first = game.recruit(1, 'fighter', building.id), second = game.recruit(1, 'breaker', building.id);
  assert.equal(game.cancelRecruit(1, first.jobId).ok, false);
  assert.equal(game.cancelRecruit(2, first.jobId, building.id).ok, false);
  assert.equal(game.cancelRecruit(1, second.jobId, building.id).refund, E.COSTS.breaker);
  assert.equal(game.cancelRecruit(1, first.jobId, building.id).refund, Math.floor(E.COSTS.fighter * .5));
  const money = game.money[1]; assert.equal(game.cancelRecruit(1, first.jobId, building.id).ok, false); assert.equal(game.money[1], money);
});

test('Destroyed barracks cancel and refund training once without spawning ghost units', () => {
  const game = arena(), building = barracks(game);
  const first = game.recruit(1, 'fighter', building.id), second = game.recruit(1, 'breaker', building.id);
  advance(game, 2); building.hp = 0;
  const money = game.money[1], earned = game.income[1] * .1;
  game.update(.1);
  assert.ok(Math.abs(game.money[1] - money - earned - Math.floor(E.COSTS.fighter * .5) - E.COSTS.breaker) < .0001);
  assert.equal(game.getRecruitProducers(1).some(b => b.id === building.id), false);
  assert.equal(game.events.filter(e => e.type === 'refund').length, 1);
  advance(game, 20);
  assert.equal(game.units.some(u => [first.id, second.id].includes(u.id)), false);
  assert.equal(game.events.filter(e => e.type === 'refund').length, 1);
});

test('Rally destinations belong to their producer and only affect its new units', () => {
  const game = arena(), building = barracks(game);
  const existing = game.units.filter(u => u.team === 1).map(u => JSON.stringify(u.order));
  assert.ok(game.setRally(1, 16, 35).ok);
  assert.ok(game.setRally(1, 8, 40, building.id).ok);
  assert.deepEqual(game.rally[1], { x: 16, y: 35 });
  assert.deepEqual(building.rally, { x: 8, y: 40 });
  assert.deepEqual(game.units.filter(u => u.team === 1).map(u => JSON.stringify(u.order)), existing);
  const coreJob = game.recruit(1, 'fighter'), remoteJob = game.recruit(1, 'fighter', building.id);
  advance(game, 6);
  assert.deepEqual(game.units.find(u => u.id === coreJob.id).order, { x: 16.5, y: 35.5, stance: 'move' });
  assert.deepEqual(game.units.find(u => u.id === remoteJob.id).order, { x: 8.5, y: 40.5, stance: 'move' });
  assert.equal(game.recruit(2, 'fighter', building.id).ok, false);
  assert.equal(game.setRally(2, 12, 40, building.id).ok, false);
});

test('Technology remains shared with the core and historical core queue calls stay valid', () => {
  const game = arena(), building = barracks(game);
  assert.equal(game.getRecruitQueue(1), game.queues[1]);
  assert.equal(game.recruit(1, 'engineer', building.id).ok, false);
  assert.ok(game.upgradeBuilding(1, game.getCore(1).id).ok);
  assert.ok(game.recruit(1, 'engineer', building.id).ok);
  assert.equal(building.queue[0].duration, game.getRecruitTime(1, 'engineer'));
  const state = JSON.parse(JSON.stringify(game));
  assert.deepEqual(E.Game.prototype.getBuildingStats.call(state, state.buildings.find(b => b.type === 'barracks')), { hp: 220, radius: 3 });
});

console.log(`${passed} barracks simulation checks passed.`);
