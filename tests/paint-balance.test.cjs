'use strict';
const assert = require('node:assert/strict');
const { Game, CARDS, CONFIG } = require('../paint-engine.js');
const AI = require('../paint-ai.js');
// Broad optional simulation matrix. V0.8.1's focused onset/novice safety checks
// live in paint-pacing.test.cjs. Repeated seeds check deterministic setup, not
// a statistical human win rate.
const seeds = [7, 42];
const measurements = [];

for (const seed of seeds) {
  const game = new Game({ seed });
  const initialHp = game.getCore(1).hp;
  let firstDamage = null, peakArmy = 0, firstProducer = null, firstSource = null;
  let painted = 0, played = 0;
  const paint = game.paint, playCard = game.playCard;
  game.paint = function (...args) { const result = paint.apply(this, args); if (args[0] === 2 && result.ok) painted++; return result; };
  game.playCard = function (...args) { const result = playCard.apply(this, args); if (args[0] === 2 && result.ok) played++; return result; };
  for (let frame = 0; frame < 2701 && game.winner === null; frame++) {
    game.update(.1); AI.update(game, .1);
    if (firstDamage === null && (!game.getCore(1) || game.getCore(1).hp < initialHp)) firstDamage = game.time;
    peakArmy = Math.max(peakArmy, game.units.filter(unit => unit.team === 2).length);
    if (firstProducer === null && game.buildings.some(b => b.team === 2 && b.type === 'barracks')) firstProducer = game.time;
    if (firstSource === null && game.buildings.some(b => b.team === 2 && b.type === 'extractor')) firstSource = game.time;
    assert.ok(Number.isFinite(game.pigment[2]) && game.pigment[2] >= -1e-8 && game.pigment[2] <= 100 + 1e-8);
    assert.ok(game.units.every(unit => Number.isFinite(unit.x) && Number.isFinite(unit.y) && Number.isFinite(unit.hp)));
  }
  assert.equal(game.winner, 2, `AI must really beat an idle opponent (seed ${seed})`);
  assert.ok(game.time <= 270.01, `Combat cannot stall (seed ${seed})`);
  assert.ok(firstProducer !== null && firstProducer < 8, 'Immediate paid development');
  assert.ok(firstSource !== null && firstSource < 55, 'Develops a real source economy');
  assert.ok(firstDamage === null || firstDamage >= AI.CORE_PUSH, `No idle-player core rush: ${firstDamage}`);
  assert.ok(game.time >= AI.CORE_PUSH, 'An idle onboarding player is not erased before the late assault');
  assert.ok(peakArmy >= 4, 'Creates an actual army');
  assert.ok(painted >= 8 && played >= 4, 'Uses brush and multiple ordinary cards');
  measurements.push({ seed, time: +game.time.toFixed(1), reason: game.winReason,
    firstDamage: firstDamage === null ? null : +firstDamage.toFixed(1),
    firstSource: +firstSource.toFixed(1), peakArmy, painted, played });
}

