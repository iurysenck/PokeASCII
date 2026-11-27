const CACHE_NAME = "pokeascii-ar-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./manifest.json",
  "./favicon.svg",
  "./assets/logo.svg",
  "./js/pokedex_data.js",
  "./js/audio_and_storage.js",
  "./js/ascii_3d_engine.js",
  "./js/game_ui.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-First com fallback Offline: garante que atualizações carreguem imediatamente!
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkRes;
      })
      .catch(() => caches.match(event.request))
  );
});
