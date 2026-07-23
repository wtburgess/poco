// Daily Check-in view — streak-first, reactive Poco, once-a-day commit.
import {
  getTodayCheckin, saveCheckin, getTodayMeals, getState,
  commitCheckin, isCheckinLoggedToday, checkinStreak,
} from "../store.js";
import { icon, pocoSvg, toast, shell, celebrate } from "../ui.js";
import { heroState, doneTap } from "../poco.js";
import { mealModal } from "./food.js";

const MOODS = [
  "sentiment_very_dissatisfied",
  "sentiment_dissatisfied",
  "sentiment_neutral",
  "sentiment_satisfied",
  "sentiment_very_satisfied",
];

export function renderCheckin(root, { name }) {
  const c = getTodayCheckin();
  const meals = getTodayMeals();

  const body = `
    ${heroSection(name)}

    <!-- Sleep -->
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6 relative overflow-hidden">
      <span class="material-symbols-outlined absolute -top-2 -right-2 text-surface-tint opacity-10 text-6xl rotate-45">eco</span>
      <h2 class="font-label-bold text-label-bold text-on-surface mb-6 flex items-center gap-2">
        ${icon("bedtime", "text-tertiary-container")} How did you sleep?
      </h2>
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
            ${MOODS.map((m, i) => `<button data-quality="${i}" class="material-symbols-outlined ${i === c.sleepQuality ? "text-tertiary-container fill-icon" : "text-outline"}">${m}</button>`).join("")}
          </div>
          <div class="h-4 bg-surface-container rounded-full chunky-border relative overflow-hidden">
            <div class="absolute top-0 left-0 h-full bg-tertiary-container" data-quality-fill style="width:${((c.sleepQuality + 1) / 5) * 100}%"></div>
          </div>
        </div>
      </div>
    </article>

    <!-- Mood -->
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6">
      <h2 class="font-label-bold text-label-bold text-on-surface mb-6 flex items-center gap-2">
        ${icon("mood", "text-tertiary-container")} How happy are you today?
      </h2>
      <div class="flex justify-between items-center" data-mood-row>
        ${MOODS.map((m, i) => moodButton(m, i, c.mood)).join("")}
      </div>
    </article>

    <!-- Movement -->
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6">
      <div class="flex justify-between items-start mb-4">
        <h2 class="font-label-bold text-label-bold text-on-surface flex items-center gap-2">${icon("directions_walk", "text-primary")} Movement</h2>
        <div class="flex items-center gap-1 bg-surface-container px-2 py-1 rounded-full chunky-border text-xs font-label-bold text-primary">${icon("sync", "text-sm")} Synced</div>
      </div>
      <div class="text-center mb-2">
        <span class="font-display-lg text-display-lg text-primary" data-steps>${c.steps.toLocaleString()}</span>
        <span class="block font-body-md text-body-md text-on-surface-variant">steps today</span>
      </div>
      <div class="flex justify-center">
        <button data-add-steps class="chunky-button px-4 py-1.5 bg-transparent border-dashed border-[2.5px] border-outline rounded-full flex items-center gap-1 text-on-surface-variant hover:bg-surface-container">
          ${icon("add", "text-sm")} <span class="font-label-bold text-label-bold">Log a walk</span>
        </button>
      </div>
    </article>

    <!-- Food quick log -->
    <article class="bg-surface-container-lowest rounded-[24px] chunky-border card-shadow p-6">
      <h2 class="font-label-bold text-label-bold text-on-surface mb-4 flex items-center gap-2">${icon("restaurant", "text-tertiary-container")} What did you eat?</h2>
      <button data-log-food class="chunky-button w-full bg-surface-container chunky-border card-shadow rounded-[16px] py-4 flex items-center justify-center gap-2 hover:bg-secondary-container">
        ${icon("add_a_photo", "text-primary")}
        <span class="font-label-bold text-label-bold text-on-surface">Add a bite</span>
      </button>
      <div class="mt-4 flex flex-col gap-2" data-meal-list>
        ${meals.length ? meals.map(mealRow).join("") : `<p class="text-center font-body-md text-sm text-on-surface-variant py-2">Nothing logged yet.</p>`}
      </div>
    </article>

    <div class="h-4"></div>
    ${ctaHtml()}
  `;

  root.innerHTML = shell("checkin", body);
  wire(root, name);
}

