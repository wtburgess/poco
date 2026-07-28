// Daily Check-in view — ONE screen, three time-based modes.
// The app decides what matters *now*: morning wakes up sleep+mood, daytime brings
// food+movement forward, evening (soft priority from 10pm) makes the wind-down the
// hero. The rest collapse into slim "done" chips. The screen itself shifts through
// the day (dawn → daylight → dusk) and Poco changes pose to match.
import {
  getTodayCheckin, saveCheckin, getTodayMeals, getState,
  commitCheckin, isCheckinLoggedToday, checkinStreak, streakOnGrace, getWeeklyFocus,
} from "../store.js";
import { icon, pocoImg, toast, shell, celebrate } from "../ui.js";
import { topInsight } from "../insights.js";
import { heroState, doneTap } from "../poco.js";
import { logBite } from "./logfood.js";
import { syncHealth } from "../health-sync.js";

const MOODS = [
  "sentiment_very_dissatisfied",
  "sentiment_dissatisfied",
  "sentiment_neutral",
  "sentiment_satisfied",
  "sentiment_very_satisfied",
];

// Sleep quality: a thumb that rotates from 👎 (rough night) to 👍 (great one).
const SLEEP_ROT = [180, 135, 90, 45, 0];

// The three modes and which sections each one brings to the foreground.
const SECTIONS = [
  { id: "sleep",     group: "morning", icon: "bedtime",          label: "sleep" },
  { id: "mood",      group: "morning", icon: "mood",             label: "mental state" },
  { id: "food",      group: "daytime", icon: "restaurant",       label: "food" },
  { id: "movement",  group: "daytime", icon: "directions_walk",  label: "movement" },
  { id: "gratitude", group: "evening", icon: "favorite",         label: "grateful for" },
  { id: "note",      group: "evening", icon: "edit_note",        label: "one line a day" },
];

// ---- Which mode are we in? ----
// Real clock by default; the dev Preview control can override it (session-only,
// never persisted — in production the clock always drives it).
let previewMode = null; // "morning" | "daytime" | "evening" | null (=live)
// Sections the user manually expanded despite it not being "their" mode. 10pm is a
// priority shift, not a lock: anything can still be opened and edited on demand.
const manualOpen = new Set();

function clockMode(d = new Date()) {
  const h = d.getHours();
  if (h >= 22 || h < 5) return "evening"; // soft evening priority from 10pm
  if (h < 11) return "morning";
  return "daytime";
}
function currentMode() {
  return previewMode || clockMode();
}

// Section-heading icon: a chunky dark "sticker" square with the glyph knocked out.
function hbadge(name) {
  return `<span class="material-symbols-outlined bg-on-surface text-surface p-2 rounded-xl text-[22px] leading-none">${name}</span>`;
}

export function renderCheckin(root, { name }) {
  const c = getTodayCheckin();
  const meals = getTodayMeals();
  const mode = currentMode();

  const expanded = SECTIONS.filter((s) => s.group === mode || manualOpen.has(s.id));
  const collapsed = SECTIONS.filter((s) => s.group !== mode && !manualOpen.has(s.id));

  const body = `
    <div class="checkin-ambient" data-mode="${mode}">
      <div class="flex flex-col gap-gutter">
        ${focusBanner()}
        ${reviewBanner()}
        ${heroSection(name, mode)}
        ${insightCard()}

        ${expanded.map((s) => sectionCard(s, c, meals)).join("")}

        ${ctaHtml()}

        ${collapsed.length ? `
          <div class="flex items-center gap-3 pt-2 pb-1 cx-divider">
            <div class="h-px flex-1 bg-outline-variant/40"></div>
            <span class="font-label-bold text-label-bold flex items-center gap-1">${icon("unfold_more", "text-sm")} ${collapsedHeading(mode)}</span>
            <div class="h-px flex-1 bg-outline-variant/40"></div>
          </div>
          <div class="flex flex-col gap-2">
            ${collapsed.map((s) => summaryRow(s, c, meals)).join("")}
          </div>
        ` : ""}

        ${previewControl(mode)}
        ${reviewLink()}

        <div class="h-24 md:h-4"></div>
      </div>
    </div>
  `;

  root.innerHTML = shell("checkin", body);
  wire(root, name);
}

