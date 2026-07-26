// Weekly habits view — toggle grid, streaks, add/remove habit, progress tree.
import {
  getState, weekKeys, WEEKDAY_LABELS, setHabitDay, habitDayStatus, habitStreak,
  addHabit, removeHabit, addPoints, todayKey, tagDay, getTodayCheckin,
} from "../store.js";
import { icon, pocoImg, shell, toast, openModal, closeModal } from "../ui.js";

const LEAF_COLORS = [
  { name: "Moss", value: "primary-fixed", text: "on-primary-fixed" },
  { name: "Bark", value: "secondary-fixed", text: "on-secondary-fixed" },
  { name: "Mango", value: "tertiary-fixed", text: "on-tertiary-fixed" },
  { name: "Sky", value: "surface-variant", text: "on-surface" },
];
const HABIT_ICONS = ["self_improvement", "menu_book", "directions_walk", "fitness_center", "water_drop", "bedtime", "brush", "code"];

export function renderHabits(root) {
  const { habits } = getState();
  const keys = weekKeys();
  const today = todayKey();
  const todayIdx = keys.indexOf(today);

  // Floor days count half toward progress — kept the streak, but not the full target.
  const totalCells = habits.length * 7;
  const doneCells = habits.reduce(
    (s, h) => s + keys.reduce((n, k) => n + (h.checks[k] ? 1 : h.floorChecks?.[k] ? 0.5 : 0), 0), 0
  );
  const progress = totalCells ? Math.round((doneCells / totalCells) * 100) : 0;

  const body = `
    <div class="flex justify-between items-end mb-2">
      <div>
        <h2 class="font-headline-md text-headline-md text-on-surface">Weekly Habits</h2>
        <p class="font-body-md text-body-md text-on-surface-variant">Keep it growing!</p>
      </div>
      <button data-add-habit class="chunky-button bg-surface-container chunky-border card-shadow px-4 py-2 rounded-full flex items-center gap-2 hover:bg-surface-container-high">
        ${icon("eco", "text-primary")}<span class="font-label-bold text-label-bold text-primary">Add Habit</span>
      </button>
    </div>

    <div class="bg-surface rounded-xl chunky-border card-shadow p-4 overflow-x-auto no-scrollbar">
      <div class="min-w-[560px]">
        <div class="flex mb-4">
          <div class="w-32 flex-shrink-0"></div>
          <div class="flex-1 flex justify-between px-2">
            ${WEEKDAY_LABELS.map((d, i) => `<span class="w-8 text-center font-label-bold text-label-bold ${i === todayIdx ? "text-primary" : "text-on-surface-variant"}">${d}</span>`).join("")}
          </div>
          <div class="w-16 flex-shrink-0 text-center"><span class="font-label-bold text-xs text-on-surface-variant">Streak</span></div>
        </div>
        <div class="flex flex-col gap-3">
          ${habits.length ? habits.map((h) => habitRow(h, keys, today)).join("") : `<p class="text-center py-6 font-body-md text-on-surface-variant">No habits yet — plant your first one 🌱</p>`}
        </div>
      </div>
    </div>

    <p class="flex items-center justify-center gap-4 text-xs font-label-bold text-on-surface-variant -mt-1">
      <span class="flex items-center gap-1"><span class="w-4 h-4 rounded-full bg-primary chunky-border inline-block"></span> Target hit</span>
      <span class="flex items-center gap-1"><span class="w-4 h-4 rounded-full bg-tertiary-fixed chunky-border inline-block"></span> Floor (streak safe)</span>
      <span>tap to cycle</span>
    </p>

    ${energyPrompt()}

    <div class="bg-surface rounded-xl chunky-border card-shadow p-6 mt-2 flex items-center gap-6 relative overflow-hidden">
      <div class="absolute -right-4 -top-4 w-24 h-24 bg-primary-fixed/30 rounded-full blur-xl"></div>
      <div class="w-24 h-32 relative flex-shrink-0 bg-surface-container-low rounded-t-full rounded-b-xl chunky-border overflow-hidden flex items-end justify-center pb-2">
        <div class="absolute bottom-0 w-full bg-primary-fixed transition-all duration-1000" style="height:${progress}%"></div>
        <div class="w-16 h-16 bg-secondary-container chunky-border rounded-full z-10 flex items-center justify-center overflow-hidden">${pocoImg(60)}</div>
      </div>
      <div class="flex-1">
        <h3 class="font-headline-md text-headline-md text-on-surface mb-1">${progressTitle(progress)}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant mb-3">You've completed ${progress}% of your habits this week.</p>
        <div class="w-full h-4 bg-[#ffeadc] rounded-full chunky-border overflow-hidden p-0.5">
          <div class="h-full bg-primary rounded-full transition-all duration-700" style="width:${progress}%"></div>
        </div>
      </div>
    </div>
  `;

  root.innerHTML = shell("habits", body);
  wire(root);
}

