/* Six small, playable lessons for the paint mode. Scene contents are scripted;
 * pigment, visibility, legal gestures, production, combat and victory use the
 * same Game methods as a free match. Nothing is written to classic saves.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./paint-engine.js'));
  else root.CQPaintTutorial = factory(root.CQPaintEngine);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Engine) {
  'use strict';
  const { Game, CONFIG } = Engine;
  const TOTAL = 6;
  const point = (x, y) => ({ x, y });
  const same = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
  const SOURCE = point(9, 18), POST = point(9, 15), CUT = point(9, 20);
  const FIRST_PATH = [point(9, 22), point(9, 21), point(9, 20), point(9, 19), SOURCE];
  const DETOUR = [point(9, 21), point(8, 21), point(8, 20), point(8, 19), point(9, 19)];
  const FINAL_PATH = [point(9, 13), point(8, 13), point(7, 13)];
  const copyPoints = path => path.map(p => point(p.x, p.y));
  const refusal = message => ({ ok: false, message, cost: 0, cells: [], path: [] });

  // The lesson is an action boundary as well as a UI filter. A hidden card or
  // a keyboard shortcut cannot silently bypass the current learning objective.
  class LessonGame extends Game {
    constructor(lesson) { super({ seed: lesson.seed, duration: 3600 }); this.lesson = lesson; this._lessonInternal = false; }
    _allow(team, action, details) {
      return team !== 1 || this._lessonInternal || !this.lesson ? null : this.lesson._restriction(action, details);
    }
    previewPaint(team, path) {
      const reason = this._allow(team, 'brush');
      return reason ? refusal(reason) : super.previewPaint(team, path);
    }
    paint(team, path) {
      const result = super.paint(team, path);
      if (result.ok && team === 1) this.lesson._observe();
      return result;
    }
    previewCard(team, index, x, y) {
      const id = this.hands[team]?.[index], reason = this._allow(team, 'card', { id, x, y });
      return reason ? Object.assign(refusal(reason), { cardId: id || null, x, y }) : super.previewCard(team, index, x, y);
    }
    playCard(team, index, x, y) {
      const result = super.playCard(team, index, x, y);
      if (result.ok && team === 1) this.lesson._observe();
      return result;
    }
    setFlow(team, producerId, x, y) {
      const reason = this._allow(team, 'flow', { producerId, x, y });
      if (reason) return refusal(reason);
      const result = super.setFlow(team, producerId, x, y);
      if (result.ok && team === 1 && !this._lessonInternal) {
        this.lesson.flowIssued = true;
        this.lesson._observe();
      }
      return result;
    }
    recall(team, producerId) {
      const reason = this._allow(team, 'recall', { producerId });
      if (reason) return refusal(reason);
      this._lessonInternal = true;
      let result;
      try { result = super.recall(team, producerId); } finally { this._lessonInternal = false; }
      if (result.ok && team === 1) { this.lesson.recallIssued = true; this.lesson._observe(); }
      return result;
    }
    toggleProduction(team, producerId) {
      const reason = this._allow(team, 'pause', { producerId });
      if (reason) return refusal(reason);
      const result = super.toggleProduction(team, producerId);
      if (result.ok && team === 1) this.lesson._observe();
      return result;
    }
    upgradeCore(team) {
      const reason = this._allow(team, 'upgrade');
      return reason ? refusal(reason) : super.upgradeCore(team);
    }
  }

  class Tutorial {
    constructor(options = {}) {
      this.seed = Number.isFinite(options.seed) ? options.seed : 71071;
      this.step = 0;
      this._load();
    }
    _load() {
      this.elapsed = 0; this.success = false; this.failed = false; this.notice = '';
      this.flowIssued = false; this.recallIssued = false; this.paidSpawnSeen = false;
      this.cutSeen = false; this.returnedSeen = false; this.barracksId = null;
      this.waveIds = []; this.returningIds = []; this.initialIncome = 0; this.waveStarted = false;
      const game = this.game = new LessonGame(this);
      for (const tile of game.tiles) {
        tile.owner = 0; tile.blocked = false; tile.source = false;
        tile.lastSeenOwner = [0, 0, 0];
      }
      game.explored[1].fill(false); game.explored[2].fill(false);
      game.visibility[1].fill(false); game.visibility[2].fill(false);
      game.tile(9, 3).owner = 2;
      // The first source is four neutral cells from the border, all within the
      // real five-cell sight of the Cœur. No tutorial-only fog exception.
      for (const p of [point(9, 23), point(8, 23), point(10, 23), point(9, 22), point(9, 24)]) game.tile(p.x, p.y).owner = 1;
      const claimPath = path => { for (const p of path) game.tile(p.x, p.y).owner = 1; };
      const corridor = (from, to) => claimPath(Array.from({ length: from - to + 1 }, (_, i) => point(9, from - i)));
      if (this.step < 2) {
        game.tile(SOURCE.x, SOURCE.y).source = true;
        if (this.step === 1) claimPath(FIRST_PATH);
      } else if (this.step === 2) {
        corridor(22, 17);
        game.tile(POST.x, POST.y).owner = 2;
        game._addBuilding(2, 'relay', POST.x, POST.y);
      } else if (this.step === 3) {
        corridor(22, 17);
        const producer = game._addBuilding(1, 'barracks', 9, 17);
        this.barracksId = producer.id;
        const enemy = game._addBuilding(2, 'barracks', 15, 20);
        game.tile(enemy.x, enemy.y).owner = 2;
        enemy.productionPaused = true;
        // A visible opposing unit crosses the narrow bridge while retreating
        // to its outpost. Normal unit occupation really severs the network.
        game._addUnit(2, enemy, { x: 9.02, y: 20.5 });
        game.recompute(); game.recall(2, enemy.id);
      } else if (this.step === 4) {
        corridor(22, 18);
        const producer = game._addBuilding(1, 'barracks', 9, 18);
        this.barracksId = producer.id;
        producer.flow = point(5, 15);
        for (const p of [{ x: 5.5, y: 15.5 }, { x: 5.9, y: 15.5 }, { x: 5.5, y: 15.9 }]) this.returningIds.push(game._addUnit(1, producer, p).id);
        const enemy = game.getCore(2);
        enemy.flow = null;
        for (const p of [{ x: 14.5, y: 18.5 }, { x: 14.5, y: 19 }]) this.waveIds.push(game._addUnit(2, enemy, p).id);
      } else if (this.step === 5) {
        // 255 / 513 cells: one short real stroke crosses the strict 50% mark.
        // The fifteen-second hold and its reset are the normal victory rule.
        for (const tile of game.tiles) if (tile.y >= 14 || tile.y === 13 && tile.x >= 9 && tile.x <= 16) tile.owner = 1;
      }
      game.events = []; game._eventId = 1; game.recompute();
      this.initialIncome = game.income[1];
      return { ok: true, game, presentation: this.presentation() };
    }
    _restriction(action, details = {}) {
      if (this.success) return 'Objectif réussi. Continue avec la situation suivante.';
      if (this.failed) return 'Réessaie cette situation pour poursuivre.';
      if (action === 'brush' && (this.step === 0 || this.step === 3 && this.cutSeen || this.step === 5)) return null;
      if (action === 'card' && this.step === 1 && details.id === 'extractor') return null;
      if (action === 'card' && this.step === 2 && details.id === 'barracks' && this.barracksId === null) {
        return details.x === 9 && details.y === 20 ? null : 'Pose la caserne sur la case indiquée.';
      }
      if (action === 'flow' && this.step === 2 && details.producerId === this.barracksId) return null;
      if (action === 'recall' && (this.step === 2 || this.step === 4) && details.producerId === this.barracksId) return null;
      if (action === 'pause' && (this.step === 2 || this.step === 4) && details.producerId === this.barracksId) return null;
      return 'Une nouveauté à la fois : suis l’objectif indiqué.';
    }
    _win(text) {
      this.success = true; this.notice = text;
      this.game.setSpendingHeld(1, false);
    }
    _observe() {
      if (this.success || this.failed) return;
      const game = this.game;
      if (this.step === 0) {
        const source = game.tile(SOURCE.x, SOURCE.y);
        if (source.owner === 1 && source.connected) this._win('Source reliée ! Tu peux maintenant y poser un extracteur.');
      } else if (this.step === 1) {
        if (game.buildings.some(b => b.team === 1 && b.type === 'extractor' && b.hp > 0 && b.connected && same(b, SOURCE))) this._win('Source exploitée : l’extracteur ajoute +0,85 pigment/s.');
      } else if (this.step === 2) {
        const producer = game.buildings.find(b => b.team === 1 && b.type === 'barracks' && b.hp > 0);
        if (producer) this.barracksId = producer.id;
        if (game.events.some(ev => ev.type === 'spawn' && ev.team === 1 && ev.producerId === this.barracksId && ev.cost === CONFIG.unitCost)) this.paidSpawnSeen = true;
        const target = game.tile(POST.x, POST.y);
        if (this.paidSpawnSeen && this.flowIssued && target.owner === 1 && !game.buildings.some(b => b.team === 2 && same(b, POST))) this._win('Poste repris ! Les unités prennent la couleur adverse. Chaque renfort a coûté 6 pigments.');
      } else if (this.step === 3) {
        const producer = game.buildings.find(b => b.id === this.barracksId);
        if (game.tile(CUT.x, CUT.y).owner === 2 && !producer?.connected) this.cutSeen = true;
        if (this.cutSeen && producer?.connected && game.tile(CUT.x, CUT.y).owner === 2) this._win('Réseau reconnecté par le blanc : la caserne produit à nouveau. La case ennemie est restée ennemie.');
      } else if (this.step === 4) {
        const producer = game.buildings.find(b => b.id === this.barracksId && b.hp > 0);
        if (!producer) { this.failed = true; this.notice = 'La caserne est tombée. Réessaie et rappelle le groupe dès l’arrivée de la vague.'; return; }
        const survivors = game.units.filter(u => this.returningIds.includes(u.id));
        if (this.recallIssued && survivors.some(u => !u.retreating && Math.hypot(u.x - producer.x - .5, u.y - producer.y - .5) < 2)) this.returnedSeen = true;
        if (this.recallIssued && this.returnedSeen && !game.units.some(u => this.waveIds.includes(u.id))) this._win('Vague repoussée ! Le rappel fait rentrer le groupe sans riposter, puis il défend sa caserne.');
        else if (this.recallIssued && !survivors.length && !this.returnedSeen) { this.failed = true; this.notice = 'Le groupe a été perdu pendant la retraite. Réessaie : rappelle-le dès le début.'; }
      } else if (this.step === 5 && game.winner === 1 && game.hold[1] >= CONFIG.holdDuration - 1e-8) {
        this._win('Victoire ! Plus de 50 % du territoire relié, tenus 15 secondes. À toi de jouer un vrai combat de 4 minutes.');
      }
      if (!this.success && game.winner !== null) {
        this.failed = true; this.notice = 'La situation est terminée. Réessaie pour accomplir l’objectif.';
      }
    }
    update(dt) {
      if (this.success || this.failed || !Number.isFinite(dt) || dt <= 0) return;
      // Small chunks let scripted objectives notice the actual transient cut,
      // return and combat states even in deterministic accelerated tests.
      let remaining = dt;
      while (remaining > 1e-9 && !this.success && !this.failed) {
        const tick = Math.min(remaining, CONFIG.step);
        // The scripted opponent leaves time to read the new objective. Its
        // units still use ordinary orders/stats and are visible before moving.
        if (this.step === 4 && !this.waveStarted && (this.elapsed >= 6 || this.recallIssued)) {
          // x=11 is already in the wave's sight; normal aggro then finds the
          // caserne. The script never orders an undiscovered enemy building.
          this.game.setFlow(2, this.game.getCore(2).id, 11, 18);
          this.waveStarted = true;
        }
        this.game.update(tick); this.elapsed += tick; this._observe(); remaining -= tick;
      }
    }
    afterAction(kind, result) {
      if (result && result.ok === false) this.notice = result.message || 'Essaie le geste indiqué.';
      else if (!this.success && !this.failed) this.notice = '';
      this._observe();
      return this.presentation();
    }
    next() {
      if (!this.success) return { ok: false, game: this.game, presentation: this.presentation() };
      if (this.step === TOTAL - 1) return { ok: true, complete: true, game: this.game, presentation: this.presentation() };
      this.step++; return this._load();
    }
    retry() { return this._load(); }
    restart() { this.step = 0; return this._load(); }
    snapshot() {
      return { step: this.step, total: TOTAL, elapsed: this.elapsed, success: this.success, failed: this.failed, complete: this.success && this.step === TOTAL - 1, barracksId: this.barracksId, flowIssued: this.flowIssued, recallIssued: this.recallIssued, paidSpawnSeen: this.paidSpawnSeen, cutSeen: this.cutSeen, returnedSeen: this.returnedSeen };
    }
    presentation() {
      const p = Object.assign(this.snapshot(), {
        title: '', hint: '', notice: this.notice, successText: this.success ? this.notice : '',
        allowedTools: ['navigate'], allowedCards: [], target: null, path: [], gesture: null,
        camera: { zoom: 2.15, cx: 9.5, cy: 21 }, showDomination: this.step === 5, hideClock: true,
        nextLabel: this.step === TOTAL - 1 ? 'Jouer librement' : 'Continuer',
        canRetry: this.failed || this.elapsed >= 25,
        producerId: this.barracksId, phase: ''
      });
      if (this.step === 0) {
        Object.assign(p, { title: 'Peins jusqu’à la source', hint: 'Touche Pinceau, puis trace de ta couleur jusqu’à la goutte dorée. Relâche pour peindre.', allowedTools: ['navigate', 'brush'], target: SOURCE, path: copyPoints(FIRST_PATH), gesture: 'brush', phase: 'paint' });
      } else if (this.step === 1) {
        Object.assign(p, { title: 'Exploite la source', hint: 'Glisse la carte Extracteur sur la source reliée : elle ajoutera +0,85 pigment/s.', allowedCards: ['extractor'], target: SOURCE, gesture: 'card', cardId: 'extractor', phase: 'extract' });
      } else if (this.step === 2) {
        p.camera = { zoom: 1.85, cx: 9.5, cy: 19 };
        const producer = this.game.buildings.find(b => b.id === this.barracksId);
        if (!producer) Object.assign(p, { title: 'Pose une caserne', hint: 'Glisse la carte Caserne sur le repère. Elle formera ton groupe.', allowedCards: ['barracks'], target: point(9, 20), gesture: 'card', cardId: 'barracks', phase: 'build' });
        else if (!this.paidSpawnSeen) Object.assign(p, { title: 'Regarde naître un renfort', hint: producer.productionPaused ? 'Touche la caserne, puis Reprendre : 1 unité / 5 s · 6 pigments à sa sortie.' : '1 unité / 5 s · 6 pigments à sa sortie. Observe le prélèvement dans la jauge.', target: point(producer.x, producer.y), phase: 'spawn' });
        else {
          const fighter = this.game.units.find(u => u.team === 1 && u.hp > 0 && u.producerId === producer.id);
          const from = fighter ? point(fighter.x - .5, fighter.y - .5) : point(producer.x, producer.y);
          Object.assign(p, { title: this.flowIssued ? 'Reprends le petit poste adverse' : 'Envoie ton groupe au poste', hint: producer.productionPaused ? 'La production est en pause. Tu peux la reprendre dans la fiche de la caserne.' : this.flowIssued ? 'Le groupe avance vers le poste. Ses prochains renforts le rejoindront.' : 'Touche un combattant, puis le petit poste adverse. Tout son groupe et les prochains renforts suivent cet ordre.', target: POST, from, path: this.flowIssued ? [] : [from, POST], gesture: this.flowIssued ? null : 'tap-flow', phase: this.flowIssued ? 'capture' : 'send' });
        }
      } else if (this.step === 3) {
        p.camera = { zoom: 2.05, cx: 9.5, cy: 20 };
        if (!this.cutSeen) Object.assign(p, { title: 'Le réseau est menacé', hint: 'Une unité adverse traverse le trait : observe la caserne quand le lien est coupé.', target: CUT, phase: 'cut' });
        else Object.assign(p, { title: 'Contourne la coupure par le blanc', hint: 'Pinceau : pars du réseau du bas et passe à gauche de la case ennemie pour rejoindre la branche hachurée.', allowedTools: ['navigate', 'brush'], target: point(9, 19), path: copyPoints(DETOUR), gesture: 'brush', phase: 'reconnect' });
      } else if (this.step === 4) {
        p.camera = { zoom: 1.7, cx: 9.5, cy: 18.5 };
        const producer = this.game.buildings.find(b => b.id === this.barracksId);
        Object.assign(p, { title: this.recallIssued ? 'Défends la caserne' : 'Rappelle le groupe pour défendre', hint: this.recallIssued ? 'En retraite, le groupe ne riposte pas. Une fois rentré, il défend autour de la caserne.' : 'Glisse depuis la caserne puis reviens dessus pour rappeler. Tu peux aussi ouvrir sa fiche et toucher Rappeler.', target: point(9, 18), path: [point(9, 18), point(10, 19), point(9, 18)], gesture: 'recall', phase: this.recallIssued ? 'defend' : 'recall', from: producer ? point(producer.x, producer.y) : point(9, 18) });
      } else {
        p.camera = { zoom: 1, cx: 9.5, cy: 13.5 };
        const dominates = this.game.scores[1] > CONFIG.domination && this.game.scores[1] > this.game.scores[2];
        Object.assign(p, { title: dominates ? 'Tiens la domination' : 'Dépasse 50 % de territoire relié', hint: dominates ? 'Le compte à rebours est visible en haut. Il faut garder plus de 50 % pendant 15 secondes.' : 'Peins les deux cases indiquées : ta couleur reliée au Cœur doit couvrir plus de la moitié de la toile.', allowedTools: ['navigate', 'brush'], target: point(7, 13), path: copyPoints(FINAL_PATH), gesture: dominates ? null : 'brush', phase: dominates ? 'hold' : 'dominate' });
      }
      if (this.elapsed >= 25 && this.step === 0 && !this.success) p.hint = 'Touche le bouton Pinceau. Pars de la case colorée sous la source, puis remonte le chemin pointillé. Tu peux le faire en plusieurs traits.';
      if (this.elapsed >= 35 && this.step === 2 && this.flowIssued && !this.success) p.hint = 'Le poste est le losange adverse au bout du trait. Renvoie le groupe dessus ; reprends la production si elle est en pause.';
      if (this.success || this.failed) { p.gesture = null; p.path = []; p.target = null; p.allowedTools = ['navigate']; p.allowedCards = []; }
      return p;
    }
  }
  return Object.freeze({ create: options => new Tutorial(options), Tutorial, TOTAL });
});
