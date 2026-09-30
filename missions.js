/* Five small campaign scenarios. No renderer, storage or engine dependency.
 * Objective state is plain JSON; update never advances the game clock itself.
 */
(function (root) {
  'use strict';
  const catalog = [
    { id: 'first-ink', index: 1, title: 'Première tache', description: 'Faites grandir votre couleur sur une petite toile, sans adversaire.',
      unlock: 'Niveau suivant : source et extracteur', buildings: ['relay'], units: [], actions: [],
      bounds: { x: 9, y: 24, width: 15, height: 21 }, target: { x: 16, y: 27, label: 'Zone à atteindre' } },
    { id: 'source', index: 2, title: 'La source', description: 'Prolongez le réseau jusqu’à la source, puis transformez-la en revenu.',
      unlock: 'Niveau suivant : combattants et ordres', buildings: ['relay', 'extractor'], units: [], actions: [],
      bounds: { x: 8, y: 20, width: 17, height: 25 }, target: { x: 16, y: 24, label: 'Source de pigment' } },
    { id: 'contact', index: 3, title: 'Premier contact', description: 'Formez vos premiers combattants et reprenez un petit poste adverse.',
      unlock: 'Niveau suivant : réparer un réseau coupé', buildings: ['relay', 'extractor'], units: ['fighter'], actions: ['command'],
      bounds: { x: 7, y: 14, width: 19, height: 31 }, target: { x: 16, y: 20, label: 'Poste à reprendre' } },
    { id: 'link', index: 4, title: 'Le lien', description: 'Un secteur isolé ne produit plus. Reconnectez-le et chassez son gardien adverse.',
      unlock: 'Niveau suivant : caserne avancée', buildings: ['relay', 'extractor'], units: ['fighter'], actions: ['command'],
      bounds: { x: 6, y: 14, width: 21, height: 31 }, target: { x: 16, y: 23, label: 'Secteur isolé' } },
    { id: 'outpost', index: 5, title: 'L’avant-poste', description: 'Construisez une caserne près de la source et formez sur place les forces qui la défendront.',
      unlock: 'Chapitre terminé · retrouvez tous les outils en mode libre', buildings: ['relay', 'extractor', 'barracks'], units: ['fighter'], actions: ['command', 'rally'],
      bounds: { x: 5, y: 5, width: 23, height: 40 }, target: { x: 16, y: 23, label: 'Source disputée' } }
  ].map(def => Object.freeze({ ...def, number: def.index, name: def.title }));
  const get = id => catalog.find(def => def.id === id) || null;
  const bounds = id => get(id) ? { ...get(id).bounds } : null;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const playerBuildings = (g, type) => g.buildings.filter(b => b.team === 1 && b.hp > 0 && (!type || b.type === type));
  const near = (u, target, radius) => Math.hypot(u.x - target.x - .5, u.y - target.y - .5) <= radius;
  const localUnits = (g, target, team, radius) => g.units.filter(u => u.team === team && u.hp > 0 && near(u, target, radius));
  const sourceBuilding = (g, target) => playerBuildings(g, 'extractor').find(b => b.x === target.x && b.y === target.y && b.connected);
  const forwardBarracks = g => playerBuildings(g, 'barracks').filter(b => b.connected && distance(b, get('outpost').target) <= 6);

  function can(game, action, type) {
    if (!game?.mission) return true;
    const def = get(game.mission.id);
    if (!def) return false;
    if (action === 'build') return def.buildings.includes(type);
    if (action === 'recruit') return def.units.includes(type);
    return def.actions.includes(action);
  }

  function paint(g, team, x, y, radius) {
    for (const tile of g.tiles) if (!tile.blocked && Math.hypot(tile.x - x, tile.y - y) <= radius) tile.owner = team;
  }

  function setup(g, id) {
    const def = get(id);
    if (!def) throw new RangeError('Mission inconnue.');
    const area = def.bounds;
    g.mapId = `mission:${id}`;
    g.mission = { id, stage: 0, hold: 0, trained: 0, barracksTrained: 0, nextRaid: 45, raids: 0 };
    g.difficulty = 'easy';
    g.money = [0, id === 'outpost' ? 260 : id === 'contact' ? 210 : 180, 140];
    g.units = []; g.buildings = []; g.events = []; g.aiMemory = [];
    for (const tile of g.tiles) {
      tile.blocked = tile.x < area.x || tile.x >= area.x + area.width || tile.y < area.y || tile.y >= area.y + area.height;
      tile.owner = 0; tile.connected = false; tile.visible = false;
      tile.explored = !tile.blocked; tile.aiExplored = false; tile.aiVisible = false;
      tile.source = false; tile.rich = false; tile.cache = 0; tile.terrain = 'plain'; tile.isolation = 0;
    }
    g._building(1, 'core', 16, 39);
    paint(g, 1, 16, 39, 5);
    if (id === 'source' || id === 'link' || id === 'outpost') g.tile(def.target.x, def.target.y).source = true;
    if (id === 'contact') {
      g._building(2, 'relay', 16, 20);
      paint(g, 2, 16, 20, 3);
      const guard = g._unit(2, 'fighter', 16.5, 22.5); guard.stance = 'hold';
      // A local source makes rebuilding after an unsuccessful assault affordable.
      g.tile(11, 34).source = true;
    }
    if (id === 'link') {
      g._building(1, 'relay', 16, 27);
      g._building(1, 'extractor', 16, 23);
      for (let y = 22; y <= 28; y++) for (let x = 14; x <= 18; x++) g.tile(x, y).owner = 1;
      const guard = g._unit(2, 'fighter', 19.5, 23.5); guard.stance = 'hold';
    }
    if (id === 'outpost') {
      g._building(2, 'core', 16, 9);
      paint(g, 2, 16, 9, 5);
      g._building(2, 'relay', 16, 15);
      paint(g, 2, 16, 15, 3);
      const guard = g._unit(2, 'fighter', 16.5, 21.5); guard.stance = 'hold';
      g.tile(10, 34).source = true;
    }
    g.recompute();
    g.updateVisibility();
    g.emit('mission', def.title, 16, 39, 1);
    return g;
  }

  function onRecruit(g, unit, producer) {
    if (!g.mission || unit.team !== 1) return;
    g.mission.trained++;
    if (producer.type === 'barracks' && distance(producer, get('outpost').target) <= 6) g.mission.barracksTrained++;
  }

  function complete(g) {
    g.mission.stage = 2;
    g.winner = 1;
    g.winReason = `${get(g.mission.id).title} : mission accomplie`;
    const target = get(g.mission.id).target;
    g.emit('mission-complete', 'Mission accomplie !', target.x, target.y, 1);
  }

  function isComplete(g) {
    if (g?.winner !== 1 || g.mission?.stage !== 2 || !g.getCore(1)) return false;
    const state = g.mission, target = get(state.id)?.target;
    if (!target) return false;
    if (state.id === 'first-ink') return playerBuildings(g, 'relay').length > 0 && g.tile(target.x, target.y).owner === 1 && g.tile(target.x, target.y).connected;
    if (state.id === 'source') return !!sourceBuilding(g, target) && state.hold >= 5;
    if (state.id === 'contact') return state.trained >= 2 && !g.buildings.some(b => b.team === 2 && b.hp > 0 && distance(b, target) < 3) &&
      !localUnits(g, target, 2, 5).length && localUnits(g, target, 1, 3).length > 0 && g.tile(target.x, target.y).owner === 1;
    if (state.id === 'link') return !!sourceBuilding(g, target) && state.hold >= 10 && !localUnits(g, target, 2, 4.5).length && localUnits(g, target, 1, 5).length >= 2;
    return forwardBarracks(g).length > 0 && state.barracksTrained >= 2 && !!sourceBuilding(g, target) && state.hold >= 20 &&
      !localUnits(g, target, 2, 5).length && localUnits(g, target, 1, 5).length >= 2;
  }

  function updateOpposition(g) {
    if (g.mission.id !== 'outpost') return;
    const target = get('outpost').target;
    if (g.time >= g.mission.nextRaid) {
      g.mission.nextRaid = g.time + 36;
      const army = g.units.filter(u => u.team === 2 && u.hp > 0);
      if (g.getCore(2) && army.length + g.getQueuedCount(2) < 4) {
        if (g.recruit(2, 'fighter').ok) g.mission.raids++;
      }
    }
    for (const unit of g.units.filter(u => u.team === 2 && u.hp > 0)) {
      // The objective is announced to both sides. Only locally visible forces
      // may change the route; hidden player structures are never consulted.
      const threat = g.units.filter(u => u.team === 1 && u.hp > 0 && g.tile(u.x, u.y)?.aiVisible && distance(unit, u) < 6)
        .sort((a, b) => distance(unit, a) - distance(unit, b))[0];
      if (threat && (!unit.path.length || distance(unit.order || unit, threat) > 2)) g.command(2, [unit.id], 'attack', threat.x, threat.y);
      else if (!unit.path.length && !near(unit, target, 2.2)) g.command(2, [unit.id], 'attack', target.x, target.y);
      else if (!unit.path.length && !threat) g.command(2, [unit.id], 'hold');
    }
  }

  function update(g, dt) {
    if (!g.mission || g.winner !== null) return;
    const state = g.mission, def = get(state.id), target = def.target;
    updateOpposition(g);
    if (state.id === 'first-ink') {
      state.stage = playerBuildings(g, 'relay').length ? 1 : 0;
      if (state.stage && g.tile(target.x, target.y).owner === 1 && g.tile(target.x, target.y).connected) complete(g);
    } else if (state.id === 'source') {
      state.stage = g.tile(target.x, target.y).connected ? 1 : 0;
      state.hold = sourceBuilding(g, target) ? Math.min(5, state.hold + dt) : 0;
      if (state.hold >= 5) complete(g);
    } else if (state.id === 'contact') {
      state.stage = state.trained >= 2 ? 1 : 0;
      const post = g.buildings.some(b => b.team === 2 && b.hp > 0 && distance(b, target) < 3);
      if (state.stage && !post && !localUnits(g, target, 2, 5).length && localUnits(g, target, 1, 3).length && g.tile(target.x, target.y).owner === 1) complete(g);
    } else if (state.id === 'link') {
      const connected = !!sourceBuilding(g, target);
      if (connected) state.stage = 1;
      const secured = connected && !localUnits(g, target, 2, 4.5).length && localUnits(g, target, 1, 5).length >= 2;
      state.hold = secured ? Math.min(10, state.hold + dt) : 0;
      if (state.hold >= 10) complete(g);
    } else if (state.id === 'outpost') {
      const barracks = forwardBarracks(g).length > 0;
      if (barracks) state.stage = Math.max(state.stage, 1);
      if (state.barracksTrained >= 2) state.stage = 2;
      const secured = barracks && state.barracksTrained >= 2 && sourceBuilding(g, target) &&
        !localUnits(g, target, 2, 5).length && localUnits(g, target, 1, 5).length >= 2;
      state.hold = secured ? Math.min(20, state.hold + dt) : 0;
      if (state.hold >= 20) complete(g);
    }
  }

  function status(g) {
    const def = get(g?.mission?.id);
    if (!def) return null;
    const state = g.mission, target = { ...def.target }, connected = !!sourceBuilding(g, target);
    let objective = '', hint = '', progress = 0, action = null;
    if (state.id === 'first-ink') {
      objective = 'Reliez la zone repérée à votre Cœur.';
      hint = 'Touchez Relais, puis placez-le sur votre couleur, vers la zone repérée.';
      progress = state.stage ? .5 : 0; action = { kind: 'build', type: 'relay' };
      if (state.stage) hint = 'Le relais propage votre couleur. Ajoutez-en un plus près si la zone reste hors de portée.';
    } else if (state.id === 'source') {
      objective = 'Reliez la source et faites produire un extracteur.';
      const tile = g.tile(target.x, target.y);
      hint = tile.owner === 1 && tile.connected ? 'Touchez Extracteur, puis la source cerclée.' : 'Construisez des relais vers la source pour y amener votre couleur.';
      action = { kind: 'build', type: tile.owner === 1 && tile.connected ? 'extractor' : 'relay' };
      progress = connected ? .7 + state.hold / 5 * .3 : state.stage ? .45 : 0;
      if (connected) { hint = 'La source produit du pigment : gardez-la connectée quelques secondes.'; action = null; }
    } else if (state.id === 'contact') {
      objective = 'Formez au moins 2 combattants et reprenez le poste.';
      const army = g.units.filter(u => u.team === 1 && u.hp > 0);
      hint = state.trained < 2 || army.length < 2 ? 'Touchez Combattant pour en former au Cœur. Un groupe de 4 facilite l’attaque.' : 'Sélectionnez vos combattants, touchez Attaquer / déplacer, puis le poste repéré.';
      action = state.trained < 2 || army.length < 2 ? { kind: 'recruit', type: 'fighter' } : { kind: 'command', type: 'attack' };
      progress = Math.min(2, state.trained) / 2 * .4;
      if (!g.buildings.some(b => b.team === 2 && b.hp > 0)) progress = .8;
    } else if (state.id === 'link') {
      objective = 'Reconnectez le secteur, puis sécurisez-le avec 2 combattants.';
      if (!connected) {
        const tile = g.tile(target.x, target.y);
        const needsExtractor = tile.owner === 1 && tile.connected && !playerBuildings(g, 'extractor').some(b => b.x === target.x && b.y === target.y);
        hint = needsExtractor ? 'Reconstruisez l’extracteur sur la source reconnectée.' : 'Placez un relais entre votre Cœur et le secteur isolé. Le pigment doit former un chemin continu.';
        action = { kind: 'build', type: needsExtractor ? 'extractor' : 'relay' };
      } else {
        const army = g.units.filter(u => u.team === 1 && u.hp > 0);
        hint = army.length < 2 ? 'Formez au moins 2 combattants pour protéger la source.' : 'Envoyez vos combattants vers le gardien, puis gardez-en 2 près de la source pendant 10 s.';
        action = army.length < 2 ? { kind: 'recruit', type: 'fighter' } : { kind: 'command', type: 'attack' };
      }
      progress = connected ? .5 + state.hold / 10 * .5 : 0;
    } else {
      objective = 'Formez 2 unités à l’avant-poste et sécurisez la source 20 s.';
      const forward = forwardBarracks(g), tile = g.tile(target.x, target.y);
      if (state.trained > 0 && g.units.filter(u => u.team === 1 && u.hp > 0).length < 2) {
        hint = !forward.length ? 'Votre armée a besoin de renforts. Formez au moins 2 combattants au Cœur pour reprendre la source et rétablir votre avant-poste.' :
          state.barracksTrained < 2 ? 'Formez vos renforts dans la caserne avancée : 2 formations sur place sont nécessaires pour cette mission.' :
          'Votre armée a besoin de renforts. Formez au moins 2 combattants à la caserne ou au Cœur, puis envoyez-les défendre la source.';
        action = { kind: 'recruit', type: 'fighter' };
      } else if (!forward.length) {
        const frontier = g.tiles.some(t => t.owner === 1 && t.connected && !t.source && distance(t, target) <= 6);
        hint = frontier ? 'Construisez une caserne sur votre couleur, à 6 cases maximum de la source.' : 'Étendez votre réseau vers la source avec des relais. Des combattants peuvent ouvrir la voie.';
        action = { kind: 'build', type: frontier ? 'barracks' : 'relay' };
      } else if (state.barracksTrained < 2) {
        hint = 'Sélectionnez la caserne avancée et formez-y 2 combattants. Sa file est indépendante du Cœur.';
        action = { kind: 'recruit', type: 'fighter' };
      } else if (!connected && tile.owner === 1 && tile.connected && !playerBuildings(g, 'extractor').some(b => b.x === target.x && b.y === target.y)) {
        hint = 'Installez un extracteur sur la source pour l’exploiter.'; action = { kind: 'build', type: 'extractor' };
      } else {
        hint = connected ? 'Placez au moins 2 combattants juste au-dessus de la source, puis touchez Tenir ici : ils défendront sans poursuivre au loin.' : 'Reprenez la source avec vos combattants et reliez-la au Cœur.';
        action = { kind: 'command', type: connected ? 'hold' : 'attack' };
      }
      progress = Math.min(2, state.barracksTrained) * .2 + (forward.length ? .2 : 0) + state.hold / 20 * .4;
    }
    const finished = isComplete(g);
    if (finished) { progress = 1; hint = 'Mission accomplie !'; action = null; }
    return { id: def.id, index: def.index, title: def.title, objective, hint, progress, target, complete: finished, stage: state.stage, bounds: bounds(def.id), action };
  }

  const api = { catalog, get, bounds, can, setup, update, onRecruit, isComplete, status, describe: status };
  root.CQMissions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
