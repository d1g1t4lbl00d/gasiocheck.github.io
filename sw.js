/* ════════════════════════════════════════════════════════════
   IberoFuel Service Worker — network-first, cache fallback
   ════════════════════════════════════════════════════════════ */

const CACHE = 'iberofuel-v3';
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/juice.js',
  '/pepe.js',
  '/favicon.svg',
  '/favicon.png',
  '/assets/pepe-logo.png',
  '/assets/pepe-head.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only handle same-origin requests — let all external CDN/API calls
  // (Supabase, leaflet, fonts, PrecioIL, MINETUR, etc.) go straight to network.
  if (url.origin !== self.location.origin) return;

  // Network-first for navigation (always serve fresh HTML)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Network-first for same-origin assets, cache as fallback when offline
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      try {
        const networkRes = await fetch(e.request);
        if (networkRes.ok) cache.put(e.request, networkRes.clone());
        return networkRes;
      } catch {
        const cached = await cache.match(e.request);
        return cached ?? new Response('Offline', { status: 503 });
      }
    })
  );
});
