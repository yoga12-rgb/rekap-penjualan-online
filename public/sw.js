/// <reference lib="webworker" />

const CACHE_VERSION = "rajaklana-pwa-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/manifest\.json$/,
];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await self.caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("rajaklana-pwa-") && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => self.caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStatic = STATIC_PATTERNS.some((pattern) => pattern.test(url.pathname));

  if (isStatic) {
    // Stale-while-revalidate for hashed build assets, icons, and manifest.
    event.respondWith(
      (async () => {
        const cache = await self.caches.open(isStatic && /^\/_next\//.test(url.pathname) ? STATIC_CACHE : RUNTIME_CACHE);
        const cached = await cache.match(request);
        const fetched = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => undefined);
        return cached ?? (await fetched);
      })(),
    );
    return;
  }

  // Everything else (HTML navigations, RSC payloads): network-first with offline fallback.
  event.respondWith(
    (async () => {
      const cache = await self.caches.open(RUNTIME_CACHE);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});