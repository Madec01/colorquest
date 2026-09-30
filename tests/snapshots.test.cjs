'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../engine.js');
const S = require('../snapshots.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ ' + name); }
function wire(value) { return JSON.parse(JSON.stringify(value)); }
function advance(game, ticks, dt = .1) { for (let i = 0; i < ticks; i++) game.update(dt); }
function rich(game) { game.money[1] = game.money[2] = 5000; return game; }
function prepared(specialization = 'mobility') {
  const game = rich(new E.Game({ seed: 87431, difficulty: 'normal' }));
  for (const t of [1, 2]) {
    assert.equal(game.upgradeBuilding(t, game.getCore(t).id).ok, true);
    assert.equal(game.chooseSpecialization(t, t === 1 ? specialization : 'fortification').ok, true);
  }
  assert.equal(game.build(1, 'relay', 16, 45).ok, true);
  const core = game.getCore(1);
  core.hp -= 113;
  core.lastHit = game.time;
  const scout = game.units.find(u => u.team === 1 && u.type === 'scout');
  scout.hp -= 8;
  assert.equal(game.order([scout.id], 7, 24).ok, true);
  const fighters = game.units.filter(u => u.team === 1 && u.type === 'fighter');
  assert.equal(game.command(1, [fighters[0].id], 'hold').ok, true);
  assert.equal(game.command(1, [fighters[1].id], 'attack', 16, 24).ok, true);
  assert.equal(game.assignSquad(1, 0, [scout.id, fighters[1].id]).ok, true);
  assert.equal(game.assignSquad(1, 2, [fighters[0].id]).ok, true);
  assert.equal(game.setRally(1, 12, 35).ok, true);
  assert.equal(game.recruit(1, 'engineer').ok, true);
  assert.equal(game.recruit(1, 'saboteur').ok, true);
  assert.equal(game.recruit(1, 'breaker').ok, true);
  assert.equal(game.power(1, 'impulse', 16, 41).ok, true);
  assert.equal(game.power(2, 'bleach', 16, 41).ok, true);
  game.tile(0, 40).owner = 1;
  game.recompute();
  advance(game, 17);
  return game;
}

test('JSON round trip preserves every engine data field, partial queues, damage and fog', () => {
  const game = prepared(), snapshot = S.capture(game), encoded = wire(snapshot), restored = S.restore(encoded);
  assert.equal(snapshot.format, S.FORMAT);
  assert.equal(snapshot.version, S.VERSION);
  assert.ok(restored instanceof E.Game);
  assert.deepEqual(Object.keys(snapshot.state).sort(), Object.keys(game).sort());
  assert.deepEqual(restored, game);
  assert.deepEqual(S.capture(restored), encoded);
  assert.ok(restored.queues[1][0].remaining < restored.queues[1][0].duration);
  assert.ok(restored.getCore(1).hp < restored.getCore(1).maxHp);
  assert.ok(restored.tiles.some(t => t.weakenedUntil > restored.time));
  assert.ok(restored.tiles.some(t => t.isolation > 0));
  assert.ok(restored.tiles.some(t => !t.explored));
  assert.ok(restored.units.some(u => u.path.length > 0));
});

test('Resuming keeps deterministic AI, combat, production and RNG continuation for every specialization', () => {
  for (const specialization of Object.keys(E.SPECIALIZATIONS)) {
    const original = prepared(specialization);
    advance(original, 693);
    const resumed = S.restore(wire(S.capture(original)));
    for (let tick = 0; tick < 900; tick++) {
      // Real player orders on both branches while AI and combat continue normally.
      if (tick % 150 === 0 && original.winner === null) {
        for (const game of [original, resumed]) {
          const own = game.units.filter(u => u.team === 1 && u.type !== 'engineer').map(u => u.id);
          game.command(1, own, tick % 300 ? 'retreat' : 'attack', 16, 20);
          game.recruit(1, tick % 300 ? 'fighter' : 'saboteur');
        }
      }
      const dt = [.016, .05, .1, .037][tick % 4];
      original.update(dt);
      resumed.update(dt);
      if (tick % 100 === 0) assert.deepEqual(S.capture(resumed), S.capture(original));
    }
    assert.deepEqual(resumed, original);
    assert.equal(resumed.random(), original.random());
  }
});

test('Restore does not construct a new board, draw randomness or recompute derived state', () => {
  const snapshot = S.capture(prepared());
  const previous = {};
  for (const name of ['random', 'recompute', 'updateVisibility']) {
    previous[name] = E.Game.prototype[name];
    E.Game.prototype[name] = () => { throw new Error('Restore called ' + name); };
  }
  try {
    const restored = S.restore(snapshot);
    assert.deepEqual(S.capture(restored), snapshot);
  } finally {
    for (const [name, method] of Object.entries(previous)) E.Game.prototype[name] = method;
  }
});

