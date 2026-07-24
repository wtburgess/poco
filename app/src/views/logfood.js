// "Log a bite" — the AI-assisted food logging flow.
// Three ways in: snap a Photo, Describe it (with optional voice), or type it in
// by hand. Photo/Describe run through Claude and land on an editable approval
// card; manual entry goes straight to that card with blank fields. On confirm we
// persist the full macro set and award a leaf.
import { addMeal, addPoints } from "../store.js";
import { icon, pocoImg, openModal, closeModal, toast } from "../ui.js";
import {
  analyzeFood, resizeImage, speechSupported, dictate,
} from "../foodai.js";

const MEAL_ICONS = ["restaurant", "breakfast_dining", "lunch_dining", "dinner_dining", "local_cafe", "bakery_dining", "nutrition"];

const inputCls = "w-full px-4 py-3 rounded-lg chunky-border bg-[#ffeadc] font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";

// Public entry point. Routes checkin.js + food.js "add a bite" here.
export function logBite(onDone) {
  openModal("<div data-stage></div>", {
    onMount: (root) => {
      const stageEl = root.querySelector("[data-stage]");
      const ctx = { stageEl, onDone };
      renderChoose(ctx);
    },
  });
}

function setStage(ctx, html, wire) {
  ctx.stageEl.innerHTML = html;
  if (wire) wire(ctx.stageEl);
}

// ---- Stage 1: how do you want to log? ----
// The photo/describe options always show. If the AI backend isn't set up (or
// you're on localhost with no /api), tapping through lands on a clear message
// with a manual fallback — rather than the buttons silently disappearing.
function renderChoose(ctx) {
  const html = `
    <div class="flex items-center gap-3 mb-4">
      <div class="w-11 h-11 flex-shrink-0 bg-secondary-container rounded-full chunky-border flex items-center justify-center overflow-hidden">${pocoImg(42)}</div>
      <div>
        <h3 class="font-headline-md text-headline-md text-on-surface">Log a bite</h3>
        <p class="font-body-md text-sm text-on-surface-variant">Snap it, say it, or type it.</p>
      </div>
    </div>
    <div class="flex flex-col gap-3 mb-3">
      <button data-photo class="chunky-button w-full bg-primary text-on-primary chunky-border card-shadow rounded-[16px] py-4 flex items-center justify-center gap-2">
        ${icon("photo_camera", "fill-icon")}<span class="font-label-bold text-label-bold">Snap a photo</span>
      </button>
      <button data-describe class="chunky-button w-full bg-surface-container chunky-border card-shadow rounded-[16px] py-4 flex items-center justify-center gap-2 hover:bg-secondary-container">
        ${icon("mic", "text-primary")}<span class="font-label-bold text-label-bold text-on-surface">Describe it</span>
      </button>
    </div>
    <input data-file type="file" accept="image/*" capture="environment" class="hidden" />
    <button data-manual class="w-full text-center font-label-bold text-sm text-on-surface-variant py-2 underline decoration-dashed underline-offset-4">or enter it manually</button>
    <button data-cancel class="w-full text-center font-label-bold text-sm text-on-surface-variant py-2 mt-1">Cancel</button>
  `;
  setStage(ctx, html, (el) => {
    el.querySelector("[data-cancel]").addEventListener("click", closeModal);
    el.querySelector("[data-manual]").addEventListener("click", () => renderApproval(ctx, blankMeal(), { source: "manual" }));
    const file = el.querySelector("[data-file]");
    el.querySelector("[data-photo]").addEventListener("click", () => file.click());
    file.addEventListener("change", () => {
      if (file.files && file.files[0]) handlePhoto(ctx, file.files[0]);
    });
    el.querySelector("[data-describe]").addEventListener("click", () => renderDescribe(ctx));
  });
}

// ---- Photo path ----
async function handlePhoto(ctx, file) {
  renderAnalyzing(ctx, "Looking at your plate…");
  try {
    const image = await resizeImage(file, 1024, 0.8);
    const data = await analyzeFood({ image });
    renderApproval(ctx, fromAI(data), { source: "photo" });
  } catch (e) {
    renderError(ctx, e);
  }
}

