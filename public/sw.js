
/* CarsRent Offline Service Worker */

const VERSION = "carsrent-v3";

const PAGE_CACHE = `${VERSION}-pages`;
const RSC_CACHE = `${VERSION}-rsc`;
const ASSET_CACHE = `${VERSION}-assets`;
const IMAGE_CACHE = `${VERSION}-images`;

const APP_ROUTES = [
  "/",
  "/dashboard",
  "/customers",
  "/cars",
  "/bookings",
  "/bookings/new",
  "/billing",
  "/drivers",
  "/income-expenses",
  "/car-issue-return",
  "/customer-ledger",
  "/reports",
  "/reminders",
  "/settings",
];

const STATIC_FILES = [
  "/favicon7.png",
];

const cacheable = (response) =>
  response &&
  response.ok &&
  response.type !== "opaque";

const isRSC = (request, url) =>
  url.searchParams.has("_rsc") ||
  request.headers.get("RSC") === "1" ||
  request.headers.has("Next-Router-State-Tree");

function htmlCacheKey(url) {
  // Use one HTML shell per pathname.
  // Client-side filters still come from the URL.
  return new URL(url.pathname, self.location.origin).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);

      await Promise.allSettled(
        STATIC_FILES.map(async (path) => {
          const response = await fetch(path, {
            cache: "reload",
          });

          if (cacheable(response)) {
            await cache.put(path, response);
          }
        })
      );

      // Pages are cached when visited.
      // Do not automatically fetch private routes
      // during service worker installation.

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("carsrent-") &&
              ![
                PAGE_CACHE,
                RSC_CACHE,
                ASSET_CACHE,
                IMAGE_CACHE,
              ].includes(key)
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  const sameOrigin =
    url.origin === self.location.origin;

  // Cloudinary images: cache after first online load.
  if (
    url.hostname === "res.cloudinary.com" &&
    request.destination === "image"
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const cached = await cache.match(request);

        if (cached) return cached;

        const response = await fetch(request);

        if (response.ok || response.type === "opaque") {
          await cache.put(request, response.clone());
        }

        return response;
      })()
    );

    return;
  }

  if (!sameOrigin) return;

  // Business API requests remain managed by IndexedDB.
  if (url.pathname.startsWith("/api/")) return;

  // Never return an HTML document for an RSC request.
  if (isRSC(request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RSC_CACHE);

        try {
          const response = await fetch(request);

          if (cacheable(response)) {
            await cache.put(request, response.clone());
          }

          return response;
        } catch {
          const cached = await cache.match(request);

          return cached || Response.error();
        }
      })()
    );

    return;
  }

  // HTML navigation: network first, cache fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        const key = htmlCacheKey(url);

        try {
          const response = await fetch(request);

          if (
            cacheable(response) &&
            response.headers
              .get("content-type")
              ?.includes("text/html")
          ) {
            await cache.put(key, response.clone());
          }

          return response;
        } catch {
          const cached = await cache.match(key);

          if (cached) return cached;

          // An uncached route cannot safely use
          // another authenticated page as fallback.
          return Response.error();
        }
      })()
    );

    return;
  }

  const isAsset =
    url.pathname.startsWith("/_next/static/") ||
    /\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/i
      .test(url.pathname);

  if (isAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);

        if (cached) return cached;

        const response = await fetch(request);

        if (cacheable(response)) {
          await cache.put(request, response.clone());
        }

        return response;
      })()
    );
  }
});
