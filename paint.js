/* Colorquest painting controls. Classic saves and the three-fight course are independent. */
(() => {
  'use strict';
  const $p = id => document.getElementById(id);
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const practiceNotice = 'Ce combat reste dans cette fenêtre. Fermer ou recharger la page le termine. Les sauvegardes du mode classique sont conservées.';
  let match = null, active = false, paused = true, resultShown = false;
  let course = null, storedCourse = null, courseSaveError = '', invalidCourseSave = false, savedAt = 0, lastCourseSaveAt = 0;
  let lastCourseRaw = null, courseStorageConflict = false;
  let mode = 'navigate', selectedCard = null, selectedProducer = null, selectedSource = null, preview = null, previewPoint = null, stroke = [], flowDrag = null;
  let brushLocked = false, lastBrushTap = -Infinity, tutorial = null, tutorialView = null, tutorialCameraPhase = '';
  let camera = {zoom:1, cx:9.5, cy:13.5}, view = {x:0,y:0,w:1,h:1,cell:1};
  let lastFrame = 0, lastHUD = -1, handSignature = '', toastUntil = 0, vibration = false;
  let gesture = null, pinch = null, suppressGesture = false, dialogKind = '', lastFocus = null, seenEvent = 0;
  const pointers = new Map();
  let handledTouchAt = -Infinity, suppressTouchClick = false;
  // A touch action can replace its dialog before the browser emits click.
  // Suppress that gesture's compatibility click even if it lands on a newly
  // exposed menu button. A new pointer gesture always starts independently.
  document.addEventListener('pointerdown', () => { suppressTouchClick = false; }, true);
  document.addEventListener('click', event => {
    if (!suppressTouchClick || event.detail === 0 || performance.now() - handledTouchAt > 700) return;
    suppressTouchClick = false;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);

  const menuCard = document.createElement('section');
  menuCard.id = 'paintModeCard'; menuCard.className = 'paint-menu-card';
  menuCard.setAttribute('aria-labelledby', 'paintMenuTitle');
  menuCard.innerHTML = '<div class="paint-menu-eyebrow"><span>NOUVEAU · V0.8</span><span>PORTRAIT · SOLO</span></div><h2 id="paintMenuTitle">Trois toiles.<br>Votre signature.</h2><p>Affrontez trois peintres. Choisissez vos récompenses. Faites évoluer votre façon de jouer.</p><div class="paint-menu-route" aria-hidden="true"><span>1 · ÉLAN</span><i></i><span>2 · DÉTOUR</span><i></i><span>3 · EMPREINTE</span></div><button id="paintCourseStart" class="primary">Commencer ma course <span aria-hidden="true">↗</span></button><p id="paintCourseSaveStatus" class="paint-course-save" role="status">3 combats · sauvegarde automatique sur cet appareil</p><button id="paintCourseNew" class="paint-menu-link" hidden>Nouvelle course</button><div class="paint-menu-practice"><button id="paintStart" class="paint-menu-free">Apprendre à peindre</button><button id="paintFreePlay" class="paint-menu-free">Combat libre · 4 min</button></div><button id="paintResume" class="paint-menu-resume" hidden>↻ Reprendre cette toile <small>En pause dans cette fenêtre</small></button><small class="paint-menu-note">Première visite ? Six petites situations vous apprennent les gestes. Le mode classique reste disponible ci-dessous.</small>';
  (document.getElementById('campaignCard') || document.querySelector('.start-card'))?.before(menuCard);
  document.body.classList.add('paint-menu-ready');

  const screen = document.createElement('section');
  screen.id = 'paintGame'; screen.className = 'paint-game'; screen.hidden = true;
  screen.setAttribute('aria-label', 'Colorquest : combat de peinture');
  screen.innerHTML = `
    <header class="paint-header">
      <div class="paint-topline"><button id="paintMenu" aria-label="Mettre en pause et retourner au menu" title="Menu">‹</button><div class="paint-heading"><strong>COLORQUEST</strong><small id="paintChapter">LA TOILE · PEINTURE</small></div><time id="paintClock">04:00</time><button id="paintHelp" aria-label="Aide du nouveau mode">?</button><button id="paintPause" aria-label="Mettre le combat en pause">Ⅱ</button></div>
      <div class="paint-domination"><span id="paintPlayerShare">● Vous · 0 %</span><span id="paintHold">Domination · > 50 % / 15 s</span><span id="paintEnemyShare">IA · 0 % ▲</span></div>
      <div class="paint-score-track" aria-label="Territoire connecté des deux camps"><i id="paintPlayerBar"></i><b id="paintEnemyBar"></b><em></em></div>
    </header>
    <main id="paintCanvasWrap" class="paint-canvas-wrap">
      <canvas id="paintCanvas" tabindex="0" aria-label="Toile interactive. En mode Vue, glissez pour déplacer la carte et pincez pour zoomer. En mode Pinceau, tracez depuis votre couleur. Relâchez pour peindre. Glissez une carte puis relâchez, ou touchez une carte puis son emplacement."></canvas>
      <div id="paintCourseStatus" class="paint-course-status" role="status" hidden></div>
      <div id="paintMixtureHint" class="paint-mixture-hint" hidden></div>
      <div class="paint-zoom"><button id="paintZoomOut" aria-label="Dézoomer">−</button><button id="paintZoomIn" aria-label="Zoomer">+</button></div>
      <div id="paintToast" class="paint-toast" role="status" aria-live="polite" hidden></div>
      <div id="paintTutorial" class="paint-tutorial" hidden role="region" aria-label="Votre objectif d’apprentissage">
        <div class="paint-tutorial-heading"><small id="paintTutorialStep"></small><strong id="paintTutorialTitle"></strong></div><p id="paintTutorialHint"></p><p id="paintTutorialNotice" role="status" aria-live="polite" hidden></p>
        <div class="paint-tutorial-actions"><button id="paintTutorialNext" class="paint-main-action" hidden>Continuer →</button><button id="paintTutorialRetry" hidden>Réessayer</button><button id="paintTutorialSkip">Combat libre</button></div>
      </div>
      <div id="paintContext" class="paint-context" hidden>
        <div class="paint-context-copy"><strong id="paintContextTitle"></strong><span id="paintContextMessage"></span></div>
        <div id="paintAimActions" class="paint-context-actions paint-aim-actions" hidden><button id="paintCancel" aria-label="Annuler le geste et revenir à la vue">×</button></div>
        <div id="paintProducerActions" class="paint-context-actions" hidden><button id="paintProductionToggle">Pause</button><button id="paintRecall">Rappeler</button><button id="paintMortarTarget" hidden>Viser une cible</button><button id="paintMortarClear" hidden>Arrêter le tir</button><button id="paintUpgrade" hidden>Améliorer</button><button id="paintProducerClose" aria-label="Fermer les commandes du bâtiment">×</button></div>
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

  function announceState() { document.dispatchEvent(new CustomEvent('cq:paintstate', {detail:{active, paused, hasMatch:!!match && (!!tutorial || match.winner == null),course:!!course,saveError:courseSaveError}})); }
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
      if (event.pointerType === 'touch') { touchEndedAt = performance.now(); handledTouchAt = touchEndedAt; suppressTouchClick = true; }
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
  function cardFor(id) { return match?.getCard?.(1, id) || cards()[id]; }
  function courseModule() { return window.CQPaintCourse; }
  function courseKey() { return courseModule()?.STORAGE_KEY || 'colorquest.paint.course.v1'; }
  function sessionNotice() {
    if (!course) return practiceNotice;
    if (courseSaveError) return courseSaveError + ' Cette progression reste dans cette fenêtre tant que la sauvegarde échoue.';
    return 'Course sauvegardée sur cet appareil. Fermez puis reprenez depuis le menu, sans temps écoulé pendant votre absence. Le combat reprend en pause.';
  }
  function coursePhaseLabel(run) {
    if (!run) return '';
    const phase = {briefing:'Prête à commencer',combat:'Combat en cours',reward:'Récompense à choisir',won:'Course remportée',lost:'Course terminée',draw:'Combat à rejouer'}[run.phase] || 'Course';
    return phase + ' · ' + (run.encounterIndex + 1) + ' / 3';
  }
  function updateCourseMenu() {
    const saved = storedCourse;
    $p('paintCourseStart').textContent = saved ? (['won','lost'].includes(saved.phase) ? 'Voir ma dernière course →' : 'Reprendre ma course →') : invalidCourseSave ? 'Sauvegarde à vérifier' : 'Commencer ma course ↗';
    $p('paintCourseNew').hidden = !saved && !invalidCourseSave;
    $p('paintCourseSaveStatus').textContent = courseSaveError || (saved ? coursePhaseLabel(saved) + (savedAt ? ' · sauvegardée sur cet appareil' : '') : '3 combats · sauvegarde automatique sur cet appareil');
    $p('paintCourseSaveStatus').classList.toggle('paint-save-error', !!courseSaveError);
    $p('paintResume').hidden = !!course || !match || (!tutorial && match.winner != null);
  }
  function loadCourseSlot() {
    let raw;
    try { raw = localStorage.getItem(courseKey()); }
    catch (_) { courseSaveError = 'Stockage local inaccessible. La course ne pourra pas être sauvegardée.'; updateCourseMenu(); return false; }
    lastCourseRaw = raw; courseStorageConflict = false;
    if (raw === null) { storedCourse = null; invalidCourseSave = false; courseSaveError = ''; savedAt = 0; updateCourseMenu(); return true; }
    try {
      storedCourse = courseModule().restore(raw); invalidCourseSave = false; courseSaveError = ''; savedAt = Date.now();
    } catch (_) {
      storedCourse = null; invalidCourseSave = true; courseSaveError = 'Sauvegarde illisible ou incompatible. Elle est conservée : seule « Nouvelle course » peut la remplacer.'; savedAt = 0;
    }
    updateCourseMenu(); return !invalidCourseSave;
  }
  function saveCourse() {
    if (!course) return {ok:true,skipped:true};
    if (courseStorageConflict || invalidCourseSave) return {ok:false,message:courseSaveError || 'La sauvegarde existante doit être relue avant de continuer.'};
    if (course.game === match && match) course.view = {camera:{...camera},selectedProducer};
    try {
      const current = localStorage.getItem(courseKey());
      if (current !== lastCourseRaw) {
        courseStorageConflict = true; courseSaveError = 'La course a changé dans une autre fenêtre. Reprenez la sauvegarde récente avant de continuer.';
        paused = true; cancel(); updateCourseMenu(); announceState();
        return {ok:false,message:courseSaveError};
      }
      const raw = typeof course.serialize === 'function' ? course.serialize() : courseModule().serialize(course);
      localStorage.setItem(courseKey(), raw);
      lastCourseRaw = raw; storedCourse = course; savedAt = Date.now(); courseSaveError = ''; lastCourseSaveAt = performance.now(); updateCourseMenu();
      return {ok:true};
    } catch (_) {
      courseSaveError = 'Sauvegarde impossible sur cet appareil (stockage plein ou bloqué). Gardez cette fenêtre ouverte.';
      storedCourse = course; lastCourseSaveAt = performance.now(); updateCourseMenu();
      return {ok:false,message:courseSaveError};
    }
  }
  function courseRoute() {
    const entries = courseModule()?.ENCOUNTERS || [];
    return '<ol class="paint-course-route" aria-label="Votre parcours de trois combats">' + entries.map((entry, index) => '<li class="' + (index < course.encounterIndex || course.phase === 'won' ? 'is-done' : index === course.encounterIndex ? 'is-current' : '') + '"><span>' + (index < course.encounterIndex || course.phase === 'won' ? '✓' : index + 1) + '</span><strong>' + esc(entry.name || entry.title || 'Toile ' + (index + 1)) + '</strong></li>').join('') + '</ol>';
  }
  function courseBonuses(data) {
    return data.chosenRewards?.length ? '<details class="paint-course-bonuses"><summary>Votre signature · ' + data.chosenRewards.length + ' récompense' + (data.chosenRewards.length > 1 ? 's' : '') + '</summary>' + data.chosenRewards.map(reward => '<div><strong>' + esc(reward.icon || '✧') + ' ' + esc(reward.name) + '</strong><p>' + esc(reward.description) + '</p></div>').join('') + '</details>' : '';
  }
  function courseResult() {
    const game = course?.game; if (!game || game.winner == null) return '';
    const won = game.winner === 1;
    const reason = ({core:won ? 'Cœur adverse effacé' : 'Votre Cœur a été effacé',domination:won ? 'Domination tenue pendant 15 s' : 'Domination adverse tenue pendant 15 s',time:'Le territoire connecté au terme du combat départage les camps',overtime:'Le territoire connecté après prolongation départage les camps',draw:'Égalité après la prolongation'})[game.winReason] || game.winReason || 'Combat terminé';
    const seconds = Math.floor(game.time), duration = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2,'0');
    return '<div class="paint-course-result"><strong>' + esc(reason) + '</strong><span>Vous ' + (game.scores[1] * 100).toFixed(1).replace('.',',') + ' % · Adversaire ' + (game.scores[2] * 100).toFixed(1).replace('.',',') + ' % · ' + duration + '</span></div>';
  }
  function showCoursePanel() {
    if (!course) return;
    paused = true; cancel(); resultShown = course.phase !== 'combat';
    const data = course.presentation(), encounter = data.encounter || {}, phase = course.phase;
    screen.classList.add('paint-course-lobby');
    let title = encounter.name || 'La première course', description = encounter.description || '', action = '';
    if (phase === 'reward') {
      title = 'Une victoire, un choix.'; description = 'Choisissez une récompense. Elle vous accompagne jusqu’à la fin de cette course.';
      action = '<div class="paint-course-rewards" role="group" aria-label="Choisissez une récompense">' + data.offers.map(reward => '<button data-course-reward="' + esc(reward.id) + '" class="paint-course-reward"><span aria-hidden="true">' + esc(reward.icon || (reward.type === 'card' ? '▣' : '✧')) + '</span><div><small>' + esc(({card:'NOUVELLE CARTE',varnish:'VERNIS · BONUS PASSIF',upgrade:'AMÉLIORATION'})[reward.type] || 'POUR CETTE COURSE') + '</small><strong>' + esc(reward.name) + '</strong><p>' + esc(reward.description) + '</p></div><b aria-hidden="true">+</b></button>').join('') + '</div>';
    } else if (phase === 'briefing') {
      const mixture = course.encounterIndex > 0 ? '<div class="paint-course-mixture"><span aria-hidden="true">▥ BLEU + ⠿ JAUNE = ✚</span><p>Jouez ces deux couleurs de carte à 2 cases au maximum, en 4 s : vos unités proches récupèrent 12 points de vie. Les cartes gardent leur effet habituel.</p></div>' : '';
      action = '<div class="paint-course-opponent"><b>' + esc(encounter.opponent || 'Votre adversaire') + '</b><small>' + esc(({rapid:'Expansion rapide',builder:'Défenses installées',eraser:'Coupures et bombardements'})[encounter.profile] || 'Un nouveau duel') + '</small></div>' + (course.encounterIndex === 1 ? '' : '<p class="paint-course-tip"><b>Votre piste :</b> ' + esc(encounter.tip || 'Reliez les sources et protégez votre réseau.') + '</p>') + mixture + '<button id="paintCourseFight" class="paint-main-action paint-full-action">Peindre cette toile →</button>';
    } else if (phase === 'draw') {
      title = 'Cette toile reste partagée.'; description = 'Les territoires sont encore égaux après la prolongation. Rejouez ce combat avec vos récompenses actuelles.';
      action = '<button id="paintCourseRetry" class="paint-main-action paint-full-action">Rejouer ce combat →</button>';
    } else {
      const won = phase === 'won'; title = won ? 'Votre signature est complète.' : 'Une autre couleur s’impose.';
      description = won ? 'Trois toiles, trois victoires. Votre choix de récompenses a dessiné cette course.' : course.encounterIndex > 0 ? 'La course s’arrête ici. Essayez un autre choix de récompenses et une nouvelle façon de construire votre réseau.' : 'La première toile vous a résisté. Reliez une source, posez votre caserne et protégez les traits qui la relient au Cœur.';
      action = '<div class="paint-result-stat"><span>Combats remportés</span><strong>' + (data.wins ?? (won ? 3 : course.encounterIndex)) + ' / 3</strong></div><button id="paintCourseAgain" class="paint-main-action paint-full-action">Une nouvelle course →</button>';
    }
    openDialog('course-' + phase, '<div class="paint-dialog-eyebrow">LA PREMIÈRE COURSE · TOILE ' + (course.encounterIndex + 1) + ' / 3</div>' + courseRoute() + '<h2 id="paintDialogTitle">' + esc(title) + '</h2><p class="paint-course-description">' + esc(description) + '</p>' + (phase !== 'briefing' ? courseResult() : '') + action + courseBonuses(data) + '<p class="paint-session-note" id="paintSessionNotice">' + esc(sessionNotice()) + '</p><button id="paintCourseMenu" class="paint-full-action paint-course-back">Retour au menu</button>');
    if ($p('paintCourseFight')) bindActionTap($p('paintCourseFight'), beginCourseFight);
    if ($p('paintCourseRetry')) bindActionTap($p('paintCourseRetry'), beginCourseFight);
    if ($p('paintCourseAgain')) bindActionTap($p('paintCourseAgain'), () => startCourse());
    $p('paintDialogContent').querySelectorAll('[data-course-reward]').forEach(button => bindActionTap(button, () => chooseCourseReward(button.dataset.courseReward)));
    bindActionTap($p('paintCourseMenu'), showMenu); announceState();
  }
  function syncCourseMatch(restoring = false) {
    match = course.game; tutorial = null; tutorialView = null; tutorialCameraPhase = ''; resultShown = false; handSignature = ''; lastHUD = -1;
    selectedProducer = restoring ? course.view?.selectedProducer ?? null : null; selectedSource = null;
    seenEvent = match?.events?.reduce((id,event) => Math.max(id,event.id || 0),0) || 0;
    screen.querySelectorAll('.paint-payment').forEach(node => node.remove()); $p('paintToast').hidden = true;
    camera = restoring && course.view?.camera ? {...course.view.camera} : {zoom:1,cx:(match?.width || 19) / 2,cy:(match?.height || 27) / 2};
    cancel(); screen.classList.remove('paint-course-lobby'); resize(); updateHUD(true);
  }
  function beginCourseFight() {
    if (!course || courseStorageConflict || !['briefing','draw'].includes(course.phase)) return;
    try { course.startFight(); } catch (error) { toast(error.message || 'Ce combat ne peut pas commencer.'); return; }
    syncCourseMatch(); closeDialog(); paused = false; lastFrame = performance.now(); saveCourse(); announceState(); playSound('jingles_PIZZI00');
  }
  function chooseCourseReward(id) {
    if (!course || course.phase !== 'reward' || courseStorageConflict) return false;
    const result = course.chooseReward(id);
    if (!result?.ok) { toast(result?.message || 'Cette récompense a déjà été choisie.'); return false; }
    saveCourse(); showCoursePanel(); playSound('confirmation_001'); return true;
  }
  function startCourse(options = {}) {
    if (!courseModule()) return false;
    if (!options.replace && (storedCourse || invalidCourseSave || lastCourseRaw !== null)) {
      paused = true; if (course) saveCourse(); activate(); screen.classList.add('paint-course-lobby');
      openDialog('course-replace', '<div class="paint-dialog-eyebrow">UN NOUVEAU DÉPART</div><h2 id="paintDialogTitle">Recommencer la course ?</h2><p>' + (invalidCourseSave ? 'La sauvegarde illisible sera remplacée définitivement.' : 'Votre course enregistrée et ses récompenses seront remplacées. Vous pouvez encore la reprendre.') + '</p><button id="paintCourseKeep" class="paint-main-action paint-full-action">' + (invalidCourseSave ? 'Conserver la sauvegarde' : 'Reprendre ma course') + '</button><button id="paintCourseConfirmNew" class="paint-full-action">Remplacer par une nouvelle course</button>');
      bindActionTap($p('paintCourseKeep'), () => invalidCourseSave ? showMenu() : resumeCourse());
      bindActionTap($p('paintCourseConfirmNew'), () => startCourse({...options,replace:true})); return false;
    }
    try { lastCourseRaw = localStorage.getItem(courseKey()); } catch (_) { /* Save reports the unavailable storage below. */ }
    invalidCourseSave = false; courseStorageConflict = false;
    course = courseModule().create(Number.isFinite(options.seed) ? {seed:options.seed} : {}); storedCourse = course;
    tutorial = null; tutorialView = null; match = null; savedAt = 0; selectedProducer = null; selectedSource = null;
    paused = true; cancel(); activate(); saveCourse(); showCoursePanel(); return true;
  }
  function resumeCourse() {
    try { if (localStorage.getItem(courseKey()) !== lastCourseRaw) courseStorageConflict = true; } catch (_) { /* Keep an unsaved in-memory course available. */ }
    if (courseStorageConflict) { course = null; match = null; tutorial = null; tutorialView = null; loadCourseSlot(); }
    if (!storedCourse) {
      if (invalidCourseSave) {
        activate(); screen.classList.add('paint-course-lobby');
        openDialog('course-invalid', '<div class="paint-dialog-eyebrow">SAUVEGARDE CONSERVÉE</div><h2 id="paintDialogTitle">Cette course ne peut pas être lue.</h2><p>' + esc(courseSaveError) + '</p><button id="paintCourseInvalidNew" class="paint-main-action paint-full-action">Nouvelle course</button><button id="paintCourseMenu" class="paint-full-action">Retour au menu</button>');
        bindActionTap($p('paintCourseInvalidNew'), () => startCourse()); bindActionTap($p('paintCourseMenu'), showMenu); return false;
      }
      return startCourse();
    }
    if (course && course !== storedCourse) saveCourse();
    course = storedCourse; tutorial = null; tutorialView = null; paused = true;
    syncCourseMatch(true); activate();
    if (course.phase === 'combat') pause(true); else showCoursePanel();
    return true;
  }
  function showCourseConflict() {
    if (!course || !courseStorageConflict) return;
    paused = true; cancel();
    openDialog('course-conflict', '<div class="paint-dialog-eyebrow">COURSE OUVERTE AILLEURS</div><h2 id="paintDialogTitle">Une sauvegarde plus récente.</h2><p>' + esc(courseSaveError) + '</p><button id="paintCourseReload" class="paint-main-action paint-full-action">Relire la sauvegarde récente</button><button id="paintCourseMenu" class="paint-full-action">Retour au menu</button>');
    bindActionTap($p('paintCourseReload'), resumeCourse); bindActionTap($p('paintCourseMenu'), showMenu); announceState();
  }
  function currentBuilding() { return match?.buildings.find(b => b.id === selectedProducer && b.hp > 0 && (b.team === 1 || match.isVisible(1,b.x,b.y))) || null; }
  function currentProducer() { const building = currentBuilding(); return building?.team === 1 && ['core','barracks'].includes(building.type) ? building : null; }
  function currentMortar() { const building = currentBuilding(); return building?.team === 1 && building.type === 'mortar' ? building : null; }
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
    if (next === 'mortar' && !currentMortar()) return false;
    clearGesture(); mode = ['brush','card','mortar'].includes(next) ? next : 'navigate';
    brushLocked = false;
    selectedCard = mode === 'card' ? index : null; if (mode !== 'mortar') selectedProducer = null; selectedSource = null; stroke = []; preview = null; previewPoint = null;
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
  function aimMortar(point) {
    const mortar = currentMortar(); if (!mortar) return;
    previewPoint = point; preview = match.previewMortarTarget?.(1, mortar.id, point.x, point.y) || {ok:false,message:'Cible indisponible.'}; updateHUD(true);
  }
  function confirmMortar() {
    const mortar = currentMortar(); if (!mortar || paused || !previewPoint) return false;
    const result = match.setMortarTarget?.(1, mortar.id, previewPoint.x, previewPoint.y);
    if (result?.ok) { mode = 'navigate'; preview = null; previewPoint = null; clearGesture(); playSound('select_001'); buzz(); }
    toast(result?.message || (result?.ok ? 'Cible fixée : le mortier bombarde cette zone tant qu’elle est visible.' : 'Cible impossible.')); updateHUD(true); return !!result?.ok;
  }
  function finishBrush() {
    const keepBrush = brushLocked;
    clearGesture(); stroke = []; preview = null; previewPoint = null; selectedCard = null; mode = keepBrush ? 'brush' : 'navigate';
    match?.setSpendingHeld(1, false); updateHUD(true);
  }
  function confirm() {
    if (!active || paused || match?.winner != null || tutorialBlocked()) return false;
    if (mode === 'mortar') return confirmMortar();
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
    else if (mode === 'card') toast((cardFor(result.cardId || payload.cardId)?.name || 'Carte') + ' · −' + result.cost + ' pigments', 1.8);
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
    if (mode === 'mortar') { aimMortar(tilePoint(p)); gesture = {id:event.pointerId, kind:'mortarAim', start:p, last:p, moved:false}; return; }
    const object = pickObject(p), producer = object?.building?.team === 1 && ['core','barracks'].includes(object.building.type) ? object.building : null;
    const mortar = object?.building?.team === 1 && object.building.type === 'mortar' ? object.building : null;
    gesture = {id:event.pointerId, kind:producer ? 'producer' : mortar ? 'mortarDrag' : 'pan', producerId:producer?.id || mortar?.id, object, start:p, last:p, moved:false, leftHome:false, cx:camera.cx, cy:camera.cy};
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
    if (gesture.kind === 'mortarAim' || gesture.kind === 'mortarDrag' && gesture.moved) { mode = 'mortar'; if (inside(p)) aimMortar(tilePoint(p)); else { preview = null; previewPoint = null; updateHUD(true); } return; }
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
    } else if (finished.kind === 'mortarAim' || finished.kind === 'mortarDrag') {
      if ((finished.moved || finished.kind === 'mortarAim') && inside(p)) { aimMortar(tilePoint(p)); confirmMortar(); }
      else if (finished.moved) { cancel(); toast('Visée annulée.'); }
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
    const hand = match.hands[1] || [], signature = hand.map(id => id + ':' + cardFor(id)?.cost).join('|') + ':' + !!match.mixtures;
    if (signature !== handSignature) {
      handSignature = signature;
      $p('paintHand').innerHTML = hand.map((id, index) => {
        const card = cardFor(id);
        const accent = ({blue:'#5686c7',red:'#d66d65',yellow:'#b99437'})[card.color] || card.color || '#628889';
        const color = ({blue:'▥ Bleu',yellow:'⠿ Jaune',red:'≋ Rouge'})[card.color] || '';
        return '<button type="button" data-paint-card="' + index + '" aria-pressed="false" aria-label="' + esc(card.name + ', ' + card.cost + ' pigments. ' + card.description + (match.mixtures ? ' Carte ' + color + '.' : '')) + '"><span class="paint-card-symbol" aria-hidden="true" style="--card-accent:' + esc(accent) + '">' + esc(card.icon) + '</span><strong>' + esc(card.name) + '</strong><small>◉ ' + card.cost + '</small>' + (match.mixtures ? '<span class="paint-card-color" style="--card-accent:' + esc(accent) + '">' + esc(color) + '</span>' : '') + '</button>';
      }).join('');
      // Pointer handlers also support dragging. Keyboard activation uses the
      // same aiming mode; the target tap plays immediately.
      $p('paintHand').querySelectorAll('button').forEach(button => button.addEventListener('click', event => { if (event.detail === 0) setMode('card', Number(button.dataset.paintCard)); }));
    }
    for (const button of $p('paintHand').querySelectorAll('button')) {
      const index = Number(button.dataset.paintCard), card = cardFor(hand[index]);
      button.setAttribute('aria-pressed', String(mode === 'card' && selectedCard === index));
      button.classList.toggle('paint-unaffordable', match.pigment[1] < card.cost);
      button.hidden = !!tutorial && !tutorialView?.allowedCards?.includes(card.id);
      button.disabled = tutorialBlocked();
      button.classList.toggle('paint-tutorial-cue', !!tutorial && !tutorialBlocked() && tutorialView?.gesture === 'card' && tutorialView?.cardId === card.id);
    }
    $p('paintHand').hidden = !!tutorial && !(tutorialView?.allowedCards?.length);
    $p('paintNext').hidden = !!tutorial;
    const next = cardFor(match.decks[1]?.[0]);
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
    const aiming = mode === 'card' || mode === 'mortar' || (mode === 'brush' && stroke.length > 0), building = currentBuilding(), producer = currentProducer();
    const source = selectedSource && match.isVisible(1, selectedSource.x, selectedSource.y) ? match.tile(selectedSource.x, selectedSource.y) : null;
    $p('paintContext').hidden = !aiming && !building && !source;
    $p('paintAimActions').hidden = !aiming;
    $p('paintProducerActions').hidden = aiming || (!building && !source);
    $p('paintContext').classList.toggle('paint-context-aiming', aiming);
    if (aiming) {
      const card = selectedCard == null ? null : cardFor(match.hands[1][selectedCard]);
      $p('paintContextTitle').textContent = mode === 'mortar' ? 'Mortier · choisir la zone bombardée' : (mode === 'brush' ? 'Trait d’encre' : card?.name || 'Carte') + ' · ' + (preview?.cost ?? card?.cost ?? 0) + ' pigments';
      const instruction = gesture ? (mode === 'brush' ? 'Relâchez pour peindre. Revenez au départ pour annuler.' : 'Relâchez sur la toile pour jouer.') : 'Touchez un emplacement. × pour annuler.';
      $p('paintContextMessage').textContent = (preview?.message || card?.description || (mode === 'mortar' ? 'Choisissez une case visible entre 2,5 et 7 cases du mortier.' : 'Partez de votre couleur reliée au Cœur.')) + ' ' + instruction;
      $p('paintContext').classList.toggle('paint-invalid', preview?.ok === false || !!preview?.partial);
    } else if (building || source) {
      $p('paintContext').classList.remove('paint-invalid');
      $p('paintProductionToggle').hidden = building?.type !== 'barracks' || building.team !== 1;
      $p('paintRecall').hidden = !producer;
      $p('paintMortarTarget').hidden = building?.type !== 'mortar' || building.team !== 1;
      $p('paintMortarClear').hidden = building?.type !== 'mortar' || building.team !== 1 || !building.mortarTarget;
      $p('paintUpgrade').hidden = building?.type !== 'core' || building.team !== 1 || building.level >= 3 || !!tutorial;
      if (source && !building) {
        const occupied = match.buildings.find(b => b.x === source.x && b.y === source.y && b.hp > 0 && b.type === 'extractor');
        $p('paintContextTitle').textContent = '◈ Source de pigment';
        $p('paintContextMessage').textContent = occupied ? 'Source exploitée · l’anneau signale son extracteur.' : source.owner === 1 && source.connected ? 'Source reliée. Posez un Extracteur ici pour gagner +0,85 pigment/s.' : source.owner === 2 ? 'Source en territoire adverse. Vos unités doivent reprendre sa case.' : 'Reliez-la au Cœur, puis posez un Extracteur. Le losange doré est une ressource.';
      } else if (building.team !== 1) {
        const enemyName = ({core:'Cœur',barracks:'Caserne',relay:'Relais',extractor:'Extracteur',bastion:'Bastion',mortar:'Mortier'})[building.type] || building.type;
        const enemyRole = ({core:'Sa destruction vous fait gagner.',barracks:'Déploie un groupe de combattants.',relay:'Étend le territoire à sa pose.',extractor:'Exploite une source de pigment.',bastion:'Défend les environs.',mortar:'Bombarde une zone distante ; vulnérable à courte portée.'})[building.type] || '';
        $p('paintContextTitle').textContent = enemyName + ' · camp adverse';
        $p('paintContextMessage').textContent = Math.ceil(building.hp) + ' / ' + building.maxHp + ' vie · ' + enemyRole;
      } else {
        const name = ({core:'Cœur',barracks:'Caserne',relay:'Relais',extractor:'Extracteur',bastion:'Bastion',mortar:'Mortier'})[building.type] || building.type;
        const network = building.connected ? 'Relié au Cœur' : 'Réseau coupé';
        const count = producer ? match.units.filter(u => u.hp > 0 && u.team === 1 && u.producerId === building.id).length : 0;
        $p('paintContextTitle').textContent = name + (producer ? ' · ' + count + ' unité' + (count > 1 ? 's' : '') : '') + (building.type === 'core' ? ' · niv. ' + building.level : '');
        const reason = building.productionReason || ({running:'Production active',paused:'Production en pause',isolated:'Réseau coupé',held:'Pigment réservé au geste',funds:'En attente de pigment',full:'Armée au complet',blocked:'Sortie bloquée'}[building.productionState] || '');
        const role = ({core:'Origine du réseau et refuge des unités sans caserne. Glissez pour les guider.',relay:'A étendu le territoire à sa pose. Il ouvre la vue autour de lui.',extractor:'Exploite la source : +0,85 pigment/s quand il est relié (3 bonus maximum).',bastion:'Tire sur les ennemis proches tant qu’il est relié.',mortar:'Portée 2,5–7 cases · 1 tir / 5 s. Glissez vers une zone visible ou touchez « Viser ». ' + (building.mortarTarget ? 'Cible fixée ; les tirs attendent si elle devient invisible.' : 'Aucune cible : le mortier attend.')})[building.type];
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
    screen.classList.toggle('paint-mixing', !!match.mixtures);
    $p('paintChapter').textContent = course ? 'COURSE ' + (course.encounterIndex + 1) + '/3 · ' + (course.presentation().encounter?.name || 'LA TOILE') : 'LA TOILE · PEINTURE';
    $p('paintCourseStatus').hidden = !course || !courseSaveError;
    $p('paintCourseStatus').textContent = courseSaveError;
    const mixture = match.mixtures && match._mixtureLast?.[1], mixtureLeft = mixture ? Math.max(0, (window.CQPaintEngine.MIXTURE?.window || 4) - (match.time - mixture.time)) : 0;
    $p('paintMixtureHint').hidden = !match.mixtures || !!courseSaveError || !!currentBuilding() || !!selectedSource || mode === 'card' || stroke.length > 0;
    $p('paintMixtureHint').textContent = mixtureLeft > 0 ? (mixture.color === 'blue' ? '⠿ JAUNE' : '▥ BLEU') + ' près de la dernière carte · ' + Math.ceil(mixtureLeft) + ' s · ✚ soin' : '▥ BLEU + ⠿ JAUNE proches en 4 s → ✚ soin';
    if (mode === 'card' && previewPoint && selectedCard != null) preview = match.previewCard(1, selectedCard, previewPoint.x, previewPoint.y);
    if (mode === 'brush' && stroke.length) preview = match.previewPaint(1, stroke);
    if (mode === 'mortar' && previewPoint && currentMortar()) preview = match.previewMortarTarget?.(1, selectedProducer, previewPoint.x, previewPoint.y);
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
    $p('paintBrush').setAttribute('aria-label', (brushLocked ? 'Pinceau verrouillé. Toucher pour revenir à la vue.' : 'Pinceau. Double toucher pour le garder actif.') + ' Jusqu’à ' + (match.getBrushLimit?.(1) || config().brushMax || 12) + ' nouvelles cases par trait.');
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
    window.CQPaintRenderer?.draw(context, match, view, {palette:window.CQPalette?.current, mode, selectedCard, selectedProducer, selectedSource, preview, previewPoint, target:previewPoint, stroke, flowDrag, mortarAim:mode === 'mortar' && previewPoint ? {producerId:selectedProducer,...previewPoint,ok:preview?.ok} : null, tutorial:tutorial && !tutorialBlocked() ? tutorialView : null, effects:[], reducedMotion:reducedMotion.matches}, match.time);
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
        else if (course) course.update(elapsed);
        else { window.CQPaintAI?.update(match, elapsed); match.update(elapsed); }
        processEvents();
      }
      if (course && !paused && now - lastCourseSaveAt >= 2500) saveCourse();
      if (course && courseStorageConflict && !dialogKind) showCourseConflict();
      if (course && course.phase !== 'combat' && !resultShown) { resultShown = true; paused = true; cancel(); saveCourse(); showCoursePanel(); playSound(course.phase === 'reward' || course.phase === 'won' ? 'jingles_PIZZI03' : 'error_001'); }
      else if (!course && !tutorial && match.winner != null && !resultShown) finish();
      if (!$p('paintToast').hidden && now > toastUntil) $p('paintToast').hidden = true;
      updateHUD(); draw();
    }
    requestAnimationFrame(frame);
  }

  function closeDialog() { $p('paintDialog').hidden = true; dialogKind = ''; screen.classList.remove('paint-course-lobby'); $p('paintDialogContent').classList.remove('paint-course-content'); updateHUD(true); }
  function openDialog(kind, markup) {
    lastFocus = document.activeElement; dialogKind = kind; $p('paintDialogContent').innerHTML = markup; $p('paintDialog').hidden = false;
    $p('paintDialogContent').classList.toggle('paint-course-content', kind.startsWith('course-'));
    updateHUD(true); $p('paintDialogContent').focus();
  }
  function help() {
    if (!active || !match) return;
    paused = true; cancel(); saveCourse(); announceState();
    openDialog('help', '<div class="paint-dialog-eyebrow">PEINDRE · DÉPLOYER · GUIDER</div><h2 id="paintDialogTitle">Une couleur, un réseau.</h2><ol class="paint-help-steps"><li><b>Peignez le blanc.</b> Touchez Pinceau, tracez depuis votre territoire relié, puis relâchez. Seule la portion valide est payée. Revenez au départ pour annuler. Double touchez le bouton pour garder le pinceau.</li><li><b>Jouez une carte.</b> Glissez-la sur un emplacement valide puis relâchez, ou touchez la carte puis sa cible. Ramenez-la dans la main pour annuler.</li><li><b>Guidez l’armée.</b> Glissez de la caserne vers une cible. Pour rappeler, glissez à l’extérieur puis revenez sur elle. Toucher un bâtiment montre sa fiche ; Pause arrête explicitement la production.</li></ol><details class="paint-help-details"><summary>Pigment, réseau et victoire</summary><p>Une caserne paie ' + (config().unitCost ?? 6) + ' pigments à chaque sortie, toutes les ' + (config().unitInterval ?? 5) + ' s. La jauge indique le revenu et la dépense prévue. Vos casernes attendent pendant le tracé ou la visée d’une carte, hors réseau, sans pigment ou au plafond d’unités.</p><p>Le pinceau ne traverse pas la couleur ennemie : l’armée la conquiert. Contournez une coupure par du terrain blanc pour reconnecter les hachures. Relier une source permet d’y poser un extracteur ; lui seul fournit le bonus de la source.</p><p>Détruisez le Cœur adverse ou gardez plus de 50 % de la toile, avec une avance, pendant 15 s. À 4 minutes, le plus grand territoire relié gagne. Égalité : 30 s de prolongation, puis comparaison des territoires ; nul seulement s’ils restent égaux. Le pigment accélère pendant la dernière minute et la prolongation.</p><p>Vue permet de déplacer la carte. Deux doigts, ou + / −, règlent le zoom. La retraite ne riposte pas en chemin ; les unités défendent à leur arrivée.</p>' + (course ? '<p><b>Mortier :</b> posez-le sur votre réseau, puis glissez vers une cible visible à 2,5–7 cases, ou utilisez « Viser une cible ». Il bombarde toutes les 5 s sans nouveau coût en pigment. Trop près, il ne peut pas vous défendre.</p>' : '') + (match.mixtures ? '<p><b>Mélange soin :</b> carte bleue puis jaune, ou jaune puis bleue, à 2 cases au maximum en 4 s : +12 vie aux unités alliées proches. Les icônes ▥ et ⠿ identifient les cartes. Le terrain garde la couleur du camp.</p>' : '') + '</details><p id="paintSessionNotice" class="paint-session-note">' + esc(sessionNotice()) + '</p><button id="paintBegin" class="paint-main-action paint-full-action">Reprendre →</button>');
    bindActionTap($p('paintBegin'), () => { if (courseStorageConflict) { showCourseConflict(); return; } closeDialog(); paused = false; lastFrame = performance.now(); updateHUD(true); announceState(); });
  }
  function pause(value = !paused) {
    if (!match || (!tutorial && match.winner != null) || !active) return;
    if (!value && courseStorageConflict) { showCourseConflict(); return; }
    paused = !!value; cancel(); lastFrame = performance.now();
    if (paused) {
      saveCourse();
      openDialog('pause', '<div class="paint-dialog-eyebrow">LA TOILE VOUS ATTEND</div><h2 id="paintDialogTitle">Combat en pause.</h2><p id="paintSessionNotice" class="paint-session-note">' + esc(sessionNotice()) + '</p><button id="paintContinue" class="paint-main-action paint-full-action">▶ Reprendre</button><div class="paint-dialog-buttons"><button id="paintPauseHelp">Revoir les gestes</button><button id="paintPauseSound">♫ Activer / couper le son</button>' + (navigator.vibrate ? '<button id="paintHaptics" aria-pressed="' + vibration + '">Vibrations : ' + (vibration ? 'oui' : 'non') + '</button>' : '') + '</div><button id="paintPauseMenu" class="paint-full-action">Retour au menu</button>');
      if (course) $p('paintSessionNotice').insertAdjacentHTML('afterend', courseBonuses(course.presentation()));
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
    paused = true; cancel(); saveCourse(); closeDialog(); active = false; screen.hidden = true; document.body.classList.remove('paint-mode');
    $p('menu')?.classList.remove('hidden'); $p('game')?.classList.add('hidden');
    updateCourseMenu(); window.scrollTo(0,0); announceState();
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
    if (options.course) return options.resume ? resumeCourse() : startCourse(options);
    if (course) { saveCourse(); storedCourse = course; course = null; match = null; tutorial = null; tutorialView = null; }
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
    updateCourseMenu(); return true;
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

  $p('paintCourseStart').onclick = resumeCourse; $p('paintCourseNew').onclick = () => startCourse();
  $p('paintStart').onclick = () => start({tutorial:true}); $p('paintFreePlay').onclick = () => start({tutorial:false}); $p('paintResume').onclick = () => start({resume:true});
  bindActionTap($p('paintMenu'), showMenu); bindActionTap($p('paintPause'), () => pause(!paused)); bindActionTap($p('paintHelp'), help);
  bindActionTap($p('paintBrush'), brushButton); bindActionTap($p('paintNavigate'), () => { cancel(); selectedProducer = null; selectedSource = null; updateHUD(true); });
  bindActionTap($p('paintCancel'), cancel);
  bindActionTap($p('paintRecall'), () => recallSelected());
  bindActionTap($p('paintMortarTarget'), () => setMode('mortar'));
  bindActionTap($p('paintMortarClear'), () => { if (paused || !currentMortar()) return; const result = match.setMortarTarget?.(1, selectedProducer, null, null); toast(result?.ok ? 'Tir arrêté. Le mortier attend une nouvelle cible.' : result?.message || 'Action impossible.'); updateHUD(true); });
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
  addEventListener('pagehide', () => { if (active && !paused && (tutorial || match?.winner == null)) pause(true); saveCourse(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (active && !paused && (tutorial || match?.winner == null)) pause(true); saveCourse(); } });
  addEventListener('storage', event => {
    if (event.key !== courseKey() && event.key !== null || event.newValue === lastCourseRaw) return;
    if (!course) { loadCourseSlot(); return; }
    courseStorageConflict = true; courseSaveError = 'La course a changé dans une autre fenêtre. Reprenez la sauvegarde récente avant de continuer.';
    paused = true; cancel(); updateCourseMenu(); if (active) showCourseConflict(); announceState();
  });
  addEventListener('resize', resize); new ResizeObserver(resize).observe($p('paintCanvasWrap'));
  document.addEventListener('cq:palettechange', draw);
  window.CQPaint = Object.freeze({start,startCourse,resumeCourse,showMenu,pause,resize,help,cancel,confirm,setMode,updateHUD,draw,flushSave:saveCourse,
    get active(){return active;},get paused(){return paused;},get game(){return match;},get hasMatch(){return !!match && (!!tutorial || match.winner == null);},
    get course(){return course;},get run(){return course;},get savedCourse(){return storedCourse;},get sessionNotice(){return sessionNotice();},get saveStatus(){return {ok:!courseSaveError,error:courseSaveError,invalid:invalidCourseSave,conflict:courseStorageConflict,savedAt};},
    get view(){return {...view};},get zoom(){return camera.zoom;},get mode(){return mode;},get preview(){return preview;},get tutorialStep(){return tutorialView?.step ?? -1;},get tutorial(){return tutorial;},get brushLocked(){return brushLocked;},get selectedProducer(){return selectedProducer;},get selectedSource(){return selectedSource && {...selectedSource};}});
  if (courseModule()) loadCourseSlot();
  requestAnimationFrame(frame);
})();
