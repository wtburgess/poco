// First run. Two questions, one screen, thirty seconds.
// Everything here exists so the first streak, the first leaf and the first habit
// belong to the user instead of arriving pre-filled by a demo account.
import { getState, updateProfile, addHabit } from "../store.js";
import { icon, pocoImg } from "../ui.js";

// Each starting point plants one habit, already carrying a target and — more
// importantly — a floor small enough to hit on the worst day of the week.
const STARTS = [
  { id: "sleep",  emoji: "😴", label: "Sleep better",  habit: { name: "Wind down",  icon: "bedtime",          target: "in bed by 11",   floor: "screens down 10 min early" } },
  { id: "move",   emoji: "🚶", label: "Move more",     habit: { name: "Walk",       icon: "directions_walk",  target: "8k steps",       floor: "round the block" } },
  { id: "eat",    emoji: "🥗", label: "Eat better",    habit: { name: "Real meal",  icon: "nutrition",        target: "3 proper meals", floor: "one green thing" } },
  { id: "calm",   emoji: "🧘", label: "Calmer mind",   habit: { name: "Meditate",   icon: "self_improvement", target: "10 min",         floor: "3 breaths" } },
  { id: "read",   emoji: "📖", label: "Read more",     habit: { name: "Read",       icon: "menu_book",        target: "20 min",         floor: "1 page" } },
];

const COLORS = ["primary-fixed", "secondary-fixed", "tertiary-fixed", "surface-variant"];

let picked = null;

export function renderOnboarding(root, onDone) {
  picked = null;
  root.innerHTML = html();
  wire(root, onDone);
}

function html() {
  const name = getState().profile.name || "";
  return `
    <div class="min-h-screen flex flex-col px-container-padding py-8">
      <div class="w-full max-w-md mx-auto flex-1 flex flex-col justify-center gap-6 view-enter">

        <div class="text-center">
          <div class="flex justify-center mb-3">
            <div class="w-28 h-28 rounded-full overflow-hidden chunky-border card-shadow bg-secondary-container flex items-center justify-center">${pocoImg(112)}</div>
          </div>
          <h1 class="font-display-sm text-display-sm text-on-surface mb-1">Hi. I'm Poco.</h1>
          <p class="font-body-md text-body-md text-on-surface-variant">I keep track so you don't have to. Two questions and we're done.</p>
        </div>

        <div class="bg-surface-container-lowest chunky-border card-shadow rounded-[24px] p-5">
          <label class="font-headline-md text-headline-md text-on-surface block mb-3 lowercase">what should I call you?</label>
          <input data-name type="text" value="${escAttr(name)}" maxlength="40" autocomplete="given-name" placeholder="your name"
            class="w-full px-4 py-3 rounded-2xl chunky-border bg-surface-container font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div class="bg-surface-container-lowest chunky-border card-shadow rounded-[24px] p-5">
          <label class="font-headline-md text-headline-md text-on-surface block mb-1 lowercase">what's the one thing you want to change?</label>
          <p class="text-xs text-on-surface-variant mb-3">Pick one. You can add more later — one is how it sticks.</p>
          <div class="flex flex-wrap gap-2" data-starts>
            ${STARTS.map(startChip).join("")}
          </div>
        </div>

        <button data-go class="chunky-button w-full rounded-full px-8 py-4 flex items-center justify-center gap-2 chunky-border card-shadow bg-on-surface text-surface">
          <span class="font-headline-md text-headline-md">Start</span>
          ${icon("arrow_forward")}
        </button>
      </div>
    </div>`;
}

function startChip(s) {
  const on = picked === s.id;
  return `<button data-start="${s.id}" class="chunky-button px-3 py-2 rounded-full chunky-border font-label-bold text-label-bold flex items-center gap-1.5 ${
    on ? "bg-on-surface text-surface card-shadow" : "bg-surface-container text-on-surface"
  }"><span>${s.emoji}</span> ${s.label}</button>`;
}

function escAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function wire(root, onDone) {
  const chips = root.querySelector("[data-starts]");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-start]");
    if (!b) return;
    picked = picked === b.dataset.start ? null : b.dataset.start; // tapping again unpicks
    chips.innerHTML = STARTS.map(startChip).join("");
  });

  root.querySelector("[data-go]").addEventListener("click", () => {
    const typed = root.querySelector("[data-name]").value.trim();
    updateProfile({ name: typed || "friend", onboarded: true });
    const start = STARTS.find((s) => s.id === picked);
    // Skipping the pick is allowed — the habits view has its own empty state, and
    // blocking the way in over an optional question is how you lose someone.
    if (start) addHabit({ ...start.habit, color: COLORS[Math.floor(Math.random() * COLORS.length)] });
    onDone();
  });
}
