/**
 * sw.js -- Vikretha Service Worker
 * Strategy:
 *   - HTML / JS / CSS  -> network-first  (always fresh on reload; cache fallback for offline)
 *   - Images / icons   -> cache-first    (stable assets, save bandwidth)
 *   - Cross-origin     -> browser default
 *
 * Bump CACHE_VERSION only to wipe the icon/image cache.
 * Code changes are automatically picked up via network-first -- no manual bump needed.
 */

const CACHE_VERSION = 'vikretha-v4';

const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './shop.config.js',
  './styles/main.css',
  './lib/firebase-init.js',
  './lib/svg-chart.js',
  './lib/toast.js',
  './manifest.json',
  // Route modules — pre-cached so they load offline even on first visit
  './modules/auth.js',
  './modules/billing.js',
  './modules/dashboard.js',
  './modules/inventory.js',
  './modules/reports.js',
  './modules/settings.js',
  './modules/receipt.js',
  './modules/export.js',
  './modules/adminSettings.js',
];

// Install: pre-cache app shell so the app loads offline immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(APP_SHELL.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

// Activate: delete every cache except the current version
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Helpers ---

function isCodeFile(url) {
  return /\.(js|css|html)$/.test(url.pathname) ||
         url.pathname === '/' ||
         url.pathname.endsWith('/');
}

function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|gif|svg|ico|woff2?)$/.test(url.pathname);
}

/**
 * Network-first: try network, fall back to cache, fall back to index.html for navigate.
 * Used for JS / CSS / HTML -- ensures users always get fresh code on reload.
 */
function networkFirst(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
    }
    return response;
  }).catch(() =>
    caches.match(request).then(cached => {
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match('./index.html');
    })
  );
}

/**
 * Cache-first: serve from cache, fall back to network and cache the result.
 * Used for icons / images -- bandwidth-efficient for stable assets.
 */
function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
      }
      return response;
    });
  });
}

// --- Fetch router ---

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Let the browser handle cross-origin (Firebase, CDN, fonts)
  if (url.origin !== location.origin) return;

  if (isCodeFile(url)) {
    event.respondWith(networkFirst(event.request));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
  }
  // Everything else: fall through to browser default
});