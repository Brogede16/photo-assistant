const CACHE_NAME = "photo-assistant-core";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/src/main.js",
  "/src/styles.css",
  "/public/manifest.webmanifest",
  "/public/icons/icon.svg",
  "/src/lib/astro.js",
  "/src/lib/ambient.js",
  "/src/lib/exif.js",
  "/src/lib/presets.js",
  "/src/lib/recommendations.js",
  "/src/lib/scenario.js",
  "/src/lib/search.js",
  "/src/lib/storage.js",
  "/src/data/equipment/index.json",
  "/src/data/learn/lessons.json",
  "/src/data/search/taxonomy.json",
  "/src/data/situations/core-profiles.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(cacheFirst(event.request, "/index.html"));
    return;
  }

  if (!sameOrigin(event.request.url)) return;

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request, fallbackUrl = null) {
  const cached = await caches.match(request);
  const networkUpdate = fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const response = await networkUpdate;
  if (response) return response;
  if (fallbackUrl) return caches.match(fallbackUrl);
  return new Response("Offline og filen er ikke gemt endnu.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

function sameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}
