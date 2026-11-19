/* CarsRent offline app-shell service worker
   - Caches static assets + previously visited app routes
   - Does NOT cache API responses (business data lives in IndexedDB)
   - Safe to update: does not touch IndexedDB
*/

const CACHE_VERSION = "carsrent-shell-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Core assets that should be available offline after first visit
const PRECACHE_URLS = [
  "/",
  "/favicon7.png",
  // Next.js will also cache JS/CSS chunks at runtime
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("carsrent-shell-") && k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache API calls – offline data comes from IndexedDB via baseApi
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (HTML pages) → network first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Static assets (JS, CSS, fonts, images) → cache first, then network
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});