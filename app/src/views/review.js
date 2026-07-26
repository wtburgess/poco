// Weekly Review Ritual — a 2–3 minute, card-by-card reflection.
// Four focused steps (Wins → Friction → Calibration → Anchor), then a celebration
// that pins next week's single focus to the check-in dashboard.
import {
  getState, weeklyHabitStats, weeklyCheckinCount, recentStepAvg,
  setWeeklyFocus, updateGoals,
} from "../store.js";
import { icon, pocoSvg, celebrate, toast } from "../ui.js";

const FRICTION = [
  { id: "energy",   label: "Low energy / Fatigue",     emoji: "🔋" },
  { id: "timing",   label: "Poor timing / Out of routine", emoji: "⏰" },
  { id: "friction", label: "Too complex / High friction",  emoji: "🧠" },
  { id: "priority", label: "Lost priority / Distractions",  emoji: "🎯" },
  { id: "other",    label: "Other",                     emoji: "💬" },
];

// Live flow state — reset each time the ritual opens. Nothing here persists except
// the final focus (and an accepted goal change).
let step = 0;
let answers;
let stats;
let goHome;

export function renderReview(root, onExit) {
  step = 0;
  goHome = onExit || (() => { location.hash = "#/checkin"; });
  const s = getState();
  const habit = weeklyHabitStats();
  stats = {
    habit,
    checkins: weeklyCheckinCount(),
    stepGoal: s.goals.steps,
    stepAvg: recentStepAvg(),
  };
  answers = { win: "", friction: new Set(), lesson: "", focus: "", accepted: null };
  render(root);
}

function render(root) {
  root.innerHTML = `
    <div class="review-stage min-h-screen flex flex-col px-container-padding py-6">
      <div class="w-full max-w-xl mx-auto flex-1 flex flex-col">
        ${topBar()}
        <div class="flex-1 flex flex-col justify-center py-4 view-enter" data-step-body>
          ${stepBody()}
        </div>
      </div>
    </div>`;
  wire(root);
}

function topBar() {
  return `
    <div class="flex items-center gap-3 mb-2">
      <button data-exit class="chunky-button w-10 h-10 rounded-full chunky-border bg-surface-container-lowest flex items-center justify-center card-shadow shrink-0">${icon("close")}</button>
      <div class="flex-1 flex gap-1.5">
        ${[0, 1, 2, 3].map((i) => `<div class="h-2.5 flex-1 rounded-full chunky-border ${i <= step ? "bg-primary" : "bg-surface-container"}"></div>`).join("")}
      </div>
      <span class="font-label-bold text-label-bold text-on-surface-variant shrink-0">Step ${step + 1} of 4</span>
    </div>`;
}

function stepBody() {
  switch (step) {
    case 0: return stepWins();
    case 1: return stepFriction();
    case 2: return stepCalibration();
    case 3: return stepAnchor();
    default: return "";
  }
}

// ---- Step 1: Celebrate Wins ----
function stepWins() {
  const { pct } = stats.habit;
  return `
    <div class="flex flex-col gap-5">
      ${header("mood", "Step 1 • Celebrate Your Wins", "Momentum comes from noticing progress, big or small.")}
      <div class="bg-tertiary-fixed chunky-border card-shadow rounded-[20px] p-4 flex items-center gap-3">
        <span class="text-2xl">⚡</span>
        <p class="font-body-md text-body-md text-on-tertiary-fixed"><b>Your Snapshot:</b> You hit <b>${pct}%</b> of your habits and logged <b>${stats.checkins}</b> ${stats.checkins === 1 ? "check-in" : "check-ins"} this week!</p>
      </div>
      <div class="bg-surface-container-lowest chunky-border card-shadow rounded-[20px] p-5">
        <label class="font-headline-md text-headline-md text-on-surface block mb-1">What was your biggest win this week?</label>
        <p class="text-xs text-on-surface-variant mb-3 flex items-center gap-1">${icon("tips_and_updates", "text-sm")} Doesn't have to be huge — small consistency counts.</p>
        <textarea data-win rows="3" maxlength="280" placeholder="e.g., Kept my cool during Thursday's meeting, or hit 3 gym days in a row…" class="w-full px-4 py-3 rounded-2xl chunky-border bg-surface-container font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none">${esc(answers.win)}</textarea>
      </div>
      ${nav("Next: Unpack Friction")}
    </div>`;
}

