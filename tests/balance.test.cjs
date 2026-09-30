'use strict';
const assert = require('node:assert/strict');
const { Game } = require('../engine.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ ' + name); }
function advance(game, seconds, inspect = () => {}) {
  for (let n = 0; n < Math.round(seconds * 10) && game.winner === null; n++) {
    game.update(.1);
    inspect(game);
  }
}

test('Détente leaves three minutes to explore while developing a real paid economy', () => {
  const game = new Game({ difficulty: 'easy', seed: 42 });
  let moneyBefore = game.money[2], earned = 0, spent = 0, reserves = 0;
  const collect = game._collectCaches;
  game._collectCaches = function () {
    const before = this.money[2]; collect.call(this); reserves += this.money[2] - before;
  };
  // Observe the ordinary debit paths instead of granting resources to the AI.
  for (const name of ['build', 'recruit', 'upgradeBuilding', 'chooseSpecialization']) {
    const original = game[name];
    game[name] = function (...args) {
      const before = this.money[2], result = original.apply(this, args);
      if (args[0] === 2) spent += before - this.money[2];
      return result;
    };
  }
  for (let n = 0; n < 1790; n++) {
    game._updateIncome();
    earned += game.income[2] * .1;
    game.update(.1);
    assert.equal(game.getCore(1).hp, 950);
    assert.ok(game.units.filter(unit => unit.team === 1).every(unit => unit.hp === unit.maxHp));
  }
  assert.equal(game.winner, null);
  assert.ok(game.scores[2] < .5, 'The discovery phase must not already dominate the board');
  assert.ok(game.buildings.some(building => building.team === 2 && building.type === 'extractor'));
  assert.equal(game.getCore(2).level, 2);
  assert.ok(spent > 300, 'The AI actually recruits, builds and develops');
  assert.ok(Math.abs(game.money[2] - (moneyBefore + earned + reserves - spent)) < .00001);
});

test('Small early raids can damage and destroy an exposed player relay', () => {
  const game = new Game({ difficulty: 'easy', seed: 42 });
  // A player-built network extends out from the Cœur; the three starting units
  // remain at home. This is a vulnerable expansion, not an invulnerable tutorial.
  for (let y = 29; y < 41; y++) game.tile(16, y).owner = 1;
  game.recompute();
  assert.equal(game.build(1, 'relay', 16, 29).ok, true);
  const relay = game.buildings.find(building => building.team === 1 && building.type === 'relay');
  const command = game.command;
  let raidSize = 0, firstDamage = null, destroyedAt = null;
  game.command = function (team, ids, stance, x, y) {
    if (team === 2 && stance === 'attack' && x === relay.x && y === relay.y) raidSize = Math.max(raidSize, ids.length);
    return command.call(this, team, ids, stance, x, y);
  };
  advance(game, 230, () => {
    if (relay.hp < relay.maxHp && firstDamage === null) firstDamage = game.time;
    if (!game.buildings.includes(relay) && destroyedAt === null) destroyedAt = game.time;
  });
  assert.ok(firstDamage >= 180 && firstDamage < 210, `First raid damage: ${firstDamage}`);
  assert.ok(destroyedAt > firstDamage && destroyedAt < 230);
  assert.ok(raidSize > 0 && raidSize <= 3, `Early raid size: ${raidSize}`);
  assert.equal(game.getCore(1).hp, 950);
});

test('Raids have a recovery interval instead of streaming the entire army south', () => {
  const game = new Game({ difficulty: 'easy', seed: 7 });
  advance(game, 205);
  const attacking = game.units.filter(unit => unit.team === 2 && unit.type !== 'scout' && unit.order?.y >= 29);
  assert.ok(attacking.length > 0 && attacking.length <= 3);
  advance(game, 35);
  const stillRaiding = game.units.filter(unit => unit.team === 2 && unit.type !== 'scout' && unit.order?.y >= 29 && unit.stance !== 'retreat');
  assert.equal(stillRaiding.length, 0, 'The raiders should return to their own front between waves');
});