// The single focus from the last weekly review, pinned to the top of the dashboard.
function focusBanner() {
  const f = getWeeklyFocus();
  if (!f) return "";
  return `
    <div class="bg-tertiary-fixed chunky-border card-shadow rounded-2xl px-4 py-3 flex items-center gap-3">
      <span class="text-xl shrink-0">📌</span>
      <div class="flex-1 min-w-0">
        <p class="font-label-bold text-[11px] text-on-tertiary-fixed uppercase tracking-wide">This week's focus</p>
        <p class="font-headline-md text-headline-md text-on-surface truncate">${escNote(f)}</p>
      </div>
    </div>`;
}

// Launcher for the weekly review. On its day it's a banner at the top; the rest of
// the week it's a quiet link at the bottom — the top of the screen belongs to today.
function reviewDue() {
  const { settings } = getState();
  if (!settings.reviewEnabled) return false;
  const today = new Date().getDay();
  const rd = Number.isInteger(settings.reviewDay) ? settings.reviewDay : 0;
  return today === rd || today === (rd + 1) % 7;
}

function reviewBanner() {
  if (!reviewDue()) return "";
  return `
    <button data-review class="chunky-button w-full flex items-center gap-3 px-4 py-3 rounded-2xl chunky-border card-shadow text-left bg-primary text-on-primary">
      <span class="w-9 h-9 rounded-full chunky-border flex items-center justify-center shrink-0 bg-surface/25">${icon("event_available")}</span>
      <div class="flex-1 min-w-0">
        <p class="font-label-bold text-label-bold">Time for your weekly review</p>
        <p class="text-xs opacity-80">2–3 min. Celebrate, adjust, set next week's anchor.</p>
      </div>
      ${icon("chevron_right")}
    </button>`;
}

function reviewLink() {
  if (!getState().settings.reviewEnabled || reviewDue()) return "";
  return `
    <button data-review class="w-full flex items-center justify-center gap-1.5 py-2 font-label-bold text-label-bold text-on-surface-variant">
      ${icon("event_available", "text-base")} Weekly review ${icon("chevron_right", "text-base")}
    </button>`;
}

// The payoff for logging: one thing they couldn't have known without the data.
// Silent until there's a real pattern — no "keep logging!" placeholder.
function insightCard() {
  const best = topInsight(getState());
  if (!best) return "";
  return `
    <div class="bg-primary-fixed chunky-border card-shadow rounded-2xl px-4 py-3 flex items-start gap-3">
      <span class="w-8 h-8 rounded-full chunky-border bg-surface-container-lowest flex items-center justify-center shrink-0">${icon(best.icon, "text-primary text-[18px] fill-icon")}</span>
      <div class="flex-1 min-w-0">
        <p class="font-label-bold text-[11px] text-on-primary-container uppercase tracking-wide">Poco noticed</p>
        <p class="font-body-md text-body-md text-on-surface leading-snug">${best.text}</p>
      </div>
    </div>`;
}

function collapsedHeading(mode) {
  if (mode === "morning") return "later today";
  if (mode === "evening") return "the day, folded up";
  return "tucked away";
}

// ---- Reactive hero ----
// The illustrated Poco avatar (same one used across the app); the time-of-day feel
// comes from the ambient background shift, not a pose change.
function heroSection(name) {
  const { title, sub } = heroState(name);
  return `
    <section class="text-center mb-1" data-hero>
      <div class="flex justify-center mb-2 md:mb-3">
        <div class="w-28 h-28 md:w-40 md:h-40 rounded-full overflow-hidden chunky-border card-shadow bg-secondary-container flex items-center justify-center" data-poco>${pocoImg(148)}</div>
      </div>
      <div class="flex justify-center mb-2">${streakBadge()}</div>
      <h1 class="font-headline-md text-headline-md text-on-background mb-1">${title}</h1>
      <p class="font-body-md text-sm md:text-body-md leading-snug md:leading-normal text-on-surface-variant max-w-sm mx-auto">${sub}</p>
    </section>`;
}

