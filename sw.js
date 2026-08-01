const CACHE = 'kaltrack-v31';
const SHELL = ['./', './index.html', './manifest.json', './zxing.js', './zaklad.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // kontrola aktualizace se nesmí obsloužit z cache, jinak by hlásila falešnou shodu
  if (url.searchParams.has('nosw')) return;

  // Open Food Facts: vždy ze sítě, nikdy z cache (data se mění)
  if (url.hostname.endsWith('openfoodfacts.org')) return;

  // CDN skript skeneru: cache-first, ať funguje offline
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => new Response('', { status: 504 })))
    );
    return;
  }

  // Vlastní soubory: síť napřed, cache jako záloha (offline)
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
  }
});