test('Détente still defends itself immediately when the player attacks early', () => {
  const game = new Game({ difficulty: 'easy', seed: 42 });
  advance(game, 60);
  const invader = game.units.find(unit => unit.team === 1 && unit.type === 'fighter');
  invader.x = 16.5; invader.y = 9.5;
  assert.equal(game.tile(invader.x, invader.y).owner, 2);
  game._aiThink();
  const defenders = game.units.filter(unit => unit.team === 2 && ['fighter', 'breaker'].includes(unit.type));
  assert.ok(defenders.length > 3);
  assert.ok(defenders.every(unit => unit.stance === 'attack'));
  advance(game, 4);
  assert.ok(invader.hp < invader.maxHp, 'The development phase does not grant immunity');
});

test('Détente allows a decisive Cœur assault from seven minutes, with ordinary damage', () => {
  const game = new Game({ difficulty: 'easy', seed: 7 });
  game.time = 419;
  game.money[2] = 0;
  game.units = game.units.filter(unit => unit.team === 1);
  for (const [type, x] of [['fighter', 15.5], ['fighter', 16.5], ['fighter', 17.5], ['breaker', 16.5], ['breaker', 18.5]]) {
    game._unit(2, type, x, 30.5);
  }
  // The assault must be based on a genuinely observed Cœur, not a hidden
  // global position. An expedition scout supplies that observation.
  game._unit(2, 'scout', 16.5, 34.5);
  game._aiThink();
  assert.ok(game.units.filter(unit => unit.team === 2 && unit.type !== 'scout').every(unit => unit.order.y < 35));
  game.time = 420;
  game._aiThink();
  assert.ok(game.units.filter(unit => unit.team === 2 && unit.type !== 'scout').every(unit => unit.stance === 'attack' && unit.order.y >= 40));
  advance(game, 90);
  assert.equal(game.winner, 2);
  assert.equal(game.winReason, 'Cœur adverse détruit');
  assert.ok(game.time < 510);
});

test('Idle Détente keeps at least six minutes on every new map and three seeds', () => {
  const timings = [];
  for (const mapId of ['plain', 'lanes', 'crossroads']) for (const seed of [42, 7, 123456]) {
    const game = new Game({ difficulty: 'easy', mapId, seed });
    advance(game, 720.1, () => {
      if (game.time < 420) assert.equal(game.getCore(1)?.hp, 950);
      assert.ok(game.money[2] >= 0);
      assert.ok(game.units.every(u => Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.hp) && u.hp > 0));
    });
    assert.equal(game.winner, 2);
    assert.ok(game.time >= 360 && game.time <= 720.1, `${mapId}/${seed}: ${game.time}s`);
    assert.ok(['Domination territoriale', 'Cœur adverse détruit', 'Temps écoulé'].includes(game.winReason));
    timings.push(`${mapId}/${seed}: ${game.time.toFixed(1)}s`);
  }
  console.log('  Idle Détente diagnostic — ' + timings.join(', '));
});

test('Normal stays pressuring without a hidden-base rush on every new map and three seeds', () => {
  // V0.5 maps/objectives/vision intentionally change the old exact seed timings.
  // The idle diagnostic protects the three-minute strategic development window;
  // active human game length and enjoyment still require playtesting.
  const timings = [];
  for (const mapId of ['plain', 'lanes', 'crossroads']) for (const seed of [42, 7, 123456]) {
    const game = new Game({ difficulty: 'normal', mapId, seed });
    advance(game, 720.1, () => {
      if (game.time < 180) assert.equal(game.getCore(1)?.hp, 950);
      assert.ok(game.money[1] >= 0 && game.money[2] >= 0);
      assert.ok(game.units.every(u => Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.hp) && u.hp > 0));
    });
    assert.equal(game.winner, 2);
    assert.ok(game.time >= 180 && game.time <= 720.1, `${mapId}/${seed}: ${game.time}s`);
    timings.push(`${mapId}/${seed}: ${game.time.toFixed(1)}s`);
  }
  console.log('  Idle Stratégie diagnostic — ' + timings.join(', '));
});

console.log(`${passed} V0.5 difficulty checks passed.`);
