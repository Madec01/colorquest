/* Local match persistence. Independent free-play/campaign slots, atomic writes,
 * no elapsed-time simulation. Campaign unlocks are stored by campaign.js. */
(function () {
  'use strict';
  const KEY = 'colorquest.match.v1';
  const CAMPAIGN_KEY = 'colorquest.campaign.match.v1';
  const slotKind = kind => kind === 'campaign' ? 'campaign' : 'free';
  const keyFor = kind => slotKind(kind) === 'campaign' ? CAMPAIGN_KEY : KEY;
  const token = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const writer = token();
  let sessionId = null, sessionGame = null, lastSavedTime = -10, lastSavedAt = null;
  let sessionKind = 'free';
  let lastError = '', writeBlocked = false, finishing = false;
  let claimPending = false, claimExpected;
  const replacementClaims = new Map();
  const changed = reason => document.dispatchEvent(new CustomEvent('cq:savechange', { bubbles: true, detail: { kind: sessionKind, reason } }));
  const card = document.createElement('div');
  card.className = 'resume-card';
  card.innerHTML = '<button id="continueGame" class="resume-button" hidden><span>↻ Reprendre la partie</span><small id="resumeDetails"></small></button><p id="saveMenuStatus" class="save-note" role="status"></p>';
  $('play').after(card);
  if ($('startTutorial')) card.after($('startTutorial'));
  const continueButton = $('continueGame'), details = $('resumeDetails'), note = $('saveMenuStatus');
  const clock = seconds => Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + Math.floor(seconds % 60).toString().padStart(2, '0');
  const live = () => playing && game && !ended && game.winner === null && !window.CQTutorial?.active && sessionGame === game;
  const recruitSourceFor = (g, value) => Number.isSafeInteger(value) && g.getRecruitProducers(1).some(b => b.id === value && b.team === 1 && b.hp > 0)
    ? value : g.getCore(1)?.id ?? null;

  function read(kind = 'free') {
    kind = slotKind(kind);
    let raw;
    try { raw = localStorage.getItem(keyFor(kind)); }
    catch (_) { return { status: 'unavailable' }; }
    if (!raw) return { status: 'none', raw };
    try {
      if (raw.length > 2_000_000) throw new Error('size');
      const entry = JSON.parse(raw);
      if (entry.format !== 'colorquest-match' || entry.version !== 1 || typeof entry.id !== 'string' ||
          typeof entry.writer !== 'string' || !Number.isFinite(entry.savedAt) || entry.savedAt < 0) throw new Error('envelope');
      const restored = CQSnapshot.restore(entry.snapshot);
      if (restored.winner !== null || (kind === 'campaign' ? !restored.mission : restored.mission || restored.duration !== 720)) throw new Error('completed-or-wrong-mode');
      const ui = entry.ui && typeof entry.ui === 'object' && !Array.isArray(entry.ui) ? entry.ui : {};
      entry.ui = { ...ui, recruitSource: recruitSourceFor(restored, ui.recruitSource) };
      return { status: 'valid', entry, restored, raw };
    } catch (_) { return { status: 'invalid', raw }; }
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
    changed('menu');
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
        ui: { camera: window.CQCamera?.capture(), selection: selection.slice(), step,
          recruitSource: recruitSourceFor(game, window.CQStrategy?.getRecruitSource?.()) }
      };
      const encoded = JSON.stringify(entry);
      // A suspended tab may not have received the storage event yet. Check the
      // current owner immediately before writing, rather than trusting that event.
      const currentRaw = localStorage.getItem(keyFor(sessionKind));
      const claiming = claimPending && (currentRaw === claimExpected || currentRaw === null && claimExpected === undefined);
      if (!claiming) {
        let current;
        try { current = currentRaw && JSON.parse(currentRaw); } catch (_) { return conflict(); }
        if (current?.id !== sessionId || current?.writer !== writer) return conflict();
      }
      // setItem is atomic. If the quota is exceeded, the last successful save remains.
      localStorage.setItem(keyFor(sessionKind), encoded);
      claimPending = false; claimExpected = undefined;
      lastSavedTime = game.time; lastSavedAt = entry.savedAt; lastError = '';
      changed('saved');
      return { ok: true, savedAt: entry.savedAt };
    } catch (_) {
      const message = 'Sauvegarde impossible : stockage indisponible ou plein. Gardez cette fenêtre ouverte.';
      reportError(message);
      return { ok: false, message };
    }
  }

  function onGameStart() {
    if (window.CQTutorial?.active) return;
    sessionKind = game?.mission ? 'campaign' : 'free';
    sessionId = token(); sessionGame = game; writeBlocked = false; finishing = false;
    lastSavedTime = -10; lastSavedAt = null; lastError = '';
    claimPending = true;
    if (replacementClaims.has(sessionKind)) {
      claimExpected = replacementClaims.get(sessionKind); replacementClaims.delete(sessionKind);
    } else {
      try { claimExpected = localStorage.getItem(keyFor(sessionKind)); } catch (_) { claimExpected = undefined; }
    }
    save();
  }

  function resume(kind = 'free') {
    kind = slotKind(kind);
    const saved = kind === 'free' ? refreshMenu() : read(kind);
    if (saved.status !== 'valid') return;
    activateGame(saved.restored, { resume: true, ui: saved.entry.ui });
    sessionKind = kind;
    sessionId = saved.entry.id; sessionGame = game; writeBlocked = false; finishing = false;
    lastSavedTime = game.time; lastSavedAt = saved.entry.savedAt; lastError = '';
    claimPending = true; claimExpected = saved.raw;
    // Taking over this slot pauses an older copy still open in another tab.
    save();
    toast((kind === 'campaign' ? 'Mission retrouvée.' : 'Partie retrouvée.') + ' Touchez « Reprendre » quand vous êtes prêt.');
  }

  function confirmNew(proceed, kind = 'free') {
    kind = slotKind(kind);
    let saved = read(kind);
    if (!['valid', 'invalid'].includes(saved.status)) { replacementClaims.set(kind, saved.raw); return false; }
    if (live()) { if (!paused) togglePause(); save(); saved = read(kind); }
    modal('<div class="eyebrow">' + (kind === 'campaign' ? 'UNE NOUVELLE MISSION' : 'UNE NOUVELLE TOILE') + '</div><h2>Remplacer ' + (kind === 'campaign' ? 'la mission' : 'la partie') + ' sauvegardée ?</h2><p>' +
      (saved.status === 'valid' ? (kind === 'campaign' ? 'Votre mission en cours sera remplacée. Les niveaux débloqués et votre partie libre sont conservés.' : 'Votre conquête actuelle sera remplacée par cette nouvelle partie. Vous pouvez aussi la reprendre depuis le menu. Votre campagne est conservée.') : 'La sauvegarde ne peut pas être lue par cette version. La nouvelle partie la remplacera.') +
      '</p><button id="newGameConfirm" class="primary">Remplacer et commencer</button><button id="newGameCancel" class="secondary">Conserver ma sauvegarde</button>');
    $('newGameConfirm').onclick = () => { replacementClaims.set(kind, saved.raw); closeModal(); proceed(); };
    $('newGameCancel').onclick = closeModal;
    return true;
  }

  function onFinished() {
    if (sessionGame !== game || finishing || window.CQTutorial?.active) return;
    finishing = true;
    try {
      const raw = localStorage.getItem(keyFor(sessionKind));
      const saved = raw && JSON.parse(raw);
      if (saved?.id === sessionId && saved?.writer === writer) localStorage.removeItem(keyFor(sessionKind));
    } catch (_) { reportError('Impossible de retirer la sauvegarde terminée.'); }
    sessionGame = null;
    changed('finished');
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
      (training ? '' : '<p class="save-note">Une mission et une partie libre conservées séparément sur cet appareil. Effacer les données du jeu supprime les sauvegardes et la progression.</p>'));
    $('savePauseStatus').textContent = training ? 'Les exercices ne sont pas sauvegardés. Votre campagne et votre partie libre sont conservées.' :
      result?.ok ? (sessionKind === 'campaign' ? 'Mission sauvegardée à ' : 'Partie sauvegardée à ') + clock(game.time) + '. Vous pouvez fermer le jeu.' : result?.message || 'La partie est terminée.';
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
    if (![KEY, CAMPAIGN_KEY, null].includes(event.key)) return;
    if (live() && (event.key === keyFor(sessionKind) || event.key === null)) {
      // Ignore a delayed notification older than our explicit takeover.
      let current;
      try { current = JSON.parse(localStorage.getItem(keyFor(sessionKind))); } catch (_) { /* Treat inaccessible data as a conflict. */ }
      if (current?.id !== sessionId || current?.writer !== writer) conflict();
    }
    if (!playing) refreshMenu();
  });
  continueButton.onclick = () => resume();
  $('back').onclick = pauseMenu;
  window.CQSave = { KEY, CAMPAIGN_KEY, save, resume, read, refreshMenu, confirmNew, onGameStart, onFinished, tick, pauseMenu,
    get kind() { return sessionKind; },
    get lastSavedAt() { return lastSavedAt; }, get error() { return lastError; } };
  refreshMenu();
})();
