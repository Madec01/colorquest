/* Versioned simulation snapshots. Keep this schema in step with engine.js.
 * No constructor, recomputation, random draw or elapsed wall-clock time is used
 * when restoring: a paused game continues on its exact next simulation tick.
 * V1 migration preserves the entire old board, adding only neutral terrain and
 * current AI sight. No new resource, obstacle, income or past sight is invented.
 * UI state, tutorial hooks and functions on a Game instance are never saved.
 */
(function (root) {
  'use strict';

  const FORMAT = 'colorquest-snapshot', VERSION = 3;
  const MAX_TIME = 86400, MAX_ID = 10000000;
  const LEGACY_STATE_KEYS = [
    'width', 'height', 'difficulty', 'seed', 'time', 'duration', 'winner', 'winReason',
    'units', 'buildings', 'events', 'money', 'income', 'scores', 'hold', 'cooldowns',
    'queues', 'rally', 'specializations', 'squads', '_id', '_nextExpand', '_spread',
    '_ai', '_vision', '_capture', '_holdEvent', 'tiles'
  ];
  const V2_STATE_KEYS = [...LEGACY_STATE_KEYS, 'mapId', 'aiMemory'];
  const STATE_KEYS = [...V2_STATE_KEYS, 'mission'];
  const MAP_IDS = ['legacy', 'plain', 'lanes', 'crossroads'];
  const LEGACY_TILE_KEYS = ['x', 'y', 'owner', 'connected', 'explored', 'visible', 'blocked', 'source', 'isolation'];
  const TILE_KEYS = [...LEGACY_TILE_KEYS, 'terrain', 'rich', 'cache', 'aiVisible', 'aiExplored'];
  const STANCES = ['move', 'attack', 'hold', 'retreat'];
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const engine = () => root.CQEngine || (typeof module !== 'undefined' && module.exports ? require('./engine.js') : null);
  const missions = () => root.CQMissions || (typeof module !== 'undefined' && module.exports ? require('./missions.js') : null);

  function invalid(path, reason) {
    throw new Error(`Sauvegarde invalide : ${path} ${reason}.`);
  }

  function record(value, path, required, optional = []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'doit être un objet');
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) invalid(path, 'possède un prototype non pris en charge');
    const keys = Object.getOwnPropertyNames(value), allowed = new Set([...required, ...optional]);
    if (Object.getOwnPropertySymbols(value).length) invalid(path, 'contient des champs inconnus');
    if (keys.length > allowed.size) invalid(path, 'contient des champs inconnus');
    for (const key of keys) {
      if (!allowed.has(key)) invalid(`${path}.${key}`, 'est un champ inconnu');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !own(descriptor, 'value')) invalid(`${path}.${key}`, 'doit être une valeur simple');
    }
    for (const key of required) if (!own(value, key)) invalid(`${path}.${key}`, 'est manquant');
  }

  function array(value, path, max, exact) {
    if (!Array.isArray(value) || value.length > max || (exact !== undefined && value.length !== exact)) {
      invalid(path, exact === undefined ? `doit contenir au plus ${max} éléments` : `doit contenir ${exact} éléments`);
    }
    if (Object.getPrototypeOf(value) !== Array.prototype) invalid(path, 'possède un prototype non pris en charge');
    if (Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== value.length + 1) invalid(path, 'contient des champs inconnus');
    for (let index = 0; index < value.length; index++) {
      if (!own(value, index)) invalid(`${path}[${index}]`, 'est manquant');
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !own(descriptor, 'value')) invalid(`${path}[${index}]`, 'doit être une valeur simple');
    }
  }

  function number(value, path, min, max, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
      invalid(path, `doit être un nombre ${integer ? 'entier ' : ''}compris entre ${min} et ${max}`);
    }
  }

  function choice(value, path, choices) {
    if (!choices.includes(value)) invalid(path, 'contient une valeur inconnue');
  }

  function boolean(value, path) {
    if (typeof value !== 'boolean') invalid(path, 'doit être un booléen');
  }

  function string(value, path, max) {
    if (typeof value !== 'string' || value.length > max) invalid(path, `doit être un texte de ${max} caractères maximum`);
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value)) result[key] = clone(value[key]);
      return result;
    }
    return value;
  }

  function validate(snapshot) {
    const E = engine();
    if (!E?.Game) throw new Error('Le moteur Colorquest doit être chargé avant les sauvegardes.');
    record(snapshot, 'snapshot', ['format', 'version', 'state']);
    if (snapshot.format !== FORMAT) throw new Error('Format de sauvegarde Colorquest non reconnu.');
    if (![1, 2, VERSION].includes(snapshot.version)) throw new Error('Version de sauvegarde incompatible.');
    const legacy = snapshot.version === 1, current = snapshot.version === VERSION;
    const state = snapshot.state, path = 'state', W = E.WIDTH, H = E.HEIGHT, cellCount = W * H;
    record(state, path, legacy ? LEGACY_STATE_KEYS : current ? STATE_KEYS : V2_STATE_KEYS);
    const campaign = current && state.mission !== null;
    if (campaign) {
      const p = `${path}.mission`, mission = state.mission;
      record(mission, p, ['id', 'stage', 'hold', 'trained', 'barracksTrained', 'nextRaid', 'raids']);
      string(mission.id, `${p}.id`, 32);
      if (!missions()?.get(mission.id)) invalid(`${p}.id`, 'désigne une mission inconnue');
      choice(state.mapId, `${path}.mapId`, ['mission:' + mission.id]);
      number(mission.stage, `${p}.stage`, 0, 2, true);
      number(mission.hold, `${p}.hold`, 0, 20);
      for (const key of ['trained', 'barracksTrained', 'raids']) number(mission[key], `${p}.${key}`, 0, MAX_ID, true);
      if (mission.barracksTrained > mission.trained) invalid(`${p}.barracksTrained`, 'dépasse le total des unités formées');
      number(mission.nextRaid, `${p}.nextRaid`, 0, MAX_TIME);
    } else if (!legacy) choice(state.mapId, `${path}.mapId`, MAP_IDS);
    const buildingTypes = Object.keys(E.BUILDING_STATS).filter(type => current || type !== 'barracks');
    choice(state.width, `${path}.width`, [W]);
    choice(state.height, `${path}.height`, [H]);
    choice(state.difficulty, `${path}.difficulty`, ['easy', 'normal']);
    number(state.seed, `${path}.seed`, 0, 4294967295, true);
    number(state.duration, `${path}.duration`, 1, MAX_TIME);
    number(state.time, `${path}.time`, 0, campaign ? MAX_TIME : state.duration + .101);
    choice(state.winner, `${path}.winner`, [null, 0, 1, 2]);
    string(state.winReason, `${path}.winReason`, 160);
    number(state._id, `${path}._id`, 1, MAX_ID, true);
    for (const key of ['_nextExpand', '_spread', '_ai', '_vision', '_capture']) number(state[key], `${path}.${key}`, 0, MAX_TIME);
    array(state._holdEvent, `${path}._holdEvent`, 3, 3);
    state._holdEvent.forEach((value, i) => boolean(value, `${path}._holdEvent[${i}]`));
    if (state._holdEvent[0]) invalid(`${path}._holdEvent[0]`, 'doit être false');
    for (const [key, maximum] of [['money', 1000000000], ['income', 1000000], ['scores', 1], ['hold', MAX_TIME]]) {
      array(state[key], `${path}.${key}`, 3, 3);
      state[key].forEach((value, i) => number(value, `${path}.${key}[${i}]`, 0, i === 0 ? 0 : maximum));
    }

    const team = (value, p) => choice(value, p, [1, 2]);
    const id = (value, p) => number(value, p, 1, state._id - 1, true);
    const position = (value, p, integer = false) => {
      number(value.x, `${p}.x`, 0, integer ? W - 1 : W, integer);
      number(value.y, `${p}.y`, 0, integer ? H - 1 : H, integer);
      if (value.x >= W || value.y >= H) invalid(p, 'est hors de la carte');
    };
    const point = (value, p, integer = false) => {
      record(value, p, ['x', 'y']);
      position(value, p, integer);
    };
    const tile = value => state.tiles[Math.floor(value.y) * W + Math.floor(value.x)];
    const ids = new Set();
    const register = (value, p) => {
      id(value, p);
      if (ids.has(value)) invalid(p, 'duplique un identifiant');
      ids.add(value);
    };

    array(state.tiles, `${path}.tiles`, cellCount, cellCount);
    state.tiles.forEach((cell, i) => {
      const p = `${path}.tiles[${i}]`;
      record(cell, p, legacy ? LEGACY_TILE_KEYS : TILE_KEYS, ['weakenedUntil']);
      choice(cell.x, `${p}.x`, [i % W]);
      choice(cell.y, `${p}.y`, [Math.floor(i / W)]);
      choice(cell.owner, `${p}.owner`, [0, 1, 2]);
      for (const key of ['connected', 'explored', 'visible', 'blocked', 'source']) boolean(cell[key], `${p}.${key}`);
      number(cell.isolation, `${p}.isolation`, 0, MAX_TIME, true);
      if (own(cell, 'weakenedUntil')) number(cell.weakenedUntil, `${p}.weakenedUntil`, 0, MAX_TIME + 14);
      if (cell.connected && (!cell.owner || cell.blocked)) invalid(p, 'connecte une case neutre ou bloquée');
      if (cell.visible && !cell.explored) invalid(p, 'rend visible une case non explorée');
      if (cell.blocked && cell.source) invalid(p, 'place une source sur une case bloquée');
      if (!legacy) {
        choice(cell.terrain, `${p}.terrain`, ['plain', 'absorbent', 'smooth']);
        for (const key of ['rich', 'aiVisible', 'aiExplored']) boolean(cell[key], `${p}.${key}`);
        choice(cell.cache, `${p}.cache`, [0, 60]);
        if (cell.rich && !cell.source) invalid(p, 'place une richesse hors d’une source');
        if (cell.cache && (cell.blocked || cell.source)) invalid(p, 'place une réserve sur une source ou une case bloquée');
        if (cell.aiVisible && !cell.aiExplored) invalid(p, 'rend visible pour l’IA une case non explorée');
      }
    });

    if (!legacy) {
      array(state.aiMemory, `${path}.aiMemory`, cellCount);
      const knownIds = new Set();
      state.aiMemory.forEach((memory, i) => {
        const p = `${path}.aiMemory[${i}]`;
        record(memory, p, ['id', 'type', 'x', 'y', 'seenAt']);
        id(memory.id, `${p}.id`);
        if (knownIds.has(memory.id)) invalid(`${p}.id`, 'duplique un souvenir');
        knownIds.add(memory.id);
        choice(memory.type, `${p}.type`, buildingTypes);
        position(memory, p, true);
        if (tile(memory).blocked) invalid(p, 'est sur une case bloquée');
        number(memory.seenAt, `${p}.seenAt`, 0, state.time);
        // A hidden building can have changed or disappeared since this sighting.
        // Do not validate memory against the current enemy state: it is stale by design.
      });
    }

    array(state.specializations, `${path}.specializations`, 3, 3);
    state.specializations.forEach((value, i) => choice(value, `${path}.specializations[${i}]`, i ? [null, ...Object.keys(E.SPECIALIZATIONS)] : [null]));
    array(state.rally, `${path}.rally`, 3, 3);
    state.rally.forEach((value, i) => {
      if (value === null) return;
      if (!i) invalid(`${path}.rally[0]`, 'doit être null');
      point(value, `${path}.rally[${i}]`, true);
      if (tile(value).blocked) invalid(`${path}.rally[${i}]`, 'est sur une case bloquée');
    });
    array(state.cooldowns, `${path}.cooldowns`, 3, 3);
    state.cooldowns.forEach((value, i) => {
      const p = `${path}.cooldowns[${i}]`;
      record(value, p, i ? ['impulse', 'bleach'] : []);
      if (i) {
        number(value.impulse, `${p}.impulse`, 0, 40);
        number(value.bleach, `${p}.bleach`, 0, 50);
      }
    });

    const cores = [0, 0, 0], buildings = new Map(), units = new Map(), populations = [0, 0, 0];
    array(state.buildings, `${path}.buildings`, cellCount);
    state.buildings.forEach((building, i) => {
      const p = `${path}.buildings[${i}]`;
      record(building, p, ['id', 'team', 'type', 'x', 'y', 'level', 'connected', 'age', 'attack', 'boostUntil', 'hp', 'maxHp'], current ? ['lastHit', 'queue', 'rally'] : ['lastHit']);
      register(building.id, `${p}.id`);
      team(building.team, `${p}.team`);
      choice(building.type, `${p}.type`, buildingTypes);
      position(building, p, true);
      if (tile(building).blocked) invalid(p, 'est sur une case bloquée');
      number(building.level, `${p}.level`, 1, building.type === 'barracks' ? 1 : 3, true);
      if (building.type === 'barracks') {
        if (!own(building, 'queue') || !own(building, 'rally')) invalid(p, 'doit conserver sa file et son point de ralliement');
        if (building.rally !== null) {
          point(building.rally, `${p}.rally`, true);
          if (tile(building.rally).blocked) invalid(`${p}.rally`, 'est sur une case bloquée');
        }
      } else if (own(building, 'queue') || own(building, 'rally')) invalid(p, 'réserve la file locale aux casernes');
      boolean(building.connected, `${p}.connected`);
      for (const key of ['age', 'attack', 'boostUntil']) number(building[key], `${p}.${key}`, 0, MAX_TIME + 12);
      number(building.maxHp, `${p}.maxHp`, 1, 10000);
      number(building.hp, `${p}.hp`, -10000, building.maxHp);
      if (own(building, 'lastHit')) number(building.lastHit, `${p}.lastHit`, -MAX_TIME, state.time);
      const expected = E.Game.prototype.getBuildingStats.call(Object.assign(Object.create(E.Game.prototype), state), building);
      if (building.maxHp !== expected.hp) invalid(`${p}.maxHp`, 'ne correspond pas au niveau et à la spécialisation');
      if (building.type === 'core') cores[building.team]++;
      buildings.set(building.id, building);
    });
    for (let t = 1; t <= 2; t++) {
      if (cores[t] > 1 || (state.winner === null && (!campaign || t === 1) && cores[t] !== 1)) invalid(`${path}.buildings`, `doit contenir un seul Cœur pour le camp ${t} en cours de partie`);
    }

    array(state.units, `${path}.units`, E.UNIT_LIMIT * 2);
    state.units.forEach((unit, i) => {
      const p = `${path}.units[${i}]`;
      record(unit, p, ['id', 'team', 'type', 'x', 'y', 'hp', 'maxHp', 'path', 'order', 'stance', 'attack', 'lastHit', 'retarget', 'repairTarget', 'repairTargetId']);
      register(unit.id, `${p}.id`);
      team(unit.team, `${p}.team`);
      choice(unit.type, `${p}.type`, Object.keys(E.UNIT_STATS));
      position(unit, p);
      if (tile(unit).blocked) invalid(p, 'est sur une case bloquée');
      number(unit.maxHp, `${p}.maxHp`, 1, 10000);
      number(unit.hp, `${p}.hp`, -10000, unit.maxHp);
      if (unit.maxHp !== E.UNIT_STATS[unit.type].hp) invalid(`${p}.maxHp`, 'ne correspond pas au type d’unité');
      choice(unit.stance, `${p}.stance`, STANCES);
      number(unit.attack, `${p}.attack`, 0, MAX_TIME);
      number(unit.lastHit, `${p}.lastHit`, -MAX_TIME, state.time);
      number(unit.retarget, `${p}.retarget`, -MAX_TIME, MAX_TIME);
      for (const key of ['repairTarget', 'repairTargetId']) if (unit[key] !== null) id(unit[key], `${p}.${key}`);
      if (unit.repairTarget !== unit.repairTargetId) invalid(p, 'possède deux cibles de réparation différentes');
      const target = buildings.get(unit.repairTarget);
      // A repair target may just have been destroyed during the saved tick.
      if (target && target.team !== unit.team) invalid(`${p}.repairTarget`, 'désigne un bâtiment adverse');
      if (unit.order !== null) {
        record(unit.order, `${p}.order`, ['x', 'y', 'stance']);
        position(unit.order, `${p}.order`);
        choice(unit.order.stance, `${p}.order.stance`, STANCES);
        if (unit.order.stance !== unit.stance) invalid(`${p}.order`, 'ne correspond pas à la posture de l’unité');
      }
      array(unit.path, `${p}.path`, cellCount);
      unit.path.forEach((step, j) => {
        const pp = `${p}.path[${j}]`;
        point(step, pp);
        if (step.x % 1 !== .5 || step.y % 1 !== .5 || tile(step).blocked) invalid(pp, 'doit désigner le centre d’une case accessible');
        if (j && Math.abs(step.x - unit.path[j - 1].x) + Math.abs(step.y - unit.path[j - 1].y) !== 1) invalid(pp, 'ne rejoint pas la case précédente');
      });
      if (unit.hp > 0) populations[unit.team]++;
      units.set(unit.id, unit);
    });

    const reserved = [0, 0, 0];
    const validateQueue = (queue, t, p) => {
      array(queue, p, t ? E.QUEUE_LIMIT : 0);
      reserved[t] += queue.length;
      if (populations[t] + reserved[t] > E.UNIT_LIMIT) invalid(p, 'dépasse la population autorisée');
      queue.forEach((job, i) => {
        const jp = `${p}[${i}]`;
        record(job, jp, ['id', 'unitId', 'type', 'cost', 'duration', 'remaining', 'started']);
        register(job.id, `${jp}.id`);
        register(job.unitId, `${jp}.unitId`);
        choice(job.type, `${jp}.type`, Object.keys(E.UNIT_STATS));
        number(job.cost, `${jp}.cost`, 0, 10000, true);
        if (job.cost !== E.COSTS[job.type]) invalid(`${jp}.cost`, 'ne correspond pas au coût du recrutement');
        number(job.duration, `${jp}.duration`, .1, 60);
        number(job.remaining, `${jp}.remaining`, 0, job.duration);
        boolean(job.started, `${jp}.started`);
        if (job.started !== (i === 0)) invalid(`${jp}.started`, 'ne correspond pas à la place dans la file');
        if (i && job.remaining !== job.duration) invalid(`${jp}.remaining`, 'a avancé alors que la formation attend');
      });
    };
    array(state.queues, `${path}.queues`, 3, 3);
    state.queues.forEach((queue, t) => validateQueue(queue, t, `${path}.queues[${t}]`));
    state.buildings.forEach((building, i) => {
      if (building.type === 'barracks') validateQueue(building.queue, building.team, `${path}.buildings[${i}].queue`);
    });

    array(state.squads, `${path}.squads`, 3, 3);
    state.squads.forEach((slots, t) => {
      const p = `${path}.squads[${t}]`;
      array(slots, p, t ? 3 : 0, t ? 3 : 0);
      slots.forEach((squad, i) => {
        const sp = `${p}[${i}]`, seen = new Set();
        array(squad, sp, E.UNIT_LIMIT);
        squad.forEach((value, j) => {
          id(value, `${sp}[${j}]`);
          if (seen.has(value)) invalid(sp, 'contient une unité en double');
          const unit = units.get(value);
          if (!unit || unit.team !== t || unit.hp <= 0) invalid(`${sp}[${j}]`, 'ne désigne pas une unité vivante de ce camp');
          seen.add(value);
        });
      });
    });

    array(state.events, `${path}.events`, 80);
    state.events.forEach((event, i) => {
      const p = `${path}.events[${i}]`;
      record(event, p, ['type', 'text', 'message', 'x', 'y', 'team', 'time'], ['target']);
      string(event.type, `${p}.type`, 32);
      string(event.text, `${p}.text`, 300);
      string(event.message, `${p}.message`, 300);
      position(event, p);
      team(event.team, `${p}.team`);
      number(event.time, `${p}.time`, 0, state.time);
      if (own(event, 'target')) point(event.target, `${p}.target`);
    });
    return state;
  }

  function capture(game) {
    const E = engine();
    if (!E?.Game || !(game instanceof E.Game)) throw new Error('Aucune partie Colorquest à sauvegarder.');
    const state = {};
    for (const key of STATE_KEYS) state[key] = game[key];
    const snapshot = { format: FORMAT, version: VERSION, state };
    validate(snapshot);
    return clone(snapshot);
  }

  function restore(snapshot) {
    const state = validate(snapshot);
    const game = Object.create(engine().Game.prototype);
    Object.assign(game, clone(state));
    if (snapshot.version === 1) migrateV1(game);
    if (snapshot.version < 3) game.mission = null;
    return game;
  }

  function migrateV1(game) {
    // Deliberately use only data from the validated old snapshot. Calling the
    // current constructor/visibility/update helpers would rewrite old state.
    const E = engine();
    game.mapId = 'legacy';
    const viewers = [
      ...game.buildings.filter(b => b.team === 2 && b.hp > 0).map(b => ({ x: b.x + .5, y: b.y + .5, radius: b.type === 'core' ? 9 : 7 })),
      ...game.units.filter(u => u.team === 2 && u.hp > 0).map(u => ({ x: u.x, y: u.y, radius: E.UNIT_STATS[u.type].vision }))
    ];
    for (const cell of game.tiles) {
      cell.terrain = 'plain';
      cell.rich = false;
      cell.cache = 0;
      cell.aiVisible = (cell.owner === 2 && cell.connected) || viewers.some(v => Math.hypot(cell.x + .5 - v.x, cell.y + .5 - v.y) <= v.radius);
      cell.aiExplored = cell.aiVisible;
    }
    game.aiMemory = game.buildings.filter(b => b.team === 1 && b.hp > 0 && game.tiles[b.y * game.width + b.x].aiVisible)
      .map(b => ({ id: b.id, type: b.type, x: b.x, y: b.y, seenAt: game.time }));
  }

  const api = Object.freeze({ FORMAT, VERSION, capture, restore });
  root.CQSnapshot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
