/* sw.js - Cache-first with runtime caching and offline fallback */

const CACHE_NAME = "tasks-app-cache-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/offline.html"
];

// Install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve())
    ))
  );
  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(networkRes => {
        // cache valid responses
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const respClone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, respClone).catch(()=>{});
          });
        }
        return networkRes;
      }).catch(() => {
        // fallback to offline page for navigation requests
        if (req.mode === "navigate" || (req.headers && req.headers.get("accept") && req.headers.get("accept").includes("text/html"))) {
          return caches.match("/offline.html");
        }
      });
    })
  );
});