test('A resumed formation uses its reserved ID once and never debits its price again', () => {
  const original = rich(new E.Game({ seed: 41 }));
  const first = original.recruit(1, 'fighter'), second = original.recruit(1, 'scout');
  assert.ok(first.ok && second.ok);
  original.setRally(1, 12, 40);
  advance(original, 37);
  const restored = S.restore(wire(S.capture(original)));
  assert.equal(restored.units.some(u => u.id === first.id), false);
  const money = restored.money[1], income = restored.income[1];
  advance(restored, 24);
  assert.equal(restored.units.filter(u => u.id === first.id).length, 1);
  assert.equal(restored.queues[1].length, 1);
  assert.equal(restored.queues[1][0].unitId, second.id);
  assert.ok(Math.abs(restored.money[1] - (money + 2.4 * income)) < 1e-8);
  advance(restored, 40);
  assert.equal(restored.units.filter(u => u.id === second.id).length, 1);
  assert.equal(restored.units.filter(u => u.id === first.id).length, 1);
  assert.equal(restored.queues[1].length, 0);
  assert.equal(restored.cancelRecruit(1, first.jobId).ok, false);
  const fresh = restored.recruit(1, 'fighter');
  assert.ok(fresh.ok && fresh.id > second.id);
});

test('Cancellation after resuming retains active/waiting refunds without duplicated pigment', () => {
  const original = rich(new E.Game({ seed: 97 }));
  const active = original.recruit(1, 'fighter'), waiting = original.recruit(1, 'breaker');
  advance(original, 11);
  const restored = S.restore(wire(S.capture(original))), before = restored.money[1];
  assert.equal(restored.cancelRecruit(1, waiting.jobId).refund, E.COSTS.breaker);
  assert.equal(restored.cancelRecruit(1, active.jobId).refund, Math.floor(E.COSTS.fighter / 2));
  assert.equal(restored.money[1], before + E.COSTS.breaker + Math.floor(E.COSTS.fighter / 2));
  const once = restored.money[1];
  assert.equal(restored.cancelRecruit(1, active.jobId).ok, false);
  assert.equal(restored.money[1], once);
  advance(restored, 100);
  assert.equal(restored.units.some(u => [active.id, waiting.id].includes(u.id)), false);
});

test('Snapshots and restored games share no nested objects and ignore UI/tutorial hooks', () => {
  const game = prepared();
  game._aiThink = () => {};
  game.camera = { zoom: 2 };
  game.selected = [game.units[0].id];
  const snapshot = S.capture(game), before = wire(snapshot), resumed = S.restore(snapshot), other = S.restore(snapshot);
  assert.equal(own(snapshot.state, 'camera'), false);
  assert.equal(own(snapshot.state, 'selected'), false);
  assert.equal(own(resumed, '_aiThink'), false);
  assert.equal(resumed._aiThink, E.Game.prototype._aiThink);
  resumed.units[0].path[0].x = 1.5;
  resumed.tiles[0].explored = !resumed.tiles[0].explored;
  resumed.queues[1][0].remaining = 0;
  resumed.squads[1][0].push(123);
  resumed.events[0].text = 'modified';
  resumed.money[1] = 0;
  assert.deepEqual(snapshot, before);
  assert.deepEqual(S.capture(other), before);
  assert.deepEqual(S.capture(game), before);
  snapshot.state.money[1] = 1;
  assert.notEqual(game.money[1], 1);
});

function own(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }

test('Completed games, destroyed cores and zero-time games round trip without changing results', () => {
  const fresh = new E.Game({ seed: 15 });
  assert.deepEqual(S.restore(wire(S.capture(fresh))), fresh);
  fresh.getCore(2).hp = 0;
  fresh.update(.1);
  assert.equal(fresh.winner, 1);
  assert.equal(fresh.getCore(2), undefined);
  const restored = S.restore(wire(S.capture(fresh))), before = S.capture(restored);
  restored.update(.1);
  assert.deepEqual(S.capture(restored), before);
});

test('All real running states remain serializable during a complete AI match', () => {
  for (const difficulty of ['easy', 'normal']) {
    const game = new E.Game({ seed: 42, difficulty });
    let checked = 0;
    while (game.winner === null) {
      advance(game, 53);
      assert.deepEqual(S.capture(S.restore(wire(S.capture(game)))), S.capture(game));
      checked++;
    }
    assert.ok(checked > 20);
  }
});