// Time-of-day switcher — peek at any moment of the day, or let the clock drive it.
function previewControl(mode) {
  const live = previewMode === null;
  const seg = (id, label) => {
    const on = previewMode === id;
    return `<button data-preview="${id}" class="chunky-button flex-1 px-2 py-1.5 rounded-full text-xs font-label-bold ${
      on ? "bg-on-surface text-surface" : "text-on-surface-variant hover:bg-surface-container"
    }">${label}</button>`;
  };
  return `
    <div class="cx-preview rounded-2xl chunky-border bg-surface-container/70 px-3 py-2 flex items-center gap-2 flex-wrap">
      <span class="font-label-bold text-[11px] text-on-surface-variant flex items-center gap-1">${icon("wb_twilight", "text-sm")} Time of day</span>
      <div class="flex items-center gap-1 flex-1 min-w-[220px] justify-end">
        ${seg("morning", "☀️ Morning")}
        ${seg("daytime", "🌤 Day")}
        ${seg("evening", "🌙 Evening")}
        <button data-preview="live" class="chunky-button px-2 py-1.5 rounded-full text-xs font-label-bold ${
          live ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container"
        }">⏱ Live</button>
      </div>
    </div>`;
}

function streakBadge() {
  const s = checkinStreak();
  const logged = isCheckinLoggedToday();
  if (s <= 0 && !logged) {
    return `<div class="inline-flex items-center gap-2 bg-surface-container px-4 py-1.5 rounded-full chunky-border font-label-bold text-label-bold text-on-surface-variant">🌱 Start a streak today</div>`;
  }
  // Say the grace day out loud — a streak that survived a miss is only reassuring
  // if you can see that it did.
  const resting = streakOnGrace()
    ? `<span class="block text-[11px] font-label-bold text-on-surface-variant mt-1">🌙 rest day taken — streak's safe, don't skip today</span>`
    : "";
  return `<div class="text-center">
    <div class="inline-flex items-center gap-2 bg-tertiary-fixed px-4 py-1.5 rounded-full chunky-border card-shadow font-label-bold text-label-bold text-on-tertiary-fixed">
      ${icon("local_fire_department", "streak-flame text-tertiary fill-icon")} ${s}-day streak
    </div>
    ${resting}
  </div>`;
}

function ctaHtml() {
  const logged = isCheckinLoggedToday();
  const base = "chunky-button w-full rounded-full px-8 py-4 flex items-center gap-3 chunky-border card-shadow justify-center";
  if (logged) {
    return `<button data-log-checkin class="${base} checkin-done">
      ${icon("check_circle", "fill-icon")}
      <span class="font-label-bold text-label-bold text-lg">Logged. Go be a person.</span>
    </button>`;
  }
  return `<button data-log-checkin class="${base} bg-on-surface text-surface hover:-translate-y-0.5">
    <span class="font-headline-md text-headline-md">Send it 🚀</span>
    <div class="bg-primary text-on-surface px-2 py-1 rounded-lg flex items-center gap-1 chunky-border">
      ${icon("energy_savings_leaf", "text-sm")}<span class="font-label-bold text-xs">+15</span>
    </div>
  </button>`;
}

function refreshHero(root, name) {
  const heroEl = root.querySelector("[data-hero]");
  if (heroEl) heroEl.outerHTML = heroSection(name, currentMode());
}

// Showing up shouldn't need a second deliberate tap: the first meaningful log of
// the day counts it (awards + celebrates once). The "Send it" button stays as a
// manual option for when there's nothing to change. Returns true if it committed
// (and re-rendered), so callers can stop their own DOM updates.
function maybeAutoCommit(root, name) {
  if (isCheckinLoggedToday()) return false;
  const res = commitCheckin();
  celebrate();
  toast(
    res.milestone ? `🎉 ${res.streak}-day milestone! +${res.awarded} 🌿` : `Logged! ${res.streak}-day streak · +${res.awarded} 🌿`,
    res.milestone ? "celebration" : "local_fire_department"
  );
  renderCheckin(root, { name });
  return true;
}

// ---- Expanded section cards ----
function sectionCard(s, c, meals) {
  switch (s.id) {
    case "sleep":     return cardSleep(c);
    case "mood":      return cardMood(c);
    case "food":      return cardFood(meals);
    case "movement":  return cardMovement(c);
    case "gratitude": return cardGratitude(c);
    case "note":      return cardNote(c);
    default:          return "";
  }
}

