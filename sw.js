// Offline shell for patchy Spiti signal. Page content (the Markdown) is cached
// separately in localStorage by app.js; this only keeps the site itself available.
const V = "himachal-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "config.js", "credits.json", "icon.svg", "vendor/marked.min.js", "vendor/purify.min.js", "vendor/leaflet.js", "vendor/leaflet.css"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname === "api.github.com" || u.hostname.includes("opentopomap")) return;
  const isImg = /\.(jpe?g|png|svg|woff2?)$/.test(u.pathname) || u.hostname.includes("gstatic");
  e.respondWith(
    isImg
      ? caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((ca) => ca.put(e.request, c)); return r; }))
      : fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((ca) => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request))
  );
});
