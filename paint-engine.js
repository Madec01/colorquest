/* Colorquest V0.8: isolated, deterministic paint-and-cards simulation.
 * No DOM, storage, audio, AI, or dependency on the classic game.
 * Tile positions are integers; unit positions are continuous cell centres.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CQPaintEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CONFIG = Object.freeze({
    width: 19, height: 27, duration: 240, overtimeDuration: 30, step: 1 / 30,
    initialPigment: 65, pigmentCap: 100, brushCost: 1, brushLimit: 12,
    unitCost: 6, unitInterval: 5, unitLimit: 24, productionReserve: 0,
    baseIncome: 1.6, territoryIncomeCap: 1.2, sourceIncome: .85, sourceLimit: 3,
    domination: .5, holdDuration: 15, finalMinuteMultiplier: 1.5,
    coreUpgradeCosts: Object.freeze([35, 50]),
    coreStarts: Object.freeze([null, Object.freeze({ x: 9, y: 23 }), Object.freeze({ x: 9, y: 3 })])
  });
  const CARDS = Object.freeze({
    relay: Object.freeze({ id: 'relay', name: 'Relais', kind: 'building', type: 'relay', description: 'Étend votre couleur autour du point de pose.', cost: 12, icon: '◇', color: 'blue', radius: 3.2 }),
    barracks: Object.freeze({ id: 'barracks', name: 'Caserne', kind: 'building', type: 'barracks', description: 'Une goutte toutes les 5 s, pour 6 pigments. Glissez pour diriger son groupe.', cost: 32, icon: '▥', color: 'red', radius: 1.8 }),
    extractor: Object.freeze({ id: 'extractor', name: 'Extracteur', kind: 'building', type: 'extractor', description: 'Sur une source reliée : +0,85 pigment/s. Bonus limité à 3 extracteurs actifs.', cost: 18, icon: '◉', color: 'yellow', radius: 1.5 }),
    splash: Object.freeze({ id: 'splash', name: 'Éclaboussure', kind: 'power', type: 'splash', description: 'Blesse les ennemis visibles dans la zone.', cost: 16, icon: '✦', color: 'red', range: 5, radius: 2 }),
    bastion: Object.freeze({ id: 'bastion', name: 'Bastion', kind: 'building', type: 'bastion', description: 'Défend les environs tant qu’il reste relié.', cost: 30, icon: '⬟', color: 'blue', radius: 1.5 }),
    wave: Object.freeze({ id: 'wave', name: 'Vague', kind: 'power', type: 'wave', description: 'Repousse et blesse les gouttes ennemies visibles.', cost: 12, icon: '≈', color: 'blue', range: 5, radius: 2.4 }),
    bleach: Object.freeze({ id: 'bleach', name: 'Gomme', kind: 'power', type: 'bleach', description: 'Efface la couleur ennemie visible, sauf sous ses bâtiments.', cost: 14, icon: '▱', color: 'yellow', range: 5, radius: 2.2 }),
    mortar: Object.freeze({ id: 'mortar', name: 'Mortier', kind: 'building', type: 'mortar', description: 'Bombarde une zone visible à 2,5–7 cases. Glissez pour viser ; impact après 1,2 s, toutes les 5 s.', cost: 40, icon: '⊙', color: 'red', radius: 1.2 })
  });
  const BUILDING_STATS = Object.freeze({
    core: { hp: 240, sight: 5, range: 3.5, damage: 8, interval: 1 },
    relay: { hp: 70, sight: 3, radius: 3.2 },
    extractor: { hp: 75, sight: 3, radius: 1.5 },
    bastion: { hp: 125, sight: 4.5, radius: 1.5, range: 4.2, damage: 8, interval: .95 },
    barracks: { hp: 100, sight: 3, radius: 1.8 },
    mortar: { hp: 80, sight: 5, radius: 1.2, minRange: 2.5, range: 7, unitDamage: 18, buildingDamage: 12, interval: 5, flightTime: 1.2, blastRadius: 1.5 }
  });
  const UNIT_STATS = Object.freeze({ hp: 32, speed: 1.65, damage: 6, range: 1.3, interval: .9, sight: 3.5, aggro: 3.3 });
  const DEFAULT_DECK = Object.freeze(['relay', 'barracks', 'extractor', 'splash', 'bastion', 'wave', 'bleach', 'barracks']);
  const MIXTURE = Object.freeze({ window: 4, distance: 2, radius: 2, heal: 12 });
  const freezeCells = cells => Object.freeze(cells.map(cell => Object.freeze(cell)));
  const MAPS = Object.freeze({
    canvas: Object.freeze({ id: 'canvas', name: 'Toile ouverte', description: 'Des espaces ouverts pour prendre ses marques.',
      blocked: freezeCells([[3, 12], [4, 12], [3, 13], [4, 13], [14, 13], [15, 13], [14, 14], [15, 14]]),
      sources: freezeCells([[5, 19], [13, 19], [5, 7], [13, 7], [9, 13]]) }),
    narrows: Object.freeze({ id: 'narrows', name: 'Le passage', description: 'Deux seuils resserrent les armées au centre de la toile.',
      blocked: freezeCells([12, 14].flatMap(y => [0, 1, 2, 3, 4, 5, 6, 12, 13, 14, 15, 16, 17, 18].map(x => [x, y]))),
      sources: freezeCells([[4, 18], [14, 18], [4, 8], [14, 8], [9, 13]]) }),
    crossroads: Object.freeze({ id: 'crossroads', name: 'Les croisements', description: 'Des îlots séparent plusieurs voies autour des sources.',
      blocked: freezeCells([9, 10, 11, 15, 16, 17].flatMap(y => [5, 6, 7, 11, 12, 13].map(x => [x, y]))),
      sources: freezeCells([[9, 18], [9, 8], [3, 13], [15, 13], [9, 13]]) })
  });
  function normalizeModifiers(value) {
    if (value == null) value = {};
    if (typeof value !== 'object' || Array.isArray(value)) throw new RangeError('Vernis invalides.');
    const bounded = (key, max, integer = false) => {
      const amount = value[key] === undefined ? 0 : value[key];
      if (!Number.isFinite(amount) || amount < 0 || amount > max || (integer && !Number.isInteger(amount))) throw new RangeError('Vernis invalide : ' + key);
      return amount;
    };
    const discounts = value.cardDiscounts === undefined ? {} : value.cardDiscounts;
    if (!discounts || typeof discounts !== 'object' || Array.isArray(discounts) || Object.keys(discounts).some(key => key !== 'barracks' && key !== 'splash')) throw new RangeError('Réduction de carte invalide.');
    const cardDiscounts = {};
    for (const [id, max] of [['barracks', 6], ['splash', 4]]) {
      const amount = discounts[id] === undefined ? 0 : discounts[id];
      if (!Number.isInteger(amount) || amount < 0 || amount > max) throw new RangeError('Réduction de carte invalide : ' + id);
      cardDiscounts[id] = amount;
    }
    return { brushBonus: bounded('brushBonus', 3, true), reinforcementSpeed: bounded('reinforcementSpeed', .15), buildingHealth: bounded('buildingHealth', .2), cardDiscounts };
  }
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const validTeam = team => team === 1 || team === 2;
  const point = (x, y) => Number.isInteger(x) && Number.isInteger(y);
  const sqrDistance = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const centre = object => object.type === 'droplet' ? object : { x: object.x + .5, y: object.y + .5 };
  const copyPoint = p => p ? { x: p.x, y: p.y } : null;

  class Game {
    constructor(options = {}) {
      this.width = CONFIG.width;
      this.height = CONFIG.height;
      this.mapId = options.mapId === undefined ? 'canvas' : options.mapId;
      if (!Object.hasOwn(MAPS, this.mapId)) throw new RangeError('Toile inconnue.');
      this.modifiers = [null, normalizeModifiers(options.modifiers && options.modifiers[1]), normalizeModifiers(options.modifiers && options.modifiers[2])];
      this.mixtures = options.mixtures === true;
      this._mixtureLast = [null, null, null];
      this.shells = [];
      this.seed = (Number.isFinite(options.seed) ? options.seed : 71001) >>> 0;
      this.time = 0;
      this.duration = Number.isFinite(options.duration) && options.duration > 0 ? options.duration : CONFIG.duration;
      this.overtime = false;
      this.overtimeDuration = CONFIG.overtimeDuration;
      this.winner = null;
      this.winReason = '';
      this.accelerated = false;
      this.pigment = [0, CONFIG.initialPigment, CONFIG.initialPigment];
      this.income = [0, 0, 0];
      this.scores = [0, 0, 0];
      this.hold = [0, 0, 0];
      this.buildings = [];
      this.units = [];
      this.hands = [[], [], []];
      this.decks = [[], [], []];
      for (let team = 1; team <= 2; team++) {
        const deck = options.decks && options.decks[team] !== undefined ? options.decks[team] : DEFAULT_DECK;
        if (!Array.isArray(deck) || deck.length !== 8 || deck.some(id => typeof id !== 'string' || !Object.hasOwn(CARDS, id))) throw new RangeError('Un paquet contient exactement huit cartes connues.');
        this.hands[team] = deck.slice(0, 4);
        this.decks[team] = deck.slice(4);
      }
      this.events = [];
      this.spendingHeld = [false, false, false];
      this._id = 1;
      this._eventId = 1;
      this._accumulator = 0;
      this._productionCursor = [0, 0, 0];
      this._unitSequence = [0, 0, 0];
      this._holdActive = [false, false, false];
      this.tiles = Array.from({ length: this.width * this.height }, (_, index) => ({
        x: index % this.width, y: Math.floor(index / this.width), owner: 0,
        blocked: false, source: false, connected: false, lastSeenOwner: [0, 0, 0]
      }));
      this.visibility = [[], this.tiles.map(() => false), this.tiles.map(() => false)];
      this.explored = [[], this.tiles.map(() => false), this.tiles.map(() => false)];
      // Public rotationally symmetric geometry. The seed controls no hidden bonuses.
      for (const [x, y] of MAPS[this.mapId].blocked) this.tile(x, y).blocked = true;
      for (const [x, y] of MAPS[this.mapId].sources) this.tile(x, y).source = true;
      for (let team = 1; team <= 2; team++) {
        const start = CONFIG.coreStarts[team];
        this._addBuilding(team, 'core', start.x, start.y);
        this._claimNeutralDisk(team, start.x, start.y, 3.3);
      }
      this.recompute();
    }

    tile(x, y) {
      if (!point(x, y) || x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
      return this.tiles[y * this.width + x];
    }
    get timeLimit() { return this.duration + (this.overtime ? this.overtimeDuration : 0); }
    getCard(team, id) {
      if (!validTeam(team) || !Object.hasOwn(CARDS, id)) return null;
      const card = CARDS[id], discount = this.modifiers[team].cardDiscounts[id] || 0;
      return discount ? Object.assign({}, card, { cost: card.cost - discount }) : card;
    }
    getBrushLimit(team) { return CONFIG.brushLimit + (validTeam(team) ? this.modifiers[team].brushBonus : 0); }
    getCore(team) { return this.buildings.find(b => b.team === team && b.type === 'core' && b.hp > 0) || null; }
    getProducers(team) { return this.buildings.filter(b => b.team === team && b.hp > 0 && (b.type === 'core' || b.type === 'barracks')); }
    getUnitCount(team) { return this.units.filter(u => u.team === team && u.hp > 0).length; }
    isVisible(team, x, y) { return validTeam(team) && !!this.tile(Math.floor(x), Math.floor(y)) && !!this.visibility[team][Math.floor(y) * this.width + Math.floor(x)]; }
    canSpend(team, cost) { return validTeam(team) && Number.isFinite(cost) && cost >= 0 && this.pigment[team] + 1e-8 >= cost; }
    setSpendingHeld(team, held) {
      if (!validTeam(team)) return;
      this.spendingHeld[team] = !!held;
      this._refreshProductionStates();
    }

    _event(type, team, details = {}) {
      this.events.push(Object.assign({ id: this._eventId++, type, team, time: this.time }, details));
      if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
    }
    _addBuilding(team, type, x, y) {
      const stats = BUILDING_STATS[type];
      const maxHp = stats.hp * (1 + this.modifiers[team].buildingHealth);
      const building = {
        id: this._id++, team, type, x, y, hp: maxHp, maxHp,
        connected: false, level: 1, productionPaused: false, productionProgress: 0,
        productionState: type === 'barracks' ? 'running' : 'none', productionReason: '',
        flow: null, flowMode: 'attack', mortarTarget: null, attackCooldown: 0
      };
      this.buildings.push(building);
      return building;
    }
    _addUnit(team, producer, position, paidCost = 0) {
      const unit = {
        id: this._id++, ordinal: ++this._unitSequence[team], team, type: 'droplet', producerId: producer.id,
        x: position.x, y: position.y, hp: UNIT_STATS.hp, maxHp: UNIT_STATS.hp,
        target: copyPoint(producer.flow), retreating: false, attackCooldown: .3, path: [], pathTarget: null
      };
      this.units.push(unit);
      this._event('spawn', team, { x: unit.x, y: unit.y, producerId: producer.id, unitId: unit.id, cost: paidCost });
      return unit;
    }

    _claimNeutralDisk(team, x, y, radius) {
      const initial = this.tile(x, y);
      if (!initial || initial.blocked || (initial.owner && initial.owner !== team)) return [];
      const queue = [initial], visited = new Set(), changed = [];
      while (queue.length) {
        const tile = queue.shift(), index = tile.y * this.width + tile.x;
        if (visited.has(index)) continue;
        visited.add(index);
        if (tile.blocked || (tile.owner && tile.owner !== team) || Math.hypot(tile.x - x, tile.y - y) > radius) continue;
        if (tile.owner !== team) { tile.owner = team; changed.push({ x: tile.x, y: tile.y }); }
        for (const [dx, dy] of DIRS) { const next = this.tile(tile.x + dx, tile.y + dy); if (next) queue.push(next); }
      }
      return changed;
    }

    recompute() {
      for (const tile of this.tiles) tile.connected = false;
      const counts = [0, 0, 0];
      for (let team = 1; team <= 2; team++) {
        const core = this.getCore(team);
        const start = core && this.tile(core.x, core.y);
        if (!start || start.owner !== team || start.blocked) continue;
        const queue = [start];
        start.connected = true;
        for (let i = 0; i < queue.length; i++) {
          const tile = queue[i];
          counts[team]++;
          for (const [dx, dy] of DIRS) {
            const next = this.tile(tile.x + dx, tile.y + dy);
            if (next && !next.blocked && !next.connected && next.owner === team) { next.connected = true; queue.push(next); }
          }
        }
      }
      const total = this.tiles.reduce((n, t) => n + !t.blocked, 0);
      for (const building of this.buildings) {
        const tile = this.tile(building.x, building.y);
        building.connected = building.hp > 0 && !!tile && tile.owner === building.team && tile.connected;
      }
      for (let team = 1; team <= 2; team++) {
        this.scores[team] = counts[team] / total;
        const sources = Math.min(CONFIG.sourceLimit, this.buildings.filter(b => b.team === team && b.type === 'extractor' && b.hp > 0 && b.connected).length);
        const core = this.getCore(team);
        const base = core ? CONFIG.baseIncome + .2 * (core.level - 1) : 0;
        this.income[team] = (base + Math.min(CONFIG.territoryIncomeCap, this.scores[team] * 2.4) + sources * CONFIG.sourceIncome) * (this.accelerated ? CONFIG.finalMinuteMultiplier : 1);
      }
      this.updateVisibility();
      this._refreshProductionStates();
    }

    updateVisibility() {
      const reveal = (team, x, y, radius) => {
        const minX = Math.max(0, Math.floor(x - radius)), maxX = Math.min(this.width - 1, Math.ceil(x + radius));
        const minY = Math.max(0, Math.floor(y - radius)), maxY = Math.min(this.height - 1, Math.ceil(y + radius));
        for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
          if ((tx - x) ** 2 + (ty - y) ** 2 <= radius * radius + .001) this.visibility[team][ty * this.width + tx] = true;
        }
      };
      this.visibility[1].fill(false); this.visibility[2].fill(false);
      for (const tile of this.tiles) if (validTeam(tile.owner)) reveal(tile.owner, tile.x, tile.y, tile.connected ? 2 : 0);
      for (const b of this.buildings) if (b.hp > 0) reveal(b.team, b.x, b.y, b.connected ? BUILDING_STATS[b.type].sight + (b.type === 'core' ? (b.level - 1) * .5 : 0) : 2.5);
      for (const u of this.units) if (u.hp > 0) reveal(u.team, u.x - .5, u.y - .5, UNIT_STATS.sight);
      for (let team = 1; team <= 2; team++) for (let i = 0; i < this.tiles.length; i++) if (this.visibility[team][i]) {
        this.explored[team][i] = true;
        this.tiles[i].lastSeenOwner[team] = this.tiles[i].owner;
      }
    }

    perception(team) {
      if (!validTeam(team)) throw new RangeError('Camp inconnu.');
      const visible = o => o.team === team || this.isVisible(team, o.x, o.y);
      const buildings = this.buildings.filter(b => b.hp > 0 && visible(b)).map(b => b.team === team ? Object.assign({}, b, { flow: copyPoint(b.flow), mortarTarget: copyPoint(b.mortarTarget) }) : {
        id: b.id, team: b.team, type: b.type, x: b.x, y: b.y, hp: b.hp, maxHp: b.maxHp, level: b.level, connected: null
      });
      const units = this.units.filter(u => u.hp > 0 && visible(u)).map(u => u.team === team ? {
        id: u.id, team: u.team, type: u.type, producerId: u.producerId, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, target: copyPoint(u.target), retreating: u.retreating
      } : { id: u.id, team: u.team, type: u.type, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp });
      const shells = this.shells.filter(shell => shell.team === team || this.isVisible(team, shell.x, shell.y)).map(shell => {
        const seen = { id: shell.id, team: shell.team, x: shell.x, y: shell.y, remaining: shell.remaining, total: shell.total, radius: shell.radius };
        const source = this.buildings.find(b => b.id === shell.sourceId && b.hp > 0);
        if (shell.team === team || (source && this.isVisible(team, source.x, source.y))) Object.assign(seen, { sourceId: shell.sourceId, fromX: shell.fromX, fromY: shell.fromY });
        return seen;
      });
      return {
        team, width: this.width, height: this.height, mapId: this.mapId, time: this.time, duration: this.duration,
        overtime: this.overtime, overtimeDuration: this.overtimeDuration, timeLimit: this.timeLimit, remaining: Math.max(0, this.timeLimit - this.time),
        accelerated: this.accelerated, winner: this.winner, pigment: this.pigment[team], income: this.income[team], outflow: this.productionOutflow(team),
        hand: this.hands[team].slice(), deck: this.decks[team].slice(), scores: this.scores.slice(), hold: this.hold.slice(),
        coreStarts: CONFIG.coreStarts.map(copyPoint), buildings, units, shells, brushLimit: this.getBrushLimit(team),
        mixtures: this.mixtures, mixtureLast: this._mixtureLast[team] ? Object.assign({}, this._mixtureLast[team]) : null,
        tiles: this.tiles.map((tile, index) => ({
          x: tile.x, y: tile.y, blocked: tile.blocked, source: tile.source,
          visible: this.visibility[team][index], explored: this.explored[team][index],
          owner: this.visibility[team][index] ? tile.owner : null,
          connected: tile.owner === team ? tile.connected : (this.visibility[team][index] && !tile.owner ? false : null)
        }))
      };
    }

    previewPaint(team, suppliedPath) {
      const result = { ok: false, message: '', reason: '', cost: 0, cells: [], path: [], rejectedPath: [], partial: false };
      const fail = message => Object.assign(result, { message, reason: message });
      if (!validTeam(team) || this.winner !== null) return fail('Le combat est terminé.');
      if (!Array.isArray(suppliedPath) || !suppliedPath.length || suppliedPath.length > this.tiles.length * 2) return fail('Commencez sur votre territoire relié.');
      // Structural errors never become partially paid actions. Validate the whole
      // supplied path before looking at terrain; a hidden tile cannot leak its owner.
      const path = [], seen = new Set();
      for (const p of suppliedPath) {
        if (!p || !point(p.x, p.y)) return fail('Tracé invalide.');
        const last = path[path.length - 1];
        if (last && p.x === last.x && p.y === last.y) continue;
        if (last && Math.abs(p.x - last.x) + Math.abs(p.y - last.y) !== 1) return fail('Tracez des cases voisines, sans saut.');
        path.push({ x: p.x, y: p.y });
      }
      for (let i = 0; i < path.length; i++) {
        const p = path[i], tile = this.tile(p.x, p.y);
        let reason = '';
        // Stop at the first refusal, so later points cannot skip an obstacle or
        // reveal information beyond the current visible frontier.
        if (!tile) reason = 'Restez sur la toile.';
        else if (!this.isVisible(team, p.x, p.y)) reason = 'Zone hors de vue.';
        else if (tile.blocked) reason = 'Un obstacle coupe le tracé.';
        else if (!i && (tile.owner !== team || !tile.connected)) reason = 'Commencez sur votre territoire relié.';
        else if (tile.owner && tile.owner !== team) reason = 'Les unités et les pouvoirs attaquent la couleur ennemie.';
        const key = p.y * this.width + p.x;
        const newCell = tile && !tile.owner && !seen.has(key);
        if (!reason && newCell && result.cells.length >= this.getBrushLimit(team)) reason = 'Maximum ' + this.getBrushLimit(team) + ' nouvelles cases par tracé.';
        if (!reason && newCell && !this.canSpend(team, (result.cells.length + 1) * CONFIG.brushCost)) reason = 'Pigment insuffisant pour prolonger ce tracé.';
        if (reason) { result.reason = reason; result.rejectedPath = path.slice(i); break; }
        result.path.push(copyPoint(p));
        if (newCell) { seen.add(key); result.cells.push(copyPoint(p)); }
      }
      result.cost = result.cells.length * CONFIG.brushCost;
      if (!result.cells.length) return fail(result.reason || 'Prolongez le trait sur des cases blanches.');
      result.ok = true;
      result.partial = result.rejectedPath.length > 0;
      result.message = result.cells.length + ' case' + (result.cells.length > 1 ? 's' : '') + ' · ' + result.cost + ' pigment' + (result.cost > 1 ? 's' : '') + (result.partial ? ' · ' + result.reason : '');
      return result;
    }
    paint(team, path) {
      const result = this.previewPaint(team, path);
      if (!result.ok) return result;
      this.pigment[team] = Math.max(0, this.pigment[team] - result.cost);
      for (const p of result.cells) this.tile(p.x, p.y).owner = team;
      this.recompute();
      this._event('paint', team, { x: result.path[result.path.length - 1].x, y: result.path[result.path.length - 1].y, cells: result.cells.map(copyPoint), cost: result.cost });
      return result;
    }

    previewCard(team, handIndex, x, y) {
      const cardId = validTeam(team) && Number.isInteger(handIndex) ? this.hands[team][handIndex] : null;
      const card = this.getCard(team, cardId);
      const result = { ok: false, message: '', cost: card ? card.cost : 0, cardId: cardId || null, x, y, radius: card ? card.radius : 0 };
      const fail = message => Object.assign(result, { message });
      if (this.winner !== null) return fail('Le combat est terminé.');
      if (!card) return fail('Choisissez une carte de votre main.');
      const tile = this.tile(x, y);
      if (!tile) return fail('Restez sur la toile.');
      if (!this.isVisible(team, x, y)) return fail('Zone hors de vue.');
      if (tile.blocked) return fail('Cet obstacle est impraticable.');
      if (card.kind === 'building') {
        if (tile.owner !== team || !tile.connected) return fail('Posez sur votre territoire relié au Cœur.');
        if (this.buildings.some(b => b.hp > 0 && b.x === x && b.y === y)) return fail('Un bâtiment occupe déjà cette case.');
        if (card.type === 'extractor' && !tile.source) return fail('L’extracteur se pose sur une source.');
        if (card.type !== 'extractor' && tile.source) return fail('Gardez cette source pour un extracteur.');
      } else {
        const inRange = this.tiles.some(t => t.owner === team && t.connected && Math.hypot(t.x - x, t.y - y) <= card.range);
        if (!inRange) return fail('Cible trop loin de votre territoire relié.');
      }
      if (!this.canSpend(team, card.cost)) return fail('Pigment insuffisant.');
      let message = card.name + ' · ' + card.cost + ' pigments';
      if (card.type === 'extractor') {
        const activeSources = this.buildings.filter(b => b.team === team && b.type === 'extractor' && b.hp > 0 && b.connected).length;
        result.incomeGain = activeSources < CONFIG.sourceLimit ? CONFIG.sourceIncome * (this.accelerated ? CONFIG.finalMinuteMultiplier : 1) : 0;
        if (result.incomeGain === 0) message += ' · Bonus des 3 sources déjà atteint';
      }
      return Object.assign(result, { ok: true, message });
    }
    playCard(team, handIndex, x, y) {
      const result = this.previewCard(team, handIndex, x, y);
      if (!result.ok) return result;
      const card = this.getCard(team, result.cardId);
      this.pigment[team] = Math.max(0, this.pigment[team] - card.cost);
      if (card.kind === 'building') {
        const building = this._addBuilding(team, card.type, x, y);
        const cells = this._claimNeutralDisk(team, x, y, card.radius);
        result.buildingId = building.id;
        this._event('build', team, { x, y, buildingId: building.id, buildingType: card.type, radius: card.radius, cells });
      } else this._applyPower(team, card, x, y);
      Object.assign(result, this._applyMixture(team, card, x, y));
      this.hands[team][handIndex] = this.decks[team].shift();
      this.decks[team].push(card.id);
      this._removeDead();
      this.recompute();
      this._checkVictory(0);
      return result;
    }
    _applyPower(team, card, x, y) {
      const impact = { x: x + .5, y: y + .5 };
      if (card.id === 'bleach') {
        for (const tile of this.tiles) if (tile.owner === 3 - team && this.isVisible(team, tile.x, tile.y) && Math.hypot(tile.x - x, tile.y - y) <= card.radius) {
          if (!this.buildings.some(b => b.hp > 0 && b.x === tile.x && b.y === tile.y)) tile.owner = 0;
        }
      } else {
        for (const unit of this.units) if (unit.hp > 0 && unit.team !== team && this.isVisible(team, unit.x, unit.y) && sqrDistance(unit, impact) <= card.radius ** 2) {
          this._damage(unit, card.id === 'wave' ? 9 : 18);
          if (card.id === 'wave') {
            let dx = unit.x - impact.x, dy = unit.y - impact.y;
            const length = Math.hypot(dx, dy);
            if (length < .001) { dx = 0; dy = team === 1 ? -1 : 1; } else { dx /= length; dy /= length; }
            for (let step = 0; step < 6; step++) {
              const nx = unit.x + dx * .22, ny = unit.y + dy * .22, tile = this.tile(Math.floor(nx), Math.floor(ny));
              if (!tile || tile.blocked) break;
              unit.x = nx; unit.y = ny;
            }
            unit.path = []; unit.pathTarget = null;
          }
        }
        if (card.id === 'splash') for (const b of this.buildings) if (b.hp > 0 && b.team !== team && this.isVisible(team, b.x, b.y) && sqrDistance(centre(b), impact) <= card.radius ** 2) this._damage(b, 12);
      }
      this._event('power', team, { cardId: card.id, x, y, radius: card.radius });
    }

    _applyMixture(team, card, x, y) {
      if (!this.mixtures) return {};
      if (card.color !== 'blue' && card.color !== 'yellow') return {};
      const previous = this._mixtureLast[team];
      if (previous && previous.color !== card.color && this.time - previous.time <= MIXTURE.window + 1e-8 && Math.hypot(x - previous.x, y - previous.y) <= MIXTURE.distance) {
        this._mixtureLast[team] = null;
        const impact = { x: x + .5, y: y + .5 };
        let healed = 0;
        for (const unit of this.units) if (unit.team === team && unit.hp > 0 && sqrDistance(unit, impact) <= MIXTURE.radius ** 2) {
          const amount = Math.min(MIXTURE.heal, unit.maxHp - unit.hp);
          if (amount > 0) { unit.hp += amount; healed += amount; }
        }
        this._event('mixture', team, { x, y, radius: MIXTURE.radius, mixture: 'green', healed });
        return { mixture: 'green', healed };
      }
      this._mixtureLast[team] = { color: card.color, x, y, time: this.time };
      return {};
    }

    previewMortarTarget(team, buildingId, x, y) {
      const stats = BUILDING_STATS.mortar;
      const result = { ok: false, message: '', x, y, radius: stats.blastRadius, minRange: stats.minRange, range: stats.range };
      const fail = message => Object.assign(result, { message });
      if (this.winner !== null) return fail('Le combat est terminé.');
      const mortar = this.buildings.find(b => b.id === buildingId && b.team === team && b.type === 'mortar' && b.hp > 0);
      if (!validTeam(team) || !mortar) return fail('Choisissez votre mortier.');
      if (x === null && y === null) return Object.assign(result, { ok: true, message: 'Bombardement arrêté.' });
      if (!mortar.connected) return fail('Le mortier doit être relié au Cœur.');
      if (!this.tile(x, y)) return fail('Restez sur la toile.');
      if (!this.isVisible(team, x, y)) return fail('Zone hors de vue.');
      const distance = Math.hypot(x - mortar.x, y - mortar.y);
      if (distance < stats.minRange) return fail('Cible trop proche : au moins 2,5 cases.');
      if (distance > stats.range) return fail('Cible trop loin : portée de 7 cases.');
      return Object.assign(result, { ok: true, message: 'Bombardement toutes les 5 s · impact après 1,2 s.' });
    }
    setMortarTarget(team, buildingId, x, y) {
      const result = this.previewMortarTarget(team, buildingId, x, y);
      if (!result.ok) return result;
      const mortar = this.buildings.find(b => b.id === buildingId && b.team === team && b.type === 'mortar');
      mortar.mortarTarget = x === null ? null : { x, y };
      this._event('mortar-target', team, { x: mortar.x, y: mortar.y, buildingId, target: copyPoint(mortar.mortarTarget) });
      return result;
    }

    setFlow(team, producerId, x, y) {
      if (this.winner !== null) return { ok: false, message: 'Le combat est terminé.' };
      const producer = this.getProducers(team).find(b => b.id === producerId);
      if (!producer) return { ok: false, message: 'Choisissez votre Cœur ou une caserne.' };
      const tile = this.tile(x, y);
      if (!tile || tile.blocked) return { ok: false, message: 'Choisissez une case praticable.' };
      const knownStart = CONFIG.coreStarts.some(p => p && p.x === x && p.y === y);
      if (!this.explored[team][y * this.width + x] && !knownStart) return { ok: false, message: 'Explorez cette zone avant de diriger le flux.' };
      if (!this._findPath(producer.x, producer.y, x, y).length && (producer.x !== x || producer.y !== y)) return { ok: false, message: 'Aucun passage vers cette case.' };
      producer.flow = { x, y };
      producer.flowMode = 'attack';
      for (const unit of this.units) if (unit.team === team && unit.producerId === producer.id && unit.hp > 0) { unit.target = { x, y }; unit.retreating = false; unit.path = []; unit.pathTarget = null; }
      this._event('flow', team, { x, y, producerId });
      return { ok: true, message: 'Le groupe rejoint cette destination.', x, y, producerId };
    }
    toggleProduction(team, producerId) {
      const producer = this.getProducers(team).find(b => b.id === producerId && b.type === 'barracks');
      if (!producer || this.winner !== null) return { ok: false, message: 'Choisissez une caserne.' };
      producer.productionPaused = !producer.productionPaused;
      this._refreshProductionStates();
      this._event('pause', team, { x: producer.x, y: producer.y, producerId, paused: producer.productionPaused });
      return { ok: true, message: producer.productionPaused ? 'Production en pause. Le groupe garde son ordre.' : 'Production reprise.', paused: producer.productionPaused };
    }
    recall(team, producerId) {
      const producer = this.getProducers(team).find(b => b.id === producerId);
      if (!producer) return { ok: false, message: 'Ce producteur n’existe plus.' };
      const result = this.setFlow(team, producerId, producer.x, producer.y);
      if (result.ok) {
        producer.flowMode = 'defend';
        for (const unit of this.units) if (unit.team === team && unit.producerId === producerId && unit.hp > 0) unit.retreating = sqrDistance(unit, centre(producer)) > .6 ** 2;
        result.message = 'Le groupe rentre sans riposter, puis défend ce bâtiment.';
        this._event('recall', team, { x: producer.x, y: producer.y, producerId });
      }
      return result;
    }
    upgradeCore(team) {
      const core = this.getCore(team);
      if (!core || this.winner !== null) return { ok: false, message: 'Ce Cœur n’est plus disponible.' };
      if (core.level >= 3) return { ok: false, message: 'Le Cœur est au niveau maximal.' };
      const cost = CONFIG.coreUpgradeCosts[core.level - 1];
      if (!this.canSpend(team, cost)) return { ok: false, message: 'Pigment insuffisant.', cost };
      this.pigment[team] -= cost;
      const extraHealth = 80 * (1 + this.modifiers[team].buildingHealth);
      core.level++; core.maxHp += extraHealth; core.hp += extraHealth;
      this.recompute();
      this._event('upgrade', team, { x: core.x, y: core.y, level: core.level });
      return { ok: true, message: 'Cœur niveau ' + core.level + '.', cost, level: core.level };
    }

    _productionStatus(b) {
      if (b.productionPaused) return ['paused', 'Production en pause'];
      if (!b.connected) return ['isolated', 'Réseau coupé'];
      if (this.spendingHeld[b.team]) return ['held', 'Budget protégé pendant le geste'];
      if (this.getUnitCount(b.team) >= CONFIG.unitLimit) return ['full', 'Limite de ' + CONFIG.unitLimit + ' gouttes'];
      if (!this.canSpend(b.team, CONFIG.unitCost)) return ['funds', 'En attente de 6 pigments'];
      return ['running', '6 pigments à la sortie'];
    }
    _refreshProductionStates() {
      for (const b of this.buildings) if (b.type === 'barracks') [b.productionState, b.productionReason] = this._productionStatus(b);
    }
    productionOutflow(team) {
      if (!validTeam(team) || this.winner !== null) return 0;
      // A nominal rate for the HUD, never a continuous debit or a promise that
      // the next spawn is affordable. Actual costs are carried by spawn events.
      return this.buildings.filter(b => b.team === team && b.type === 'barracks' && b.hp > 0 && this._productionStatus(b)[0] === 'running' && this._spawnPosition(b)).length * CONFIG.unitCost / CONFIG.unitInterval;
    }
    _produce(dt) {
      for (let team = 1; team <= 2; team++) {
        const producers = this.buildings.filter(b => b.team === team && b.type === 'barracks' && b.hp > 0);
        if (!producers.length) continue;
        // Rotate only successful payments so a crowded budget does not starve one producer forever.
        const start = this._productionCursor[team] % producers.length;
        for (let offset = 0; offset < producers.length; offset++) {
          const index = (start + offset) % producers.length, producer = producers[index];
          [producer.productionState, producer.productionReason] = this._productionStatus(producer);
          if (producer.productionState !== 'running') continue;
          producer.productionProgress = Math.min(CONFIG.unitInterval, producer.productionProgress + dt);
          if (producer.productionProgress + 1e-8 < CONFIG.unitInterval) continue;
          const spawn = this._spawnPosition(producer);
          if (!spawn) { producer.productionState = 'blocked'; producer.productionReason = 'Sortie bloquée'; continue; }
          if (!this.canSpend(team, CONFIG.unitCost) || this.getUnitCount(team) >= CONFIG.unitLimit) continue;
          this.pigment[team] = Math.max(0, this.pigment[team] - CONFIG.unitCost);
          producer.productionProgress = 0;
          this._addUnit(team, producer, spawn, CONFIG.unitCost);
          this._productionCursor[team] = (index + 1) % producers.length;
        }
      }
    }
    _spawnPosition(producer) {
      const direction = producer.team === 1 ? -1 : 1;
      const side = producer.team === 1 ? 1 : -1;
      const positions = [[0, direction], [side, 0], [-side, 0], [0, -direction], [0, 0]];
      for (const [dx, dy] of positions) {
        const tile = this.tile(producer.x + dx, producer.y + dy);
        if (tile && !tile.blocked && !this.buildings.some(b => b.hp > 0 && b.x === tile.x && b.y === tile.y && b.id !== producer.id)) return { x: tile.x + .5, y: tile.y + .5 };
      }
      return null;
    }

    _findPath(sx, sy, tx, ty, team = 1) {
      const dirs = team === 2 ? [[0, 1], [-1, 0], [0, -1], [1, 0]] : DIRS;
      const start = this.tile(sx, sy), target = this.tile(tx, ty);
      if (!start || !target || target.blocked) return [];
      if (sx === tx && sy === ty) return [{ x: tx + .5, y: ty + .5 }];
      const from = new Int32Array(this.tiles.length); from.fill(-1);
      const startIndex = sy * this.width + sx, targetIndex = ty * this.width + tx;
      const queue = [startIndex]; from[startIndex] = startIndex;
      for (let qi = 0; qi < queue.length && from[targetIndex] < 0; qi++) {
        const current = this.tiles[queue[qi]];
        for (const [dx, dy] of dirs) {
          const next = this.tile(current.x + dx, current.y + dy);
          if (!next || next.blocked) continue;
          const index = next.y * this.width + next.x;
          if (from[index] !== -1) continue;
          from[index] = queue[qi]; queue.push(index);
        }
      }
      if (from[targetIndex] < 0) return [];
      const path = [];
      let at = targetIndex;
      while (at !== startIndex) { path.push({ x: this.tiles[at].x + .5, y: this.tiles[at].y + .5 }); at = from[at]; }
      return path.reverse();
    }
    _move(unit, target, dt) {
      const tx = Math.floor(target.x), ty = Math.floor(target.y);
      if (!unit.pathTarget || unit.pathTarget.x !== tx || unit.pathTarget.y !== ty || !unit.path.length) {
        unit.path = this._findPath(Math.floor(unit.x), Math.floor(unit.y), tx, ty, unit.team);
        unit.pathTarget = { x: tx, y: ty };
      }
      const ground = this.tile(Math.floor(unit.x), Math.floor(unit.y));
      const speedBonus = ground && ground.owner === unit.team && ground.connected ? this.modifiers[unit.team].reinforcementSpeed : 0;
      let remaining = UNIT_STATS.speed * (1 + speedBonus) * dt;
      while (remaining > 0 && unit.path.length) {
        const next = unit.path[0], dx = next.x - unit.x, dy = next.y - unit.y, distance = Math.hypot(dx, dy);
        if (distance <= remaining + .001) { unit.x = next.x; unit.y = next.y; remaining -= distance; unit.path.shift(); }
        else { unit.x += dx / distance * remaining; unit.y += dy / distance * remaining; remaining = 0; }
      }
    }
    _unitTarget(unit) {
      if (unit.retreating) return null;
      const producer = this.buildings.find(b => b.id === unit.producerId && b.team === unit.team && b.hp > 0);
      const anchor = producer && producer.flowMode === 'defend' ? centre(producer) : null;
      const inDefenseArea = enemy => !anchor || sqrDistance(anchor, centre(enemy)) <= UNIT_STATS.aggro ** 2;
      let best = null, bestDistance = UNIT_STATS.aggro ** 2;
      for (const enemy of this.units) if (enemy.team !== unit.team && enemy.hp > 0 && this.isVisible(unit.team, enemy.x, enemy.y) && inDefenseArea(enemy)) {
        const d = sqrDistance(unit, enemy);
        if (d < bestDistance) { best = enemy; bestDistance = d; }
      }
      if (best) return best;
      for (const enemy of this.buildings) if (enemy.team !== unit.team && enemy.hp > 0 && this.isVisible(unit.team, enemy.x, enemy.y) && inDefenseArea(enemy)) {
        const d = sqrDistance(unit, centre(enemy));
        if (d < bestDistance) { best = enemy; bestDistance = d; }
      }
      return best;
    }
    _paintUnderUnits() {
      const occupancy = new Map();
      for (const unit of this.units) if (unit.hp > 0) {
        const tile = this.tile(Math.floor(unit.x), Math.floor(unit.y));
        if (!tile || tile.blocked) continue;
        const index = tile.y * this.width + tile.x;
        occupancy.set(index, (occupancy.get(index) || 0) | unit.team);
      }
      for (const [index, team] of occupancy) {
        // Both camps on the same tile contest it; iteration order must not decide ownership.
        if (team === 3) continue;
        const tile = this.tiles[index];
        if (tile.owner === team || this.buildings.some(b => b.hp > 0 && b.team !== team && b.x === tile.x && b.y === tile.y)) continue;
        tile.owner = team;
      }
    }
    _advanceMortars(dt, hits) {
      const stats = BUILDING_STATS.mortar, flying = [];
      // A launched shell is a committed physical action. Losing sight or losing
      // the launcher does not cancel it; unseen impacts disclose no victim data.
      for (const shell of this.shells) {
        shell.remaining = Math.max(0, shell.remaining - dt);
        if (shell.remaining > 1e-8) { flying.push(shell); continue; }
        for (const unit of this.units) if (unit.hp > 0 && unit.team !== shell.team && sqrDistance(unit, shell) <= shell.radius ** 2) hits.push([unit, stats.unitDamage]);
        for (const building of this.buildings) if (building.hp > 0 && building.team !== shell.team && sqrDistance(centre(building), shell) <= shell.radius ** 2) hits.push([building, stats.buildingDamage]);
        this._event('mortar-impact', shell.team, { x: shell.x - .5, y: shell.y - .5, radius: shell.radius, sourceId: shell.sourceId, shellId: shell.id });
      }
      this.shells = flying;
      for (const mortar of this.buildings) if (mortar.type === 'mortar' && mortar.hp > 0 && mortar.connected) {
        mortar.attackCooldown = Math.max(0, mortar.attackCooldown - dt);
        const target = mortar.mortarTarget;
        if (!target || mortar.attackCooldown > 1e-8 || !this.previewMortarTarget(mortar.team, mortar.id, target.x, target.y).ok) continue;
        const shell = { id: this._id++, team: mortar.team, sourceId: mortar.id, fromX: mortar.x + .5, fromY: mortar.y + .5,
          x: target.x + .5, y: target.y + .5, remaining: stats.flightTime, total: stats.flightTime, radius: stats.blastRadius };
        this.shells.push(shell);
        mortar.attackCooldown = stats.interval;
        this._event('mortar-shot', mortar.team, { x: target.x, y: target.y, radius: stats.blastRadius, sourceId: mortar.id, shellId: shell.id });
      }
    }
    _combat(dt) {
      const hits = [], motions = [];
      // Decide from the same beginning-of-step positions and vision for both camps.
      for (const unit of this.units) if (unit.hp > 0) {
        unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
        if (unit.retreating && unit.target && sqrDistance(unit, { x: unit.target.x + .5, y: unit.target.y + .5 }) <= .6 ** 2) unit.retreating = false;
        const enemy = this._unitTarget(unit);
        if (enemy) {
          const enemyCentre = centre(enemy);
          if (sqrDistance(unit, enemyCentre) <= UNIT_STATS.range ** 2) {
            if (unit.attackCooldown <= 1e-8) { hits.push([enemy, UNIT_STATS.damage]); unit.attackCooldown = UNIT_STATS.interval; }
          } else motions.push([unit, copyPoint(enemyCentre)]);
        } else if (unit.target) motions.push([unit, { x: unit.target.x + .5, y: unit.target.y + .5 }]);
      }
      for (const building of this.buildings) if (building.hp > 0) {
        const stats = BUILDING_STATS[building.type];
        if (!stats.damage || !building.connected) continue;
        building.attackCooldown = Math.max(0, building.attackCooldown - dt);
        if (building.attackCooldown > 1e-8) continue;
        let target = null, bestDistance = (stats.range + (building.type === 'core' ? (building.level - 1) * .25 : 0)) ** 2;
        const origin = centre(building);
        for (const unit of this.units) if (unit.hp > 0 && unit.team !== building.team && this.isVisible(building.team, unit.x, unit.y)) {
          const d = sqrDistance(origin, unit);
          if (d < bestDistance) { target = unit; bestDistance = d; }
        }
        if (target) { hits.push([target, stats.damage + (building.type === 'core' ? 2 * (building.level - 1) : 0)]); building.attackCooldown = stats.interval; }
      }
      this._advanceMortars(dt, hits);
      for (const [unit, destination] of motions) this._move(unit, destination, dt);
      this._separateUnits(dt);
      this._paintUnderUnits();
      for (const [target, amount] of hits) this._damage(target, amount);
      this._removeDead();
    }
    _separateUnits(dt) {
      // A stream remains a readable group rather than several coincident sprites.
      const displace = (unit, dx, dy) => {
        const tile = this.tile(Math.floor(unit.x + dx), Math.floor(unit.y + dy));
        if (tile && !tile.blocked) { unit.x += dx; unit.y += dy; }
      };
      for (let i = 0; i < this.units.length; i++) for (let j = i + 1; j < this.units.length; j++) {
        const a = this.units[i], b = this.units[j];
        if (a.hp <= 0 || b.hp <= 0 || a.team !== b.team) continue;
        let dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
        if (distance >= .38) continue;
        if (distance < .001) {
          const angle = (((a.ordinal * 19 + b.ordinal * 13) % 360) + (a.team === 2 ? 180 : 0)) * Math.PI / 180;
          dx = Math.cos(angle); dy = Math.sin(angle); distance = 0;
        } else { dx /= distance; dy /= distance; }
        const amount = Math.min((.38 - distance) / 2, dt * .65);
        displace(a, -dx * amount, -dy * amount); displace(b, dx * amount, dy * amount);
      }
    }
    _damage(object, amount) {
      object.hp -= amount;
      this._event('damage', object.team, { x: object.x, y: object.y, amount, targetId: object.id, objectType: object.type });
    }
    _removeDead() {
      const dead = this.buildings.filter(b => b.hp <= 0);
      for (const building of dead) this._event('destroy', building.team, { x: building.x, y: building.y, buildingType: building.type, buildingId: building.id });
      this.buildings = this.buildings.filter(b => b.hp > 0);
      this.units = this.units.filter(u => u.hp > 0);
      for (const unit of this.units) if (!this.buildings.some(b => b.id === unit.producerId && b.team === unit.team && b.hp > 0)) {
        const core = this.getCore(unit.team);
        if (core) {
          unit.producerId = core.id;
          unit.target = unit.retreating ? { x: core.x, y: core.y } : copyPoint(core.flow) || { x: core.x, y: core.y };
          unit.path = []; unit.pathTarget = null;
        }
      }
    }

    _finish(winner, reason) {
      if (this.winner !== null) return;
      this.winner = winner; this.winReason = reason;
      this._accumulator = 0;
      this.spendingHeld[1] = false; this.spendingHeld[2] = false;
      this._event('victory', winner, { winner, message: reason });
    }
    _checkVictory(dt) {
      if (this.winner !== null) return;
      const core1 = this.getCore(1), core2 = this.getCore(2);
      if (!core1 || !core2) { this._finish(!core1 && !core2 ? 0 : core1 ? 1 : 2, !core1 && !core2 ? 'Les deux Cœurs ont été effacés.' : core1 ? 'Le Cœur adverse a été effacé.' : 'Votre Cœur a été effacé.'); return; }
      for (let team = 1; team <= 2; team++) {
        const dominates = this.scores[team] > CONFIG.domination && this.scores[team] > this.scores[3 - team];
        this.hold[team] = dominates ? this.hold[team] + dt : 0;
        if (dominates && !this._holdActive[team]) this._event('domination', team, { message: 'Plus de 50 % de la toile : tenez 15 secondes.' });
        this._holdActive[team] = dominates;
        if (this.hold[team] + 1e-8 >= CONFIG.holdDuration) { this.hold[team] = CONFIG.holdDuration; this._finish(team, 'Plus de 50 % de territoire relié tenus pendant 15 secondes.'); return; }
      }
      if (this.time + 1e-8 >= this.timeLimit) {
        this.time = this.timeLimit;
        const diff = this.scores[1] - this.scores[2];
        if (!this.overtime && diff === 0) {
          this.overtime = true;
          this._event('overtime', 0, { duration: this.overtimeDuration, timeLimit: this.timeLimit, message: 'Égalité : 30 secondes de prolongation. Chaque case reliée compte.' });
        } else this._finish(diff === 0 ? 0 : diff > 0 ? 1 : 2, diff === 0 ? 'Égalité de territoire après la prolongation.' : this.overtime ? 'Le plus grand territoire relié après la prolongation.' : 'Le plus grand territoire relié à la fin du temps.');
      }
    }
    _step(dt) {
      this.time = Math.min(this.timeLimit, this.time + dt);
      if (!this.accelerated && this.time + 1e-8 >= Math.max(0, this.duration - 60)) {
        this.accelerated = true;
        this._event('acceleration', 0, { message: 'Dernière minute : pigment ×1,5 pour les deux camps.' });
      }
      this.recompute();
      for (let team = 1; team <= 2; team++) this.pigment[team] = Math.min(CONFIG.pigmentCap, this.pigment[team] + this.income[team] * dt);
      this._produce(dt);
      this._combat(dt);
      this.recompute();
      this._checkVictory(dt);
    }
    update(dt) {
      if (this.winner !== null || !Number.isFinite(dt) || dt <= 0) return;
      this._accumulator += dt;
      while (this._accumulator + 1e-9 >= CONFIG.step && this.winner === null) {
        this._accumulator -= CONFIG.step;
        this._step(Math.min(CONFIG.step, this.timeLimit - this.time));
      }
      if (this.winner !== null) this._accumulator = 0;
    }
  }

  return { Game, CARDS, CONFIG, BUILDING_STATS, UNIT_STATS, DEFAULT_DECK, MAPS, MIXTURE, normalizeModifiers };
});