function cardSleep(c) {
  return `
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6 relative overflow-hidden" data-section="sleep">
      <span class="material-symbols-outlined absolute -top-2 -right-2 text-surface-tint opacity-10 text-6xl rotate-45">eco</span>
      <h2 class="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-3 lowercase">${hbadge("bedtime")} did you actually sleep?</h2>
      <div class="flex flex-col items-center gap-8">
        <div class="flex items-center gap-4">
          <button data-sleep="-0.5" class="chunky-button w-11 h-11 rounded-full chunky-border bg-surface-container flex items-center justify-center card-shadow">${icon("remove")}</button>
          <div class="w-32 h-32 rounded-full chunky-border bg-surface-container flex items-center justify-center relative card-shadow">
            <div class="absolute inset-2 rounded-full border-4 border-dashed border-outline-variant/30"></div>
            <div class="text-center z-10">
              <span class="font-display-sm text-display-sm text-primary" data-sleep-value>${c.sleepHours}</span>
              <span class="block font-label-bold text-label-bold text-on-surface-variant">hrs</span>
            </div>
          </div>
          <button data-sleep="0.5" class="chunky-button w-11 h-11 rounded-full chunky-border bg-surface-container flex items-center justify-center card-shadow">${icon("add")}</button>
        </div>
        <div class="w-full">
          <div class="flex justify-between px-1 mb-2" data-quality-faces>
            ${SLEEP_ROT.map((rot, i) => `<button data-quality="${i}" style="transform:rotate(${rot}deg)" class="material-symbols-outlined ${i === c.sleepQuality ? "text-tertiary-container fill-icon" : "text-outline"}">thumb_up</button>`).join("")}
          </div>
          <div class="h-4 bg-surface-container rounded-full chunky-border relative overflow-hidden">
            <div class="absolute top-0 left-0 h-full bg-tertiary-container" data-quality-fill style="width:${((c.sleepQuality + 1) / 5) * 100}%"></div>
          </div>
        </div>
      </div>
    </article>`;
}

function cardMood(c) {
  return `
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6" data-section="mood">
      <h2 class="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-3 lowercase">${hbadge("mood")} mental state check</h2>
      <div class="flex justify-between items-center" data-mood-row>
        ${MOODS.map((m, i) => moodButton(m, i, c.mood)).join("")}
      </div>
    </article>`;
}

function cardMovement(c) {
  // A checkmark only when Health Sync is actually on; otherwise you add steps yourself.
  const synced = getState().settings.healthSync;
  return `
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6" data-section="movement">
      <div class="flex justify-between items-start mb-4">
        <h2 class="font-headline-md text-headline-md text-on-surface flex items-center gap-3 lowercase">${hbadge("directions_walk")} did you move?</h2>
        ${synced ? `<button data-sync class="chunky-button flex items-center gap-1 bg-surface-container px-2 py-1 rounded-full chunky-border text-xs font-label-bold text-primary">${icon("sync", "text-sm")} Sync</button>` : ""}
      </div>
      <div class="text-center mb-3">
        <span class="font-display-lg text-display-lg text-primary" data-steps>${c.steps.toLocaleString()}</span>
        <span class="block font-body-md text-body-md text-on-surface-variant">steps today</span>
      </div>
      <div class="flex items-center gap-2 justify-center">
        <input data-step-input type="number" inputmode="numeric" min="0" placeholder="add steps" class="w-28 px-3 py-2 rounded-full chunky-border bg-surface-container text-center font-label-bold text-label-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
        <button data-add-steps class="chunky-button px-4 py-2 rounded-full chunky-border card-shadow bg-on-surface text-surface font-label-bold text-label-bold flex items-center gap-1">${icon("add", "text-sm")} Add</button>
      </div>
    </article>`;
}

function cardFood(meals) {
  return `
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6" data-section="food">
      <h2 class="font-headline-md text-headline-md text-on-surface mb-4 flex items-center gap-3 lowercase">${hbadge("restaurant")} fueling the meat suit</h2>
      <button data-log-food class="chunky-button w-full bg-surface-container chunky-border card-shadow rounded-[16px] py-4 flex items-center justify-center gap-2 hover:bg-secondary-container">
        ${icon("add_a_photo", "text-primary")}
        <span class="font-label-bold text-label-bold text-on-surface">Add a bite</span>
      </button>
      <div class="mt-4 flex flex-col gap-2" data-meal-list>
        ${meals.length ? meals.map(mealRow).join("") : `<p class="text-center font-body-md text-sm text-on-surface-variant py-2">Nothing logged yet.</p>`}
      </div>
    </article>`;
}

