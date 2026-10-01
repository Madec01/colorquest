/* V0.7 paint prototype. The classic game and its saved matches stay independent. */
(() => {
  'use strict';
  const $p = id => document.getElementById(id);
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sessionNotice = 'Ce combat reste dans cette fenêtre. Fermer ou recharger la page le termine. Les sauvegardes du mode classique sont conservées.';
  const lessons = [
    ['Tracer', 'Choisissez Pinceau, puis tracez depuis votre couleur vers une case blanche. Validez le trait.'],
    ['Déployer', 'Posez une carte Caserne sur votre couleur reliée au Cœur. Elle forme vos renforts.'],
    ['Guider', 'Glissez depuis votre caserne vers une destination pour guider tous ses renforts.']
  ];
  let match = null, active = false, paused = true, resultShown = false;
  let mode = 'navigate', selectedCard = null, selectedProducer = null, preview = null, previewPoint = null, stroke = [], flowDrag = null;
  let camera = {zoom:1, cx:9.5, cy:13.5}, view = {x:0,y:0,w:1,h:1,cell:1};
  let lastFrame = 0, lastHUD = -1, handSignature = '', toastUntil = 0, lesson = 0, hintsDismissed = false, vibration = false;
  let gesture = null, pinch = null, suppressGesture = false, longTimer = null, dialogKind = '', lastFocus = null, seenEvent = 0;
  const pointers = new Map();

  const menuCard = document.createElement('section');
  menuCard.id = 'paintModeCard'; menuCard.className = 'paint-menu-card';
  menuCard.setAttribute('aria-labelledby', 'paintMenuTitle');
  menuCard.innerHTML = '<div class="paint-menu-eyebrow"><span>NOUVEAU PROTOTYPE · V0.7</span><span>4 MIN · SOLO</span></div><h2 id="paintMenuTitle">Prenez le pinceau.</h2><p>Tracez votre territoire. Jouez vos cartes.<br>Guidez votre couleur vers la victoire.</p><button id="paintStart" class="primary">Essayer le nouveau mode <span aria-hidden="true">↗</span></button><button id="paintResume" class="paint-menu-resume" hidden>↻ Reprendre ce combat <small>En pause dans cette fenêtre</small></button><small class="paint-menu-note">Le mode classique et ses missions restent disponibles ci-dessous.</small>';
  (document.getElementById('campaignCard') || document.querySelector('.start-card'))?.before(menuCard);
  document.body.classList.add('paint-menu-ready');

  const screen = document.createElement('section');
  screen.id = 'paintGame'; screen.className = 'paint-game'; screen.hidden = true;
  screen.setAttribute('aria-label', 'Colorquest : combat de peinture');
  screen.innerHTML = `
    <header class="paint-header">
      <div class="paint-topline"><button id="paintMenu" aria-label="Mettre en pause et retourner au menu" title="Menu">‹</button><div class="paint-heading"><strong>COLORQUEST</strong><small>LA TOILE · PROTOTYPE</small></div><time id="paintClock">04:00</time><button id="paintHelp" aria-label="Aide du nouveau mode">?</button><button id="paintPause" aria-label="Mettre le combat en pause">Ⅱ</button></div>
      <div class="paint-domination"><span id="paintPlayerShare">● Vous · 0 %</span><span id="paintHold">Domination · 50 % / 15 s</span><span id="paintEnemyShare">IA · 0 % ▲</span></div>
      <div class="paint-score-track" aria-label="Territoire connecté des deux camps"><i id="paintPlayerBar"></i><b id="paintEnemyBar"></b><em></em></div>
    </header>
    <main id="paintCanvasWrap" class="paint-canvas-wrap">
      <canvas id="paintCanvas" aria-label="Toile interactive. En mode Vue, glissez pour déplacer la carte et pincez pour zoomer. En mode Pinceau, tracez depuis votre couleur. Touchez une carte puis son emplacement, et validez."></canvas>
      <div class="paint-zoom"><button id="paintZoomOut" aria-label="Dézoomer">−</button><button id="paintZoomIn" aria-label="Zoomer">+</button></div>
      <div id="paintToast" class="paint-toast" role="status" aria-live="polite" hidden></div>
      <div id="paintHint" class="paint-hint"><div><small id="paintHintStep">1 / 3 · TRACER</small><span id="paintHintText"></span></div><button id="paintHintClose" aria-label="Masquer les conseils">×</button></div>
      <div id="paintContext" class="paint-context" hidden>
        <div class="paint-context-copy"><strong id="paintContextTitle"></strong><span id="paintContextMessage"></span></div>
        <div id="paintAimActions" class="paint-context-actions" hidden><button id="paintCancel">Annuler</button><button id="paintConfirm" class="paint-main-action">Valider</button></div>
        <div id="paintProducerActions" class="paint-context-actions" hidden><button id="paintProductionToggle">Pause</button><button id="paintRecall">Rappeler</button><button id="paintUpgrade" hidden>Améliorer</button><button id="paintProducerClose" aria-label="Fermer les commandes du bâtiment">×</button></div>
      </div>
    </main>
    <footer class="paint-footer">
      <div class="paint-resource"><span><b id="paintPigment">65</b><small> / 100 PIGMENT</small></span><div class="paint-resource-track"><i id="paintPigmentBar"></i></div><span id="paintIncome">+0 / s</span><span id="paintUnits" aria-label="Unités alliées">■ 0 / 24</span></div>
      <div class="paint-tools"><button id="paintBrush" aria-pressed="false"><span aria-hidden="true">╱</span> Pinceau</button><button id="paintNavigate" aria-pressed="true"><span aria-hidden="true">✥</span> Vue</button><div id="paintNext" class="paint-next" aria-label="Prochaine carte"><small>PROCHAINE</small><strong>⬡ Bastion</strong></div></div>
      <div id="paintHand" class="paint-hand" role="group" aria-label="Vos quatre cartes"></div>
    </footer>
    <div id="paintDialog" class="paint-dialog" hidden><section id="paintDialogContent" class="paint-dialog-content" role="dialog" aria-modal="true" aria-labelledby="paintDialogTitle" tabindex="-1"></section></div>`;
  document.body.append(screen);
  const canvas = $p('paintCanvas'), context = canvas.getContext('2d');

  function announceState() { document.dispatchEvent(new CustomEvent('cq:paintstate', {detail:{active, paused, hasMatch:!!match && match.winner == null}})); }
  function playSound(name = 'click_001') { if (typeof window.audio === 'function') window.audio(name); }
  function buzz(ms = 18) { if (vibration && navigator.vibrate) navigator.vibrate(ms); }
  // Some mobile browsers suppress the compatibility click immediately after
  // a drag. Confirmation remains a separate, stationary tap: handle that
  // pointer gesture directly, while retaining native keyboard/mouse clicks.
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
      event.preventDefault(); action();
    });
    button.addEventListener('pointercancel', event => { if (event.pointerType === 'touch') touchEndedAt = performance.now(); tap = null; });
    button.onclick = event => {
      // Keyboard and assistive activation have detail 0. Older mobile browsers
      // can emit a MouseEvent with no pointer identity after a touch instead.
      if (event.detail !== 0 && (event.pointerType === 'touch' || performance.now() - touchEndedAt < 700)) return;
      action();
    };
  }
  function toast(message, seconds = 2.7) { $p('paintToast').textContent = message; $p('paintToast').hidden = false; toastUntil = performance.now() + seconds * 1000; }
  function config() { return window.CQPaintEngine?.CONFIG || {}; }
  function cards() { return window.CQPaintEngine?.CARDS || {}; }
  function currentProducer() { return match?.buildings.find(b => b.id === selectedProducer && b.team === 1 && b.hp > 0) || null; }
  function setHeld() { match?.setSpendingHeld(1, !!active && !paused && (mode === 'card' || stroke.length > 0)); }
  function clearLongPress() { if (longTimer !== null) clearTimeout(longTimer); longTimer = null; }
  function clearGesture(clearPointers = true) {
    clearLongPress(); gesture = null; flowDrag = null; pinch = null;
    if (clearPointers) { pointers.clear(); suppressGesture = false; }
  }
  function cancel() {
    clearGesture(); mode = 'navigate'; selectedCard = null; preview = null; previewPoint = null; stroke = [];
    match?.setSpendingHeld(1, false); updateHUD(true);
  }
  function setMode(next, index = null) {
    if (!active || paused || match?.winner != null) return false;
    clearGesture(); mode = next === 'brush' || next === 'card' ? next : 'navigate';
    selectedCard = mode === 'card' ? index : null; selectedProducer = null; stroke = []; preview = null; previewPoint = null;
    setHeld(); updateHUD(true); return true;
  }
  function clearAimForNavigation() {
    clearLongPress(); stroke = []; preview = null; previewPoint = null; selectedCard = null; mode = 'navigate'; flowDrag = null;
    match?.setSpendingHeld(1, false);
  }
  function teach(kind) {
    if (kind === 'brush' && lesson === 0) lesson = 1;
    else if (kind === 'barracks' && lesson < 2) lesson = 2;
    else if (kind === 'flow' && lesson === 2) { lesson = 3; toast('Les trois gestes sont acquis. À vous de composer la toile.'); }
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
    context.setTransform(dpr, 0, 0, dpr, 0, 0); layout(); draw();
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
  function pickProducer(p) {
    let best = null, distance = Infinity;
    for (const b of match.getProducers(1)) {
      if (b.hp <= 0) continue;
      const d = Math.hypot(view.x + (b.x + .5) * view.cell - p.x, view.y + (b.y + .5) * view.cell - p.y);
      if (d < Math.max(22, view.cell * 1.1) && d < distance) { best = b; distance = d; }
    }
    return best;
  }
  // Every sampled segment becomes an orthogonal, contiguous tile path. Neither
  // sparse touch events nor a diagonal stroke can jump a wall or an enemy cell.
  function appendStroke(target) {
    if (!stroke.length) stroke.push(target);
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
  function confirm() {
    if (!active || paused || match?.winner != null || !preview?.ok) return false;
    const result = mode === 'brush' ? match.paint(1, stroke) : mode === 'card' && previewPoint ? match.playCard(1, selectedCard, previewPoint.x, previewPoint.y) : null;
    if (!result?.ok) { preview = result || preview; toast(result?.message || 'Choisissez un emplacement.'); updateHUD(true); return false; }
    if (mode === 'brush') teach('brush');
    if (result.cardId === 'barracks') teach('barracks');
    const keepBrush = mode === 'brush';
    clearGesture(); stroke = []; preview = null; previewPoint = null; selectedCard = null; mode = keepBrush ? 'brush' : 'navigate';
    match.setSpendingHeld(1, false); playSound('confirmation_001'); buzz(); updateHUD(true); return true;
  }
  function recallSelected(id = selectedProducer) {
    if (!match || paused) return;
    const result = match.recall(1, id); selectedProducer = id;
    toast(result?.message || (result?.ok ? 'Les renforts reviennent défendre leur bâtiment.' : 'Rappel impossible.'));
    if (result?.ok) { teach('flow'); playSound('select_001'); buzz(); }
    updateHUD(true);
  }

  function beginPinch() {
    clearAimForNavigation(); gesture = null; suppressGesture = true;
    const pair = [...pointers.values()].slice(0,2), midpoint = {x:(pair[0].x + pair[1].x) / 2, y:(pair[0].y + pair[1].y) / 2};
    pinch = {distance:Math.max(1, Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)), zoom:camera.zoom, anchor:world(midpoint)};
    updateHUD(true);
  }
  function pointerDown(event) {
    if (!active || paused || dialogKind || match?.winner != null || event.button > 0) return;
    const cardButton = event.target.closest?.('[data-paint-card]');
    if (event.target !== canvas && !cardButton) return;
    event.preventDefault();
    const p = localPoint(event); pointers.set(event.pointerId, p);
    try { event.target.setPointerCapture(event.pointerId); } catch (_) {}
    if (pointers.size > 1) { beginPinch(); return; }
    if (suppressGesture) return;
    if (cardButton) {
      const index = Number(cardButton.dataset.paintCard);
      // setMode clears the preceding gesture, so restore this captured pointer.
      setMode('card', index); pointers.set(event.pointerId, p);
      gesture = {id:event.pointerId, kind:'cardDrag', start:p, last:p, moved:false}; return;
    }
    if (mode === 'brush') { stroke = []; appendStroke(tilePoint(p)); gesture = {id:event.pointerId, kind:'brush', start:p, last:p, moved:false}; return; }
    if (mode === 'card') { aimCard(tilePoint(p)); gesture = {id:event.pointerId, kind:'cardAim', start:p, last:p, moved:false}; return; }
    const producer = pickProducer(p);
    gesture = {id:event.pointerId, kind:producer ? 'producer' : 'pan', producerId:producer?.id, start:p, last:p, moved:false, long:false, cx:camera.cx, cy:camera.cy};
    if (producer) {
      selectedProducer = producer.id;
      longTimer = setTimeout(() => {
        if (gesture?.id !== event.pointerId || gesture.moved || pointers.size !== 1 || paused) return;
        gesture.long = true; recallSelected(producer.id); clearLongPress();
      }, 550);
    }
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
    if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 8) { gesture.moved = true; clearLongPress(); }
    if (gesture.kind === 'brush') { if (inside(p)) appendStroke(tilePoint(p)); return; }
    if (gesture.kind === 'cardAim' || gesture.kind === 'cardDrag') { if (inside(p)) aimCard(tilePoint(p)); else { preview = null; previewPoint = null; updateHUD(true); } return; }
    if (gesture.kind === 'producer' && gesture.moved && !gesture.long) { const t = tilePoint(p); flowDrag = {producerId:gesture.producerId, x:t.x, y:t.y}; return; }
    if (gesture.kind === 'pan' && gesture.moved) {
      camera.cx = gesture.cx - (p.x - gesture.start.x) / view.cell; camera.cy = gesture.cy - (p.y - gesture.start.y) / view.cell; layout();
    }
  }
  function pointerUp(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault(); const p = localPoint(event); pointers.delete(event.pointerId); clearLongPress();
    if (suppressGesture) { if (!pointers.size) { suppressGesture = false; pinch = null; gesture = null; updateHUD(true); } return; }
    if (!gesture || gesture.id !== event.pointerId) return;
    const finished = gesture; gesture = null;
    if (finished.kind === 'brush') {
      if (inside(p)) appendStroke(tilePoint(p)); else { stroke = []; preview = null; previewPoint = null; setHeld(); }
    } else if (finished.kind === 'cardAim' || finished.kind === 'cardDrag') {
      if (inside(p)) aimCard(tilePoint(p));
    } else if (finished.kind === 'producer' && !finished.long) {
      selectedProducer = finished.producerId;
      if (finished.moved && inside(p)) {
        const target = tilePoint(p), result = match.setFlow(1, finished.producerId, target.x, target.y);
        toast(result?.message || (result?.ok ? 'Les renforts suivent cette destination.' : 'Destination impossible.'));
        if (result?.ok) { teach('flow'); playSound('select_001'); buzz(); }
      } else if (!finished.moved) {
        const producer = currentProducer();
        if (producer?.type === 'barracks') { const result = match.toggleProduction(1, producer.id); if (result?.ok) playSound(); }
      }
    } else if (finished.kind === 'pan' && !finished.moved) selectedProducer = null;
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
      // same aiming mode and never plays a card without a target/confirmation.
      $p('paintHand').querySelectorAll('button').forEach(button => button.addEventListener('click', event => { if (event.detail === 0) setMode('card', Number(button.dataset.paintCard)); }));
    }
    for (const button of $p('paintHand').querySelectorAll('button')) {
      const index = Number(button.dataset.paintCard), card = cards()[hand[index]];
      button.setAttribute('aria-pressed', String(mode === 'card' && selectedCard === index));
      button.classList.toggle('paint-unaffordable', match.pigment[1] < card.cost);
    }
    const next = cards()[match.decks[1]?.[0]];
    $p('paintNext').innerHTML = '<small>PROCHAINE</small><strong>' + esc(next ? next.icon + ' ' + next.name : '—') + '</strong>';
  }
  function updateContext() {
    const aiming = mode === 'card' || (mode === 'brush' && stroke.length > 0), producer = currentProducer();
    $p('paintContext').hidden = !aiming && !producer;
    $p('paintAimActions').hidden = !aiming;
    $p('paintProducerActions').hidden = aiming || !producer;
    if (aiming) {
      const card = selectedCard == null ? null : cards()[match.hands[1][selectedCard]];
      $p('paintContextTitle').textContent = (mode === 'brush' ? 'Trait d’encre' : card?.name || 'Carte') + ' · ' + (preview?.cost ?? card?.cost ?? 0) + ' pigments';
      $p('paintContextMessage').textContent = preview?.message || (card ? card.description + ' Touchez un emplacement.' : 'Tracez depuis votre couleur connectée.');
      $p('paintContext').classList.toggle('paint-invalid', preview?.ok === false);
      $p('paintConfirm').disabled = !preview?.ok || paused;
      $p('paintConfirm').textContent = mode === 'brush' ? 'Peindre' : 'Jouer';
    } else if (producer) {
      const count = match.units.filter(u => u.hp > 0 && u.team === 1 && u.producerId === producer.id).length;
      $p('paintContext').classList.remove('paint-invalid');
      $p('paintContextTitle').textContent = (producer.type === 'core' ? 'Cœur · niveau ' + producer.level : 'Caserne') + ' · ' + count + ' renfort' + (count > 1 ? 's' : '');
      const reason = producer.productionReason || ({running:'Production active',paused:'Production en pause',isolated:'Réseau coupé',held:'Pigment réservé à votre geste',funds:'En attente de pigment',full:'Armée au complet'}[producer.productionState] || '');
      $p('paintContextMessage').textContent = producer.type === 'core' ? 'Glissez pour guider les unités recueillies. Appui long : rappel.' : reason + ' · ' + (config().unitCost ?? 6) + ' pigments / renfort. Glissez pour les guider.';
      $p('paintProductionToggle').hidden = producer.type !== 'barracks';
      $p('paintProductionToggle').textContent = producer.productionPaused ? '▶ Produire' : 'Ⅱ Pause';
      $p('paintUpgrade').hidden = producer.type !== 'core' || producer.level >= 3;
      $p('paintUpgrade').textContent = 'Niv. ' + (producer.level + 1) + ' · ' + (producer.level === 1 ? 35 : 50) + ' ◉';
      $p('paintUpgrade').disabled = match.pigment[1] < (producer.level === 1 ? 35 : 50);
    }
    $p('paintHint').hidden = hintsDismissed || lesson >= lessons.length || aiming || !!producer || !!dialogKind;
    if (lesson < lessons.length) {
      $p('paintHintStep').textContent = (lesson + 1) + ' / 3 · ' + lessons[lesson][0].toUpperCase();
      $p('paintHintText').textContent = mode === 'brush' && lesson === 0 ? 'Partez de votre couleur, tracez vers le blanc, puis validez.' : lessons[lesson][1];
    }
    const overlay = !$p('paintContext').hidden ? $p('paintContext') : !$p('paintHint').hidden ? $p('paintHint') : null;
    $p('paintToast').style.top = (overlay ? overlay.offsetTop + overlay.offsetHeight + 8 : 10) + 'px';
  }
  function updateHUD(force = false) {
    if (!match) return;
    if (!force && match.time - lastHUD < .1) return;
    lastHUD = match.time;
    if (mode === 'card' && previewPoint && selectedCard != null) preview = match.previewCard(1, selectedCard, previewPoint.x, previewPoint.y);
    if (mode === 'brush' && stroke.length) preview = match.previewPaint(1, stroke);
    const remaining = Math.max(0, Math.ceil(match.duration - match.time));
    $p('paintClock').textContent = String(Math.floor(remaining / 60)).padStart(2,'0') + ':' + String(remaining % 60).padStart(2,'0');
    $p('paintClock').classList.toggle('paint-final-minute', !!match.accelerated);
    for (const [team, prefix] of [[1,'Player'],[2,'Enemy']]) {
      const share = match.scores[team] * 100;
      $p('paint' + prefix + 'Share').textContent = team === 1 ? '● Vous · ' + share.toFixed(0) + ' %' : 'IA · ' + share.toFixed(0) + ' % ▲';
      $p('paint' + prefix + 'Bar').style.width = share + '%';
    }
    const holdingTeam = match.hold[1] > 0 ? 1 : match.hold[2] > 0 ? 2 : 0;
    $p('paintHold').textContent = holdingTeam ? (holdingTeam === 1 ? 'Vous' : 'IA') + ' · victoire dans ' + Math.max(0, Math.ceil(15 - match.hold[holdingTeam])) + ' s' : match.accelerated ? 'Dernière minute · pigment ×1,5' : 'Domination · 50 % / 15 s';
    $p('paintPigment').textContent = Math.floor(match.pigment[1]);
    $p('paintPigmentBar').style.width = Math.min(100, match.pigment[1]) + '%';
    $p('paintIncome').textContent = '+' + (match.income[1] || 0).toFixed(1).replace('.',',') + ' / s';
    $p('paintUnits').textContent = '■ ' + match.getUnitCount(1) + ' / ' + (config().unitLimit ?? 24);
    $p('paintBrush').setAttribute('aria-pressed', String(mode === 'brush'));
    $p('paintNavigate').setAttribute('aria-pressed', String(mode === 'navigate'));
    $p('paintZoomOut').disabled = camera.zoom <= 1.001;
    $p('paintZoomIn').disabled = camera.zoom >= 2.999;
    $p('paintPause').textContent = paused ? '▶' : 'Ⅱ';
    $p('paintPause').setAttribute('aria-label', paused ? 'Reprendre le combat' : 'Mettre le combat en pause');
    renderHand(); updateContext();
  }
  function draw() {
    if (!active || !match) return;
    window.CQPaintRenderer?.draw(context, match, view, {palette:window.CQPalette?.current, mode, selectedCard, selectedProducer, preview, previewPoint, target:previewPoint, stroke, flowDrag, effects:[], reducedMotion:reducedMotion.matches}, match.time);
  }
  function processEvents() {
    for (const event of match.events || []) {
      if (event.id <= seenEvent) continue;
      seenEvent = event.id;
      if (event.type === 'acceleration') toast('Dernière minute : le pigment se recharge 50 % plus vite pour les deux camps.', 4);
    }
  }
  function frame(now) {
    const elapsed = Math.min(.05, Math.max(0, (now - lastFrame) / 1000 || 0)); lastFrame = now;
    if (active && match) {
      if (!paused && match.winner == null) {
        window.CQPaintAI?.update(match, elapsed); match.update(elapsed); processEvents();
      }
      if (match.winner != null && !resultShown) finish();
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
    openDialog('help', '<div class="paint-dialog-eyebrow">COLORQUEST · TROIS GESTES</div><h2 id="paintDialogTitle">Votre couleur prend vie.</h2><ol class="paint-help-steps"><li><b>Tracez.</b> Le pinceau peint le blanc visible depuis votre réseau. Chaque case coûte ' + (config().brushCost ?? 1) + ' pigment. Validez avant de dépenser.</li><li><b>Déployez.</b> Glissez une carte sur la toile, ou touchez la carte puis son emplacement. La caserne crée des renforts à ' + (config().unitCost ?? 6) + ' pigments chacun.</li><li><b>Guidez.</b> Glissez d’une caserne vers sa destination. Toucher suspend sa production ; maintenir le doigt rappelle ses renforts.</li></ol><details class="paint-help-details"><summary>Victoire, réseau et caméra</summary><p>Reliez toujours votre territoire au Cœur. Une caserne isolée ne produit plus. Les unités et pouvoirs reprennent les couleurs ennemies ; le pinceau peint seulement le blanc.</p><p>Gagnez en détruisant le Cœur adverse, ou en gardant au moins 50 % de la toile et une avance pendant 15 secondes. À 4 minutes, le plus grand territoire connecté gagne ; à égalité, la partie est nulle. La dernière minute accélère le pigment des deux camps.</p><p>Choisissez Vue pour déplacer la carte. Pincez ou utilisez + / − pour zoomer. Une visée réserve le pigment : vos casernes attendent pendant ce geste.</p></details><p id="paintSessionNotice" class="paint-session-note">' + sessionNotice + '</p><button id="paintBegin" class="paint-main-action paint-full-action">À moi de peindre →</button>');
    $p('paintBegin').onclick = () => { closeDialog(); paused = false; lastFrame = performance.now(); updateHUD(true); announceState(); };
  }
  function pause(value = !paused) {
    if (!match || match.winner != null || !active) return;
    paused = !!value; cancel(); lastFrame = performance.now();
    if (paused) {
      openDialog('pause', '<div class="paint-dialog-eyebrow">LA TOILE VOUS ATTEND</div><h2 id="paintDialogTitle">Combat en pause.</h2><p id="paintSessionNotice" class="paint-session-note">' + sessionNotice + '</p><button id="paintContinue" class="paint-main-action paint-full-action">▶ Reprendre</button><div class="paint-dialog-buttons"><button id="paintPauseHelp">Revoir les gestes</button><button id="paintPauseSound">♫ Activer / couper le son</button>' + (navigator.vibrate ? '<button id="paintHaptics" aria-pressed="' + vibration + '">Vibrations : ' + (vibration ? 'oui' : 'non') + '</button>' : '') + '</div><button id="paintPauseMenu" class="paint-full-action">Retour au menu</button>');
      $p('paintContinue').onclick = () => pause(false);
      $p('paintPauseHelp').onclick = () => { hintsDismissed = false; help(); };
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
    $p('paintResume').hidden = !match || match.winner != null; window.scrollTo(0,0); announceState();
  }
  function activate() {
    // Use the classic mode's existing lifecycle; never replace its game,
    // selection, state variables, campaign progress or local-storage slots.
    if (typeof window.returnToMenu === 'function') { window.CQSave?.save?.(); window.returnToMenu(); }
    active = true; screen.hidden = false; document.body.classList.add('paint-mode');
    $p('menu')?.classList.add('hidden'); $p('game')?.classList.add('hidden');
    window.scrollTo(0,0); lastFrame = performance.now(); resize(); announceState();
  }
  function start(options = {}) {
    if (!window.CQPaintEngine?.Game) return false;
    if (options.resume && match && match.winner == null) { activate(); pause(true); return true; }
    if (match && match.winner == null && !options.replace) {
      activate(); paused = true; cancel();
      openDialog('replace', '<div class="paint-dialog-eyebrow">UN COMBAT EST EN PAUSE</div><h2 id="paintDialogTitle">Une nouvelle toile ?</h2><p>Vous pouvez reprendre le combat en cours. Une nouvelle toile le remplacera.</p><button id="paintKeepMatch" class="paint-main-action paint-full-action">Reprendre ce combat</button><button id="paintReplaceMatch" class="paint-full-action">Commencer une nouvelle toile</button><button id="paintReplaceMenu" class="paint-full-action">Retour au menu</button>');
      $p('paintKeepMatch').onclick = () => pause(false); $p('paintReplaceMatch').onclick = () => start({...options,replace:true}); $p('paintReplaceMenu').onclick = showMenu;
      return false;
    }
    match = new window.CQPaintEngine.Game({seed:Number.isFinite(options.seed) ? options.seed : Math.floor(Math.random() * 1e8),duration:240});
    window.CQPaintAI?.reset?.(match);
    paused = options.tutorial !== false; resultShown = false; lesson = 0; hintsDismissed = false; selectedProducer = null; handSignature = ''; lastHUD = -1; seenEvent = 0;
    camera = {zoom:1, cx:match.width / 2, cy:match.height / 2}; cancel(); closeDialog(); activate(); updateHUD(true); playSound('jingles_PIZZI00');
    if (options.tutorial !== false) help(); else { paused = false; announceState(); }
    return true;
  }
  function finish() {
    if (resultShown) return; resultShown = true; paused = true; cancel();
    const title = match.winner === 1 ? 'La toile porte votre couleur.' : match.winner === 2 ? 'Une autre couleur s’impose.' : 'Une toile partagée.';
    let reason = ({core:'Le Cœur adverse a été effacé.',domination:'La domination a été tenue pendant 15 secondes.',time:'Le temps est écoulé : le territoire connecté départage les camps.',draw:'Les deux camps terminent à égalité.'}[match.winReason]) || match.winReason || 'Le combat est terminé.';
    if (match.winner === 2 && /Cœur adverse/.test(reason)) reason = 'Votre Cœur a été effacé.';
    const seconds = Math.floor(match.time), duration = Math.floor(seconds / 60) + ' min ' + String(seconds % 60).padStart(2,'0') + ' s';
    openDialog('result','<div class="paint-result-symbol" aria-hidden="true">' + (match.winner === 1 ? '◈' : match.winner === 2 ? '◆' : '◌') + '</div><div class="paint-dialog-eyebrow">COMBAT TERMINÉ</div><h2 id="paintDialogTitle">' + title + '</h2><p>' + esc(reason) + '</p><div class="paint-result-stat"><span>Votre territoire connecté</span><strong>' + (match.scores[1] * 100).toFixed(1) + ' %</strong></div><div class="paint-result-stat"><span>Durée</span><strong>' + duration + '</strong></div><button id="paintAgain" class="paint-main-action paint-full-action">Une nouvelle toile →</button><button id="paintEndMenu" class="paint-full-action">Retour au menu</button>');
    $p('paintAgain').onclick = () => start({replace:true,tutorial:false}); $p('paintEndMenu').onclick = showMenu;
    $p('paintResume').hidden = true; playSound(match.winner === 1 ? 'jingles_PIZZI03' : 'error_001'); announceState();
  }

  $p('paintStart').onclick = () => start(); $p('paintResume').onclick = () => start({resume:true});
  $p('paintMenu').onclick = showMenu; $p('paintPause').onclick = () => pause(!paused); $p('paintHelp').onclick = help;
  $p('paintBrush').onclick = () => { setMode('brush'); playSound(); }; $p('paintNavigate').onclick = () => { cancel(); selectedProducer = null; updateHUD(true); };
  bindActionTap($p('paintConfirm'), confirm); bindActionTap($p('paintCancel'), cancel);
  $p('paintHintClose').onclick = () => { hintsDismissed = true; updateHUD(true); };
  $p('paintRecall').onclick = () => recallSelected();
  $p('paintProductionToggle').onclick = () => { if (paused) return; const producer = currentProducer(); if (producer) match.toggleProduction(1, producer.id); updateHUD(true); };
  $p('paintUpgrade').onclick = () => { if (paused) return; const result = match.upgradeCore(1); toast(result.message || (result.ok ? 'Cœur amélioré.' : 'Amélioration impossible.')); if (result.ok) playSound('confirmation_001'); updateHUD(true); };
  $p('paintProducerClose').onclick = () => { selectedProducer = null; updateHUD(true); };
  $p('paintZoomIn').onclick = () => { cancel(); zoomAt(camera.zoom + .5); }; $p('paintZoomOut').onclick = () => { cancel(); zoomAt(camera.zoom - .5); };
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
    if (event.key === 'Escape') { event.preventDefault(); if (mode !== 'navigate' || selectedProducer) { selectedProducer = null; cancel(); } else pause(true); }
    else if (event.key === ' ') { event.preventDefault(); pause(!paused); }
    else if (event.key.toLowerCase() === 'p') setMode('brush');
    else if (event.key.toLowerCase() === 'v') cancel();
  });
  addEventListener('blur', () => { if (active && !paused && match?.winner == null) pause(true); });
  addEventListener('pagehide', () => { if (active && !paused && match?.winner == null) pause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active && !paused && match?.winner == null) pause(true); });
  addEventListener('resize', resize); new ResizeObserver(resize).observe($p('paintCanvasWrap'));
  document.addEventListener('cq:palettechange', draw);
  window.CQPaint = Object.freeze({start,showMenu,pause,resize,help,cancel,confirm,setMode,updateHUD,draw,
    get active(){return active;},get paused(){return paused;},get game(){return match;},get hasMatch(){return !!match && match.winner == null;},
    get view(){return {...view};},get zoom(){return camera.zoom;},get mode(){return mode;},get preview(){return preview;},get tutorialStep(){return lesson;},get selectedProducer(){return selectedProducer;}});
  requestAnimationFrame(frame);
})();
