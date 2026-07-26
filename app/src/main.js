// Router + bootstrap (with optional Supabase auth gate).
import { getState, noteVisit, hydrate, updateProfile } from "./store.js";
import { toast } from "./ui.js";
import { openCloset } from "./views/rewards.js";
import { initNudges } from "./notify.js";
import {
  initSupabase, isCloud, getSession, onAuth, cloudLoad, cloudPushFull, currentUser,
} from "./supabase.js";
import { renderLogin } from "./views/login.js";
import { renderCheckin } from "./views/checkin.js";
import { renderFood } from "./views/food.js";
import { renderHealth } from "./views/health.js";
import { renderHabits } from "./views/habits.js";
import { renderSettings } from "./views/settings.js";
import { renderReview } from "./views/review.js";

const app = document.getElementById("app");

const ROUTES = {
  checkin: (root) => renderCheckin(root, { name: getState().profile.name }),
  food: renderFood,
  health: renderHealth,
  habits: renderHabits,
  settings: renderSettings,
  review: (root) => renderReview(root),
};

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  return ROUTES[hash] ? hash : "checkin";
}

function route() {
  const name = currentRoute();
  ROUTES[name](app);
  window.scrollTo({ top: 0, behavior: "instant" });
}

// Delegated so the leaf button keeps working across in-view re-renders.
app.addEventListener("click", (e) => {
  if (e.target.closest("[data-action='rewards']")) openCloset(route);
});

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

let booted = false;
async function boot() {
  if (booted) return;
  booted = true;
  await initSupabase();
  if (isCloud()) {
    onAuth((session) => {
      if (session) enterApp();
    });
    const session = await getSession();
    if (session) enterApp();
    else renderLogin(app);
  } else {
    enterApp(); // guest / local mode
  }
}

let entered = false;
async function enterApp() {
  if (entered) return;
  entered = true;
  if (isCloud()) {
    try {
      const cloud = await cloudLoad();
      if (cloud) {
        hydrate(cloud);
      } else {
        // Brand-new account: seed the cloud from local, with a real name.
        const user = await currentUser();
        const emailName = user?.email ? user.email.split("@")[0] : "friend";
        if (getState().profile.name === "Alex Explorer") updateProfile({ name: cap(emailName) });
        await cloudPushFull(getState());
      }
    } catch (e) {
      console.warn("[cloud] load failed, using local:", e);
    }
  }
  const gap = noteVisit();
  route();
  initNudges();
  if (gap >= 2) {
    setTimeout(
      () => toast(`Welcome back! ${gap} days. Poco kept the seat warm.`, "waving_hand"),
      700
    );
  }
}

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", boot);
if (document.readyState !== "loading") boot();

// Register the service worker on every load (not just when push is enabled) so
// the app is installable from the first visit and works offline. Push
// enablement reuses this same registration later.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
