/* Colorquest — guided training. Each lesson is validated against simulation state. */
(function () {
  'use strict';
  let active = false, lesson = 0, elapsed = 0, moved = false, recruitId = null;
  let scoutId = null, dummyId = null, branchId = null, transition = 0;
  let originalDifficulty = 'easy';
  const lessons = [
    { title: 'Explorez la toile', text: 'Touchez votre éclaireur rond → « Donner un ordre » → cercle doré. Glissez pour déplacer la vue ; pincez pour zoomer.', target: [13, 37], tab: 'units' },
    { title: 'Étendez votre réseau', text: 'Touchez « Relais », puis le cercle doré. Le relais propage votre couleur et doit rester connecté.', target: [12, 38], tab: 'build', button: '[data-build="relay"]' },
    { title: 'Exploitez le pigment', text: 'La source dorée prend votre couleur : attendez sa connexion, puis touchez « Extracteur » et la source.', target: [9, 36], tab: 'build', button: '[data-build="extractor"]' },
    { title: 'Recrutez un combattant', text: 'Votre extracteur augmente le revenu. Dans « Mobiliser », touchez « Combattant », puis attendez 6 secondes : il sort de la file près du Cœur.', target: [16, 41], tab: 'units', button: '[data-recruit="fighter"]' },
    { title: 'Gagnez une escarmouche', text: 'Touchez votre combattant carré → « Donner un ordre » → cible adverse. Votre combattant attaque automatiquement à portée.', target: [13, 28], tab: 'units' },
    { title: 'Coupez le réseau adverse', text: 'Nouvelle scène : votre combattant → « Donner un ordre » → cercle doré. Coupez le couloir adverse pour isoler le relais à gauche.', target: [20, 28], tab: 'units' },
    { title: 'Reconnectez votre réseau', text: 'Votre combattant → « Donner un ordre » → brèche dorée. Le passage reprend votre couleur : votre relais est reconnecté !', target: [16, 34], tab: 'units' }
  ];

  const ribbon = document.createElement('section');
  ribbon.id = 'trainingRibbon';
  ribbon.className = 'training-ribbon hidden';
  ribbon.setAttribute('aria-label', 'Tutoriel interactif');
  ribbon.innerHTML = '<div class="training-heading"><span id="trainingCount"></span><strong id="trainingTitle"></strong><button id="trainingFocus" aria-label="Recentrer sur l’objectif du tutoriel">◎</button><button id="trainingOptions" aria-label="Options du tutoriel">⋯</button></div><p id="trainingText" role="status" aria-live="polite"></p><div class="training-progress"><i id="trainingProgress"></i></div>';
  $('canvasWrap').before(ribbon);
  const entry = document.createElement('button');
  entry.id = 'startTutorial';
  entry.className = 'tutorial-entry';
  entry.textContent = '◎ Apprendre à jouer · 3 minutes';
  $('play').before(entry);
  entry.onclick = begin;
  $('trainingFocus').onclick = focusTarget;
  $('trainingOptions').onclick = () => {
    if (!active) return;
    const wasPaused = paused;
    if (!paused) togglePause();
    modal('<div class="eyebrow">ATELIER COLORQUEST</div><h2>À votre rythme.</h2><p>Les objectifs se valident avec vos actions. Les ressources sont garanties et l’adversaire attend pendant les exercices.</p><button id="trainingResume" class="primary">Reprendre l’exercice →</button><button id="trainingRestart" class="secondary">Recommencer le tutoriel</button><button id="trainingSkip" class="secondary">Passer à une vraie partie</button>');
    $('trainingResume').onclick = () => { closeModal(); if (!wasPaused && paused) togglePause(); };
    $('trainingRestart').onclick = begin;
    $('trainingSkip').onclick = normalGame;
  };

  function focusTarget() {
    const p = lessons[lesson].target;
    // Leave room around the objective to see its role in the network.
    window.CQCamera?.focus?.(p[0] + .5, p[1] + 1.5, 2);
  }
  function paintRect(x1, y1, x2, y2, team) {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
      const t = game.tile(x, y); t.owner = team; t.isolation = 0; t.blocked = false;
    }
  }
  function refresh() { game.recompute(); game.updateVisibility(); }
  function showLesson() {
    elapsed = 0; moved = false; transition = 0;
    const current = lessons[lesson];
    $('trainingCount').textContent = `${lesson + 1} / ${lessons.length}`;
    $('trainingTitle').textContent = current.title;
    $('trainingText').textContent = current.text;
    $('trainingProgress').style.width = `${(lesson + 1) / lessons.length * 100}%`;
    document.querySelectorAll('.training-target-command').forEach(e => e.classList.remove('training-target-command'));
    document.querySelector(`[data-tab="${current.tab}"]`)?.click();
    if (current.button) document.querySelector(current.button)?.classList.add('training-target-command');
    setMode(null); selection = [];
    focusTarget();
  }
  function begin() {
    // start() calls stop(); remember difficulty outside of that lifecycle call.
    const previous = active ? originalDifficulty : difficulty;
    start({tutorial:true});
    originalDifficulty = previous;
    game = new CQEngine.Game({ difficulty: 'easy', seed: 202602, mapId: 'legacy' });
    active = true; lesson = 0; recruitId = null; dummyId = null; branchId = null;
    playing = true; paused = false; ended = false;
    game.duration = 86400;
    game._aiThink = () => {};
    game.units = game.units.filter(u => u.team === 1 && u.type === 'scout');
    scoutId = game.units[0].id;
    game.money[1] = 200;
    // A hand-authored, obstacle-free first exercise makes every requested build legal.
    for (const t of game.tiles) {
      if (t.y > 26) { t.blocked = false; t.source = false; }
    }
    game.tile(9, 36).source = true;
    const coreBuild = game.build.bind(game), coreRecruit = game.recruit.bind(game);
    game.build = (team, type, x, y) => {
      const target = lessons[lesson].target;
      const expected = lesson === 1 ? 'relay' : lesson === 2 ? 'extractor' : null;
      if (team === 1 && (type !== expected || Math.floor(x) !== target[0] || Math.floor(y) !== target[1]))
        return { ok: false, message: expected ? 'Pour cet exercice, placez le bâtiment au centre du cercle doré.' : 'Suivez l’objectif affiché ; la construction arrive à l’étape suivante.' };
      return coreBuild(team, type, x, y);
    };
    game.recruit = (team, type) => {
      if(team===1&&lesson===3&&recruitId!==null)return {ok:false,message:'Un combattant est déjà en formation. Attendez sa sortie du Cœur.'};
      if (team === 1 && (lesson !== 3 || type !== 'fighter'))
        return { ok: false, message: 'Le tutoriel propose un combattant à l’étape 4.' };
      const result = coreRecruit(team, type);
      if (result.ok && team === 1) recruitId = result.id;
      return result;
    };
    game.power = () => ({ ok: false, message: 'Les pouvoirs seront disponibles dans la vraie partie.' });
    document.body.classList.add('training-active');
    ribbon.classList.remove('hidden');
    refresh(); showLesson();
    toast('Tutoriel : jouez à votre rythme. ◎ recentre l’objectif.');
  }
  function next() {
    toast('✓ Objectif accompli');
    lesson++;
    if (lesson >= lessons.length) { finish(); return; }
    if (lesson === 4) prepareCombat();
    if (lesson === 5) prepareCut();
    if (lesson === 6) prepareReconnect();
    showLesson();
  }
  function prepareCombat() {
    const fighter = game.units.find(u => u.id === recruitId) || game._unit(1, 'fighter', 13.5, 33.5);
    recruitId = fighter.id;
    game.units = [fighter];
    Object.assign(fighter, { x: 13.5, y: 33.5, path: [], order: null, hp: fighter.maxHp });
    const dummy = game._unit(2, 'scout', 13.5, 28.5);
    dummy.hp = 20; dummy.maxHp = 20; dummy.attack = 1e9;
    dummyId = dummy.id;
    refresh();
  }
  function resetNetworkScene() {
    game.units = []; game.buildings = []; selection = [];if(game.queues)game.queues=[[],[],[]];
    for (const t of game.tiles) Object.assign(t, { owner: 0, connected: false, blocked: false, source: false, isolation: 0, explored: true, visible: true });
    // Network lessons freeze passive spread and fading so the player can inspect them.
    // Capture and flood-fill connectivity still use the real game engine.
    game._spreadTerritory = () => game.recompute();
    game.updateVisibility = () => { for (const t of game.tiles) { t.visible = true; t.explored = true; } };
    game._building(1, 'core', 16, 41);
    game._building(2, 'core', 24, 20);
    paintRect(14, 39, 18, 44, 1);
    paintRect(23, 19, 25, 21, 2);
  }
  function prepareCut() {
    resetNetworkScene();
    paintRect(24, 20, 24, 28, 2);
    paintRect(16, 28, 24, 28, 2);
    paintRect(14, 26, 17, 30, 2);
    branchId = game._building(2, 'relay', 16, 28).id;
    recruitId = game._unit(1, 'fighter', 20.5, 33.5).id;
    refresh();
  }
  function prepareReconnect() {
    resetNetworkScene();
    paintRect(16, 29, 16, 41, 1);
    paintRect(14, 27, 18, 30, 1);
    // The two-cell interruption is outside the fighter's initial capture radius.
    game.tile(16, 34).owner = 0;
    game.tile(16, 35).owner = 0;
    branchId = game._building(1, 'relay', 16, 29).id;
    recruitId = game._unit(1, 'fighter', 16.5, 38.5).id;
    refresh();
  }
  function syncMovementHint() {
    if (!active || ![0, 4, 5, 6].includes(lesson)) return;
    const learnerId = lesson === 0 ? scoutId : recruitId;
    const selected = selection.includes(learnerId);
    $('moveOrder').classList.toggle('training-target-command', selected && mode?.kind !== 'move' && !moved);
  }
  function action(kind, payload = {}) {
    if (!active) return;
    if (kind === 'select') syncMovementHint();
    if (kind !== 'move') return;
    const ids = payload.unitIds || [];
    const id = lesson === 0 ? scoutId : recruitId;
    const target = lessons[lesson].target;
    if (ids.includes(id) && Math.hypot(payload.x - (target[0] + .5), payload.y - (target[1] + .5)) < 3) moved = true;
    syncMovementHint();
  }
  function update(dt) {
    if (!active || !game || paused || !playing) return;
    elapsed += dt;
    syncMovementHint();
    game.winner = null; game.hold[1] = 0; game.hold[2] = 0;
    // No economic dead end in a training lesson.
    game.money[1] = Math.max(game.money[1], 100);
    const learner = game.units.find(u => u.id === (lesson === 0 ? scoutId : recruitId));
    if (learner) learner.hp = Math.max(learner.hp, learner.maxHp * .8);
    if (lesson === 4) {
      const dummy = game.units.find(u => u.id === dummyId);
      if (dummy) { dummy.attack = 1e9; dummy.path = []; }
    }
    let complete = false;
    if (lesson === 0) complete = moved && learner && Math.hypot(learner.x - 13.5, learner.y - 37.5) < 1.3;
    if (lesson === 1) complete = game.buildings.some(b => b.team === 1 && b.type === 'relay' && b.x === 12 && b.y === 38 && b.connected);
    if (lesson === 2) complete = game.buildings.some(b => b.team === 1 && b.type === 'extractor' && b.x === 9 && b.y === 36 && b.connected);
    if (lesson === 3) complete = !!recruitId && game.units.some(u => u.id === recruitId && u.type === 'fighter');
    if (lesson === 4) complete = moved && !game.units.some(u => u.id === dummyId);
    if (lesson === 5) complete = moved && game.tile(20, 28).owner === 1 && game.buildings.some(b => b.id === branchId && !b.connected);
    if (lesson === 6) complete = moved && game.buildings.some(b => b.id === branchId && b.connected);
    if (complete) {
      transition += dt;
      if (transition > (lesson >= 4 ? 2.2 : .7)) next();
    } else transition = 0;
    if (active) $('objective').textContent = 'ATELIER · ' + (lesson + 1) + ' / ' + lessons.length;
  }
  function draw(c, cameraView) {
    if (!active || !playing || lesson >= lessons.length) return;
    const target = lessons[lesson].target;
    const s = cameraView.cell, x = cameraView.x + (target[0] + .5) * s, y = cameraView.y + (target[1] + .5) * s;
    const radius = Math.max(s * .8, 13) + Math.sin(elapsed * 3) * 2;
    c.save(); c.lineWidth = 2.5; c.strokeStyle = '#a76d12'; c.fillStyle = '#ffd05e33';
    c.setLineDash([5, 4]); c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill(); c.stroke();
    c.setLineDash([]); c.fillStyle = '#77531b'; c.font = 'bold 11px system-ui'; c.textAlign = 'center';
    const label = transition > 0 ? '✓ Réussi' : 'OBJECTIF';
    const labelX = Math.max(42, Math.min(cameraView.w - 42, x));
    const labelY = Math.max(20, Math.min(cameraView.h - 10, y - radius - 9));
    c.fillStyle = '#fffaf0'; c.fillRect(labelX - 37, labelY - 12, 74, 17);
    c.fillStyle = '#77531b'; c.fillText(label, labelX, labelY); c.restore();
  }
  function stop() {
    active = false;
    document.body.classList.remove('training-active');
    ribbon.classList.add('hidden');
    document.querySelectorAll('.training-target-command').forEach(e => e.classList.remove('training-target-command'));
  }
  function normalGame() { difficulty = originalDifficulty; start(); }
  function finish() {
    stop(); paused = true; ended = true;
    $('pauseFlag').classList.add('hidden');
    try { localStorage.setItem('colorquest.tutorialComplete', '1'); } catch (_) { /* Storage may be unavailable. */ }
    modal('<div class="win-symbol">✓</div><div class="eyebrow">ATELIER TERMINÉ</div><h2>Votre réseau prend vie.</h2><p>Vous savez explorer, construire, exploiter le pigment, recruter, combattre et couper ou réparer une connexion.</p><p>Dans une vraie partie, contrôlez <b>60 % du terrain connecté pendant 45 secondes</b>. Au bout de 12 minutes, le plus grand réseau gagne. L’IA jouera et les zones isolées s’effaceront progressivement. Touchez le nom de la carte pour découvrir les réserves, les sources riches et les terrains.</p><button id="trainingPlay" class="primary">Jouer contre l’IA →</button><button id="trainingReplay" class="secondary">Rejouer le tutoriel</button>');
    $('trainingPlay').onclick = normalGame;
    $('trainingReplay').onclick = begin;
  }
  window.CQTutorial = { start: begin, update, draw, action, stop, get active() { return active; }, get step() { return lesson; } };
})();
