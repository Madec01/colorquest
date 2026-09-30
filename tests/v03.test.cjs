'use strict';
const assert = require('node:assert/strict');
const { Game, COSTS, RECRUIT_TIMES, UNIT_LIMIT, QUEUE_LIMIT } = require('../engine.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ ' + name); }
function advance(game, seconds) {
  const steps = Math.round(seconds * 10);
  for (let n = 0; n < steps && game.winner === null; n++) game.update(.1);
}
function quiet(options = {}) {
  const game = new Game({ seed: 47, ...options });
  game._aiThink = () => {};
  return game;
}
function rich(game, team = 1) { game.money[team] = 5000; return game; }
function unlock(game, team = 1) {
  rich(game, team);
  assert.equal(game.upgradeBuilding(team, game.getCore(team).id).ok, true);
}
function choose(game, key) { unlock(game); assert.equal(game.chooseSpecialization(1, key).ok, true); }
function combatArena() {
  const game = quiet();
  game.units = [];
  game._spreadTerritory = () => {};
  game._captureTerritory = () => {};
  return game;
}

test('Training debits once, reserves the final ID and completes jobs sequentially', () => {
  const game = rich(quiet());
  const before = game.money[1], population = game.units.length;
  const first = game.recruit(1, 'fighter'), second = game.recruit(1, 'scout');
  assert.ok(first.ok && second.ok);
  assert.equal(game.money[1], before - COSTS.fighter - COSTS.scout);
  assert.equal(game.units.length, population);
  assert.equal(game.queues[1][0].started, true);
  assert.equal(game.queues[1][1].started, false);
  advance(game, RECRUIT_TIMES.fighter - .1);
  assert.equal(game.units.some(unit => unit.id === first.id), false);
  advance(game, .1);
  assert.equal(game.units.find(unit => unit.id === first.id).type, 'fighter');
  assert.equal(game.queues[1].length, 1);
  assert.equal(game.queues[1][0].remaining, RECRUIT_TIMES.scout);
  advance(game, RECRUIT_TIMES.scout);
  assert.equal(game.units.find(unit => unit.id === second.id).type, 'scout');
  assert.equal(game.queues[1].length, 0);
  assert.equal(new Set(game.units.map(unit => unit.id)).size, game.units.length);
});

test('Cancelling refunds a waiting job fully and the active job by 50%, once only', () => {
  const game = rich(quiet());
  const active = game.recruit(1, 'fighter'), waiting = game.recruit(1, 'breaker');
  const before = game.money[1];
  assert.equal(game.cancelRecruit(2, waiting.jobId).ok, false);
  assert.equal(game.cancelRecruit(1, waiting.jobId).refund, COSTS.breaker);
  assert.equal(game.money[1], before + COSTS.breaker);
  advance(game, 1);
  const during = game.money[1];
  assert.equal(game.cancelRecruit(1, active.jobId).refund, Math.floor(COSTS.fighter / 2));
  assert.equal(game.money[1], during + Math.floor(COSTS.fighter / 2));
  const refunded = game.money[1];
  assert.equal(game.cancelRecruit(1, active.jobId).ok, false);
  assert.equal(game.money[1], refunded);
  advance(game, 10);
  assert.equal(game.units.some(unit => unit.id === active.id || unit.id === waiting.id), false);
});

test('Queues enforce affordability, technology, six jobs and population reservations', () => {
  const game = rich(quiet());
  let before = game.money[1];
  assert.equal(game.recruit(1, 'engineer').ok, false);
  assert.equal(game.recruit(1, 'saboteur').ok, false);
  assert.equal(game.money[1], before);
  for (let n = 0; n < QUEUE_LIMIT; n++) assert.equal(game.recruit(1, 'fighter').ok, true);
  before = game.money[1];
  assert.equal(game.recruit(1, 'fighter').ok, false);
  assert.equal(game.money[1], before);
  const capped = rich(quiet());
  while (capped.units.filter(unit => unit.team === 1).length < UNIT_LIMIT - 1) capped._unit(1, 'fighter', 16.5, 41.5);
  assert.equal(capped.recruit(1, 'scout').ok, true);
  before = capped.money[1];
  assert.equal(capped.recruit(1, 'scout').ok, false);
  assert.equal(capped.money[1], before);
  const poor = quiet(); poor.money[1] = COSTS.fighter - 1;
  assert.equal(poor.recruit(1, 'fighter').ok, false);
  assert.equal(poor.queues[1].length, 0);
});

