'use strict';
const assert = require('node:assert/strict');
const { Game, CONFIG } = require('../paint-engine.js');
const AI = require('../paint-ai.js');

// A deliberately slow beginner: a short source connection, one barracks,
// an extractor, then two short advances. Uses only normal costs and commands.
function beginner(game, opening) {
  const completed = new Set();
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  function paintToward(goal, max = 7) {
    const p = game.perception(1), queue = [], paths = new Map();
    for (const t of p.tiles) if (t.owner === 1 && t.connected && !t.blocked) {
      const index = t.y * p.width + t.x;
      paths.set(index, [{ x: t.x, y: t.y }]); queue.push(index);
    }
    let best = null;
    for (let i = 0; i < queue.length; i++) {
      const index = queue[i], path = paths.get(index), last = path[path.length - 1];
      if (path.length > 1 && (!best || distance(last, goal) < distance(best.at(-1), goal))) best = path;
      if (path.length > max) continue;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        const x = last.x + dx, y = last.y + dy, next = p.tiles[y * p.width + x];
        if (x < 0 || x >= p.width || y < 13 || y >= p.height || !next?.visible || next.blocked || next.owner !== 0 || paths.has(y * p.width + x)) continue;
        paths.set(y * p.width + x, [...path, { x, y }]); queue.push(y * p.width + x);
      }
    }
    return best ? game.paint(1, best).ok : false;
  }
  return () => {
    const actions = [
      [12, 'source', () => {
        const p = game.perception(1), source = p.tiles.filter(t => t.source && t.y > 13).sort((a, b) => distance(a, p.coreStarts[1]) - distance(b, p.coreStarts[1]))[0];
        return source && paintToward(source);
      }],
      [20, 'finish-source', () => {
        const p = game.perception(1), source = p.tiles.filter(t => t.source && t.y > 13).sort((a, b) => distance(a, p.coreStarts[1]) - distance(b, p.coreStarts[1]))[0];
        return source && ((source.owner === 1 && source.connected) || paintToward(source));
      }],
      [26, 'connect-source', () => {
        const p = game.perception(1), source = p.tiles.filter(t => t.source && t.y > 13).sort((a, b) => distance(a, p.coreStarts[1]) - distance(b, p.coreStarts[1]))[0];
        return source && ((source.owner === 1 && source.connected) || paintToward(source));
      }],
      [30, 'barracks', () => {
        const p = game.perception(1), i = p.hand.indexOf('barracks');
        return i >= 0 && game.playCard(1, i, 9, 21).ok;
      }],
      [45, 'extractor', () => {
        const p = game.perception(1), i = p.hand.indexOf('extractor'), source = p.tiles.find(t => t.source && t.owner === 1 && t.connected);
        return source && i >= 0 && game.playCard(1, i, source.x, source.y).ok;
      }],
      [opening + 5, 'advance', () => paintToward({ x: 9, y: 14 }, 4)],
      [opening + 12, 'send', () => {
        const p = game.perception(1), producer = p.buildings.find(b => b.team === 1 && b.type === 'barracks');
        const target = p.tiles.filter(t => t.explored && !t.blocked && t.y >= 13).sort((a, b) => distance(a, {x:9,y:14}) - distance(b, {x:9,y:14}))[0];
        return producer && target && game.setFlow(1, producer.id, target.x, target.y).ok;
      }],
      [opening + 35, 'second-advance', () => paintToward({ x: 9, y: 13 }, 4)]
    ];
    for (const [time, id, action] of actions) if (game.time >= time && !completed.has(id)) {
      assert.equal(!!action(), true, 'The novice action is legal and really executes on ' + game.mapId + ': ' + id);
      completed.add(id);
    }
  };
}

const results = [];
for (const [profile, mapId] of [['default', 'canvas'], ['rapid', 'canvas'], ['builder', 'narrows'], ['eraser', 'crossroads']]) {
  const config = AI.PROFILES[profile];
  for (const style of ['idle', 'beginner']) {
    const game = new Game({seed:7, mapId});
    AI.configure(game, 2, {profile});
    const act = style === 'beginner' ? beginner(game, config.opening) : () => {};
    let firstDamage = null, firstLostTile = null, firstAttack = null, openingShare = 0, initialWave = 0, firstProducer = null;
    const flow = game.setFlow;
    game.setFlow = function(team, id, x, y) {
      const producer = this.buildings.find(b => b.id === id);
      if (team === 2 && this.time < config.opening) assert.ok(producer && producer.x === x && producer.y === y, 'Only local recall orders during development');
      const answer = flow.call(this, team, id, x, y);
      if (answer.ok && team === 2 && y >= 12 && firstAttack === null) firstAttack = this.time;
      return answer;
    };
    for (let n = 0; n < 2701 && game.winner === null; n++) {
      const before = new Set(game.tiles.filter(t => t.owner === 1).map(t => t.y * game.width + t.x));
      game.update(.1); act(); AI.update(game, .1);
      const core = game.getCore(1);
      if (firstDamage === null && (!core || core.hp < core.maxHp)) firstDamage = game.time;
      if (firstLostTile === null && game.tiles.some(t => before.has(t.y * game.width + t.x) && t.owner !== 1)) firstLostTile = game.time;
      if (firstProducer === null && game.buildings.some(b => b.team === 2 && b.type === 'barracks')) firstProducer = game.time;
      if (game.time < config.opening) {
        openingShare = Math.max(openingShare, game.scores[2]);
        assert.equal(firstDamage, null, profile + ': no core damage during development');
        assert.equal(firstLostTile, null, profile + ': no novice network cut during development');
        assert.ok(game.scores[2] <= .35 + 1e-8, profile + ': restrained opening territory');
        assert.ok(game.winner === null || game.winner === 1, profile + ': no enemy domination win during development');
      }
      if (game.time < config.opening + 35) initialWave = Math.max(initialWave, game.getUnitCount(2));
      assert.ok(game.pigment.every(n => Number.isFinite(n) && n >= 0 && n <= CONFIG.pigmentCap));
    }
    assert.notEqual(game.winner, null, 'The paced match still finishes');
    if (style === 'idle') assert.equal(game.winner, 2, 'The opponent does not become inert');
    assert.ok(firstProducer < 8, 'Paid development remains immediate');
    assert.ok(initialWave <= 3, 'No stockpiled army launches when the countdown ends');
    assert.ok(firstAttack === null || firstAttack >= config.opening);
    assert.ok(firstDamage === null || firstDamage >= config.corePush, 'No chained pursuit into the core before the assault stage');
    results.push({profile, mapId, style, winner:game.winner, time:+game.time.toFixed(1), reason:game.winReason,
      firstAttack:firstAttack === null ? null : +firstAttack.toFixed(1),
      firstDamage:firstDamage === null ? null : +firstDamage.toFixed(1),
      firstLostTile:firstLostTile === null ? null : +firstLostTile.toFixed(1), initialWave, openingShare:+openingShare.toFixed(3),
      scores:game.scores.map(score => +score.toFixed(3))});
  }
}
console.log('Measured development, first waves and novice matches:', JSON.stringify(results));
console.log('Paint pacing: eight complete matches with legal beginner actions passed; no human fun or win rate inferred.');
