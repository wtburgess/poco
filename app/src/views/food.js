// Food tracker view + shared meal-adding modal.
import {
  getTodayMeals, addMeal, removeMeal, getState, addPoints, weekKeys,
} from "../store.js";
import { icon, pocoImg, shell, toast, openModal, closeModal, pct } from "../ui.js";

const SUGGESTIONS = [
  '"One more leafy green today? No rush, just a thought."',
  '"A glass of water pairs nicely with a slow afternoon."',
  '"You fueled up well. Poco approves. 🌿"',
  '"Protein\'s a little low — maybe some nuts?"',
];

const MEAL_ICONS = ["breakfast_dining", "lunch_dining", "dinner_dining", "local_cafe", "bakery_dining", "nutrition"];

export function renderFood(root) {
  const meals = getTodayMeals();
  const { goals } = getState();
  const intake = meals.reduce((s, m) => s + (m.kcal || 0), 0);
  const goal = goals.calories;
  const suggestion = SUGGESTIONS[new Date().getDate() % SUGGESTIONS.length];
  const weekTotals = weekIntake();

  const body = `
    <div class="mb-1">
      <h1 class="font-display-lg-mobile text-display-lg-mobile text-on-surface">Food</h1>
      <p class="font-body-lg text-body-lg text-on-surface-variant">Today's harvest, one bite at a time.</p>
    </div>

    <!-- Harvest bowl -->
    <section class="bg-surface-container-lowest organic-border card-shadow p-6 flex flex-col items-center relative overflow-hidden">
      <span class="material-symbols-outlined absolute bottom-2 right-2 text-outline-variant opacity-40 text-3xl">eco</span>
      <h2 class="font-headline-md text-headline-md text-on-surface text-center mb-4">Today's Harvest</h2>
      <div class="relative w-48 h-32 flex items-end justify-center mb-2">
        ${bowlFruit(pct(intake, goal))}
      </div>
      <div class="flex gap-4 w-full mt-2 justify-between items-center bg-surface-container px-4 py-3 rounded-lg chunky-border">
        <div class="flex flex-col items-center flex-1">
          <span class="font-body-md text-body-md text-on-surface-variant">Intake</span>
          <span class="font-headline-md text-headline-md text-primary">${intake.toLocaleString()}</span>
        </div>
        <div class="h-8 w-px bg-on-secondary-fixed opacity-20"></div>
        <div class="flex flex-col items-center flex-1">
          <span class="font-body-md text-body-md text-on-surface-variant">Goal</span>
          <span class="font-headline-md text-headline-md text-on-surface">${goal.toLocaleString()}</span>
        </div>
      </div>
    </section>

    <!-- Macros (estimated from calories) -->
    <section class="flex gap-4 justify-between">
      ${macroRing("Protein", Math.round(intake * 0.075), "primary")}
      ${macroRing("Carbs", Math.round(intake * 0.11), "tertiary-fixed-dim")}
      ${macroRing("Fat", Math.round(intake * 0.035), "secondary")}
    </section>

    <!-- Poco suggests -->
    <section class="bg-[#F2EBD4] organic-border p-5 card-shadow flex gap-4 items-start">
      <div class="w-12 h-12 flex-shrink-0 bg-secondary-container rounded-full chunky-border flex items-center justify-center overflow-hidden">${pocoImg(46)}</div>
      <div>
        <h3 class="font-label-bold text-label-bold text-on-secondary-fixed mb-1 flex items-center gap-2">Poco suggests ${icon("eco", "text-primary text-sm fill-icon")}</h3>
        <p class="font-body-md text-body-md text-on-surface">${suggestion}</p>
      </div>
    </section>

    <!-- Meals list -->
    <section class="flex flex-col gap-2">
      <div class="flex justify-between items-end mb-1">
        <h3 class="font-headline-md text-headline-md text-on-surface">Today's Bites</h3>
        <button data-add-meal class="chunky-button w-9 h-9 rounded-full chunky-border bg-primary text-on-primary flex items-center justify-center card-shadow">${icon("add", "text-sm")}</button>
      </div>
      <div class="flex flex-col gap-2" data-meals>
        ${meals.length ? meals.map(mealCard).join("") : emptyMeals()}
      </div>
    </section>

    <!-- Weekly strip -->
    <section class="mt-2 bg-surface-container organic-border p-4 card-shadow">
      <h3 class="font-label-bold text-label-bold text-on-surface mb-3">Weekly Growth</h3>
      <div class="flex justify-between items-end h-16 px-1">
        ${weekTotals.map(leaf).join("")}
      </div>
    </section>
  `;

  root.innerHTML = shell("food", body);
  wire(root);
}

function bowlFruit(fillPct) {
  const fruits = Math.max(1, Math.round((fillPct / 100) * 4));
  const shapes = [
    `<div class="absolute bottom-8 left-8 w-12 h-12 bg-[#ff6b6b] chunky-border rounded-full rotate-12"></div>`,
    `<div class="absolute bottom-10 right-12 w-14 h-14 bg-tertiary-fixed-dim chunky-border rounded-full -rotate-12"></div>`,
    `<div class="absolute bottom-12 left-16 w-20 h-8 bg-[#ffd93d] chunky-border rotate-45" style="border-radius:50% 50% 0 0/100% 100% 0 0;"></div>`,
    `<div class="absolute bottom-4 right-6 w-10 h-14 bg-primary-fixed chunky-border rotate-[20deg]" style="border-radius:40% 40% 50% 50%;"></div>`,
  ];
  return `
    <div class="absolute bottom-0 w-40 h-16 bg-secondary-container chunky-border z-10" style="border-radius:0 0 80px 80px;"></div>
    ${shapes.slice(0, fruits).join("")}
  `;
}

