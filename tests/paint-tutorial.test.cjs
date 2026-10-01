'use strict';
const assert = require('node:assert/strict');
const { create } = require('../paint-tutorial.js');
const { Game, CONFIG } = require('../paint-engine.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('✓', name); }
function play(t, id, x, y) {
  const result = t.game.playCard(1, t.game.hands[1].indexOf(id), x, y);
  assert.equal(result.ok, true, result.message); return result;
}
function paint(t, path = t.presentation().path) {
  const result = t.game.paint(1, path); assert.equal(result.ok, true, result.message); return result;
}
function completeStep(t) {
  if (t.step === 0) paint(t);
  else if (t.step === 1) play(t, 'extractor', 9, 18);
  else if (t.step === 2) {
    play(t, 'barracks', 9, 20); t.update(5.1);
    assert.equal(t.game.setFlow(1, t.barracksId, 9, 15).ok, true); t.update(35);
  } else if (t.step === 3) { t.update(1); paint(t); }
  else if (t.step === 4) { assert.equal(t.game.recall(1, t.barracksId).ok, true); t.update(30); }
  else if (t.step === 5) { paint(t); t.update(15.1); }
  assert.equal(t.success, true, 'lesson ' + t.step + ': ' + t.presentation().notice);
}
function atStep(step) {
  const tutorial = create();
  for (let i = 0; i < step; i++) { completeStep(tutorial); assert.equal(tutorial.next().ok, true); }
  return tutorial;
}
function state(game) {
  return JSON.stringify({ time: game.time, pigment: game.pigment, hands: game.hands, buildings: game.buildings, units: game.units, tiles: game.tiles, events: game.events });
}

test('first lesson exposes one real, fully visible four-cell brush goal and no bypass', () => {
  const t = create(), game = t.game, p = t.presentation();
  assert.equal(p.title, 'Peins jusqu’à la source');
  assert.deepEqual(p.allowedCards, []); assert.equal(p.path.length, 5);
  for (const tile of p.path) assert.equal(game.isVisible(1, tile.x, tile.y), true);
  assert.equal(game.previewPaint(1, p.path).cost, 4);
  const before = state(game);
  assert.equal(game.playCard(1, 1, 9, 22).ok, false);
  assert.equal(game.upgradeCore(1).ok, false);
  assert.equal(t.next().ok, false);
  assert.equal(state(game), before);
  const pigment = game.pigment[1]; paint(t);
  assert.equal(game.pigment[1], pigment - 4);
  assert.equal(game.tile(9, 18).connected, true);
  assert.equal(game.buildings.some(b => b.type === 'extractor'), false);
  assert.match(t.presentation().successText, /Source reliée/);
  const finished = state(game); t.update(60); assert.equal(state(game), finished);
});

test('reaching the source and exploiting it are separate successes with real payment and income', () => {
  const t = atStep(1), game = t.game, before = game.pigment[1], income = game.income[1];
  assert.equal(t.success, false);
  assert.deepEqual(t.presentation().allowedCards, ['extractor']);
  assert.equal(game.playCard(1, game.hands[1].indexOf('extractor'), 9, 19).ok, false);
  assert.equal(game.pigment[1], before);
  const result = play(t, 'extractor', 9, 18);
  assert.equal(result.incomeGain, CONFIG.sourceIncome);
  assert.equal(game.pigment[1], before - 18);
  assert.ok(game.income[1] >= income + CONFIG.sourceIncome);
  assert.equal(t.success, true); assert.match(t.presentation().successText, /0,85 pigment/);
});

test('production lesson needs paid spawn plus a real group order and enemy capture', () => {
  const t = atStep(2), game = t.game;
  assert.equal(game.playCard(1, 1, 9, 21).ok, false);
  const result = play(t, 'barracks', 9, 20);
  assert.equal(t.barracksId, result.buildingId);
  assert.equal(t.presentation().phase, 'spawn');
  game.setSpendingHeld(1, true); t.update(10);
  assert.equal(game.units.filter(u => u.team === 1).length, 0);
  game.setSpendingHeld(1, false); t.update(4.9);
  assert.equal(t.paidSpawnSeen, false);
  t.update(.2);
  assert.equal(t.paidSpawnSeen, true);
  assert.equal(game.events.find(e => e.type === 'spawn' && e.team === 1).cost, CONFIG.unitCost);
  assert.equal(t.success, false);
  assert.equal(game.setFlow(1, t.barracksId, 9, 15).ok, true);
  t.update(35);
  assert.equal(t.success, true);
  assert.equal(game.tile(9, 15).owner, 1);
  assert.equal(game.buildings.some(b => b.team === 2 && b.x === 9 && b.y === 15), false);
});

test('an actual enemy occupation stops the producer; neutral detour repairs without repainting enemy', () => {
  const t = atStep(3), game = t.game;
  const producer = game.buildings.find(b => b.id === t.barracksId);
  assert.equal(producer.connected, true); assert.equal(t.cutSeen, false);
  t.update(1);
  assert.equal(game.tile(9, 20).owner, 2);
  assert.equal(producer.connected, false); assert.equal(producer.productionState, 'isolated');
  assert.equal(t.cutSeen, true);
  const budget = game.pigment[1];
  assert.equal(game.paint(1, [{ x: 9, y: 21 }, { x: 9, y: 20 }]).ok, false);
  assert.equal(game.pigment[1], budget);
  const result = paint(t);
  assert.equal(result.cost, 3); assert.equal(result.partial, false);
  assert.equal(game.tile(9, 20).owner, 2);
  assert.equal(producer.connected, true); assert.equal(producer.productionState, 'running');
  assert.equal(t.success, true);
  assert.doesNotMatch(t.presentation().successText, /dispara|secondes/);
});

test('recall lesson allows reading time then requires retreat, arrival and actual defence', () => {
  const t = atStep(4), game = t.game, producer = game.buildings.find(b => b.id === t.barracksId);
  t.update(5.5);
  assert.equal(t.waveStarted, false); assert.equal(producer.hp, producer.maxHp);
  assert.equal(t.success, false);
  const original = game.units.filter(u => t.returningIds.includes(u.id));
  assert.equal(game.recall(1, producer.id).ok, true);
  assert.ok(original.every(u => u.retreating));
  assert.equal(t.success, false);
  t.update(30);
  assert.equal(t.waveStarted, true); assert.equal(t.returnedSeen, true);
  assert.equal(t.success, true);
  assert.equal(game.units.some(u => t.waveIds.includes(u.id)), false);
  assert.ok(game.buildings.find(b => b.id === producer.id).hp > 0);
});

test('failed defence explains retry, and retry recreates a clean playable situation', () => {
  const t = atStep(4), previous = t.game;
  t.update(60); assert.equal(t.failed, true); assert.equal(t.success, false);
  assert.equal(t.presentation().canRetry, true); assert.match(t.presentation().notice, /Réessaie/);
  const frozen = state(t.game); t.update(30); assert.equal(state(t.game), frozen);
  assert.equal(t.next().ok, false);
  t.retry(); assert.notEqual(t.game, previous); assert.equal(t.step, 4);
  assert.equal(t.failed, false); assert.equal(t.recallIssued, false); assert.equal(t.elapsed, 0);
  completeStep(t); assert.equal(t.success, true);
});

test('domination lesson measures connected territory and the real fifteen-second victory', () => {
  const t = atStep(5), game = t.game;
  assert.equal(game.scores[1], 255 / 513); assert.equal(t.presentation().showDomination, true);
  paint(t, [{ x: 9, y: 13 }, { x: 8, y: 13 }]);
  t.update(20); assert.equal(game.hold[1], 0); assert.equal(game.winner, null); assert.equal(t.success, false);
  paint(t, [{ x: 8, y: 13 }, { x: 7, y: 13 }]);
  assert.equal(game.scores[1], 257 / 513);
  t.update(14); assert.equal(game.winner, null); assert.equal(t.success, false);
  assert.match(t.presentation().title, /Tiens/);
  t.update(1.1); assert.equal(game.hold[1], 15); assert.equal(game.winner, 1);
  assert.equal(t.presentation().complete, true); assert.equal(t.next().complete, true);
});

test('waiting sixty seconds never completes a lesson or causes an unrelated normal victory', () => {
  for (let step = 0; step < 6; step++) {
    const t = atStep(step); t.update(60);
    assert.equal(t.success, false, 'idle lesson ' + step);
    assert.equal(t.game.winner, null, 'idle normal victory ' + step);
    assert.equal(t.failed, step === 4, 'only actual failed defence should fail');
  }
});

test('restart and fresh combat remain independent; guidance is not classic persistence', () => {
  const t = atStep(3), prior = t.game;
  t.restart(); assert.equal(t.step, 0); assert.notEqual(t.game, prior);
  assert.equal(t.game.pigment[1], CONFIG.initialPigment);
  assert.equal(t.game.getUnitCount(1), 0);
  const free = new Game();
  assert.equal(free.duration, 240); assert.equal(free.hands[1].length, 4);
  assert.equal(free.playCard(1, 1, 9, 21).ok, true);
});

console.log('\n' + checks + ' paint tutorial checks passed.');
