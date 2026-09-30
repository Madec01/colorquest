/* Map choice and the terrain vocabulary. The engine remains the only map source. */
(() => {
  'use strict';
  const KEY = 'colorquest:map:v1';
  const paper = '#fffef9';
  const plans = {
    plain: { tagline: 'De l’espace pour explorer', tip: 'Explorez les réserves proches, puis reliez une source riche à votre Cœur.' },
    lanes: { tagline: 'Tenir ou contourner', tip: 'Les passages concentrent les combats. Explorez les côtés avant d’engager votre armée.' },
    crossroads: { tagline: 'Le centre vaut le détour', tip: 'Le centre concentre les sources riches. Préparez une liaison avant de vous y aventurer.' }
  };
  const catalog = () => window.CQMaps?.catalog || [];
  const label = id => window.CQMaps?.get(id)?.name || (id === 'legacy' ? 'Toile classique' : 'La Plaine');
  let selected = window.CQMaps?.DEFAULT_MAP || 'plain', currentGame = null;
  let opened = false, previousFocus = null, tipTimer = 0, storageAvailable = true;
  try {
    const stored = localStorage.getItem(KEY);
    if (catalog().some(entry => entry.id === stored)) selected = stored;
  } catch (_) { storageAvailable = false; }

  const picker = document.createElement('button');
  picker.id = 'worldMapPicker'; picker.className = 'world-map-picker'; picker.type = 'button';
  picker.setAttribute('aria-haspopup', 'dialog'); picker.setAttribute('aria-controls', 'worldSheet');
  picker.innerHTML = '<span><span class="world-map-symbol" aria-hidden="true">▧</span><span>Carte · <strong id="worldSelectedMap"></strong></span></span><span class="world-map-change">Changer <b aria-hidden="true">›</b></span>';
  document.querySelector('.start-card .difficulty')?.before(picker);

  const legend = document.createElement('button');
  legend.id = 'worldLegendOpen'; legend.className = 'world-legend-open'; legend.type = 'button';
  legend.setAttribute('aria-haspopup', 'dialog'); legend.setAttribute('aria-controls', 'worldSheet');
  legend.innerHTML = '<span class="world-map-symbol" aria-hidden="true">▧</span><span id="worldMapName">La Plaine</span><span class="world-info-icon" aria-hidden="true">i</span>';
  const heading = document.querySelector('.map-heading');
  heading?.classList.add('has-world-map');
  if (heading?.firstElementChild) heading.firstElementChild.replaceWith(legend);
  else heading?.prepend(legend);

  const sheet = document.createElement('div');
  sheet.id = 'worldSheet'; sheet.className = 'world-sheet hidden';
  sheet.innerHTML = '<section class="world-dialog" role="dialog" aria-modal="true" aria-labelledby="worldTitle"><header class="world-header"><div><span id="worldEyebrow" class="world-eyebrow"></span><h2 id="worldTitle"></h2></div><button id="worldClose" class="world-close" type="button" aria-label="Fermer la carte et les terrains">×</button></header><div id="worldLive" class="world-live" hidden><span id="worldLiveLabel"></span><button id="worldPause" type="button"></button></div><div id="worldContent" class="world-content"></div><footer id="worldFooter" class="world-footer"></footer></section>';
  document.body.append(sheet);
  const byId = id => document.getElementById(id);

  function updatePicker() {
    byId('worldSelectedMap').textContent = label(selected);
    picker.setAttribute('aria-label', 'Changer de carte : ' + label(selected));
  }
  function selectMap(id) {
    if (!catalog().some(entry => entry.id === id)) return false;
    selected = id;
    try { localStorage.setItem(KEY, id); storageAvailable = true; } catch (_) { storageAvailable = false; }
    updatePicker();
    return true;
  }
  function activeMatch() { return currentGame && typeof playing !== 'undefined' && playing && !ended; }
  function renderLive() {
    const live = !!activeMatch(); byId('worldLive').hidden = !live;
    if (!live) return;
    byId('worldLiveLabel').textContent = paused ? 'La partie est en pause' : 'La partie continue';
    byId('worldLiveLabel').classList.toggle('is-paused', paused);
    byId('worldPause').textContent = paused ? '▶ Reprendre' : 'Ⅱ Pause';
    byId('worldPause').setAttribute('aria-label', paused ? 'Reprendre depuis la légende' : 'Mettre en pause depuis la légende');
  }
  function open(title, eyebrow, html, footer) {
    if (window.CQStrategy?.isOpen || !byId('modal')?.classList.contains('hidden')) return false;
    if (!opened) previousFocus = document.activeElement;
    opened = true;
    byId('worldTitle').textContent = title; byId('worldEyebrow').textContent = eyebrow;
    byId('worldContent').innerHTML = html; byId('worldContent').scrollTop = 0;
    byId('worldFooter').textContent = footer;
    sheet.classList.remove('hidden'); document.body.classList.add('world-sheet-open');
    picker.setAttribute('aria-expanded', 'true'); legend.setAttribute('aria-expanded', 'true');
    renderLive(); byId('worldClose').focus({ preventScroll: true });
    return true;
  }
  function close(restoreFocus = true) {
    if (!opened) return;
    opened = false; sheet.classList.add('hidden'); document.body.classList.remove('world-sheet-open');
    picker.setAttribute('aria-expanded', 'false'); legend.setAttribute('aria-expanded', 'false');
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function showPicker() {
    if (typeof playing !== 'undefined' && playing) return;
    const html = '<p class="world-intro">Trois toiles, trois façons de conquérir. Touchez celle que vous voulez jouer.</p><div class="world-options">' +
      catalog().map(entry => '<button type="button" class="world-option" data-world-map="' + entry.id + '" aria-pressed="' + (entry.id === selected) + '"><canvas width="96" height="144" data-world-preview="' + entry.id + '" aria-hidden="true"></canvas><span class="world-option-copy"><strong>' + entry.name + '</strong><span>' + (plans[entry.id]?.tagline || '') + '</span><small>' + entry.description + '</small></span><span class="world-option-check" aria-hidden="true">✓</span></button>').join('') + '</div>';
    if (!open('Choisir la carte', 'VOTRE PROCHAINE TOILE', html, storageAvailable ? 'Le choix est conservé sur cet appareil. La sauvegarde garde sa propre carte.' : 'Choix conservé pour cette session. Le stockage du navigateur est indisponible.')) return;
    sheet.querySelectorAll('[data-world-preview]').forEach(canvas => drawPreview(canvas, canvas.dataset.worldPreview));
  }
  function terrainIcon(type) { return '<span class="world-key-icon world-key-' + type + '" aria-hidden="true">' + ({ cache: '+', source: '◉', rich: '◉', absorbent: '⠿', smooth: '»', blocked: '▪' }[type] || '·') + '</span>'; }
  function row(type, title, value, description) {
    return '<div class="world-key-row">' + terrainIcon(type) + '<div><div class="world-key-heading"><h3>' + title + '</h3>' + (value ? '<strong>' + value + '</strong>' : '') + '</div><p>' + description + '</p></div></div>';
  }
  function legendContent() {
    const legacy = currentGame?.mapId === 'legacy';
    let html = '<p class="world-intro">' + (legacy ? 'Cette sauvegarde conserve la toile de votre ancienne partie. Les nouvelles cartes se choisissent au menu.' : plans[currentGame?.mapId]?.tip || 'Explorez, reliez les sources et protégez votre réseau.') + '</p>';
    if (!legacy) html += row('cache', 'Réserve de pigment', '+60', 'Approchez une unité, sauf un ingénieur, pour la ramasser. Un ennemi proche bloque la collecte. La réserve disparaît ensuite.') +
      row('rich', 'Source riche', '+60 %', 'Capturez la case, reliez-la au Cœur et posez un extracteur : il produit 60 % de plus. La source reste sur la carte.') +
      row('absorbent', 'Papier absorbant', '×0,5', 'Votre couleur se propage deux fois moins vite. Les unités capturent le terrain à leur vitesse habituelle.') +
      row('smooth', 'Terrain lisse', '+30 %', 'Toutes les unités s’y déplacent 30 % plus vite, dans toutes les directions.');
    html += row('source', 'Source de pigment', 'Continue', 'Un extracteur construit sur cette case produit du pigment tant qu’il est relié à votre Cœur.') +
      row('blocked', 'Obstacle', 'À contourner', 'Les unités cherchent un passage autour. Vous ne pouvez pas construire sur cette case.');
    return html;
  }
  function showLegend() {
    if (!currentGame || window.CQTutorial?.active) return;
    open(label(currentGame.mapId), 'CARTE & TERRAINS', legendContent(), 'Touchez un terrain découvert sans unité sélectionnée pour lire ses effets.');
  }
  function inspectTile(x, y) {
    if (!activeMatch() || opened || window.CQTutorial?.active || mode || selection.length) return false;
    const tile = currentGame.tile(Math.floor(x), Math.floor(y));
    if (!tile || (!tile.explored && tile.owner !== 1)) return false;
    const visible = tile.visible || tile.owner === 1;
    let html = '', title = '', eyebrow = 'SUR LA TOILE';
    if (tile.cache > 0 && visible) {
      title = 'Réserve de pigment';
      html += row('cache', 'Un bonus à explorer', '+' + tile.cache + ' pigment', 'Approchez une unité autre qu’un ingénieur. La collecte est automatique s’il n’y a pas d’ennemi proche. Aucun bâtiment nécessaire.');
    }
    if (tile.source) {
      title ||= tile.rich ? 'Source riche' : 'Source de pigment';
      html += tile.rich ? row('rich', 'Un revenu à défendre', '+60 %', 'Capturez cette case, reliez-la à votre Cœur, puis construisez un extracteur dessus. Il produit 60 % de plus qu’une source habituelle.') :
        row('source', 'Alimenter votre réseau', 'Extracteur', 'Capturez cette case, reliez-la à votre Cœur, puis posez un extracteur. Sans connexion au Cœur, il ne produit rien.');
    }
    if (tile.terrain === 'absorbent') {
      title ||= 'Papier absorbant';
      html += row('absorbent', 'La couleur prend son temps', '×0,5', 'La propagation passive de la couleur est deux fois plus lente. Vos unités se déplacent et capturent normalement.');
    }
    if (tile.terrain === 'smooth') {
      title ||= 'Terrain lisse';
      html += row('smooth', 'Un chemin rapide', '+30 %', 'La vitesse des unités augmente de 30 % sur ces cases, quel que soit le sens de déplacement. Les deux camps en profitent.');
    }
    if (tile.blocked) {
      title ||= 'Obstacle';
      html += row('blocked', 'Chercher un passage', 'Infranchissable', 'Vos unités contournent cet obstacle. Aucune construction ne peut être placée dessus.');
    }
    if (!html) return false;
    if (!visible) eyebrow = 'TERRAIN DÉJÀ EXPLORÉ';
    return open(title, eyebrow, html, 'Fermez cette fiche pour continuer à commander sur la carte.');
  }

  function onGameStart(nextGame, options = {}) {
    reset(); currentGame = nextGame;
    byId('worldMapName').textContent = options.tutorial ? 'Entraînement' : label(nextGame.mapId);
    legend.setAttribute('aria-label', 'Carte et terrains : ' + byId('worldMapName').textContent);
    if (!options.resume && !options.tutorial && nextGame.mapId !== 'legacy') {
      tipTimer = setTimeout(() => {
        if (currentGame === nextGame && activeMatch() && !window.CQTutorial?.active && !ended) {
          toast(plans[nextGame.mapId]?.tip || plans.plain.tip);
        }
      }, 650);
    }
  }
  function reset() { clearTimeout(tipTimer); close(false); currentGame = null; }
  function palette() { return window.CQPalette?.current || { player: '#13adb2', playerStrong: '#175769', playerFill: '#a0e0d0', enemy: '#ed7965', enemyFill: '#f3c1ad' }; }
  function inView(tile, v) { return v.x + (tile.x + 1) * v.cell >= 0 && v.y + (tile.y + 1) * v.cell >= 0 && v.x + tile.x * v.cell <= v.w && v.y + tile.y * v.cell <= v.h; }
  function known(tile) { return tile.explored || tile.owner === 1; }
  function terrainMark(c, tile, x, y, s, preview = false) {
    if (tile.blocked) return;
    if (tile.terrain === 'absorbent') {
      c.fillStyle = '#819484'; c.globalAlpha = preview ? .4 : .27;
      const radius = Math.max(.55, s * .047);
      for (const [dx, dy] of [[.27, .28], [.74, .28], [.5, .74]]) {
        c.beginPath(); c.arc(x + s * dx, y + s * dy, radius, 0, Math.PI * 2); c.fill();
      }
    } else if (tile.terrain === 'smooth') {
      c.strokeStyle = '#537f89'; c.globalAlpha = preview ? .36 : .27;
      c.lineWidth = Math.max(.65, s * .042); c.beginPath();
      for (const offset of [.31, .69]) { c.moveTo(x + s * .27, y + s * (offset + .11)); c.lineTo(x + s * .7, y + s * (offset - .11)); }
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  function drawTerrain(c, v) {
    if (!currentGame) return;
    c.save();
    for (const tile of currentGame.tiles) if (known(tile) && inView(tile, v)) terrainMark(c, tile, v.x + tile.x * v.cell, v.y + tile.y * v.cell, v.cell);
    c.restore();
  }
  function objectiveMark(c, tile, x, y, s, preview = false) {
    if (tile.source && tile.rich) {
      c.strokeStyle = '#b08c36'; c.lineWidth = Math.max(.85, s * .065);
      c.beginPath(); c.arc(x + s / 2, y + s / 2, s * .44, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(x + s / 2, y + s / 2, s * .63, 0, Math.PI * 2); c.stroke();
    }
    if (tile.cache > 0 && (preview || tile.visible || tile.owner === 1)) {
      const r = Math.max(preview ? 1.5 : 3.3, s * .38), cx = x + s / 2, cy = y + s / 2;
      const col = palette(); c.fillStyle = paper; c.strokeStyle = col.playerStrong; c.lineWidth = Math.max(1, s * .08);
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath(); c.fill(); c.stroke();
      if (!preview) {
        c.strokeStyle = col.playerStrong; c.lineWidth = Math.max(.8, s * .065); c.beginPath();
        c.moveTo(cx - r * .38, cy); c.lineTo(cx + r * .38, cy); c.moveTo(cx, cy - r * .38); c.lineTo(cx, cy + r * .38); c.stroke();
      }
    }
  }
  function drawObjectives(c, v) {
    if (!currentGame) return;
    c.save();
    for (const tile of currentGame.tiles) if (known(tile) && inView(tile, v)) objectiveMark(c, tile, v.x + tile.x * v.cell, v.y + tile.y * v.cell, v.cell);
    c.restore();
  }
  function drawPreview(canvas, id) {
    const tiles = window.CQMaps?.createLayout(id); if (!tiles) return;
    const c = canvas.getContext('2d'), sx = canvas.width / CQMaps.WIDTH, sy = canvas.height / CQMaps.HEIGHT, col = palette();
    c.clearRect(0, 0, canvas.width, canvas.height); c.fillStyle = paper; c.fillRect(0, 0, canvas.width, canvas.height);
    for (const tile of tiles) {
      const x = tile.x * sx, y = tile.y * sy;
      c.fillStyle = tile.blocked ? '#bcc6b9' : tile.terrain === 'absorbent' ? '#e4e9dc' : tile.terrain === 'smooth' ? '#dcebef' : paper;
      c.fillRect(x, y, sx + .1, sy + .1);
      if (tile.source) { c.fillStyle = '#be9841'; c.beginPath(); c.arc(x + sx / 2, y + sy / 2, sx * .5, 0, Math.PI * 2); c.fill(); }
      objectiveMark(c, tile, x, y, sx, true);
    }
    for (const [y, color] of [[6, col.enemy], [41, col.player]]) {
      const x = 16.5 * sx, cy = (y + .5) * sy;
      c.fillStyle = color; c.strokeStyle = paper; c.lineWidth = 1; c.beginPath();
      for (let n = 0; n < 6; n++) { const a = n * Math.PI / 3 - Math.PI / 2; c.lineTo(x + Math.cos(a) * sx * 1.65, cy + Math.sin(a) * sy * 1.65); }
      c.closePath(); c.fill(); c.stroke();
    }
  }

  picker.onclick = showPicker; legend.onclick = showLegend;
  byId('worldClose').onclick = () => close();
  byId('worldPause').onclick = () => { if (activeMatch()) { togglePause(); renderLive(); } };
  sheet.addEventListener('click', event => {
    if (event.target === sheet) { close(); return; }
    const button = event.target.closest('[data-world-map]');
    if (button && selectMap(button.dataset.worldMap)) close();
  });
  document.addEventListener('keydown', event => {
    if (!opened) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const focusable = [...sheet.querySelectorAll('button:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener('cq:palettechange', () => { sheet.querySelectorAll('[data-world-preview]').forEach(canvas => drawPreview(canvas, canvas.dataset.worldPreview)); });
  document.addEventListener('visibilitychange', () => { if (opened) requestAnimationFrame(renderLive); });
  updatePicker();
  window.CQWorldUI = { label, selectMap, onGameStart, drawTerrain, drawObjectives, inspectTile, reset, showLegend, close,
    get selectedId() { return selected; }, get isOpen() { return opened; } };
})();