function habitRow(h, keys, today) {
  const streak = habitStreak(h);
  const hint = h.target ? `${h.target}${h.floor ? ` · floor: ${h.floor}` : ""}` : (h.floor ? `floor: ${h.floor}` : "");
  return `<div class="flex items-center" data-habit-row="${h.id}">
    <div class="w-32 flex-shrink-0 bg-${h.color} chunky-border leaf-shape px-3 py-2 flex items-center gap-2 group relative">
      ${icon(h.icon, "text-sm")}
      <span class="flex-1 min-w-0">
        <span class="font-label-bold text-label-bold truncate block leading-tight">${h.name}</span>
        ${hint ? `<span class="text-[10px] leading-tight opacity-70 truncate block">${hint}</span>` : ""}
      </span>
      <button data-remove-habit="${h.id}" class="opacity-0 group-hover:opacity-100 transition-opacity">${icon("close", "text-sm")}</button>
    </div>
    <div class="flex-1 flex justify-between px-2 items-center">
      ${keys.map((k) => cell(h, k, k === today)).join("")}
    </div>
    <div class="w-16 flex-shrink-0 flex items-center justify-center gap-1">
      ${icon("local_fire_department", `text-sm ${streak > 0 ? "text-tertiary fill-icon" : "text-on-surface-variant"}`)}
      <span class="font-label-bold text-label-bold ${streak > 0 ? "text-tertiary" : "text-on-surface-variant"}">${streak}</span>
    </div>
  </div>`;
}

// Tri-state cell: none → done (target) → floor (minimum) → none.
function cell(h, dateKey, isToday) {
  const status = habitDayStatus(h, dateKey);
  const style = status === "done"
    ? "bg-primary"
    : status === "floor"
    ? "bg-tertiary-fixed"
    : "bg-[#ffeadc]";
  const glyph = status === "done"
    ? icon("eco", "text-white text-sm fill-icon")
    : status === "floor"
    ? icon("trending_flat", "text-on-tertiary-fixed text-sm")
    : "";
  return `<button data-cell="${h.id}" data-date="${dateKey}"
    class="toy-btn w-8 h-8 rounded-full chunky-border flex items-center justify-center check-blob shadow-sm ${style} ${
      isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-surface" : ""
    }">${glyph}</button>`;
}

function progressTitle(p) {
  if (p >= 80) return "Thriving! 🌳";
  if (p >= 50) return "Growing Strong!";
  if (p >= 20) return "Taking Root";
  return "Just Planted";
}

const NEXT_STATUS = { none: "done", done: "floor", floor: "none" };

function wire(root) {
  root.querySelectorAll("[data-cell]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.cell, date = b.dataset.date;
      const h = getState().habits.find((x) => x.id === id);
      const cur = habitDayStatus(h, date);
      const next = NEXT_STATUS[cur];
      setHabitDay(id, date, next);
      if (cur === "none" && next === "done") {
        addPoints(3);
        toast("Nice. +3 🌿", "eco");
      } else if (next === "floor") {
        toast("Floor counts. Streak safe 🌿", "trending_flat");
      }
      // Completing a habit surfaces an opt-in energy chip (below) — no interrupting popup.
      renderHabits(root);
    })
  );
  // Opt-in energy tag — a chip, not a modal. Appears once/day after a habit is done.
  root.querySelectorAll("[data-energy-tag]").forEach((b) =>
    b.addEventListener("click", () => {
      tagDay(todayKey(), { energy: b.dataset.energyTag });
      toast(`Energy: ${b.dataset.energyTag} ⚡`, "bolt");
      renderHabits(root);
    })
  );
  root.querySelectorAll("[data-remove-habit]").forEach((b) =>
    b.addEventListener("click", () => {
      removeHabit(b.dataset.removeHabit);
      renderHabits(root);
    })
  );
  root.querySelector("[data-add-habit]").addEventListener("click", () => habitModal(() => renderHabits(root)));
}

