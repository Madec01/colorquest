/* Colorquest simulation: browser-independent, deterministic vanilla JavaScript.
 * Positions use tile coordinates; units use continuous tile-center coordinates.
 * teams: 1=player, 2=AI. winner: null|0(draw)|1|2.
 * Recruitment reserves a unit ID and debits pigment when added to the queue.
 * Cancelling the active job refunds 50%; waiting jobs refund 100%.
 */
(function (root) {
  'use strict';

  const Maps = typeof module !== 'undefined' && module.exports ? require('./maps.js') : root.CQMaps;
  const Missions = typeof module !== 'undefined' && module.exports ? require('./missions.js') : root.CQMissions;
  const WIDTH = 32, HEIGHT = 48, UNIT_LIMIT = 36, QUEUE_LIMIT = 6;
  const COSTS = { relay: 45, extractor: 65, bastion: 90, barracks: 100, scout: 22, fighter: 35, breaker: 65, engineer: 55, saboteur: 60 };
  const RECRUIT_TIMES = { scout: 4, fighter: 6, breaker: 9, engineer: 8, saboteur: 7 };
  const UPGRADE_COSTS = { core: [140, 260], relay: [55, 85], extractor: [80, 130], bastion: [100, 155] };
  const SPECIALIZATIONS = {
    expansion: { name: 'Expansion', cost: 100, description: 'Relais −25 % de pigment ; portée des Cœurs et relais +1 case.' },
    fortification: { name: 'Fortification', cost: 100, description: 'Bâtiments +30 % de vie ; territoire isolé : 25 s au lieu de 15 s.' },
    mobility: { name: 'Mobilité', cost: 100, description: 'Unités +20 % de vitesse ; formation −15 % de temps.' }
  };
  const UNIT_STATS = {
    scout: { hp: 34, speed: 4.1, damage: 3, range: 1.25, cooldown: .9, vision: 7, requiredLevel: 1 },
    fighter: { hp: 85, speed: 2.45, damage: 11, range: 1.55, cooldown: .8, vision: 5, requiredLevel: 1 },
    breaker: { hp: 62, speed: 1.75, damage: 20, range: 5.2, cooldown: 1.65, vision: 6, requiredLevel: 1 },
    engineer: { hp: 52, speed: 2.65, damage: 0, range: 0, cooldown: 1, vision: 5, repair: 12, repairRange: 3, requiredLevel: 2 },
    saboteur: { hp: 46, speed: 3.35, damage: 7, range: 1.4, cooldown: 1, vision: 6, requiredLevel: 2 }
  };
  const BUILDING_STATS = {
    core: { hp: 950, radius: 7, income: 2.6, damage: 14, range: 5 },
    relay: { hp: 170, radius: 6 },
    extractor: { hp: 145, radius: 2, income: 3.1 },
    bastion: { hp: 250, radius: 2, damage: 14, range: 6.5 },
    barracks: { hp: 220, radius: 3 }
  };
  const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const validTeam = team => team === 1 || team === 2;

  class Game {
    constructor(options = {}) {
      this.width = WIDTH;
      this.height = HEIGHT;
      this.difficulty = options.difficulty || 'normal';
      this.mapId = Maps.get(options.mapId)?.id || Maps.DEFAULT_MAP;
      this.mission = null;
      this.aiMemory = [];
      this.seed = (options.seed || 123456) >>> 0;
      this.time = 0;
      this.duration = 720;
      this.winner = null;
      this.winReason = '';
      this.units = [];
      this.buildings = [];
      this.events = [];
      this.money = [0, 165, 165];
      this.income = [0, 0, 0];
      this.scores = [0, 0, 0];
      this.hold = [0, 0, 0];
      this.cooldowns = [{}, { impulse: 0, bleach: 0 }, { impulse: 0, bleach: 0 }];
      this.queues = [[], [], []];
      this.rally = [null, null, null];
      this.specializations = [null, null, null];
      this.squads = [[], [[], [], []], [[], [], []]];
      this._id = 1;
      this._nextExpand = this.difficulty === 'easy' ? 35 : 18;
      this._spread = 0;
      this._ai = 0;
      this._vision = 0;
      this._capture = 0;
      this._holdEvent = [false, false, false];
      this.tiles = Array.from({ length: WIDTH * HEIGHT }, (_, i) => ({
        x: i % WIDTH, y: Math.floor(i / WIDTH), owner: 0, connected: false,
        explored: false, visible: false, aiExplored: false, aiVisible: false,
        blocked: false, source: false, terrain: 'plain', rich: false, cache: 0, isolation: 0
      }));
      if (options.missionId) {
        if (!Missions?.get(options.missionId)) throw new RangeError('Mission inconnue.');
        Missions.setup(this, options.missionId);
        return;
      }
      if (this.mapId === 'legacy') {
        // The seeded V0.4 geometry remains intact for the teaching scenario.
        for (let y = 3; y < HEIGHT - 3; y++) for (let x = 0; x < WIDTH; x++) {
          const ridge = (y === 18 || y === 29) && ((x >= 3 && x <= 10) || (x >= 21 && x <= 28));
          if (ridge && this.random() > .12) this.tile(x, y).blocked = true;
        }
        const sources = [[7, 37], [24, 37], [16, 31], [7, 24], [24, 23], [16, 16], [7, 10], [24, 10]];
        for (const [x, y] of sources) {
          this.tile(x, y).source = true;
          this.tile(x, y).blocked = false;
        }
      } else Maps.apply(this.tiles, this.mapId);
      for (let team = 1; team <= 2; team++) {
        const x = 16, y = team === 1 ? 41 : 6;
        this._building(team, 'core', x, y);
        for (const t of this.tiles) if (!t.blocked && Math.hypot(t.x - x, t.y - y) <= 6) t.owner = team;
        const mirrored = team === 2 && this.mapId !== 'legacy';
        this._unit(team, 'scout', x + .5, y + (mirrored ? 2.5 : -1.5));
        this._unit(team, 'fighter', x + (team === 1 || mirrored ? 2.5 : -1.5), y + .5);
        this._unit(team, 'fighter', x + .5, y + (mirrored ? -1.5 : 2.5));
      }
      this.recompute();
      this.updateVisibility();
      this.emit('info', 'Étendez votre réseau vers les sources de pigment.', 16, 41, 1);
    }

    random() {
      let x = this.seed;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.seed = x >>> 0;
      return this.seed / 4294967296;
    }

    tile(x, y) {
      x = Math.floor(x); y = Math.floor(y);
      return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT ? this.tiles[y * WIDTH + x] : null;
    }

    emit(type, text, x, y, team) {
      this.events.push({ type, text, message: text, x, y, team, time: this.time });
      if (this.events.length > 80) this.events.shift();
    }

    getCore(team) { return this.buildings.find(b => b.team === team && b.type === 'core' && b.hp > 0); }

    getCost(team, type) {
      const cost = COSTS[type];
      return type === 'relay' && this.specializations[team] === 'expansion' ? Math.round(cost * .75) : cost;
    }

    getRecruitTime(team, type) {
      if (!UNIT_STATS[type]) return null;
      const level = this.getCore(team)?.level || 1;
      const rate = (1 - (level - 1) * .15) * (this.specializations[team] === 'mobility' ? .85 : 1);
      return Math.round(RECRUIT_TIMES[type] * rate * 10) / 10;
    }

    getUnitStats(team, type) {
      const base = UNIT_STATS[type];
      if (!base) return null;
      return { ...base, speed: base.speed * (this.specializations[team] === 'mobility' ? 1.2 : 1) };
    }

    getBuildingStats(building) {
      if (!building || !BUILDING_STATS[building.type]) return null;
      const level = building.level || 1, tier = level - 1;
      const stats = { ...BUILDING_STATS[building.type] };
      if (building.type === 'core') {
        stats.hp += tier * 300;
        stats.radius += tier;
        stats.income = [2.6, 3.5, 4.5][tier];
        stats.damage += tier * 4;
        stats.range += tier * .5;
      } else if (building.type === 'relay') {
        stats.hp += tier * 60;
        stats.radius += tier;
      } else if (building.type === 'extractor') {
        stats.hp += tier * 45;
        // Snapshot validation invokes this method on a plain saved state.
        const tile = this.tiles[building.y * WIDTH + building.x];
        stats.income = [3.1, 4.5, 6][tier] * (tile?.source && tile.rich ? 1.6 : 1);
      } else if (building.type === 'bastion') {
        stats.hp += tier * 80;
        stats.damage += tier * 5;
        stats.range += tier * .75;
      }
      if (this.specializations[building.team] === 'fortification') stats.hp = Math.round(stats.hp * 1.3);
      if (this.specializations[building.team] === 'expansion' && ['core', 'relay'].includes(building.type)) stats.radius++;
      return stats;
    }

    _building(team, type, x, y) {
      const b = { id: this._id++, team, type, x, y, level: 1, connected: true, age: 0, attack: 0, boostUntil: 0 };
      if (type === 'barracks') { b.queue = []; b.rally = null; }
      b.hp = b.maxHp = this.getBuildingStats(b).hp;
      this.buildings.push(b);
      return b;
    }

    _unit(team, type, x, y, reservedId) {
      const s = this.getUnitStats(team, type);
      const u = {
        id: reservedId ?? this._id++, team, type, x, y, hp: s.hp, maxHp: s.hp,
        path: [], order: null, stance: 'move', attack: 0, lastHit: -20, retarget: 0,
        repairTarget: null, repairTargetId: null
      };
      this.units.push(u);
      return u;
    }

    canBuild(team, type, x, y) {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!validTeam(team) || !BUILDING_STATS[type] || type === 'core') return { ok: false, message: 'Bâtiment inconnu.' };
      if (!this.can('build', type)) return { ok: false, message: 'Ce bâtiment sera découvert dans une prochaine mission.' };
      x = Math.floor(x); y = Math.floor(y);
      const t = this.tile(x, y), cost = this.getCost(team, type);
      if (!t || t.blocked) return { ok: false, message: 'Terrain inaccessible.' };
      if (t.owner !== team || !t.connected) return { ok: false, message: 'Construisez sur votre territoire connecté.' };
      if (this.buildings.some(b => Math.hypot(b.x - x, b.y - y) < 2.1)) return { ok: false, message: 'Trop proche d’un autre bâtiment.' };
      if (type === 'extractor' && !t.source) return { ok: false, message: 'Placez l’extracteur sur une source de pigment.' };
      if (type !== 'extractor' && t.source) return { ok: false, message: 'Réservez cette source à un extracteur.' };
      if (this.money[team] < cost) return { ok: false, message: 'Pigment insuffisant.' };
      return { ok: true, message: 'Emplacement connecté : construction possible.' };
    }

    can(action, type) { return !this.mission || !!Missions?.can(this, action, type); }

    build(team, type, x, y) {
      const allowed = this.canBuild(team, type, x, y);
      if (!allowed.ok) return allowed;
      x = Math.floor(x); y = Math.floor(y);
      const cost = this.getCost(team, type);
      this.money[team] -= cost;
      const b = this._building(team, type, x, y);
      this.emit('build', 'Construction terminée', x, y, team);
      this.recompute();
      return { ok: true, message: 'Construction terminée.', id: b.id };
    }

    getUpgradeCost(id) {
      const b = this.buildings.find(b => b.id === id && b.hp > 0);
      return b ? UPGRADE_COSTS[b.type]?.[(b.level || 1) - 1] ?? null : null;
    }

    upgradeBuilding(team, id) {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!this.can('upgrade')) return { ok: false, message: 'Les améliorations seront découvertes dans une prochaine mission.' };
      const b = this.buildings.find(b => b.id === id && b.hp > 0);
      if (!validTeam(team) || !b || b.team !== team) return { ok: false, message: 'Choisissez un de vos bâtiments.' };
      if (!b.connected) return { ok: false, message: 'Reconnectez ce bâtiment avant de l’améliorer.' };
      const cost = this.getUpgradeCost(id);
      if (cost === null) return { ok: false, message: 'Niveau maximum atteint.' };
      if (this.money[team] < cost) return { ok: false, message: 'Pigment insuffisant.' };
      this.money[team] -= cost;
      b.level = (b.level || 1) + 1;
      const newMax = this.getBuildingStats(b).hp;
      // Only the newly purchased capacity is added: damage already taken remains.
      b.hp += newMax - b.maxHp;
      b.maxHp = newMax;
      this._updateIncome();
      this.emit('upgrade', `${b.type === 'core' ? 'Cœur' : 'Bâtiment'} niveau ${b.level}`, b.x, b.y, team);
      return { ok: true, message: `Niveau ${b.level} atteint.`, level: b.level };
    }

    chooseSpecialization(team, key) {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!this.can('specialize')) return { ok: false, message: 'Les spécialisations seront découvertes dans une prochaine mission.' };
      const spec = SPECIALIZATIONS[key], core = this.getCore(team);
      if (!validTeam(team) || !spec || !core) return { ok: false, message: 'Spécialisation inconnue.' };
      if ((core.level || 1) < 2) return { ok: false, message: 'Améliorez votre Cœur au niveau 2.' };
      if (this.specializations[team]) return { ok: false, message: 'Votre spécialisation est définitive pour cette partie.' };
      if (this.money[team] < spec.cost) return { ok: false, message: 'Pigment insuffisant.' };
      this.money[team] -= spec.cost;
      this.specializations[team] = key;
      for (const b of this.buildings.filter(b => b.team === team)) {
        const newMax = this.getBuildingStats(b).hp;
        b.hp += newMax - b.maxHp;
        b.maxHp = newMax;
      }
      this.emit('specialization', `Spécialisation : ${spec.name}`, core.x, core.y, team);
      return { ok: true, message: `${spec.name} activée pour cette partie.` };
    }

    getRecruitProducers(team) {
      return this.buildings.filter(b => b.team === team && b.hp > 0 && ['core', 'barracks'].includes(b.type));
    }

    getRecruitProducer(team, producerId) {
      if (!validTeam(team)) return null;
      return producerId == null ? this.getCore(team) || null : this.getRecruitProducers(team).find(b => b.id === producerId) || null;
    }

    getRecruitQueue(team, producerId) {
      const producer = this.getRecruitProducer(team, producerId);
      return producer ? producer.type === 'core' ? this.queues[team] : producer.queue : [];
    }

    getQueuedCount(team) {
      // Include the historical core queue even after its destruction.
      return this.queues[team].length + this.buildings.filter(b => b.team === team && b.type === 'barracks' && b.hp > 0)
        .reduce((sum, b) => sum + b.queue.length, 0);
    }

    recruit(team, type, producerId) {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!this.can('recruit', type)) return { ok: false, message: 'Cette unité sera découverte dans une prochaine mission.' };
      const core = this.getCore(team), producer = this.getRecruitProducer(team, producerId), stats = UNIT_STATS[type];
      if (!validTeam(team) || !stats || !core || !producer) return { ok: false, message: 'Recrutement impossible.' };
      if (!producer.connected) return { ok: false, message: 'Reconnectez ce bâtiment pour former des unités.' };
      if ((core.level || 1) < stats.requiredLevel) return { ok: false, message: 'Cette unité nécessite un Cœur de niveau 2.' };
      const queue = this.getRecruitQueue(team, producer.id);
      if (queue.length >= QUEUE_LIMIT) return { ok: false, message: 'File complète : 6 formations maximum.' };
      if (this.units.filter(u => u.team === team && u.hp > 0).length + this.getQueuedCount(team) >= UNIT_LIMIT) return { ok: false, message: 'Limite de 36 unités, formations comprises.' };
      const cost = this.getCost(team, type);
      if (this.money[team] < cost) return { ok: false, message: 'Pigment insuffisant.' };
      this.money[team] -= cost;
      const id = this._id++, unitId = this._id++, duration = this.getRecruitTime(team, type);
      queue.push({ id, unitId, type, cost, duration, remaining: duration, started: queue.length === 0 });
      this.emit('queued', 'Formation ajoutée', producer.x, producer.y, team);
      return { ok: true, message: 'Unité ajoutée à la file de formation.', id: unitId, jobId: id };
    }

    cancelRecruit(team, jobId, producerId) {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!validTeam(team)) return { ok: false, message: 'Formation inconnue.' };
      const queue = this.getRecruitQueue(team, producerId), index = queue.findIndex(job => job.id === jobId);
      if (index < 0) return { ok: false, message: 'Cette formation est déjà terminée.' };
      const job = queue[index], refund = Math.floor(job.cost * (job.started ? .5 : 1));
      queue.splice(index, 1);
      this.money[team] += refund;
      if (queue[0]) queue[0].started = true;
      return { ok: true, message: `Formation annulée : ${refund} pigments remboursés.`, refund };
    }

    setRally(team, x, y, producerId) {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!this.can('rally')) return { ok: false, message: 'Le ralliement sera découvert avec la caserne.' };
      const producer = this.getRecruitProducer(team, producerId), t = this.tile(x, y);
      if (!validTeam(team) || !producer || !t || t.blocked) return { ok: false, message: 'Point de ralliement inaccessible.' };
      if ((t.x !== producer.x || t.y !== producer.y) && !this.findPath(producer.x, producer.y, t.x, t.y).length) return { ok: false, message: 'Aucun chemin vers ce point.' };
      if (producer.type === 'core') this.rally[team] = { x: t.x, y: t.y };
      else producer.rally = { x: t.x, y: t.y };
      return { ok: true, message: 'Les prochaines unités rejoindront ce point.' };
    }

    _updateRecruitment(team, dt) {
      for (const producer of this.getRecruitProducers(team)) this._updateProducer(producer, dt);
    }

    _updateProducer(producer, dt) {
      const team = producer.team, queue = this.getRecruitQueue(team, producer.id);
      if (!producer.connected || !queue.length) return;
      const job = queue[0];
      job.started = true;
      job.remaining = Math.max(0, job.remaining - dt);
      if (job.remaining > .000001 || this.units.filter(u => u.team === team && u.hp > 0).length >= UNIT_LIMIT) return;
      let x = producer.x + .5 + (this.random() - .5) * 2, y = producer.y + .5 + (this.random() - .5) * 2;
      if (!this.tile(x, y) || this.tile(x, y).blocked) { x = producer.x + .5; y = producer.y + .5; }
      const u = this._unit(team, job.type, x, y, job.unitId);
      queue.shift();
      if (queue[0]) queue[0].started = true;
      const rally = producer.type === 'core' ? this.rally[team] : producer.rally;
      if (rally) this.order([u.id], rally.x, rally.y);
      if (this.mission) Missions.onRecruit(this, u, producer);
      this.emit('recruit', 'Unité prête', x, y, team);
    }

    assignSquad(team, slot, ids) {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!this.can('squad')) return { ok: false, message: 'Les escouades seront découvertes dans une prochaine mission.' };
      if (!validTeam(team) || !Number.isInteger(slot) || slot < 0 || slot > 2 || !Array.isArray(ids)) return { ok: false, message: 'Escouade inconnue.' };
      const squad = [...new Set(ids)].filter(id => this.units.some(u => u.id === id && u.team === team && u.hp > 0));
      if (ids.length && !squad.length) return { ok: false, message: 'Sélectionnez vos unités.' };
      this.squads[team][slot] = squad;
      return { ok: true, message: squad.length ? `Escouade ${slot + 1} enregistrée.` : `Escouade ${slot + 1} effacée.` };
    }

    getSquad(team, slot) {
      if (!validTeam(team) || !Number.isInteger(slot) || slot < 0 || slot > 2) return [];
      this.squads[team][slot] = this.squads[team][slot].filter(id => this.units.some(u => u.id === id && u.team === team && u.hp > 0));
      return [...this.squads[team][slot]];
    }

    command(team, ids, stance, x, y) {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!this.can('command', stance)) return { ok: false, message: 'Les unités seront découvertes à la troisième mission.' };
      if (!validTeam(team) || !Array.isArray(ids) || !['hold', 'retreat', 'attack', 'move'].includes(stance)) return { ok: false, message: 'Ordre inconnu.' };
      const selected = this.units.filter(u => u.team === team && u.hp > 0 && ids.includes(u.id));
      if (!selected.length) return { ok: false, message: 'Sélectionnez vos unités.' };
      if (stance === 'hold') {
        for (const u of selected) {
          u.path = [];
          u.stance = 'hold';
          u.order = { x: u.x, y: u.y, stance: 'hold' };
        }
        return { ok: true, message: 'Position tenue. Les unités ne poursuivent pas les ennemis.' };
      }
      if (stance === 'retreat') {
        const core = this.getCore(team);
        if (!core) return { ok: false, message: 'Votre Cœur est indisponible.' };
        return this.order(selected.map(u => u.id), core.x, core.y, 'retreat');
      }
      return this.order(selected.map(u => u.id), x, y, stance);
    }

    order(ids, x, y, stance = 'move') {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!this.can('command', stance)) return { ok: false, message: 'Les unités seront découvertes à la troisième mission.' };
      const t = this.tile(x, y);
      if (!t || t.blocked || !Array.isArray(ids)) return { ok: false, message: 'Destination inaccessible.' };
      if (!['move', 'attack', 'retreat'].includes(stance)) return { ok: false, message: 'Ordre inconnu.' };
      let count = 0;
      const selected = this.units.filter(u => u.hp > 0 && ids.includes(u.id));
      for (const u of selected) {
        let dest = t;
        if (selected.length > 1) {
          const angle = count * 2.399963, radius = Math.min(3.5, Math.sqrt(count) * .7);
          const candidate = this.tile(t.x + Math.round(Math.cos(angle) * radius), t.y + Math.round(Math.sin(angle) * radius));
          if (candidate && !candidate.blocked) dest = candidate;
        }
        const path = this.findPath(u.x, u.y, dest.x, dest.y);
        const current = this.tile(u.x, u.y);
        if (!path.length && (current?.x !== dest.x || current?.y !== dest.y)) continue;
        u.path = path;
        u.stance = stance;
        u.order = { x: dest.x + .5, y: dest.y + .5, stance };
        count++;
      }
      return { ok: count > 0, message: count ? (stance === 'retreat' ? 'Repli vers le Cœur pour se soigner.' : 'Ordre donné.') : 'Aucune unité ne peut atteindre cette destination.' };
    }

    power(team, type, x, y) {
      if (this.winner !== null) return { ok: false, message: 'La partie est terminée.' };
      if (!this.can('power', type)) return { ok: false, message: 'Les pouvoirs seront découverts dans une prochaine mission.' };
      if (!validTeam(team) || !['impulse', 'bleach'].includes(type)) return { ok: false, message: 'Pouvoir inconnu.' };
      if (this.cooldowns[team][type] > 0) return { ok: false, message: 'Pouvoir en recharge.' };
      const t = this.tile(x, y);
      if (!t) return { ok: false, message: 'Choisissez une zone.' };
      if (!(team === 1 ? t.visible : t.aiVisible)) return { ok: false, message: 'Cette zone doit être visible.' };
      if (type === 'impulse') {
        const b = this.buildings.filter(b => b.team === team && b.connected && ['relay', 'core'].includes(b.type))
          .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
        if (!b || Math.hypot(b.x - x, b.y - y) > 7) return { ok: false, message: 'Visez un relais ou votre Cœur connecté.' };
        b.boostUntil = this.time + 12;
        this.cooldowns[team][type] = 40;
        this.emit('impulse', 'Impulsion de croissance', b.x, b.y, team);
      } else {
        for (const tile of this.tiles) if (tile.owner === 3 - team && Math.hypot(tile.x - x, tile.y - y) <= 4) tile.weakenedUntil = this.time + 14;
        for (const b of this.buildings) if (b.team === 3 - team && Math.hypot(b.x - x, b.y - y) < 4) b.hp -= 25;
        this.cooldowns[team][type] = 50;
        this.emit('bleach', 'Décoloration', x, y, team);
      }
      return { ok: true, message: type === 'impulse' ? 'Croissance accélérée !' : 'Défenses territoriales affaiblies !' };
    }

    findPath(sx, sy, tx, ty) {
      const start = this.tile(sx, sy), goal = this.tile(tx, ty);
      if (!start || !goal || goal.blocked) return [];
      const si = start.y * WIDTH + start.x, gi = goal.y * WIDTH + goal.x;
      if (si === gi) return [];
      const prev = new Int32Array(WIDTH * HEIGHT);
      prev.fill(-1); prev[si] = si;
      const q = new Int32Array(WIDTH * HEIGHT);
      q[0] = si;
      let head = 0, tail = 1;
      while (head < tail) {
        const i = q[head++];
        if (i === gi) break;
        const x = i % WIDTH, y = Math.floor(i / WIDTH);
        for (const [dx, dy] of NEIGHBORS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
          const n = ny * WIDTH + nx;
          if (prev[n] !== -1 || this.tiles[n].blocked) continue;
          prev[n] = i; q[tail++] = n;
        }
      }
      if (prev[gi] === -1) return [];
      const path = [];
      for (let i = gi; i !== si; i = prev[i]) path.push({ x: i % WIDTH + .5, y: Math.floor(i / WIDTH) + .5 });
      return path.reverse();
    }

    _updateIncome() {
      for (let team = 1; team <= 2; team++) {
        this.income[team] = this.buildings.filter(b => b.team === team && b.connected && b.hp > 0)
          .reduce((sum, b) => sum + (this.getBuildingStats(b).income || 0), 0);
      }
    }

    recompute() {
      for (const t of this.tiles) t.connected = false;
      for (let team = 1; team <= 2; team++) {
        const core = this.getCore(team);
        if (!core) continue;
        const t = this.tile(core.x, core.y);
        t.owner = team; t.connected = true;
        const q = [t]; let head = 0;
        while (head < q.length) {
          const a = q[head++];
          for (const [dx, dy] of NEIGHBORS) {
            const n = this.tile(a.x + dx, a.y + dy);
            if (n && !n.blocked && n.owner === team && !n.connected) { n.connected = true; q.push(n); }
          }
        }
      }
      const counts = [0, 0, 0]; let available = 0;
      for (const t of this.tiles) { if (!t.blocked) available++; if (t.connected) counts[t.owner]++; }
      for (let team = 1; team <= 2; team++) this.scores[team] = counts[team] / available;
      for (const b of this.buildings) {
        const t = this.tile(b.x, b.y);
        b.connected = t.owner === b.team && t.connected;
      }
      this._updateIncome();
    }

    updateVisibility() {
      for (const t of this.tiles) { t.visible = false; t.aiVisible = false; }
      const reveal = (team, x, y, radius) => {
        for (let yy = Math.max(0, Math.floor(y - radius)); yy <= Math.min(HEIGHT - 1, Math.ceil(y + radius)); yy++) {
          for (let xx = Math.max(0, Math.floor(x - radius)); xx <= Math.min(WIDTH - 1, Math.ceil(x + radius)); xx++) {
            const t = this.tile(xx, yy);
            if (Math.hypot(xx + .5 - x, yy + .5 - y) <= radius) {
              if (team === 1) { t.visible = true; t.explored = true; }
              else { t.aiVisible = true; t.aiExplored = true; }
            }
          }
        }
      };
      for (const t of this.tiles) if (t.connected) {
        if (t.owner === 1) { t.visible = true; t.explored = true; }
        else if (t.owner === 2) { t.aiVisible = true; t.aiExplored = true; }
      }
      for (const b of this.buildings) if (b.hp > 0) reveal(b.team, b.x + .5, b.y + .5, b.type === 'core' ? 9 : 7);
      for (const u of this.units) if (u.hp > 0) reveal(u.team, u.x, u.y, UNIT_STATS[u.type].vision);
      // Memory contains snapshots, never a reference to a hidden enemy object.
      // A vanished building is forgotten only after its old tile is seen again.
      this.aiMemory = this.aiMemory.filter(known => !this.tile(known.x, known.y)?.aiVisible ||
        this.buildings.some(b => b.hp > 0 && b.team === 1 && b.id === known.id && b.x === known.x && b.y === known.y));
      for (const b of this.buildings) if (b.hp > 0 && b.team === 1 && this.tile(b.x, b.y)?.aiVisible) {
        const known = { id: b.id, type: b.type, x: b.x, y: b.y, seenAt: this.time };
        const index = this.aiMemory.findIndex(item => item.id === b.id);
        if (index < 0) this.aiMemory.push(known);
        else this.aiMemory[index] = known;
      }
    }

    _collectCaches() {
      for (const tile of this.tiles) {
        if (!tile.cache) continue;
        const nearby = this.units.filter(u => u.hp > 0 && Math.hypot(u.x - tile.x - .5, u.y - tile.y - .5) <= 2.2);
        const collector = nearby.find(u => u.type !== 'engineer' && Math.hypot(u.x - tile.x - .5, u.y - tile.y - .5) <= 1.2);
        if (!collector || nearby.some(u => u.team !== collector.team)) continue;
        const amount = tile.cache;
        tile.cache = 0;
        this.money[collector.team] += amount;
        this.emit('cache', `Réserve récupérée : +${amount} pigments`, tile.x, tile.y, collector.team);
      }
    }

    _spreadTerritory() {
      const claims = [];
      for (const b of this.buildings) {
        if (!b.connected) continue;
        const radius = this.getBuildingStats(b).radius + (b.boostUntil > this.time ? 2 : 0);
        for (let y = b.y - radius; y <= b.y + radius; y++) for (let x = b.x - radius; x <= b.x + radius; x++) {
          const t = this.tile(x, y);
          if (!t || t.blocked || t.owner || Math.hypot(x - b.x, y - b.y) > radius) continue;
          // Absorbent paper slows passive ink only; units can still capture it.
          if (t.terrain === 'absorbent' && Math.floor(this.time + 1e-6) % 2 !== 0) continue;
          if (NEIGHBORS.some(([dx, dy]) => { const a = this.tile(x + dx, y + dy); return a?.owner === b.team && a.connected; })) claims.push([t, b.team]);
        }
      }
      // Alternate resolution avoids an advantage when both teams claim the same cell.
      if (Math.floor(this.time) % 2) claims.reverse();
      for (const [t, team] of claims) if (!t.owner) t.owner = team;
      for (const t of this.tiles) {
        if (t.owner && !t.connected) {
          const decay = this.specializations[t.owner] === 'fortification' ? 25 : 15;
          t.isolation++;
          if (t.isolation >= decay && !this.buildings.some(b => b.x === t.x && b.y === t.y && b.type === 'core')) { t.owner = 0; t.isolation = 0; }
        } else t.isolation = 0;
      }
      this.recompute();
    }

    _captureTerritory() {
      for (const u of this.units) {
        // Support engineers never replace frontline combatants for conquest.
        if (u.type === 'engineer' || u.hp <= 0) continue;
        const radius = u.type === 'fighter' ? 1.8 : u.type === 'breaker' ? 1.15 : 1.05;
        for (let y = Math.floor(u.y - radius); y <= Math.floor(u.y + radius); y++) for (let x = Math.floor(u.x - radius); x <= Math.floor(u.x + radius); x++) {
          const t = this.tile(x, y);
          if (!t || t.blocked || t.owner === u.team || Math.hypot(x + .5 - u.x, y + .5 - u.y) > radius) continue;
          if (this.units.some(v => v.team !== u.team && v.hp > 0 && Math.hypot(v.x - x - .5, v.y - y - .5) < 2.2)) continue;
          if (this.buildings.some(b => b.team !== u.team && b.hp > 0 && Math.hypot(b.x - x, b.y - y) < (t.weakenedUntil > this.time ? 1 : 2.5))) continue;
          if (u.type === 'scout' && t.owner !== 0) continue;
          t.owner = u.team; t.isolation = 0;
        }
      }
      this.recompute();
    }

    _aiThink() {
      if (this.mission) return;
      const team = 2, foe = 1, core = this.getCore(team);
      if (!core) return;
      this.updateVisibility();
      const easy = this.difficulty === 'easy';
      // Détente changes strategic intent, never combat stats or victory rules.
      // The army first develops its half, then raids the midfield in short waves.
      // A player who attacks early can still be met by the full defending army.
      const foeCore = this.aiMemory.find(b => b.type === 'core');
      const easyFrontier = this.time < 180 ? 14 : this.time < 300 ? 20 : this.time < 420 ? 26 : HEIGHT;
      const easyRaid = this.time >= 180 && (this.time - 180) % 90 < 35;
      const connected = this.tiles.filter(t => t.owner === team && t.connected && !t.blocked);
      for (const t of connected) {
        if (t.source && !this.buildings.some(b => Math.hypot(b.x - t.x, b.y - t.y) < 2.1) && this.money[team] >= this.getCost(team, 'extractor')) {
          this.build(team, 'extractor', t.x, t.y); break;
        }
      }
      if (this.money[team] >= this.getCost(team, 'relay') && this.time >= this._nextExpand) {
        const candidates = connected.filter(t => !t.source && (!easy || t.y <= easyFrontier) && !this.buildings.some(b => Math.hypot(b.x - t.x, b.y - t.y) < 4.2));
        let best = null, bestScore = -1;
        for (const t of candidates) {
          let gain = 0;
          for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
            const n = this.tile(t.x + dx, t.y + dy);
            // Unknown or hidden ownership never informs an economic choice.
            if (n && n.aiVisible && !n.blocked && !n.owner && dx * dx + dy * dy <= 36) gain++;
          }
          const score = gain + t.y * .055 + this.random() * 2;
          if (gain > 4 && score > bestScore) { best = t; bestScore = score; }
        }
        if (best) { this.build(team, 'relay', best.x, best.y); this._nextExpand = this.time + (easy ? this.time < 300 ? 35 : 30 : 13); }
      }
      // Development is deliberately delayed on easy. It uses the same prices as the player.
      const army = this.units.filter(u => u.team === team), queue = this.queues[team];
      if (this.time > (easy ? 150 : 95) && army.length >= 5 && (core.level || 1) < 2 && this.money[team] >= this.getUpgradeCost(core.id)) this.upgradeBuilding(team, core.id);
      if ((core.level || 1) >= 2 && !this.specializations[team] && this.time > (easy ? 205 : 135) && this.money[team] >= 145) this.chooseSpecialization(team, easy ? 'fortification' : 'expansion');
      if (this.time > (easy ? 380 : 290) && core.level === 2 && this.money[team] >= this.getUpgradeCost(core.id) + 65) this.upgradeBuilding(team, core.id);
      if (this.time > (easy ? 245 : 175) && this.money[team] > 200) {
        const economic = this.buildings.find(b => b.team === team && b.connected && b.type === 'extractor' && b.level < 3);
        if (economic) this.upgradeBuilding(team, economic.id);
      }
      const count = type => army.filter(u => u.type === type).length + queue.filter(job => job.type === type).length;
      const saboteurReady = this.time > (easy ? 230 : 150);
      // Keep places for support roles instead of filling the whole army before technology.
      const reservedPlaces = (core.level || 1) < 2 ? 2 : !saboteurReady && !count('saboteur') ? 1 : 0;
      const targetCount = (easy ? this.time < 300 ? 8 : 10 : 18) - reservedPlaces;
      if (army.length + queue.length < targetCount && queue.length < (easy ? 2 : 3)) {
        let type = count('breaker') < Math.floor(army.length / 5) ? 'breaker' : 'fighter';
        if (!count('scout')) type = 'scout';
        else if (core.level >= 2 && !count('engineer')) type = 'engineer';
        else if (core.level >= 2 && saboteurReady && !count('saboteur')) type = 'saboteur';
        if (this.money[team] >= this.getCost(team, type)) this.recruit(team, type);
      }
      const threats = this.units.filter(u => u.team === foe && u.hp > 0 && this.tile(u.x, u.y)?.aiVisible && this.tile(u.x, u.y)?.owner === team);
      let goal = null;
      if (threats.length) goal = threats.sort((a, b) => dist(a, core) - dist(b, core))[0];
      else if ((!easy && this.time > 65 || easy && (easyRaid || this.time >= 420)) && army.length >= 5) {
        goal = this.aiMemory.filter(b => (easy ? this.time >= 420 || b.type !== 'core' && (foeCore ? dist(b, foeCore) >= 10 : b.y <= 31) : b.type !== 'core' || this.time > 180))
          .sort((a, b) => dist(a, core) - dist(b, core))[0];
        // An idle opponent still sees a small raid contest the central pigment.
        // Staying ten tiles from its Cœur leaves a readable, defendable front.
        if (!goal) {
          // Investigate the mid-field first. Later expeditions advance beyond
          // the known front instead of magically selecting a hidden building.
          const front = Math.max(6, ...this.buildings.filter(b => b.team === team && b.connected).map(b => b.y));
          const y = easy && this.time < 420 ? 31 : Math.min(!easy && this.time < 180 ? 31 : 42, front + 8);
          goal = this.tiles.filter(t => !t.blocked && t.y === y).sort((a, b) => Math.abs(a.x - 16) - Math.abs(b.x - 16))[0];
        }
      }
      const frontier = this.buildings.filter(b => b.team === team && b.connected && b.type === 'relay').sort((a, b) => b.y - a.y)[0];
      if (frontier) this.setRally(team, frontier.x, frontier.y);
      const fighters = army.filter(u => !['scout', 'engineer', 'saboteur'].includes(u.type));
      const healthy = [];
      for (const u of fighters) {
        if (u.hp < u.maxHp * .25 || (u.stance === 'retreat' && u.hp < u.maxHp * .75)) this.command(team, [u.id], 'retreat');
        else healthy.push(u.id);
      }
      if (easy) {
        const raiders = goal ? healthy.map(id => this.units.find(u => u.id === id)).sort((a, b) => dist(a, goal) - dist(b, goal))
          .slice(0, threats.length || this.time >= 420 ? healthy.length : this.time < 300 ? 3 : 5).map(u => u.id) : [];
        if (goal) this.command(team, raiders, 'attack', goal.x, goal.y);
        for (const id of healthy.filter(id => !raiders.includes(id))) {
          const u = this.units.find(u => u.id === id), guard = frontier || core;
          if (dist(u, guard) > 3) this.order([id], guard.x, guard.y, 'attack');
          else this.command(team, [id], 'hold');
        }
      } else if (goal) this.command(team, healthy, 'attack', goal.x, goal.y);
      else if (frontier) for (const id of healthy) {
        const u = this.units.find(u => u.id === id);
        if (!u.path.length && dist(u, frontier) > 4) this.order([id], frontier.x, frontier.y, 'attack');
      }
      for (const engineer of army.filter(u => u.type === 'engineer')) {
        const damaged = this.buildings.filter(b => b.team === team && b.hp < b.maxHp && b.hp > 0).sort((a, b) => dist(engineer, a) - dist(engineer, b))[0];
        const destination = damaged || frontier || core;
        if (dist(engineer, destination) > 2.5) this.order([engineer.id], destination.x, destination.y);
        else this.command(team, [engineer.id], 'hold');
      }
      for (const saboteur of army.filter(u => u.type === 'saboteur')) {
        const relay = this.aiMemory.filter(b => b.type === 'relay' && (!easy || this.time >= 420 || easyRaid && (foeCore ? dist(b, foeCore) >= 10 : b.y <= 31))).sort((a, b) => dist(saboteur, a) - dist(saboteur, b))[0];
        if (saboteur.hp < saboteur.maxHp * .3) this.command(team, [saboteur.id], 'retreat');
        else if (relay) this.order([saboteur.id], relay.x, relay.y, 'attack');
        else if (frontier) {
          if (dist(saboteur, frontier) > 3) this.order([saboteur.id], frontier.x, frontier.y);
          else this.command(team, [saboteur.id], 'hold');
        }
      }
      for (const scout of army.filter(u => u.type === 'scout')) {
        if (scout.hp < scout.maxHp * .4 || scout.stance === 'retreat' && scout.hp < scout.maxHp * .8) {
          this.command(team, [scout.id], 'retreat');
          continue;
        }
        if (scout.path.length) continue;
        const limit = easy ? this.time < 300 ? 24 : this.time < 420 ? 31 : HEIGHT - 1 : HEIGHT - 1;
        const resources = this.tiles.filter(t => t.aiExplored && !t.blocked && t.y <= limit && dist(scout, t) > 2 &&
          (t.aiVisible && t.cache > 0 || t.source && (t.aiVisible ? t.owner === 0 : true)))
          .sort((a, b) => (dist(scout, a) - (a.aiVisible && a.cache ? 3 : 0)) - (dist(scout, b) - (b.aiVisible && b.cache ? 3 : 0)));
        const destination = resources[0] || this._scoutDestination(scout, limit);
        if (destination) this.order([scout.id], destination.x, destination.y);
      }
      if (goal && this.tile(goal.x, goal.y)?.aiVisible && !easy && this.cooldowns[team].bleach <= 0) this.power(team, 'bleach', goal.x, goal.y);
    }

    _scoutDestination(scout, maxY) {
      let best = null, bestScore = -Infinity;
      // Geometry can guide navigation; enemy state and undiscovered objectives
      // cannot. Sample information gain around reachable unexplored positions.
      for (let y = 1; y <= maxY; y += 3) for (let x = 1; x < WIDTH; x += 3) {
        const t = this.tile(x, y);
        if (t.blocked || t.aiExplored || dist(scout, t) < 2) continue;
        let unknown = 0;
        for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
          const n = this.tile(x + dx, y + dy);
          if (n && !n.aiExplored && dx * dx + dy * dy <= 36) unknown++;
        }
        const score = unknown / (dist(scout, t) + 4) + y * .015;
        if (score > bestScore) { best = t; bestScore = score; }
      }
      return best;
    }

    _canSeePosition(team, x, y) {
      const tile = this.tile(x, y);
      if (tile?.owner === team && tile.connected) return true;
      return this.buildings.some(b => b.team === team && b.hp > 0 && Math.hypot(x - b.x - .5, y - b.y - .5) <= (b.type === 'core' ? 9 : 7)) ||
        this.units.some(u => u.team === team && u.hp > 0 && Math.hypot(x - u.x, y - u.y) <= UNIT_STATS[u.type].vision);
    }

    _combatTarget(u, stats) {
      const buildings = this.buildings.filter(b => b.team !== u.team && b.hp > 0 && Math.hypot(u.x - b.x - .5, u.y - b.y - .5) <= stats.range + .5);
      if (u.type === 'saboteur') {
        const relay = buildings.filter(b => b.type === 'relay').sort((a, b) => dist(u, a) - dist(u, b))[0];
        if (relay) return { target: relay, isBuilding: true };
      }
      const enemy = this.units.filter(v => v.team !== u.team && v.hp > 0 && dist(u, v) <= stats.range).sort((a, b) => dist(u, a) - dist(u, b))[0];
      if (enemy) return { target: enemy, isBuilding: false };
      return { target: buildings.sort((a, b) => dist(u, a) - dist(u, b))[0] || null, isBuilding: true };
    }

    _repair(u, stats, dt) {
      const target = this.buildings.filter(b => b.team === u.team && b.hp > 0 && b.hp < b.maxHp && Math.hypot(u.x - b.x - .5, u.y - b.y - .5) <= stats.repairRange)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      u.repairTarget = target?.id || null;
      u.repairTargetId = u.repairTarget;
      if (target) {
        target.hp = Math.min(target.maxHp, target.hp + stats.repair * dt);
        if (u.attack <= 0) {
          this.emit('repair', '', u.x, u.y, u.team);
          this.events[this.events.length - 1].target = { x: target.x + .5, y: target.y + .5 };
          u.attack = .7;
        }
      }
    }

    _moveUnit(u, speed, dt) {
      let remaining = speed * dt * (this.tile(u.x, u.y)?.terrain === 'smooth' ? 1.3 : 1);
      while (remaining > 0 && u.path.length) {
        const p = u.path[0], d = dist(u, p);
        if (d <= remaining) { u.x = p.x; u.y = p.y; u.path.shift(); remaining -= d; }
        else { u.x += (p.x - u.x) / d * remaining; u.y += (p.y - u.y) / d * remaining; remaining = 0; }
      }
    }

    update(dt) {
      if (this.winner !== null) return;
      dt = Math.min(Math.max(Number(dt) || 0, 0), .1);
      this.time += dt;
      this._updateIncome();
      for (let team = 1; team <= 2; team++) {
        this.money[team] += this.income[team] * dt;
        for (const key of ['impulse', 'bleach']) this.cooldowns[team][key] = Math.max(0, this.cooldowns[team][key] - dt);
        this._updateRecruitment(team, dt);
      }
      for (const b of this.buildings) {
        b.age += dt; b.attack = Math.max(0, b.attack - dt);
        if (b.hp <= 0 || !b.connected || !['bastion', 'core'].includes(b.type)) continue;
        const stats = this.getBuildingStats(b);
        const target = this.units.filter(u => u.team !== b.team && u.hp > 0 && Math.hypot(u.x - b.x - .5, u.y - b.y - .5) < stats.range && this._canSeePosition(b.team, u.x, u.y))
          .sort((a, c) => dist(a, b) - dist(c, b))[0];
        if (target && b.attack <= 0) {
          target.hp -= stats.damage; target.lastHit = this.time; b.attack = .8;
          this.emit('shot', '', b.x + .5, b.y + .5, b.team);
          this.events[this.events.length - 1].target = { x: target.x, y: target.y };
        }
      }
      for (const u of this.units) {
        if (u.hp <= 0) continue;
        const stats = this.getUnitStats(u.team, u.type);
        u.attack = Math.max(0, u.attack - dt);
        let target = null;
        if (u.type === 'engineer') this._repair(u, stats, dt);
        else if (u.stance !== 'retreat') {
          const combat = this._combatTarget(u, stats);
          target = combat.target;
          if (target && u.attack <= 0) {
            let multiplier = 1;
            if (combat.isBuilding && u.type === 'breaker') multiplier = 2.5;
            if (combat.isBuilding && u.type === 'saboteur') multiplier = target.type === 'relay' ? 5 : 3;
            target.hp -= stats.damage * multiplier; target.lastHit = this.time; u.attack = stats.cooldown;
            this.emit('shot', '', u.x, u.y, u.team);
            this.events[this.events.length - 1].target = { x: target.x + (combat.isBuilding ? .5 : 0), y: target.y + (combat.isBuilding ? .5 : 0) };
          }
        }
        // Attack-move stops in firing range. A direct move or retreat always moves.
        if (u.path.length && !(u.stance === 'attack' && target)) this._moveUnit(u, stats.speed, dt);
        else if (!u.path.length && !target && !['hold', 'retreat'].includes(u.stance) && !['scout', 'engineer'].includes(u.type)) {
          u.retarget -= dt;
          if (u.retarget <= 0) {
            u.retarget = 1.3;
            const enemy = this.units.find(v => v.team !== u.team && v.hp > 0 && dist(u, v) < 4.5);
            if (enemy) u.path = this.findPath(u.x, u.y, enemy.x, enemy.y);
          }
        }
        const tile = this.tile(u.x, u.y);
        if (tile?.owner === u.team && tile.connected && this.time - u.lastHit > 5) u.hp = Math.min(u.maxHp, u.hp + 4 * dt);
      }
      // Soft separation keeps groups readable; holding units yield less than movers.
      for (let i = 0; i < this.units.length; i++) for (let j = i + 1; j < this.units.length; j++) {
        const a = this.units[i], b = this.units[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= .56) continue;
        if (d < .001) { dx = Math.cos(a.id) * .01; dy = Math.sin(a.id) * .01; d = .01; }
        const push = Math.min((.56 - d) * .5, dt * .85), px = dx / d * push, py = dy / d * push;
        const ta = this.tile(a.x - px, a.y - py), tb = this.tile(b.x + px, b.y + py);
        if (ta && !ta.blocked && a.stance !== 'hold') { a.x -= px; a.y -= py; }
        if (tb && !tb.blocked && b.stance !== 'hold') { b.x += px; b.y += py; }
      }
      for (const b of this.buildings.filter(b => b.hp <= 0)) {
        this.emit('destroy', 'Bâtiment détruit', b.x, b.y, b.team);
        if (b.type === 'barracks' && b.queue.length) {
          const refund = b.queue.reduce((sum, job) => sum + Math.floor(job.cost * (job.started ? .5 : 1)), 0);
          this.money[b.team] += refund;
          b.queue.length = 0;
          this.emit('refund', `Caserne détruite : ${refund} pigments de formation remboursés.`, b.x, b.y, b.team);
        }
        if (b.type === 'core' && (!this.mission || b.team === 1)) {
          this.winner = 3 - b.team;
          this.winReason = this.mission ? 'Votre Cœur a été détruit. Réessayez cette mission.' : 'Cœur adverse détruit';
        }
      }
      for (const u of this.units.filter(u => u.hp <= 0)) this.emit('death', '', u.x, u.y, u.team);
      this.units = this.units.filter(u => u.hp > 0);
      this.buildings = this.buildings.filter(b => b.hp > 0);
      for (let team = 1; team <= 2; team++) for (let slot = 0; slot < 3; slot++) this.getSquad(team, slot);
      this._spread += dt; this._capture += dt; this._vision += dt; this._ai += dt;
      if (this._spread >= 1) { this._spread -= 1; this._spreadTerritory(); }
      if (this._capture >= .7) { this._capture -= .7; this._captureTerritory(); this._collectCaches(); }
      if (this._vision >= .3) { this._vision = 0; this.updateVisibility(); }
      if (this._ai >= (this.difficulty === 'easy' ? 5 : 3.3)) { this._ai = 0; this._aiThink(); }
      if (this.mission) {
        if (this.winner === null) Missions.update(this, dt);
        return;
      }
      for (let team = 1; team <= 2; team++) {
        this.hold[team] = this.scores[team] >= .6 ? this.hold[team] + dt : 0;
        if (this.hold[team] > 0 && !this._holdEvent[team]) { this._holdEvent[team] = true; this.emit('domination', '60 % atteints : tenez 45 secondes !', 0, 0, team); }
        if (!this.hold[team]) this._holdEvent[team] = false;
        if (this.hold[team] >= 45) { this.winner = team; this.winReason = 'Domination territoriale'; }
      }
      if (this.time >= this.duration && this.winner === null) {
        this.winner = Math.abs(this.scores[1] - this.scores[2]) < .0001 ? 0 : this.scores[1] > this.scores[2] ? 1 : 2;
        this.winReason = 'Temps écoulé';
      }
    }
  }

  const api = { Game, MAPS: Maps.catalog, COSTS, UNIT_STATS, BUILDING_STATS, WIDTH, HEIGHT, UNIT_LIMIT, QUEUE_LIMIT, RECRUIT_TIMES, UPGRADE_COSTS, SPECIALIZATIONS };
  root.CQEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
