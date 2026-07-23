// Router + bootstrap.
import { getState, noteVisit } from "./store.js";
import { toast } from "./ui.js";
import { openCloset } from "./views/rewards.js";
import { initNudges } from "./notify.js";
import { renderCheckin } from "./views/checkin.js";
import { renderFood } from "./views/food.js";
import { renderHealth } from "./views/health.js";
import { renderHabits } from "./views/habits.js";
import { renderSettings } from "./views/settings.js";

const app = document.getElementById("app");

const ROUTES = {
  checkin: (root) => renderCheckin(root, { name: getState().profile.name }),
  food: renderFood,
  health: renderHealth,
  habits: renderHabits,
  settings: renderSettings,
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

// Delegated so the leaf button keeps working across in-view re-renders
// (which rebuild the top bar). Opens Poco's Closet — the leaf sink.
app.addEventListener("click", (e) => {
  if (e.target.closest("[data-action='rewards']")) openCloset(route);
});

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
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
