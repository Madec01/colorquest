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
  const OPENING = 42;
  const CORE_PUSH = 170;
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
      value = { nextThink: game.time + STEP, lastTime: game.time, lastBrush: -Infinity,
        lastCard: -Infinity, lastFlow: -Infinity, observations: new Map(), orders: new Map(), pausedByAI: new Set() };
      match.set(team, value);
    }
    return value;
  }

  function reset(game, team) {
    if (team === undefined) memories.delete(game);
    else memories.get(game)?.delete(team);
  }

  function observation(p) {
    const team = p.team;
    const ownBuildings = p.buildings.filter(b => b.team === team);
    const ownUnits = p.units.filter(u => u.team === team);
    const core = ownBuildings.find(b => b.type === 'core');
    if (!core) return null;
    const enemy = 3 - team;
    const enemyStart = p.coreStarts[enemy];
    const direction = Math.sign(enemyStart.y - core.y) || 1;
    const occupied = new Set(p.buildings.map(b => key(b.x, b.y, p.width)));
    return { p, team, enemy, core, enemyStart, direction, ownBuildings, ownUnits, occupied,
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

  function closestThreat(o) {
    return o.enemyUnits.map(u => ({ u, d: Math.min(...o.ownBuildings.map(b => near(u, b))) }))
      .filter(item => item.d < 5.5)
      .sort((a, b) => near(a.u, o.core) - near(b.u, o.core) || a.d - b.d || o.tie(a.u) - o.tie(b.u))[0]?.u;
  }

  function exploredTarget(o, target) {
    return o.p.tiles.filter(t => t.explored && !t.blocked)
      .sort((a, b) => distance(a, target) - distance(b, target) || o.tie(a) - o.tie(b))[0];
  }

  function dominationTarget(o) {
    if (o.p.scores[o.enemy] < .42 && o.p.hold[o.enemy] <= 0) return null;
    const candidates = o.p.tiles.filter(t => t.visible && t.owner === o.enemy && !t.blocked &&
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
    if (o.p.time - s.lastFlow < FLOW_DELAY) return;
    s.lastFlow = o.p.time;
    let target = closestThreat(o) || dominationTarget(o);
    if (!target) {
      if (o.p.time < OPENING) {
        // Development is immediate, but the first troops visibly assemble on
        // their own half before attacking. An early invasion is still defended.
        target = { x: o.core.x, y: o.core.y + o.direction * (o.p.time < 18 ? 4 : 7) };
      } else {
        const known = [...s.observations.values()].filter(b => b.type !== 'core' || o.p.time >= CORE_PUSH);
        known.sort((a, b) => distance(a, o.core) - distance(b, o.core) || o.tie(a) - o.tie(b));
        const staging = o.p.time < 95 ? 10 : 14;
        target = known[0] || (o.p.time < CORE_PUSH ? { x: o.core.x, y: o.core.y + o.direction * staging } : o.enemyStart);
      }
    }
    const destination = exploredTarget(o, target);
    if (!destination) return;
    const orphaned = o.ownUnits.some(u => u.producerId === o.core.id);
    const producers = orphaned ? [o.core, ...o.producers] : o.producers;
    for (const producer of producers) {
      const previous = s.orders.get(producer.id);
      if (previous && distance(previous, destination) < 2 && producer.flow) continue;
      const result = game.setFlow(o.team, producer.id, destination.x, destination.y);
      if (result.ok) s.orders.set(producer.id, { x: destination.x, y: destination.y });
    }
    for (const id of s.orders.keys()) if (!producers.some(b => b.id === id)) s.orders.delete(id);
  }

  function cardIndex(o, id) { return o.p.hand.indexOf(id); }

  function play(game, o, s, cardId, candidates) {
    const handIndex = cardIndex(o, cardId);
    if (handIndex < 0 || o.p.pigment < Engine.CARDS[cardId].cost) return false;
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
      !!t.source === source && !o.occupied.has(key(t.x, t.y, o.p.width)));
    const threat = closestThreat(o);
    function score(t) {
      const forward = (t.y - o.core.y) * o.direction;
      if (kind === 'barracks') {
        const desired = o.producers.length ? Math.min(11, 4 + o.p.time / 12) : 2;
        const crowded = o.producers.reduce((sum, b) => sum + Math.max(0, 4 - near(t, b)) * 3, 0);
        return -Math.abs(forward - desired) * 2 - Math.abs(t.x - o.core.x) * .35 - crowded;
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
    const threat = closestThreat(o);
    const units = o.enemyUnits.slice().sort((a, b) => {
      const clusterA = o.enemyUnits.filter(u => near(a, u) < 2.5).length;
      const clusterB = o.enemyUnits.filter(u => near(b, u) < 2.5).length;
      return clusterB - clusterA || distance(a, o.core) - distance(b, o.core) || o.tie(a) - o.tie(b);
    });
    if (units.length && (threat || o.p.time >= OPENING)) {
      if (play(game, o, s, 'splash', units)) return true;
      if (play(game, o, s, 'wave', units)) return true;
    }
    // A known hostile building is a valid combat target; an unobserved building
    // in memory does not authorize a spell through fog.
    if (o.p.time >= OPENING && play(game, o, s, 'splash', o.enemyBuildings.filter(b => b.type !== 'core' || o.p.time >= CORE_PUSH))) return true;
    if (o.p.time >= OPENING && cardIndex(o, 'bleach') >= 0) {
      const enemyPaint = o.p.tiles.filter(t => t.visible && t.owner === o.enemy && !t.blocked);
      const weights = new Map(enemyPaint.map(t => [t, enemyPaint.filter(n => near(n, t) < 2.5).length]));
      enemyPaint.sort((a, b) => {
        return weights.get(b) - weights.get(a) || distance(a, o.core) - distance(b, o.core) || o.tie(a) - o.tie(b);
      });
      if (play(game, o, s, 'bleach', enemyPaint)) return true;
    }
    return false;
  }

  function paintObjective(o) {
    const sources = o.p.tiles.filter(t => t.source && !t.blocked && t.owner !== o.enemy && !(t.owner === o.team && t.connected));
    const safe = sources.filter(t => (t.y - o.core.y) * o.direction <= (o.p.time < 50 ? 11 : 19));
    safe.sort((a, b) => distance(a, o.core) - distance(b, o.core) || o.tie(a) - o.tie(b));
    if (safe.length) return safe[0];
    return null;
  }

  function stroke(o, objective, budget) {
    const cap = Math.min(Engine.CONFIG.brushLimit, Math.floor(budget / Engine.CONFIG.brushCost));
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
        if (!next || next.blocked || !next.visible || next.owner === null || next.owner === o.enemy) continue;
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
    if (o.p.time - s.lastBrush < BRUSH_DELAY) return false;
    // Keep one spawn's pigment available while expanding, without exempting the
    // AI from the ordinary meter. A cut network can still be repaired when poor.
    const disconnected = o.ownBuildings.some(b => !b.connected);
    const reserve = disconnected || o.p.pigment < 8 ? 0 : Engine.CONFIG.unitCost;
    const path = stroke(o, paintObjective(o), o.p.pigment - reserve);
    if (!path) return false;
    const preview = game.previewPaint(o.team, path);
    if (!preview.ok) return false;
    const result = game.paint(o.team, path);
    if (!result.ok) return false;
    s.lastBrush = o.p.time;
    return true;
  }

  function manageProduction(game, o, s) {
    // Production shares the resource bar. Keep one affordable stream rather
    // than let several factories permanently consume every pigment as it arrives.
    const spendingRate = Engine.CONFIG.unitCost / Engine.CONFIG.unitInterval;
    const active = o.producers.filter(b => b.connected && !b.productionPaused);
    const desiredArmy = o.p.time < OPENING ? 5 : o.p.time < 95 ? 9 : o.p.time < CORE_PUSH ? 13 : Engine.CONFIG.unitLimit;
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
    const o = observation(p);
    if (!o) return;
    remember(o, s);
    directFlows(game, o, s);
    manageProduction(game, o, s);
    if (!o.producers.length && play(game, o, s, 'barracks', buildingSites(o, 'barracks'))) return;
    if (closestThreat(o) && tacticalCard(game, o, s)) return;
    if (play(game, o, s, 'extractor', buildingSites(o, 'extractor'))) return;
    const relaySites = buildingSites(o, 'relay');
    const usefulRelay = relaySites.filter(t => o.p.tiles.filter(n => n.owner === 0 && !n.blocked && near(t, n) <= 3.2).length >= 9);
    if (p.time - s.lastCard >= 2.4 && play(game, o, s, 'relay', usefulRelay)) return;
    if (o.producers.length < (p.time > 100 ? 3 : 2) && p.time > 22 &&
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
    s.nextThink = game.time + STEP;
    const p = game.perception(team);
    if (p.winner !== null) return;
    think(game, p, s);
  }

  return Object.freeze({ update, reset, OPENING, CORE_PUSH });
});
