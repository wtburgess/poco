// Fitbit sync (frontend side). The OAuth token lives server-side (Redis), keyed by
// an unguessable device id we keep in localStorage. We just kick off the flow, pull
// today's steps + sleep, and write them onto the check-in. `settings.healthSync` is
// the app's "a real source is connected" flag.
import { getState, updateSettings, saveCheckin } from "./store.js";
import { toast } from "./ui.js";

function deviceId() {
  let id = localStorage.getItem("poco.deviceId");
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("poco.deviceId", id);
  }
  return id;
}

export function isFitbitConnected() {
  return !!getState().settings.healthSync;
}

export function connectFitbit() {
  window.location.href = `/api/health-connect?device=${encodeURIComponent(deviceId())}`;
}

export async function disconnectFitbit() {
  try {
    await fetch(`/api/health-disconnect?device=${encodeURIComponent(deviceId())}`, { method: "POST" });
  } catch (_e) {}
  updateSettings({ healthSync: false, fitbitLastSync: null, fitbitUserId: null });
}

// Pull today's steps + sleep from Fitbit and write them onto today's check-in.
// Returns the data, or null if not connected / offline.
export async function syncHealth({ silent = true } = {}) {
  try {
    const r = await fetch(`/api/health-data?device=${encodeURIComponent(deviceId())}`, { cache: "no-store" });
    const d = await r.json();
    if (!d.connected) {
      if (getState().settings.healthSync) updateSettings({ healthSync: false });
      return null;
    }
    const patch = {};
    if (d.steps != null) patch.steps = d.steps;
    if (d.sleepHours != null) patch.sleepHours = d.sleepHours;
    if (Object.keys(patch).length) saveCheckin(patch);
    updateSettings({ healthSync: true, fitbitLastSync: Date.now(), fitbitUserId: d.userId || null });
    if (!silent) toast(`Synced ${d.steps != null ? d.steps.toLocaleString() + " steps" : "Fitbit"} 🌿`, "sync");
    return d;
  } catch (_e) {
    return null;
  }
}

// Run on boot: handle the OAuth return (query flag), else auto-sync if connected.
export function initHealthSync() {
  const params = new URLSearchParams(location.search);
  const flag = params.get("fitbit");
  if (flag) {
    history.replaceState(null, "", location.pathname + location.hash); // strip the flag
    if (flag === "connected") {
      updateSettings({ healthSync: true });
      toast("Fitbit connected 🎉", "check_circle");
      syncHealth({ silent: false });
    } else {
      toast("Fitbit connection failed — try again", "error");
    }
    return;
  }
  if (getState().settings.healthSync) syncHealth();
}
