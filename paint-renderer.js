/* V0.8 canvas view. Rendering is read-only: no simulation or input state lives here. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CQPaintRenderer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const PAPER = '#fffefa';
  const INK = '#294850';
  const FALLBACK = Object.freeze({
    player: '#13adb2', enemy: '#ed7965', playerFill: '#a0e0d0', enemyFill: '#f3c1ad',
    playerIsolated: '#e0e9dd', playerHatch: '#73aaa3', enemyHatch: '#c29280',
    playerStrong: '#17636c', enemyStrong: '#a94a3a', selection: '#164b5c'
  });
  const NAMES = Object.freeze({ core: 'Cœur', relay: 'Relais', extractor: 'Extracteur', bastion: 'Bastion', barracks: 'Caserne', mortar: 'Mortier' });
  const STATE_NAMES = Object.freeze({ paused: 'en pause', isolated: 'réseau coupé', held: 'visée en cours', funds: 'attend du pigment', full: 'armée complète', blocked: 'sortie bloquée' });
  const GOLD = '#a17b22';
  const CARD_INKS = Object.freeze({ blue: '#5686c7', red: '#d66d65', yellow: '#b99437' });
  const HEAL_INK = '#357953';
  const MORTAR_FALLBACK = Object.freeze({ minRange: 2.5, range: 7, blastRadius: 1.5 });

  function clamp(n, low, high) { return Math.max(low, Math.min(high, n)); }
  function palette(ui) { return ui.palette || root.CQPalette?.current || FALLBACK; }
  function teamColor(team, colors) { return (colors || FALLBACK)[team === 1 ? 'player' : 'enemy'] || FALLBACK[team === 1 ? 'player' : 'enemy']; }
  function tone(colors, key) { return colors[key] || FALLBACK[key]; }
  function roundRect(c, x, y, w, h, r) {
    const k = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w - k, y);
    c.quadraticCurveTo(x + w, y, x + w, y + k); c.lineTo(x + w, y + h - k);
    c.quadraticCurveTo(x + w, y + h, x + w - k, y + h); c.lineTo(x + k, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - k); c.lineTo(x, y + k);
    c.quadraticCurveTo(x, y, x + k, y); c.closePath();
  }
  function polygon(c, x, y, r, sides, angle) {
    c.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = angle + i * TAU / sides;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath();
  }
  function point(view, x, y, centered = true) {
    const shift = centered ? .5 : 0;
    return { x: view.x + (x + shift) * view.cell, y: view.y + (y + shift) * view.cell };
  }
  function tileIndex(game, x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return x < 0 || y < 0 || x >= game.width || y >= game.height ? -1 : y * game.width + x;
  }
  function visible(game, x, y) { const i = tileIndex(game, x, y); return i >= 0 && !!game.visibility?.[1]?.[i]; }
  function observedOwner(game, index) {
    // Current enemy paint is never read through the fog, including explored fog.
    return index >= 0 && game.visibility?.[1]?.[index] ? game.tiles[index].owner : 0;
  }
  function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function label(c, view, text, x, y, color, compact) {
    c.font = '600 ' + (compact ? 10 : 11) + 'px system-ui, sans-serif';
    const w = Math.min(view.w - 8, c.measureText(text).width + 14), h = compact ? 19 : 22;
    x = clamp(x, 4 + w / 2, view.w - 4 - w / 2);
    y = clamp(y, 4, view.h - h - 4);
    c.fillStyle = '#fffefaf5'; c.strokeStyle = '#dce3de'; c.lineWidth = 1;
    roundRect(c, x - w / 2, y, w, h, h / 2); c.fill(); c.stroke();
    c.fillStyle = color || INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, x, y + h / 2 + .4);
  }

  function droplet(c, x, y, r) {
    c.beginPath(); c.moveTo(x, y - r);
    c.bezierCurveTo(x + r * .4, y - r * .35, x + r * .8, y + r * .08, x + r * .66, y + r * .48);
    c.bezierCurveTo(x + r * .45, y + r, x - r * .45, y + r, x - r * .66, y + r * .48);
    c.bezierCurveTo(x - r * .8, y + r * .08, x - r * .4, y - r * .35, x, y - r); c.closePath();
  }
  function brokenLink(c, x, y, r, color) {
    c.save(); c.translate(x, y); c.rotate(-Math.PI / 4);
    c.strokeStyle = color; c.lineWidth = Math.max(1.1, r * .19); c.lineCap = 'round';
    c.beginPath(); c.arc(-r * .42, 0, r * .37, .65, TAU - .65); c.stroke();
    c.beginPath(); c.arc(r * .42, 0, r * .37, Math.PI + .65, Math.PI * 3 - .65); c.stroke();
    line(c, -r * .08, -r * .47, r * .08, -r * .78);
    line(c, -r * .08, r * .47, r * .08, r * .78);
    c.restore();
  }
  function observedBuildings(game) {
    // Filter sight BEFORE reading a hostile object's type, health or state.
    return game.buildings.filter(b => (b.team === 1 || visible(game, b.x, b.y)) && b.hp > 0);
  }
  function clipVisible(c, game, view, x, y, radius) {
    // Transient motifs cannot paint over unknown cells around a visible target.
    c.beginPath();
    const minX = Math.max(0, Math.floor(x - radius)), maxX = Math.min(game.width - 1, Math.ceil(x + radius));
    const minY = Math.max(0, Math.floor(y - radius)), maxY = Math.min(game.height - 1, Math.ceil(y + radius));
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
      if (visible(game, tx, ty)) c.rect(view.x + tx * view.cell, view.y + ty * view.cell, view.cell, view.cell);
    }
    c.clip();
  }
  function drawTerrain(c, game, view, colors, motion) {
    const s = view.cell, W = game.width, H = game.height;
    const owners = game.tiles.map((_, i) => observedOwner(game, i));
    const buildings = observedBuildings(game);
    const exploited = new Set(buildings.filter(b => b.type === 'extractor' && (b.team !== 1 || b.connected)).map(b => b.y * W + b.x));
    for (let i = 0; i < game.tiles.length; i++) {
      const tile = game.tiles[i], x = view.x + tile.x * s, y = view.y + tile.y * s;
      const seen = !!game.visibility?.[1]?.[i], explored = !!game.explored?.[1]?.[i], owner = owners[i];
      const isolated = owner === 1 && !tile.connected;
      let fill = seen ? PAPER : explored ? '#edf0eb' : '#e2e7e2';
      if (owner) fill = owner === 1 ? tone(colors, 'playerFill') : tone(colors, 'enemyFill');
      if (isolated) fill = tone(colors, 'playerIsolated');
      c.fillStyle = fill; c.fillRect(x, y, s + .3, s + .3);
      if (!seen) {
        // Texture has no relation to hidden territory or occupancy.
        c.strokeStyle = explored ? '#74857716' : '#74857725'; c.lineWidth = .7;
        line(c, x + s * .12, y + s * .72, x + s * .72, y + s * .12);
        c.fillStyle = '#74857723'; c.fillRect(x + s * .72, y + s * .72, .9, .9);
      }
      if (isolated) {
        c.strokeStyle = tone(colors, 'playerHatch'); c.lineWidth = Math.max(.8, s * .045);
        line(c, x + s * .15, y + s, x + s, y + s * .15);
        line(c, x, y + s * .4, x + s * .4, y);
      }
      // Obstacles and source positions are public geometry; occupancy is not.
      if (tile.blocked) {
        c.fillStyle = seen ? '#d5dcd3' : '#d1d9cf';
        roundRect(c, x + s * .08, y + s * .12, s * .84, s * .77, s * .18); c.fill();
        c.strokeStyle = '#b5c1b4'; c.lineWidth = Math.max(.7, s * .04);
        line(c, x + s * .23, y + s * .63, x + s * .66, y + s * .32);
        line(c, x + s * .5, y + s * .71, x + s * .76, y + s * .5);
      } else if (tile.source) {
        const center = point(view, tile.x, tile.y), r = Math.max(5.1, s * .36);
        c.globalAlpha = seen ? 1 : .6;
        if (exploited.has(i)) {
          c.strokeStyle = GOLD; c.lineWidth = Math.max(1.5, s * .08);
          c.beginPath(); c.arc(center.x, center.y, Math.max(r + 4, s * .77), 0, TAU); c.stroke();
        }
        c.fillStyle = '#edc867'; c.strokeStyle = '#fffefa'; c.lineWidth = Math.max(2, s * .14);
        polygon(c, center.x, center.y, r, 4, -Math.PI / 2); c.fill(); c.stroke();
        c.strokeStyle = GOLD; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#765913'; droplet(c, center.x, center.y, r * .53); c.fill();
        // Tiny sparkle, never a permanent halo that would imply exploitation.
        if (seen && !exploited.has(i)) {
          c.globalAlpha = .45 + Math.sin(motion * 2 + tile.x) * .2; c.strokeStyle = GOLD; c.lineWidth = 1;
          line(c, center.x + r * .78, center.y - r * .9, center.x + r * 1.2, center.y - r * .9);
          line(c, center.x + r, center.y - r * 1.1, center.x + r, center.y - r * .7);
        }
        c.globalAlpha = 1;
      }
    }
    // Show territory edges, including the boundary of an isolated patch.
    c.lineWidth = Math.max(.9, s * .06); c.lineCap = 'butt';
    for (let i = 0; i < owners.length; i++) {
      if (!owners[i]) continue;
      const tile = game.tiles[i], x = view.x + tile.x * s, y = view.y + tile.y * s;
      const isolated = owners[i] === 1 && !tile.connected;
      const same = j => owners[j] === owners[i] && (!isolated || !game.tiles[j].connected);
      c.strokeStyle = isolated ? tone(colors, 'playerStrong') : teamColor(owners[i], colors);
      c.globalAlpha = isolated ? .6 : .65; c.setLineDash(isolated ? [Math.max(2, s * .23), Math.max(2, s * .17)] : []);
      if (tile.y === 0 || !same(i - W)) line(c, x, y, x + s, y);
      if (tile.x === W - 1 || !same(i + 1)) line(c, x + s, y, x + s, y + s);
      if (tile.y === H - 1 || !same(i + W)) line(c, x + s, y + s, x, y + s);
      if (tile.x === 0 || !same(i - 1)) line(c, x, y + s, x, y);
    }
    c.globalAlpha = 1; c.lineCap = 'round'; c.setLineDash([]);
    // One broken-link sign per disconnected island, without inventing a loss timer.
    const visited = new Set(), occupied = new Set(buildings.map(b => b.y * W + b.x));
    for (let i = 0; i < owners.length; i++) {
      if (owners[i] !== 1 || game.tiles[i].connected || visited.has(i)) continue;
      const patch = [i]; visited.add(i);
      for (let n = 0; n < patch.length; n++) {
        const at = patch[n], t = game.tiles[at];
        const near = [[t.x, t.y - 1], [t.x + 1, t.y], [t.x, t.y + 1], [t.x - 1, t.y]];
        for (const [nx, ny] of near) {
          const j = tileIndex(game, nx, ny);
          if (j >= 0 && owners[j] === 1 && !game.tiles[j].connected && !visited.has(j)) { visited.add(j); patch.push(j); }
        }
      }
      const cx = patch.reduce((sum, j) => sum + game.tiles[j].x, 0) / patch.length;
      const cy = patch.reduce((sum, j) => sum + game.tiles[j].y, 0) / patch.length;
      const candidates = patch.filter(j => !occupied.has(j) && !game.tiles[j].source);
      const anchor = (candidates.length ? candidates : patch).reduce((best, j) => {
        const t = game.tiles[j], b = game.tiles[best];
        return (t.x - cx) ** 2 + (t.y - cy) ** 2 < (b.x - cx) ** 2 + (b.y - cy) ** 2 ? j : best;
      });
      const t = game.tiles[anchor], p = point(view, t.x, t.y), r = Math.max(5, Math.min(8, s * .38));
      c.fillStyle = '#fffefaec'; c.beginPath(); c.arc(p.x, p.y, r + 1, 0, TAU); c.fill();
      brokenLink(c, p.x, p.y, r * .85, tone(colors, 'playerStrong'));
    }
  }

  function health(c, x, y, r, hp, maxHp, color) {
    if (!(maxHp > 0) || hp >= maxHp) return;
    const w = Math.max(16, r * 2), h = 3;
    c.fillStyle = '#fffefadd'; roundRect(c, x - w / 2 - 1, y - 1, w + 2, h + 2, 2); c.fill();
    c.fillStyle = '#dce3dc'; c.fillRect(x - w / 2, y, w, h);
    c.fillStyle = color; c.fillRect(x - w / 2, y, w * clamp(hp / maxHp, 0, 1), h);
  }
  function productionState(game, b) {
    if (b.type !== 'barracks') return '';
    if (b.productionState) return b.productionState;
    if (b.productionPaused) return 'paused';
    if (!b.connected) return 'isolated';
    return 'running';
  }
  function statusBadge(c, x, y, r, state, color) {
    if (!state || state === 'running' || state === 'none') return;
    const size = Math.max(5.8, r * .46), bx = x + r * .82, by = y - r * .78;
    c.fillStyle = '#fffefa'; c.strokeStyle = state === 'isolated' ? '#986a51' : color; c.lineWidth = 1.2;
    c.beginPath(); c.arc(bx, by, size, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = INK; c.lineWidth = Math.max(1.3, size * .24);
    if (state === 'paused' || state === 'held') {
      line(c, bx - size * .25, by - size * .38, bx - size * .25, by + size * .38);
      line(c, bx + size * .25, by - size * .38, bx + size * .25, by + size * .38);
    } else if (state === 'isolated') brokenLink(c, bx, by, size * .74, '#986a51');
    else if (state === 'blocked') {
      line(c, bx - size * .38, by + size * .38, bx + size * .38, by - size * .38);
      line(c, bx - size * .38, by - size * .38, bx + size * .38, by + size * .38);
    } else if (state === 'full') {
      line(c, bx - size * .4, by - size * .2, bx + size * .4, by - size * .2);
      line(c, bx - size * .4, by + size * .2, bx + size * .4, by + size * .2);
    } else if (state === 'funds') {
      droplet(c, bx, by - .2, size * .63); c.stroke();
      c.strokeStyle = '#986a51'; line(c, bx - size * .55, by + size * .55, bx + size * .55, by - size * .55);
    }
  }
  function buildingShape(c, type, p, r) {
    if (type === 'core') polygon(c, p.x, p.y, r, 6, -Math.PI / 2);
    else if (type === 'relay') polygon(c, p.x, p.y, r, 4, -Math.PI / 2);
    else if (type === 'bastion') {
      c.beginPath(); c.moveTo(p.x - r * .84, p.y - r * .72); c.lineTo(p.x + r * .84, p.y - r * .72);
      c.lineTo(p.x + r * .84, p.y + r * .12); c.quadraticCurveTo(p.x + r * .65, p.y + r * .65, p.x, p.y + r);
      c.quadraticCurveTo(p.x - r * .65, p.y + r * .65, p.x - r * .84, p.y + r * .12); c.closePath();
    } else if (type === 'barracks') {
      c.beginPath(); c.moveTo(p.x - r, p.y + r * .8); c.lineTo(p.x - r, p.y - r * .78);
      for (let n = 0; n < 3; n++) {
        const x = p.x - r + n * r * .7;
        c.lineTo(x + r * .36, p.y - r * .78); c.lineTo(x + r * .36, p.y - r * .45);
        c.lineTo(x + r * .63, p.y - r * .45); c.lineTo(x + r * .63, p.y - r * .78);
      }
      c.lineTo(p.x + r, p.y + r * .8); c.closePath();
    } else if (type === 'mortar') {
      // Slanted tube above a wide plinth; unlike a round droplet or shield.
      c.beginPath(); c.moveTo(p.x - r * .94, p.y + r * .75); c.lineTo(p.x - r * .71, p.y + r * .18);
      c.lineTo(p.x - r * .25, p.y + r * .18); c.lineTo(p.x - r * .58, p.y - r * .56);
      c.lineTo(p.x + r * .05, p.y - r * .91); c.lineTo(p.x + r * .6, p.y + r * .18);
      c.lineTo(p.x + r * .74, p.y + r * .18); c.lineTo(p.x + r * .94, p.y + r * .75); c.closePath();
    } else { c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); }
  }
  function producerNumber(game, id) {
    const list = game.buildings.filter(b => b.team === 1 && b.hp > 0 && b.type === 'barracks').sort((a, b) => Number(a.id) - Number(b.id));
    return list.findIndex(b => String(b.id) === String(id)) + 1;
  }
  function building(c, game, view, colors, b, selected, ghost) {
    const p = point(view, b.x, b.y), s = view.cell;
    const r = Math.max(b.type === 'core' ? 12 : 8.5, s * (b.type === 'core' ? .8 : b.type === 'barracks' || b.type === 'mortar' ? .58 : .51));
    const color = teamColor(b.team, colors);
    c.save();
    if (ghost) c.globalAlpha = .65;
    if (selected) {
      c.fillStyle = '#ffffff90'; c.strokeStyle = tone(colors, 'selection'); c.lineWidth = 1.8;
      c.beginPath(); c.arc(p.x, p.y, r + Math.max(5, s * .25), 0, TAU); c.fill(); c.stroke();
    }
    if (!ghost && b.type === 'barracks' && b.team === 1) {
      const interval = root.CQPaintEngine?.CONFIG?.unitInterval || 5;
      const fraction = clamp((b.productionProgress || 0) / interval, 0, 1);
      c.strokeStyle = '#fffeface'; c.lineWidth = Math.max(2, s * .14);
      c.beginPath(); c.arc(p.x, p.y, r + s * .2, 0, TAU); c.stroke();
      if (fraction > 0) {
        c.strokeStyle = tone(colors, 'playerStrong'); c.lineWidth = Math.max(2, s * .14);
        c.beginPath(); c.arc(p.x, p.y, r + s * .2, -Math.PI / 2, -Math.PI / 2 + fraction * TAU); c.stroke();
      }
    }
    c.shadowColor = '#304b4e28'; c.shadowBlur = 3; c.shadowOffsetY = 1.5;
    buildingShape(c, b.type, p, r);
    c.fillStyle = color; c.fill();
    // The white rim keeps camp objects clear on colour; its dark edge survives white paper.
    c.strokeStyle = b.team === 1 ? tone(colors, 'playerStrong') : tone(colors, 'enemyStrong'); c.lineWidth = Math.max(3.4, s * .22); c.stroke();
    c.strokeStyle = PAPER; c.lineWidth = Math.max(1.8, s * .12); c.stroke();
    c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.fillStyle = PAPER; c.strokeStyle = PAPER; c.lineWidth = Math.max(1.3, s * .07);
    if (b.type === 'core') {
      if (b.team === 1) roundRect(c, p.x - r * .32, p.y - r * .32, r * .64, r * .64, r * .12);
      else polygon(c, p.x, p.y, r * .43, 3, -Math.PI / 2);
      c.fill();
      if (b.level > 1 && !ghost) {
        c.fillStyle = b.team === 1 ? tone(colors, 'playerStrong') : tone(colors, 'enemyStrong');
        c.font = '800 ' + Math.max(8, Math.min(11, s * .44)) + 'px system-ui, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(b.level), p.x, p.y + .2);
      }
    } else if (b.type === 'barracks') {
      for (let n = -1; n <= 1; n++) c.fillRect(p.x + n * r * .46 - r * .1, p.y - r * .24, r * .2, r * .6);
      if (b.team === 1 && !ghost) {
        const num = producerNumber(game, b.id);
        c.fillStyle = tone(colors, 'playerStrong'); c.strokeStyle = PAPER; c.lineWidth = 1;
        c.beginPath(); c.arc(p.x - r * .9, p.y - r * .7, 5.5, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = PAPER; c.font = '700 8px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(num), p.x - r * .9, p.y - r * .7 + .3);
      }
    } else if (b.type === 'extractor') {
      droplet(c, p.x, p.y - r * .08, r * .62); c.fill();
      c.strokeStyle = GOLD; c.lineWidth = Math.max(1.1, s * .05); c.stroke();
    } else if (b.type === 'bastion') {
      line(c, p.x, p.y - r * .35, p.x, p.y + r * .4);
      line(c, p.x - r * .32, p.y - r * .04, p.x + r * .32, p.y - r * .04);
    } else if (b.type === 'mortar') {
      line(c, p.x - r * .31, p.y - r * .47, p.x + r * .04, p.y + r * .15);
      line(c, p.x - r * .49, p.y + r * .49, p.x + r * .5, p.y + r * .49);
    } else {
      c.beginPath(); c.arc(p.x, p.y, r * .18, 0, TAU); c.fill();
      c.beginPath(); c.arc(p.x, p.y, r * .51, -Math.PI * .27, Math.PI * .27); c.stroke();
      c.beginPath(); c.arc(p.x, p.y, r * .51, Math.PI * .73, Math.PI * 1.27); c.stroke();
    }
    if (!ghost) {
      health(c, p.x, p.y + r + 4, r, b.hp, b.maxHp, color);
      // Production state is private. Hostile structures only show their camp marker.
      if (b.team === 1) statusBadge(c, p.x, p.y, r, b.connected === false ? 'isolated' : productionState(game, b), color);
      else if (b.type !== 'core') {
        c.fillStyle = tone(colors, 'enemyStrong'); c.strokeStyle = PAPER; c.lineWidth = 1;
        polygon(c, p.x + r * .85, p.y - r * .7, Math.max(3.5, s * .22), 3, -Math.PI / 2); c.fill(); c.stroke();
      }
    }
    c.restore();
  }

  function unitGroups(game, view) {
    const units = game.units.filter(u => (u.team === 1 || visible(game, u.x, u.y)) && u.hp > 0);
    const hostileBuildings = observedBuildings(game).filter(b => b.team !== 1);
    const groups = [], zoomedOut = view.cell <= 22;
    for (const u of units) {
      // Keep each fighter at its real position on a front, and on zoomed-in views.
      const nearFight = u.team === 1 && (units.some(v => v.team !== 1 && Math.hypot(v.x - u.x, v.y - u.y) < 2.4) || hostileBuildings.some(b => Math.hypot(b.x + .5 - u.x, b.y + .5 - u.y) < 4.5));
      const canMerge = zoomedOut && u.team === 1 && !nearFight;
      let group = canMerge && groups.find(g => g.merge && g.producerId === u.producerId && g.retreating === !!u.retreating && Math.hypot(g.anchor.x - u.x, g.anchor.y - u.y) < .8);
      if (!group) {
        group = { team: u.team, anchor: u, producerId: u.team === 1 ? u.producerId : null, retreating: u.team === 1 && !!u.retreating, merge: canMerge, x: 0, y: 0, hp: 0, maxHp: 0, count: 0 };
        groups.push(group);
      }
      group.x += u.x; group.y += u.y; group.hp += u.hp; group.maxHp += u.maxHp; group.count++;
    }
    return groups;
  }
  function drawUnits(c, game, view, colors, ui) {
    const selected = ui.selectedProducer;
    for (const group of unitGroups(game, view)) {
      const p = point(view, group.x / group.count, group.y / group.count, false);
      const r = Math.max(2.9, view.cell * .24), color = teamColor(group.team, colors);
      const picked = group.team === 1 && selected != null && String(group.producerId) === String(selected);
      if (group.count > 1) {
        const w = group.count > 9 ? 37 : 31, h = 17;
        c.fillStyle = '#fffefa'; c.strokeStyle = picked ? tone(colors, 'selection') : tone(colors, 'playerStrong'); c.lineWidth = picked ? 2 : 1.2;
        roundRect(c, p.x - w / 2, p.y - h / 2, w, h, 8); c.fill(); c.stroke();
        c.fillStyle = color;
        const producer = game.buildings.find(b => b.team === 1 && String(b.id) === String(group.producerId));
        const icon = { x: p.x - w / 2 + 8.5, y: p.y };
        if (producer?.type === 'core') polygon(c, icon.x, icon.y, 5.3, 6, -Math.PI / 2);
        else roundRect(c, icon.x - 5.3, icon.y - 5.3, 10.6, 10.6, 2);
        c.fill();
        const number = producer?.type === 'barracks' ? producerNumber(game, group.producerId) : 0;
        if (number) {
          c.fillStyle = PAPER; c.font = '700 8px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(number), icon.x, icon.y + .2);
        } else if (producer?.type !== 'core') {
          c.strokeStyle = PAPER; c.lineWidth = 1; line(c, icon.x - 2, icon.y - 3, icon.x - 2, icon.y + 3); line(c, icon.x + 2, icon.y - 3, icon.x + 2, icon.y + 3);
        }
        c.fillStyle = tone(colors, 'playerStrong'); c.font = '800 11px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(group.count), p.x + 7, p.y + .3);
        if (group.retreating) {
          c.strokeStyle = tone(colors, 'playerStrong'); c.lineWidth = 1.3; c.setLineDash([2, 3]);
          roundRect(c, p.x - w / 2 - 3, p.y - h / 2 - 3, w + 6, h + 6, 10); c.stroke(); c.setLineDash([]);
        }
        health(c, p.x, p.y + h / 2 + 3, w / 2 - 2, group.hp, group.maxHp, color);
      } else {
        if (picked) {
          c.strokeStyle = tone(colors, 'selection'); c.lineWidth = 1;
          c.beginPath(); c.arc(p.x, p.y, r + 2, 0, TAU); c.stroke();
        }
        c.fillStyle = '#24484f18'; c.beginPath(); c.ellipse(p.x, p.y + r * .72, r * 1.08, r * .5, 0, 0, TAU); c.fill();
        c.fillStyle = color; c.strokeStyle = PAPER; c.lineWidth = Math.max(1, view.cell * .065);
        if (group.team === 1) { c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); }
        else polygon(c, p.x, p.y, r * 1.22, 3, -Math.PI / 2);
        c.fill(); c.stroke();
        if (group.retreating) {
          c.strokeStyle = tone(colors, 'playerStrong'); c.lineWidth = 1.1;
          const home = game.buildings.find(b => b.team === 1 && String(b.id) === String(group.producerId));
          if (home) {
            const to = point(view, home.x, home.y), angle = Math.atan2(to.y - p.y, to.x - p.x);
            const end = { x: p.x + Math.cos(angle) * (r + 4), y: p.y + Math.sin(angle) * (r + 4) };
            arrow(c, p, end, 3);
          }
        }
        health(c, p.x, p.y + r + 3, r, group.hp, group.maxHp, color);
      }
    }
  }

  function arrow(c, from, to, size) {
    const a = Math.atan2(to.y - from.y, to.x - from.x);
    c.beginPath(); c.moveTo(to.x - Math.cos(a - .55) * size, to.y - Math.sin(a - .55) * size);
    c.lineTo(to.x, to.y); c.lineTo(to.x - Math.cos(a + .55) * size, to.y - Math.sin(a + .55) * size); c.stroke();
  }
  function drawFlow(c, game, view, colors, ui, motion) {
    const producers = game.buildings.filter(b => b.team === 1 && b.hp > 0 && (b.type === 'core' || b.type === 'barracks'));
    c.save(); c.lineCap = 'round';
    for (const b of producers) {
      const dragging = ui.flowDrag && String(ui.flowDrag.producerId) === String(b.id);
      const selected = String(ui.selectedProducer) === String(b.id) || dragging;
      const target = dragging ? ui.flowDrag : b.flow;
      if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) continue;
      const returning = !dragging && b.flowMode === 'defend';
      const group = returning ? game.units.filter(u => u.team === 1 && u.hp > 0 && u.producerId === b.id && u.retreating) : [];
      if (returning && !group.length) continue;
      const from = returning ? point(view, group.reduce((sum, u) => sum + u.x, 0) / group.length, group.reduce((sum, u) => sum + u.y, 0) / group.length, false) : point(view, b.x, b.y);
      const to = point(view, target.x, target.y), distance = Math.hypot(to.x - from.x, to.y - from.y);
      c.globalAlpha = selected ? .95 : .46;
      if (distance > view.cell * .75) {
        c.strokeStyle = '#fffefad9'; c.lineWidth = selected ? 3.5 : 2.5; line(c, from.x, from.y, to.x, to.y);
        c.strokeStyle = tone(colors, 'playerStrong'); c.lineWidth = selected ? 1.7 : 1.1;
        c.setLineDash(returning ? [5, 3, 1, 3] : [1, 4]); c.lineDashOffset = -motion * (returning ? 6 : 8);
        line(c, from.x, from.y, to.x, to.y); c.setLineDash([]);
        arrow(c, from, to, Math.max(5, view.cell * .35));
        if (returning) {
          const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
          arrow(c, from, midpoint, 5);
        }
      }
      if (selected && !returning) {
        c.strokeStyle = tone(colors, 'playerStrong'); c.fillStyle = '#fffefa90'; c.lineWidth = 1.4;
        c.beginPath(); c.arc(to.x, to.y, view.cell * .36, 0, TAU); c.fill(); c.stroke();
      }
      if (returning && selected) label(c, view, 'Repli', from.x, from.y - 25, tone(colors, 'playerStrong'), true);
    }
    c.restore();
  }

  function mortarStats() { return root.CQPaintEngine?.BUILDING_STATS?.mortar || MORTAR_FALLBACK; }
  function reticle(c, p, radius, color, dash) {
    c.strokeStyle = PAPER; c.lineWidth = 3.6; c.setLineDash(dash || []);
    c.beginPath(); c.arc(p.x, p.y, radius, 0, TAU); c.stroke();
    c.strokeStyle = color; c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
    const arm = Math.max(3.5, Math.min(7, radius * .3));
    line(c, p.x - arm, p.y, p.x + arm, p.y); line(c, p.x, p.y - arm, p.x, p.y + arm);
  }
  function drawMortarAim(c, game, view, colors, ui) {
    if (ui.mode === 'brush' || ui.mode === 'card') return;
    const b = game.buildings.find(b => b.team === 1 && b.type === 'mortar' && b.hp > 0 && String(b.id) === String(ui.selectedProducer));
    if (!b) return;
    const stats = mortarStats(), from = point(view, b.x, b.y);
    const aim = ui.mortarAim && String(ui.mortarAim.producerId) === String(b.id) ? ui.mortarAim : null;
    const target = aim || b.mortarTarget;
    c.save(); c.lineWidth = 1.15;
    // Two thin bounds are shown only while inspecting or aiming this weapon.
    c.strokeStyle = tone(colors, 'playerStrong'); c.globalAlpha = .55; c.setLineDash([6, 5]);
    c.beginPath(); c.arc(from.x, from.y, stats.range * view.cell, 0, TAU); c.stroke();
    c.strokeStyle = '#8b7066'; c.globalAlpha = .7; c.setLineDash([2, 4]);
    c.beginPath(); c.arc(from.x, from.y, stats.minRange * view.cell, 0, TAU); c.stroke(); c.setLineDash([]);
    c.globalAlpha = 1;
    if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
      const to = point(view, target.x, target.y), valid = aim ? aim.ok !== false : visible(game, target.x, target.y) && b.connected !== false;
      const color = valid ? tone(colors, 'playerStrong') : aim ? '#b8493e' : '#8b8177';
      const height = Math.min(42, Math.hypot(to.x - from.x, to.y - from.y) * .2);
      c.strokeStyle = color; c.lineWidth = 1.5; c.setLineDash([2, 4]);
      c.beginPath(); c.moveTo(from.x, from.y);
      c.quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2 - height, to.x, to.y); c.stroke(); c.setLineDash([]);
      reticle(c, to, stats.blastRadius * view.cell, color, [3, 4]);
      if (aim && !valid) {
        const d = Math.max(5, view.cell * .33); c.lineWidth = 2;
        line(c, to.x - d, to.y - d, to.x + d, to.y + d); line(c, to.x + d, to.y - d, to.x - d, to.y + d);
      }
    }
    c.restore();
  }
  function trajectory(from, to, progress) {
    const lift = Math.min(42, Math.hypot(to.x - from.x, to.y - from.y) * .22);
    const q = 1 - progress;
    return {
      x: q * q * from.x + 2 * q * progress * (from.x + to.x) / 2 + progress * progress * to.x,
      y: q * q * from.y + 2 * q * progress * ((from.y + to.y) / 2 - lift) + progress * progress * to.y
    };
  }
  function drawShells(c, game, view, colors, ui) {
    const buildings = observedBuildings(game);
    for (const shell of game.shells || []) {
      if (!Number.isFinite(shell.x) || !Number.isFinite(shell.y)) continue;
      const own = shell.team === 1;
      // A hostile flight has no observable cue until its landing area is visible.
      if (!own && !visible(game, shell.x, shell.y)) continue;
      if (!(shell.remaining > 0)) continue;
      const to = point(view, shell.x, shell.y, false), radius = Math.max(.3, shell.radius || mortarStats().blastRadius);
      const color = own ? tone(colors, 'playerStrong') : tone(colors, 'enemyStrong');
      const progress = clamp(1 - shell.remaining / Math.max(.01, shell.total || 1.2), 0, 1);
      c.save();
      if (!own) clipVisible(c, game, view, shell.x, shell.y, radius + 1);
      c.globalAlpha = .9; reticle(c, to, radius * view.cell, color, [3, 3]);
      c.lineWidth = 2.5; c.strokeStyle = color;
      c.beginPath(); c.arc(to.x, to.y, radius * view.cell + 3, -Math.PI / 2, -Math.PI / 2 + progress * TAU); c.stroke();
      c.restore();
      // Never consult an unseen launcher's position. A warning at the destination
      // is useful without disclosing where a hidden artillery piece was placed.
      const sourceKnown = own || buildings.some(b => b.id === shell.sourceId);
      if (!sourceKnown || !Number.isFinite(shell.fromX) || !Number.isFinite(shell.fromY) || ui.reducedMotion) continue;
      const from = point(view, shell.fromX, shell.fromY, false), at = trajectory(from, to, progress);
      const tail = trajectory(from, to, Math.max(0, progress - .13));
      if (!own && !visible(game, (at.x - view.x) / view.cell, (at.y - view.y) / view.cell)) continue;
      c.save(); c.lineWidth = 2; c.strokeStyle = color; c.globalAlpha = .65; line(c, tail.x, tail.y, at.x, at.y);
      c.globalAlpha = 1; c.fillStyle = color; c.strokeStyle = PAPER; c.lineWidth = 1.5;
      c.beginPath(); c.arc(at.x, at.y, Math.max(3, view.cell * .21), 0, TAU); c.fill(); c.stroke(); c.restore();
    }
  }

  function drawBrush(c, game, view, colors, ui) {
    const result = ui.preview;
    const hasAcceptedPath = Array.isArray(result?.path);
    const path = hasAcceptedPath ? result.path : (ui.stroke || []);
    const rejected = result?.rejectedPath || (result?.ok === false ? path : []);
    const validPath = result?.ok === false && !hasAcceptedPath ? [] : path;
    if (!validPath.length && !rejected.length) return;
    const color = tone(colors, 'playerStrong'), invalid = '#b8493e';
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const tile of result?.cells || validPath) {
      if (!Number.isFinite(tile.x) || !Number.isFinite(tile.y)) continue;
      const p = point(view, tile.x, tile.y);
      c.fillStyle = teamColor(1, colors) + '62'; c.fillRect(p.x - view.cell / 2, p.y - view.cell / 2, view.cell, view.cell);
      c.strokeStyle = color; c.lineWidth = 1;
      c.strokeRect(p.x - view.cell / 2 + .7, p.y - view.cell / 2 + .7, view.cell - 1.4, view.cell - 1.4);
    }
    if (validPath.length) {
      c.beginPath();
      validPath.forEach((tile, i) => { const p = point(view, tile.x, tile.y); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
      c.strokeStyle = '#fffefae8'; c.lineWidth = Math.max(5, view.cell * .46); c.stroke();
      c.strokeStyle = color; c.lineWidth = Math.max(2.2, view.cell * .17); c.stroke();
      const first = point(view, validPath[0].x, validPath[0].y), lastTile = validPath[validPath.length - 1], last = point(view, lastTile.x, lastTile.y);
      c.fillStyle = PAPER; c.strokeStyle = color; c.lineWidth = 1.7;
      c.beginPath(); c.arc(first.x, first.y, Math.max(3, view.cell * .22), 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.arc(last.x, last.y, Math.max(4, view.cell * .3), 0, TAU); c.fill(); c.stroke();
      if (Number.isFinite(result?.cost) && result.cost > 0) label(c, view, result.cost + ' pigments', last.x, last.y - view.cell - 24, color, true);
    }
    if (rejected.length) {
      // Refused cells remain red after the FIRST refusal. None look payable.
      for (const tile of rejected) {
        const p = point(view, tile.x, tile.y);
        c.fillStyle = '#d16c5522'; c.fillRect(p.x - view.cell / 2, p.y - view.cell / 2, view.cell, view.cell);
      }
      const suffix = validPath.length ? [validPath[validPath.length - 1], ...rejected] : rejected;
      c.beginPath(); suffix.forEach((tile, i) => { const p = point(view, tile.x, tile.y); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
      c.strokeStyle = '#fffefa'; c.lineWidth = Math.max(5, view.cell * .36); c.stroke();
      c.strokeStyle = invalid; c.lineWidth = Math.max(2, view.cell * .14); c.setLineDash([2, 4]); c.stroke(); c.setLineDash([]);
      const stop = point(view, rejected[0].x, rejected[0].y), k = Math.max(3, view.cell * .22);
      c.fillStyle = '#fffefae8'; c.beginPath(); c.arc(stop.x, stop.y, k + 2, 0, TAU); c.fill();
      c.strokeStyle = invalid; c.lineWidth = 1.8;
      line(c, stop.x - k, stop.y - k, stop.x + k, stop.y + k); line(c, stop.x + k, stop.y - k, stop.x - k, stop.y + k);
    }
    c.restore();
  }
  function drawPlacement(c, game, view, colors, card, target) {
    if (card?.kind !== 'building') return;
    const occupied = new Set(observedBuildings(game).map(b => b.y * game.width + b.x));
    c.save(); c.fillStyle = tone(colors, 'playerStrong'); c.globalAlpha = .48;
    for (let i = 0; i < game.tiles.length; i++) {
      if (observedOwner(game, i) !== 1) continue;
      const t = game.tiles[i];
      if (!t.connected || t.blocked || occupied.has(i) || (card.type === 'extractor' ? !t.source : t.source)) continue;
      if (target && card.type !== 'extractor' && Math.hypot(t.x - target.x, t.y - target.y) > 3.6) continue;
      const p = point(view, t.x, t.y);
      if (card.type === 'extractor') {
        c.strokeStyle = GOLD; c.lineWidth = 1.6; c.setLineDash([2, 3]);
        c.beginPath(); c.arc(p.x, p.y, Math.max(8, view.cell * .6), 0, TAU); c.stroke(); c.setLineDash([]);
      } else { c.beginPath(); c.arc(p.x, p.y, Math.max(1.2, view.cell * .07), 0, TAU); c.fill(); }
    }
    c.restore();
  }

  function drawCard(c, game, view, colors, ui) {
    const result = ui.preview, target = ui.previewPoint || ui.target || result;
    const cards = root.CQPaintEngine?.CARDS || {};
    const card = cards[result?.cardId || game.hands?.[1]?.[ui.selectedCard]];
    drawPlacement(c, game, view, colors, card, target);
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    const p = point(view, target.x, target.y), valid = result?.ok !== false;
    const color = valid ? tone(colors, 'playerStrong') : '#b45645';
    const radius = (result?.radius ?? card?.radius ?? (card?.kind === 'building' ? .7 : 1.3)) * view.cell;
    c.save(); c.fillStyle = valid ? '#ffffff75' : '#d8897523'; c.strokeStyle = color; c.lineWidth = 1.7;
    c.setLineDash([5, 3]); c.beginPath(); c.arc(p.x, p.y, radius, 0, TAU); c.fill(); c.stroke(); c.setLineDash([]);
    if (card?.kind === 'building') building(c, game, view, colors, { team: 1, type: card.type || card.id, x: target.x, y: target.y }, false, true);
    else {
      c.lineWidth = 1.2;
      line(c, p.x - view.cell * .3, p.y, p.x + view.cell * .3, p.y);
      line(c, p.x, p.y - view.cell * .3, p.x, p.y + view.cell * .3);
    }
    if (!valid) {
      const d = view.cell * .4; c.lineWidth = 2.1;
      line(c, p.x - d, p.y - d, p.x + d, p.y + d); line(c, p.x + d, p.y - d, p.x - d, p.y + d);
    }
    c.restore();
  }

  function drawEffects(c, game, view, colors, ui) {
    // Effects are bounded independently from match length; no random state or DOM work.
    const effects = (game.events || []).slice(-40).concat((ui.effects || []).slice(-12));
    for (const ev of effects) {
      const age = game.time - (Number.isFinite(ev.time) ? ev.time : game.time);
      const duration = ev.type === 'mixture' ? 3 : .75;
      const origin = Number.isFinite(ev.x) && Number.isFinite(ev.y) ? ev : ev.cells?.[0];
      if (age < 0 || age > duration || !origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) continue;
      if (!visible(game, origin.x, origin.y)) continue;
      const centered = ev.type !== 'spawn' && !(ev.type === 'damage' && ev.objectType === 'droplet');
      const card = ev.type === 'power' ? root.CQPaintEngine?.CARDS?.[ev.cardId] : null;
      const color = ev.type === 'mixture' ? HEAL_INK : CARD_INKS[card?.color] || teamColor(ev.team || 1, colors);
      const p = point(view, origin.x, origin.y, centered), alpha = 1 - age / duration;
      const elapsed = ui.reducedMotion ? .15 : age;
      c.save(); c.globalAlpha = alpha * .8; c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.5;
      if (ev.type === 'mixture') {
        const radius = Math.max(.5, ev.radius || 2), r = radius * view.cell;
        clipVisible(c, game, view, origin.x, origin.y, radius + 1);
        c.save(); c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.clip();
        // Green remains a temporary line motif. Territory keeps its camp's fill.
        c.globalAlpha = alpha * .45; c.lineWidth = 1.3;
        const spacing = Math.max(9, view.cell * .6);
        for (let offset = -r * 2; offset < r * 2; offset += spacing) line(c, p.x - r, p.y + offset + r, p.x + r, p.y + offset - r);
        c.restore(); c.globalAlpha = alpha * .85; c.lineWidth = 1.6; c.setLineDash([1, 5]);
        c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke(); c.setLineDash([]);
        const arm = Math.max(6, Math.min(10, view.cell * .5));
        c.strokeStyle = PAPER; c.lineWidth = 6; line(c, p.x - arm, p.y, p.x + arm, p.y); line(c, p.x, p.y - arm, p.x, p.y + arm);
        c.strokeStyle = color; c.lineWidth = 3; line(c, p.x - arm, p.y, p.x + arm, p.y); line(c, p.x, p.y - arm, p.x, p.y + arm);
      } else if (ev.type === 'mortar-impact') {
        const radius = Math.max(.5, ev.radius || 1.5);
        clipVisible(c, game, view, origin.x, origin.y, radius + 1);
        const r = radius * view.cell * (.6 + elapsed * .55);
        c.lineWidth = ui.reducedMotion ? 2 : 2.5; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke();
        for (let n = 0; n < 8; n++) {
          const a = n * TAU / 8;
          line(c, p.x + Math.cos(a) * r * .45, p.y + Math.sin(a) * r * .45, p.x + Math.cos(a) * r * .85, p.y + Math.sin(a) * r * .85);
        }
      } else if (ev.type === 'paint') {
        for (const tile of (ev.cells || []).slice(-16)) {
          if (!visible(game, tile.x, tile.y)) continue;
          const q = point(view, tile.x, tile.y);
          c.globalAlpha = alpha * .28; c.beginPath(); c.arc(q.x, q.y, view.cell * (.32 + elapsed * .65), 0, TAU); c.fill();
        }
      } else if (ev.type === 'build' || ev.type === 'spawn' || ev.type === 'recall') {
        c.beginPath(); c.arc(p.x, p.y, view.cell * (.45 + elapsed * 1.35), 0, TAU); c.stroke();
      } else if (ev.type === 'power' || ev.type === 'damage' || ev.type === 'destroy') {
        const big = ev.type === 'power' ? Math.max(1, ev.radius || 1.5) : 1;
        for (let i = 0; i < (ui.reducedMotion ? 4 : 7); i++) {
          const a = i * TAU / 7 + (Number(ev.id) || 0) * .57;
          const r = view.cell * big * (.16 + elapsed * 1.1);
          const sx = p.x + Math.cos(a) * r, sy = p.y + Math.sin(a) * r;
          // Splashes never reveal locations of a hidden target across the sight edge.
          if (!visible(game, (sx - view.x) / view.cell, (sy - view.y) / view.cell)) continue;
          c.beginPath(); c.ellipse(sx, sy, Math.max(1, view.cell * .1 * alpha), Math.max(1.4, view.cell * .17 * alpha), a, 0, TAU); c.fill();
        }
        if (ev.type === 'power') {
          c.setLineDash([2, 4]); c.beginPath(); c.arc(p.x, p.y, view.cell * big * (.4 + elapsed * .3), 0, TAU); c.stroke(); c.setLineDash([]);
          // Card inks remain transient motifs, never another territory ownership fill.
          c.globalAlpha = alpha;
          c.font = '700 ' + Math.max(12, Math.min(20, view.cell * .95)) + 'px system-ui, sans-serif';
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = '#fffefa';
          const symbol = ev.cardId === 'wave' ? '≈' : ev.cardId === 'bleach' ? '▱' : '✦';
          c.strokeText(symbol, p.x, p.y); c.fillText(symbol, p.x, p.y);
        }
      }
      c.restore();
    }
  }

  function drawHand(c, x, y, alpha) {
    // Original Canvas finger icon: stays crisp at every zoom, without an asset dependency.
    c.save(); c.translate(x + 5, y + 3); c.rotate(-.24); c.globalAlpha = alpha;
    c.fillStyle = '#fffefa'; c.strokeStyle = INK; c.lineWidth = 1.6;
    c.shadowColor = '#1b3a4426'; c.shadowBlur = 4; c.shadowOffsetY = 2;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0, -4, -3, -4); c.quadraticCurveTo(-6, -4, -6, 0);
    c.lineTo(-6, 11); c.lineTo(-9, 8); c.quadraticCurveTo(-13, 6, -13, 10);
    c.lineTo(-7, 21); c.quadraticCurveTo(-4, 25, 1, 25); c.lineTo(7, 25);
    c.quadraticCurveTo(12, 23, 12, 17); c.lineTo(12, 9); c.quadraticCurveTo(10, 6, 8, 9);
    c.lineTo(8, 6); c.quadraticCurveTo(5, 3, 3, 7); c.lineTo(3, 5); c.quadraticCurveTo(1, 2, 0, 5);
    c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  function drawTutorial(c, game, view, colors, ui, motion) {
    const tutorial = ui.tutorial;
    if (!tutorial || tutorial.complete || tutorial.completed) return;
    const target = tutorial.target;
    const drawing = ui.stroke?.length || ui.flowDrag || ui.previewPoint;
    c.save();
    if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
      const p = point(view, target.x, target.y), pulse = ui.reducedMotion ? .5 : (Math.sin(motion * 3) + 1) / 2;
      const r = Math.max(11, view.cell * .72) + pulse * 4;
      c.fillStyle = '#eac2591c'; c.strokeStyle = GOLD; c.lineWidth = 1.8; c.globalAlpha = .6 + pulse * .3;
      c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill(); c.stroke();
      c.globalAlpha = 1; c.strokeStyle = '#fffefa'; c.lineWidth = 3.5;
      const tip = { x: p.x, y: p.y - r - 2 }, from = { x: p.x, y: p.y - r - 12 };
      line(c, from.x, from.y, tip.x, tip.y); arrow(c, from, tip, 5);
      c.strokeStyle = GOLD; c.lineWidth = 1.8; line(c, from.x, from.y, tip.x, tip.y); arrow(c, from, tip, 5);
    }
    const path = tutorial.handDemo?.path?.length ? tutorial.handDemo.path : tutorial.path;
    if (!drawing && path?.length) {
      const points = path.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => point(view, p.x, p.y));
      if (points.length) {
        c.strokeStyle = '#fffefae8'; c.lineWidth = 4; c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke();
        c.strokeStyle = GOLD; c.lineWidth = 1.4; c.setLineDash([3, 5]); c.stroke(); c.setLineDash([]);
        if (points.length > 1) arrow(c, points[points.length - 2], points[points.length - 1], 6);
        const progress = ui.reducedMotion ? .5 : Math.min(1, (motion % 3.4) / 2.7);
        const distance = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
        let remaining = distance.reduce((a, b) => a + b, 0) * progress, hand = points[0];
        for (let i = 0; i < distance.length; i++) {
          if (remaining <= distance[i] || i === distance.length - 1) {
            const fraction = distance[i] ? Math.min(1, remaining / distance[i]) : 0;
            hand = { x: points[i].x + (points[i + 1].x - points[i].x) * fraction, y: points[i].y + (points[i + 1].y - points[i].y) * fraction }; break;
          }
          remaining -= distance[i];
        }
        drawHand(c, hand.x, hand.y, .9);
      }
    }
    c.restore();
  }

  function draw(c, game, view, ui = {}, time = 0) {
    if (!c || !game || !view || !(view.cell > 0)) return;
    const colors = palette(ui), s = view.cell;
    const motion = ui.reducedMotion ? 0 : Number.isFinite(game.time) ? game.time : time;
    c.save(); c.clearRect(0, 0, view.w, view.h); c.fillStyle = '#f1f3ec'; c.fillRect(0, 0, view.w, view.h);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const x = view.x, y = view.y, w = game.width * s, h = game.height * s;
    c.fillStyle = PAPER; c.fillRect(x, y, w, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    drawTerrain(c, game, view, colors, motion);
    drawFlow(c, game, view, colors, ui, motion);
    drawMortarAim(c, game, view, colors, ui);
    for (const b of observedBuildings(game)) {
      const selected = b.team === 1 && ui.selectedProducer != null && String(b.id) === String(ui.selectedProducer);
      building(c, game, view, colors, b, selected, false);
    }
    drawUnits(c, game, view, colors, ui);
    drawShells(c, game, view, colors, ui);
    drawEffects(c, game, view, colors, ui);
    if (ui.mode === 'brush') drawBrush(c, game, view, colors, ui);
    else if (ui.mode === 'card') drawCard(c, game, view, colors, ui);
    if (ui.selectedSource) {
      const p = point(view, ui.selectedSource.x, ui.selectedSource.y);
      c.strokeStyle = GOLD; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, Math.max(11, s * .8), 0, TAU); c.stroke();
    }
    drawTutorial(c, game, view, colors, ui, motion);
    c.restore();
    c.strokeStyle = '#cfd9cf'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);

    // A single selected label replaces a permanent map legend/help panel.
    const b = game.buildings.find(b => b.team === 1 && b.hp > 0 && ui.selectedProducer != null && String(b.id) === String(ui.selectedProducer));
    if (b && ui.mode === 'navigate' && !ui.flowDrag && !ui.mortarAim) {
      const p = point(view, b.x, b.y), state = b.connected === false ? 'isolated' : productionState(game, b);
      if (p.x >= 0 && p.x <= view.w && p.y >= 0 && p.y <= view.h) {
        const range = b.type === 'mortar' ? ' · ' + String(mortarStats().minRange).replace('.', ',') + '–' + mortarStats().range + ' cases' : '';
        const text = NAMES[b.type] + (STATE_NAMES[state] ? ' · ' + STATE_NAMES[state] : range);
        label(c, view, text, p.x, p.y + s * 1.25 + (b.hp < b.maxHp ? 5 : 0), tone(colors, 'playerStrong'), true);
      }
    }
    c.restore();
  }

  return Object.freeze({ draw, teamColor });
});
