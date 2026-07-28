// Poco service worker — makes the app installable (PWA), serves the shell
// offline, and receives push events so nudges show even with no tab open.
// Scope is "/" because it's served from the site root.
const CACHE = "poco-shell-v2";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Resilient precache: one bad asset shouldn't fail the whole install.
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate for same-origin GETs: paint instantly from cache, then
// refresh in the background so the next launch is up to date. Network-first meant
// every launch on a slow phone connection waited on the network first.
// /api/* is never intercepted (always live). Having a fetch handler is also what
// lets Android/Chrome offer "Install app".
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let font/CDN requests pass through
  if (url.pathname.startsWith("/api/")) return;     // never cache API calls

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match("/"));
      return cached || fresh;
    })
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Poco 🦥", body: "Time for your check-in.", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/badge.svg",
      tag: "poco-nudge",
      renotify: true,
      requireInteraction: true,
      vibrate: [80, 40, 80],
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