// ---- Describe path (text + optional voice) ----
function renderDescribe(ctx) {
  const canVoice = speechSupported();
  const html = `
    <h3 class="font-headline-md text-headline-md text-on-surface mb-1">Describe your bite</h3>
    <p class="font-body-md text-sm text-on-surface-variant mb-4">"a bowl of ramen with an egg", "two oat cookies"…</p>
    <div class="relative mb-4">
      <textarea data-text rows="3" placeholder="What did you eat?" class="${inputCls} resize-none pr-12"></textarea>
      ${canVoice ? `<button data-mic class="chunky-button absolute right-2 bottom-2 w-9 h-9 rounded-full chunky-border bg-surface-container flex items-center justify-center">${icon("mic", "text-primary text-sm")}</button>` : ""}
    </div>
    <div class="flex gap-3">
      <button data-back class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Back</button>
      <button data-go class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow">Analyze</button>
    </div>
  `;
  setStage(ctx, html, (el) => {
    const ta = el.querySelector("[data-text]");
    ta.focus();
    el.querySelector("[data-back]").addEventListener("click", () => renderChoose(ctx));
    el.querySelector("[data-go]").addEventListener("click", async () => {
      const text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      renderAnalyzing(ctx, "Doing the math…");
      try {
        const data = await analyzeFood({ text });
        renderApproval(ctx, fromAI(data), { source: "voice" });
      } catch (e) {
        renderError(ctx, e);
      }
    });
    const mic = el.querySelector("[data-mic]");
    if (mic) wireMic(mic, ta);
  });
}

function wireMic(mic, ta) {
  let stop = null;
  let base = "";
  mic.addEventListener("click", () => {
    if (stop) { stop(); return; }
    base = ta.value ? ta.value.trim() + " " : "";
    mic.classList.add("bg-primary", "text-on-primary");
    stop = dictate({
      onResult: (text) => { ta.value = base + text; },
      onEnd: () => { stop = null; mic.classList.remove("bg-primary", "text-on-primary"); },
      onError: () => {
        stop = null;
        mic.classList.remove("bg-primary", "text-on-primary");
        toast("Voice input didn't work — type instead.", "mic_off");
      },
    });
  });
}

// ---- Analyzing spinner ----
function renderAnalyzing(ctx, label) {
  setStage(ctx, `
    <div class="flex flex-col items-center justify-center py-8 gap-4">
      <div class="w-20 h-20 rounded-full chunky-border bg-secondary-container flex items-center justify-center overflow-hidden poco-pop">${pocoImg(72)}</div>
      <div class="flex items-center gap-2 text-on-surface-variant">
        <span class="material-symbols-outlined animate-spin">progress_activity</span>
        <span class="font-label-bold text-label-bold">${label}</span>
      </div>
      <p class="font-body-md text-xs text-on-surface-variant">Poco's guessing your macros…</p>
    </div>
  `);
}

// ---- Error → offer manual ----
function renderError(ctx, err) {
  setStage(ctx, `
    <h3 class="font-headline-md text-headline-md text-on-surface mb-2">Hmm, that didn't work</h3>
    <p class="font-body-md text-body-md text-on-surface-variant mb-5">${err && err.message ? err.message : "Something went sideways."} You can still log it by hand.</p>
    <div class="flex gap-3">
      <button data-back class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Back</button>
      <button data-manual class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow">Manual entry</button>
    </div>
  `, (el) => {
    el.querySelector("[data-back]").addEventListener("click", () => renderChoose(ctx));
    el.querySelector("[data-manual]").addEventListener("click", () => renderApproval(ctx, blankMeal(), { source: "manual" }));
  });
}

