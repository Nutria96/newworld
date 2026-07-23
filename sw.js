const CACHE_NAME = "chongseb-v3-global";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/nutria-icon.svg",
  "/rpg.css",
  "/rpg.js",
  "/global-i18n.css",
  "/global-i18n.js",
  "/adult-access.css",
  "/adult-access.js",
  "/adult-account.css",
  "/store.css",
  "/store.js",
  "/mock-stores.json",
  "/locales/es.json",
  "/locales/en.json",
  "/locales/zh.json",
  "/locales/ja.json",
  "/locales/ko.json",
  "/locales/fr.json",
  "/locales/de.json",
  "/locales/pt.json",
  "/locales/ru.json",
  "/locales/ar.json",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/.netlify/functions/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put("/index.html", response.clone()));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }))
  );
});
