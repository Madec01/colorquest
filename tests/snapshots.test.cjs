'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../engine.js');
const S = require('../snapshots.js');
// Generated once using engine.js AND snapshots.js from published commit bfb4e02.
// Do not regenerate this fixture with the current engine: it proves real V0.4 compatibility.
const legacyFixture = () => JSON.parse(fs.readFileSync(require.resolve('./fixtures/v04-snapshot.json'), 'utf8'));

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ ' + name); }
function wire(value) { return JSON.parse(JSON.stringify(value)); }
function advance(game, ticks, dt = .1) { for (let i = 0; i < ticks; i++) game.update(dt); }
function rich(game) { game.money[1] = game.money[2] = 5000; return game; }
function prepared(specialization = 'mobility') {
  const game = rich(new E.Game({ seed: 87431, difficulty: 'normal', mapId: 'legacy' }));
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
  // V0.5 powers require genuine sight for both teams. The enemy scout witnesses
  // this target instead of the old fixture relying on omniscient AI powers.
  const enemyScout = game.units.find(u => u.team === 2 && u.type === 'scout');
  enemyScout.x = 16.5; enemyScout.y = 34.5;
  game.updateVisibility();
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

test('Genuine V0.4 save migrates once without changing any existing state, geometry or resources', () => {
  const old = legacyFixture(), before = wire(old), previous = {};
  assert.equal(old.version, 1);
  assert.ok(old.state.queues[1][0].remaining < old.state.queues[1][0].duration);
  assert.ok(old.state.buildings.some(b => b.hp < b.maxHp));
  assert.ok(old.state.units.some(u => u.path.length));
  assert.ok(old.state.tiles.some(t => t.isolation));
  for (const name of ['random', 'recompute', 'updateVisibility', 'update']) {
    previous[name] = E.Game.prototype[name];
    E.Game.prototype[name] = () => { throw new Error('Migration called ' + name); };
  }
  let restored;
  try { restored = S.restore(old); }
  finally { for (const [name, method] of Object.entries(previous)) E.Game.prototype[name] = method; }
  assert.equal(restored.mapId, 'legacy');
  for (const [key, value] of Object.entries(before.state)) {
    if (key === 'tiles') continue;
    assert.deepEqual(restored[key], value, 'unchanged historical field ' + key);
  }
  for (let i = 0; i < before.state.tiles.length; i++) {
    const source = before.state.tiles[i], cell = restored.tiles[i];
    for (const [key, value] of Object.entries(source)) assert.deepEqual(cell[key], value, `unchanged tile ${i}.${key}`);
    assert.equal(cell.terrain, 'plain');
    assert.equal(cell.rich, false);
    assert.equal(cell.cache, 0);
    assert.equal(cell.aiExplored, cell.aiVisible, 'no past AI exploration is invented');
  }
  assert.equal(restored.tile(16, 41).aiVisible, false, 'distant player core remains unknown');
  assert.equal(restored.tile(16, 6).aiVisible, true);
  assert.deepEqual(restored.aiMemory, []);
  assert.deepEqual(old, before, 'migration does not mutate the original save');
  const current = S.capture(restored);
  assert.equal(current.version, 2);
  assert.deepEqual(S.capture(S.restore(wire(current))), current, 'v2 does not reapply migration');
});

test('Legacy AI knowledge begins with current friendly sight and only visible enemy buildings', () => {
  const old = legacyFixture();
  const relay = old.state.buildings.find(b => b.team === 1 && b.type === 'relay');
  relay.x = 16; relay.y = 13;
  const restored = S.restore(old);
  assert.equal(restored.tile(relay.x, relay.y).aiVisible, true);
  assert.deepEqual(restored.aiMemory, [{ id: relay.id, type: 'relay', x: 16, y: 13, seenAt: old.state.time }]);
  assert.equal(restored.aiMemory.some(m => m.type === 'core'), false);
  assert.equal(restored.tile(0, 24).aiExplored, false);
  assert.deepEqual(S.capture(S.restore(wire(S.capture(restored)))), S.capture(restored));
});

test('Migrated games continue deterministically across the next v2 save and preserve reserved jobs', () => {
  const original = S.restore(legacyFixture()), resumed = S.restore(wire(S.capture(original)));
  const reserved = original.queues[1].map(job => job.unitId);
  for (let tick = 0; tick < 1500; tick++) {
    original.update(.1); resumed.update(.1);
    if (tick % 200 === 0) assert.deepEqual(S.capture(resumed), S.capture(original));
  }
  assert.deepEqual(resumed, original);
  for (const id of reserved) assert.ok(resumed.units.filter(u => u.id === id).length <= 1, 'reserved unit is not duplicated');
  assert.equal(resumed.random(), original.random());
});

test('Malformed v1 input is rejected before migration instead of being repaired or enriched', () => {
  const bad = mutate => {
    const old = legacyFixture(); mutate(old);
    assert.throws(() => S.restore(old), /Sauvegarde invalide|incompatible/);
  };
  bad(s => { s.state.mapId = 'plain'; });
  bad(s => { s.state.tiles[0].terrain = 'smooth'; });
  bad(s => { s.state.units[0].hp = Infinity; });
  bad(s => { s.state.tiles[0].source = true; s.state.tiles[0].blocked = true; });
  bad(s => { s.state.queues[1][0].unitId = s.state.buildings[0].id; });
  bad(s => { s.state.tiles[0] = JSON.parse('{"__proto__":{"polluted":true}}'); });
  assert.equal({}.polluted, undefined);
});

test('V2 round trips each map, consumed objectives, both fog layers and stale AI memory', () => {
  for (const mapId of ['plain', 'lanes', 'crossroads']) {
    const game = new E.Game({ seed: 91823, mapId });
    assert.equal(game.mapId, mapId);
    assert.ok(game.tiles.some(t => t.cache === 60));
    assert.ok(game.tiles.some(t => t.rich && t.source));
    const cache = game.tiles.find(t => t.cache === 60);
    cache.cache = 0;
    const extra = game.tiles.find(t => !t.blocked && !t.source && t.cache === 0);
    extra.terrain = 'absorbent'; extra.aiExplored = true; extra.aiVisible = false;
    const smooth = game.tiles.find(t => !t.blocked && !t.source && t !== extra);
    smooth.terrain = 'smooth';
    // An observation survives out of sight even after its entity was destroyed.
    // Nothing may replace it with current/live information during restore.
    const enemy = game._building(1, 'relay', 16, 45);
    game.aiMemory = [{ id: enemy.id, type: enemy.type, x: enemy.x, y: enemy.y, seenAt: game.time }];
    enemy.hp = 0;
    game.update(.1);
    assert.equal(game.buildings.some(b => b.id === enemy.id), false);
    assert.equal(game.aiMemory.some(m => m.id === enemy.id), true, 'out-of-sight destruction is not known');
    const saved = wire(S.capture(game)), resumed = S.restore(saved);
    assert.deepEqual(S.capture(resumed), saved);
    assert.equal(resumed.tile(cache.x, cache.y).cache, 0);
    assert.deepEqual(resumed.aiMemory, game.aiMemory);
    for (let tick = 0; tick < 100; tick++) { game.update(.1); resumed.update(.1); }
    assert.deepEqual(S.capture(resumed), S.capture(game), 'continuation on ' + mapId);
  }
});

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
      advance(game, 23);
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
  bad('unknown map', s => { s.state.mapId = 'missing'; });
  bad('missing terrain', s => { delete s.state.tiles[0].terrain; });
  bad('unknown terrain', s => { s.state.tiles[0].terrain = 'lava'; });
  bad('rich plain tile', s => { s.state.tiles[0].rich = true; s.state.tiles[0].source = false; });
  bad('invalid cache value', s => { s.state.tiles[0].cache = 59; });
  bad('cache on obstacle', s => { s.state.tiles[0].cache = 60; s.state.tiles[0].blocked = true; });
  bad('cache on source', s => { s.state.tiles[0].cache = 60; s.state.tiles[0].source = true; });
  bad('invalid AI fog', s => { s.state.tiles[0].aiVisible = true; s.state.tiles[0].aiExplored = false; });
  bad('invalid AI fog type', s => { s.state.tiles[0].aiExplored = 1; });
  const memory = s => ({ id: s.state.buildings[0].id, type: 'core', x: 16, y: 41, seenAt: 0 });
  bad('future memory', s => { s.state.aiMemory = [{ ...memory(s), seenAt: s.state.time + 1 }]; });
  bad('fractional memory position', s => { s.state.aiMemory = [{ ...memory(s), x: 16.5 }]; });
  bad('unknown memory ID', s => { s.state.aiMemory = [{ ...memory(s), id: s.state._id }]; });
  bad('duplicate memory', s => { s.state.aiMemory = [memory(s), memory(s)]; });
  bad('unit memory', s => { s.state.aiMemory = [{ ...memory(s), type: 'scout' }]; });
  bad('live data in memory', s => { s.state.aiMemory = [{ ...memory(s), hp: 950 }]; });
  bad('oversized event text', s => { s.state.events[0].message = 'x'.repeat(301); });
  bad('prototype injection', s => { s.state.tiles[0] = JSON.parse(JSON.stringify(s.state.tiles[0]).slice(0, -1) + ',"__proto__":{"polluted":true}}'); });
  bad('foreign prototype', s => { Object.setPrototypeOf(s.state.units[0], { injected: true }); });
  bad('array extra property', s => { s.state.units.polluted = true; });
  bad('array prototype injection', s => { Object.setPrototypeOf(s.state.units, {}); });
  bad('array accessor injection', s => { Object.defineProperty(s.state.tiles, '0', { enumerable: true, get() { throw new Error('unexpected getter'); } }); });
  bad('getter injection', s => { Object.defineProperty(s.state, 'seed', { enumerable: true, get() { throw new Error('unexpected getter'); } }); });
  bad('hidden getter injection', s => { Object.defineProperty(s.state, 'seed', { enumerable: false, get() { throw new Error('unexpected getter'); } }); });
  assert.equal({}.polluted, undefined);
});

test('The same module exposes CQSnapshot without requiring CommonJS in browsers', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../maps.js'), 'utf8'), context);
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