// ---- Step 2: Friction & Patterns ----
function stepFriction() {
  const low = stats.habit.lowest;
  const obs = low && low.habit
    ? `<b>${esc(low.habit.name)}</b> had the lowest completion rate this week (${low.done}/${low.of} days).`
    : `No habits are set up yet — add a couple and next week we'll spot the patterns.`;
  return `
    <div class="flex flex-col gap-5">
      ${header("troubleshoot", "Step 2 • Spot the Friction", "Missed targets aren't failures — they're feedback.")}
      <div class="bg-secondary-container chunky-border card-shadow rounded-[20px] p-4 flex items-center gap-3">
        <span class="text-2xl">💡</span>
        <p class="font-body-md text-body-md text-on-surface"><b>Observation:</b> ${obs}</p>
      </div>
      <div class="bg-surface-container-lowest chunky-border card-shadow rounded-[20px] p-5">
        <p class="font-headline-md text-headline-md text-on-surface mb-1">What felt like the main obstacle?</p>
        <p class="text-xs text-on-surface-variant mb-3">Select up to 2.</p>
        <div class="flex flex-wrap gap-2" data-pills>
          ${FRICTION.map(pill).join("")}
        </div>
        <label class="font-label-bold text-label-bold text-on-surface-variant block mt-5 mb-2">Anything you learned about your energy or routine?</label>
        <textarea data-lesson rows="2" maxlength="280" placeholder="e.g., Late dinners ruin my evening routine…" class="w-full px-4 py-3 rounded-2xl chunky-border bg-surface-container font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none">${esc(answers.lesson)}</textarea>
      </div>
      ${nav("Next: Target Tuning")}
    </div>`;
}

function pill(p) {
  const on = answers.friction.has(p.id);
  return `<button data-pill="${p.id}" class="chunky-button px-3 py-2 rounded-full chunky-border font-label-bold text-label-bold flex items-center gap-1.5 ${
    on ? "bg-on-surface text-surface card-shadow" : "bg-surface-container text-on-surface"
  }"><span>${p.emoji}</span> ${p.label}</button>`;
}

// ---- Step 3: Adaptive Calibration ----
function suggestedTarget() {
  const { stepGoal, stepAvg } = stats;
  const under = stepAvg > 0 && stepAvg < stepGoal * 0.75;
  // Rebuild target: nudge up from the recent average, rounded to 500, kept below goal.
  const raw = Math.round((stepAvg * 1.1) / 500) * 500;
  const target = Math.min(stepGoal - 500, Math.max(500, raw));
  return { under, target };
}

function stepCalibration() {
  const { under, target } = suggestedTarget();
  const { stepGoal, stepAvg } = stats;
  const inner = under
    ? `
      <div class="bg-surface-container-lowest chunky-border card-shadow rounded-[20px] p-5">
        <div class="flex items-center gap-2 mb-3 font-headline-md text-headline-md text-on-surface">⚖️ Goal Adjustment</div>
        <p class="font-body-md text-body-md text-on-surface mb-4">You've aimed for <b>${stepGoal.toLocaleString()} steps/day</b>, but averaged <b>${stepAvg.toLocaleString()}</b> lately. Lower your target to <b>${target.toLocaleString()}</b> to rebuild momentum?</p>
        <div class="flex flex-col sm:flex-row gap-3">
          <button data-accept class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow ${answers.accepted === true ? "ring-2 ring-on-surface" : ""}">${icon("check", "text-sm")} Accept ${target.toLocaleString()}</button>
          <button data-keep class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container text-on-surface font-label-bold text-label-bold ${answers.accepted === false ? "ring-2 ring-on-surface" : ""}">Keep ${stepGoal.toLocaleString()}</button>
        </div>
      </div>`
    : `
      <div class="bg-primary-fixed chunky-border card-shadow rounded-[20px] p-5 flex items-center gap-3">
        <span class="text-2xl">✅</span>
        <p class="font-body-md text-body-md text-on-primary-container"><b>You're on track</b> — your targets look right-sized. No adjustments needed.</p>
      </div>`;
  return `
    <div class="flex flex-col gap-5">
      ${header("tune", "Step 3 • Adjust Your Load", "A good plan adapts to reality.")}
      ${inner}
      ${nav("Next: The Focus Commitment")}
    </div>`;
}

// ---- Step 4: The One Commitment ----
function stepAnchor() {
  return `
    <div class="flex flex-col gap-5">
      ${header("anchor", "Step 4 • Set Next Week's Anchor", "If you could only achieve ONE main thing next week, what is it?")}
      <div class="bg-surface-container-lowest chunky-border card-shadow rounded-[20px] p-5">
        <label class="font-headline-md text-headline-md text-on-surface block mb-3">My single focus</label>
        <textarea data-focus rows="3" maxlength="200" placeholder="e.g., Go to bed by 11 PM on weeknights to protect morning focus…" class="w-full px-4 py-3 rounded-2xl chunky-border bg-surface-container font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none">${esc(answers.focus)}</textarea>
      </div>
      <button data-finish class="chunky-button w-full rounded-full px-8 py-4 flex items-center gap-3 chunky-border card-shadow justify-center bg-on-surface text-surface hover:-translate-y-0.5">
        <span class="font-headline-md text-headline-md">Finish & Lock In Next Week 🚀</span>
      </button>
    </div>`;
}

