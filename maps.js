/* Hand-designed, seed-independent portrait worlds. Shared by simulation/menu previews. */
(function (root) {
  'use strict';
  const WIDTH = 32, HEIGHT = 48, DEFAULT_MAP = 'plain';
  const catalog = Object.freeze([
    Object.freeze({ id: 'plain', name: 'La Plaine', description: 'Un front ouvert et plusieurs routes : explorez les flancs pour financer votre expansion.' }),
    Object.freeze({ id: 'lanes', name: 'Les Couloirs', description: 'Trois passages entre les crêtes : défendez une voie et contournez par une autre.' }),
    Object.freeze({ id: 'crossroads', name: 'Le Carrefour', description: 'Un centre rapide, riche et exposé : contrôlez les jonctions sans abandonner votre réseau.' })
  ]);
  const legacy = Object.freeze({ id: 'legacy', name: 'Toile originelle', description: 'La carte historique, conservée pour le tutoriel et les anciennes parties.' });
  function get(id) { return id === 'legacy' ? legacy : catalog.find(map => map.id === id) || null; }
  function createLayout(id = DEFAULT_MAP) {
    if (!get(id) || id === 'legacy') throw new Error('Carte inconnue ou historique : ' + id);
    const tiles = Array.from({ length: WIDTH * HEIGHT }, (_, i) => ({
      x: i % WIDTH, y: Math.floor(i / WIDTH), blocked: false, source: false,
      terrain: 'plain', rich: false, cache: 0
    }));
    const at = (x, y) => tiles[y * WIDTH + x];
    // Every brush and objective is reflected across y=23.5. Each camp has
    // exactly the same access, income potential and ground around its Cœur.
    const set = (x, y, fields) => {
      Object.assign(at(x, y), fields);
      Object.assign(at(x, HEIGHT - 1 - y), fields);
    };
    const rect = (x1, y1, x2, y2, fields) => {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) set(x, y, fields);
    };
    const source = (x, y, rich = false) => set(x, y, { source: true, rich, cache: 0, blocked: false, terrain: 'plain' });
    const cache = (x, y) => set(x, y, { cache: 60, source: false, rich: false, blocked: false, terrain: 'plain' });
    source(7, 10); source(24, 10);
    if (id === 'plain') {
      rect(3, 18, 5, 19, { blocked: true }); rect(26, 18, 28, 19, { blocked: true });
      rect(6, 16, 8, 23, { terrain: 'smooth' }); rect(23, 16, 25, 23, { terrain: 'smooth' });
      rect(12, 20, 19, 21, { terrain: 'absorbent' });
      source(10, 20, true); source(22, 20);
      cache(10, 15); cache(24, 17); cache(16, 22);
    } else if (id === 'lanes') {
      for (let y = 17; y <= 18; y++) for (let x = 0; x < WIDTH; x++) {
        if (![5, 6, 7, 15, 16, 17, 24, 25, 26].includes(x)) set(x, y, { blocked: true });
      }
      rect(11, 20, 11, 23, { blocked: true }); rect(20, 20, 20, 23, { blocked: true });
      rect(5, 15, 7, 23, { terrain: 'smooth' }); rect(24, 15, 26, 23, { terrain: 'smooth' });
      rect(14, 21, 18, 22, { terrain: 'absorbent' });
      source(6, 21, true); source(25, 21);
      cache(14, 15); cache(26, 19); cache(16, 22);
    } else {
      rect(9, 19, 10, 21, { blocked: true }); rect(22, 19, 23, 21, { blocked: true });
      rect(8, 17, 23, 19, { terrain: 'absorbent' });
      rect(14, 14, 17, 23, { terrain: 'smooth' }); rect(6, 22, 25, 23, { terrain: 'smooth' });
      source(12, 22, true); source(20, 22);
      cache(5, 18); cache(26, 18); cache(16, 20);
    }
    // Rocks have no movement/spread modifier and starting areas stay clear.
    for (const tile of tiles) {
      if (tile.blocked) tile.terrain = 'plain';
      if (Math.hypot(tile.x - 16, tile.y - 6) <= 7 || Math.hypot(tile.x - 16, tile.y - 41) <= 7) {
        tile.blocked = false; tile.terrain = 'plain';
      }
    }
    return tiles;
  }
  function apply(tiles, id) {
    if (!Array.isArray(tiles) || tiles.length !== WIDTH * HEIGHT) throw new Error('Dimensions de carte invalides.');
    const layout = createLayout(id);
    for (let i = 0; i < layout.length; i++) Object.assign(tiles[i], layout[i]);
    return tiles;
  }
  const api = { WIDTH, HEIGHT, DEFAULT_MAP, catalog, get, createLayout, apply };
  root.CQMaps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
