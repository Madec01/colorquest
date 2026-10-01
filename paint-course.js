/* Colorquest V0.8: three encounters, one reward per victory, exact local resume.
 * This module owns no DOM or storage. The UI chooses when to persist serialize(),
 * preserves rejected data, and resumes paused. No wall-clock time is simulated.
 */
(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./paint-engine.js') : root.CQPaintEngine,
    node ? require('./paint-ai.js') : root.CQPaintAI);
  if (node) module.exports = api;
  else root.CQPaintCourse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine, AI) {
  'use strict';

  const FORMAT = 'colorquest-paint-course', VERSION = 1;
  const STORAGE_KEY = 'colorquest.paint.course.v1', MAX_SAVE_BYTES = 1000000;
  const MAX_ID = 1000000, EPSILON = 1e-7;
  const BASE_DECK = Object.freeze(['relay', 'barracks', 'extractor', 'splash', 'bastion', 'wave', 'bleach', 'barracks']);
  const ENCOUNTERS = Object.freeze([
    Object.freeze({ id: 'first-stroke', name: 'La toile ouverte', opponent: 'L’Esquisse', mapId: 'canvas', profile: 'rapid',
      description: 'L’Esquisse étend vite sa couleur. Trois duels vous séparent du tableau final.',
      tip: 'Prenez une source, puis protégez vos traits avec une caserne.', mixtures: false }),
    Object.freeze({ id: 'narrow-passage', name: 'Les passages', opponent: 'L’Architecte', mapId: 'narrows', profile: 'builder',
      description: 'L’Architecte installe ses défenses autour des passages. Votre première récompense entre en jeu.',
      tip: 'Nouveau mélange : bleu + jaune à 2 cases ou moins, en 4 s, soigne vos gouttes proches de 12 PV. Chaque carte garde son coût.', mixtures: true }),
    Object.freeze({ id: 'final-crossroads', name: 'Le tableau final', opponent: 'L’Effaceur', mapId: 'crossroads', profile: 'eraser',
      description: 'L’Effaceur coupe vos réseaux et dispose d’un mortier. Choisissez les fronts à défendre.',
      tip: 'Le mortier frappe une zone après un délai : bougez vos gouttes et contournez les défenses. Bleu + jaune peut toujours les soigner.', mixtures: true })
  ]);
  const REWARDS = Object.freeze({
    mortar: Object.freeze({ id: 'mortar', type: 'card', name: 'Mortier de peinture', icon: '◎',
      description: 'Remplace la deuxième caserne du paquet. Bombarde une zone lointaine ; faible au contact. Vous gardez une caserne.' }),
    'long-brush': Object.freeze({ id: 'long-brush', type: 'varnish', name: 'Pinceau ample', icon: '↗',
      description: 'Vernis : jusqu’à 3 cases de plus par trait. Chaque case coûte toujours 1 pigment et doit être visible.' }),
    'swift-stream': Object.freeze({ id: 'swift-stream', type: 'varnish', name: 'Courant vif', icon: '»',
      description: 'Vernis : vos gouttes se déplacent 15 % plus vite sur votre territoire relié au Cœur.' }),
    'hard-coat': Object.freeze({ id: 'hard-coat', type: 'varnish', name: 'Couche protectrice', icon: '⬡',
      description: 'Vernis : vos bâtiments ont 20 % de PV en plus, y compris les améliorations du Cœur.' }),
    'barracks-discount': Object.freeze({ id: 'barracks-discount', type: 'upgrade', name: 'Caserne préparée', icon: '▥',
      description: 'Amélioration : poser une caserne coûte 26 pigments au lieu de 32. Chaque goutte coûte toujours 6 pigments.' }),
    'splash-discount': Object.freeze({ id: 'splash-discount', type: 'upgrade', name: 'Éclaboussure précise', icon: '✦',
      description: 'Amélioration : l’Éclaboussure coûte 12 pigments au lieu de 16. Ses dégâts restent identiques.' })
  });
  const PHASES = ['briefing', 'combat', 'reward', 'draw', 'won', 'lost'];
  const GAME_KEYS = [
    'width', 'height', 'seed', 'mapId', 'modifiers', 'mixtures', 'time', 'duration', 'overtime', 'overtimeDuration',
    'winner', 'winReason', 'accelerated', 'pigment', 'income', 'scores', 'hold', 'buildings', 'units', 'hands', 'decks',
    'spendingHeld', '_id', '_eventId', '_accumulator', '_productionCursor', '_unitSequence', '_holdActive',
    'tiles', 'visibility', 'explored', 'shells', '_mixtureLast'
  ];
  const BUILDING_KEYS = ['id', 'team', 'type', 'x', 'y', 'hp', 'maxHp', 'connected', 'level',
    'productionPaused', 'productionProgress', 'productionState', 'productionReason', 'flow', 'flowMode', 'attackCooldown', 'mortarTarget'];
  const UNIT_KEYS = ['id', 'ordinal', 'team', 'type', 'producerId', 'x', 'y', 'hp', 'maxHp', 'target', 'retreating', 'attackCooldown', 'path', 'pathTarget'];
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function invalid(path, reason) { throw new Error('Sauvegarde de course invalide : ' + path + ' ' + reason + '.'); }
  function record(value, path, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'doit être un objet');
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) invalid(path, 'possède un prototype non pris en charge');
    const names = Object.getOwnPropertyNames(value);
    if (Object.getOwnPropertySymbols(value).length || names.length !== keys.length) invalid(path, 'contient des champs inconnus ou manquants');
    for (const key of names) {
      if (!keys.includes(key)) invalid(path + '.' + key, 'est inconnu');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !own(descriptor, 'value')) invalid(path + '.' + key, 'doit être une valeur simple');
    }
    for (const key of keys) if (!own(value, key)) invalid(path + '.' + key, 'est manquant');
  }
  function array(value, path, max, exact) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max ||
        (exact !== undefined && value.length !== exact)) invalid(path, 'possède une taille ou un type incorrect');
    if (Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== value.length + 1) invalid(path, 'contient des champs inconnus');
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !own(descriptor, 'value')) invalid(path + '[' + index + ']', 'doit être une valeur simple');
    }
  }
  function number(value, path, min, max, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) invalid(path, 'est hors des limites autorisées');
  }
  function choice(value, path, choices) { if (!choices.includes(value)) invalid(path, 'est inconnu'); }
  function boolean(value, path) { if (typeof value !== 'boolean') invalid(path, 'doit être un booléen'); }
  function string(value, path, max) { if (typeof value !== 'string' || value.length > max) invalid(path, 'est un texte trop long ou invalide'); }
  function equal(value, expected, path) { if (JSON.stringify(value) !== JSON.stringify(expected)) invalid(path, 'ne correspond pas à la progression'); }
  function near(value, expected, path) { if (Math.abs(value - expected) > EPSILON) invalid(path, 'ne correspond pas au plateau'); }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value)) result[key] = clone(value[key]);
      return result;
    }
    return value;
  }
  function utf8Length(text) {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 128) bytes++;
      else if (code < 2048) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
      else bytes += 3;
      if (bytes > MAX_SAVE_BYTES) break;
    }
    return bytes;
  }
  function mix(seed, salt) {
    let value = (seed ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  }
  function random(seed) {
    let value = seed >>> 0;
    return () => { value = (Math.imul(1664525, value) + 1013904223) >>> 0; return value / 4294967296; };
  }
  function loadout(chosen) {
    const deck = BASE_DECK.slice();
    const modifiers = { brushBonus: 0, reinforcementSpeed: 0, buildingHealth: 0, cardDiscounts: { barracks: 0, splash: 0 } };
    for (const id of chosen) {
      if (id === 'mortar') deck[7] = 'mortar';
      if (id === 'long-brush') modifiers.brushBonus = 3;
      if (id === 'swift-stream') modifiers.reinforcementSpeed = .15;
      if (id === 'hard-coat') modifiers.buildingHealth = .2;
      if (id === 'barracks-discount') modifiers.cardDiscounts.barracks = 6;
      if (id === 'splash-discount') modifiers.cardDiscounts.splash = 4;
    }
    return { deck, modifiers };
  }
  function offerIds(seed, index, chosen) {
    const roll = random(mix(seed, 200 + index));
    if (index === 0) {
      const varnish = ['long-brush', 'swift-stream', 'hard-coat'];
      const upgrades = ['barracks-discount', 'splash-discount'];
      return ['mortar', varnish[Math.floor(roll() * varnish.length)], upgrades[Math.floor(roll() * upgrades.length)]];
    }
    const eligible = Object.keys(REWARDS).filter(id => !chosen.includes(id));
    for (let i = eligible.length - 1; i > 0; i--) { const j = Math.floor(roll() * (i + 1)); [eligible[i], eligible[j]] = [eligible[j], eligible[i]]; }
    return eligible.slice(0, 3);
  }
  function opponentDeck(index) { const deck = BASE_DECK.slice(); if (index === 2) deck[7] = 'mortar'; return deck; }

  class Run {
    constructor(options = {}) {
      this.seed = (Number.isFinite(options.seed) ? options.seed : Date.now()) >>> 0;
      this.encounterIndex = 0;
      this.phase = 'briefing';
      this.chosenRewards = [];
      this._offerIds = [];
      this.draws = 0;
      this.game = null;
      this.view = { camera: null, selectedProducer: null };
    }
    get encounter() { return ENCOUNTERS[this.encounterIndex]; }
    get deck() { return loadout(this.chosenRewards).deck; }
    get modifiers() { return loadout(this.chosenRewards).modifiers; }
    get offers() { return this._offerIds.map(id => REWARDS[id]); }
    get aiState() { return this.game ? AI.snapshot(this.game, 2) : null; }
    startFight() {
      if (!['briefing', 'draw'].includes(this.phase)) throw new Error('Ce combat est déjà lancé ou la course est terminée.');
      const equipment = loadout(this.chosenRewards), encounter = this.encounter;
      this.game = new Engine.Game({ seed: mix(this.seed, this.encounterIndex), mapId: encounter.mapId,
        decks: [[], equipment.deck, opponentDeck(this.encounterIndex)], modifiers: [null, equipment.modifiers, loadout([]).modifiers], mixtures: encounter.mixtures });
      AI.configure(this.game, 2, { profile: encounter.profile });
      this.phase = 'combat';
      this._offerIds = [];
      this.view = { camera: null, selectedProducer: null };
      return this.game;
    }
    update(dt) {
      if (this.phase !== 'combat' || !this.game) return this.phase;
      if (Number.isFinite(dt) && dt > 0) {
        // The same small slices keep AI decisions independent of display frame
        // rate. Time spent outside the tab is never added by the course.
        let remaining = Math.min(dt, .25);
        while (remaining > EPSILON && this.game.winner === null) {
          const step = Math.min(Engine.CONFIG.step, remaining);
          this.game.update(step);
          AI.update(this.game, step, 2);
          remaining -= step;
        }
      }
      this._resolve();
      return this.phase;
    }
    _resolve() {
      if (this.phase !== 'combat' || !this.game || this.game.winner === null) return;
      this.game.setSpendingHeld(1, false);
      if (this.game.winner === 1) {
        if (this.encounterIndex === ENCOUNTERS.length - 1) this.phase = 'won';
        else { this.phase = 'reward'; this._offerIds = offerIds(this.seed, this.encounterIndex, this.chosenRewards); }
      } else if (this.game.winner === 2) this.phase = 'lost';
      else { this.phase = 'draw'; this.draws++; }
    }
    chooseReward(id) {
      if (this.phase !== 'reward' || !this._offerIds.includes(id) || this.chosenRewards.includes(id)) return { ok: false, message: 'Choisissez l’une des trois récompenses proposées.' };
      this.chosenRewards.push(id);
      this.encounterIndex++;
      this.phase = 'briefing';
      this._offerIds = [];
      this.game = null;
      this.view = { camera: null, selectedProducer: null };
      return { ok: true, message: REWARDS[id].name + ' rejoint votre course.', reward: REWARDS[id] };
    }
    presentation() {
      return { phase: this.phase, encounterIndex: this.encounterIndex, total: ENCOUNTERS.length, encounter: this.encounter,
        offers: this.offers, chosenRewards: this.chosenRewards.map(id => REWARDS[id]), deck: this.deck, modifiers: this.modifiers,
        wins: this.encounterIndex + (this.phase === 'reward' || this.phase === 'won' ? 1 : 0), draws: this.draws };
    }
    snapshot() { return snapshot(this); }
    serialize() { return serialize(this); }
  }

  function validateAI(value, game, encounter) {
    record(value, 'ai', ['version', 'team', 'profile', 'state']);
    choice(value.version, 'ai.version', [1]); choice(value.team, 'ai.team', [2]); choice(value.profile, 'ai.profile', [encounter.profile]);
    const s = value.state;
    record(s, 'ai.state', ['nextThink', 'lastTime', 'lastBrush', 'lastCard', 'lastFlow', 'observations', 'orders', 'pausedByAI']);
    number(s.nextThink, 'ai.nextThink', 0, game.time + 1);
    number(s.lastTime, 'ai.lastTime', 0, game.time + EPSILON);
    for (const key of ['lastBrush', 'lastCard', 'lastFlow']) number(s[key], 'ai.' + key, -100, game.time + EPSILON);
    const ids = new Set();
    array(s.observations, 'ai.observations', game.tiles.length);
    for (const pair of s.observations) {
      array(pair, 'ai.observation', 2, 2); number(pair[0], 'ai.observation.id', 1, game._id - 1, true);
      if (ids.has(pair[0])) invalid('ai.observations', 'duplique un identifiant'); ids.add(pair[0]);
      record(pair[1], 'ai.observation.value', ['id', 'x', 'y', 'type', 'seenAt']);
      choice(pair[1].id, 'ai.observation.value.id', [pair[0]]);
      choice(pair[1].type, 'ai.observation.type', Object.keys(Engine.BUILDING_STATS));
      point(pair[1], 'ai.observation.position', game, true, false);
      number(pair[1].seenAt, 'ai.observation.seenAt', 0, game.time + EPSILON);
      // Memories deliberately need not match hidden buildings that moved or died.
    }
    ids.clear(); array(s.orders, 'ai.orders', game.tiles.length);
    for (const pair of s.orders) {
      array(pair, 'ai.order', 2, 2); number(pair[0], 'ai.order.id', 1, game._id - 1, true);
      if (ids.has(pair[0])) invalid('ai.orders', 'duplique un identifiant'); ids.add(pair[0]);
      point(pair[1], 'ai.order.target', game, true);
    }
    ids.clear(); array(s.pausedByAI, 'ai.pausedByAI', game.tiles.length);
    for (const id of s.pausedByAI) {
      number(id, 'ai.pausedByAI.id', 1, game._id - 1, true);
      if (ids.has(id)) invalid('ai.pausedByAI', 'duplique un identifiant'); ids.add(id);
    }
  }
  function point(value, path, game, integer, exact = true, allowBlocked = false) {
    if (exact) record(value, path, ['x', 'y']);
    number(value.x, path + '.x', 0, game.width - (integer ? 1 : Number.EPSILON), integer);
    number(value.y, path + '.y', 0, game.height - (integer ? 1 : Number.EPSILON), integer);
    if (value.x >= game.width || value.y >= game.height) invalid(path, 'sort de la toile');
    const tile = game.tiles[Math.floor(value.y) * game.width + Math.floor(value.x)];
    if (tile?.blocked && !allowBlocked) invalid(path, 'vise un obstacle');
  }
  function optionalPoint(value, path, game, integer = true) { if (value !== null) point(value, path, game, integer); }
  function validateModifiers(modifiers, expected, path) {
    array(modifiers, path, 3, 3); choice(modifiers[0], path + '[0]', [null]);
    for (let team = 1; team <= 2; team++) {
      const p = path + '[' + team + ']', value = modifiers[team];
      record(value, p, ['brushBonus', 'reinforcementSpeed', 'buildingHealth', 'cardDiscounts']);
      number(value.brushBonus, p + '.brushBonus', 0, 3, true);
      number(value.reinforcementSpeed, p + '.reinforcementSpeed', 0, .15);
      number(value.buildingHealth, p + '.buildingHealth', 0, .2);
      record(value.cardDiscounts, p + '.cardDiscounts', ['barracks', 'splash']);
      number(value.cardDiscounts.barracks, p + '.cardDiscounts.barracks', 0, 6, true);
      number(value.cardDiscounts.splash, p + '.cardDiscounts.splash', 0, 4, true);
      equal(value, team === 1 ? expected : loadout([]).modifiers, p);
    }
  }
  function validateGame(s, envelope) {
    record(s, 'game', GAME_KEYS);
    const encounter = ENCOUNTERS[envelope.encounterIndex], expected = loadout(envelope.chosenRewards);
    const W = Engine.CONFIG.width, H = Engine.CONFIG.height, N = W * H;
    choice(s.width, 'game.width', [W]); choice(s.height, 'game.height', [H]);
    choice(s.seed, 'game.seed', [mix(envelope.seed, envelope.encounterIndex)]);
    choice(s.mapId, 'game.mapId', [encounter.mapId]); choice(s.mixtures, 'game.mixtures', [encounter.mixtures]);
    validateModifiers(s.modifiers, expected.modifiers, 'game.modifiers');
    choice(s.duration, 'game.duration', [Engine.CONFIG.duration]); choice(s.overtimeDuration, 'game.overtimeDuration', [Engine.CONFIG.overtimeDuration]);
    boolean(s.overtime, 'game.overtime'); number(s.time, 'game.time', 0, s.duration + (s.overtime ? s.overtimeDuration : 0));
    if (s.overtime && s.time + EPSILON < s.duration) invalid('game.overtime', 'commence avant la fin du temps normal');
    choice(s.winner, 'game.winner', [null, 0, 1, 2]); string(s.winReason, 'game.winReason', 160);
    if ((s.winner === null) !== (s.winReason === '')) invalid('game.winReason', 'ne correspond pas au résultat');
    boolean(s.accelerated, 'game.accelerated');
    if (s.accelerated !== (s.time + EPSILON >= s.duration - 60)) invalid('game.accelerated', 'ne correspond pas au temps de jeu');
    number(s._id, 'game._id', 3, MAX_ID, true); number(s._eventId, 'game._eventId', 1, MAX_ID, true);
    number(s._accumulator, 'game._accumulator', -EPSILON, Engine.CONFIG.step + EPSILON);
    if (s.winner !== null && s._accumulator !== 0) invalid('game._accumulator', 'doit être nul après la fin du combat');
    for (const [key, maximum] of [['pigment', Engine.CONFIG.pigmentCap], ['income', 20], ['scores', 1], ['hold', Engine.CONFIG.holdDuration], ['_productionCursor', N], ['_unitSequence', MAX_ID]]) {
      array(s[key], 'game.' + key, 3, 3);
      s[key].forEach((value, team) => number(value, 'game.' + key + '[' + team + ']', 0, team ? maximum : 0, key[0] === '_'));
    }
    for (const key of ['spendingHeld', '_holdActive']) {
      array(s[key], 'game.' + key, 3, 3);
      s[key].forEach((value, team) => { boolean(value, 'game.' + key + '[' + team + ']'); if (!team && value) invalid('game.' + key, 'active un camp neutre'); });
    }
    if (s.spendingHeld.some(Boolean)) invalid('game.spendingHeld', 'ne peut reprendre un geste interrompu');
    const geometry = Engine.MAPS[s.mapId];
    const blocked = new Set(geometry.blocked.map(([x, y]) => y * W + x)), sources = new Set(geometry.sources.map(([x, y]) => y * W + x));
    array(s.tiles, 'game.tiles', N, N);
    s.tiles.forEach((tile, index) => {
      const p = 'game.tiles[' + index + ']';
      record(tile, p, ['x', 'y', 'owner', 'blocked', 'source', 'connected', 'lastSeenOwner']);
      choice(tile.x, p + '.x', [index % W]); choice(tile.y, p + '.y', [Math.floor(index / W)]);
      choice(tile.owner, p + '.owner', [0, 1, 2]); choice(tile.blocked, p + '.blocked', [blocked.has(index)]); choice(tile.source, p + '.source', [sources.has(index)]);
      boolean(tile.connected, p + '.connected');
      if (tile.blocked && (tile.owner || tile.connected) || !tile.owner && tile.connected) invalid(p, 'possède une couleur ou une connexion impossible');
      array(tile.lastSeenOwner, p + '.lastSeenOwner', 3, 3);
      tile.lastSeenOwner.forEach((owner, team) => choice(owner, p + '.lastSeenOwner[' + team + ']', team ? [0, 1, 2] : [0]));
    });
    for (const key of ['visibility', 'explored']) {
      array(s[key], 'game.' + key, 3, 3); array(s[key][0], 'game.' + key + '[0]', 0, 0);
      for (let team = 1; team <= 2; team++) { array(s[key][team], 'game.' + key + '[' + team + ']', N, N); s[key][team].forEach((v, i) => boolean(v, 'game.' + key + '[' + team + '][' + i + ']')); }
    }
    for (let team = 1; team <= 2; team++) for (let index = 0; index < N; index++) {
      if (s.visibility[team][index] && !s.explored[team][index]) invalid('game.explored', 'oublie une case visible');
      if (s.visibility[team][index] && s.tiles[index].lastSeenOwner[team] !== s.tiles[index].owner) invalid('game.tiles.lastSeenOwner', 'ne correspond pas à une case visible');
      if (!s.explored[team][index] && s.tiles[index].lastSeenOwner[team] !== 0) invalid('game.tiles.lastSeenOwner', 'mémorise une case jamais explorée');
    }
    for (const key of ['hands', 'decks']) {
      array(s[key], 'game.' + key, 3, 3); array(s[key][0], 'game.' + key + '[0]', 0, 0);
      for (let team = 1; team <= 2; team++) { array(s[key][team], 'game.' + key + '[' + team + ']', 4, 4); for (const id of s[key][team]) choice(id, 'game.' + key + '.card', Object.keys(Engine.CARDS)); }
    }
    for (let team = 1; team <= 2; team++) equal(s.hands[team].concat(s.decks[team]).sort(), (team === 1 ? expected.deck : opponentDeck(envelope.encounterIndex)).slice().sort(), 'game.deck[' + team + ']');
    const ids = new Set(), occupied = new Set(), buildings = new Map(), cores = [0, 0, 0], populations = [0, 0, 0], ordinals = [null, new Set(), new Set()];
    function register(id, path) { number(id, path, 1, s._id - 1, true); if (ids.has(id)) invalid(path, 'duplique un identifiant'); ids.add(id); }
    array(s.buildings, 'game.buildings', N);
    for (const b of s.buildings) {
      const p = 'game.buildings#' + b.id; record(b, p, BUILDING_KEYS); register(b.id, p + '.id');
      choice(b.team, p + '.team', [1, 2]); choice(b.type, p + '.type', Object.keys(Engine.BUILDING_STATS)); point(b, p, s, true, false);
      const index = b.y * W + b.x;
      if (occupied.has(index)) invalid(p, 'partage sa case avec un autre bâtiment'); occupied.add(index);
      if (s.tiles[index].owner !== b.team) invalid(p, 'n’est pas sur sa couleur');
      if ((b.type === 'extractor') !== s.tiles[index].source) invalid(p, 'occupe une source avec le mauvais bâtiment');
      number(b.level, p + '.level', 1, b.type === 'core' ? 3 : 1, true);
      const stats = Engine.BUILDING_STATS[b.type];
      const maxHp = (stats.hp + (b.type === 'core' ? 80 * (b.level - 1) : 0)) * (1 + s.modifiers[b.team].buildingHealth);
      number(b.maxHp, p + '.maxHp', maxHp, maxHp); number(b.hp, p + '.hp', Number.MIN_VALUE, maxHp);
      boolean(b.connected, p + '.connected'); boolean(b.productionPaused, p + '.productionPaused');
      number(b.productionProgress, p + '.productionProgress', 0, Engine.CONFIG.unitInterval);
      choice(b.productionState, p + '.productionState', ['none', 'running', 'paused', 'isolated', 'held', 'full', 'funds', 'blocked']);
      string(b.productionReason, p + '.productionReason', 80);
      if (b.type !== 'barracks' && (b.productionPaused || b.productionProgress || b.productionState !== 'none' || b.productionReason !== '')) invalid(p, 'produit des gouttes sans caserne');
      optionalPoint(b.flow, p + '.flow', s); choice(b.flowMode, p + '.flowMode', ['attack', 'defend']);
      if (!['core', 'barracks'].includes(b.type) && (b.flow !== null || b.flowMode !== 'attack')) invalid(p, 'commande un groupe sans être producteur');
      if (b.flowMode === 'defend' && (!b.flow || b.flow.x !== b.x || b.flow.y !== b.y)) invalid(p + '.flow', 'défend un autre emplacement');
      number(b.attackCooldown, p + '.attackCooldown', 0, stats.interval || 0);
      if (b.mortarTarget !== null) point(b.mortarTarget, p + '.mortarTarget', s, true, true, true);
      if (b.type !== 'mortar' && b.mortarTarget !== null) invalid(p, 'vise au mortier avec un autre bâtiment');
      if (b.type === 'core') { cores[b.team]++; equal({ x: b.x, y: b.y }, Engine.CONFIG.coreStarts[b.team], p + '.position'); }
      buildings.set(b.id, b);
    }
    array(s.units, 'game.units', 2 * Engine.CONFIG.unitLimit);
    for (const u of s.units) {
      const p = 'game.units#' + u.id; record(u, p, UNIT_KEYS); register(u.id, p + '.id');
      choice(u.team, p + '.team', [1, 2]); choice(u.type, p + '.type', ['droplet']); point(u, p, s, false, false);
      number(u.ordinal, p + '.ordinal', 1, s._unitSequence[u.team], true);
      if (ordinals[u.team].has(u.ordinal)) invalid(p + '.ordinal', 'duplique une goutte'); ordinals[u.team].add(u.ordinal);
      populations[u.team]++; number(u.maxHp, p + '.maxHp', Engine.UNIT_STATS.hp, Engine.UNIT_STATS.hp); number(u.hp, p + '.hp', Number.MIN_VALUE, u.maxHp);
      number(u.producerId, p + '.producerId', 1, s._id - 1, true);
      const producer = buildings.get(u.producerId);
      if (producer && (producer.team !== u.team || !['core', 'barracks'].includes(producer.type)) || !producer && cores[u.team]) invalid(p + '.producerId', 'ne correspond pas à un producteur allié');
      optionalPoint(u.target, p + '.target', s); optionalPoint(u.pathTarget, p + '.pathTarget', s);
      boolean(u.retreating, p + '.retreating');
      if (u.retreating && u.target === null) invalid(p, 'bat en retraite sans destination');
      number(u.attackCooldown, p + '.attackCooldown', 0, Engine.UNIT_STATS.interval);
      array(u.path, p + '.path', N);
      for (let i = 0; i < u.path.length; i++) {
        const step = u.path[i]; point(step, p + '.path[' + i + ']', s, false);
        if (step.x % 1 !== .5 || step.y % 1 !== .5) invalid(p + '.path', 'ne suit pas les centres des cases');
        if (i && Math.abs(step.x - u.path[i - 1].x) + Math.abs(step.y - u.path[i - 1].y) !== 1) invalid(p + '.path', 'saute une case');
      }
      if (u.path.length && (!u.pathTarget || Math.floor(u.path[u.path.length - 1].x) !== u.pathTarget.x || Math.floor(u.path[u.path.length - 1].y) !== u.pathTarget.y)) invalid(p + '.pathTarget', 'ne correspond pas au trajet');
    }
    for (let team = 1; team <= 2; team++) { if (populations[team] > Engine.CONFIG.unitLimit || cores[team] > 1) invalid('game.population', 'dépasse une limite du camp'); }
    array(s.shells, 'game.shells', N);
    for (const shell of s.shells) {
      const p = 'game.shells#' + shell.id;
      record(shell, p, ['id', 'team', 'sourceId', 'fromX', 'fromY', 'x', 'y', 'remaining', 'total', 'radius']); register(shell.id, p + '.id');
      choice(shell.team, p + '.team', [1, 2]); number(shell.sourceId, p + '.sourceId', 1, s._id - 1, true);
      point(shell, p, s, false, false, true); point({ x: shell.fromX, y: shell.fromY }, p + '.from', s, false);
      choice(shell.total, p + '.total', [1.2]); choice(shell.radius, p + '.radius', [1.5]); number(shell.remaining, p + '.remaining', Number.MIN_VALUE, shell.total);
      const source = buildings.get(shell.sourceId);
      if (source && (source.type !== 'mortar' || source.team !== shell.team)) invalid(p + '.sourceId', 'ne correspond pas à un mortier allié');
    }
    array(s._mixtureLast, 'game._mixtureLast', 3, 3); choice(s._mixtureLast[0], 'game._mixtureLast[0]', [null]);
    for (let team = 1; team <= 2; team++) if (s._mixtureLast[team] !== null) {
      const m = s._mixtureLast[team], p = 'game._mixtureLast[' + team + ']'; record(m, p, ['color', 'x', 'y', 'time']);
      if (!s.mixtures) invalid(p, 'prépare un mélange avant son déblocage'); choice(m.color, p + '.color', ['blue', 'yellow']); point(m, p, s, true, false); number(m.time, p + '.time', 0, s.time + EPSILON);
    }
    // Validate derived values on a detached clone. The restored game itself is
    // never constructed or advanced; its next tick retains paths and counters.
    const check = Object.assign(Object.create(Engine.Game.prototype), clone(s), { events: [] });
    check.recompute();
    for (let team = 1; team <= 2; team++) { near(s.scores[team], check.scores[team], 'game.scores'); near(s.income[team], check.income[team], 'game.income'); }
    s.tiles.forEach((tile, index) => { if (tile.connected !== check.tiles[index].connected) invalid('game.tiles.connected', 'ne correspond pas au réseau'); });
    s.buildings.forEach((b, index) => { if (b.connected !== check.buildings[index].connected) invalid('game.buildings.connected', 'ne correspond pas au réseau'); });
    equal(s.visibility, check.visibility, 'game.visibility');
    if (s.winner === null) {
      if (!cores[1] || !cores[2]) invalid('game.winner', 'oublie un Cœur effacé');
      if (s.time + EPSILON >= s.duration + (s.overtime ? s.overtimeDuration : 0)) invalid('game.winner', 'oublie la fin du temps');
      for (let team = 1; team <= 2; team++) {
        const dominates = s.scores[team] > Engine.CONFIG.domination && s.scores[team] > s.scores[3 - team];
        if (s.hold[team] >= Engine.CONFIG.holdDuration || (!dominates && s.hold[team] > 0)) invalid('game.hold', 'ne correspond pas à une domination en cours');
      }
    } else {
      let winner = null;
      if (!cores[1] || !cores[2]) winner = !cores[1] && !cores[2] ? 0 : cores[1] ? 1 : 2;
      else for (let team = 1; team <= 2; team++) if (s.hold[team] === Engine.CONFIG.holdDuration && s.scores[team] > .5 && s.scores[team] > s.scores[3 - team]) winner = team;
      if (winner === null && s.time + EPSILON >= s.duration + (s.overtime ? s.overtimeDuration : 0)) {
        const diff = s.scores[1] - s.scores[2];
        if (diff || s.overtime) winner = diff === 0 ? 0 : diff > 0 ? 1 : 2;
      }
      if (winner !== s.winner) invalid('game.winner', 'ne correspond pas à une condition de victoire');
    }
  }
  function validate(envelope) {
    if (!Engine?.Game || !AI?.snapshot) throw new Error('Le moteur et l’IA doivent être chargés avant la course.');
    record(envelope, 'course', ['format', 'version', 'seed', 'encounterIndex', 'phase', 'chosenRewards', 'offerIds', 'draws', 'game', 'ai', 'view']);
    if (envelope.format !== FORMAT) throw new Error('Format de sauvegarde de course non reconnu.');
    if (envelope.version !== VERSION) throw new Error('Cette sauvegarde de course utilise une autre version. Elle a été conservée.');
    number(envelope.seed, 'course.seed', 0, 4294967295, true); number(envelope.encounterIndex, 'course.encounterIndex', 0, 2, true);
    choice(envelope.phase, 'course.phase', PHASES); number(envelope.draws, 'course.draws', 0, 10000, true);
    array(envelope.chosenRewards, 'course.chosenRewards', 2, envelope.encounterIndex);
    const chosen = [];
    for (let index = 0; index < envelope.chosenRewards.length; index++) {
      const id = envelope.chosenRewards[index]; choice(id, 'course.chosenRewards', offerIds(envelope.seed, index, chosen));
      if (chosen.includes(id)) invalid('course.chosenRewards', 'répète une récompense'); chosen.push(id);
    }
    array(envelope.offerIds, 'course.offerIds', 3, envelope.phase === 'reward' ? 3 : 0);
    if (envelope.phase === 'reward') {
      if (envelope.encounterIndex >= 2) invalid('course.phase', 'offre une récompense après le dernier combat');
      equal(envelope.offerIds, offerIds(envelope.seed, envelope.encounterIndex, chosen), 'course.offerIds');
    }
    if (envelope.phase === 'won' && envelope.encounterIndex !== 2) invalid('course.phase', 'gagne avant le dernier combat');
    if (envelope.phase === 'draw' && envelope.draws === 0) invalid('course.draws', 'oublie le match nul');
    if (envelope.phase === 'briefing') {
      if (envelope.game !== null || envelope.ai !== null) invalid('course.game', 'conserve un combat au briefing');
    } else {
      validateGame(envelope.game, envelope);
      const winner = envelope.phase === 'combat' ? null : envelope.phase === 'lost' ? 2 : envelope.phase === 'draw' ? 0 : 1;
      if (envelope.game.winner !== winner) invalid('course.phase', 'ne correspond pas au résultat du combat');
      validateAI(envelope.ai, envelope.game, ENCOUNTERS[envelope.encounterIndex]);
    }
    record(envelope.view, 'course.view', ['camera', 'selectedProducer']);
    if (envelope.view.camera !== null) {
      const c = envelope.view.camera; record(c, 'course.view.camera', ['zoom', 'cx', 'cy']);
      number(c.zoom, 'course.view.camera.zoom', 1, 3); number(c.cx, 'course.view.camera.cx', 0, Engine.CONFIG.width); number(c.cy, 'course.view.camera.cy', 0, Engine.CONFIG.height);
    }
    if (envelope.view.selectedProducer !== null) {
      number(envelope.view.selectedProducer, 'course.view.selectedProducer', 1, MAX_ID, true);
      if (!envelope.game?.buildings.some(b => b.id === envelope.view.selectedProducer && b.team === 1 && ['core', 'barracks', 'mortar'].includes(b.type))) invalid('course.view.selectedProducer', 'ne désigne plus un bâtiment commandable');
    }
    if (envelope.game === null && (envelope.view.camera !== null || envelope.view.selectedProducer !== null)) invalid('course.view', 'conserve une vue sans combat');
    if (utf8Length(JSON.stringify(envelope)) > MAX_SAVE_BYTES) throw new Error('La sauvegarde de course dépasse la taille autorisée.');
    return true;
  }
  function snapshot(run) {
    if (!(run instanceof Run)) throw new Error('Course inconnue.');
    run._resolve();
    let state = null;
    if (run.game) {
      state = {};
      for (const key of GAME_KEYS) state[key] = clone(run.game[key]);
      // A held gesture has no committed cost. Reloading cancels it, and the next
      // production tick resumes normally instead of staying blocked forever.
      state.spendingHeld = [false, false, false];
      const transient = Object.assign(Object.create(Engine.Game.prototype), state, { events: [] });
      transient._refreshProductionStates();
    }
    const view = clone(run.view);
    if (view.selectedProducer !== null && !state?.buildings.some(b => b.id === view.selectedProducer && b.team === 1 && ['core', 'barracks', 'mortar'].includes(b.type))) view.selectedProducer = null;
    const envelope = { format: FORMAT, version: VERSION, seed: run.seed, encounterIndex: run.encounterIndex, phase: run.phase,
      chosenRewards: run.chosenRewards.slice(), offerIds: run._offerIds.slice(), draws: run.draws, game: state,
      ai: state ? clone(AI.snapshot(run.game, 2)) : null, view };
    return envelope;
  }
  function serialize(run) {
    // Trusted live state has already passed engine rules. Full schema and
    // network recomputation are reserved for incoming saves, keeping regular
    // autosaves inexpensive on phones.
    const text = JSON.stringify(snapshot(run));
    if (utf8Length(text) > MAX_SAVE_BYTES) throw new Error('La sauvegarde de course dépasse la taille autorisée.');
    return text;
  }
  function restore(input) {
    let envelope = input;
    if (typeof input === 'string') {
      if (input.length > MAX_SAVE_BYTES || utf8Length(input) > MAX_SAVE_BYTES) throw new Error('La sauvegarde de course dépasse la taille autorisée.');
      try { envelope = JSON.parse(input); } catch (_) { throw new Error('La sauvegarde de course est illisible. Elle a été conservée.'); }
    }
    validate(envelope);
    const run = Object.create(Run.prototype);
    run.seed = envelope.seed; run.encounterIndex = envelope.encounterIndex; run.phase = envelope.phase;
    run.chosenRewards = envelope.chosenRewards.slice(); run._offerIds = envelope.offerIds.slice(); run.draws = envelope.draws;
    run.view = clone(envelope.view);
    run.game = envelope.game ? Object.assign(Object.create(Engine.Game.prototype), clone(envelope.game), { events: [] }) : null;
    if (run.game) {
      run.game.spendingHeld = [false, false, false];
      run.game._refreshProductionStates();
      if (AI.restore(run.game, clone(envelope.ai), 2) === false) throw new Error('La mémoire de l’adversaire est invalide. La sauvegarde a été conservée.');
    }
    return run;
  }

  return Object.freeze({ FORMAT, VERSION, STORAGE_KEY, MAX_SAVE_BYTES, ENCOUNTERS, REWARDS, BASE_DECK, create: options => new Run(options), snapshot, serialize, restore, validate });
});