// ---- Completion ----
function renderDone(root) {
  celebrate();
  const focus = answers.focus.trim();
  root.innerHTML = `
    <div class="review-stage min-h-screen flex flex-col items-center justify-center px-container-padding py-10">
      <div class="w-full max-w-md mx-auto flex flex-col items-center text-center gap-5 view-enter">
        <div class="w-28 h-28 rounded-full overflow-hidden chunky-border card-shadow bg-secondary-container flex items-center justify-center">${pocoSvg(104, { mood: "ecstatic" })}</div>
        <h1 class="font-display-sm text-display-sm text-on-surface">🎉 Weekly Review Complete!</h1>
        <p class="font-body-lg text-body-lg text-on-surface-variant">Small tweaks lead to big trajectory shifts.</p>
        ${focus ? `
          <div class="w-full bg-tertiary-fixed chunky-border card-shadow rounded-[20px] p-5 text-left">
            <p class="font-label-bold text-label-bold text-on-tertiary-fixed flex items-center gap-1 mb-1">📌 Next Week's Focus</p>
            <p class="font-headline-md text-headline-md text-on-surface">${esc(focus)}</p>
          </div>` : ""}
        <button data-dashboard class="chunky-button w-full rounded-full px-8 py-4 chunky-border card-shadow bg-primary text-on-primary font-label-bold text-label-bold">View Updated Dashboard</button>
      </div>
    </div>`;
  root.querySelector("[data-dashboard]").addEventListener("click", () => goHome());
}

// ---- Shared bits ----
function header(ic, title, sub) {
  return `
    <div class="text-center">
      <div class="flex justify-center mb-3"><span class="w-14 h-14 rounded-2xl chunky-border bg-on-surface text-surface flex items-center justify-center card-shadow">${icon(ic, "text-3xl")}</span></div>
      <h2 class="font-headline-md text-headline-md text-on-surface mb-1">${title}</h2>
      <p class="font-body-md text-body-md text-on-surface-variant max-w-sm mx-auto">${sub}</p>
    </div>`;
}

function nav(nextLabel) {
  return `
    <div class="flex items-center gap-3">
      ${step > 0 ? `<button data-back class="chunky-button w-14 rounded-full py-3.5 chunky-border bg-surface-container flex items-center justify-center">${icon("arrow_back")}</button>` : ""}
      <button data-next class="chunky-button flex-1 rounded-full px-6 py-3.5 chunky-border card-shadow bg-on-surface text-surface font-label-bold text-label-bold flex items-center justify-center gap-2">${nextLabel} ${icon("arrow_forward", "text-sm")}</button>
    </div>`;
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function saveCurrentInputs(root) {
  const win = root.querySelector("[data-win]");
  if (win) answers.win = win.value;
  const lesson = root.querySelector("[data-lesson]");
  if (lesson) answers.lesson = lesson.value;
  const focus = root.querySelector("[data-focus]");
  if (focus) answers.focus = focus.value;
}

function wire(root) {
  root.querySelector("[data-exit]")?.addEventListener("click", () => goHome());

  root.querySelector("[data-next]")?.addEventListener("click", () => {
    saveCurrentInputs(root);
    step = Math.min(3, step + 1);
    render(root);
  });
  root.querySelector("[data-back]")?.addEventListener("click", () => {
    saveCurrentInputs(root);
    step = Math.max(0, step - 1);
    render(root);
  });

  // Friction pills — cap at 2. Delegated on the container so re-rendering the
  // pills never needs a rebind (rebinding here would stack duplicate listeners on
  // the shared nav buttons and skip steps).
  const pills = root.querySelector("[data-pills]");
  pills?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pill]");
    if (!b) return;
    const id = b.dataset.pill;
    if (answers.friction.has(id)) answers.friction.delete(id);
    else if (answers.friction.size < 2) answers.friction.add(id);
    else { toast("Pick your top 2", "info"); return; }
    pills.innerHTML = FRICTION.map(pill).join("");
  });

  // Step 3 — accept / keep the goal adjustment.
  root.querySelector("[data-accept]")?.addEventListener("click", () => {
    const { target } = suggestedTarget();
    updateGoals({ steps: target });
    answers.accepted = true;
    toast(`Target eased to ${target.toLocaleString()} steps 🌿`, "tune");
    render(root);
  });
  root.querySelector("[data-keep]")?.addEventListener("click", () => {
    answers.accepted = false;
    render(root);
  });

  // Finish.
  root.querySelector("[data-finish]")?.addEventListener("click", () => {
    saveCurrentInputs(root);
    setWeeklyFocus(answers.focus.trim());
    renderDone(root);
  });
}