// ---- Approval / edit card ----
function renderApproval(ctx, meal, { source }) {
  const confBadge = meal.confidence && source !== "manual"
    ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full chunky-border text-xs font-label-bold ${confClass(meal.confidence)}">${icon("insights", "text-xs")} ${meal.confidence}</span>`
    : "";
  const html = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-headline-md text-headline-md text-on-surface">${source === "manual" ? "New bite" : "Check Poco's guess"}</h3>
      ${confBadge}
    </div>
    ${meal.note && source !== "manual" ? `<div class="bg-[#ffeadc] organic-border p-3 mb-4 flex gap-2 items-start"><span class="material-symbols-outlined text-primary text-sm">eco</span><p class="font-body-md text-sm text-on-surface">${meal.note}</p></div>` : ""}

    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Food</label>
    <input data-f="name" type="text" value="${escAttr(meal.name)}" placeholder="e.g. Avocado toast" class="${inputCls} mb-3" />

    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Calories (kcal)</label>
    <input data-f="kcal" type="number" min="0" value="${meal.kcal || ""}" placeholder="350" class="${inputCls} mb-3" />

    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-1">Macros (g)</label>
    <div class="grid grid-cols-3 gap-2 mb-3">
      ${macroInput("protein", "Protein", meal.protein)}
      ${macroInput("carbs", "Carbs", meal.carbs)}
      ${macroInput("fat", "Fat", meal.fat)}
      ${macroInput("sugar", "Sugar", meal.sugar)}
      ${macroInput("fiber", "Fiber", meal.fiber)}
    </div>

    <label class="block font-label-bold text-label-bold text-on-surface-variant mb-2">Type</label>
    <div class="flex flex-wrap gap-2 mb-5" data-icons>
      ${MEAL_ICONS.map((ic) => `<button data-icon="${ic}" class="chunky-button w-11 h-11 rounded-full chunky-border flex items-center justify-center ${ic === meal.icon ? "bg-primary text-on-primary" : "bg-surface-container"}">${icon(ic)}</button>`).join("")}
    </div>

    <div class="flex gap-3">
      <button data-cancel class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Cancel</button>
      <button data-save class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow">Add it</button>
    </div>
  `;
  setStage(ctx, html, (el) => {
    let selectedIcon = MEAL_ICONS.includes(meal.icon) ? meal.icon : MEAL_ICONS[0];
    el.querySelectorAll("[data-icon]").forEach((b) =>
      b.addEventListener("click", () => {
        selectedIcon = b.dataset.icon;
        el.querySelectorAll("[data-icon]").forEach((x) => {
          x.className = `chunky-button w-11 h-11 rounded-full chunky-border flex items-center justify-center ${x === b ? "bg-primary text-on-primary" : "bg-surface-container"}`;
        });
      })
    );
    el.querySelector("[data-cancel]").addEventListener("click", closeModal);
    if (source === "manual") el.querySelector("[data-f='name']").focus();
    el.querySelector("[data-save]").addEventListener("click", () => {
      const name = el.querySelector("[data-f='name']").value.trim();
      if (!name) { el.querySelector("[data-f='name']").focus(); return; }
      const num = (k) => {
        const v = parseFloat(el.querySelector(`[data-f='${k}']`).value);
        return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
      };
      const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      addMeal({
        name,
        kcal: num("kcal"),
        protein: num("protein"),
        fat: num("fat"),
        carbs: num("carbs"),
        sugar: num("sugar"),
        fiber: num("fiber"),
        icon: selectedIcon,
        time,
        source,
      });
      addPoints(5);
      closeModal();
      toast(`${name} added. +5 🌿`);
      if (ctx.onDone) ctx.onDone();
    });
  });
}

function macroInput(key, label, val) {
  return `<div>
    <input data-f="${key}" type="number" min="0" value="${val != null && val !== "" ? val : ""}" placeholder="0" class="w-full px-2 py-2 rounded-lg chunky-border bg-[#ffeadc] font-body-md text-center text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
    <span class="block text-center font-body-md text-xs text-on-surface-variant mt-1">${label}</span>
  </div>`;
}

// ---- helpers ----
function blankMeal() {
  return { name: "", kcal: "", protein: "", fat: "", carbs: "", sugar: "", fiber: "", icon: MEAL_ICONS[0] };
}

function fromAI(d) {
  return {
    name: d.name || "",
    kcal: round(d.kcal),
    protein: round(d.protein_g),
    fat: round(d.fat_g),
    carbs: round(d.carbs_g),
    sugar: round(d.sugar_g),
    fiber: round(d.fiber_g),
    icon: d.icon || MEAL_ICONS[0],
    confidence: d.confidence,
    note: d.note,
    serving: d.serving,
  };
}

function round(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

function confClass(c) {
  if (c === "high") return "bg-tertiary-fixed text-on-tertiary-fixed";
  if (c === "low") return "bg-error-container text-error";
  return "bg-surface-container text-on-surface-variant";
}

function escAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