function macroRing(label, grams, color) {
  return `<div class="flex-1 bg-surface-container-lowest organic-border p-4 flex flex-col items-center card-shadow">
    <div class="w-16 h-16 rounded-full border-4 border-surface-container flex items-center justify-center mb-2 relative">
      <div class="absolute inset-0 border-4 border-${color} rounded-full"></div>
      <span class="font-label-bold text-label-bold text-on-surface">${grams}g</span>
    </div>
    <span class="font-body-md text-sm text-on-surface-variant">${label}</span>
  </div>`;
}

function mealCard(m) {
  return `<div class="bg-surface-container-lowest organic-border p-3 flex items-center gap-4 card-shadow group" data-meal-id="${m.id}">
    <div class="w-12 h-12 rounded-lg chunky-border bg-secondary-container flex items-center justify-center flex-shrink-0">${icon(m.icon || "restaurant", "text-tertiary-container")}</div>
    <div class="flex-1">
      <h4 class="font-label-bold text-label-bold text-on-surface">${m.name}</h4>
      <span class="font-body-md text-sm text-on-surface-variant">${m.kcal} kcal</span>
    </div>
    <span class="font-body-md text-sm text-on-surface-variant">${m.time}</span>
    <button data-remove-meal="${m.id}" class="chunky-button w-8 h-8 rounded-full chunky-border bg-error-container text-error flex items-center justify-center">${icon("close", "text-sm")}</button>
  </div>`;
}

function emptyMeals() {
  return `<div class="bg-surface-container-lowest organic-border p-6 text-center card-shadow">
    <p class="font-body-md text-on-surface-variant">No bites logged yet today.</p>
  </div>`;
}

function leaf({ label, active, today }) {
  const h = active ? Math.min(48, 16 + active / 60) : 12;
  if (!active) {
    return `<div class="flex flex-col items-center gap-1">
      <div class="w-4 h-4 border-2 border-dashed border-outline-variant" style="border-radius:50% 0 50% 50%;"></div>
      <span class="font-body-md text-xs ${today ? "font-bold text-on-surface" : "text-outline-variant"}">${label}</span>
    </div>`;
  }
  return `<div class="flex flex-col items-center gap-1">
    <div class="chunky-border ${today ? "bg-primary-fixed" : "bg-primary"}" style="width:22px;height:${h}px;border-radius:50% 0 50% 50%;"></div>
    <span class="font-body-md text-xs ${today ? "font-bold text-on-surface" : "text-on-surface-variant"}">${label}</span>
  </div>`;
}

function weekIntake() {
  const { meals } = getState();
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().toISOString().slice(0, 10);
  return weekKeys().map((k, i) => ({
    label: labels[i],
    active: (meals[k] || []).reduce((s, m) => s + (m.kcal || 0), 0),
    today: k === today,
  }));
}

function wire(root) {
  root.querySelector("[data-add-meal]").addEventListener("click", () => mealModal(() => renderFood(root)));
  root.querySelectorAll("[data-remove-meal]").forEach((b) =>
    b.addEventListener("click", () => {
      removeMeal(b.dataset.removeMeal);
      renderFood(root);
      toast("Removed", "delete");
    })
  );
}

// ---- Shared meal modal (used by Food + Check-in) ----
export function mealModal(onDone) {
  openModal(
    `
    <h3 class="font-headline-md text-headline-md text-on-surface mb-4">Log a bite</h3>
    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">What did you eat?</label>
    <input data-field="name" type="text" placeholder="e.g. Avocado toast" class="w-full mb-4 px-4 py-3 rounded-lg chunky-border bg-[#F2EBD4] font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Calories (kcal)</label>
    <input data-field="kcal" type="number" min="0" placeholder="350" class="w-full mb-4 px-4 py-3 rounded-lg chunky-border bg-[#F2EBD4] font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-2">Type</label>
    <div class="flex flex-wrap gap-2 mb-6" data-icons>
      ${MEAL_ICONS.map((ic, i) => `<button data-icon="${ic}" class="chunky-button w-11 h-11 rounded-full chunky-border flex items-center justify-center ${i === 0 ? "bg-primary text-on-primary" : "bg-surface-container"}">${icon(ic)}</button>`).join("")}
    </div>
    <div class="flex gap-3">
      <button data-cancel class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Cancel</button>
      <button data-save class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow">Add it</button>
    </div>
  `,
    {
      onMount: (mroot) => {
        let selectedIcon = MEAL_ICONS[0];
        mroot.querySelectorAll("[data-icon]").forEach((b) =>
          b.addEventListener("click", () => {
            selectedIcon = b.dataset.icon;
            mroot.querySelectorAll("[data-icon]").forEach((x) => {
              x.className = `chunky-button w-11 h-11 rounded-full chunky-border flex items-center justify-center ${
                x === b ? "bg-primary text-on-primary" : "bg-surface-container"
              }`;
            });
          })
        );
        mroot.querySelector("[data-cancel]").addEventListener("click", closeModal);
        mroot.querySelector("[data-field='name']").focus();
        mroot.querySelector("[data-save]").addEventListener("click", () => {
          const name = mroot.querySelector("[data-field='name']").value.trim();
          const kcal = parseInt(mroot.querySelector("[data-field='kcal']").value, 10) || 0;
          if (!name) {
            mroot.querySelector("[data-field='name']").focus();
            return;
          }
          const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          addMeal({ name, kcal, time, icon: selectedIcon });
          addPoints(5);
          closeModal();
          toast(`${name} added. +5 🌿`);
          if (onDone) onDone();
        });
      },
    }
  );
}