test('Malformed, incompatible, oversized and internally inconsistent snapshots are rejected', () => {
  const baseline = S.capture(prepared());
  const bad = (name, mutate) => {
    const snapshot = wire(baseline);
    mutate(snapshot);
    assert.throws(() => S.restore(snapshot), /Sauvegarde invalide|incompatible|non reconnu/, name);
  };
  assert.throws(() => S.restore(null), /Sauvegarde invalide/);
  assert.throws(() => S.capture({}), /Aucune partie/);
  bad('version', s => { s.version = 999; });
  bad('format', s => { s.format = 'another-game'; });
  bad('missing state field', s => { delete s.state.seed; });
  bad('unknown state field', s => { s.state.update = 'execute me'; });
  bad('wrong dimensions', s => { s.state.width = 64; });
  bad('wrong difficulty', s => { s.state.difficulty = 'impossible'; });
  bad('nonfinite money', s => { s.state.money[1] = Infinity; });
  bad('nonfinite position', s => { s.state.units[0].x = NaN; });
  bad('invalid scores', s => { s.state.scores[1] = 10; });
  bad('negative cooldown', s => { s.state.cooldowns[1].impulse = -1; });
  bad('missing core', s => { s.state.buildings = s.state.buildings.filter(b => b.team !== 2); });
  bad('invalid IDs', s => { s.state._id = 1; });
  bad('duplicate entity IDs', s => { s.state.units[0].id = s.state.buildings[0].id; });
  bad('duplicate reserved unit IDs', s => { s.state.queues[1][0].unitId = s.state.units[0].id; });
  bad('duplicate job IDs', s => { s.state.queues[1][1].id = s.state.queues[1][0].id; });
  bad('wrong queue type', s => { s.state.queues[1][0].type = 'core'; });
  bad('incorrect refund', s => { s.state.queues[1][0].cost = 100000; });
  bad('incorrect active flag', s => { s.state.queues[1][0].started = false; });
  bad('waiting formation already progressed', s => { s.state.queues[1][1].remaining -= 1; });
  bad('oversized queue', s => { s.state.queues[1] = Array(7).fill(s.state.queues[1][0]); });
  bad('oversized population', s => { s.state.units = Array(73).fill(s.state.units[0]); });
  bad('wrong unit type', s => { s.state.units[0].type = 'dragon'; });
  bad('out of bounds position', s => { s.state.units[0].x = E.WIDTH; });
  bad('invalid unit health', s => { s.state.units[0].hp = s.state.units[0].maxHp + 1; });
  bad('invalid building level', s => { s.state.buildings[0].level = 4; });
  bad('incorrect upgrade health', s => { s.state.buildings[0].maxHp += 1; });
  bad('invalid owner', s => { s.state.tiles[0].owner = 3; });
  bad('reordered tiles', s => { [s.state.tiles[0], s.state.tiles[1]] = [s.state.tiles[1], s.state.tiles[0]]; });
  bad('wrong tile count', s => { s.state.tiles.pop(); });
  bad('sparse tiles', s => { delete s.state.tiles[4]; });
  bad('oversized path', s => { s.state.units[0].path = Array(E.WIDTH * E.HEIGHT + 1).fill({ x: .5, y: .5 }); });
  bad('disconnected path', s => { s.state.units[0].path = [{ x: .5, y: .5 }, { x: 4.5, y: .5 }]; });
  bad('invalid squad owner', s => { s.state.squads[1][0] = [s.state.units.find(u => u.team === 2).id]; });
  bad('unknown squad unit', s => { s.state.squads[1][0] = [s.state.queues[1][0].unitId]; });
  bad('duplicate squad unit', s => { s.state.squads[1][0].push(s.state.squads[1][0][0]); });
  bad('invalid specialization', s => { s.state.specializations[1] = 'invincible'; });
  bad('oversized event text', s => { s.state.events[0].message = 'x'.repeat(301); });
  bad('prototype injection', s => { s.state.tiles[0] = JSON.parse(JSON.stringify(s.state.tiles[0]).slice(0, -1) + ',"__proto__":{"polluted":true}}'); });
  bad('foreign prototype', s => { Object.setPrototypeOf(s.state.units[0], { injected: true }); });
  bad('getter injection', s => { Object.defineProperty(s.state, 'seed', { enumerable: true, get() { throw new Error('unexpected getter'); } }); });
  assert.equal({}.polluted, undefined);
});

test('The same module exposes CQSnapshot without requiring CommonJS in browsers', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../engine.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../snapshots.js'), 'utf8'), context);
  const result = vm.runInContext(`(() => {
    const game = new CQEngine.Game({ seed: 987 });
    game.update(.1);
    const restored = CQSnapshot.restore(JSON.parse(JSON.stringify(CQSnapshot.capture(game))));
    return restored instanceof CQEngine.Game && restored.seed === game.seed && restored.time === game.time;
  })()`, context);
  assert.equal(result, true);
});

console.log(`${passed} snapshot checks passed.`);
