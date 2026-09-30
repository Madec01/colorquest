/* Colorquest — a complete release stays together, online and offline.
 * Bump RELEASE for EVERY shipped change to a precached file. A waiting release
 * is activated only after the player chooses to reload, or closes every tab.
 */
'use strict';
const RELEASE = 'COLORQUEST_V06_20260930_1';
const CACHE_PREFIX = 'colorquest:' + new URL(self.registration.scope).pathname + ':';
const CACHE_NAME = CACHE_PREFIX + RELEASE;
const FILES = [
  './', 'index.html', 'engine.js', 'app.js', 'style.css',
  'camera.js', 'camera.css', 'readability.js', 'readability.css',
  'tutorial.js', 'tutorial.css', 'strategy.js', 'strategy.css',
  'install.js', 'install.css', 'manifest.webmanifest',
  'snapshots.js', 'session.js', 'session.css', 'palette.js', 'palette.css',
  'missions.js', 'campaign.js', 'campaign.css',
  'maps.js', 'world-ui.js', 'world-ui.css', 'alerts.js', 'alerts.css',
  'assets/icons/icon.svg', 'assets/icons/icon-192.png',
  'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png',
  'assets/audio/click_001.ogg', 'assets/audio/confirmation_001.ogg',
  'assets/audio/drop_001.ogg', 'assets/audio/error_001.ogg',
  'assets/audio/glass_001.ogg', 'assets/audio/jingles_PIZZI00.ogg',
  'assets/audio/jingles_PIZZI03.ogg', 'assets/audio/select_001.ogg'
];
const ASSET_URLS = FILES.map(file => new URL(file, self.registration.scope).href);
const ASSET_SET = new Set(ASSET_URLS);
const INDEX_URL = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // No partial offline release: any missing asset aborts the installation.
      await cache.addAll(ASSET_URLS.map(url => new Request(url, { cache: 'reload' })));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    // Do not call skipWaiting here: an existing match must keep its version.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
  }
  if (event.data?.type === 'CHECK_OFFLINE_READY') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.all(ASSET_URLS.map(url => cache.match(url)));
      const message = { type: 'OFFLINE_STATUS', ready: results.every(Boolean), release: RELEASE };
      if (event.ports?.[0]) event.ports[0].postMessage(message);
      else event.source?.postMessage(message);
    })());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  url.search = ''; url.hash = '';
  const canonicalURL = url.href;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await (await caches.open(CACHE_NAME)).match(INDEX_URL);
      return cached || fetch(request);
    })());
  } else if (ASSET_SET.has(canonicalURL)) {
    event.respondWith((async () => {
      const cached = await (await caches.open(CACHE_NAME)).match(canonicalURL);
      return cached || fetch(request);
    })());
  }
});