// These deliberately limited opponents are real action scripts, not stat boosts.
// Their different start delays and choices exercise stalled decks, resource
// starvation and one-dimensional strategies before a human playtest.
function playerPolicy(style, seed) {
  let next = 3 + seed % 7;
  const cadence = 1.6 + (seed % 3) * .35;
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  return game => {
    if (game.time < next || game.winner !== null) return;
    next = game.time + cadence;
    const p = game.perception(1), core = p.buildings.find(b => b.team === 1 && b.type === 'core');
    if (!core) return;
    const buildings = p.buildings.filter(b => b.team === 1), producers = buildings.filter(b => b.type === 'barracks');
    const enemies = p.units.filter(u => u.team === 2);
    const occupied = new Set(p.buildings.map(b => b.y * p.width + b.x));
    const tile = (x, y) => x >= 0 && x < p.width && y >= 0 && y < p.height ? p.tiles[y * p.width + x] : null;
    const free = p.tiles.filter(t => t.owner === 1 && t.connected && !t.blocked && !occupied.has(t.y * p.width + t.x));
    const play = (id, candidates) => {
      const index = p.hand.indexOf(id);
      if (index < 0 || p.pigment < CARDS[id].cost) return false;
      for (const target of candidates) {
        if (!game.previewCard(1, index, Math.floor(target.x), Math.floor(target.y)).ok) continue;
        return game.playCard(1, index, Math.floor(target.x), Math.floor(target.y)).ok;
      }
      return false;
    };
    for (const b of producers) {
      const target = style === 'pressure' ? p.coreStarts[2] : core;
      if (!b.flow || b.flow.x !== target.x || b.flow.y !== target.y) game.setFlow(1, b.id, target.x, target.y);
    }
    if (enemies.length && (play('splash', enemies) || play('wave', enemies))) return;
    const barracks = free.filter(t => !t.source).sort((a, b) => style === 'pressure' ? a.y - b.y || dist(a, core) - dist(b, core) : dist(a, core) - dist(b, core));
    if (style !== 'painter' && producers.length < (style === 'pressure' ? 2 : 1) && play('barracks', barracks)) return;
    if (play('extractor', free.filter(t => t.source))) return;
    const gain = t => p.tiles.filter(n => n.owner === 0 && !n.blocked && Math.hypot(n.x - t.x, n.y - t.y) <= 3.2).length;
    const relaySites = free.filter(t => !t.source).map(t => ({ t, gain: gain(t) })).filter(item => item.gain >= 8)
      .sort((a, b) => b.gain - a.gain || (seed % 2 ? a.t.x - b.t.x : b.t.x - a.t.x)).map(item => item.t);
    if (play('relay', relaySites)) return;
    if (style !== 'painter' && buildings.filter(b => b.type === 'bastion').length < (style === 'defense' ? 2 : 1)) {
      const point = { x: core.x, y: style === 'defense' ? core.y - 3 : core.y - 8 };
      if (play('bastion', free.filter(t => !t.source).sort((a, b) => dist(a, point) - dist(b, point)))) return;
    }
    if (style === 'defense' && core.level < 3 && p.pigment > 55 && game.upgradeCore(1).ok) return;
    const cap = Math.min(CONFIG.brushLimit, Math.floor(p.pigment - (style === 'painter' ? 0 : CONFIG.unitCost)));
    if (cap < 1) return;
    const sources = p.tiles.filter(t => t.source && t.y >= 13 && t.owner !== 2 && !(t.owner === 1 && t.connected));
    sources.sort((a, b) => dist(a, core) - dist(b, core));
    const objective = style === 'painter' ? null : sources[0];
    let best = null, bestScore = -Infinity;
    for (const start of p.tiles.filter(t => t.owner === 1 && t.connected && !t.blocked)) {
      const path = [{ x: start.x, y: start.y }], visited = new Set([start.y * p.width + start.x]);
      for (let n = 0; n < cap; n++) {
        const current = path[path.length - 1];
        const neighbours = [[0, -1], [seed % 2 ? -1 : 1, 0], [seed % 2 ? 1 : -1, 0], [0, 1]]
          .map(([dx, dy]) => tile(current.x + dx, current.y + dy))
          .filter(t => t && t.visible && t.owner === 0 && !t.blocked && !visited.has(t.y * p.width + t.x));
        if (objective) neighbours.sort((a, b) => dist(a, objective) - dist(b, objective));
        if (!neighbours.length) break;
        const target = neighbours[0]; visited.add(target.y * p.width + target.x); path.push({ x: target.x, y: target.y });
        if (objective && dist(target, objective) === 0) break;
      }
      if (path.length < 2) continue;
      const end = path[path.length - 1];
      const score = objective ? -dist(end, objective) * 4 + path.length * .1 : path.length - Math.abs(end.y - 17) * .01;
      if (score > bestScore) { bestScore = score; best = path; }
    }
    if (best && game.previewPaint(1, best).ok) game.paint(1, best);
  };
}
const styles = [];
for (const style of ['painter', 'pressure', 'defense']) for (const seed of [7, 29]) {
  const game = new Game({ seed }), player = playerPolicy(style, seed);
  let firstDamage = null;
  for (let frame = 0; frame < 2701 && game.winner === null; frame++) {
    game.update(.1); player(game); AI.update(game, .1);
    if (firstDamage === null && (!game.getCore(1) || game.getCore(1).hp < game.getCore(1).maxHp)) firstDamage = game.time;
    assert.ok(game.pigment.every(value => Number.isFinite(value) && value >= -1e-8 && value <= CONFIG.pigmentCap + 1e-8));
  }
  assert.notEqual(game.winner, null, `${style} must finish`);
  assert.ok(game.time <= 270.01);
  styles.push({ style, seed, winner: game.winner, time: +game.time.toFixed(1),
    firstDamage: firstDamage === null ? null : +firstDamage.toFixed(1), reason: game.winReason,
    scores: game.scores.map(score => +score.toFixed(3)) });
}