// ---- Reactive hero ----
function heroSection(name, pop = false) {
  const { mood, title, sub } = heroState(name);
  return `
    <section class="text-center mb-2" data-hero>
      <div class="flex justify-center mb-3">
        <div class="w-40 h-40 flex items-center justify-center ${pop ? "poco-pop" : ""}" data-poco>${pocoSvg(150, { mood, alive: true })}</div>
      </div>
      <div class="flex justify-center mb-3">${streakBadge()}</div>
      <h1 class="font-headline-md text-headline-md text-on-background mb-1">${title}</h1>
      <p class="font-body-md text-body-md text-on-surface-variant max-w-sm mx-auto">${sub}</p>
    </section>`;
}

function streakBadge() {
  const s = checkinStreak();
  const logged = isCheckinLoggedToday();
  if (s <= 0 && !logged) {
    return `<div class="inline-flex items-center gap-2 bg-surface-container px-4 py-1.5 rounded-full chunky-border font-label-bold text-label-bold text-on-surface-variant">🌱 Start a streak today</div>`;
  }
  return `<div class="inline-flex items-center gap-2 bg-tertiary-fixed px-4 py-1.5 rounded-full chunky-border card-shadow font-label-bold text-label-bold text-on-tertiary-fixed">
    ${icon("local_fire_department", "streak-flame text-tertiary fill-icon")} ${s}-day streak
  </div>`;
}

function ctaHtml() {
  const logged = isCheckinLoggedToday();
  const base = "chunky-button fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 md:left-auto md:right-8 md:translate-x-0 rounded-full px-8 py-4 flex items-center gap-3 chunky-border card-shadow z-40 w-[calc(100%-48px)] max-w-sm md:w-auto justify-center";
  if (logged) {
    return `<button data-log-checkin class="${base} checkin-done">
      ${icon("check_circle", "fill-icon")}
      <span class="font-label-bold text-label-bold text-lg">Logged — see you tomorrow</span>
    </button>`;
  }
  return `<button data-log-checkin class="${base} bg-primary text-on-primary hover:bg-surface-tint">
    <span class="font-label-bold text-label-bold text-lg">Log today, slowly</span>
    <div class="bg-primary-container px-2 py-1 rounded-full flex items-center gap-1 chunky-border border-on-primary-container/20">
      ${icon("energy_savings_leaf", "text-sm")}<span class="font-label-bold text-xs">+15</span>
    </div>
  </button>`;
}

function refreshHero(root, name, pop = false) {
  const heroEl = root.querySelector("[data-hero]");
  if (heroEl) heroEl.outerHTML = heroSection(name, pop);
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

function wire(root, name) {
  // Sleep +/- — updates value and lets Poco react.
  root.querySelectorAll("[data-sleep]").forEach((b) =>
    b.addEventListener("click", () => {
      const c = getTodayCheckin();
      let v = +(c.sleepHours + parseFloat(b.dataset.sleep)).toFixed(1);
      v = Math.max(0, Math.min(14, v));
      saveCheckin({ sleepHours: v });
      root.querySelector("[data-sleep-value]").textContent = v;
      refreshHero(root, name);
    })
  );

  // Sleep quality faces
  root.querySelectorAll("[data-quality]").forEach((b) =>
    b.addEventListener("click", () => {
      const q = +b.dataset.quality;
      saveCheckin({ sleepQuality: q });
      root.querySelectorAll("[data-quality]").forEach((el, i) => {
        el.className = `material-symbols-outlined ${i === q ? "text-tertiary-container fill-icon" : "text-outline"}`;
      });
      root.querySelector("[data-quality-fill]").style.width = `${((q + 1) / 5) * 100}%`;
    })
  );

  // Mood — Poco mirrors it live.
  wireMood(root, name);

  // Add steps
  root.querySelector("[data-add-steps]").addEventListener("click", () => {
    const c = getTodayCheckin();
    const add = 500 + Math.floor(Math.random() * 1200);
    saveCheckin({ steps: c.steps + add });
    root.querySelector("[data-steps]").textContent = (c.steps + add).toLocaleString();
    toast(`+${add.toLocaleString()} steps logged`, "directions_walk");
  });

  // Food quick log
  root.querySelector("[data-log-food]").addEventListener("click", () =>
    mealModal(() => renderCheckin(root, { name: getState().profile.name }))
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
    // Full re-render: updates leaf count in the top bar, flips the CTA, and
    // pops a freshly-proud Poco.
    renderCheckin(root, { name });
    root.querySelector("[data-poco]")?.classList.add("poco-pop");
  });
}

function wireMood(root, name) {
  root.querySelectorAll("[data-mood]").forEach((b) =>
    b.addEventListener("click", () => {
      const mood = +b.dataset.mood;
      saveCheckin({ mood });
      const rowEl = root.querySelector("[data-mood-row]");
      rowEl.innerHTML = MOODS.map((m, i) => moodButton(m, i, mood)).join("");
      wireMood(root, name);
      refreshHero(root, name);
    })
  );
}
