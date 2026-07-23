// Morning nudges. Browser notifications only fire while a tab is open, so this
// polls the clock and pings once per day when it's time and you haven't checked in.
import {
  getState, updateSettings, isCheckinLoggedToday, checkinStreak, todayKey,
} from "./store.js";
import { pocoSvg } from "./ui.js";
import { nudgeText } from "./poco.js";

export function notifySupported() {
  return typeof window !== "undefined" && "Notification" in window;
}
export function permission() {
  return notifySupported() ? Notification.permission : "denied";
}
export async function requestPermission() {
  if (!notifySupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch (_e) {
    return "denied";
  }
}

function pocoIconUri() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(pocoSvg(96, { mood: "happy" }));
}

// Show a nudge now. `force` bypasses the "already logged" guard (used by Test).
export function fireNudge(force = false) {
  if (permission() !== "granted") return false;
  if (!force && isCheckinLoggedToday()) return false;
  try {
    const n = new Notification("Poco 🦥", {
      body: nudgeText(checkinStreak()),
      icon: "/icon-192.png",
      badge: "/badge.svg",
      requireInteraction: true,
      tag: "poco-nudge",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch (_e) {
    return false;
  }
}

let timer = null;
export function initNudges() {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, 30000);
  tick();
}

function tick() {
  const s = getState().settings;
  if (!s.reminderEnabled || permission() !== "granted") return;
  const today = todayKey();
  if (s.lastNotified === today || isCheckinLoggedToday()) return;
  const [h, m] = (s.reminderTime || "08:00").split(":").map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() >= h * 60 + m) {
    if (fireNudge()) updateSettings({ lastNotified: today });
  }
}