function cardGratitude(c) {
  return `
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6" data-section="gratitude">
      <h3 class="font-headline-md text-headline-md text-on-surface mb-3 flex items-center gap-3 lowercase">${hbadge("favorite")} grateful for…</h3>
      <textarea data-gratitude rows="3" maxlength="280" placeholder="one small thing. a snack counts." class="w-full px-4 py-3 rounded-2xl chunky-border bg-surface-container font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none">${escNote(c.gratitude)}</textarea>
    </article>`;
}

function cardNote(c) {
  return `
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6" data-section="note">
      <h3 class="font-headline-md text-headline-md text-on-surface mb-3 flex items-center gap-3 lowercase">${hbadge("edit_note")} one line a day</h3>
      <textarea data-note rows="3" maxlength="280" placeholder="anything worth remembering? (or don't — no pressure.)" class="w-full px-4 py-3 rounded-2xl chunky-border bg-surface-container font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none">${escNote(c.note)}</textarea>
    </article>`;
}

// ---- Collapsed summary rows (the "done chip" state) ----
// A tidy, tappable chip: checkmark + the value you logged. Tapping expands it so
// you can still edit anything, any time.
function summaryRow(s, c, meals) {
  const { value, done } = summaryValue(s, c, meals);
  return `
    <button data-expand="${s.id}" class="chunky-button w-full flex items-center gap-3 px-4 py-3 rounded-2xl chunky-border bg-surface-container-lowest card-shadow text-left">
      <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 chunky-border ${done ? "bg-primary-fixed" : "bg-surface-container"}">
        ${icon(done ? "check" : s.icon, `text-[18px] ${done ? "text-primary fill-icon" : "text-on-surface-variant"}`)}
      </span>
      <span class="font-label-bold text-label-bold text-on-surface lowercase flex-1 truncate">${s.label}</span>
      ${value ? `<span class="font-label-bold text-label-bold text-on-surface-variant truncate max-w-[45%] text-right">${value}</span>` : `<span class="text-xs text-on-surface-variant">tap to add</span>`}
      ${icon("chevron_right", "text-on-surface-variant text-lg shrink-0")}
    </button>`;
}

function summaryValue(s, c, meals) {
  switch (s.id) {
    case "sleep":     return { value: `${c.sleepHours} hrs`, done: true };
    case "mood":      return { value: MOOD_WORDS[c.mood] || "—", done: true };
    case "movement":  return { value: `${c.steps.toLocaleString()} steps`, done: c.steps > 0 };
    case "food": {
      const kcal = meals.reduce((sum, m) => sum + (m.kcal || 0), 0);
      return { value: meals.length ? `${meals.length} · ${kcal} kcal` : "", done: meals.length > 0 };
    }
    case "gratitude": return { value: snippet(c.gratitude), done: !!c.gratitude };
    case "note":      return { value: snippet(c.note), done: !!c.note };
    default:          return { value: "", done: false };
  }
}
const MOOD_WORDS = ["rough", "meh", "okay", "good", "glowing"];
function snippet(s) {
  s = String(s || "").trim();
  return s.length > 28 ? escNote(s.slice(0, 27)) + "…" : escNote(s);
}

function moodButton(m, i, active) {
  const on = i === active;
  return `<button data-mood="${i}" class="chunky-button rounded-full chunky-border flex items-center justify-center transition-all ${
    on ? "w-14 h-14 bg-tertiary-fixed card-shadow" : "w-12 h-12 bg-surface-container hover:bg-secondary-container"
  }">
    <span class="material-symbols-outlined ${on ? "text-tertiary text-3xl fill-icon" : ""}">${m}</span>
  </button>`;
}

function mealRow(m) {
  return `<div class="bg-surface py-2 px-3 rounded-lg chunky-border flex items-center gap-3">
    <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center chunky-border">${icon(m.icon || "restaurant", "text-sm text-tertiary-container")}</div>
    <div class="flex-1">
      <p class="font-label-bold text-label-bold text-on-surface">${m.name}</p>
      <p class="text-xs text-on-surface-variant">${m.kcal} kcal • ${m.time}</p>
    </div>
  </div>`;
}

