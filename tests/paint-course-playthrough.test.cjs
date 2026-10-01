'use strict';
const assert = require('node:assert/strict');
const Course = require('../paint-course.js');
const AI = require('../paint-ai.js');

// A reproducible mixed strategy, using the ordinary command API and limited
// perception. No injected winner, territory, money, hand, damage or rewards.
// A decision every 1.6 s can issue a group order and one paid action, just as
// the opponent controller does. This is a playability regression, not a
// measurement of human difficulty, enjoyment, or a human victory rate.
const run = Course.create({seed:8});
const results = [];
while (run.phase === 'briefing') {
  const game = run.startFight();
  AI.configure(game, 1, {profile:'eraser'});
  let nextDecision = 3, nextCheckpoint = 30, frames = 0;
  while (run.phase === 'combat' && frames++ < 2800) {
    run.update(.1);
    if (game.time >= nextDecision && game.winner === null) {
      AI.update(game, .1, 1);
      nextDecision = game.time + 1.6;
    }
    if (game.time >= nextCheckpoint && game.winner === null) {
      const checkpoint = Course.snapshot(run);
      const resumed = Course.restore(JSON.stringify(checkpoint));
      assert.deepEqual(Course.snapshot(resumed), checkpoint, 'a real evolving combat remains exactly restorable');
      nextCheckpoint += 30;
    }
    assert.ok(game.pigment.every(value => Number.isFinite(value) && value >= 0 && value <= 100));
    assert.ok(game.getUnitCount(1) <= 24 && game.getUnitCount(2) <= 24);
  }
  run.update(0);
  assert.equal(game.winner, 1, 'the mixed strategy can win encounter ' + (run.encounterIndex + 1));
  const checkpoint = Course.snapshot(run);
  assert.deepEqual(Course.snapshot(Course.restore(JSON.stringify(checkpoint))), checkpoint, 'the earned result remains restorable');
  results.push({encounter:run.encounterIndex + 1, time:+game.time.toFixed(1), reason:game.winReason,
    scores:game.scores.map(value => +value.toFixed(3))});
  if (run.phase === 'reward') {
    const id = run.offers.find(reward => reward.id === 'mortar')?.id ||
      run.offers.find(reward => reward.id === 'hard-coat')?.id || run.offers[0].id;
    assert.equal(run.chooseReward(id).ok, true);
  }
}
assert.equal(run.phase, 'won');
assert.equal(results.length, 3);
assert.deepEqual(run.chosenRewards, ['mortar', 'hard-coat']);
console.log('Three actual course victories:', JSON.stringify(results));
console.log('Course playthrough passed: legal commands, ordinary costs, exact checkpoints and two earned rewards.');