// Opt-in energy tag: a slim inline chip shown once a day, only after at least one
// habit is done and today's energy isn't set yet. No modal, no interruption.
function energyPrompt() {
  const today = todayKey();
  if (getTodayCheckin().energy) return "";
  const anyDone = getState().habits.some((h) => habitDayStatus(h, today) !== "none");
  if (!anyDone) return "";
  return `
    <div class="bg-surface-container-lowest chunky-border card-shadow rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap -mt-1">
      <span class="font-label-bold text-label-bold text-on-surface flex items-center gap-1">${icon("bolt", "text-sm text-primary fill-icon")} Energy today?</span>
      <div class="flex gap-2 flex-1 justify-end">
        <button data-energy-tag="high" class="chunky-button px-3 py-1.5 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold">⚡ High</button>
        <button data-energy-tag="low" class="chunky-button px-3 py-1.5 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold">🔋 Low</button>
      </div>
    </div>`;
}

function habitModal(onDone) {
  openModal(
    `
    <h3 class="font-headline-md text-headline-md text-on-surface mb-4">Plant a habit</h3>
    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Name</label>
    <input data-field="name" type="text" placeholder="e.g. Stretch" class="w-full mb-4 px-4 py-3 rounded-lg chunky-border bg-[#ffeadc] font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
    <div class="flex gap-3 mb-4">
      <div class="flex-1">
        <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Target 🎯</label>
        <input data-field="target" type="text" placeholder="30 min" class="w-full px-3 py-2.5 rounded-lg chunky-border bg-[#ffeadc] font-body-md text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div class="flex-1">
        <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Floor 🛟</label>
        <input data-field="floor" type="text" placeholder="1 page" class="w-full px-3 py-2.5 rounded-lg chunky-border bg-[#ffeadc] font-body-md text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
    </div>
    <p class="text-xs text-on-surface-variant mb-4 -mt-1 flex items-center gap-1">${icon("info", "text-sm")} The floor is your bad-day minimum — hitting it keeps the streak.</p>
    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-2">Icon</label>
    <div class="flex flex-wrap gap-2 mb-4" data-icons>
      ${HABIT_ICONS.map((ic, i) => `<button data-icon="${ic}" class="chunky-button w-11 h-11 rounded-full chunky-border flex items-center justify-center ${i === 0 ? "bg-primary text-on-primary" : "bg-surface-container"}">${icon(ic)}</button>`).join("")}
    </div>
    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-2">Leaf color</label>
    <div class="flex gap-2 mb-6" data-colors>
      ${LEAF_COLORS.map((c, i) => `<button data-color="${c.value}" class="chunky-button flex-1 py-2 rounded-lg chunky-border bg-${c.value} font-label-bold text-xs text-${c.text} ${i === 0 ? "ring-2 ring-primary ring-offset-1" : ""}">${c.name}</button>`).join("")}
    </div>
    <div class="flex gap-3">
      <button data-cancel class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Cancel</button>
      <button data-save class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow">Plant it</button>
    </div>
  `,
    {
      onMount: (mroot) => {
        let selIcon = HABIT_ICONS[0];
        let selColor = LEAF_COLORS[0].value;
        mroot.querySelectorAll("[data-icon]").forEach((b) =>
          b.addEventListener("click", () => {
            selIcon = b.dataset.icon;
            mroot.querySelectorAll("[data-icon]").forEach((x) => {
              x.className = `chunky-button w-11 h-11 rounded-full chunky-border flex items-center justify-center ${x === b ? "bg-primary text-on-primary" : "bg-surface-container"}`;
            });
          })
        );
        mroot.querySelectorAll("[data-color]").forEach((b) =>
          b.addEventListener("click", () => {
            selColor = b.dataset.color;
            mroot.querySelectorAll("[data-color]").forEach((x) => {
              const c = LEAF_COLORS.find((lc) => lc.value === x.dataset.color);
              x.className = `chunky-button flex-1 py-2 rounded-lg chunky-border bg-${c.value} font-label-bold text-xs text-${c.text} ${x === b ? "ring-2 ring-primary ring-offset-1" : ""}`;
            });
          })
        );
        mroot.querySelector("[data-cancel]").addEventListener("click", closeModal);
        mroot.querySelector("[data-field='name']").focus();
        mroot.querySelector("[data-save]").addEventListener("click", () => {
          const name = mroot.querySelector("[data-field='name']").value.trim();
          if (!name) {
            mroot.querySelector("[data-field='name']").focus();
            return;
          }
          addHabit({
            name, icon: selIcon, color: selColor,
            target: mroot.querySelector("[data-field='target']").value.trim(),
            floor: mroot.querySelector("[data-field='floor']").value.trim(),
          });
          closeModal();
          toast(`${name} planted 🌱`);
          if (onDone) onDone();
        });
      },
    }
  );
}
