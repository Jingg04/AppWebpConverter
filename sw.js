/**
 * FluxWebP Pro Service Worker (Offline Cache & Shell Resilience)
 * Strategy: Network-First with Offline Cache Fallback for dynamic updates.
 * Bypasses in-memory Blobs, API requests, and user conversion files.
 */
const CACHE_NAME = "fluxwebp-shell-v10";
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
  "/background-remover/",
  "/background-remover/index.html",
  "/resizer/",
  "/resizer/index.html",
  "/projects/",
  "/projects/index.html",
  "/help/",
  "/help/index.html",
  "/contact/",
  "/contact/index.html",
  "/about/",
  "/privacy/",
  "/terms/",
  "/404.html"
];

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn(`PWA pre-cache skipped for ${url}:`, err.message))
        )
      );
    })
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

  // Strictly avoid intercepting blob:, data:, api endpoints, or admin paths
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.includes("samnang.com.com.omg")) return;

  // Network-First Strategy for HTML, JS, CSS: Always fetch fresh, fallback to cache if offline
  evt.respondWith(
    fetch(evt.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(evt.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(evt.request).then((cached) => {
          if (cached) return cached;
          if (evt.request.mode === "navigate") {
            return caches.match("/index.html") || caches.match("/");
          }
          return new Response("Offline resource unavailable", { status: 503, statusText: "Offline" });
        });
      })
  );
});