// Identical policies with alternating first-to-act order expose a side or turn
// order advantage without pretending to measure human difficulty statistically.
const mirrors = [];
for (const seed of [7, 42]) {
  const results = [];
  for (const first of [1, 2]) {
    const game = new Game({ seed });
    for (let frame = 0; frame < 2701 && game.winner === null; frame++) {
      game.update(.1);
      AI.update(game, .1, first); AI.update(game, .1, 3 - first);
    }
    assert.notEqual(game.winner, null, 'Self-play must also finish');
    assert.ok(game.time <= 270.01);
    assert.ok(game.scores.every(Number.isFinite));
    results.push({ first, winner: game.winner, time: +game.time.toFixed(1), scores: game.scores.map(score => +score.toFixed(3)) });
  }
  assert.equal(results[0].winner, results[1].winner === 0 ? 0 : 3 - results[1].winner, 'Rotating initiative must rotate the result, not favor the north/south camp');
  assert.ok(Math.abs(results[0].time - results[1].time) < .11, 'Rotated matches end at the same time');
  assert.ok(Math.abs(results[0].scores[1] - results[1].scores[2]) < .003 &&
    Math.abs(results[0].scores[2] - results[1].scores[1]) < .003, 'Connected shares rotate with the side');
  mirrors.push({ seed, results });
}

console.log('Idle-opponent simulations:', JSON.stringify(measurements));
console.log('Simple player policies:', JSON.stringify(styles));
console.log('Mirrored self-play:', JSON.stringify(mirrors));
console.log(`Paint balance: ${seeds.length} deterministic idle matches, 6 varied action policies and 4 self-play matches passed.`);

// Equal action budgets across all nine profile/map combinations: the same seed,
// start delay, player policy cadence and base deck; no reward or hidden AI bonus.
// These outcomes are measurements, not assertions that the painter must lose.
const course = [];
for (const mapId of ['canvas', 'narrows', 'crossroads']) for (const profile of ['rapid', 'builder', 'eraser']) {
  for (const style of ['passive', 'painter', 'pressure', 'defense']) {
    const game = new Game({ seed: 7, mapId });
    AI.configure(game, 2, { profile });
    const player = style === 'passive' ? () => {} : playerPolicy(style, 7);
    let peakArmy = 0, firstDamage = null, firstLoss = null, lostShare = 0;
    for (let frame = 0; frame < 2701 && game.winner === null; frame++) {
      const before = game.scores[1];
      game.update(.1); player(game); AI.update(game, .1);
      if (before > game.scores[1] + 1e-8) {
        lostShare += before - game.scores[1];
        if (firstLoss === null) firstLoss = game.time;
      }
      if (firstDamage === null && (!game.getCore(1) || game.getCore(1).hp < game.getCore(1).maxHp)) firstDamage = game.time;
      peakArmy = Math.max(peakArmy, game.getUnitCount(2));
      assert.ok(game.pigment.every(value => Number.isFinite(value) && value >= -1e-8 && value <= CONFIG.pigmentCap + 1e-8));
    }
    assert.notEqual(game.winner, null, `${mapId}/${profile}/${style} must finish`);
    assert.ok(game.time <= 270.01);
    if (style === 'passive') assert.equal(game.winner, 2, `${profile} must defeat inaction on ${mapId}`);
    course.push({ mapId, profile, style, winner: game.winner, time: +game.time.toFixed(1), peakArmy,
      firstDamage: firstDamage === null ? null : +firstDamage.toFixed(1),
      firstLoss: firstLoss === null ? null : +firstLoss.toFixed(1), lostShare: +lostShare.toFixed(3),
      scores: game.scores.map(score => +score.toFixed(3)) });
  }
}
console.log('Course profiles with equal player action budgets:', JSON.stringify(course));
console.log(`Course balance: ${course.length} measured map/profile/style matches passed; no human win-rate inferred.`);