function escNote(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wire(root, name) {
  const rerender = () => renderCheckin(root, { name });

  // Preview (dev) — flip the mode, or return to the live clock.
  root.querySelectorAll("[data-preview]").forEach((b) =>
    b.addEventListener("click", () => {
      const v = b.dataset.preview;
      previewMode = v === "live" ? null : v;
      manualOpen.clear(); // a fresh mode starts cleanly folded
      rerender();
    })
  );

  // Weekly review launcher.
  root.querySelector("[data-review]")?.addEventListener("click", () => {
    location.hash = "#/review";
  });

  // Collapsed chip — expand it (works regardless of the time; 10pm is a nudge, not a lock).
  root.querySelectorAll("[data-expand]").forEach((b) =>
    b.addEventListener("click", () => {
      manualOpen.add(b.dataset.expand);
      rerender();
    })
  );

  // Sleep +/- — updates value and lets Poco react.
  root.querySelectorAll("[data-sleep]").forEach((b) =>
    b.addEventListener("click", () => {
      const c = getTodayCheckin();
      let v = +(c.sleepHours + parseFloat(b.dataset.sleep)).toFixed(1);
      v = Math.max(0, Math.min(14, v));
      saveCheckin({ sleepHours: v });
      if (maybeAutoCommit(root, name)) return;
      root.querySelector("[data-sleep-value]").textContent = v;
      refreshHero(root, name);
    })
  );

  // Sleep quality faces
  root.querySelectorAll("[data-quality]").forEach((b) =>
    b.addEventListener("click", () => {
      const q = +b.dataset.quality;
      saveCheckin({ sleepQuality: q });
      if (maybeAutoCommit(root, name)) return;
      root.querySelectorAll("[data-quality]").forEach((el, i) => {
        el.className = `material-symbols-outlined ${i === q ? "text-tertiary-container fill-icon" : "text-outline"}`;
      });
      root.querySelector("[data-quality-fill]").style.width = `${((q + 1) / 5) * 100}%`;
    })
  );

  // Mood — Poco mirrors it live.
  wireMood(root, name);

  // Add steps — manual entry (no fake randomness).
  const stepInput = root.querySelector("[data-step-input]");
  const addSteps = () => {
    const n = parseInt(stepInput?.value, 10);
    if (!n || n <= 0) return;
    const total = getTodayCheckin().steps + n;
    saveCheckin({ steps: total });
    stepInput.value = "";
    toast(`+${n.toLocaleString()} steps`, "directions_walk");
    if (maybeAutoCommit(root, name)) return;
    root.querySelector("[data-steps]").textContent = total.toLocaleString();
  };
  root.querySelector("[data-add-steps]")?.addEventListener("click", addSteps);
  stepInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") addSteps(); });

  // Pull today's steps/sleep from Fitbit on demand.
  root.querySelector("[data-sync]")?.addEventListener("click", async () => {
    await syncHealth({ silent: false });
    renderCheckin(root, { name });
  });

  // End of the day — grateful-for + one line a day, saved on change.
  root.querySelector("[data-gratitude]")?.addEventListener("change", (e) => {
    saveCheckin({ gratitude: e.target.value.trim() });
    maybeAutoCommit(root, name);
  });
  root.querySelector("[data-note]")?.addEventListener("change", (e) => {
    saveCheckin({ note: e.target.value.trim() });
    maybeAutoCommit(root, name);
  });

  // Food quick log
  root.querySelector("[data-log-food]")?.addEventListener("click", () =>
    logBite(() => renderCheckin(root, { name: getState().profile.name }))
  );

  // Commit today's check-in
  root.querySelector("[data-log-checkin]").addEventListener("click", () => {
    if (isCheckinLoggedToday()) {
      toast(doneTap(), "eco");
      return;
    }
    const res = commitCheckin();
    celebrate();
    if (res.milestone) {
      toast(`🎉 ${res.streak}-day milestone! +${res.awarded} 🌿`, "celebration");
    } else {
      toast(`Logged! ${res.streak}-day streak · +${res.awarded} 🌿`, "local_fire_department");
    }
    renderCheckin(root, { name });
  });
}

function wireMood(root, name) {
  root.querySelectorAll("[data-mood]").forEach((b) =>
    b.addEventListener("click", () => {
      const mood = +b.dataset.mood;
      saveCheckin({ mood });
      if (maybeAutoCommit(root, name)) return;
      const rowEl = root.querySelector("[data-mood-row]");
      rowEl.innerHTML = MOODS.map((m, i) => moodButton(m, i, mood)).join("");
      wireMood(root, name);
      refreshHero(root, name);
    })
  );
}
