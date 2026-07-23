// Real background push (works with the app closed) when a backend is present.
// Falls back to the in-tab timer nudge for local/static hosting.
import { updateSettings, getState } from "./store.js";
import { initNudges, requestPermission, permission } from "./notify.js";

function pushCapable() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Is a push backend actually deployed? (push-key endpoint returns a VAPID key)
async function fetchVapidKey() {
  try {
    const r = await fetch("/api/push-key", { cache: "no-store" });
    if (!r.ok) return null;
    const { key } = await r.json();
    return key || null;
  } catch (_e) {
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Turn reminders on. Returns "push" (real background) or "local" (in-tab timer).
export async function enableReminders(time) {
  const key = pushCapable() ? await fetchVapidKey() : null;

  // No backend / unsupported → in-tab fallback.
  if (!key) {
    const p = await requestPermission();
    if (p !== "granted") throw new Error("denied");
    updateSettings({ reminderEnabled: true, reminderTime: time, lastNotified: null });
    initNudges();
    welcomeNotification(); // show a real one now so they see what it looks like
    return "local";
  }

  const perm = await requestPermission();
  if (perm !== "granted") throw new Error("denied");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  await fetch("/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      subscription: sub,
      time,
      tzOffset: new Date().getTimezoneOffset(),
    }),
  });
  updateSettings({ reminderEnabled: true, reminderTime: time });
  try {
    await reg.showNotification("Poco nudges are on 🌿", {
      body: "This is what your morning check-in reminder will look like.",
      icon: "/icon-192.png",
      badge: "/badge.svg",
      requireInteraction: true,
      tag: "poco-nudge",
    });
  } catch (_e) {}
  return "push";
}

// A real OS notification shown right after enabling (in-tab fallback path).
function welcomeNotification() {
  try {
    new Notification("Poco nudges are on 🌿", {
      body: "I'll remind you here while the app's open.",
      icon: "/icon-192.png",
    });
  } catch (_e) {}
}

export async function disableReminders() {
  updateSettings({ reminderEnabled: false });
  if (!pushCapable()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch (_e) {}
}

// Update the time on an already-on subscription (re-subscribes server-side).
export async function updateReminderTime(time) {
  if (getState().settings.reminderEnabled) {
    try {
      await enableReminders(time);
    } catch (_e) {
      updateSettings({ reminderTime: time });
    }
  } else {
    updateSettings({ reminderTime: time });
  }
}

export { permission };
