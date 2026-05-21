/* ════════════════════════════════════════════════════════════
   IberoFuel Service Worker — network-first, cache fallback
   ════════════════════════════════════════════════════════════ */

const CACHE = 'iberofuel-v1';
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

  // Never intercept Supabase, MINETUR, PrecioIL, analytics calls
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('minetur.gob.es') ||
    url.hostname.includes('precioil.es') ||
    url.hostname.includes('nominatim') ||
    url.hostname.includes('bigdatacloud') ||
    url.hostname.includes('allorigins') ||
    url.hostname.includes('corsproxy') ||
    url.hostname.includes('codetabs') ||
    url.hostname.includes('leaflet') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('vercel-insights')
  ) return;

  // Network-first for HTML (always fresh)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static assets, network-first fallback
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      try {
        const networkRes = await fetch(e.request);
        if (networkRes.ok) cache.put(e.request, networkRes.clone());
        return networkRes;
      } catch {
        return cache.match(e.request);
      }
    })
  );
});
