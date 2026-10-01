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

test('touch picking matches the visible count badge and individual fighters without mutating them', () => {
  const game = clustered(), before = JSON.stringify(game);
  const badge = render(game).find(c => c[0] === 'fillText' && c[1] === '3');
  assert(badge, 'there must be an actual rendered group count');
  const picked = Renderer.pickGroup(game, view, { x: badge[2], y: badge[3] });
  assert.equal(picked.producerId, 150); assert.equal(picked.count, 3, 'touching the count chooses all members of that producer');
  const zoomed = { ...view, cell: 28 }, unit = game.units[2];
  const individual = Renderer.pickGroup(game, zoomed, { x: unit.x * zoomed.cell, y: unit.y * zoomed.cell });
  assert.equal(individual.producerId, 150); assert.equal(individual.count, 1, 'zoomed-in units are picked at their own displayed position');
  assert.equal(Renderer.pickGroup(game, view, { x: 0, y: 0 }), null, 'empty canvas cannot select a distant army');
  assert.equal(JSON.stringify(game), before);
});

test('touch picking distinguishes producers and never selects enemy or dead fighters', () => {
  const game = clustered(); game.units[2].producerId = 151; game.units[2].x = 11.5;
  assert.equal(Renderer.pickGroup(game, view, { x: 11.5 * view.cell, y: 21.4 * view.cell }).producerId, 151);
  assert.equal(Renderer.pickGroup(game, view, { x: 7.3 * view.cell, y: 21.4 * view.cell }).producerId, 150);
  game.units[2].hp = 0;
  assert.equal(Renderer.pickGroup(game, view, { x: 11.5 * view.cell, y: 21.4 * view.cell }), null);
  game.units.push({ id: 400, team: 2, x: 3.5, y: 20.5, hp: 32, maxHp: 32, producerId: 2 });
  game.visibility[1][20 * game.width + 3] = true;
  assert.equal(Renderer.pickGroup(game, view, { x: 3.5 * view.cell, y: 20.5 * view.cell }), null, 'visible hostile units are not player commands');
  const hostile = { id: 401, team: 2, x: 5.5, y: 7.5 };
  for (const key of ['hp', 'producerId', 'target', 'retreating']) Object.defineProperty(hostile, key, { get() { throw Error('hidden hostile picking field: ' + key); } });
  game.units.push(hostile);
  assert.equal(Renderer.pickGroup(game, view, { x: 5.5 * view.cell, y: 7.5 * view.cell }), null, 'hidden hostile private fields are never inspected');
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

function mortar(game, team = 1) {
  const b = { id: 810, team, type: 'mortar', x: 8, y: 21, hp: 80, maxHp: 80, connected: true, mortarTarget: { x: 9, y: 17 } };
  game.buildings.push(b); game.visibility[1][b.y * game.width + b.x] = true;
  return b;
}
function shell(game, team = 1, x = 9.5, y = 19.5) {
  const shot = { id: 820, team, sourceId: 810, fromX: 8.5, fromY: 21.5, x, y, remaining: .6, total: 1.2, radius: 1.5 };
  game.shells = [shot]; return shot;
}

test('mortar range and targeting cues are selected-only and do not mutate the match', () => {
  const game = new Engine.Game(), b = mortar(game);
  const stat = Engine.BUILDING_STATS.mortar || { minRange: 2.5, range: 7 };
  const rangeArc = log => log.some(c => c[0] === 'arc' && c[3] === stat.range * view.cell);
  const before = JSON.stringify(game);
  assert.equal(rangeArc(render(game)), false);
  const log = render(game, { selectedProducer: b.id, mode: 'navigate' });
  assert.ok(rangeArc(log));
  assert.ok(log.some(c => c[0] === 'arc' && c[3] === stat.minRange * view.cell));
  assert.ok(labels(log).some(label => label.startsWith('Mortier · ') && label.endsWith(' cases')));
  assert.equal(rangeArc(render(game, { selectedProducer: b.id, mode: 'brush' })), false, 'painting does not keep artillery range clutter');
  render(game, { selectedProducer: b.id, mode: 'mortar', mortarAim: { producerId: b.id, x: 9, y: 19, ok: false } });
  assert.equal(JSON.stringify(game), before);
});

test('an inspected visible hostile mortar never exposes its chosen target', () => {
  const game = new Engine.Game(), b = mortar(game, 2);
  Object.defineProperty(b, 'mortarTarget', { get() { throw Error('private hostile target read'); } });
  Object.defineProperty(b, 'connected', { get() { throw Error('private hostile network read'); } });
  assert.doesNotThrow(() => render(game, { selectedProducer: b.id, mode: 'navigate' }));
});

test('an unseen hostile shell has no visual cue and its private flight state is not inspected', () => {
  const game = new Engine.Game(), baseline = render(game);
  const shot = shell(game, 2, 5.5, 7.5);
  for (const field of ['remaining', 'sourceId', 'fromX', 'fromY', 'radius', 'total']) Object.defineProperty(shot, field, { get() { throw Error('hidden shell field ' + field); } });
  assert.deepEqual(render(game), baseline);
});

test('a visible incoming warning does not reveal an unseen launcher or draw its trajectory', () => {
  const game = new Engine.Game(), shot = shell(game, 2);
  game.visibility[1][19 * game.width + 9] = true;
  for (const field of ['fromX', 'fromY']) Object.defineProperty(shot, field, { get() { throw Error('hidden launcher ' + field); } });
  const log = render(game);
  const p = { x: 9.5 * view.cell, y: 19.5 * view.cell };
  assert.ok(log.some(c => c[0] === 'arc' && c[1] === p.x && c[2] === p.y && c[3] === shot.radius * view.cell), 'landing warning is still visible');
});

test('own shells retain their landing warning under fog and reduced motion keeps it readable', () => {
  const game = new Engine.Game(); mortar(game); const shot = shell(game, 1, 9.5, 8.5);
  game.visibility[1][8 * game.width + 9] = false;
  const before = JSON.stringify(game), log = render(game, { reducedMotion: true });
  assert.ok(log.some(c => c[0] === 'arc' && c[1] === shot.x * view.cell && c[2] === shot.y * view.cell && c[3] === shot.radius * view.cell));
  assert.equal(JSON.stringify(game), before);
});

test('green healing is a temporary, sight-clipped cross and line motif, never territory paint', () => {
  const game = new Engine.Game(); game.visibility[1][19 * game.width + 9] = true;
  game.events.push({ type: 'mixture', mixture: 'green', team: 1, x: 9, y: 19, radius: 2, time: 0 });
  const before = JSON.stringify(game), log = render(game);
  assert.ok(log.some(c => c[0] === 'set' && c[1] === 'strokeStyle' && c[2] === '#357953'));
  assert.ok(log.filter(c => c[0] === 'clip').length >= 3, 'terrain, visible area and motif disc are separately clipped');
  assert.equal(JSON.stringify(game), before);
  game.time = 3.01;
  const expired = render(game); game.events = [];
  assert.deepEqual(render(game), expired, 'mixture vanishes after three seconds');
  game.events.push({ type: 'mixture', mixture: 'green', team: 2, x: 5, y: 7, radius: 2, time: game.time });
  assert.deepEqual(render(game), expired, 'unseen healing never exposes an enemy effect');
});

test('mortar impacts expire without leaving a territory mark', () => {
  const game = new Engine.Game(); game.visibility[1][19 * game.width + 9] = true;
  const owners = game.tiles.map(t => t.owner);
  game.events.push({ type: 'mortar-impact', team: 2, x: 9, y: 19, radius: 1.5, time: game.time });
  const log = render(game, { reducedMotion: true });
  assert.ok(log.filter(c => c[0] === 'clip').length >= 2, 'splash is clipped to sight');
  assert.deepEqual(game.tiles.map(t => t.owner), owners);
  game.time = 1;
  const expired = render(game); game.events = [];
  assert.deepEqual(render(game), expired);
});
process.stdout.write(count + ' paint renderer contracts passed\n');
