/* Renderer contracts: hidden-state independence, read-only drawing and truthful
 * group/partial-stroke feedback. These checks do not compare decorative pixels. */
'use strict';
const assert = require('node:assert/strict');
const Engine = require('../paint-engine.js');
globalThis.CQPaintEngine = Engine;
const Renderer = require('../paint-renderer.js');
const view = { x: 0, y: 0, w: 360, h: 640, cell: 14 };
function canvasLog() {
  const calls = [], values = {};
  return { calls, context: new Proxy({}, {
    get(_target, key) {
      if (key in values) return values[key];
      if (key === 'measureText') return text => ({ width: String(text).length * 6 });
      return (...args) => calls.push([key, ...args]);
    },
    set(_target, key, value) { values[key] = value; calls.push(['set', key, value]); return true; }
  }) };
}
function render(game, ui = {}, customView = view) {
  const c = canvasLog(); Renderer.draw(c.context, game, customView, ui, game.time); return c.calls;
}
function labels(log) { return log.filter(call => call[0] === 'fillText').map(call => call[1]); }
let count = 0;
function test(name, run) { run(); count++; process.stdout.write('✓ ' + name + '\n'); }

test('drawing does not change simulation state, including the tutorial overlay', () => {
  const game = new Engine.Game();
  const before = JSON.stringify(game);
  render(game, { tutorial: { target: { x: 5, y: 19 }, path: [{ x: 6, y: 22 }, { x: 5, y: 22 }, { x: 5, y: 19 }] } });
  assert.equal(JSON.stringify(game), before);
});

test('hidden hostile health, source occupation and orders cannot affect the picture', () => {
  const game = new Engine.Game();
  const baseline = render(game);
  game.buildings.push({ id: 100, team: 2, type: 'extractor', x: 5, y: 7, hp: 75, maxHp: 75, connected: true });
  game.units.push({ id: 200, team: 2, x: 5.5, y: 7.5, hp: 32, maxHp: 32, producerId: 100, retreating: true, target: { x: 8, y: 21 } });
  game.events.push({ type: 'spawn', team: 2, x: 5.5, y: 7.5, time: game.time });
  assert.equal(game.isVisible(1, 5, 7), false);
  assert.deepEqual(render(game), baseline);
  Object.defineProperty(game.buildings.at(-1), 'connected', { get() { throw Error('hidden enemy connection accessed'); } });
  Object.defineProperty(game.buildings.at(-1), 'hp', { get() { throw Error('hidden enemy health accessed'); } });
  Object.defineProperty(game.units.at(-1), 'hp', { get() { throw Error('hidden enemy health accessed'); } });
  assert.deepEqual(render(game), baseline);
});

test('visible hostile producers do not disclose their private production or connection state', () => {
  const game = new Engine.Game();
  const b = { id: 110, team: 2, type: 'barracks', x: 9, y: 19, hp: 100, maxHp: 100, level: 1 };
  game.visibility[1][b.y * game.width + b.x] = true;
  game.buildings.push(b);
  for (const key of ['connected', 'productionState', 'productionPaused', 'productionProgress', 'flow', 'flowMode']) {
    Object.defineProperty(b, key, { get() { throw Error('enemy private field: ' + key); } });
  }
  assert.doesNotThrow(() => render(game));
});

function clustered() {
  const game = new Engine.Game();
  for (let i = 0; i < 3; i++) game.units.push({ id: 300 + i, team: 1, x: 7.3 + i * .15, y: 21.4, hp: 32, maxHp: 32, producerId: 150, retreating: false });
  return game;
}
test('only nearby units of the same own producer share a count badge when zoomed out', () => {
  const game = clustered();
  assert.ok(labels(render(game)).includes('3'));
  game.units[2].producerId = 151;
  assert.equal(labels(render(game)).includes('3'), false, 'different producers are never merged');
  assert.ok(labels(render(game)).includes('2'));
  game.units[1].x += 4;
  assert.equal(labels(render(game)).includes('2'), false, 'a dispersed force does not collapse into one badge');
});

test('zooming in or approaching visible combat restores individual positions', () => {
  const game = clustered();
  assert.equal(labels(render(game, {}, { ...view, cell: 28 })).includes('3'), false);
  game.visibility[1][21 * game.width + 8] = true;
  game.units.push({ id: 400, team: 2, x: 8.5, y: 21.4, hp: 32, maxHp: 32, producerId: 2 });
  assert.equal(labels(render(game)).includes('3'), false);
});

test('a partial stroke displays its payable prefix and a separate red dotted refusal', () => {
  const game = new Engine.Game();
  const log = render(game, { mode: 'brush', preview: { ok: true, partial: true, cost: 2, path: [{ x: 9, y: 20 }, { x: 9, y: 19 }, { x: 9, y: 18 }], cells: [{ x: 9, y: 19 }, { x: 9, y: 18 }], rejectedPath: [{ x: 9, y: 17 }], reason: 'Hors de vue' } });
  assert.ok(labels(log).includes('2 pigments'));
  assert.ok(log.some(call => call[0] === 'set' && call[1] === 'strokeStyle' && call[2] === '#b8493e'));
  assert.ok(log.some(call => call[0] === 'setLineDash' && JSON.stringify(call[1]) === '[2,4]'));
});

test('reduced motion freezes the tutorial hand while keeping a static instruction', () => {
  const game = new Engine.Game();
  const ui = { reducedMotion: true, tutorial: { target: { x: 5, y: 19 }, handDemo: { kind: 'brush', path: [{ x: 6, y: 22 }, { x: 5, y: 19 }] } } };
  const atStart = render(game, ui);
  game.time = 1.8;
  assert.deepEqual(render(game, ui), atStart);
  assert.ok(atStart.some(call => call[0] === 'rotate' && call[1] === -.24), 'static finger stays visible');
});
process.stdout.write(count + ' paint renderer contracts passed\n');
