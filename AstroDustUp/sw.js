// Astro Dust Up — network-first service worker
const CACHE_VERSION = "dust-v19";
const ASSETS = ["./", "index.html", "styles.css", "app.js", "data.js", "manifest.webmanifest"];

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
  // Never cache the survey image / resolve services — always go to network.
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match("index.html")))
  );
});
