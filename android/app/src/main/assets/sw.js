/**
 * Hisab AI - Service Worker
 * Provides offline caching, lightning-fast PWA launching, and network resiliency.
 */

const CACHE_NAME = 'hisab-pwa-v39';
const STATIC_ASSETS = [
  '/app',
  '/css/shopFriendly.css?v=39',
  '/js/shopFriendly.js?v=39',
  '/js/shopToolsCore.js?v=39',
  '/js/shopToolsUI.js?v=39',
  '/js/shopPortal.js?v=39',
  '/css/shopTools.css?v=39',
  '/js/dailyWorkflow.js',
  '/js/dailyWorkflowUI.js?v=39',
  '/js/siteFeatures.js?v=39',
  '/js/analytics.js',
  '/js/siteMotion.js',
  '/js/hisabCharts.js',
  '/css/bklitUtilities.css',
  '/js/vendor/anime-4.5.0.min.js',
  '/css/siteFeatures.css',
  '/privacy.html',
  '/terms.html',
  '/cookies.html',
  '/refund.html',
  '/js/privacy.js?v=39',
  '/css/privacy.css',
  '/css/app.css',
  '/js/merchantApp.js?v=39',
  '/js/offlineEngine.js?v=39',
  '/js/translations.js?v=39',
  '/js/improvements.js',
  '/css/improvements.css',
  '/manifest.json',
  '/assets/icon.svg',
  '/assets/rupee-ledger.svg',
  '/js/vendor/three-r128.min.js',
  '/assets/hisab-mark.svg',
  '/assets/hisab-logo.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('hisab-pwa-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first for dynamic API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => {
          return new Response(
            JSON.stringify({
              success: false,
              offline: true,
              error: { message: 'You are currently offline. Please reconnect to internet/local store server.' }
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Stale-While-Revalidate for UI assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
