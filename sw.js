/**
 * sw.js — Vikretha Service Worker
 * Caches app shell for offline-first loading.
 * Bump CACHE_VERSION to force cache refresh after deployments.
 */

const CACHE_VERSION = 'vikretha-v1';

const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './shop.config.js',
  './styles/main.css',
  './lib/firebase-init.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: cache all app shell files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Use Promise.allSettled so one missing icon doesn't block SW installation
      return Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    }).then(() => self.skipWaiting()) // activate immediately
  );
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control immediately
  );
});

// Fetch: cache-first for app shell, network-first for API/Firebase
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests (Firebase CDN, gstatic.com) — let browser/CDN handle caching
  if (url.origin !== location.origin) {
    return; // no event.respondWith → falls through to browser default
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      // Not in cache — fetch and cache for next time
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline and not cached — return app shell for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
