(function (root, factory) {
  'use strict';
  const api = factory(typeof module === 'object' && module.exports ? require('./paint-engine.js') : root.CQPaintEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CQPaintAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine) {
  'use strict';

  // Decisions consume the same observation the player can obtain. In particular,
  // do not look through game.tiles/units/buildings to find a convenient target.
  const memories = new WeakMap();
  const STEP = .8;
  const BRUSH_DELAY = 2.4;
  const FLOW_DELAY = 2.4;
  const OPENING = 90;
  const CORE_PUSH = 210;
  // Profiles change legal choices and their cadence, never economy, vision,
  // combat statistics, available cards or the player's brush.
  const PROFILES = Object.freeze({
    default: Object.freeze({ id: 'default', name: 'Classique', description: 'Vous laisse installer votre base, puis avance par petites vagues.', step: STEP,
      brushDelay: BRUSH_DELAY, flowDelay: FLOW_DELAY, opening: OPENING, corePush: CORE_PUSH, cutThreshold: .42, army: [3, 5, 8], secondProducer: 125 }),
    rapid: Object.freeze({ id: 'rapid', name: 'Le Vif', description: 'Peint les côtés, puis envoie une première petite vague après 90 s.', step: .8,
      brushDelay: 2, flowDelay: 2, opening: 90, corePush: 210, cutThreshold: .42, army: [3, 5, 8], secondProducer: 125 }),
    builder: Object.freeze({ id: 'builder', name: 'Le Bâtisseur', description: 'Protège ses sources avec des bastions et avance par relais.', step: .8,
      brushDelay: 2.8, flowDelay: 2.4, opening: 75, corePush: 195, cutThreshold: .42, army: [3, 5, 8], secondProducer: 110 }),
    eraser: Object.freeze({ id: 'eraser', name: 'L’Effaceur', description: 'Cherche les liaisons exposées et prépare des sièges au mortier.', step: .8,
      brushDelay: 2.4, flowDelay: 1.6, opening: 60, corePush: 180, cutThreshold: .36, army: [3, 5, 8], secondProducer: 95 })
  });
  const validTeam = team => team === 1 || team === 2;
  const profileFor = id => Object.hasOwn(PROFILES, id) ? PROFILES[id] : PROFILES.default;
  function freshState(time, profile = 'default') {
    const config = profileFor(profile);
    return { profile: config.id, nextThink: time + config.step, lastTime: time, lastBrush: -100,
      lastCard: -100, lastFlow: -100, observations: new Map(), orders: new Map(), pausedByAI: new Set() };
  }
  const key = (x, y, width) => y * width + x;
  const coordX = value => value.x - (value.type === 'droplet' ? .5 : 0);
  const coordY = value => value.y - (value.type === 'droplet' ? .5 : 0);
  const distance = (a, b) => Math.abs(coordX(a) - coordX(b)) + Math.abs(coordY(a) - coordY(b));
  const near = (a, b) => Math.hypot(coordX(a) - coordX(b), coordY(a) - coordY(b));

  function state(game, team) {
    let match = memories.get(game);
    if (!match) { match = new Map(); memories.set(game, match); }
    let value = match.get(team);
    if (!value || game.time < value.lastTime) {
      value = freshState(game.time, value?.profile);
      match.set(team, value);
    }
    return value;
  }

  function reset(game, team) {
    if (team === undefined) memories.delete(game);
    else memories.get(game)?.delete(team);
  }

  function configure(game, team = 2, options = {}) {
    if (!game || !validTeam(team) || !Object.hasOwn(PROFILES, options.profile || 'default')) return false;
    state(game, team);
    memories.get(game).set(team, freshState(game.time, options.profile));
    return true;
  }

  // Derived solely from simulation time and the saved profile: a paused or
  // restored course shows the same countdown without adding save fields.
  function pacing(game, team = 2) {
    if (!game || !validTeam(team)) return null;
    const config = profileFor(state(game, team).profile);
    const phase = game.time < config.opening ? 'development' : game.time < config.corePush ? 'raids' : 'assault';
    const next = phase === 'development' ? config.opening : phase === 'raids' ? config.corePush : game.time;
    return { phase, remaining: Math.max(0, Math.ceil(next - game.time - 1e-7)), opening: config.opening, corePush: config.corePush };
  }

  function snapshot(game, team = 2) {
    if (!game || !validTeam(team)) return null;
    const s = state(game, team);
    return { version: 1, team, profile: s.profile, state: {
      nextThink: s.nextThink, lastTime: s.lastTime, lastBrush: s.lastBrush, lastCard: s.lastCard, lastFlow: s.lastFlow,
      observations: [...s.observations].map(([id, value]) => [id, Object.assign({}, value)]),
      orders: [...s.orders].map(([id, value]) => [id, Object.assign({}, value)]), pausedByAI: [...s.pausedByAI]
    } };
  }

  function restore(game, data, team = 2) {
    // Reject corrupted state instead of silently restarting the opponent after
    // a reload. Snapshot arrays are copied so a caller cannot mutate live memory.
    if (!game || !validTeam(team) || !data || data.version !== 1 || data.team !== team || !Object.hasOwn(PROFILES, data.profile)) return false;
    const s = data.state;
    if (!s || ['nextThink', 'lastTime', 'lastBrush', 'lastCard', 'lastFlow'].some(k => !Number.isFinite(s[k]))) return false;
    if (s.lastTime < 0 || s.lastTime > game.time + 1e-7 || s.nextThink < 0 || s.nextThink > game.time + 1 + 1e-7 ||
        ['lastBrush', 'lastCard', 'lastFlow'].some(k => s[k] < -100 || s[k] > game.time + 1e-7)) return false;
    const id = n => Number.isSafeInteger(n) && n > 0;
    const point = p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < Engine.CONFIG.width && p.y < Engine.CONFIG.height;
    const entries = values => Array.isArray(values) && values.length <= 1024 && new Set(values.map(v => Array.isArray(v) ? v[0] : null)).size === values.length;
    if (!entries(s.observations) || !entries(s.orders) || !Array.isArray(s.pausedByAI) || s.pausedByAI.length > 1024) return false;
    if (s.observations.some(v => !Array.isArray(v) || v.length !== 2 || !id(v[0]) || !point(v[1]) || v[1].id !== v[0] || !Object.hasOwn(Engine.BUILDING_STATS, v[1].type) || !Number.isFinite(v[1].seenAt) || v[1].seenAt < 0 || v[1].seenAt > game.time + 1e-7)) return false;
    if (s.orders.some(v => !Array.isArray(v) || v.length !== 2 || !id(v[0]) || !point(v[1])) || s.pausedByAI.some(n => !id(n)) || new Set(s.pausedByAI).size !== s.pausedByAI.length) return false;
    state(game, team);
    memories.get(game).set(team, { profile: data.profile, nextThink: s.nextThink, lastTime: s.lastTime,
      lastBrush: s.lastBrush, lastCard: s.lastCard, lastFlow: s.lastFlow,
      observations: new Map(s.observations.map(([n, v]) => [n, { id: v.id, x: v.x, y: v.y, type: v.type, seenAt: v.seenAt }])),
      orders: new Map(s.orders.map(([n, v]) => [n, { x: v.x, y: v.y }])), pausedByAI: new Set(s.pausedByAI) });
    return true;
  }

  function observation(p, config) {
    const team = p.team;
    const ownBuildings = p.buildings.filter(b => b.team === team);
    const ownUnits = p.units.filter(u => u.team === team);
    const core = ownBuildings.find(b => b.type === 'core');
    if (!core) return null;
    const enemy = 3 - team;
    const enemyStart = p.coreStarts[enemy];
    const direction = Math.sign(enemyStart.y - core.y) || 1;
    const occupied = new Set(p.buildings.map(b => key(b.x, b.y, p.width)));
    return { p, config, team, enemy, core, enemyStart, direction, ownBuildings, ownUnits, occupied,
      producers: ownBuildings.filter(b => b.type === 'barracks'),
      enemyBuildings: p.buildings.filter(b => b.team === enemy),
      enemyUnits: p.units.filter(u => u.team === enemy),
      tile(x, y) { return x >= 0 && y >= 0 && x < p.width && y < p.height ? p.tiles[key(x, y, p.width)] : null; },
      // A rotated tie-break, rather than absolute left-to-right ordering, keeps
      // the two sides' otherwise identical development symmetric in self-play.
      tie(t) { return team === 2 ? key(coordX(t), coordY(t), p.width) : key(p.width - 1 - coordX(t), p.height - 1 - coordY(t), p.width); }
    };
  }

  function remember(o, s) {
    for (const [id, old] of s.observations) {
      const t = o.tile(old.x, old.y);
      if (t?.visible && !o.enemyBuildings.some(b => b.id === id)) s.observations.delete(id);
    }
    for (const b of o.enemyBuildings) s.observations.set(b.id, { id: b.id, x: b.x, y: b.y, type: b.type, seenAt: o.p.time });
  }

  // The opening is a real local defence, not an attack order aimed just short
  // of the player's base. Attack orders otherwise chase targets autonomously.
  function inHome(o, point) {
    return (coordY(point) - o.core.y) * o.direction <= 8;
  }

  function attackAllowed(o, point) {
    if (o.p.time < o.config.opening) return inHome(o, point);
    return o.p.time >= o.config.corePush || near(point, o.enemyStart) >= 6;
  }

  function expansionAllowed(o, point) {
    if (o.p.time < o.config.opening) return inHome(o, point);
    return o.p.time >= o.config.corePush || near(point, o.enemyStart) >= 6;
  }

  function expansionBudget(o) {
    if (o.p.time >= o.config.corePush) return Infinity;
    const total = o.p.tiles.reduce((n, tile) => n + !tile.blocked, 0);
    // A capped development area prevents winning by domination while a new
    // player is still reading. Count disconnected own paint conservatively.
    const owned = o.p.tiles.reduce((n, tile) => n + (tile.owner === o.team), 0);
    return Math.max(0, Math.floor(total * (o.p.time < o.config.opening ? .35 : .42)) - owned);
  }

  function closestThreat(o) {
    return o.enemyUnits.map(u => ({ u, d: Math.min(...o.ownBuildings.map(b => near(u, b))) }))
      .filter(item => item.d < 5.5 && attackAllowed(o, item.u))
      .sort((a, b) => near(a.u, o.core) - near(b.u, o.core) || a.d - b.d || o.tie(a.u) - o.tie(b.u))[0]?.u;
  }

  function exploredTarget(o, target) {
    return o.p.tiles.filter(t => t.explored && !t.blocked)
      .sort((a, b) => distance(a, target) - distance(b, target) || o.tie(a) - o.tie(b))[0];
  }

  function dominationTarget(o, config = PROFILES.default) {
    if (o.p.scores[o.enemy] < config.cutThreshold && o.p.hold[o.enemy] <= 0) return null;
    const candidates = o.p.tiles.filter(t => t.visible && t.owner === o.enemy && !t.blocked && attackAllowed(o, t) &&
      !o.occupied.has(key(t.x, t.y, o.p.width)));
    const scores = new Map();
    for (const t of candidates) {
      const neighbours = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => o.tile(t.x + dx, t.y + dy));
      const enemyNeighbours = neighbours.map(n => n?.visible && n.owner === o.enemy);
      const count = enemyNeighbours.filter(Boolean).length;
      const narrow = count === 2 && ((enemyNeighbours[0] && enemyNeighbours[2]) || (enemyNeighbours[1] && enemyNeighbours[3]));
      const route = o.ownUnits.length ? Math.min(...o.ownUnits.map(u => near(u, t))) : near(o.core, t);
      // React to the public domination bar by cutting a *visible* thin line or
      // nearby frontier. Never locate a hidden connection by inspecting owners.
      scores.set(t, (narrow ? 8 : count <= 2 ? 3 : 0) + (neighbours.some(n => n?.owner === o.team) ? 2 : 0) - route);
    }
    candidates.sort((a, b) => scores.get(b) - scores.get(a) || o.tie(a) - o.tie(b));
    return candidates[0] || null;
  }

  function directFlows(game, o, s) {
    const config = o.config;
    const orphaned = o.ownUnits.some(u => u.producerId === o.core.id);
    const producers = orphaned ? [o.core, ...o.producers] : o.producers;
    const opening = o.p.time < config.opening;
    const regroup = producer => {
      if (producer.flowMode !== 'defend' || !producer.flow) {
        const result = game.recall(o.team, producer.id);
        if (result.ok) s.orders.set(producer.id, { x: producer.x, y: producer.y });
      }
    };
    if (opening) {
      for (const producer of producers) regroup(producer);
      return;
    }
    const underShell = o.producers.some(producer => mortarEscape(o, producer));
    const tooClose = o.p.time < config.corePush && o.ownUnits.some(unit => !attackAllowed(o, unit));
    if (o.p.time - s.lastFlow < config.flowDelay && !underShell && !tooClose) return;
    s.lastFlow = o.p.time;
    let target = closestThreat(o) || dominationTarget(o, config);
    if (!target) {
      const known = [...s.observations.values()].filter(b =>
        (b.type !== 'core' || o.p.time >= config.corePush) && attackAllowed(o, b));
      known.sort((a, b) => distance(a, o.core) - distance(b, o.core) || o.tie(a) - o.tie(b));
      const staging = o.p.time < config.opening + 35 ? 10 : 13;
      target = known[0] || (o.p.time < config.corePush ? { x: o.core.x, y: o.core.y + o.direction * staging } : o.enemyStart);
    }
    const destination = exploredTarget(o, target);
    if (!destination) return;
    const raider = o.producers.slice().sort((a, b) => a.id - b.id)[0];
    for (const producer of producers) {
      const group = o.ownUnits.filter(unit => unit.producerId === producer.id);
      if (o.p.time < config.corePush && (producer !== raider || group.some(unit => !attackAllowed(o, unit)))) {
        regroup(producer);
        continue;
      }
      // A recalled wave completes its return before being sent out again.
      if (producer.flowMode === 'defend' && group.some(unit => unit.retreating)) continue;
      const escape = mortarEscape(o, producer);
      const next = escape || destination;
      const previous = s.orders.get(producer.id);
      if (previous && distance(previous, next) < (escape ? 1 : 2) && producer.flow && producer.flowMode !== 'defend') continue;
      const result = game.setFlow(o.team, producer.id, next.x, next.y);
      if (result.ok) s.orders.set(producer.id, { x: next.x, y: next.y });
    }
    for (const id of s.orders.keys()) if (!producers.some(b => b.id === id)) s.orders.delete(id);
  }

  function mortarEscape(o, producer) {
    const shells = (o.p.shells || []).filter(shell => shell.team !== o.team && shell.remaining > 0);
    if (!shells.length) return null;
    const group = o.ownUnits.filter(unit => unit.producerId === producer.id);
    const threatened = group.find(unit => shells.some(shell => Math.hypot(unit.x - shell.x, unit.y - shell.y) <= shell.radius + .25));
    if (!threatened) return null;
    const safe = o.p.tiles.filter(tile => tile.visible && !tile.blocked && attackAllowed(o, tile) &&
      shells.every(shell => Math.hypot(tile.x + .5 - shell.x, tile.y + .5 - shell.y) > shell.radius + .6));
    safe.sort((a, b) => near(a, threatened) - near(b, threatened) || distance(a, producer) - distance(b, producer) || o.tie(a) - o.tie(b));
    return safe[0] || null;
  }

  function directMortars(game, o, s) {
    if (typeof game.setMortarTarget !== 'function') return;
    const config = profileFor(s.profile), stats = Engine.BUILDING_STATS.mortar;
    if (!stats) return;
    for (const mortar of o.ownBuildings.filter(b => b.type === 'mortar' && b.connected)) {
      if (o.p.time < config.opening) {
        if (mortar.mortarTarget) game.setMortarTarget(o.team, mortar.id, null, null);
        continue;
      }
      const candidates = [...o.enemyBuildings.filter(b => b.type !== 'core' || o.p.time >= config.corePush), ...o.enemyUnits]
        .filter(enemy => attackAllowed(o, enemy) && near(enemy, mortar) >= stats.minRange && near(enemy, mortar) <= stats.range);
      function value(enemy) {
        const structure = enemy.type === 'bastion' || enemy.type === 'mortar' ? 5 : enemy.type !== 'droplet' ? 3 : 0;
        return structure + o.enemyUnits.filter(unit => near(unit, enemy) <= stats.blastRadius).length;
      }
      candidates.sort((a, b) => value(b) - value(a) || distance(a, mortar) - distance(b, mortar) || o.tie(a) - o.tie(b));
      const target = candidates[0];
      if (target) {
        const x = Math.floor(target.x), y = Math.floor(target.y);
        if (!mortar.mortarTarget || mortar.mortarTarget.x !== x || mortar.mortarTarget.y !== y) game.setMortarTarget(o.team, mortar.id, x, y);
      } else if (mortar.mortarTarget) game.setMortarTarget(o.team, mortar.id, null, null);
    }
  }

  function cardIndex(o, id) { return o.p.hand.indexOf(id); }

  function play(game, o, s, cardId, candidates) {
    const handIndex = cardIndex(o, cardId);
    const card = typeof game.getCard === 'function' ? game.getCard(o.team, cardId) : Engine.CARDS[cardId];
    if (handIndex < 0 || !card || o.p.pigment < card.cost) return false;
    for (const candidate of candidates.slice(0, 8)) {
      const x = Math.floor(candidate.x), y = Math.floor(candidate.y);
      const preview = game.previewCard(o.team, handIndex, x, y);
      if (!preview.ok) continue;
      const result = game.playCard(o.team, handIndex, x, y);
      if (result.ok) { s.lastCard = o.p.time; return true; }
    }
    return false;
  }

  function buildingSites(o, kind) {
    const source = kind === 'extractor';
    const sites = o.p.tiles.filter(t => t.owner === o.team && t.connected && !t.blocked &&
      !!t.source === source && !o.occupied.has(key(t.x, t.y, o.p.width)))
      .filter(t => {
        const footprint = o.p.tiles.filter(other => !other.blocked && near(other, t) <= Engine.CARDS[kind].radius);
        return footprint.every(other => expansionAllowed(o, other)) &&
          footprint.filter(other => other.owner !== o.team).length <= expansionBudget(o);
      });
    const threat = closestThreat(o);
    function score(t) {
      const forward = (t.y - o.core.y) * o.direction;
      if (kind === 'barracks') {
        const desired = o.producers.length ? Math.min(11, 4 + o.p.time / 12) : 2;
        const crowded = o.producers.reduce((sum, b) => sum + Math.max(0, 4 - near(t, b)) * 3, 0);
        return -Math.abs(forward - desired) * 2 - Math.abs(t.x - o.core.x) * .35 - crowded;
      }
      if (kind === 'mortar') {
        const stats = Engine.BUILDING_STATS.mortar;
        const targets = stats ? [...o.enemyBuildings, ...o.enemyUnits].filter(enemy => near(enemy, t) >= stats.minRange && near(enemy, t) <= stats.range) : [];
        const danger = o.enemyUnits.reduce((sum, unit) => sum + Math.max(0, 3 - near(unit, t)) * 3, 0);
        const crowded = o.ownBuildings.filter(b => b.type === 'mortar').reduce((sum, b) => sum + Math.max(0, 4 - near(t, b)) * 3, 0);
        return targets.length * 5 + Math.min(forward, 9) * .3 - danger - crowded;
      }
      if (kind === 'bastion') {
        const target = threat || { x: o.core.x, y: (o.core.y + o.enemyStart.y) / 2 };
        const crowded = o.ownBuildings.filter(b => b.type === 'bastion').reduce((sum, b) => sum + Math.max(0, 5 - near(t, b)) * 3, 0);
        return -distance(t, target) - crowded;
      }
      if (kind === 'relay') {
        let gain = 0;
        for (const other of o.p.tiles) if (!other.blocked && other.owner === 0 && near(t, other) <= 3.2) gain++;
        return gain * 2 + forward * .12;
      }
      return -distance(t, o.core);
    }
    const scores = new Map(sites.map(t => [t, score(t)]));
    return sites.sort((a, b) => scores.get(b) - scores.get(a) || o.tie(a) - o.tie(b));
  }

  function tacticalCard(game, o, s) {
    const config = profileFor(s.profile);
    const threat = closestThreat(o);
    const units = o.enemyUnits.filter(unit => attackAllowed(o, unit)).sort((a, b) => {
      const clusterA = o.enemyUnits.filter(u => near(a, u) < 2.5).length;
      const clusterB = o.enemyUnits.filter(u => near(b, u) < 2.5).length;
      return clusterB - clusterA || distance(a, o.core) - distance(b, o.core) || o.tie(a) - o.tie(b);
    });
    if (units.length && (threat || o.p.time >= config.opening)) {
      if (play(game, o, s, 'splash', units)) return true;
      if (play(game, o, s, 'wave', units)) return true;
    }
    // A known hostile building is a valid combat target; an unobserved building
    // in memory does not authorize a spell through fog.
    if (o.p.time >= config.opening && play(game, o, s, 'splash', o.enemyBuildings.filter(b => attackAllowed(o, b) && (b.type !== 'core' || o.p.time >= config.corePush)))) return true;
    if (o.p.time >= config.opening && cardIndex(o, 'bleach') >= 0) {
      const enemyPaint = o.p.tiles.filter(t => t.visible && t.owner === o.enemy && !t.blocked && attackAllowed(o, t));
      const weights = new Map(enemyPaint.map(t => [t, enemyPaint.filter(n => near(n, t) < 2.5).length]));
      enemyPaint.sort((a, b) => {
        return weights.get(b) - weights.get(a) || distance(a, o.core) - distance(b, o.core) || o.tie(a) - o.tie(b);
      });
      if (play(game, o, s, 'bleach', enemyPaint)) return true;
    }
    return false;
  }

  function healingMixture(game, o, s) {
    const last = o.p.mixtureLast;
    if (!o.p.mixtures || !last || !attackAllowed(o, last) || o.p.time - last.time > 4 || (last.color !== 'blue' && last.color !== 'yellow')) return false;
    const injured = o.ownUnits.filter(unit => unit.hp < unit.maxHp && near(unit, last) <= 3.5);
    if (injured.reduce((sum, unit) => sum + Math.min(12, unit.maxHp - unit.hp), 0) < 12) return false;
    const color = last.color === 'blue' ? 'yellow' : 'blue';
    const positions = [{ x: last.x, y: last.y }, ...injured.map(unit => ({ x: Math.floor(unit.x), y: Math.floor(unit.y) }))]
      .filter(point => near(point, last) <= 2 && injured.some(unit => near(unit, point) <= 2));
    // Complete an already prepared legal blend. The AI neither invents cards
    // nor spends two powers solely to manufacture a heal.
    const candidates = o.p.hand.filter(id => Engine.CARDS[id]?.color === color)
      .sort((a, b) => Engine.CARDS[a].cost - Engine.CARDS[b].cost);
    for (const id of candidates) if (play(game, o, s, id, positions)) return true;
    return false;
  }

  function paintObjective(o) {
    const sources = o.p.tiles.filter(t => t.source && !t.blocked && t.owner !== o.enemy && !(t.owner === o.team && t.connected));
    const safe = sources.filter(t => expansionAllowed(o, t));
    safe.sort((a, b) => distance(a, o.core) - distance(b, o.core) || o.tie(a) - o.tie(b));
    if (safe.length) return safe[0];
    return null;
  }

  function stroke(o, objective, budget) {
    const cap = Math.min(o.p.brushLimit || Engine.CONFIG.brushLimit, Math.floor(budget / Engine.CONFIG.brushCost), expansionBudget(o));
    if (cap < 1) return null;
    const parents = new Int32Array(o.p.tiles.length).fill(-2);
    const depth = new Int32Array(o.p.tiles.length);
    const queue = [];
    for (let i = 0; i < o.p.tiles.length; i++) {
      const t = o.p.tiles[i];
      if (!t.blocked && t.owner === o.team && t.connected) { parents[i] = -1; queue.push(i); }
    }
    // Stable order under a 180-degree rotation also makes the balance check
    // useful: a side cannot win just because array iteration always starts north.
    queue.sort((a, b) => o.tie(o.p.tiles[a]) - o.tie(o.p.tiles[b]));
    const candidates = [];
    const delta = o.team === 2 ? [[0, 1], [-1, 0], [1, 0], [0, -1]] : [[0, -1], [1, 0], [-1, 0], [0, 1]];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor], t = o.p.tiles[index];
      if (depth[index] >= cap) continue;
      for (const [dx, dy] of delta) {
        const next = o.tile(t.x + dx, t.y + dy);
        // No ownership probes into fog. Public obstacles and source positions
        // can guide a route, but a paint action uses visible neutral ground only.
        if (!next || next.blocked || !next.visible || next.owner === null || next.owner === o.enemy || !expansionAllowed(o, next)) continue;
        const ni = key(next.x, next.y, o.p.width);
        if (parents[ni] !== -2) continue;
        parents[ni] = index;
        depth[ni] = depth[index] + (next.owner === 0 ? 1 : 0);
        if (depth[ni] === 0) continue;
        candidates.push(ni);
        if (next.owner === 0) queue.push(ni); // isolated own land may be reconnected at the endpoint
      }
    }
    if (!candidates.length) return null;
    const half = (o.core.y + o.enemyStart.y) / 2;
    function score(index) {
      const t = o.p.tiles[index];
      if (objective) return -distance(t, objective) * 4 + depth[index] * .15;
      const forward = (t.y - o.core.y) * o.direction;
      const pastCentre = Math.max(0, (t.y - half) * o.direction);
      let open = 0;
      for (const [dx, dy] of delta) if (o.tile(t.x + dx, t.y + dy)?.owner === 0) open++;
      return depth[index] * 2 + open * .35 + Math.min(forward, 10) * .04 - pastCentre * (o.p.time < 90 ? .4 : .05);
    }
    const scores = new Map(candidates.map(i => [i, score(i)]));
    candidates.sort((a, b) => scores.get(b) - scores.get(a) || o.tie(o.p.tiles[a]) - o.tie(o.p.tiles[b]));
    const path = [];
    for (let index = candidates[0]; index >= 0; index = parents[index]) {
      const t = o.p.tiles[index]; path.push({ x: t.x, y: t.y });
    }
    return path.reverse();
  }

  function paint(game, o, s) {
    if (o.p.time - s.lastBrush < profileFor(s.profile).brushDelay) return false;
    // Keep one spawn's pigment available while expanding, without exempting the
    // AI from the ordinary meter. A cut network can still be repaired when poor.
    const disconnected = o.ownBuildings.some(b => !b.connected);
    const reserve = disconnected || o.p.pigment < 8 ? 0 : Engine.CONFIG.unitCost;
    const isolated = s.profile === 'default' ? null : o.ownBuildings.filter(b => !b.connected)
      .sort((a, b) => (a.type === 'barracks' ? -1 : 1) - (b.type === 'barracks' ? -1 : 1) || distance(a, o.core) - distance(b, o.core))[0];
    const path = stroke(o, isolated || paintObjective(o), o.p.pigment - reserve);
    if (!path) return false;
    const preview = game.previewPaint(o.team, path);
    if (!preview.ok) return false;
    const result = game.paint(o.team, path);
    if (!result.ok) return false;
    s.lastBrush = o.p.time;
    return true;
  }

  function manageProduction(game, o, s) {
    const config = profileFor(s.profile);
    // Production shares the resource bar. Keep one affordable stream rather
    // than let several factories permanently consume every pigment as it arrives.
    const spendingRate = Engine.CONFIG.unitCost / Engine.CONFIG.unitInterval;
    const active = o.producers.filter(b => b.connected && !b.productionPaused);
    const desiredArmy = o.p.time < config.opening + 35 ? config.army[0] : o.p.time < config.opening + 70 ? config.army[1] :
      o.p.time < config.corePush ? config.army[2] : o.p.time < config.corePush + 30 ? 12 : Engine.CONFIG.unitLimit;
    if (o.ownUnits.length >= desiredArmy) {
      for (const b of active) if (game.toggleProduction(o.team, b.id).ok) s.pausedByAI.add(b.id);
      return;
    }
    if (active.length > 1 && o.p.pigment < 12 && active.length * spendingRate > o.p.income * .85) {
      active.sort((a, b) => distance(a, o.core) - distance(b, o.core));
      const back = active[0];
      if (game.toggleProduction(o.team, back.id).ok) s.pausedByAI.add(back.id);
    } else if (o.p.pigment > 32) {
      for (const id of s.pausedByAI) {
        const b = o.producers.find(value => value.id === id);
        if (!b) { s.pausedByAI.delete(id); continue; }
        if (!b.productionPaused) { s.pausedByAI.delete(id); continue; }
        if (b.connected && game.toggleProduction(o.team, id).ok) { s.pausedByAI.delete(id); break; }
      }
    }
  }

  function think(game, p, s) {
    const config = profileFor(s.profile);
    const o = observation(p, config);
    if (!o) return;
    remember(o, s);
    directFlows(game, o, s);
    directMortars(game, o, s);
    manageProduction(game, o, s);
    if (!o.producers.length && play(game, o, s, 'barracks', buildingSites(o, 'barracks'))) return;
    if (closestThreat(o) && tacticalCard(game, o, s)) return;
    if (healingMixture(game, o, s)) return;
    if (play(game, o, s, 'extractor', buildingSites(o, 'extractor'))) return;
    if (s.profile === 'builder' && p.time > 22 && p.pigment > 40 &&
        o.ownBuildings.filter(b => b.type === 'bastion').length < 2 &&
        play(game, o, s, 'bastion', buildingSites(o, 'bastion'))) return;
    if (p.hand.includes('mortar') && p.time >= config.opening &&
        o.ownBuildings.filter(b => b.type === 'mortar').length < 2) {
      const stats = Engine.BUILDING_STATS.mortar;
      const useful = stats && buildingSites(o, 'mortar').filter(site => o.enemyBuildings.some(enemy =>
        attackAllowed(o, enemy) && (enemy.type !== 'core' || p.time >= config.corePush) && near(site, enemy) >= stats.minRange && near(site, enemy) <= stats.range));
      if (useful && play(game, o, s, 'mortar', useful)) return;
    }
    const relaySites = buildingSites(o, 'relay');
    const usefulRelay = relaySites.filter(t => o.p.tiles.filter(n => n.owner === 0 && !n.blocked && near(t, n) <= 3.2).length >= 9);
    if (p.time - s.lastCard >= 2.4 && play(game, o, s, 'relay', usefulRelay)) return;
    if (o.producers.length < (p.time > 100 ? 3 : 2) && p.time > config.secondProducer &&
        p.pigment >= Engine.CARDS.barracks.cost + 6 && play(game, o, s, 'barracks', buildingSites(o, 'barracks'))) return;
    if (tacticalCard(game, o, s)) return;
    if (paint(game, o, s)) return;
    if (p.time > 30 && o.ownBuildings.filter(b => b.type === 'bastion').length < 2 &&
        p.pigment >= Engine.CARDS.bastion.cost + 6 && play(game, o, s, 'bastion', buildingSites(o, 'bastion'))) return;
    if (p.time > 75 && o.core.level < 3 && p.pigment > 70) game.upgradeCore(o.team);
  }

  function update(game, dt, team = 2) {
    if (!game || game.winner !== null || (team !== 1 && team !== 2)) return;
    const s = state(game, team);
    s.lastTime = game.time;
    if (game.time + 1e-7 < s.nextThink) return;
    s.nextThink = game.time + profileFor(s.profile).step;
    const p = game.perception(team);
    if (p.winner !== null) return;
    think(game, p, s);
  }

  return Object.freeze({ update, reset, configure, snapshot, restore, pacing, PROFILES, OPENING, CORE_PUSH });
});
