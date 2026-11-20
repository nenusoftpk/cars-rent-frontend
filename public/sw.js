/* eslint-disable no-restricted-globals */
/**
 * Rent-a-Car service worker.
 *
 * Caches the APPLICATION SHELL only (HTML documents + /_next/static assets) so previously
 * visited routes open offline. Business data lives in IndexedDB and is NEVER stored here.
 *
 *  - Never touches non-GET requests, other origins (your API), /api/*, or RSC/_next/data.
 *  - Caching HTML is safe ONLY because this app renders no per-user data on the server
 *    (session = localStorage token, pages are client components). If you ever add
 *    cookie-based SSR, remove the page cache below.
 *  - Updating this file never touches IndexedDB. Old caches are removed on activate.
 */
const STATIC = "rac-static-v1"; // hashed build assets (content-addressed; trimmed by count, not by version)
const PAGES = "rac-pages-v1";   // HTML shells
const MEDIA = "rac-media-v1";   // same-origin images / fonts
const CURRENT = [STATIC, PAGES, MEDIA];
const OFFLINE_URL = "/offline.html";
const MAX_STATIC = 900;
const MAX_PAGES = 60;
const MAX_MEDIA = 120;
const NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("rac-") && !CURRENT.includes(n)).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "WARM" && Array.isArray(data.urls)) event.waitUntil(warm(data.urls));
  if (data.type === "CLEAR_PAGES") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API + CDN images are never handled here
  const path = url.pathname;
  if (path === "/sw.js" || path.startsWith("/api/") || path.startsWith("/_next/webpack-hmr")) return;

  if (path.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC, MAX_STATIC));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(pageStrategy(req));
    return;
  }

  // React Server Component / data requests: let the network answer. When offline Next.js
  // falls back to a full page load, which pageStrategy serves from cache.
  if (req.headers.get("RSC") || url.searchParams.has("_rsc") || path.startsWith("/_next/data/")) return;

  if (path.startsWith("/_next/image") || /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/i.test(path)) {
    event.respondWith(staleWhileRevalidate(req, MEDIA, MAX_MEDIA));
  }
});

// ---------------------------------------------------------------- strategies

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req, name, max) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreSearch: true }); // filenames are content-hashed
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200) cache.put(req, res.clone()).then(() => trim(cache, max)).catch(() => {});
  return res;
}

async function staleWhileRevalidate(req, name, max) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.status === 200) cache.put(req, res.clone()).then(() => trim(cache, max)).catch(() => {});
      return res;
    })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}

const isHtml = (res) => (res.headers.get("Content-Type") || "").includes("text/html");
const stripSlash = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
// /dashboard and /dashboard/ share one cache entry
const pageKey = (url) => new Request(url.origin + stripSlash(url.pathname) + url.search);

async function matchPage(cache, url) {
  return (await cache.match(pageKey(url))) || (await cache.match(pageKey(url), { ignoreSearch: true }));
}

// A redirect is only safe to cache when it ends on the same page (e.g. a trailing slash),
// never when it sends the user somewhere else (e.g. /login).
function cacheable(res, url) {
  if (!res.ok || !isHtml(res)) return false;
  if (!res.redirected) return true;
  try {
    const finalUrl = new URL(res.url);
    return finalUrl.origin === url.origin && stripSlash(finalUrl.pathname) === stripSlash(url.pathname);
  } catch {
    return false;
  }
}

// Strip the `redirected` flag etc. so the copy can be used for a navigation request.
async function cleanCopy(res) {
  const body = await res.blob();
  return new Response(body, {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": res.headers.get("Content-Type") || "text/html; charset=utf-8" },
  });
}

async function pageStrategy(req) {
  const cache = await caches.open(PAGES);
  const url = new URL(req.url);
  const cached = await matchPage(cache, url);

  try {
    const network = fetch(req);
    // With a cached copy, don't make the user wait on a slow network.
    const res = cached
      ? await Promise.race([network, new Promise((_, reject) => setTimeout(reject, NAV_TIMEOUT_MS))])
      : await network;

    if (cacheable(res, url)) {
      cleanCopy(res.clone()).then((copy) => cache.put(pageKey(url), copy)).then(() => trim(cache, MAX_PAGES)).catch(() => {});
      return res;
    }
    if (res.status >= 500 && cached) return cached;
    return res;
  } catch {
    if (cached) return cached;
    return (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

// ---------------------------------------------------------------- warm-up

// Fetch routes + the JS/CSS they reference so they open offline even before being visited.
function extractAssets(html) {
  const found = new Set();
  const re = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[A-Za-z0-9_\-.~%\/\[\]]+?\.(?:js|css|woff2?)(?:\?dpl=[A-Za-z0-9_-]+)?/g;
  for (const match of html.match(re) || []) {
    found.add(match.startsWith("/_next/") ? match : `/_next/${match}`);
  }
  return found;
}

async function warm(urls) {
  const pages = await caches.open(PAGES);
  const assets = new Set();

  for (const target of urls.slice(0, 40)) {
    try {
      const url = new URL(target, self.location.origin);
      if (url.origin !== self.location.origin) continue;
      const res = await fetch(url.href, { headers: { Accept: "text/html" }, credentials: "same-origin" });
      // A redirect to a different page (e.g. /login) must not be stored under this route.
      if (!cacheable(res, url)) continue;
      const html = await res.clone().text();
      await pages.put(pageKey(url), await cleanCopy(res));
      extractAssets(html).forEach((a) => assets.add(a));
    } catch {
      // offline or blocked: skip
    }
  }

  const stat = await caches.open(STATIC);
  const list = [...assets].slice(0, 500);
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(
      list.slice(i, i + 6).map(async (asset) => {
        try {
          if (await stat.match(asset, { ignoreSearch: true })) return;
          const res = await fetch(asset);
          if (res.status === 200) await stat.put(asset, res);
        } catch {
          // skip
        }
      })
    );
  }
  await trim(stat, MAX_STATIC);
  await trim(pages, MAX_PAGES);
}