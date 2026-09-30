/* V0.6: a small, honest campaign. All mission rules remain in missions.js. */
(() => {
  'use strict';
  const KEY = 'colorquest.campaign.progress.v1';
  const FORMAT = 'colorquest-campaign-progress';
  const VERSION = 1;
  const $c = id => document.getElementById(id);
  const catalog = () => window.CQMissions?.catalog || [];
  const definition = id => window.CQMissions?.get(id);
  const ids = () => catalog().map(m => m.id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icons = {'first-ink':'◈',source:'◉',contact:'■',link:'⌁',outpost:'▥'};
  const lessons = {
    'first-ink': 'Votre couleur avance autour des relais.',
    source: 'Une source reliée fournit du pigment en continu.',
    contact: 'Formez un groupe et donnez-lui une destination.',
    link: 'Un bâtiment isolé attend sa connexion au Cœur.',
    outpost: 'Produisez les renforts au plus près du front.'
  };
  const discoveries = {'first-ink':'Le relais',source:'La source et l’extracteur',contact:'Les combattants et les ordres',link:'Les connexions du réseau',outpost:'La caserne avancée'};
  const tools = {relay:'Relais',extractor:'Extracteur',fighter:'Combattant',barracks:'Caserne'};
  let completed = [], storageIssue = '', activeGame = null, opened = false, previousFocus = null;
  let lastUpdate = 0, lastStatus = null, finishedGame = null, canClearFinished = true;
  let menuSave = null;

  function decode(raw) {
    const data = JSON.parse(raw), order = ids();
    if (!data || data.format !== FORMAT || data.version !== VERSION || !Array.isArray(data.completed) || data.completed.length > order.length || data.completed.some((id, index) => id !== order[index])) throw new Error('invalid-progress');
    return data.completed.slice();
  }
  function merge(list) { if (list.length > completed.length) completed = list.slice(); }
  function loadProgress() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { try { merge(decode(raw)); } catch (_) { storageIssue = 'invalid'; return false; } }
      if (storageIssue !== 'write') storageIssue = '';
      return true;
    } catch (_) { storageIssue = 'unavailable'; return false; }
  }
  function writeProgress() {
    try {
      // Merge the last saved victories before writing, so another tab cannot
      // accidentally lose progress. Never replace unrecognised data silently.
      const raw = localStorage.getItem(KEY);
      if (raw) { try { merge(decode(raw)); } catch (_) { storageIssue = 'invalid'; return false; } }
      localStorage.setItem(KEY, JSON.stringify({format:FORMAT, version:VERSION, completed:completed.slice()}));
      storageIssue = ''; return true;
    } catch (_) { storageIssue = 'write'; return false; }
  }
  function progressNotice() {
    if (storageIssue === 'invalid') return 'Progression enregistrée illisible : elle est conservée. Les nouvelles victoires restent disponibles dans cette fenêtre uniquement.';
    if (storageIssue) return 'Progression non enregistrée : stockage indisponible ou plein. Les déblocages restent disponibles dans cette fenêtre uniquement.';
    return 'Progression conservée sur cet appareil. Rejouer un niveau garde ses outils de départ.';
  }
  function isUnlocked(id) { const i = ids().indexOf(id); return i >= 0 && i <= completed.length; }
  function current() { return activeGame && activeGame === game && playing && activeGame.mission ? activeGame : null; }
  function status(g = current()) { return g ? (window.CQMissions?.status?.(g) || window.CQMissions?.describe?.(g) || null) : null; }
  function can(action, type) { return !current() || window.CQMissions?.can(current(), action, type) !== false; }

  const card = document.createElement('section'); card.id = 'campaignCard'; card.className = 'campaign-card';
  card.setAttribute('aria-label', 'Campagne de Colorquest');
  card.innerHTML = '<div class="campaign-card-top"><span>APPRENDRE EN JOUANT</span><b id="campaignMenuProgress">0 / 5</b></div><h2>Une couleur. Une aventure.</h2><p>Cinq petites missions pour construire, commander et comprendre votre réseau.</p><button id="campaignOpen" class="primary" aria-haspopup="dialog" aria-controls="campaignSheet">Découvrir la campagne <span aria-hidden="true">↗</span></button><button id="campaignResume" class="campaign-resume" hidden><strong>↻ Reprendre la mission</strong><small id="campaignResumeDetails"></small></button><p id="campaignMenuNote" class="campaign-menu-note" role="status"></p>';
  const freeCard = document.querySelector('.start-card'); freeCard?.before(card);
  freeCard?.classList.add('campaign-free-card');
  const colorPicker = document.querySelector('.palette-picker');
  if (colorPicker && freeCard) { freeCard.before(colorPicker); colorPicker.classList.add('campaign-palette-picker'); }
  if (freeCard?.querySelector('.card-heading>span:first-child')) freeCard.querySelector('.card-heading>span:first-child').textContent = 'MODE LIBRE · TOUS LES OUTILS';
  if (freeCard?.querySelector('.mode-tag')) freeCard.querySelector('.mode-tag').textContent = 'DUEL VS IA';
  document.body.classList.add('campaign-menu-ready');

  const sheet = document.createElement('div'); sheet.id = 'campaignSheet'; sheet.className = 'campaign-sheet hidden';
  sheet.innerHTML = '<section class="campaign-dialog" role="dialog" aria-modal="true" aria-labelledby="campaignTitle"><header class="campaign-header"><div><span>VOTRE COULEUR PREND VIE</span><h2 id="campaignTitle">La campagne</h2></div><button id="campaignClose" aria-label="Fermer la campagne">×</button></header><p class="campaign-intro">Une nouveauté à la fois. Terminez une mission pour ouvrir la suivante.</p><div id="campaignMissionList" class="campaign-mission-list"></div><footer id="campaignProgressNote" class="campaign-progress-note" role="status"></footer></section>';
  document.body.append(sheet);

  const objective = document.createElement('section'); objective.id = 'campaignObjective'; objective.className = 'campaign-objective hidden';
  objective.setAttribute('aria-label', 'Objectif de la mission');
  objective.innerHTML = '<div class="campaign-objective-heading"><div><span id="campaignObjectiveIndex"></span><strong id="campaignObjectiveTitle"></strong></div><button id="campaignFocus" aria-label="Voir l’objectif sur la carte"><span aria-hidden="true">◎</span><small>Voir</small></button></div><p id="campaignHint" role="status" aria-live="polite"></p><div id="campaignObjectiveBar" role="progressbar" aria-label="Avancement de la mission" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>';
  $c('canvasWrap')?.before(objective);
  const holdButton = document.createElement('button'); holdButton.id = 'campaignHold'; holdButton.className = 'campaign-hold hidden'; holdButton.textContent = '▣ Tenir ici';
  document.querySelector('.orders')?.append(holdButton);
  holdButton.onclick = () => { const g = current(); if (!g || paused || ended || !selection.length) return; const result = g.command(1,selection.slice(),'hold'); if (result?.ok !== false) { setMode(null); toast('Position tenue : les combattants restent défendre ici.'); audio('confirmation_001'); } else toast(result.message || 'Sélectionnez vos combattants.'); };

  function renderList() {
    const resumeId = menuSave?.status === 'valid' ? menuSave.restored?.mission?.id : null;
    $c('campaignMissionList').innerHTML = catalog().map(m => {
      const unlocked = isUnlocked(m.id), done = completed.includes(m.id), label = done ? '✓ Terminée · rejouer' : unlocked ? 'À découvrir' : 'À débloquer';
      const n = m.index || m.number || ids().indexOf(m.id) + 1;
      return '<button class="campaign-mission' + (done ? ' is-complete' : '') + '" data-campaign-mission="' + escape(m.id) + '" ' + (unlocked ? '' : 'disabled ') + 'aria-label="Mission ' + n + ' : ' + escape(m.title || m.name) + ', ' + label + '"><span class="campaign-mission-art" aria-hidden="true"><b>' + (icons[m.id] || '◈') + '</b><small>' + String(n).padStart(2,'0') + '</small></span><span class="campaign-mission-copy"><span class="campaign-mission-state">' + label + (resumeId === m.id ? ' · sauvegarde' : '') + '</span><strong>' + escape(m.title || m.name) + '</strong><span>' + escape(m.description || lessons[m.id]) + '</span><small>' + (unlocked ? 'Nouveauté : ' + escape(discoveries[m.id] || lessons[m.id]) : 'Après la mission ' + (n - 1)) + '</small></span><span class="campaign-mission-arrow" aria-hidden="true">' + (unlocked ? '›' : '○') + '</span></button>';
    }).join('');
    $c('campaignProgressNote').textContent = progressNotice();
    $c('campaignProgressNote').classList.toggle('is-warning', !!storageIssue);
  }
  function refreshMenu() {
    loadProgress();
    menuSave = window.CQSave?.read('campaign') || {status:'none'};
    $c('campaignMenuProgress').textContent = completed.length + ' / ' + catalog().length;
    $c('campaignOpen').innerHTML = (completed.length ? (completed.length === catalog().length ? 'Rejouer les missions' : 'Continuer la campagne') : 'Découvrir la campagne') + ' <span aria-hidden="true">↗</span>';
    $c('campaignResume').hidden = menuSave.status !== 'valid';
    if (menuSave.status === 'valid') {
      const m = definition(menuSave.restored.mission.id);
      $c('campaignResumeDetails').textContent = (m?.index || m?.number || '') + ' · ' + (m?.title || m?.name || 'Mission') + ' · reprend en pause';
    }
    const saveWarning = menuSave.status === 'invalid' ? 'Mission sauvegardée illisible : elle est conservée jusqu’à votre choix de la remplacer.' : menuSave.status === 'unavailable' ? 'La mission ne peut pas être sauvegardée dans ce navigateur.' : '';
    $c('campaignMenuNote').textContent = storageIssue ? progressNotice() : saveWarning || (completed.length === catalog().length ? 'Les cinq premières missions sont terminées. La suite viendra enrichir la campagne.' : 'Les premiers niveaux se jouent sans adversaire.');
    $c('campaignMenuNote').classList.toggle('is-warning', !!storageIssue || !!saveWarning);
    if (opened) renderList();
    return {completed:completed.slice(), saved:!storageIssue, mission:menuSave};
  }
  function open() {
    if (playing || !$c('modal').classList.contains('hidden') || window.CQWorldUI?.isOpen) return false;
    refreshMenu(); previousFocus = document.activeElement; opened = true;
    renderList(); sheet.classList.remove('hidden'); document.body.classList.add('campaign-sheet-open');
    $c('campaignOpen').setAttribute('aria-expanded','true');
    $c('campaignClose').focus({preventScroll:true}); return true;
  }
  function close(restoreFocus = true) {
    opened = false; sheet.classList.add('hidden'); document.body.classList.remove('campaign-sheet-open');
    $c('campaignOpen').setAttribute('aria-expanded','false');
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
  }
  function start(id) {
    loadProgress(); if (!definition(id) || !isUnlocked(id)) return false;
    close(false); if (typeof startMission !== 'function') return false;
    startMission(id); return true;
  }
  function resume() { close(false); window.CQSave?.resume('campaign'); }
  $c('campaignOpen').onclick = open; $c('campaignClose').onclick = () => close(); $c('campaignResume').onclick = resume;
  sheet.addEventListener('click', e => { const b = e.target.closest('[data-campaign-mission]'); if (b && !b.disabled) start(b.dataset.campaignMission); else if (e.target === sheet) close(); });
  sheet.addEventListener('keydown', e => {
    if (!opened) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const buttons = [...sheet.querySelectorAll('button:not([disabled])')].filter(b => b.getClientRects().length), first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  });
  $c('campaignFocus').onclick = () => {
    const target = status()?.target;
    if (!target) return;
    window.CQCamera?.focus(target.x + .5, target.y + .5, Math.max(1.7,window.CQCamera?.zoom || 1));
    audio('select_001');
  };

  function applyTools() {
    const g = current();
    document.querySelectorAll('[data-build],[data-recruit],[data-power]').forEach(button => {
      const kind = button.dataset.build ? 'build' : button.dataset.recruit ? 'recruit' : 'power';
      const type = button.dataset.build || button.dataset.recruit || button.dataset.power;
      button.classList.toggle('campaign-unavailable', !!g && !can(kind,type));
    });
    const hasUnits = !!g && (definition(g.mission.id)?.units || []).length > 0;
    document.body.classList.toggle('campaign-has-units',hasUnits);
    holdButton.classList.toggle('hidden',g?.mission.id !== 'outpost'); holdButton.disabled = !g || paused || !selection.length;
    document.querySelector('button[data-tab="units"]')?.classList.toggle('campaign-unavailable',!!g&&!hasUnits);
    document.querySelector('button[data-tab="powers"]')?.classList.toggle('campaign-unavailable',!!g);
    const panel = document.querySelector('.command-panel');
    if (g && (panel.dataset.tab === 'powers' || !hasUnits && panel.dataset.tab === 'units')) {
      panel.dataset.tab = 'build'; document.querySelectorAll('button[data-tab]').forEach(b => b.classList.toggle('chosen',b.dataset.tab === 'build'));
    }
    if (g) {
      const n = (definition(g.mission.id)?.buildings || []).filter(type => type !== 'core').length;
      panel.style.setProperty('--campaign-build-count',String(Math.max(1,n)));
    } else panel.style.removeProperty('--campaign-build-count');
  }
  function onGameStart(nextGame) {
    reset();
    if (!nextGame.mission) return;
    activeGame = nextGame;
    const m = definition(nextGame.mission.id);
    document.body.classList.add('campaign-active'); document.body.dataset.campaignIndex = String(m?.index || m?.number || 1);
    objective.classList.remove('hidden');
    const panel = document.querySelector('.command-panel'); panel.dataset.tab = 'build';
    document.querySelectorAll('button[data-tab]').forEach(b => b.classList.toggle('chosen',b.dataset.tab === 'build'));
    applyTools(); update(true);
  }
  function reset() {
    close(false); activeGame = null; lastStatus = null; lastUpdate = 0;
    document.body.classList.remove('campaign-active','campaign-has-units'); delete document.body.dataset.campaignIndex;
    objective.classList.add('hidden'); holdButton.classList.add('hidden');
    document.querySelector('.command-panel')?.style.removeProperty('--campaign-build-count');
    document.querySelectorAll('.campaign-unavailable,.campaign-next-action').forEach(el => el.classList.remove('campaign-unavailable','campaign-next-action'));
  }
  function update(force = false) {
    const g = current(); if (!g) return;
    if (!force && performance.now()-lastUpdate < 120) return; lastUpdate = performance.now();
    const s = status(g); if (!s) return;
    lastStatus = s; applyTools();
    $c('campaignObjectiveIndex').textContent = 'MISSION ' + (s.index || definition(s.id)?.index || 1) + ' / ' + catalog().length + ' · ' + (s.title || definition(s.id)?.title || '');
    $c('campaignObjectiveTitle').textContent = s.objective || 'Faites grandir votre couleur';
    // Keep engine guidance visible while the separate placement card explains
    // the chosen square and its confirmation; the goal never disappears.
    let hint = s.hint || '';
    if (mode?.kind === 'build') hint = 'Touchez une case de votre couleur, puis « Valider » dans l’aperçu.';
    else if (mode?.kind === 'move' || mode?.kind === 'attack') hint = 'Touchez la destination indiquée sur la carte.';
    if ($c('campaignHint').textContent !== hint) $c('campaignHint').textContent = hint;
    const p = Math.max(0,Math.min(100,Math.round((s.progress || 0)*100)));
    $c('campaignObjectiveBar').setAttribute('aria-valuenow',String(p));
    $c('campaignObjectiveBar').firstElementChild.style.width = p + '%';
    $c('campaignFocus').disabled = !s.target;
    document.querySelectorAll('.campaign-next-action').forEach(b => b.classList.remove('campaign-next-action'));
    if (!mode && !paused && s.action) {
      const key = s.action.kind === 'build' ? 'build' : s.action.kind === 'recruit' ? 'recruit' : null;
      if (key && s.action.type) document.querySelectorAll('[data-' + key + '="' + s.action.type + '"]').forEach(b => b.classList.add('campaign-next-action'));
      if (s.action.kind === 'command') $c(selection.length ? (s.action.type === 'hold' ? 'campaignHold' : 'moveOrder') : 'selectAll')?.classList.add('campaign-next-action');
      if (key === 'recruit' && document.querySelector('.command-panel').dataset.tab !== 'units') document.querySelector('button[data-tab="units"]')?.classList.add('campaign-next-action');
      if (key === 'build' && document.querySelector('.command-panel').dataset.tab !== 'build') document.querySelector('button[data-tab="build"]')?.classList.add('campaign-next-action');
    }
  }
  function draw(c,v) {
    const g = current(), target = (lastStatus || status(g))?.target; if (!g || !target || g.winner !== null) return;
    const x = v.x + (target.x+.5)*v.cell, y = v.y + (target.y+.5)*v.cell;
    if (x < -25 || x > v.w+25 || y < -25 || y > v.h+25) return;
    const r = Math.max(11,v.cell*.72);
    c.save(); c.strokeStyle='#9c701b'; c.lineWidth=2; c.setLineDash([4,3]);
    c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.setLineDash([]);
    const text = target.label || 'Objectif'; c.font='700 11px system-ui'; c.textAlign='center';
    const w = c.measureText(text).width + 14, lx = Math.max(w/2+3,Math.min(v.w-w/2-3,x));
    const ly = y-r-18 < 3 ? y+r+5 : y-r-21;
    c.fillStyle='#fff9e5f5';c.strokeStyle='#d2b470';c.lineWidth=1;c.beginPath();c.roundRect(lx-w/2,ly,w,19,5);c.fill();c.stroke();c.fillStyle='#775317';c.fillText(text,lx,ly+13);c.restore();
  }
  function resultStorage() {
    const el = $c('campaignResultSave'); if (!el) return;
    el.textContent = canClearFinished ? 'Victoire enregistrée sur cet appareil.' : progressNotice() + ' Le dernier point de reprise de cette mission est conservé.';
    el.classList.toggle('is-warning',!canClearFinished);
    if ($c('campaignRetryProgress')) $c('campaignRetryProgress').hidden = canClearFinished || storageIssue === 'invalid';
  }
  function onFinished(g) {
    if (!g?.mission || g !== activeGame || g.winner === null) return false;
    if (finishedGame === g) return true;
    finishedGame = g; close(false);
    const s = status(g), m = definition(g.mission.id), order = ids(), at = order.indexOf(g.mission.id);
    const win = g.winner === 1 && s?.complete === true;
    canClearFinished = true;
    if (win && at >= 0 && at <= completed.length) {
      if (!completed.includes(g.mission.id)) completed.push(g.mission.id);
      canClearFinished = writeProgress();
    }
    const next = win ? catalog()[at+1] : null;
    const title = win ? 'Votre couleur avance !' : 'Le réseau peut renaître.';
    const explanation = win ? (next ? 'Mission réussie. La prochaine vous attend avec un nouvel outil.' : 'Vous maîtrisez les cinq premières missions. Rejouez-les ou essayez le mode libre avec tous les outils.') : 'Votre Cœur a été perdu. Recommencez cette mission : vos niveaux déjà terminés restent débloqués.';
    modal('<div class="campaign-result-symbol" aria-hidden="true">' + (win?'✓':'◈') + '</div><div class="eyebrow">MISSION ' + (m?.index || at+1) + ' · ' + escape(m?.title || m?.name) + '</div><h2>' + title + '</h2><p>' + explanation + '</p>' + (next ? '<div class="campaign-unlock"><small>PROCHAINE DÉCOUVERTE</small><strong>' + escape(discoveries[next.id] || next.title) + '</strong><span>' + escape(lessons[next.id] || next.description) + '</span></div>' : '') + (win ? '<p id="campaignResultSave" class="campaign-result-save" role="status"></p><button id="campaignRetryProgress" class="secondary" hidden>Réessayer l’enregistrement</button>' : '') + (next ? '<button id="campaignNext" class="primary">Mission ' + (next.index || at+2) + ' · ' + escape(next.title || next.name) + ' →</button>' : '') + '<button id="campaignReplay" class="' + (next?'secondary':'primary') + '">' + (win?'Rejouer cette mission':'Réessayer la mission') + '</button><button id="campaignEndMenu" class="secondary">Retour à la campagne</button>');
    if ($c('campaignNext')) $c('campaignNext').onclick = () => start(next.id);
    $c('campaignReplay').onclick = () => start(g.mission.id);
    $c('campaignEndMenu').onclick = () => { returnToMenu(); open(); };
    if ($c('campaignRetryProgress')) $c('campaignRetryProgress').onclick = () => { canClearFinished = writeProgress(); resultStorage(); if (canClearFinished) window.CQSave?.onFinished(); };
    if (win) resultStorage();
    return true;
  }
  function help() {
    const g = current(); if (!g) return false;
    if (!paused && !ended) togglePause();
    const m = definition(g.mission.id), s = status(g), known = (m?.buildings || []).filter(t => t !== 'core').map(t => tools[t] || t);
    modal('<div class="eyebrow">MISSION ' + (m?.index || '') + '</div><h2>' + escape(m?.title || 'Votre objectif') + '</h2><p><b>' + escape(s?.objective || '') + '</b></p><p>' + escape(s?.hint || '') + '</p><ul><li><b>Votre couleur :</b> vous construisez sur les cases reliées au Cœur. Le relais étend cette zone progressivement.</li><li><b>Construire :</b> choisissez ' + escape(known.join(' ou ')) + ', touchez une case, lisez l’aperçu puis validez.</li>' + ((m?.units || []).length ? '<li><b>Commander :</b> ouvrez « Mobiliser » pour former un combattant. Touchez « Toute l’armée », puis « Attaquer / déplacer » et la destination. Au niveau 5, « Tenir ici » empêche de poursuivre les ennemis loin de la source.</li>' : '') + '<li><b>Se repérer :</b> « Voir » recentre l’objectif. Glissez la carte ou pincez pour zoomer. Le jeu attend votre signal avant de reprendre.</li></ul><button id="campaignHelpDone" class="primary">Revenir à la mission</button>');
    $c('campaignHelpDone').onclick = () => closeModal(); return true;
  }
  window.CQCampaign = {KEY,FORMAT,VERSION,start,open,close,resume,onGameStart,reset,update,draw,onFinished,refreshMenu,help,can,isUnlocked,get isOpen(){return opened},get canClearFinished(){return canClearFinished},get completed(){return completed.slice()}};
  document.addEventListener('cq:savechange',refreshMenu);
  addEventListener('storage', e => { if (e.key === KEY || e.key === window.CQSave?.CAMPAIGN_KEY) refreshMenu(); });
  refreshMenu();
})();