test('Rally points affect new units, reject walls and do not move existing units', () => {
  const game = rich(quiet());
  const existing = game.units.filter(unit => unit.team === 1);
  assert.equal(game.setRally(1, 11, 39).ok, true);
  assert.ok(existing.every(unit => !unit.order));
  const job = game.recruit(1, 'scout');
  advance(game, RECRUIT_TIMES.scout);
  const unit = game.units.find(unit => unit.id === job.id);
  assert.deepEqual(unit.order, { x: 11.5, y: 39.5, stance: 'move' });
  advance(game, 4);
  assert.ok(Math.hypot(unit.x - 11.5, unit.y - 39.5) < .01);
  game.tile(10, 39).blocked = true;
  assert.equal(game.setRally(1, 10, 39).ok, false);
  assert.deepEqual(game.rally[1], { x: 11, y: 39 });
  assert.equal(game.setRally(1, NaN, 39).ok, false);
});

test('Building upgrades retain prior damage, cap at three and reject invalid actions without debit', () => {
  const game = rich(quiet()), core = game.getCore(1), enemy = game.getCore(2);
  core.hp = 1;
  assert.equal(game.getUpgradeCost(core.id), 140);
  assert.equal(game.upgradeBuilding(1, core.id).ok, true);
  assert.equal(core.level, 2);
  assert.equal(core.hp, 301);
  assert.equal(core.maxHp, 1250);
  assert.equal(game.income[1], 3.5);
  assert.equal(game.upgradeBuilding(1, core.id).ok, true);
  assert.equal(core.level, 3);
  assert.equal(core.hp, 601);
  assert.equal(game.income[1], 4.5);
  const before = game.money[1];
  assert.equal(game.getUpgradeCost(core.id), null);
  assert.equal(game.upgradeBuilding(1, core.id).ok, false);
  assert.equal(game.upgradeBuilding(1, enemy.id).ok, false);
  assert.equal(game.upgradeBuilding(1, -10).ok, false);
  assert.equal(game.money[1], before);
  const relay = game._building(1, 'relay', 2, 2); game.recompute();
  assert.equal(game.upgradeBuilding(1, relay.id).ok, false);
  assert.equal(game.money[1], before);
  relay.connected = true; game.money[1] = 1;
  assert.equal(game.upgradeBuilding(1, relay.id).ok, false);
  assert.equal(game.money[1], 1);
});

test('Relay range, extractor income and bastion firepower grow with real upgrades', () => {
  const game = rich(quiet());
  const relay = game._building(1, 'relay', 13, 41);
  const extractor = game._building(1, 'extractor', 16, 44);
  const bastion = game._building(1, 'bastion', 19, 41);
  game.recompute();
  const income = game.income[1];
  for (const b of [relay, extractor, bastion]) {
    assert.equal(game.upgradeBuilding(1, b.id).ok, true);
    assert.equal(game.upgradeBuilding(1, b.id).ok, true);
  }
  assert.equal(game.getBuildingStats(relay).radius, 8);
  assert.equal(game.income[1], income - 3.1 + 6);
  assert.equal(game.getBuildingStats(bastion).range, 8);
  game.units = [];
  const foe = game._unit(2, 'fighter', 25.5, 41.5);
  game.update(.1);
  assert.equal(foe.hp, foe.maxHp - 24);
  assert.equal(game.getRecruitTime(1, 'fighter'), 6);
  assert.equal(game.upgradeBuilding(1, game.getCore(1).id).ok, true);
  assert.equal(game.getRecruitTime(1, 'fighter'), 5.1);
});

