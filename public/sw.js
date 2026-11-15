// CineVault service worker — v2.
//
// v1 was CACHE-FIRST FOR EVERYTHING under a cache name that never changed,
// so any browser that had visited once kept running the build from its first
// visit forever (new deploys never reached returning users: no mode toggle,
// no Watch Now, old search, old detail pages). This version:
//   - uses a NEW cache name (activate deletes every older cache, incl. v1),
//   - is NETWORK-FIRST for navigations/HTML (deploys reach users at once),
//   - is cache-first ONLY for content-hashed build assets (/assets/*),
//   - never intercepts server-function calls, APIs, or cross-origin traffic.
const CACHE_NAME = 'cinevault-pwa-v2';
const STATIC_ASSETS = ['/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Never intercept cross-origin traffic or server-function/API calls.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_serverFn') || url.pathname.startsWith('/api/')) return;

  // Navigations / HTML: network-first so a fresh deploy is what users get.
  // Fall back to the cached app root only when the network is unreachable.
  if (request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/').then((r) => r || Response.error()))
    );
    return;
  }

  // Content-hashed build assets are immutable: cache-first is safe here
  // because every deploy produces new file names.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Other same-origin statics (icon, manifest): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
