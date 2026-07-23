// Poco service worker — receives push events and shows the nudge, even when
// no tab is open. Scope is "/" because it's served from the site root.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

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