test('Specialization is paid once, requires core level two and permanently excludes the others', () => {
  const game = rich(quiet());
  let before = game.money[1];
  assert.equal(game.chooseSpecialization(1, 'expansion').ok, false);
  assert.equal(game.money[1], before);
  unlock(game); before = game.money[1];
  assert.equal(game.chooseSpecialization(1, 'expansion').ok, true);
  assert.equal(game.money[1], before - 100);
  before = game.money[1];
  assert.equal(game.chooseSpecialization(1, 'fortification').ok, false);
  assert.equal(game.chooseSpecialization(1, 'mobility').ok, false);
  assert.equal(game.money[1], before);
  assert.equal(game.specializations[1], 'expansion');
  assert.equal(game.getBuildingStats(game.getCore(1)).radius, 9);
  assert.equal(game.getCost(1, 'relay'), 34);
  assert.equal(game.build(1, 'relay', 16, 45).ok, true);
  assert.equal(game.money[1], before - 34);
  const relay = game.buildings.find(b => b.team === 1 && b.type === 'relay');
  assert.equal(game.getBuildingStats(relay).radius, 7);
});

test('Fortification affects existing and future buildings, and delays real territory decay', () => {
  const game = quiet(); unlock(game);
  const core = game.getCore(1); core.hp -= 500;
  assert.equal(game.chooseSpecialization(1, 'fortification').ok, true);
  assert.equal(core.maxHp, 1625);
  assert.equal(core.maxHp - core.hp, 500);
  assert.equal(game.build(1, 'relay', 16, 45).ok, true);
  assert.equal(game.buildings.find(b => b.team === 1 && b.type === 'relay').maxHp, 221);
  const normal = quiet();
  for (const g of [normal, game]) {
    g.tile(0, 0).owner = 1;
    g.recompute();
    for (let n = 0; n < 15; n++) g._spreadTerritory();
  }
  assert.equal(normal.tile(0, 0).owner, 0);
  assert.equal(game.tile(0, 0).owner, 1);
  for (let n = 0; n < 10; n++) game._spreadTerritory();
  assert.equal(game.tile(0, 0).owner, 0);
});

test('Mobility changes actual movement and shortens recruitment beyond core technology', () => {
  const normal = quiet(), mobile = quiet(); unlock(normal); choose(mobile, 'mobility');
  const movers = [];
  for (const game of [normal, mobile]) {
    game.units = [];
    const unit = game._unit(1, 'scout', 12.5, 41.5);
    movers.push(unit);
    game.order([unit.id], 12, 35);
    advance(game, .5);
  }
  const normalDistance = 41.5 - movers[0].y, mobileDistance = 41.5 - movers[1].y;
  assert.ok(Math.abs(mobileDistance / normalDistance - 1.2) < .0001);
  assert.equal(normal.getRecruitTime(1, 'fighter'), 5.1);
  assert.equal(mobile.getRecruitTime(1, 'fighter'), 4.3);
  const job = mobile.recruit(1, 'fighter');
  advance(mobile, 4.3);
  assert.ok(mobile.units.some(unit => unit.id === job.id));
});

test('Engineers repair one allied building in range, without attacking or healing enemies', () => {
  const game = combatArena();
  const relay = game._building(1, 'relay', 10, 23); relay.hp = 60;
  const enemyRelay = game._building(2, 'relay', 11, 23); enemyRelay.hp = 70;
  const engineer = game._unit(1, 'engineer', 10.5, 24.5);
  game.command(1, [engineer.id], 'hold');
  advance(game, 1);
  assert.ok(Math.abs(relay.hp - 72) < .001);
  assert.equal(enemyRelay.hp, 70);
  assert.equal(engineer.repairTargetId, relay.id);
  assert.ok(game.events.some(event => event.type === 'repair' && event.target));
  relay.hp = relay.maxHp - 1;
  advance(game, .2);
  assert.equal(relay.hp, relay.maxHp);
  advance(game, .1);
  assert.equal(engineer.repairTargetId, null);
});

test('Saboteurs prioritize relays even beside an enemy unit and deal their relay bonus', () => {
  const game = combatArena();
  const relay = game._building(2, 'relay', 10, 23);
  const saboteur = game._unit(1, 'saboteur', 10.5, 24.5);
  const foe = game._unit(2, 'scout', 11.5, 24.5);
  game.command(1, [saboteur.id], 'hold');
  game.command(2, [foe.id], 'hold');
  game.update(.1);
  assert.equal(relay.hp, relay.maxHp - 35);
  assert.equal(foe.hp, foe.maxHp);
});

