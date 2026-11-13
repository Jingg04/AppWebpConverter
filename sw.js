/**
 * FluxWebP Pro Service Worker (Offline Cache & Shell Resilience)
 * Caches core static application shell for fast offline launches.
 * Bypasses in-memory Blobs, user files, and analytics.
 */
const CACHE_NAME = "fluxwebp-shell-v5";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
  "/screenshot-desktop.png",
  "/editor/",
  "/editor/index.html",
  "/editor/editor.css",
  "/editor/editor.js",
  "/editor/bg-remover.js",
  "/poster-studio/",
  "/poster-studio/index.html",
  "/poster-studio/poster-studio.css",
  "/poster-studio/poster-engine.js",
  "/poster-studio/poster-templates.js",
  "/poster-studio/poster-studio.js",
  "/ai-poster-generator/",
  "/ai-poster-generator/index.html"
];

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evt) => {
  if (evt.request.method !== "GET") return;

  const url = new URL(evt.request.url);

  // Strictly avoid intercepting blob:, data:, or non-http requests
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  evt.respondWith(
    caches.match(evt.request).then((cached) => {
      if (cached) return cached;
      return fetch(evt.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(evt.request, toCache));
        return response;
      }).catch(() => caches.match("/"));
    })
  );
});
