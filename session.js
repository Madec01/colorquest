/* Local match persistence. One slot, atomic writes, no elapsed-time simulation. */
(function () {
  'use strict';
  const KEY = 'colorquest.match.v1';
  const token = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const writer = token();
  let sessionId = null, sessionGame = null, lastSavedTime = -10, lastSavedAt = null;
  let lastError = '', writeBlocked = false, finishing = false;
  let claimPending = false, claimExpected;
  const card = document.createElement('div');
  card.className = 'resume-card';
  card.innerHTML = '<button id="continueGame" class="resume-button" hidden><span>↻ Reprendre la partie</span><small id="resumeDetails"></small></button><p id="saveMenuStatus" class="save-note" role="status"></p>';
  $('play').after(card);
  if ($('startTutorial')) card.after($('startTutorial'));
  const continueButton = $('continueGame'), details = $('resumeDetails'), note = $('saveMenuStatus');
  const clock = seconds => Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + Math.floor(seconds % 60).toString().padStart(2, '0');
  const live = () => playing && game && !ended && game.winner === null && !window.CQTutorial?.active && sessionGame === game;

  function read() {
    let raw;
    try { raw = localStorage.getItem(KEY); }
    catch (_) { return { status: 'unavailable' }; }
    if (!raw) return { status: 'none' };
    try {
      if (raw.length > 2_000_000) throw new Error('size');
      const entry = JSON.parse(raw);
      if (entry.format !== 'colorquest-match' || entry.version !== 1 || typeof entry.id !== 'string' ||
          typeof entry.writer !== 'string' || !Number.isFinite(entry.savedAt) || entry.savedAt < 0) throw new Error('envelope');
      const restored = CQSnapshot.restore(entry.snapshot);
      if (restored.winner !== null || restored.duration !== 720) throw new Error('completed-or-tutorial');
      return { status: 'valid', entry, restored, raw };
    } catch (_) { return { status: 'invalid' }; }
  }

  function refreshMenu() {
    const saved = read();
    continueButton.hidden = saved.status !== 'valid';
    if (saved.status === 'valid') document.querySelector('.card-heading').after(card);
    else $('play').after(card);
    $('play').firstChild.textContent = saved.status === 'none' || saved.status === 'unavailable' ? 'Commencer la partie ' : 'Nouvelle partie ';
    if (saved.status === 'valid') {
      const g = saved.restored;
      details.textContent = (window.CQWorldUI?.label(g.mapId)||'Toile classique') + ' · ' + (g.difficulty === 'easy' ? 'Détente' : 'Stratégie') + ' · ' + clock(g.time) + ' · ' + (g.scores[1] * 100).toFixed(1).replace('.', ',') + ' % du terrain';
      note.textContent = 'Sauvegarde sur cet appareil · reprise en pause';
    } else if (saved.status === 'invalid') {
      note.textContent = 'Sauvegarde illisible ou incompatible. Elle est conservée jusqu’à votre choix de la remplacer.';
    } else if (saved.status === 'unavailable') {
      note.textContent = 'Sauvegarde indisponible dans ce navigateur. Gardez le jeu ouvert pour conserver votre partie.';
    } else {
      note.textContent = 'Sauvegarde automatique toutes les 10 s et à la mise en pause.';
    }
    note.classList.toggle('save-warning', ['invalid', 'unavailable'].includes(saved.status));
    return saved;
  }

  function reportError(message) {
    if (lastError !== message) toast(message);
    lastError = message;
    const status = $('savePauseStatus');
    if (status) { status.textContent = message; status.classList.add('save-warning'); }
  }

  function conflict() {
    writeBlocked = true;
    if (playing && !paused && !ended) togglePause();
    const message = 'Sauvegarde modifiée dans une autre fenêtre. Revenez au menu pour la reprendre.';
    reportError(message);
    return { ok: false, message };
  }

  function save() {
    if (!live()) return { ok: false, skipped: true };
    if (writeBlocked) return { ok: false, message: 'Cette partie a été reprise dans une autre fenêtre. Revenez au menu pour charger sa dernière sauvegarde.' };
    try {
      const snapshot = CQSnapshot.capture(game);
      const entry = {
        format: 'colorquest-match', version: 1, id: sessionId, writer, savedAt: Date.now(), snapshot,
        ui: { camera: window.CQCamera?.capture(), selection: selection.slice(), step }
      };
      const encoded = JSON.stringify(entry);
      // A suspended tab may not have received the storage event yet. Check the
      // current owner immediately before writing, rather than trusting that event.
      const currentRaw = localStorage.getItem(KEY);
      const claiming = claimPending && (currentRaw === claimExpected || currentRaw === null && claimExpected === undefined);
      if (!claiming) {
        let current;
        try { current = currentRaw && JSON.parse(currentRaw); } catch (_) { return conflict(); }
        if (current?.id !== sessionId || current?.writer !== writer) return conflict();
      }
      // setItem is atomic. If the quota is exceeded, the last successful save remains.
      localStorage.setItem(KEY, encoded);
      claimPending = false; claimExpected = undefined;
      lastSavedTime = game.time; lastSavedAt = entry.savedAt; lastError = '';
      return { ok: true, savedAt: entry.savedAt };
    } catch (_) {
      const message = 'Sauvegarde impossible : stockage indisponible ou plein. Gardez cette fenêtre ouverte.';
      reportError(message);
      return { ok: false, message };
    }
  }

  function onGameStart() {
    sessionId = token(); sessionGame = game; writeBlocked = false; finishing = false;
    lastSavedTime = -10; lastSavedAt = null; lastError = '';
    claimPending = true;
    try { claimExpected = localStorage.getItem(KEY); } catch (_) { claimExpected = undefined; }
    save();
  }

  function resume() {
    const saved = refreshMenu();
    if (saved.status !== 'valid') return;
    activateGame(saved.restored, { resume: true, ui: saved.entry.ui });
    sessionId = saved.entry.id; sessionGame = game; writeBlocked = false; finishing = false;
    lastSavedTime = game.time; lastSavedAt = saved.entry.savedAt; lastError = '';
    claimPending = true; claimExpected = saved.raw;
    // Taking over this slot pauses an older copy still open in another tab.
    save();
    toast('Partie retrouvée. Touchez « Reprendre » quand vous êtes prêt.');
  }

  function confirmNew(proceed) {
    const saved = read();
    if (!['valid', 'invalid'].includes(saved.status)) return false;
    if (live()) { if (!paused) togglePause(); save(); }
    modal('<div class="eyebrow">UNE NOUVELLE TOILE</div><h2>Remplacer la partie sauvegardée ?</h2><p>' +
      (saved.status === 'valid' ? 'Votre conquête actuelle sera remplacée par cette nouvelle partie. Vous pouvez aussi la reprendre depuis le menu.' : 'La sauvegarde ne peut pas être lue par cette version. La nouvelle partie la remplacera.') +
      '</p><button id="newGameConfirm" class="primary">Remplacer et commencer</button><button id="newGameCancel" class="secondary">Conserver ma sauvegarde</button>');
    $('newGameConfirm').onclick = () => { closeModal(); proceed(); };
    $('newGameCancel').onclick = closeModal;
    return true;
  }

  function onFinished() {
    if (sessionGame !== game || finishing || window.CQTutorial?.active) return;
    finishing = true;
    try {
      const raw = localStorage.getItem(KEY);
      const saved = raw && JSON.parse(raw);
      if (saved?.id === sessionId && saved?.writer === writer) localStorage.removeItem(KEY);
    } catch (_) { reportError('Impossible de retirer la sauvegarde terminée.'); }
    sessionGame = null;
  }

  function tick() {
    if (live() && !paused && !writeBlocked && game.time - lastSavedTime >= 10) {
      lastSavedTime = game.time; // Do not retry every frame if storage is unavailable.
      save();
    }
  }

  function pauseMenu() {
    const training = !!window.CQTutorial?.active;
    if (!paused && playing && !ended) togglePause();
    const result = training ? null : save();
    modal('<div class="eyebrow">UNE PAUSE DANS LA CONQUÊTE</div><h2>Votre réseau vous attend.</h2>' +
      '<p id="savePauseStatus" role="status"></p><button id="resume" class="primary">Reprendre la partie →</button>' +
      '<button id="exit" class="secondary">' + (training ? 'Quitter le tutoriel' : 'Sauvegarder et revenir au menu') + '</button>' +
      (training ? '' : '<p class="save-note">Une partie par navigateur ou application, sur cet appareil. Effacer ses données supprime aussi la sauvegarde.</p>'));
    $('savePauseStatus').textContent = training ? 'Les exercices ne sont pas sauvegardés. Votre partie habituelle est conservée.' :
      result?.ok ? 'Partie sauvegardée à ' + clock(game.time) + '. Vous pouvez fermer le jeu.' : result?.message || 'La partie est terminée.';
    if (result && !result.ok && !result.skipped) $('savePauseStatus').classList.add('save-warning');
    $('resume').onclick = () => { closeModal(); if (paused) togglePause(); };
    $('exit').onclick = () => {
      const current = training ? { ok: true } : save();
      if (!training && !current.ok && !current.skipped && !writeBlocked) {
        $('savePauseStatus').textContent = current.message + ' Vous pouvez réessayer ou quitter sans conserver les dernières actions.';
        $('exit').textContent = 'Réessayer la sauvegarde';
        if (!$('exitWithoutSave')) {
          const discard = document.createElement('button'); discard.id = 'exitWithoutSave'; discard.className = 'secondary';
          discard.textContent = 'Quitter sans sauvegarder'; discard.onclick = returnToMenu; $('exit').after(discard);
        }
        return;
      }
      returnToMenu();
    };
  }

  function beforeHide() {
    if (playing && !paused && !ended) togglePause();
    save();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) beforeHide(); });
  window.addEventListener('pagehide', beforeHide);
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    if (live()) {
      // Ignore a delayed notification older than our explicit takeover.
      let current;
      try { current = JSON.parse(localStorage.getItem(KEY)); } catch (_) { /* Treat inaccessible data as a conflict. */ }
      if (current?.id !== sessionId || current?.writer !== writer) conflict();
    }
    if (!playing) refreshMenu();
  });
  continueButton.onclick = resume;
  $('back').onclick = pauseMenu;
  window.CQSave = { KEY, save, resume, read, refreshMenu, confirmNew, onGameStart, onFinished, tick, pauseMenu,
    get lastSavedAt() { return lastSavedAt; }, get error() { return lastError; } };
  refreshMenu();
})();