test('Hold fires without chasing, attack-move stops to fight, direct move does not stop', () => {
  const held = combatArena();
  const guard = held._unit(1, 'fighter', 10.5, 24.5), enemy = held._unit(2, 'scout', 13.5, 24.5);
  held.command(1, [guard.id], 'hold'); held.command(2, [enemy.id], 'hold');
  advance(held, 1);
  assert.equal(guard.x, 10.5); assert.equal(guard.path.length, 0);
  enemy.x = 11.5;
  held.update(.1);
  assert.equal(guard.x, 10.5); assert.ok(enemy.hp < enemy.maxHp);
  for (const stance of ['attack', 'move']) {
    const game = combatArena();
    const unit = game._unit(1, 'fighter', 10.5, 24.5), foe = game._unit(2, 'fighter', 11.5, 24.5);
    game.command(2, [foe.id], 'hold');
    assert.equal(game.command(1, [unit.id], stance, 16, 24).ok, true);
    game.update(.1);
    assert.ok(foe.hp < foe.maxHp);
    if (stance === 'attack') assert.equal(unit.x, 10.5);
    else assert.ok(unit.x > 10.5);
  }
});

test('Retreat escapes combat, reaches the core and heals without pursuing enemies', () => {
  const game = combatArena();
  const unit = game._unit(1, 'fighter', 12.5, 38.5), foe = game._unit(2, 'scout', 11.5, 38.5);
  unit.hp = 30; unit.lastHit = game.time;
  game.command(2, [foe.id], 'hold');
  assert.equal(game.command(1, [unit.id], 'retreat').ok, true);
  game.update(.1);
  assert.ok(unit.x > 12.5);
  assert.equal(foe.hp, foe.maxHp);
  advance(game, 10);
  assert.equal(unit.stance, 'retreat');
  assert.ok(Math.hypot(unit.x - 16.5, unit.y - 41.5) < .01);
  assert.ok(unit.hp > 30);
});

test('Three squads reject foreign IDs, prune casualties and do not accept enemy commands', () => {
  const game = quiet();
  const own = game.units.filter(unit => unit.team === 1), enemy = game.units.find(unit => unit.team === 2);
  assert.equal(game.assignSquad(1, 0, [own[0].id, own[0].id, own[1].id, enemy.id]).ok, true);
  assert.deepEqual(game.getSquad(1, 0), [own[0].id, own[1].id]);
  assert.equal(game.assignSquad(1, 3, [own[0].id]).ok, false);
  assert.equal(game.command(1, [enemy.id], 'hold').ok, false);
  own[0].hp = 0;
  game.update(.1);
  assert.deepEqual(game.getSquad(1, 0), [own[1].id]);
  const copy = game.getSquad(1, 0); copy.push(enemy.id);
  assert.deepEqual(game.getSquad(1, 0), [own[1].id]);
  assert.equal(game.assignSquad(1, 0, []).ok, true);
  assert.deepEqual(game.getSquad(1, 0), []);
});

test('AI develops with paid upgrades and delayed support roles, while preserving finite state', () => {
  const game = new Game({ difficulty: 'easy', seed: 42 });
  advance(game, 60);
  assert.equal(game.getCore(2).level, 1);
  assert.ok(game.buildings.filter(b => b.team === 2).length > 1);
  assert.ok(game.units.filter(u => u.team === 2).length > 3);
  advance(game, 178);
  assert.equal(game.getCore(2).level, 2);
  assert.equal(game.specializations[2], 'fortification');
  assert.ok(game.units.some(u => u.team === 2 && u.type === 'engineer'));
  assert.ok(game.units.some(u => u.team === 2 && u.type === 'saboteur') || game.queues[2].some(job => job.type === 'saboteur'));
  assert.ok(game.money[2] >= 0);
  assert.ok(game.units.every(u => [u.x, u.y, u.hp].every(Number.isFinite)));
  const engineer = game.units.find(u => u.team === 2 && u.type === 'engineer');
  assert.ok(engineer.stance === 'hold' || engineer.stance === 'move');
  advance(game, 720);
  assert.notEqual(game.winner, null);
});

console.log(`${passed} V0.3 simulation checks passed.`);
