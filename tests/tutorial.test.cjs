/* Real simulation with a small DOM harness: node tests/tutorial.test.cjs */
'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const CQEngine = require('../engine.js');
function harness() {
  const elements = new Map();
  function element() {
    const classes = new Set();
    return {
      classList: {
        add(name) { classes.add(name); }, remove(name) { classes.delete(name); },
        toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      setAttribute() {}, before() {}, style: {}, click() { this.onclick?.(); }
    };
  }
  const $ = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const env = {
    CQEngine, console, $, difficulty: 'normal', game: null, playing: false, paused: false,
    ended: false, selection: [], mode: null,
    document: { createElement: element, body: element(), querySelectorAll: () => [], querySelector: () => null },
    localStorage: { setItem() { throw new Error('Private browsing storage disabled'); } },
    start() { env.CQTutorial?.stop(); env.game = new CQEngine.Game({ difficulty: env.difficulty }); env.paused = false; env.ended = false; env.playing = true; },
    setMode(mode) { env.mode = mode; }, toast() {}, modal() {}, closeModal() {},
    togglePause() { env.paused = !env.paused; }
  };
  env.window = env;
  vm.createContext(env);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../tutorial.js'), 'utf8'), env);
  env.tick = seconds => { for (let i = 0; i < seconds * 20; i++) { env.game.update(.05); env.CQTutorial.update(.05); } };
  env.move = (type, x, y) => {
    const unit = env.game.units.find(u => u.team === 1 && u.type === type);
    env.selection = [unit.id];
    env.CQTutorial.action('select', { unitIds: [unit.id] });
    assert.equal($('moveOrder').classList.contains('training-target-command'), true, 'selection highlights explicit order button');
    env.setMode({ kind: 'move' });
    assert.equal(env.game.order([unit.id], x, y).ok, true);
    env.CQTutorial.action('move', { unitIds: [unit.id], x, y });
    assert.equal($('moveOrder').classList.contains('training-target-command'), false, 'issued order clears command highlight');
    env.setMode(null);
  };
  return env;
}
const e = harness();
e.CQTutorial.start();
assert.equal(e.CQTutorial.active, true);
assert.match(e.$('trainingText').textContent, /Donner un ordre/);
e.tick(20); assert.equal(e.CQTutorial.step, 0, 'waiting does not complete movement');
assert.equal(e.game.build(1, 'bastion', 16, 45).ok, false, 'out-of-lesson build is rejected');
e.move('scout', 13.5, 37.5); e.tick(5); assert.equal(e.CQTutorial.step, 1);
assert.equal(e.game.build(1, 'relay', 12, 38).ok, true); e.tick(5); assert.equal(e.CQTutorial.step, 2);
assert.equal(e.game.build(1, 'extractor', 9, 36).ok, true); e.tick(5); assert.equal(e.CQTutorial.step, 3);
assert(e.game.income[1] > 2.6, 'extractor really produces additional income');
assert.equal(e.game.recruit(1, 'fighter').ok, true);e.tick(2);assert.equal(e.CQTutorial.step,3,'training waits for recruitment');e.tick(6);assert.equal(e.CQTutorial.step,4);
e.tick(15); assert.equal(e.CQTutorial.step, 4, 'combat waits for player movement');
e.move('fighter', 13.5, 28.5); e.tick(15); assert.equal(e.CQTutorial.step, 5);
assert(e.game.buildings.find(b => b.type === 'relay').connected, 'enemy branch begins connected');
e.move('fighter', 20.5, 28.5); e.tick(10); assert.equal(e.CQTutorial.step, 6);
assert.equal(e.game.buildings.find(b => b.type === 'relay').connected, false, 'own repair branch begins isolated');
e.move('fighter', 16.5, 34.5); e.tick(10); assert.equal(e.CQTutorial.step, 7);
assert.equal(e.CQTutorial.active, false, 'completion survives unavailable localStorage');
assert.equal(e.game.buildings.find(b => b.type === 'relay').connected, true, 'repair genuinely reconnects network');
e.$('trainingPlay').click();
assert.equal(e.game.difficulty, 'normal', 'normal difficulty restored after completion');
assert.equal(e.game.duration, 720, 'normal match duration restored');
assert.equal(e.game.units.filter(u => u.team === 2).length, 3, 'normal opponent restored');
e.tick(40); assert(e.game.units.filter(u => u.team === 2).length > 3, 'normal AI actually recruits');
console.log('✓ Seven lessons validate real movement, economy, combat and network state; normal match resumes.');
const skip = harness();
skip.CQTutorial.start(); skip.$('trainingOptions').click(); skip.$('trainingSkip').click();
assert.equal(skip.CQTutorial.active, false);
assert.equal(skip.paused, false);
assert.equal(skip.game.duration, 720);
assert.equal(skip.game.difficulty, 'normal');
skip.tick(40); assert(skip.game.units.filter(u => u.team === 2).length > 3, 'skip restores live AI');
console.log('✓ Skip exits to a fresh normal match with live AI and original difficulty.');
