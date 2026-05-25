/* FOV Planner service worker.
 * Strategy: NETWORK-FIRST for the app's own files, so when you're online you
 * always get the latest version immediately (no stale-cache dance). Falls back
 * to the precache when offline. Cross-origin requests (survey images, Sesame)
 * are left to the browser. Bump CACHE_VERSION when assets change. */

const CACHE_VERSION = "fov-v16";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./cameras.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Only handle our own origin; let survey/Sesame fetches pass straight through.
  if (new URL(req.url).origin !== self.location.origin) return;

  // Network-first: fresh when online, cache when offline.
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return resp;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match("./index.html"))
      )
  );
});
