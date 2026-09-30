/* Cosmetic camp colours. These preferences never change the simulation. */
(() => {
  'use strict';
  const storageKey = 'colorquest:palette:v1';
  const paper = '#fffef9';
  function mix(a, b, amount) {
    const channels = [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount));
    return '#' + channels.map(n => n.toString(16).padStart(2, '0')).join('');
  }
  function preset(key, name, player, enemyName, enemy, overrides = {}) {
    return Object.freeze({
      key, name, player, enemyName, enemy,
      playerFill: mix(player, paper, .60),
      playerIsolated: mix(player, '#ebe6d8', .84),
      enemyFill: mix(enemy, paper, .60),
      playerHatch: mix(player, '#86968e', .52),
      enemyHatch: mix(enemy, '#948d80', .52),
      menuPlayerInner: mix(player, paper, .58),
      menuPlayerOuter: mix(player, paper, .81),
      menuEnemyInner: mix(enemy, paper, .54),
      menuEnemyOuter: mix(enemy, paper, .81),
      playerStrong: mix(player, '#20383c', .39),
      enemyStrong: mix(enemy, '#44372f', .31),
      selection: mix(player, '#1a263b', .66),
      soft: mix(player, paper, .93),
      line: mix(player, paper, .65),
      ...overrides
    });
  }
  // Opponents are paired deliberately: selecting any swatch preserves two distinct camps.
  const presets = Object.freeze([
    preset('cyan', 'Cyan', '#13adb2', 'Corail', '#ed7965', {
      playerFill: '#a0e0d0', playerIsolated: '#e6dfc6', enemyFill: '#f3c1ad',
      playerHatch: '#a7c9ba', enemyHatch: '#d3b7a4',
      menuPlayerInner: '#a8e2d6', menuPlayerOuter: '#d1ebe0',
      menuEnemyInner: '#f0b99f', menuEnemyOuter: '#eddbca'
    }),
    preset('blue', 'Bleu', '#427ccf', 'Corail', '#df775a'),
    preset('violet', 'Violet', '#9868c4', 'Menthe', '#3c9c83'),
    preset('rose', 'Rose', '#d45f93', 'Turquoise', '#25969e'),
    preset('green', 'Vert', '#429b70', 'Violet', '#a067c3'),
    preset('amber', 'Orange', '#d56d3d', 'Indigo', '#657dd0')
  ]);
  let current = presets[0];
  try {
    const stored = localStorage.getItem(storageKey);
    current = presets.find(p => p.key === stored) || current;
  } catch { /* Sandboxed, private or file browsers can disable persistent storage. */ }

  const section = document.createElement('section');
  section.className = 'palette-picker';
  section.setAttribute('aria-labelledby', 'paletteHeading');
  section.innerHTML = '<div class="palette-heading"><h2 id="paletteHeading">Votre couleur</h2><span>Au choix, sans bonus</span></div>' +
    '<div class="palette-options" role="group" aria-label="Choisir la couleur de votre camp">' +
    presets.map(p => '<button type="button" data-palette="' + p.key + '" aria-label="Choisir la couleur ' + p.name.toLowerCase() + '" aria-pressed="false" style="--swatch:' + p.player + '"><span class="palette-swatch" aria-hidden="true"><i>✓</i></span><span>' + p.name + '</span></button>').join('') +
    '</div><div class="palette-preview" aria-live="polite" aria-atomic="true"><span><i class="palette-player" aria-hidden="true"></i>Vous · <strong id="palettePlayerName"></strong></span><span class="palette-versus">contre</span><span><i class="palette-enemy" aria-hidden="true"></i>IA · <strong id="paletteEnemyName"></strong></span></div><p id="paletteStorageNote" class="palette-storage-note" role="status" hidden>Couleur conservée pour cette session uniquement.</p>';
  const difficulty = document.querySelector('.start-card .difficulty');
  if (difficulty) difficulty.before(section);
  else document.querySelector('.start-card')?.append(section);
  document.getElementById('menu')?.classList.add('has-palette');

  function apply() {
    const style = document.documentElement.style;
    for (const [key, value] of Object.entries({
      '--cyan': current.player, '--coral': current.enemy,
      '--player-color': current.player, '--enemy-color': current.enemy,
      '--player-strong': current.playerStrong, '--enemy-strong': current.enemyStrong,
      '--player-soft': current.soft, '--player-line': current.line,
      '--player-fill': current.playerFill, '--enemy-fill': current.enemyFill,
      '--player-selection': current.selection
    })) style.setProperty(key, value);
    document.documentElement.dataset.campPalette = current.key;
    // app.js exposes its drawing colours as a mutable global lexical object.
    if (typeof C !== 'undefined') { C.cyan = current.player; C.coral = current.enemy; }
    section.querySelectorAll('[data-palette]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.palette === current.key)));
    section.querySelector('#palettePlayerName').textContent = current.name;
    section.querySelector('#paletteEnemyName').textContent = current.enemyName;
    // Sound controls store their active colour inline, unlike other HUD elements.
    if (typeof soundEnabled !== 'undefined' && soundEnabled) {
      for (const id of ['sound', 'menuSound']) {
        const button = document.getElementById(id);
        if (button) button.style.color = current.playerStrong;
      }
    }
  }
  function select(key) {
    const next = presets.find(p => p.key === key);
    if (!next) return false;
    current = next;
    let saved = true;
    try { localStorage.setItem(storageKey, key); } catch { saved = false; }
    section.querySelector('#paletteStorageNote').hidden = saved;
    apply();
    document.dispatchEvent(new CustomEvent('cq:palettechange', { detail: current }));
    return true;
  }
  section.addEventListener('click', event => {
    const button = event.target.closest('[data-palette]');
    if (button && section.contains(button)) select(button.dataset.palette);
  });
  window.CQPalette = Object.freeze({ presets, select, get key() { return current.key; }, get current() { return current; } });
  apply();
})();
