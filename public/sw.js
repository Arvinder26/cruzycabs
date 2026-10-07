const CACHE = "cruzycabs-offline-v1";
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["/offline.html", "/app-icon-192.png", "/app-icon-512.png"]))); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("cruzycabs-offline-") && key !== CACHE).map(key => caches.delete(key))))); });
// No booking, contact, payment, session or staff response is cached.
self.addEventListener("fetch", event => { if(event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html"))); });
