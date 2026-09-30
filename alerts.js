/* Player-owned tactical alerts. No opponent state or raw event history is read. */
(function () {
  'use strict';

  const LIFETIME = 25, ATTACK_COOLDOWN = 10, MAX_ALERTS = 4;
  const names = { core: 'Cœur', relay: 'Relais', extractor: 'Extracteur', bastion: 'Bastion' };
  const wrap = document.getElementById('canvasWrap');
  // Retain the established network-alert control ID, without its old listener.
  document.getElementById('networkAlert')?.remove();
  const panel = document.createElement('div');
  panel.id = 'tacticalAlerts';
  panel.className = 'tactical-alerts hidden';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Alertes du camp');
  panel.innerHTML = '<button id="networkAlert" class="tactical-alert-focus" type="button"><strong id="tacticalAlertTitle"></strong><span id="tacticalAlertDetail"></span></button><button id="tacticalAlertNext" class="tactical-alert-next" type="button" aria-label="Alerte suivante"><span></span><b aria-hidden="true">›</b></button><button id="tacticalAlertDismiss" class="tactical-alert-dismiss" type="button" aria-label="Fermer cette alerte">×</button><span id="tacticalAlertAnnouncement" class="tactical-alert-announcement" role="status" aria-live="polite" aria-atomic="true"></span>';
  wrap.append(panel);
  const focusButton = document.getElementById('networkAlert');
  const title = document.getElementById('tacticalAlertTitle');
  const detail = document.getElementById('tacticalAlertDetail');
  const nextButton = document.getElementById('tacticalAlertNext');
  const announcement = document.getElementById('tacticalAlertAnnouncement');
  let watchedGame = null, previous = new Map(), alerts = [], selectedKey = null;
  let cooldowns = new Map(), lastCheck = -Infinity, lastSound = -Infinity, marker = null;

  function snapshot(match) {
    return new Map(match.buildings.filter(b => b.team === 1 && b.hp > 0).map(b => [b.id, {
      id: b.id, type: b.type, hp: b.hp, connected: !!b.connected,
      lastHit: b.lastHit || 0, x: b.x, y: b.y
    }]));
  }

  function reset() {
    watchedGame = null; previous.clear(); alerts = []; selectedKey = null;
    cooldowns.clear(); lastCheck = -Infinity; lastSound = -Infinity; marker = null;
    panel.classList.add('hidden'); panel.dataset.count = '0';
    announcement.textContent = '';
    delete focusButton.dataset.alertKind;
  }

  function onGameStart(match) {
    reset(); watchedGame = match || null;
    if (watchedGame) previous = snapshot(watchedGame);
  }

  function current() { return alerts.find(a => a.key === selectedKey) || alerts[0]; }

  function addAlert(value, now, cooldown = 0) {
    const existing = alerts.find(a => a.key === value.key);
    if (now - (cooldowns.get(value.key) ?? -Infinity) < cooldown) return;
    cooldowns.set(value.key, now);
    if (existing) {
      Object.assign(existing, value, { time: now });
      return;
    }
    const former = current();
    const item = { ...value, time: now };
    alerts.push(item);
    alerts.sort((a, b) => b.priority - a.priority || b.time - a.time);
    alerts = alerts.slice(0, MAX_ALERTS);
    if (!former || item.priority >= former.priority) selectedKey = item.key;
    announcement.textContent = item.title + '. ' + item.detail + '. Touchez pour voir.';
    if (now - lastSound >= 3) {
      audio('error_001'); lastSound = now;
    }
  }

  function render() {
    const visible = !!current() && playing && !ended && !window.CQTutorial?.active;
    panel.classList.toggle('hidden', !visible);
    panel.dataset.count = String(alerts.length);
    if (!visible) return;
    const item = current(); selectedKey = item.key;
    panel.dataset.urgent = String(item.priority >= 4);
    title.textContent = item.title;
    detail.textContent = item.detail;
    focusButton.dataset.alertKind = item.kind;
    focusButton.setAttribute('aria-label', item.title + '. ' + item.detail + '. Voir sur la carte');
    nextButton.hidden = alerts.length < 2;
    const index = alerts.indexOf(item) + 1;
    nextButton.querySelector('span').textContent = index + '/' + alerts.length;
    nextButton.setAttribute('aria-label', 'Alerte suivante, ' + index + ' sur ' + alerts.length);
  }

  function update(force = false) {
    if (!game || !playing) { if (watchedGame) reset(); return; }
    if (watchedGame !== game) { onGameStart(game); return; }
    const now = game.time;
    if (window.CQTutorial?.active || ended) {
      // Controlled tutorial scenes and resumed snapshots are never replayed as attacks.
      previous = snapshot(game); alerts = []; selectedKey = null; marker = null;
      render(); return;
    }
    if (!force && performance.now() - lastCheck < 100) return;
    lastCheck = performance.now();
    const own = snapshot(game);
    const isolated = [...own.values()].filter(b => !b.connected);
    alerts = alerts.filter(a => now - a.time < LIFETIME &&
      !(a.kind === 'network' && !isolated.length) &&
      !(a.kind === 'source' && a.reason === 'isolated' && own.get(a.buildingId)?.connected));
    for (const [id, before] of previous) {
      const after = own.get(id);
      if (!after) {
        // Only a building that actually belonged to the player can produce a loss alert.
        if (before.type === 'extractor') {
          alerts = alerts.filter(a => a.key !== 'attack:' + id);
          addAlert({ key: 'source:' + id, kind: 'source', priority: 3, reason: 'destroyed',
            title: 'Source perdue', detail: 'Extracteur détruit · Voir', buildingId: id, x: before.x, y: before.y }, now);
        } else {
          addAlert({ key: 'attack:' + id, kind: 'attack', priority: before.type === 'core' ? 4 : 2,
            title: names[before.type] + ' détruit', detail: 'Dernière position · Voir', buildingId: id, x: before.x, y: before.y }, now);
        }
        continue;
      }
      if (after.hp < before.hp - .001 || after.lastHit > before.lastHit) {
        addAlert({ key: 'attack:' + id, kind: 'attack', priority: after.type === 'core' ? 4 : 2,
          title: names[after.type] + ' attaqué', detail: 'Défendez ce point · Voir', buildingId: id, x: after.x, y: after.y }, now, ATTACK_COOLDOWN);
      }
      if (after.type === 'extractor' && before.connected && !after.connected) {
        addAlert({ key: 'source:' + id, kind: 'source', priority: 3, reason: 'isolated',
          title: 'Source isolée', detail: 'Revenu interrompu · Voir', buildingId: id, x: after.x, y: after.y }, now);
      }
    }
    const cut = isolated.filter(b => previous.get(b.id)?.connected);
    if (cut.length) {
      const target = cut.find(b => b.type === 'relay') || cut[0];
      addAlert({ key: 'network', kind: 'network', priority: 3, title: 'Réseau coupé',
        detail: isolationText(isolated.length), buildingId: target.id, x: target.x, y: target.y }, now, ATTACK_COOLDOWN);
    }
    const network = alerts.find(a => a.kind === 'network');
    if (network && isolated.length) {
      const target = isolated.find(b => b.id === network.buildingId) || isolated[0];
      network.detail = isolationText(isolated.length);
      network.buildingId = target.id; network.x = target.x; network.y = target.y;
    }
    previous = own;
    // Cooldown bookkeeping is bounded even if many buildings have been destroyed.
    for (const [key, time] of cooldowns) if (now - time > LIFETIME) cooldowns.delete(key);
    render();
  }

  function isolationText(count) { return count + ' bâtiment' + (count > 1 ? 's isolés' : ' isolé') + ' · Voir'; }

  focusButton.onclick = () => {
    const item = current();
    if (!item || !playing || ended || window.CQTutorial?.active) return;
    const building = game.buildings.find(b => b.id === item.buildingId && b.team === 1 && b.hp > 0);
    const x = (building?.x ?? item.x) + .5, y = (building?.y ?? item.y) + .5;
    // Focusing an alert changes the view and selection only; it never resumes or commands units.
    window.CQCamera?.focus(x, y, Math.max(2.3, window.CQCamera.zoom));
    if (building) window.CQUI?.selectBuilding(building);
    else { window.CQUI?.clearBuilding(); selection = []; setMode(null); }
    marker = { x, y, until: game.time + 6 };
  };
  nextButton.onclick = () => {
    const index = alerts.indexOf(current());
    selectedKey = alerts[(index + 1) % alerts.length]?.key || null;
    render();
  };
  document.getElementById('tacticalAlertDismiss').onclick = () => {
    const key = current()?.key;
    alerts = alerts.filter(a => a.key !== key); selectedKey = null;
    render();
  };

  function draw(c, v) {
    if (!marker || !game || ended || window.CQTutorial?.active || game.time >= marker.until) return;
    const x = v.x + marker.x * v.cell, y = v.y + marker.y * v.cell;
    if (x < 0 || x > v.w || y < 0 || y > v.h) return;
    const radius = Math.max(12, v.cell * 1.25);
    c.save(); c.strokeStyle = '#a95e24'; c.lineWidth = 2;
    c.setLineDash([4, 3]); c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]); c.strokeStyle = '#fffef8'; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, radius + 2, 0, Math.PI * 2); c.stroke(); c.restore();
  }

  window.CQAlerts = { onGameStart, reset, update, draw };
})();
