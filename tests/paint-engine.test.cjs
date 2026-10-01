'use strict';
const assert = require('node:assert/strict');
const { Game, CONFIG, CARDS, UNIT_STATS } = require('../paint-engine.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('✓', name); }
function snapshot(game) { return JSON.stringify(game); }
function play(game, id, x, y, team = 1) {
  const index = game.hands[team].indexOf(id);
  assert.notEqual(index, -1, id + ' absent from hand');
  const result = game.playCard(team, index, x, y);
  assert.equal(result.ok, true, result.message);
  return game.buildings.find(b => b.id === result.buildingId) || result;
}
function barracks(game, x = 9, y = 21, team = 1) { return play(game, 'barracks', x, y, team); }
function neutralise(game) { for (const t of game.tiles) t.owner = 0; for (const core of game.buildings.filter(b => b.type === 'core')) game.tile(core.x, core.y).owner = core.team; game.recompute(); }
function makeUnit(game, team, x, y, producer = game.getCore(team)) { return game._addUnit(team, producer, { x: x + .5, y: y + .5 }); }
function makeConnected(game, team, cells) { for (const [x, y] of cells) game.tile(x, y).owner = team; game.recompute(); }

test('symmetric public arena and four cards plus a separate brush', () => {
  const g = new Game({ seed: 5 });
  assert.equal(g.tiles.length, 19 * 27);
  for (const t of g.tiles) { const mirror = g.tile(18 - t.x, 26 - t.y); assert.equal(t.blocked, mirror.blocked); assert.equal(t.source, mirror.source); }
  assert.equal(g.scores[1], g.scores[2]); assert.equal(g.income[1], g.income[2]);
  assert.deepEqual(g.hands[1], ['relay', 'barracks', 'extractor', 'splash']);
  assert.deepEqual(g.decks[1], ['bastion', 'wave', 'bleach', 'barracks']);
  assert.equal(Object.hasOwn(CARDS, 'brush'), false); assert.equal(g.duration, 240);
});

test('paint preview is read-only and payment creates permanent connected paint', () => {
  const g = new Game(); const path = [{ x: 9, y: 20 }, { x: 9, y: 19 }, { x: 9, y: 18 }];
  const before = snapshot(g), preview = g.previewPaint(1, path);
  assert.equal(snapshot(g), before); assert.equal(preview.ok, true); assert.equal(preview.cost, 2);
  assert.equal(g.paint(1, path).ok, true); assert.equal(g.pigment[1], 63);
  assert.equal(g.tile(9, 18).owner, 1); assert.equal(g.tile(9, 18).connected, true);
  g.update(30); assert.equal(g.tile(9, 18).owner, 1); assert.equal(g.winner, null);
});

test('connected ink opens the next visible frontier without exposing hidden ownership', () => {
  const g = new Game(); const far = [{ x: 9, y: 20 }, { x: 9, y: 19 }, { x: 9, y: 18 }, { x: 9, y: 17 }];
  const preview = g.previewPaint(1, far);
  assert.equal(preview.reason, 'Zone hors de vue.'); assert.equal(preview.ok, true); assert.equal(preview.partial, true);
  assert.deepEqual(preview.path, far.slice(0, 3)); assert.deepEqual(preview.rejectedPath, far.slice(3)); assert.equal(preview.cost, 2);
  g.tile(9, 17).owner = 2; // Deliberately do not recompute visibility: hidden state alone is changed.
  assert.deepEqual(g.previewPaint(1, far), preview);
  g.tile(9, 17).blocked = true; assert.deepEqual(g.previewPaint(1, far), preview);
  g.tile(9, 17).blocked = false;
  g.tile(9, 17).owner = 0;
  assert.deepEqual(g.paint(1, far), preview); assert.equal(g.pigment[1], 63); assert.equal(g.tile(9, 17).owner, 0);
  assert.equal(g.isVisible(1, 9, 17), true);
  assert.equal(g.paint(1, far.slice(2)).ok, true);
});

test('brush paints and charges only the prefix before the first obstacle, enemy, budget or length limit', () => {
  for (const change of ['enemy', 'blocked', 'funds']) {
    const a = new Game(); let path = [{ x: 9, y: 20 }, { x: 9, y: 19 }, { x: 9, y: 18 }];
    if (change === 'enemy') a.tile(9, 18).owner = 2;
    if (change === 'blocked') a.tile(9, 18).blocked = true;
    if (change === 'funds') a.pigment[1] = 1;
    const before = snapshot(a), pigment = a.pigment[1], preview = a.previewPaint(1, path);
    assert.equal(snapshot(a), before, change); assert.equal(preview.ok, true, change); assert.equal(preview.partial, true, change);
    assert.equal(preview.cost, 1, change); assert.deepEqual(preview.path, path.slice(0, 2)); assert.deepEqual(preview.rejectedPath, path.slice(2));
    assert.deepEqual(a.paint(1, path), preview); assert.equal(a.pigment[1], pigment - 1); assert.equal(a.tile(9, 19).owner, 1); assert.notEqual(a.tile(9, 18).owner, 1);
  }
  const g = new Game();
  g.visibility[1].fill(true);
  const long = Array.from({ length: 14 }, (_, i) => ({ x: 9, y: 20 - i }));
  const result = g.paint(1, long); assert.equal(result.ok, true); assert.equal(result.cost, 12); assert.equal(g.pigment[1], 53);
  assert.match(result.reason, /Maximum 12/); assert.deepEqual(result.path, long.slice(0, 13)); assert.deepEqual(result.rejectedPath, long.slice(13));
  assert.equal(g.tile(9, 7).owner, 0);
});

test('a rejected suffix never resumes after an obstacle, even when later cells are valid', () => {
  const g = new Game(); g.tile(10, 19).blocked = true;
  const path = [{ x: 9, y: 20 }, { x: 9, y: 19 }, { x: 10, y: 19 }, { x: 10, y: 18 }, { x: 9, y: 18 }];
  const result = g.paint(1, path);
  assert.equal(result.cost, 1); assert.deepEqual(result.rejectedPath, path.slice(2)); assert.equal(g.tile(9, 18).owner, 0); assert.equal(g.tile(10, 18).owner, 0);
});

test('malformed paths and strokes without any affordable valid cell never mutate the game', () => {
  const normal = [{ x: 9, y: 20 }, { x: 9, y: 19 }, { x: 9, y: 18 }];
  for (const change of ['enemy', 'blocked', 'jump', 'lateJump', 'invalidPoint', 'tooMany', 'funds', 'start', 'isolated']) {
    const g = new Game(); let path = normal;
    if (change === 'enemy') g.tile(9, 19).owner = 2;
    if (change === 'blocked') g.tile(9, 19).blocked = true;
    if (change === 'jump') path = [normal[0], normal[2]];
    if (change === 'lateJump') path = [...normal, { x: 10, y: 17 }];
    if (change === 'invalidPoint') path = [...normal, { x: NaN, y: 17 }];
    if (change === 'tooMany') path = Array(1027).fill(normal[0]);
    if (change === 'funds') g.pigment[1] = .9;
    if (change === 'start') path = normal.slice(1);
    if (change === 'isolated') { g.tile(9, 19).owner = 1; g.tile(9, 20).owner = 0; g.recompute(); path = normal.slice(1); }
    const before = snapshot(g), result = g.paint(1, path);
    assert.equal(result.ok, false, change); assert.equal(result.cost, 0, change); assert.equal(snapshot(g), before, change);
  }
});

test('backtracking does not double-charge; neutral bridge reconnects permanent isolated land', () => {
  const g = new Game(); g.tile(9, 17).owner = 1; g.recompute(); assert.equal(g.tile(9, 17).connected, false);
  const path = [{ x: 9, y: 20 }, { x: 9, y: 19 }, { x: 9, y: 18 }, { x: 9, y: 19 }, { x: 9, y: 18 }, { x: 9, y: 17 }];
  const preview = g.previewPaint(1, path); assert.equal(preview.cost, 2); assert.equal(preview.ok, true);
  g.paint(1, path); assert.equal(g.tile(9, 17).connected, true);
});

test('card previews and rejected placements do not spend or cycle', () => {
  const g = new Game(), before = snapshot(g);
  assert.equal(g.previewCard(1, 2, 9, 21).ok, false); // not a source
  assert.equal(g.playCard(1, 2, 9, 21).ok, false);
  assert.equal(g.previewCard(1, 1, 9, 3).message, 'Zone hors de vue.');
  assert.equal(snapshot(g), before);
  const building = barracks(g);
  assert.equal(building.type, 'barracks'); assert.equal(g.pigment[1], 33);
  assert.equal(g.hands[1][1], 'bastion'); assert.deepEqual(g.decks[1], ['wave', 'bleach', 'barracks', 'barracks']);
  assert.equal(g.playCard(1, 1, 9, 21).ok, false);
});

test('a paid relay splashes neutral territory immediately without passive expansion', () => {
  const g = new Game(); const initial = g.scores[1]; play(g, 'relay', 9, 20);
  assert.ok(g.scores[1] > initial); const changed = g.scores[1]; g.update(25); assert.equal(g.scores[1], changed);
});

test('only a connected extractor contributes its bounded source income', () => {
  const g = new Game(); neutralise(g);
  makeConnected(g, 1, [[9, 22], [9, 21], [9, 20], [9, 19], [8, 19], [7, 19], [6, 19], [5, 19]]);
  const b = play(g, 'extractor', 5, 19); const income = g.income[1]; assert.equal(b.connected, true);
  g.tile(9, 21).owner = 0; g.recompute(); assert.equal(b.connected, false);
  assert.ok(income - g.income[1] >= CONFIG.sourceIncome); assert.ok(g.income[1] >= CONFIG.baseIncome);
});

test('producer pays each unit at its actual exit and never before', () => {
  const g = new Game(), b = barracks(g);
  assert.equal(g.productionOutflow(1), CONFIG.unitCost / CONFIG.unitInterval); assert.equal(g.perception(1).outflow, 1.2);
  const start = g.pigment[1]; g.update(4.9); assert.equal(g.units.length, 0);
  assert.ok(g.pigment[1] > start); const beforeExit = g.pigment[1]; g.update(.1);
  assert.equal(g.units.length, 1); assert.ok(g.pigment[1] < beforeExit - 5);
  assert.equal(g.units[0].producerId, b.id);
  const spawn = g.events.filter(e => e.type === 'spawn'); assert.equal(spawn.length, 1); assert.equal(spawn[0].producerId, b.id); assert.equal(spawn[0].cost, 6);
  const paidBalance = g.pigment[1]; makeUnit(g, 1, 9, 22, b);
  assert.equal(g.events.at(-1).cost, 0); assert.equal(g.pigment[1], paidBalance, 'Fixture creation is not a paid expense');
});

test('aim hold, manual pause, cutoff, lack of funds and cap never debit units', () => {
  for (const cause of ['held', 'paused', 'isolated', 'funds', 'full']) {
    const g = new Game(), b = barracks(g); b.productionProgress = 4.99;
    if (cause === 'held') g.setSpendingHeld(1, true);
    if (cause === 'paused') g.toggleProduction(1, b.id);
    if (cause === 'isolated') { for (const t of g.tiles) if (t.owner === 1) t.owner = 0; g.tile(b.x, b.y).owner = 1; g.tile(9, 23).owner = 1; g.recompute(); }
    if (cause === 'funds') g.pigment[1] = 0;
    if (cause === 'full') for (let i = 0; i < CONFIG.unitLimit; i++) makeUnit(g, 1, 9, 22, b);
    assert.equal(g.productionOutflow(1), 0, cause);
    const count = g.getUnitCount(1), pigment = g.pigment[1]; g.update(.2);
    assert.equal(g.getUnitCount(1), count, cause); assert.ok(g.pigment[1] >= pigment, cause);
    assert.equal(b.productionState, cause);
  }
});

test('a long hold resumes one normal spawn, without a stored burst', () => {
  const g = new Game(), b = barracks(g); b.productionProgress = 4.9; g.setSpendingHeld(1, true); g.update(30);
  assert.equal(g.getUnitCount(1), 0); assert.equal(b.productionProgress, 4.9);
  g.setSpendingHeld(1, false); g.update(.2); assert.equal(g.getUnitCount(1), 1);
  g.update(1); assert.equal(g.getUnitCount(1), 1);
});

test('one shared population cap covers all producers without overspending', () => {
  const g = new Game(); const a = barracks(g);
  const b = g._addBuilding(1, 'barracks', 10, 21); g.recompute();
  for (let i = 0; i < CONFIG.unitLimit - 1; i++) makeUnit(g, 1, 8, 23, a);
  a.productionProgress = b.productionProgress = 4.99; g.pigment[1] = 50; g.update(.04);
  assert.equal(g.getUnitCount(1), CONFIG.unitLimit); assert.ok(g.pigment[1] > 44 && g.pigment[1] < 45);
});

test('flow reroutes existing and future affiliated units; pause preserves their order', () => {
  const g = new Game(), b = barracks(g); g.update(5.1);
  const u = g.units[0], position = { x: u.x, y: u.y };
  assert.equal(g.setFlow(1, b.id, 9, 18).ok, true); assert.deepEqual(u.target, { x: 9, y: 18 });
  assert.deepEqual({ x: u.x, y: u.y }, position); g.toggleProduction(1, b.id); assert.deepEqual(u.target, { x: 9, y: 18 });
  g.update(1); assert.ok(u.y < position.y);
  g.toggleProduction(1, b.id); g.update(5); assert.deepEqual(g.units.find(v => v.id !== u.id).target, { x: 9, y: 18 });
  assert.equal(g.recall(1, b.id).ok, true); for (const unit of g.units) assert.deepEqual(unit.target, { x: b.x, y: b.y });
});

test('destroyed producers reattach survivors and adopt the current Cœur order without teleport', () => {
  const g = new Game(), b = barracks(g); g.update(5.1); g.setFlow(1, b.id, 9, 18);
  g.setFlow(1, g.getCore(1).id, 10, 23);
  const unit = g.units[0], before = { x: unit.x, y: unit.y }; b.hp = 0; g._removeDead();
  assert.equal(unit.producerId, g.getCore(1).id); assert.deepEqual({ x: unit.x, y: unit.y }, before); assert.deepEqual(unit.target, { x: 10, y: 23 });
  assert.equal(g.setFlow(1, g.getCore(1).id, 8, 23).ok, true); assert.deepEqual(unit.target, { x: 8, y: 23 });
});

test('an orphan with no Cœur order returns to defend its Cœur', () => {
  const g = new Game(), b = barracks(g), unit = makeUnit(g, 1, 9, 18, b);
  g.setFlow(1, b.id, 9, 17); b.hp = 0; g._removeDead();
  assert.equal(unit.producerId, g.getCore(1).id); assert.deepEqual(unit.target, { x: 9, y: 23 });
});

test('recall retreats without retaliation while vulnerable, then defends on arrival', () => {
  const g = new Game(), b = barracks(g), unit = makeUnit(g, 1, 9, 17, b), enemy = makeUnit(g, 2, 9, 16);
  unit.attackCooldown = enemy.attackCooldown = 0; g.recompute();
  const y = unit.y; assert.equal(g.recall(1, b.id).ok, true); assert.equal(unit.retreating, true); assert.equal(b.flowMode, 'defend');
  assert.equal(g.perception(1).units.find(u => u.id === unit.id).retreating, true);
  g.update(.04);
  assert.ok(unit.y > y, 'Retreat continues despite adjacent enemy'); assert.equal(unit.hp, UNIT_STATS.hp - UNIT_STATS.damage); assert.equal(enemy.hp, UNIT_STATS.hp, 'No retaliatory damage');
  enemy.hp = 0; g._removeDead(); g.update(3);
  assert.equal(unit.retreating, false); assert.ok(Math.hypot(unit.x - b.x - .5, unit.y - b.y - .5) < .61);
  const invader = makeUnit(g, 2, 9, 20); g.getCore(1).attackCooldown = 100; g.recompute(); g.update(.04);
  assert.ok(invader.hp < UNIT_STATS.hp, 'Arrived unit resumes defense');
});

test('a normal flow immediately cancels retreat and resumes combat en route', () => {
  const g = new Game(), b = barracks(g), unit = makeUnit(g, 1, 9, 17, b), enemy = makeUnit(g, 2, 9, 16);
  unit.attackCooldown = enemy.attackCooldown = 0; g.recompute(); g.recall(1, b.id); assert.equal(unit.retreating, true);
  assert.equal(g.setFlow(1, b.id, 9, 15).ok, true); assert.equal(unit.retreating, false); assert.equal(b.flowMode, 'attack');
  g.update(.04); assert.equal(enemy.hp, UNIT_STATS.hp - UNIT_STATS.damage);
});

test('recalled defenders give up a chase outside their producer area and return home', () => {
  const g = new Game(), b = barracks(g), unit = makeUnit(g, 1, 9, 21, b), enemy = makeUnit(g, 2, 9, 19);
  g.recompute(); g.recall(1, b.id); g.getCore(1).attackCooldown = 100;
  g.update(.5); assert.ok(unit.y < b.y + .5, 'Defends against a local threat');
  enemy.y = 18.1; g.recall(2, g.getCore(2).id); g.recompute();
  assert.ok(Math.abs(enemy.y - unit.y) < UNIT_STATS.aggro, 'Enemy is still within this unit’s ordinary aggro distance');
  assert.equal(g._unitTarget(unit), null, 'The producer boundary stops an endless chase');
  const beforeY = unit.y; g.update(.3); assert.ok(unit.y > beforeY); assert.ok(Math.hypot(unit.x - b.x - .5, unit.y - b.y - .5) < .1);
});

test('retreat survivors retarget a destroyed producer to their Cœur even if it has an attack flow', () => {
  const g = new Game(), b = barracks(g), unit = makeUnit(g, 1, 9, 17, b), position = { x: unit.x, y: unit.y };
  g.recompute(); g.recall(1, b.id); g.setFlow(1, g.getCore(1).id, 9, 15);
  b.hp = 0; g._removeDead();
  assert.equal(unit.producerId, g.getCore(1).id); assert.equal(unit.retreating, true); assert.deepEqual(unit.target, { x: 9, y: 23 }); assert.deepEqual({ x: unit.x, y: unit.y }, position);
});

test('flow refuses unobserved positions but accepts the public enemy starting Cœur', () => {
  const g = new Game(), b = barracks(g); assert.equal(g.setFlow(1, b.id, 1, 1).ok, false);
  assert.equal(g.setFlow(1, b.id, 9, 3).ok, true); assert.equal(g.setFlow(2, b.id, 9, 23).ok, false);
});

test('only the Cœur upgrades, with capped levels and concrete costs', () => {
  const g = new Game(); assert.equal(g.upgradeCore(1).ok, true); assert.equal(g.pigment[1], 30); assert.equal(g.getCore(1).level, 2);
  assert.equal(g.upgradeCore(1).ok, false); g.pigment[1] = 100; assert.equal(g.upgradeCore(1).ok, true); assert.equal(g.getCore(1).level, 3);
  assert.equal(g.upgradeCore(1).ok, false); assert.equal(g.getCore(1).maxHp, 400); assert.equal(typeof g.upgradeBuilding, 'undefined');
});

test('perception contains own state and visible enemies without hidden ownership, orders or economy', () => {
  const g = new Game(); const a = g.perception(1);
  assert.equal(a.buildings.length, 1); assert.equal(a.tiles[3 * g.width + 9].owner, null);
  assert.equal(a.pigment, 65); assert.equal(Object.hasOwn(a, 'enemyPigment'), false);
  makeUnit(g, 2, 9, 18); g.updateVisibility(); const b = g.perception(1), enemy = b.units.find(u => u.team === 2);
  assert.ok(enemy); assert.equal(Object.hasOwn(enemy, 'target'), false); assert.equal(Object.hasOwn(enemy, 'producerId'), false);
  b.buildings[0].hp = 1; b.tiles[23 * g.width + 9].owner = 2; b.hand[0] = 'bleach';
  assert.equal(g.getCore(1).hp, 240); assert.equal(g.tile(9, 23).owner, 1); assert.equal(g.hands[1][0], 'relay');
});

test('invisible enemy changes cannot alter previews or the same visible perception', () => {
  const a = new Game(), b = new Game();
  b.pigment[2] = 1; b.getCore(2).hp = 12; b.getCore(2).flow = { x: 2, y: 20 }; makeUnit(b, 2, 3, 2);
  assert.deepEqual(a.perception(1), b.perception(1));
  assert.deepEqual(a.previewCard(1, 3, 9, 3), b.previewCard(1, 3, 9, 3));
});

test('Gomme removes visible enemy network but never enemy buildings or unseen tiles', () => {
  const g = new Game(); g.hands[1][0] = 'bleach';
  makeConnected(g, 1, [[9, 19], [9, 20], [9, 21], [9, 22]]);
  g.tile(9, 17).owner = 2; g.tile(10, 17).owner = 2; g.tile(11, 17).owner = 2;
  const enemy = g._addBuilding(2, 'relay', 9, 17); g.recompute();
  assert.equal(g.isVisible(1, 9, 17), true); assert.equal(g.isVisible(1, 11, 17), false);
  assert.equal(g.playCard(1, 0, 9, 17).ok, true);
  assert.equal(g.tile(9, 17).owner, 2); assert.equal(enemy.hp, enemy.maxHp); assert.equal(g.tile(11, 17).owner, 2);
});

test('splash hits visible hostiles only; wave pushes without passing obstacles', () => {
  const g = new Game(); const own = makeUnit(g, 1, 9, 19), enemy = makeUnit(g, 2, 9, 18); g.recompute();
  const hp = enemy.hp; assert.equal(g.playCard(1, 3, 9, 18).ok, true); assert.equal(enemy.hp, hp - 18); assert.equal(own.hp, UNIT_STATS.hp);
  g.hands[1][0] = 'wave'; enemy.hp = 32; const y = enemy.y;
  assert.equal(g.playCard(1, 0, 9, 19).ok, true); assert.ok(enemy.y < y); assert.equal(g.tile(Math.floor(enemy.x), Math.floor(enemy.y)).blocked, false);
});

test('paid units actually move, claim enemy paint and attack a visible building', () => {
  const g = new Game(); const b = barracks(g); g.setFlow(1, b.id, 9, 18);
  g.tile(9, 18).owner = 2; const post = g._addBuilding(2, 'relay', 9, 17); g.tile(9, 17).owner = 2; g.recompute();
  g.update(20); assert.ok(post.hp < post.maxHp); assert.equal(g.tile(9, 19).owner, 1); assert.equal(g.getUnitCount(1), 4);
});

test('a 240-second tie enters one 30-second overtime with accelerated income, then draws', () => {
  const g = new Game(); g.update(179.9); const income = g.income[1]; assert.equal(g.accelerated, false);
  g.update(.1); assert.equal(g.accelerated, true); assert.ok(Math.abs(g.income[1] - income * 1.5) < 1e-9); assert.equal(g.income[1], g.income[2]);
  assert.equal(g.events.filter(e => e.type === 'acceleration').length, 1); g.update(60);
  assert.equal(g.time, 240); assert.equal(g.winner, null); assert.equal(g.overtime, true); assert.equal(g.duration, 240); assert.equal(g.timeLimit, 270);
  assert.equal(g.perception(1).remaining, 30); assert.equal(g.perception(1).overtime, true); assert.equal(g.events.filter(e => e.type === 'overtime').length, 1);
  g.update(29.9); assert.equal(g.winner, null); assert.ok(Math.abs(g.income[1] - income * 1.5) < 1e-9);
  g.update(.1); assert.equal(g.time, 270); assert.equal(g.winner, 0); assert.match(g.winReason, /prolongation/);
  assert.equal(g.productionOutflow(1), 0); const before = snapshot(g); g.update(100); assert.equal(snapshot(g), before);
});

test('one extra connected cell wins at regulation or overtime end without a 50% threshold', () => {
  for (const overtime of [false, true]) {
    const g = new Game();
    if (overtime) g.update(240);
    g.tile(9, 19).owner = 1; g.recompute();
    assert.ok(g.scores[1] > g.scores[2] && g.scores[1] < .5);
    g.update(overtime ? 30 : 240);
    assert.equal(g.time, overtime ? 270 : 240); assert.equal(g.winner, 1); assert.equal(g.overtime, overtime);
  }
});

test('Cœur destruction and 15-second domination remain immediate victories during overtime', () => {
  const core = new Game(); core.update(240); core.getCore(2).hp = 0; core.update(.04);
  assert.equal(core.winner, 1); assert.ok(core.time < 241); assert.match(core.winReason, /Cœur adverse/);
  const domination = new Game(); domination.update(240);
  for (const tile of domination.tiles) if (!tile.blocked) tile.owner = tile.y >= 12 ? 1 : 2;
  domination.recompute(); domination.update(14.9); assert.equal(domination.winner, null); assert.ok(domination.hold[1] > 14.8);
  domination.update(.1); assert.equal(domination.winner, 1); assert.ok(Math.abs(domination.time - 255) < 1e-7); assert.match(domination.winReason, /15 secondes/);
});

test('domination counts connected walkable cells and requires 15 continuous seconds of strict lead', () => {
  const g = new Game();
  for (const t of g.tiles) if (!t.blocked) t.owner = t.y >= 12 ? 1 : 2;
  g.recompute(); assert.ok(g.scores[1] > .5); g.update(10); assert.equal(g.winner, null); assert.ok(g.hold[1] >= 9.9);
  for (const t of g.tiles) if (t.y === 12 || t.y === 13) t.owner = 2; g.recompute(); g.update(.1); assert.equal(g.hold[1], 0);
  for (const t of g.tiles) if (t.y === 12 || t.y === 13) t.owner = 1; g.recompute(); g.update(15);
  assert.equal(g.winner, 1); assert.match(g.winReason, /15 secondes/);
});

test('isolated paint is excluded; exactly equal half-territories cannot both claim domination', () => {
  const g = new Game(); neutralise(g);
  g.tile(1, 1).owner = 1; g.recompute(); assert.equal(g.scores[1], 1 / 505);
  g.scores[1] = g.scores[2] = .5; g._checkVictory(15); assert.equal(g.winner, null); assert.equal(g.hold[1], 0); assert.equal(g.hold[2], 0);
  g.scores[2] = .4; g._checkVictory(15); assert.equal(g.winner, null); assert.equal(g.hold[1], 0, 'Exactly 50% is not enough even with a lead');
});

test('both erased Cœurs draw; a surviving Cœur wins, with no instant loss from Gomme', () => {
  const a = new Game(); a.getCore(2).hp = 0; a.update(.04); assert.equal(a.winner, 1);
  const b = new Game(); b.getCore(1).hp = b.getCore(2).hp = 0; b.update(.04); assert.equal(b.winner, 0);
});

test('fixed simulation steps give identical continuations across frame slicing', () => {
  const a = new Game({ seed: 19 }), b = new Game({ seed: 19 });
  barracks(a); barracks(b); a.setFlow(1, 3, 9, 3); b.setFlow(1, 3, 9, 3);
  for (let i = 0; i < 1200; i++) a.update(1 / 60);
  for (let i = 0; i < 100; i++) b.update(.2);
  const strip = g => { const value = JSON.parse(snapshot(g)); delete value._accumulator; return value; };
  assert.deepEqual(strip(a), strip(b));
});


test('mirrored paid armies stay symmetric through regulation and overtime regardless of insertion order', () => {
  const games = [new Game(), new Game()];
  for (const g of games) {
    const a = barracks(g), b = barracks(g, 9, 5, 2);
    g.setFlow(1, a.id, 9, 3); g.setFlow(2, b.id, 9, 23);
  }
  for (let i = 0; i < 2700; i++) {
    games[0].update(.1);
    games[1].units.sort((a, b) => b.team - a.team || a.ordinal - b.ordinal);
    games[1].buildings.sort((a, b) => b.team - a.team || a.id - b.id);
    games[1].update(.1);
  }
  const state = g => ({
    time: g.time, winner: g.winner, scores: g.scores, pigment: g.pigment,
    tiles: g.tiles.map(t => t.owner),
    units: g.units.map(u => [u.team, u.ordinal, u.x, u.y, u.hp]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  });
  assert.deepEqual(state(games[0]), state(games[1]));
  const g = games[0]; assert.equal(g.winner, 0); assert.equal(g.scores[1], g.scores[2]);
  for (const t of g.tiles) { const opposite = g.tile(18 - t.x, 26 - t.y); assert.equal(t.owner, opposite.owner ? 3 - opposite.owner : 0); }
  for (const u of g.units.filter(u => u.team === 1)) {
    const opposite = g.units.find(v => v.team === 2 && v.ordinal === u.ordinal);
    assert.ok(opposite); assert.ok(Math.abs(u.x + opposite.x - 19) < 1e-8); assert.ok(Math.abs(u.y + opposite.y - 27) < 1e-8); assert.equal(u.hp, opposite.hp);
  }
});

test('real simultaneous lethal strikes on both Cœurs produce a draw', () => {
  const g = new Game(); g.getCore(1).hp = g.getCore(2).hp = UNIT_STATS.damage;
  const a = makeUnit(g, 1, 9, 4), b = makeUnit(g, 2, 9, 22); a.attackCooldown = b.attackCooldown = 0;
  g.recompute(); g.update(.04); assert.equal(g.winner, 0); assert.match(g.winReason, /deux Cœurs/);
});


test('a fourth connected source honestly previews its capped income', () => {
  const g = new Game();
  for (const tile of g.tiles) if (!tile.blocked && tile.y > 3) tile.owner = 1;
  for (const [x, y] of [[5, 19], [13, 19], [9, 13]]) g._addBuilding(1, 'extractor', x, y);
  g.recompute();
  const before = snapshot(g), preview = g.previewCard(1, 2, 5, 7);
  assert.equal(preview.ok, true); assert.equal(preview.incomeGain, 0); assert.match(preview.message, /3 sources/); assert.equal(snapshot(g), before);
  const income = g.income[1]; play(g, 'extractor', 5, 7); assert.equal(g.income[1], income);
});

console.log('\n' + checks + ' paint-engine checks passed.');
