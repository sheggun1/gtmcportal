const CACHE_NAME = 'gtmc-portal-pwa-v2';
const OFFLINE_URL = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(new Request(OFFLINE_URL, {cache:'reload'}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.filter(k => k.startsWith('gtmc-portal-') && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== self.location.origin) return;
  if(req.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(req); }
      catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }
  if(['script','style','image','font'].includes(req.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const fresh = fetch(req).then(res => {
        if(res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      }).catch(() => cached || Response.error());
      return cached || fresh;
    })());
  }
});
