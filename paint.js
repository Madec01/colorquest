/* V0.7.1 paint prototype. The classic game and its saved matches stay independent. */
(() => {
  'use strict';
  const $p = id => document.getElementById(id);
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sessionNotice = 'Ce combat reste dans cette fenêtre. Fermer ou recharger la page le termine. Les sauvegardes du mode classique sont conservées.';
  let match = null, active = false, paused = true, resultShown = false;
  let mode = 'navigate', selectedCard = null, selectedProducer = null, selectedSource = null, preview = null, previewPoint = null, stroke = [], flowDrag = null;
  let brushLocked = false, lastBrushTap = -Infinity, tutorial = null, tutorialView = null, tutorialCameraPhase = '';
  let camera = {zoom:1, cx:9.5, cy:13.5}, view = {x:0,y:0,w:1,h:1,cell:1};
  let lastFrame = 0, lastHUD = -1, handSignature = '', toastUntil = 0, vibration = false;
  let gesture = null, pinch = null, suppressGesture = false, dialogKind = '', lastFocus = null, seenEvent = 0;
  const pointers = new Map();

  const menuCard = document.createElement('section');
  menuCard.id = 'paintModeCard'; menuCard.className = 'paint-menu-card';
  menuCard.setAttribute('aria-labelledby', 'paintMenuTitle');
  menuCard.innerHTML = '<div class="paint-menu-eyebrow"><span>NOUVEAU · V0.7.1</span><span>PORTRAIT · SOLO</span></div><h2 id="paintMenuTitle">Prenez le pinceau.</h2><p>Reliez les sources. Faites vivre votre armée.<br>Chaque geste agrandit votre couleur.</p><button id="paintStart" class="primary">Apprendre à peindre <span aria-hidden="true">↗</span></button><button id="paintFreePlay" class="paint-menu-free">Combat libre · 4 min</button><button id="paintResume" class="paint-menu-resume" hidden>↻ Reprendre cette toile <small>En pause dans cette fenêtre</small></button><small class="paint-menu-note">Six petites situations pour apprendre. Le mode classique reste disponible ci-dessous.</small>';
  (document.getElementById('campaignCard') || document.querySelector('.start-card'))?.before(menuCard);
  document.body.classList.add('paint-menu-ready');

  const screen = document.createElement('section');
  screen.id = 'paintGame'; screen.className = 'paint-game'; screen.hidden = true;
  screen.setAttribute('aria-label', 'Colorquest : combat de peinture');
  screen.innerHTML = `
    <header class="paint-header">
      <div class="paint-topline"><button id="paintMenu" aria-label="Mettre en pause et retourner au menu" title="Menu">‹</button><div class="paint-heading"><strong>COLORQUEST</strong><small>LA TOILE · PEINTURE</small></div><time id="paintClock">04:00</time><button id="paintHelp" aria-label="Aide du nouveau mode">?</button><button id="paintPause" aria-label="Mettre le combat en pause">Ⅱ</button></div>
      <div class="paint-domination"><span id="paintPlayerShare">● Vous · 0 %</span><span id="paintHold">Domination · > 50 % / 15 s</span><span id="paintEnemyShare">IA · 0 % ▲</span></div>
      <div class="paint-score-track" aria-label="Territoire connecté des deux camps"><i id="paintPlayerBar"></i><b id="paintEnemyBar"></b><em></em></div>
    </header>
    <main id="paintCanvasWrap" class="paint-canvas-wrap">
      <canvas id="paintCanvas" tabindex="0" aria-label="Toile interactive. En mode Vue, glissez pour déplacer la carte et pincez pour zoomer. En mode Pinceau, tracez depuis votre couleur. Relâchez pour peindre. Glissez une carte puis relâchez, ou touchez une carte puis son emplacement."></canvas>
      <div class="paint-zoom"><button id="paintZoomOut" aria-label="Dézoomer">−</button><button id="paintZoomIn" aria-label="Zoomer">+</button></div>
      <div id="paintToast" class="paint-toast" role="status" aria-live="polite" hidden></div>
      <div id="paintTutorial" class="paint-tutorial" hidden role="region" aria-label="Votre objectif d’apprentissage">
        <div class="paint-tutorial-heading"><small id="paintTutorialStep"></small><strong id="paintTutorialTitle"></strong></div><p id="paintTutorialHint"></p><p id="paintTutorialNotice" role="status" aria-live="polite" hidden></p>
        <div class="paint-tutorial-actions"><button id="paintTutorialNext" class="paint-main-action" hidden>Continuer →</button><button id="paintTutorialRetry" hidden>Réessayer</button><button id="paintTutorialSkip">Combat libre</button></div>
      </div>
      <div id="paintContext" class="paint-context" hidden>
        <div class="paint-context-copy"><strong id="paintContextTitle"></strong><span id="paintContextMessage"></span></div>
        <div id="paintAimActions" class="paint-context-actions paint-aim-actions" hidden><button id="paintCancel" aria-label="Annuler le geste et revenir à la vue">×</button></div>
        <div id="paintProducerActions" class="paint-context-actions" hidden><button id="paintProductionToggle">Pause</button><button id="paintRecall">Rappeler</button><button id="paintUpgrade" hidden>Améliorer</button><button id="paintProducerClose" aria-label="Fermer les commandes du bâtiment">×</button></div>
      </div>
    </main>
    <footer class="paint-footer">
      <div class="paint-resource"><span><b id="paintPigment">65</b><small> / 100 PIGMENT</small></span><div class="paint-resource-track"><i id="paintPigmentBar"></i></div><span id="paintIncome">+0/s</span><span id="paintOutflow" title="Dépense prévue des casernes actives">−0/s prévu</span><span id="paintUnits" aria-label="Unités alliées">■ 0 / 24</span></div>
      <div class="paint-tools"><button id="paintBrush" aria-pressed="false"><span aria-hidden="true">╱</span> Pinceau</button><button id="paintNavigate" aria-pressed="true"><span aria-hidden="true">✥</span> Vue</button><div id="paintNext" class="paint-next" aria-label="Prochaine carte"><small>PROCHAINE</small><strong>⬡ Bastion</strong></div></div>
      <div id="paintHand" class="paint-hand" role="group" aria-label="Vos quatre cartes"></div>
    </footer>
    <div id="paintDialog" class="paint-dialog" hidden><section id="paintDialogContent" class="paint-dialog-content" role="dialog" aria-modal="true" aria-labelledby="paintDialogTitle" tabindex="-1"></section></div>`;
  document.body.append(screen);
  const canvas = $p('paintCanvas'), context = canvas.getContext('2d');

  function announceState() { document.dispatchEvent(new CustomEvent('cq:paintstate', {detail:{active, paused, hasMatch:!!match && (!!tutorial || match.winner == null)}})); }
  function playSound(name = 'click_001') { if (typeof window.audio === 'function') window.audio(name); }
  function buzz(ms = 18) { if (vibration && navigator.vibrate) navigator.vibrate(ms); }
  // Native touch activation, with compatibility-click deduplication. A button
  // drag never becomes a tap when the pointer returns; keyboard clicks remain.
  function bindActionTap(button, action) {
    let tap = null, touchEndedAt = -Infinity;
    button.addEventListener('pointerdown', event => {
      if (tap) { tap.moved = true; return; }
      if (event.pointerType === 'touch' && !button.disabled) tap = {id:event.pointerId, x:event.clientX, y:event.clientY, moved:false};
    });
    screen.addEventListener('pointerdown', event => { if (tap && tap.id !== event.pointerId) tap.moved = true; });
    button.addEventListener('pointermove', event => { if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) tap.moved = true; });
    button.addEventListener('pointerup', event => {
      if (event.pointerType === 'touch') touchEndedAt = performance.now();
      const candidate = tap; tap = null;
      if (!candidate || candidate.moved || candidate.id !== event.pointerId || button.disabled || Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 8) return;
      const rect = button.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      event.preventDefault(); action(event);
    });
    button.addEventListener('pointercancel', event => { if (event.pointerType === 'touch') touchEndedAt = performance.now(); tap = null; });
    button.onclick = event => {
      // Keyboard and assistive activation have detail 0. Older mobile browsers
      // can emit a MouseEvent with no pointer identity after a touch instead.
      if (event.detail !== 0 && (event.pointerType === 'touch' || performance.now() - touchEndedAt < 700)) return;
      action(event);
    };
  }
  function toast(message, seconds = 2.7) { $p('paintToast').textContent = message; $p('paintToast').hidden = false; toastUntil = performance.now() + seconds * 1000; }
  function config() { return window.CQPaintEngine?.CONFIG || {}; }
  function cards() { return window.CQPaintEngine?.CARDS || {}; }
  function currentBuilding() { return match?.buildings.find(b => b.id === selectedProducer && b.hp > 0 && (b.team === 1 || match.isVisible(1,b.x,b.y))) || null; }
  function currentProducer() { const building = currentBuilding(); return building?.team === 1 && ['core','barracks'].includes(building.type) ? building : null; }
  function tutorialBlocked() { return !!tutorial && !!(tutorialView?.success || tutorialView?.failed); }
  function afterAction(kind, result, payload) { tutorial?.afterAction?.(kind, result, payload); tutorialView = tutorial?.presentation() || null; }
  function setHeld() { match?.setSpendingHeld(1, !!active && !paused && (mode === 'card' || stroke.length > 0)); }
  function clearGesture(clearPointers = true) {
    gesture = null; flowDrag = null; pinch = null;
    if (clearPointers) { pointers.clear(); suppressGesture = false; }
  }
  function cancel() {
    clearGesture(); mode = 'navigate'; brushLocked = false; lastBrushTap = -Infinity; selectedCard = null; preview = null; previewPoint = null; stroke = [];
    match?.setSpendingHeld(1, false); updateHUD(true);
  }
  function setMode(next, index = null) {
    if (!active || paused || match?.winner != null || tutorialBlocked()) return false;
    if (next === 'brush' && tutorial && !tutorialView?.allowedTools?.includes('brush')) return false;
    if (next === 'card' && tutorial && !tutorialView?.allowedCards?.includes(match.hands[1][index])) return false;
    clearGesture(); mode = next === 'brush' || next === 'card' ? next : 'navigate';
    brushLocked = false;
    selectedCard = mode === 'card' ? index : null; selectedProducer = null; selectedSource = null; stroke = []; preview = null; previewPoint = null;
    setHeld(); updateHUD(true); return true;
  }
  function brushButton() {
    const now = performance.now(), doubleTap = now - lastBrushTap < 340;
    if (brushLocked || (mode === 'brush' && !doubleTap)) { cancel(); return; }
    if (mode === 'brush' && doubleTap) { brushLocked = true; lastBrushTap = -Infinity; toast('Pinceau verrouillé. Touchez son bouton pour revenir à la vue.'); updateHUD(true); return; }
    if (setMode('brush')) { lastBrushTap = now; playSound(); }
  }
  function clearAimForNavigation() {
    stroke = []; preview = null; previewPoint = null; selectedCard = null; mode = 'navigate'; brushLocked = false; flowDrag = null;
    match?.setSpendingHeld(1, false);
  }

  function layout() {
    if (!match) return;
    const base = Math.min((view.w - 16) / match.width, (view.h - 16) / match.height);
    view.cell = Math.max(.1, base * camera.zoom);
    const halfW = view.w / (2 * view.cell), halfH = view.h / (2 * view.cell);
    camera.cx = match.width <= halfW * 2 ? match.width / 2 : clamp(camera.cx, halfW - .6, match.width - halfW + .6);
    camera.cy = match.height <= halfH * 2 ? match.height / 2 : clamp(camera.cy, halfH - .6, match.height - halfH + .6);
    view.x = view.w / 2 - camera.cx * view.cell; view.y = view.h / 2 - camera.cy * view.cell;
  }
  function resize() {
    if (!active) return;
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    view.w = rect.width; view.h = rect.height;
    canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0); layout(); fitTutorial(); draw();
  }
  function fitTutorial() {
    if (!tutorial || !tutorialView || !active || gesture || tutorialBlocked()) return;
    const phase = tutorialView.step + ':' + tutorialView.phase;
    if (tutorialCameraPhase === phase) return;
    const points = [...(tutorialView.path || []), tutorialView.target, tutorialView.from].filter(Boolean);
    if (!points.length) { tutorialCameraPhase = phase; return; }
    if (tutorialView.step < 4) for (const b of match.buildings) if (b.team === 1 && b.hp > 0) points.push(b);
    if (tutorialView.step === 4) for (const u of match.units) if (u.hp > 0 && (u.team === 1 || match.isVisible(1,u.x,u.y))) points.push({x:u.x - .5,y:u.y - .5});
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
    const overlayBottom = $p('paintTutorial').offsetTop + $p('paintTutorial').offsetHeight;
    const top = Math.max(150, overlayBottom + 26), bottom = view.h - 40;
    const base = Math.min((view.w - 16) / match.width, (view.h - 16) / match.height);
    const wanted = tutorialView.camera?.zoom || 1;
    camera.zoom = clamp(Math.min(wanted, (view.w - 54) / Math.max(2, maxX - minX + 3) / base, (bottom - top) / Math.max(2, maxY - minY + 3) / base), 1, 3);
    layout();
    camera.cx = (minX + maxX + 1) / 2;
    camera.cy = (minY + maxY + 1) / 2 - ((top + bottom) / 2 - view.h / 2) / view.cell;
    layout(); tutorialCameraPhase = phase;
  }
  function localPoint(event) { const rect = canvas.getBoundingClientRect(); return {x:event.clientX - rect.left, y:event.clientY - rect.top}; }
  function inside(p) { return p.x >= 0 && p.y >= 0 && p.x < view.w && p.y < view.h; }
  function world(p) { return {x:(p.x - view.x) / view.cell, y:(p.y - view.y) / view.cell}; }
  function tilePoint(p) { const point = world(p); return {x:Math.floor(point.x), y:Math.floor(point.y)}; }
  function zoomAt(zoom, point = {x:view.w / 2, y:view.h / 2}) {
    if (!match) return;
    const anchor = world(point); camera.zoom = clamp(zoom, 1, 3); layout();
    camera.cx = anchor.x - (point.x - view.w / 2) / view.cell; camera.cy = anchor.y - (point.y - view.h / 2) / view.cell; layout();
    updateHUD(true);
  }
  function pickObject(p) {
    let best = null, distance = Infinity;
    const choices = match.buildings.filter(b => b.hp > 0 && (b.team === 1 || match.isVisible(1,b.x,b.y))).map(b => ({building:b, x:b.x, y:b.y}));
    for (const tile of match.tiles) if (tile.source && match.isVisible(1, tile.x, tile.y) && !choices.some(o => o.x === tile.x && o.y === tile.y)) choices.push({source:tile, x:tile.x, y:tile.y});
    for (const object of choices) {
      const d = Math.hypot(view.x + (object.x + .5) * view.cell - p.x, view.y + (object.y + .5) * view.cell - p.y);
      if (d < Math.max(22, view.cell * .85) && d < distance) { best = object; distance = d; }
    }
    return best;
  }
  // Sampled strokes become contiguous orthogonal paths. Backtracking erases
  // the preview; returning to its first tile cancels without spending.
  function appendStroke(target) {
    if (!stroke.length) stroke.push(target);
    const previous = stroke.findIndex(point => point.x === target.x && point.y === target.y);
    if (previous >= 0) stroke.splice(previous + 1);
    let last = stroke[stroke.length - 1], remaining = 160 - stroke.length;
    const dx = target.x - last.x, dy = target.y - last.y, steps = Math.abs(dx) + Math.abs(dy);
    let xCount = 0, yCount = 0;
    for (let n = 0; n < steps && remaining-- > 0; n++) {
      const next = {...last};
      if (xCount < Math.abs(dx) && (yCount >= Math.abs(dy) || (xCount + .5) / Math.max(1, Math.abs(dx)) <= (yCount + .5) / Math.max(1, Math.abs(dy)))) { next.x += Math.sign(dx); xCount++; }
      else { next.y += Math.sign(dy); yCount++; }
      stroke.push(next); last = next;
    }
    preview = match.previewPaint(1, stroke); previewPoint = target; setHeld(); updateHUD(true);
  }
  function aimCard(point) {
    if (selectedCard == null) return;
    previewPoint = point; preview = match.previewCard(1, selectedCard, point.x, point.y); setHeld(); updateHUD(true);
  }
  function finishBrush() {
    const keepBrush = brushLocked;
    clearGesture(); stroke = []; preview = null; previewPoint = null; selectedCard = null; mode = keepBrush ? 'brush' : 'navigate';
    match?.setSpendingHeld(1, false); updateHUD(true);
  }
  function confirm() {
    if (!active || paused || match?.winner != null || tutorialBlocked()) return false;
    if (!preview?.ok) {
      if (preview?.message) toast(preview.message);
      if (mode === 'brush') finishBrush();
      return false;
    }
    const shownPreview = preview, kind = mode, payload = mode === 'brush' ? {path:preview.path.map(point => ({...point}))} : {cardId:match.hands[1][selectedCard], target:{...previewPoint}};
    const result = mode === 'brush' ? match.paint(1, payload.path) : mode === 'card' && previewPoint ? match.playCard(1, selectedCard, previewPoint.x, previewPoint.y) : null;
    afterAction(kind, result, payload);
    if (!result?.ok) { preview = result || preview; toast(result?.message || 'Choisissez un emplacement.'); if (mode === 'brush') finishBrush(); else updateHUD(true); return false; }
    $p('paintToast').hidden = true; toastUntil = 0;
    if (shownPreview.partial || result.partial) toast('Portion valide peinte · ' + result.cost + ' pigments. ' + (shownPreview.reason || result.reason || ''));
    else if (mode === 'card') toast((cards()[result.cardId || payload.cardId]?.name || 'Carte') + ' · −' + result.cost + ' pigments', 1.8);
    if (kind === 'brush') finishBrush();
    else { clearGesture(); stroke = []; preview = null; previewPoint = null; selectedCard = null; mode = 'navigate'; match.setSpendingHeld(1, false); }
    playSound('confirmation_001'); buzz(); updateHUD(true); return true;
  }
  function recallSelected(id = selectedProducer) {
    if (!match || paused || tutorialBlocked()) return;
    const result = match.recall(1, id); selectedProducer = id; selectedSource = null;
    afterAction('recall', result, {producerId:id});
    toast(result?.ok ? 'Retraite : les unités rentrent sans riposter, puis défendent.' : result?.message || 'Rappel impossible.');
    if (result?.ok) { playSound('select_001'); buzz(); }
    updateHUD(true);
  }

  function beginPinch() {
    clearAimForNavigation(); gesture = null; suppressGesture = true;
    const pair = [...pointers.values()].slice(0,2), midpoint = {x:(pair[0].x + pair[1].x) / 2, y:(pair[0].y + pair[1].y) / 2};
    pinch = {distance:Math.max(1, Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)), zoom:camera.zoom, anchor:world(midpoint)};
    updateHUD(true);
  }
  function pointerDown(event) {
    if (!active || paused || dialogKind || tutorialBlocked() || match?.winner != null || event.button > 0) return;
    const cardButton = event.target.closest?.('[data-paint-card]');
    if (event.target !== canvas && !cardButton) return;
    if (cardButton?.disabled) return;
    event.preventDefault();
    const p = localPoint(event); pointers.set(event.pointerId, p);
    try { event.target.setPointerCapture(event.pointerId); } catch (_) {}
    if (pointers.size > 1) { beginPinch(); return; }
    if (suppressGesture) return;
    if (cardButton) {
      const index = Number(cardButton.dataset.paintCard);
      if (!setMode('card', index)) { pointers.delete(event.pointerId); return; }
      pointers.set(event.pointerId, p);
      gesture = {id:event.pointerId, kind:'cardDrag', start:p, last:p, moved:false}; return;
    }
    if (mode === 'brush') { stroke = []; appendStroke(tilePoint(p)); gesture = {id:event.pointerId, kind:'brush', start:p, last:p, moved:false}; return; }
    if (mode === 'card') { aimCard(tilePoint(p)); gesture = {id:event.pointerId, kind:'cardAim', start:p, last:p, moved:false}; return; }
    const object = pickObject(p), producer = object?.building?.team === 1 && ['core','barracks'].includes(object.building.type) ? object.building : null;
    gesture = {id:event.pointerId, kind:producer ? 'producer' : 'pan', producerId:producer?.id, object, start:p, last:p, moved:false, leftHome:false, cx:camera.cx, cy:camera.cy};
    if (object) { selectedProducer = object.building?.id ?? null; selectedSource = object.source ? {x:object.x,y:object.y} : null; }
    updateHUD(true);
  }
  function pointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault(); const p = localPoint(event); pointers.set(event.pointerId, p);
    if (pinch && pointers.size > 1) {
      const pair = [...pointers.values()].slice(0,2), midpoint = {x:(pair[0].x + pair[1].x) / 2, y:(pair[0].y + pair[1].y) / 2};
      camera.zoom = clamp(pinch.zoom * Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) / pinch.distance, 1, 3); layout();
      camera.cx = pinch.anchor.x - (midpoint.x - view.w / 2) / view.cell; camera.cy = pinch.anchor.y - (midpoint.y - view.h / 2) / view.cell; layout(); return;
    }
    if (suppressGesture || !gesture || gesture.id !== event.pointerId) return;
    gesture.last = p;
    if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 8) gesture.moved = true;
    if (gesture.kind === 'brush') { if (inside(p)) appendStroke(tilePoint(p)); return; }
    if (gesture.kind === 'cardAim' || gesture.kind === 'cardDrag') { if (inside(p)) aimCard(tilePoint(p)); else { preview = null; previewPoint = null; updateHUD(true); } return; }
    if (gesture.kind === 'producer' && gesture.moved) {
      const producer = currentProducer(), t = tilePoint(p);
      if (!producer) return;
      const distance = Math.hypot(p.x - (view.x + (producer.x + .5) * view.cell), p.y - (view.y + (producer.y + .5) * view.cell));
      if (distance > Math.max(30, view.cell * 1.4)) gesture.leftHome = true;
      flowDrag = {producerId:gesture.producerId, x:t.x, y:t.y, recall:gesture.leftHome && distance < Math.max(20, view.cell * .75)};
      updateHUD(true); return;
    }
    if (gesture.kind === 'pan' && gesture.moved) {
      selectedProducer = null; selectedSource = null;
      camera.cx = gesture.cx - (p.x - gesture.start.x) / view.cell; camera.cy = gesture.cy - (p.y - gesture.start.y) / view.cell; layout();
    }
  }
  function pointerUp(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault(); const p = localPoint(event); pointers.delete(event.pointerId);
    if (suppressGesture) { if (!pointers.size) { suppressGesture = false; pinch = null; gesture = null; updateHUD(true); } return; }
    if (!gesture || gesture.id !== event.pointerId) return;
    const finished = gesture; gesture = null;
    if (finished.kind === 'brush') {
      if (!inside(p)) { finishBrush(); toast('Trait annulé hors de la toile.'); }
      else {
        appendStroke(tilePoint(p));
        if (stroke.length === 1) { finishBrush(); if (finished.moved) toast('Trait annulé.'); }
        else confirm();
      }
    } else if (finished.kind === 'cardAim' || finished.kind === 'cardDrag') {
      if (inside(p)) { aimCard(tilePoint(p)); confirm(); }
      else if (finished.moved || finished.kind === 'cardAim') { cancel(); toast('Carte conservée dans la main.', 1.6); }
      // A stationary card tap arms it for the tap-target alternative.
    } else if (finished.kind === 'producer') {
      selectedProducer = finished.producerId; selectedSource = null;
      const producer = currentProducer();
      if (finished.moved && inside(p) && producer) {
        const distance = Math.hypot(p.x - (view.x + (producer.x + .5) * view.cell), p.y - (view.y + (producer.y + .5) * view.cell));
        const home = distance < Math.max(20, view.cell * .75);
        if (home && finished.leftHome) recallSelected(finished.producerId);
        else if (!home) {
          const target = tilePoint(p), result = match.setFlow(1, finished.producerId, target.x, target.y);
          afterAction('flow', result, {producerId:finished.producerId,target});
          toast(result?.message || (result?.ok ? 'Tout le groupe avance vers cette destination.' : 'Destination impossible.'));
          if (result?.ok) { playSound('select_001'); buzz(); }
        }
      }
      // A tap is inspection only; production changes only via its explicit button.
    } else if (finished.kind === 'pan' && !finished.moved && !finished.object) { selectedProducer = null; selectedSource = null; }
    flowDrag = null; updateHUD(true);
  }
  function pointerCancel(event) { if (pointers.has(event.pointerId)) cancel(); }
  screen.addEventListener('pointerdown', pointerDown);
  screen.addEventListener('pointermove', pointerMove);
  screen.addEventListener('pointerup', pointerUp);
  screen.addEventListener('pointercancel', pointerCancel);
  screen.addEventListener('lostpointercapture', pointerCancel);
  canvas.addEventListener('wheel', event => { if (!active || paused) return; event.preventDefault(); cancel(); zoomAt(camera.zoom * (event.deltaY < 0 ? 1.14 : .88), localPoint(event)); }, {passive:false});
  canvas.addEventListener('contextmenu', event => event.preventDefault());

  function renderHand() {
    const hand = match.hands[1] || [], signature = hand.join('|');
    if (signature !== handSignature) {
      handSignature = signature;
      $p('paintHand').innerHTML = hand.map((id, index) => {
        const card = cards()[id];
        const accent = ({blue:'#5686c7',red:'#d66d65',yellow:'#b99437'})[card.color] || card.color || '#628889';
        return '<button type="button" data-paint-card="' + index + '" aria-pressed="false" aria-label="' + esc(card.name + ', ' + card.cost + ' pigments. ' + card.description) + '"><span class="paint-card-symbol" aria-hidden="true" style="--card-accent:' + esc(accent) + '">' + esc(card.icon) + '</span><strong>' + esc(card.name) + '</strong><small>◉ ' + card.cost + '</small></button>';
      }).join('');
      // Pointer handlers also support dragging. Keyboard activation uses the
      // same aiming mode; the target tap plays immediately.
      $p('paintHand').querySelectorAll('button').forEach(button => button.addEventListener('click', event => { if (event.detail === 0) setMode('card', Number(button.dataset.paintCard)); }));
    }
    for (const button of $p('paintHand').querySelectorAll('button')) {
      const index = Number(button.dataset.paintCard), card = cards()[hand[index]];
      button.setAttribute('aria-pressed', String(mode === 'card' && selectedCard === index));
      button.classList.toggle('paint-unaffordable', match.pigment[1] < card.cost);
      button.hidden = !!tutorial && !tutorialView?.allowedCards?.includes(card.id);
      button.disabled = tutorialBlocked();
      button.classList.toggle('paint-tutorial-cue', !!tutorial && !tutorialBlocked() && tutorialView?.gesture === 'card' && tutorialView?.cardId === card.id);
    }
    $p('paintHand').hidden = !!tutorial && !(tutorialView?.allowedCards?.length);
    $p('paintNext').hidden = !!tutorial;
    const next = cards()[match.decks[1]?.[0]];
    $p('paintNext').innerHTML = '<small>PROCHAINE</small><strong>' + esc(next ? next.icon + ' ' + next.name : '—') + '</strong>';
  }
  function updateTutorial() {
    const panel = $p('paintTutorial'); panel.hidden = !tutorial;
    screen.classList.toggle('paint-learning', !!tutorial);
    screen.classList.toggle('paint-learning-basics', !!tutorial && !tutorialView?.showDomination);
    if (!tutorial) return;
    tutorialView = tutorial.presentation();
    if (tutorialView.success) { $p('paintToast').hidden = true; toastUntil = 0; }
    $p('paintTutorialStep').textContent = 'APPRENDRE · ' + (tutorialView.step + 1) + ' / ' + tutorialView.total;
    $p('paintTutorialTitle').textContent = tutorialView.title || 'À vous de peindre';
    $p('paintTutorialHint').textContent = tutorialView.hint || '';
    $p('paintTutorialNotice').hidden = !tutorialView.success && !tutorialView.failed && !tutorialView.notice;
    $p('paintTutorialNotice').textContent = tutorialView.success ? tutorialView.successText || 'Objectif réussi !' : tutorialView.failed ? tutorialView.notice || tutorialView.failureText || 'Recommençons cette situation.' : tutorialView.notice || '';
    $p('paintTutorialNext').hidden = !tutorialView.success;
    $p('paintTutorialNext').textContent = tutorialView.complete ? 'Jouer librement →' : 'Continuer →';
    $p('paintTutorialRetry').hidden = !tutorialView.failed && !tutorialView.canRetry;
    panel.classList.toggle('paint-tutorial-success', !!tutorialView.success);
    panel.classList.toggle('paint-tutorial-failed', !!tutorialView.failed);
    panel.classList.toggle('paint-tutorial-inspecting', !tutorialBlocked() && (!!currentBuilding() || !!selectedSource || mode === 'card' || stroke.length > 0));
  }
  function updateContext() {
    const aiming = mode === 'card' || (mode === 'brush' && stroke.length > 0), building = currentBuilding(), producer = currentProducer();
    const source = selectedSource && match.isVisible(1, selectedSource.x, selectedSource.y) ? match.tile(selectedSource.x, selectedSource.y) : null;
    $p('paintContext').hidden = !aiming && !building && !source;
    $p('paintAimActions').hidden = !aiming;
    $p('paintProducerActions').hidden = aiming || (!building && !source);
    $p('paintContext').classList.toggle('paint-context-aiming', aiming);
    if (aiming) {
      const card = selectedCard == null ? null : cards()[match.hands[1][selectedCard]];
      $p('paintContextTitle').textContent = (mode === 'brush' ? 'Trait d’encre' : card?.name || 'Carte') + ' · ' + (preview?.cost ?? card?.cost ?? 0) + ' pigments';
      const instruction = gesture ? (mode === 'brush' ? 'Relâchez pour peindre. Revenez au départ pour annuler.' : 'Relâchez sur la toile pour jouer.') : 'Touchez un emplacement. × pour annuler.';
      $p('paintContextMessage').textContent = (preview?.message || card?.description || 'Partez de votre couleur reliée au Cœur.') + ' ' + instruction;
      $p('paintContext').classList.toggle('paint-invalid', preview?.ok === false || !!preview?.partial);
    } else if (building || source) {
      $p('paintContext').classList.remove('paint-invalid');
      $p('paintProductionToggle').hidden = building?.type !== 'barracks' || building.team !== 1;
      $p('paintRecall').hidden = !producer;
      $p('paintUpgrade').hidden = building?.type !== 'core' || building.team !== 1 || building.level >= 3 || !!tutorial;
      if (source && !building) {
        const occupied = match.buildings.find(b => b.x === source.x && b.y === source.y && b.hp > 0 && b.type === 'extractor');
        $p('paintContextTitle').textContent = '◈ Source de pigment';
        $p('paintContextMessage').textContent = occupied ? 'Source exploitée · l’anneau signale son extracteur.' : source.owner === 1 && source.connected ? 'Source reliée. Posez un Extracteur ici pour gagner +0,85 pigment/s.' : source.owner === 2 ? 'Source en territoire adverse. Vos unités doivent reprendre sa case.' : 'Reliez-la au Cœur, puis posez un Extracteur. Le losange doré est une ressource.';
      } else if (building.team !== 1) {
        const enemyName = ({core:'Cœur',barracks:'Caserne',relay:'Relais',extractor:'Extracteur',bastion:'Bastion'})[building.type] || building.type;
        const enemyRole = ({core:'Sa destruction vous fait gagner.',barracks:'Déploie un groupe de combattants.',relay:'Étend le territoire à sa pose.',extractor:'Exploite une source de pigment.',bastion:'Défend les environs.'})[building.type] || '';
        $p('paintContextTitle').textContent = enemyName + ' · camp adverse';
        $p('paintContextMessage').textContent = Math.ceil(building.hp) + ' / ' + building.maxHp + ' vie · ' + enemyRole;
      } else {
        const name = ({core:'Cœur',barracks:'Caserne',relay:'Relais',extractor:'Extracteur',bastion:'Bastion'})[building.type] || building.type;
        const network = building.connected ? 'Relié au Cœur' : 'Réseau coupé';
        const count = producer ? match.units.filter(u => u.hp > 0 && u.team === 1 && u.producerId === building.id).length : 0;
        $p('paintContextTitle').textContent = name + (producer ? ' · ' + count + ' unité' + (count > 1 ? 's' : '') : '') + (building.type === 'core' ? ' · niv. ' + building.level : '');
        const reason = building.productionReason || ({running:'Production active',paused:'Production en pause',isolated:'Réseau coupé',held:'Pigment réservé au geste',funds:'En attente de pigment',full:'Armée au complet',blocked:'Sortie bloquée'}[building.productionState] || '');
        const role = ({core:'Origine du réseau et refuge des unités sans caserne. Glissez pour les guider.',relay:'A étendu le territoire à sa pose. Il ouvre la vue autour de lui.',extractor:'Exploite la source : +0,85 pigment/s quand il est relié (3 bonus maximum).',bastion:'Tire sur les ennemis proches tant qu’il est relié.'})[building.type];
        $p('paintContextMessage').textContent = building.type === 'barracks' ? reason + ' · 1 unité / ' + (config().unitInterval ?? 5) + ' s · ' + (config().unitCost ?? 6) + ' pigments. Glissez pour envoyer ; revenez dessus pour rappeler.' : network + ' · ' + (role || '');
        if (flowDrag?.recall) $p('paintContextMessage').textContent = 'Relâchez ici : retraite du groupe, sans riposte pendant le retour.';
        $p('paintProductionToggle').textContent = building.productionPaused ? '▶ Produire' : 'Ⅱ Pause';
        $p('paintUpgrade').textContent = 'Niv. ' + (building.level + 1) + ' · ' + (building.level === 1 ? 35 : 50) + ' ◉';
        $p('paintUpgrade').disabled = match.pigment[1] < (building.level === 1 ? 35 : 50);
      }
    }
    const tutorialHeight = tutorial && !$p('paintTutorial').hidden ? $p('paintTutorial').offsetHeight : 0;
    $p('paintContext').style.top = (tutorialHeight ? tutorialHeight + 14 : 8) + 'px';
    const overlay = !$p('paintContext').hidden ? $p('paintContext') : tutorial ? $p('paintTutorial') : null;
    $p('paintToast').style.top = (overlay ? overlay.offsetTop + overlay.offsetHeight + 8 : 10) + 'px';
  }
  function updateHUD(force = false) {
    if (!match) return;
    if (!force && match.time - lastHUD < .1) return;
    lastHUD = match.time;
    updateTutorial();
    if (mode === 'card' && previewPoint && selectedCard != null) preview = match.previewCard(1, selectedCard, previewPoint.x, previewPoint.y);
    if (mode === 'brush' && stroke.length) preview = match.previewPaint(1, stroke);
    const remaining = Math.max(0, Math.ceil((match.timeLimit ?? match.duration) - match.time));
    $p('paintClock').textContent = tutorial ? 'ÉTAPE ' + (tutorialView.step + 1) : (match.overtime ? '+' : '') + String(Math.floor(remaining / 60)).padStart(2,'0') + ':' + String(remaining % 60).padStart(2,'0');
    $p('paintClock').classList.toggle('paint-final-minute', !tutorial && !!match.accelerated);
    for (const [team, prefix] of [[1,'Player'],[2,'Enemy']]) {
      const share = match.scores[team] * 100, shownShare = share.toFixed(share >= 49 && share <= 51 ? 1 : 0).replace('.',',');
      $p('paint' + prefix + 'Share').textContent = team === 1 ? '● Vous · ' + shownShare + ' %' : 'IA · ' + shownShare + ' % ▲';
      $p('paint' + prefix + 'Bar').style.width = share + '%';
    }
    const holdingTeam = match.hold[1] > 0 ? 1 : match.hold[2] > 0 ? 2 : 0;
    const delta = match.tiles.reduce((sum,tile) => sum + (tile.connected ? tile.owner === 1 ? 1 : tile.owner === 2 ? -1 : 0 : 0), 0);
    $p('paintHold').textContent = tutorial && !tutorialView.showDomination ? 'Un seul objectif à la fois' : match.overtime ? 'Prolongation · ' + (delta === 0 ? 'égalité' : delta > 0 ? '+' + delta + ' case' + (delta > 1 ? 's' : '') : '−' + -delta + ' case' + (delta < -1 ? 's' : '')) : holdingTeam ? (holdingTeam === 1 ? 'Vous' : 'IA') + ' · victoire dans ' + Math.max(0, Math.ceil(15 - match.hold[holdingTeam])) + ' s' : 'Domination · > 50 % / 15 s';
    $p('paintPigment').textContent = Math.floor(match.pigment[1]);
    $p('paintPigmentBar').style.width = Math.min(100, match.pigment[1]) + '%';
    $p('paintIncome').textContent = '+' + (match.income[1] || 0).toFixed(1).replace('.',',') + '/s';
    $p('paintOutflow').textContent = '−' + (match.productionOutflow?.(1) || 0).toFixed(1).replace('.',',') + '/s prévu';
    $p('paintOutflow').setAttribute('aria-label', 'Dépense automatique prévue : ' + (match.productionOutflow?.(1) || 0).toFixed(1) + ' pigment par seconde');
    $p('paintUnits').textContent = '■ ' + match.getUnitCount(1) + '/' + (config().unitLimit ?? 24);
    $p('paintBrush').setAttribute('aria-pressed', String(mode === 'brush'));
    $p('paintBrush').setAttribute('aria-label', brushLocked ? 'Pinceau verrouillé. Toucher pour revenir à la vue.' : 'Pinceau. Double toucher pour le garder actif.');
    $p('paintBrush').innerHTML = '<span aria-hidden="true">' + (brushLocked ? '▣' : '╱') + '</span> Pinceau' + (brushLocked ? ' 🔒' : '');
    $p('paintBrush').disabled = !!tutorial && (tutorialBlocked() || !tutorialView.allowedTools?.includes('brush'));
    $p('paintBrush').classList.toggle('paint-tutorial-cue', !!tutorial && !tutorialBlocked() && tutorialView.gesture === 'brush' && mode !== 'brush');
    $p('paintNavigate').setAttribute('aria-pressed', String(mode === 'navigate'));
    $p('paintZoomOut').disabled = camera.zoom <= 1.001;
    $p('paintZoomIn').disabled = camera.zoom >= 2.999;
    $p('paintPause').textContent = paused ? '▶' : 'Ⅱ';
    $p('paintPause').setAttribute('aria-label', paused ? 'Reprendre le combat' : 'Mettre le combat en pause');
    renderHand(); updateContext();
    if (active && tutorial && !gesture && tutorialCameraPhase !== tutorialView.step + ':' + tutorialView.phase) resize();
  }
  function draw() {
    if (!active || !match) return;
    window.CQPaintRenderer?.draw(context, match, view, {palette:window.CQPalette?.current, mode, selectedCard, selectedProducer, selectedSource, preview, previewPoint, target:previewPoint, stroke, flowDrag, tutorial:tutorial && !tutorialBlocked() ? tutorialView : null, effects:[], reducedMotion:reducedMotion.matches}, match.time);
  }
  function spendParticle(event) {
    if (event.team !== 1 || !(event.cost > 0) || !active || paused) return;
    const rect = screen.getBoundingClientRect(), source = $p('paintPigment').getBoundingClientRect(), mapRect = canvas.getBoundingClientRect();
    const producer = match.buildings.find(b => b.id === event.producerId);
    if (!producer) return;
    const end = {x:mapRect.x - rect.x + view.x + (producer.x + .5) * view.cell, y:mapRect.y - rect.y + view.y + (producer.y + .5) * view.cell};
    const start = {x:source.x - rect.x + source.width / 2, y:source.y - rect.y};
    const particle = document.createElement('span'); particle.className = 'paint-payment'; particle.textContent = '−' + event.cost; particle.setAttribute('aria-hidden','true');
    particle.style.left = start.x + 'px'; particle.style.top = start.y + 'px'; particle.style.setProperty('--payment-x', (end.x - start.x) + 'px'); particle.style.setProperty('--payment-y', (end.y - start.y) + 'px');
    screen.append(particle);
    if (reducedMotion.matches) { particle.style.left = end.x + 'px'; particle.style.top = end.y + 'px'; particle.classList.add('paint-payment-still'); }
    particle.addEventListener('animationend', () => particle.remove(), {once:true}); setTimeout(() => particle.remove(), 1600);
  }
  function processEvents() {
    for (const event of match.events || []) {
      if (event.id <= seenEvent) continue;
      seenEvent = event.id;
      if (event.type === 'acceleration' && !tutorial) toast('Dernière minute : pigment ×1,5 pour les deux camps.', 4);
      if (event.type === 'overtime') toast('Égalité : 30 s de prolongation. Chaque case reliée compte.', 4);
      if (event.type === 'spawn') spendParticle(event);
    }
  }
  function frame(now) {
    const elapsed = Math.min(.05, Math.max(0, (now - lastFrame) / 1000 || 0)); lastFrame = now;
    if (active && match) {
      if (!paused && (!tutorial ? match.winner == null : !tutorialBlocked())) {
        if (tutorial) { tutorial.update(elapsed); tutorialView = tutorial.presentation(); if (tutorialBlocked()) cancel(); }
        else { window.CQPaintAI?.update(match, elapsed); match.update(elapsed); }
        processEvents();
      }
      if (!tutorial && match.winner != null && !resultShown) finish();
      if (!$p('paintToast').hidden && now > toastUntil) $p('paintToast').hidden = true;
      updateHUD(); draw();
    }
    requestAnimationFrame(frame);
  }

  function closeDialog() { $p('paintDialog').hidden = true; dialogKind = ''; updateHUD(true); }
  function openDialog(kind, markup) {
    lastFocus = document.activeElement; dialogKind = kind; $p('paintDialogContent').innerHTML = markup; $p('paintDialog').hidden = false;
    updateHUD(true); $p('paintDialogContent').focus();
  }
  function help() {
    if (!active || !match) return;
    paused = true; cancel(); announceState();
    openDialog('help', '<div class="paint-dialog-eyebrow">PEINDRE · DÉPLOYER · GUIDER</div><h2 id="paintDialogTitle">Une couleur, un réseau.</h2><ol class="paint-help-steps"><li><b>Peignez le blanc.</b> Touchez Pinceau, tracez depuis votre territoire relié, puis relâchez. Seule la portion valide est payée. Revenez au départ pour annuler. Double touchez le bouton pour garder le pinceau.</li><li><b>Jouez une carte.</b> Glissez-la sur un emplacement valide puis relâchez, ou touchez la carte puis sa cible. Ramenez-la dans la main pour annuler.</li><li><b>Guidez l’armée.</b> Glissez de la caserne vers une cible. Pour rappeler, glissez à l’extérieur puis revenez sur elle. Toucher un bâtiment montre sa fiche ; Pause arrête explicitement la production.</li></ol><details class="paint-help-details"><summary>Pigment, réseau et victoire</summary><p>Une caserne paie ' + (config().unitCost ?? 6) + ' pigments à chaque sortie, toutes les ' + (config().unitInterval ?? 5) + ' s. La jauge indique le revenu et la dépense prévue. Vos casernes attendent pendant le tracé ou la visée d’une carte, hors réseau, sans pigment ou au plafond d’unités.</p><p>Le pinceau ne traverse pas la couleur ennemie : l’armée la conquiert. Contournez une coupure par du terrain blanc pour reconnecter les hachures. Relier une source permet d’y poser un extracteur ; lui seul fournit le bonus de la source.</p><p>Détruisez le Cœur adverse ou gardez plus de 50 % de la toile, avec une avance, pendant 15 s. À 4 minutes, le plus grand territoire relié gagne. Égalité : 30 s de prolongation, puis comparaison des territoires ; nul seulement s’ils restent égaux. Le pigment accélère pendant la dernière minute et la prolongation.</p><p>Vue permet de déplacer la carte. Deux doigts, ou + / −, règlent le zoom. La retraite ne riposte pas en chemin ; les unités défendent à leur arrivée.</p></details><p id="paintSessionNotice" class="paint-session-note">' + sessionNotice + '</p><button id="paintBegin" class="paint-main-action paint-full-action">Reprendre →</button>');
    bindActionTap($p('paintBegin'), () => { closeDialog(); paused = false; lastFrame = performance.now(); updateHUD(true); announceState(); });
  }
  function pause(value = !paused) {
    if (!match || (!tutorial && match.winner != null) || !active) return;
    paused = !!value; cancel(); lastFrame = performance.now();
    if (paused) {
      openDialog('pause', '<div class="paint-dialog-eyebrow">LA TOILE VOUS ATTEND</div><h2 id="paintDialogTitle">Combat en pause.</h2><p id="paintSessionNotice" class="paint-session-note">' + sessionNotice + '</p><button id="paintContinue" class="paint-main-action paint-full-action">▶ Reprendre</button><div class="paint-dialog-buttons"><button id="paintPauseHelp">Revoir les gestes</button><button id="paintPauseSound">♫ Activer / couper le son</button>' + (navigator.vibrate ? '<button id="paintHaptics" aria-pressed="' + vibration + '">Vibrations : ' + (vibration ? 'oui' : 'non') + '</button>' : '') + '</div><button id="paintPauseMenu" class="paint-full-action">Retour au menu</button>');
      $p('paintContinue').onclick = () => pause(false);
      $p('paintPauseHelp').onclick = help;
      $p('paintPauseSound').onclick = () => { if (typeof window.toggleSound === 'function') window.toggleSound(); };
      if ($p('paintHaptics')) $p('paintHaptics').onclick = () => { vibration = !vibration; $p('paintHaptics').textContent = 'Vibrations : ' + (vibration ? 'oui' : 'non'); $p('paintHaptics').setAttribute('aria-pressed', String(vibration)); buzz(); };
      $p('paintPauseMenu').onclick = showMenu;
    } else { closeDialog(); canvas.focus(); }
    updateHUD(true); announceState();
  }
  function showMenu() {
    if (!active) return;
    paused = true; cancel(); closeDialog(); active = false; screen.hidden = true; document.body.classList.remove('paint-mode');
    $p('menu')?.classList.remove('hidden'); $p('game')?.classList.add('hidden');
    $p('paintResume').hidden = !match || (!tutorial && match.winner != null); window.scrollTo(0,0); announceState();
  }
  function activate() {
    // Use the classic mode's existing lifecycle; never replace its game,
    // selection, state variables, campaign progress or local-storage slots.
    if (typeof window.returnToMenu === 'function') { window.CQSave?.save?.(); window.returnToMenu(); }
    active = true; screen.hidden = false; document.body.classList.add('paint-mode');
    $p('menu')?.classList.add('hidden'); $p('game')?.classList.add('hidden');
    window.scrollTo(0,0); lastFrame = performance.now(); resize(); announceState();
  }
  function syncTutorialScene() {
    match = tutorial.game; tutorialView = tutorial.presentation(); tutorialCameraPhase = '';
    selectedProducer = null; selectedSource = null; handSignature = ''; lastHUD = -1; seenEvent = 0; resultShown = false;
    screen.querySelectorAll('.paint-payment').forEach(node => node.remove());
    $p('paintToast').hidden = true; toastUntil = 0;
    cancel();
    camera = {zoom:tutorialView.camera?.zoom || 1, cx:tutorialView.camera?.cx ?? match.width / 2, cy:tutorialView.camera?.cy ?? match.height / 2}; tutorialCameraPhase = '';
    paused = false; lastFrame = performance.now(); resize(); updateHUD(true); announceState();
  }
  function nextTutorial() {
    if (!tutorial) return;
    if (tutorialView?.complete) { start({tutorial:false,replace:true}); return; }
    tutorial.next(); syncTutorialScene();
  }
  function retryTutorial() { if (tutorial) { tutorial.retry(); syncTutorialScene(); } }
  function start(options = {}) {
    if (!window.CQPaintEngine?.Game) return false;
    if (options.resume && match && (tutorial || match.winner == null)) { activate(); pause(true); return true; }
    if (match && (tutorial || match.winner == null) && !options.replace) {
      activate(); paused = true; cancel();
      openDialog('replace', '<div class="paint-dialog-eyebrow">UNE TOILE EST EN PAUSE</div><h2 id="paintDialogTitle">Une nouvelle toile ?</h2><p>Vous pouvez reprendre la situation en cours. Une nouvelle toile la remplacera.</p><button id="paintKeepMatch" class="paint-main-action paint-full-action">Reprendre cette toile</button><button id="paintReplaceMatch" class="paint-full-action">Commencer une nouvelle toile</button><button id="paintReplaceMenu" class="paint-full-action">Retour au menu</button>');
      $p('paintKeepMatch').onclick = () => pause(false); $p('paintReplaceMatch').onclick = () => start({...options,replace:true}); $p('paintReplaceMenu').onclick = showMenu;
      return false;
    }
    const seed = Number.isFinite(options.seed) ? options.seed : Math.floor(Math.random() * 1e8);
    tutorial = options.tutorial !== false && window.CQPaintTutorial ? window.CQPaintTutorial.create({seed}) : null;
    tutorialView = tutorial?.presentation() || null; tutorialCameraPhase = '';
    match = tutorial?.game || new window.CQPaintEngine.Game({seed,duration:240});
    window.CQPaintAI?.reset?.(match);
    paused = false; resultShown = false; selectedProducer = null; selectedSource = null; handSignature = ''; lastHUD = -1; seenEvent = 0;
    screen.querySelectorAll('.paint-payment').forEach(node => node.remove());
    camera = {zoom:tutorialView?.camera?.zoom || 1, cx:tutorialView?.camera?.cx ?? match.width / 2, cy:tutorialView?.camera?.cy ?? match.height / 2};
    cancel(); closeDialog(); activate(); updateHUD(true); playSound('jingles_PIZZI00'); announceState();
    return true;
  }
  function finish() {
    if (resultShown) return; resultShown = true; paused = true; cancel();
    const title = match.winner === 1 ? 'La toile porte votre couleur.' : match.winner === 2 ? 'Une autre couleur s’impose.' : 'Une toile partagée.';
    let reason = ({core:'Le Cœur adverse a été effacé.',domination:'La domination a été tenue pendant 15 secondes.',time:'Le temps est écoulé : le territoire connecté départage les camps.',overtime:'Après la prolongation, votre surface reliée départage les camps.',draw:'Les deux camps terminent à égalité.'}[match.winReason]) || match.winReason || 'Le combat est terminé.';
    if (match.winner === 2 && /Cœur adverse/.test(reason)) reason = 'Votre Cœur a été effacé.';
    const seconds = Math.floor(match.time), duration = Math.floor(seconds / 60) + ' min ' + String(seconds % 60).padStart(2,'0') + ' s';
    openDialog('result','<div class="paint-result-symbol" aria-hidden="true">' + (match.winner === 1 ? '◈' : match.winner === 2 ? '◆' : '◌') + '</div><div class="paint-dialog-eyebrow">COMBAT TERMINÉ</div><h2 id="paintDialogTitle">' + title + '</h2><p>' + esc(reason) + '</p><div class="paint-result-stat"><span>Votre territoire connecté</span><strong>' + (match.scores[1] * 100).toFixed(1) + ' %</strong></div><div class="paint-result-stat"><span>Durée</span><strong>' + duration + '</strong></div><button id="paintAgain" class="paint-main-action paint-full-action">Une nouvelle toile →</button><button id="paintEndMenu" class="paint-full-action">Retour au menu</button>');
    $p('paintAgain').onclick = () => start({replace:true,tutorial:false}); $p('paintEndMenu').onclick = showMenu;
    $p('paintResume').hidden = true; playSound(match.winner === 1 ? 'jingles_PIZZI03' : 'error_001'); announceState();
  }

  $p('paintStart').onclick = () => start({tutorial:true}); $p('paintFreePlay').onclick = () => start({tutorial:false}); $p('paintResume').onclick = () => start({resume:true});
  bindActionTap($p('paintMenu'), showMenu); bindActionTap($p('paintPause'), () => pause(!paused)); bindActionTap($p('paintHelp'), help);
  bindActionTap($p('paintBrush'), brushButton); bindActionTap($p('paintNavigate'), () => { cancel(); selectedProducer = null; selectedSource = null; updateHUD(true); });
  bindActionTap($p('paintCancel'), cancel);
  bindActionTap($p('paintRecall'), () => recallSelected());
  bindActionTap($p('paintProductionToggle'), () => { if (paused || tutorialBlocked()) return; const producer = currentProducer(); if (producer) { const result = match.toggleProduction(1, producer.id); afterAction('pause', result, {producerId:producer.id}); } updateHUD(true); });
  bindActionTap($p('paintUpgrade'), () => { if (paused || tutorialBlocked()) return; const result = match.upgradeCore(1); toast(result.message || (result.ok ? 'Cœur amélioré.' : 'Amélioration impossible.')); if (result.ok) playSound('confirmation_001'); updateHUD(true); });
  bindActionTap($p('paintProducerClose'), () => { selectedProducer = null; selectedSource = null; updateHUD(true); });
  bindActionTap($p('paintZoomIn'), () => { cancel(); zoomAt(camera.zoom + .5); }); bindActionTap($p('paintZoomOut'), () => { cancel(); zoomAt(camera.zoom - .5); });
  bindActionTap($p('paintTutorialNext'), nextTutorial); bindActionTap($p('paintTutorialRetry'), retryTutorial); bindActionTap($p('paintTutorialSkip'), () => start({tutorial:false,replace:true}));
  $p('paintDialog').addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Tab') {
      const items = [...$p('paintDialogContent').querySelectorAll('button:not(:disabled),summary,[tabindex="0"]')].filter(el => !el.hidden);
      if (!items.length) return;
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === $p('paintDialogContent'))) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    }
  });
  document.addEventListener('keydown', event => {
    if (!active || dialogKind || event.target.closest?.('input,textarea,select')) return;
    if ((event.key === ' ' || event.key === 'Enter') && event.target.closest?.('button,summary')) return;
    if (event.key === 'Escape') { event.preventDefault(); if (mode !== 'navigate' || selectedProducer || selectedSource) { selectedProducer = null; selectedSource = null; cancel(); } else pause(true); }
    else if (event.key === ' ') { event.preventDefault(); pause(!paused); }
    else if (event.key.toLowerCase() === 'p') setMode('brush');
    else if (event.key.toLowerCase() === 'v') cancel();
  });
  addEventListener('blur', () => { if (active && !paused && (tutorial || match?.winner == null)) pause(true); });
  addEventListener('pagehide', () => { if (active && !paused && (tutorial || match?.winner == null)) pause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active && !paused && (tutorial || match?.winner == null)) pause(true); });
  addEventListener('resize', resize); new ResizeObserver(resize).observe($p('paintCanvasWrap'));
  document.addEventListener('cq:palettechange', draw);
  window.CQPaint = Object.freeze({start,showMenu,pause,resize,help,cancel,confirm,setMode,updateHUD,draw,
    get active(){return active;},get paused(){return paused;},get game(){return match;},get hasMatch(){return !!match && (!!tutorial || match.winner == null);},
    get view(){return {...view};},get zoom(){return camera.zoom;},get mode(){return mode;},get preview(){return preview;},get tutorialStep(){return tutorialView?.step ?? -1;},get tutorial(){return tutorial;},get brushLocked(){return brushLocked;},get selectedProducer(){return selectedProducer;},get selectedSource(){return selectedSource && {...selectedSource};}});
  requestAnimationFrame(frame);
})();
