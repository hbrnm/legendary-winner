/* Service worker Cămara. Generat la build de scripts/build-sw.mjs: lista
   fișierelor (PRECACHE) și versiunea (VERSION) sunt completate automat. */
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `camara-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("camara-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Doar resursele aplicației; cererile către Supabase merg direct la rețea.
  if (url.origin !== self.location.origin) return;

  // Fișierele cu hash din nume nu se schimbă: din cache, apoi rețea.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Paginile: rețea (cu limită de timp, pentru internet slab în magazin), apoi cache, apoi pagina offline.
  if (req.mode === "navigate") {
    const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    event.respondWith(
      withTimeout(fetch(req), 3500)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(path, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(path)) || (await caches.match(`${path}index.html`)) || (await caches.match("/offline/")) || Response.error()),
    );
    return;
  }

  // Restul (date RSC, manifest): rețea, cu cache ca rezervă.
  event.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error())));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
