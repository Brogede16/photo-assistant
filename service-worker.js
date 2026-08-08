const CACHE_NAME = "photo-assistant-v0.16.0";

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
  "/src/data/version-log.json"
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
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
