// The Astro Lava Lamp — network-first service worker (installable / offline-capable)
const CACHE_VERSION = "lava-v8";
const ASSETS = ["./", "index.html", "catalog.enc", "favicon-16x16.png", "favicon-32x32.png", "apple-touch-icon.png", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS)).catch(() => {}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // let cross-origin (e.g. survey images) pass through
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match("index.html")))
  );
});
