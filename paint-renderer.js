/* V0.7 canvas view. Rendering is read-only: no simulation or input state lives here. */
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
  const NAMES = Object.freeze({ core: 'Cœur', relay: 'Relais', extractor: 'Source', bastion: 'Bastion', barracks: 'Caserne' });
  const STATE_NAMES = Object.freeze({ paused: 'en pause', isolated: 'coupée', held: 'en attente', funds: 'sans pigment', full: 'armée complète', blocked: 'sortie bloquée' });
  const CARD_INKS = Object.freeze({ blue: '#5686c7', red: '#d66d65', yellow: '#b99437' });

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

  function drawTerrain(c, game, view, colors, motion) {
    const s = view.cell, W = game.width, H = game.height;
    const owners = game.tiles.map((_, i) => observedOwner(game, i));
    for (let i = 0; i < game.tiles.length; i++) {
      const tile = game.tiles[i], x = view.x + tile.x * s, y = view.y + tile.y * s;
      const seen = !!game.visibility?.[1]?.[i], explored = !!game.explored?.[1]?.[i], owner = owners[i];
      let fill = seen ? PAPER : explored ? '#f5f6f0' : '#edf1ed';
      if (owner) fill = owner === 1 ? tone(colors, 'playerFill') : tone(colors, 'enemyFill');
      c.fillStyle = fill; c.fillRect(x, y, s + .3, s + .3);
      if (owner === 1 && !tile.connected) {
        c.fillStyle = '#fffefa72'; c.fillRect(x, y, s + .3, s + .3);
        c.strokeStyle = owner === 1 ? tone(colors, 'playerHatch') : tone(colors, 'enemyHatch');
        c.lineWidth = Math.max(.7, s * .045); c.globalAlpha = .68;
        line(c, x + s * .15, y + s, x + s, y + s * .15);
        line(c, x, y + s * .4, x + s * .4, y);
        c.globalAlpha = 1;
      }
      // Terrain and sources are public geometry; occupancy remains concealed.
      if (tile.blocked) {
        c.fillStyle = seen ? '#dee4db' : '#dce3da';
        roundRect(c, x + s * .08, y + s * .12, s * .84, s * .77, s * .18); c.fill();
        c.strokeStyle = '#c7d0c5'; c.lineWidth = Math.max(.7, s * .04);
        line(c, x + s * .23, y + s * .63, x + s * .66, y + s * .32);
        line(c, x + s * .5, y + s * .71, x + s * .76, y + s * .5);
      } else if (tile.source) {
        const center = point(view, tile.x, tile.y), r = s * .31;
        c.globalAlpha = seen ? 1 : .6;
        c.strokeStyle = '#bf9a40'; c.lineWidth = Math.max(1, s * .055);
        c.fillStyle = '#fff8dc'; c.beginPath(); c.arc(center.x, center.y, r, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#bd9941'; polygon(c, center.x, center.y, r * .5, 4, -Math.PI / 2); c.fill();
        c.strokeStyle = '#c9aa594a';
        c.beginPath(); c.arc(center.x, center.y, s * (.55 + Math.sin(motion * 2 + tile.x) * .025), 0, TAU); c.stroke();
        c.globalAlpha = 1;
      } else if (seen && !owner && (tile.x + tile.y) % 2 === 0) {
        c.fillStyle = '#738d8228'; c.beginPath(); c.arc(x + s / 2, y + s / 2, Math.max(.5, s * .025), 0, TAU); c.fill();
      }
    }
    // Fine camp outlines make a one-cell link visible without outlining every tile.
    c.lineWidth = Math.max(.8, s * .055); c.lineCap = 'square';
    for (let i = 0; i < owners.length; i++) {
      if (!owners[i]) continue;
      const tile = game.tiles[i], x = view.x + tile.x * s, y = view.y + tile.y * s;
      c.strokeStyle = teamColor(owners[i], colors); c.globalAlpha = owners[i] === 1 && !tile.connected ? .35 : .5;
      if (tile.y === 0 || owners[i - W] !== owners[i]) line(c, x, y, x + s, y);
      if (tile.x === W - 1 || owners[i + 1] !== owners[i]) line(c, x + s, y, x + s, y + s);
      if (tile.y === H - 1 || owners[i + W] !== owners[i]) line(c, x + s, y + s, x, y + s);
      if (tile.x === 0 || owners[i - 1] !== owners[i]) line(c, x, y + s, x, y);
    }
    c.globalAlpha = 1; c.lineCap = 'round';
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
    if (!state || state === 'running') return;
    const size = Math.max(5, r * .45), bx = x + r * .85, by = y - r * .76;
    c.fillStyle = '#fffefa'; c.strokeStyle = state === 'isolated' ? '#986a51' : color; c.lineWidth = 1.1;
    c.beginPath(); c.arc(bx, by, size, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = state === 'isolated' ? '#986a51' : INK; c.lineWidth = Math.max(1.2, size * .24);
    if (state === 'paused' || state === 'held') {
      line(c, bx - size * .25, by - size * .38, bx - size * .25, by + size * .38);
      line(c, bx + size * .25, by - size * .38, bx + size * .25, by + size * .38);
    } else if (state === 'isolated' || state === 'blocked') {
      line(c, bx - size * .48, by + size * .42, bx + size * .48, by - size * .42);
    } else if (state === 'full') {
      line(c, bx - size * .43, by - size * .18, bx + size * .43, by - size * .18);
      line(c, bx - size * .43, by + size * .22, bx + size * .43, by + size * .22);
    } else {
      c.fillStyle = '#a08437'; c.beginPath(); c.arc(bx, by, size * .3, 0, TAU); c.fill();
    }
  }
  function building(c, game, view, colors, b, selected, ghost) {
    const p = point(view, b.x, b.y), s = view.cell;
    const r = s * (b.type === 'core' ? .79 : b.type === 'barracks' ? .53 : .48), color = teamColor(b.team, colors);
    c.save();
    if (ghost) c.globalAlpha = .62;
    if (selected) {
      c.fillStyle = '#ffffff85'; c.strokeStyle = tone(colors, 'selection'); c.lineWidth = 1.8;
      c.beginPath(); c.arc(p.x, p.y, r + Math.max(4, s * .23), 0, TAU); c.fill(); c.stroke();
    }
    if (!ghost && b.type === 'barracks' && b.team === 1) {
      const interval = root.CQPaintEngine?.CONFIG?.unitInterval || 5;
      const fraction = clamp((b.productionProgress || 0) / interval, 0, 1);
      c.strokeStyle = '#fffefaba'; c.lineWidth = Math.max(2, s * .14);
      c.beginPath(); c.arc(p.x, p.y, r + s * .16, 0, TAU); c.stroke();
      if (fraction > 0) {
        c.strokeStyle = color; c.lineWidth = Math.max(2, s * .14);
        c.beginPath(); c.arc(p.x, p.y, r + s * .16, -Math.PI / 2, -Math.PI / 2 + fraction * TAU); c.stroke();
      }
    }
    c.shadowColor = '#304b4e20'; c.shadowBlur = 3; c.shadowOffsetY = 1.5;
    c.fillStyle = PAPER; c.strokeStyle = color; c.lineWidth = Math.max(1.7, s * .12);
    if (b.type === 'core') polygon(c, p.x, p.y, r, 6, -Math.PI / 2);
    else if (b.type === 'relay') polygon(c, p.x, p.y, r, 4, -Math.PI / 2);
    else if (b.type === 'bastion') polygon(c, p.x, p.y, r, 6, 0);
    else if (b.type === 'barracks') roundRect(c, p.x - r, p.y - r * .78, r * 2, r * 1.56, s * .13);
    else { c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); }
    c.fill(); c.stroke(); c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.fillStyle = color; c.strokeStyle = color;
    if (b.type === 'core') {
      if (b.team === 1) roundRect(c, p.x - r * .35, p.y - r * .35, r * .7, r * .7, r * .14);
      else polygon(c, p.x, p.y, r * .44, 3, -Math.PI / 2);
      c.fill();
      if (b.level > 1 && !ghost) {
        c.fillStyle = '#fffefa'; c.font = '700 ' + Math.max(8, Math.min(11, s * .44)) + 'px system-ui, sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(b.level), p.x, p.y + .2);
      }
    } else if (b.type === 'barracks') {
      for (let n = -1; n <= 1; n++) c.fillRect(p.x + n * r * .48 - r * .1, p.y - r * .37, r * .2, r * .74);
    } else if (b.type === 'extractor') {
      c.fillStyle = '#b9953f'; polygon(c, p.x, p.y, r * .46, 4, -Math.PI / 2); c.fill();
    } else if (b.type === 'bastion') {
      polygon(c, p.x, p.y, r * .5, 3, -Math.PI / 2); c.fill();
    } else {
      c.beginPath(); c.arc(p.x, p.y, r * .24, 0, TAU); c.fill();
    }
    if (!ghost) {
      health(c, p.x, p.y + r + 4, r, b.hp, b.maxHp, color);
      // Enemy production reserves/pause are not public; only our producers get status.
      if (b.team === 1) statusBadge(c, p.x, p.y, r, productionState(game, b), color);
      else if (b.type !== 'core') {
        // The opponent's triangle also marks structures, independent of palette.
        c.fillStyle = tone(colors, 'enemyStrong'); c.strokeStyle = PAPER; c.lineWidth = 1;
        polygon(c, p.x + r * .82, p.y - r * .7, Math.max(3.5, s * .22), 3, -Math.PI / 2); c.fill(); c.stroke();
      }
    }
    c.restore();
  }

  function drawUnits(c, game, view, colors, ui) {
    const selected = ui.selectedProducer, groups = [];
    // A rally point can contain an entire group. Aggregate only the drawing, not
    // movement/collision state, and filter sight before collecting hostile units.
    for (const u of game.units) {
      if (u.hp <= 0 || (u.team !== 1 && !visible(game, u.x, u.y))) continue;
      let group = groups.find(g => g.team === u.team && Math.hypot(g.anchor.x - u.x, g.anchor.y - u.y) < .62);
      if (!group) {
        group = { team: u.team, anchor: u, x: 0, y: 0, hp: 0, maxHp: 0, count: 0, selected: 0 };
        groups.push(group);
      }
      group.x += u.x; group.y += u.y; group.hp += u.hp; group.maxHp += u.maxHp; group.count++;
      if (u.team === 1 && selected != null && String(u.producerId) === String(selected)) group.selected++;
    }
    for (const group of groups) {
      const p = point(view, group.x / group.count, group.y / group.count, false);
      const r = Math.max(2.8, view.cell * .26) * (1 + Math.min(3, Math.log2(group.count)) * .09), color = teamColor(group.team, colors);
      if (group.selected) {
        c.strokeStyle = tone(colors, 'selection'); c.lineWidth = 1;
        c.beginPath(); c.arc(p.x, p.y, r + 2, -Math.PI / 2, -Math.PI / 2 + TAU * group.selected / group.count); c.stroke();
      }
      c.fillStyle = '#24484f18'; c.beginPath(); c.ellipse(p.x, p.y + r * .72, r * 1.08, r * .5, 0, 0, TAU); c.fill();
      c.fillStyle = color; c.strokeStyle = '#fffefa'; c.lineWidth = Math.max(.9, view.cell * .065);
      if (group.team === 1) { c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); }
      else polygon(c, p.x, p.y, r * 1.22, 3, -Math.PI / 2);
      c.fill(); c.stroke();
      health(c, p.x, p.y + r + 3, r, group.hp, group.maxHp, color);
      if (group.count > 1) {
        const text = String(group.count), width = group.count > 9 ? 18 : 14;
        const bx = p.x + r + 2, by = p.y - r - 3;
        c.fillStyle = group.team === 1 ? tone(colors, 'playerStrong') : tone(colors, 'enemyStrong');
        c.strokeStyle = '#fffefa'; c.lineWidth = 1;
        roundRect(c, bx - width / 2, by - 7, width, 14, 7); c.fill(); c.stroke();
        c.fillStyle = '#fffefa'; c.font = '700 10px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(text, bx, by + .3);
      }
    }
  }

  function arrow(c, from, to, size) {
    const a = Math.atan2(to.y - from.y, to.x - from.x);
    c.beginPath(); c.moveTo(to.x - Math.cos(a - .55) * size, to.y - Math.sin(a - .55) * size);
    c.lineTo(to.x, to.y); c.lineTo(to.x - Math.cos(a + .55) * size, to.y - Math.sin(a + .55) * size); c.stroke();
  }
  function drawFlow(c, game, view, colors, ui, motion) {
    const id = ui.flowDrag?.producerId ?? ui.selectedProducer;
    if (id == null) return;
    const b = game.buildings.find(v => String(v.id) === String(id) && v.team === 1 && v.hp > 0);
    const target = ui.flowDrag || b?.flow;
    if (!b || !target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    const from = point(view, b.x, b.y), to = point(view, target.x, target.y);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    c.save(); c.lineCap = 'round';
    if (distance > view.cell) {
      c.strokeStyle = '#fffefae8'; c.lineWidth = 4; line(c, from.x, from.y, to.x, to.y);
      c.strokeStyle = tone(colors, 'playerStrong'); c.lineWidth = 1.8;
      c.setLineDash([5, 5]); c.lineDashOffset = -motion * 10; line(c, from.x, from.y, to.x, to.y); c.setLineDash([]);
      arrow(c, from, to, Math.max(6, view.cell * .45));
    }
    c.strokeStyle = tone(colors, 'playerStrong'); c.fillStyle = '#fffefa90'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(to.x, to.y, view.cell * .36, 0, TAU); c.fill(); c.stroke();
    c.restore();
  }

  function drawBrush(c, game, view, colors, ui) {
    const result = ui.preview, path = result?.path?.length ? result.path : ui.stroke;
    if (!path?.length) return;
    const cells = result?.cells || path, valid = result?.ok !== false;
    const color = valid ? tone(colors, 'playerStrong') : '#ad5344';
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const tile of cells) {
      if (!Number.isFinite(tile.x) || !Number.isFinite(tile.y)) continue;
      const p = point(view, tile.x, tile.y);
      c.fillStyle = valid ? teamColor(1, colors) + '5c' : '#da84724d';
      c.fillRect(p.x - view.cell / 2, p.y - view.cell / 2, view.cell, view.cell);
      c.strokeStyle = color; c.lineWidth = 1; c.setLineDash([3, 3]);
      c.strokeRect(p.x - view.cell / 2 + 1, p.y - view.cell / 2 + 1, view.cell - 2, view.cell - 2);
      c.setLineDash([]);
    }
    c.beginPath();
    path.forEach((tile, i) => { const p = point(view, tile.x, tile.y); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
    c.strokeStyle = '#fffefad9'; c.lineWidth = Math.max(5, view.cell * .48); c.stroke();
    c.strokeStyle = color; c.lineWidth = Math.max(2.3, view.cell * .18); c.stroke();
    const first = point(view, path[0].x, path[0].y), lastTile = path[path.length - 1], last = point(view, lastTile.x, lastTile.y);
    c.fillStyle = '#fffefa'; c.strokeStyle = color; c.lineWidth = 1.8;
    c.beginPath(); c.arc(first.x, first.y, Math.max(3, view.cell * .23), 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(last.x, last.y, Math.max(4, view.cell * .3), 0, TAU); c.fill(); c.stroke();
    if (!valid) {
      const k = view.cell * .17; line(c, last.x - k, last.y - k, last.x + k, last.y + k); line(c, last.x + k, last.y - k, last.x - k, last.y + k);
    }
    if (Number.isFinite(result?.cost) && result.cost > 0) label(c, view, result.cost + ' pigments', last.x, last.y - view.cell - 24, color, true);
    c.restore();
  }
  function drawCard(c, game, view, colors, ui) {
    const result = ui.preview, target = ui.previewPoint || ui.target || result;
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    const cards = root.CQPaintEngine?.CARDS || {};
    const card = cards[result?.cardId || game.hands?.[1]?.[ui.selectedCard]];
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
      const origin = Number.isFinite(ev.x) && Number.isFinite(ev.y) ? ev : ev.cells?.[0];
      if (age < 0 || age > .75 || !origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) continue;
      if (!visible(game, origin.x, origin.y)) continue;
      const centered = ev.type !== 'spawn' && !(ev.type === 'damage' && ev.objectType === 'droplet');
      const card = ev.type === 'power' ? root.CQPaintEngine?.CARDS?.[ev.cardId] : null;
      const color = CARD_INKS[card?.color] || teamColor(ev.team || 1, colors);
      const p = point(view, origin.x, origin.y, centered), alpha = 1 - age / .75;
      const elapsed = ui.reducedMotion ? .15 : age;
      c.save(); c.globalAlpha = alpha * .8; c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.5;
      if (ev.type === 'paint') {
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
    for (const b of game.buildings) {
      if (b.hp <= 0 || (b.team !== 1 && !visible(game, b.x, b.y))) continue;
      const selected = b.team === 1 && ui.selectedProducer != null && String(b.id) === String(ui.selectedProducer);
      building(c, game, view, colors, b, selected, false);
    }
    drawUnits(c, game, view, colors, ui);
    drawEffects(c, game, view, colors, ui);
    if (ui.mode === 'brush') drawBrush(c, game, view, colors, ui);
    else if (ui.mode === 'card') drawCard(c, game, view, colors, ui);
    c.restore();
    c.strokeStyle = '#cfd9cf'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);

    // A single selected label replaces a permanent map legend/help panel.
    const b = game.buildings.find(b => b.team === 1 && b.hp > 0 && ui.selectedProducer != null && String(b.id) === String(ui.selectedProducer));
    if (b && ui.mode === 'navigate' && !ui.flowDrag) {
      const p = point(view, b.x, b.y), state = productionState(game, b);
      if (p.x >= 0 && p.x <= view.w && p.y >= 0 && p.y <= view.h) {
        const text = NAMES[b.type] + (STATE_NAMES[state] ? ' · ' + STATE_NAMES[state] : '');
        label(c, view, text, p.x, p.y + s * 1.25 + (b.hp < b.maxHp ? 5 : 0), tone(colors, 'playerStrong'), true);
      }
    }
    c.restore();
  }

  return Object.freeze({ draw, teamColor });
});
