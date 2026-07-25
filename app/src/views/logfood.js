// "Log a bite" — the AI-assisted food logging flow.
// Three ways in: snap a Photo, Describe it (with optional voice), or type it in
// by hand. Photo/Describe run through the AI and land on an itemized, editable
// breakdown (name · portion · kcal · macros per item) with a live total,
// nutrition score, and macro bar — BitePal-style. On confirm each item is saved
// as its own entry and a leaf is awarded.
import { addMeal, addPoints } from "../store.js";
import { icon, pocoImg, openModal, closeModal, toast } from "../ui.js";
import {
  analyzeFood, resizeImage, speechSupported, dictate,
} from "../foodai.js";

const MEAL_ICONS = ["restaurant", "breakfast_dining", "lunch_dining", "dinner_dining", "local_cafe", "bakery_dining", "nutrition", "ramen_dining", "egg_alt", "local_pizza", "icecream"];

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
    <!-- No capture attr, so the OS picker offers both Camera and Photo Library. -->
    <input data-file type="file" accept="image/*" class="hidden" />
    <button data-manual class="w-full text-center font-label-bold text-sm text-on-surface-variant py-2 underline decoration-dashed underline-offset-4">or enter it manually</button>
    <button data-cancel class="w-full text-center font-label-bold text-sm text-on-surface-variant py-2 mt-1">Cancel</button>
  `;
  setStage(ctx, html, (el) => {
    el.querySelector("[data-cancel]").addEventListener("click", closeModal);
    el.querySelector("[data-manual]").addEventListener("click", () => renderReview(ctx, [blankItem()], { source: "manual" }));
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
    renderReview(ctx, fromAIItems(data), { source: "photo", note: data.note });
  } catch (e) {
    renderError(ctx, e);
  }
}

// ---- Describe path (text + optional voice) ----
function renderDescribe(ctx) {
  const canVoice = speechSupported();
  const html = `
    <h3 class="font-headline-md text-headline-md text-on-surface mb-1">Describe your meal</h3>
    <p class="font-body-md text-sm text-on-surface-variant mb-4">"a bowl of ramen with an egg and greens", "two oat cookies"…</p>
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
        renderReview(ctx, fromAIItems(data), { source: "voice", note: data.note });
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
      <p class="font-body-md text-xs text-on-surface-variant">Poco's breaking it down…</p>
    </div>
  `);
}

// ---- Error → offer manual ----
function renderError(ctx, err) {
  setStage(ctx, `
    <h3 class="font-headline-md text-headline-md text-on-surface mb-2">Hmm, that didn't work</h3>
    <p class="font-body-md text-body-md text-on-surface-variant mb-5">${esc(err && err.message ? err.message : "Something went sideways.")} You can still log it by hand.</p>
    <div class="flex gap-3">
      <button data-back class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Back</button>
      <button data-manual class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow">Manual entry</button>
    </div>
  `, (el) => {
    el.querySelector("[data-back]").addEventListener("click", () => renderChoose(ctx));
    el.querySelector("[data-manual]").addEventListener("click", () => renderReview(ctx, [blankItem()], { source: "manual" }));
  });
}

// ---- Meal review: an itemized, editable breakdown (BitePal-style) ----
function renderReview(ctx, initialItems, meta) {
  const items = (initialItems && initialItems.length ? initialItems : [blankItem()]).map(normItem);
  let expanded = meta.source === "manual" ? 0 : -1;
  let rating = 0; // 1 = up, -1 = down

  function render() {
    setStage(ctx, reviewHtml(items, expanded, meta, rating), wire);
    if (expanded >= 0) ctx.stageEl.querySelector(`[data-field='name'][data-i='${expanded}']`)?.focus({ preventScroll: true });
  }

  function wire(el) {
    el.querySelector("[data-rate-up]")?.addEventListener("click", () => { rating = 1; toast("Poco preens. 🌿", "thumb_up"); render(); });
    el.querySelector("[data-rate-down]")?.addEventListener("click", () => { rating = -1; toast("Fair. Tweak the numbers below.", "thumb_down"); render(); });

    el.querySelectorAll("[data-expand]").forEach((b) =>
      b.addEventListener("click", () => { const i = +b.dataset.expand; expanded = expanded === i ? -1 : i; render(); }));

    el.querySelectorAll("[data-remove-item]").forEach((b) =>
      b.addEventListener("click", () => {
        items.splice(+b.dataset.removeItem, 1);
        if (!items.length) items.push(blankItem());
        expanded = -1;
        render();
      }));

    el.querySelector("[data-add-item]")?.addEventListener("click", () => { items.push(blankItem()); expanded = items.length - 1; render(); });

    el.querySelectorAll("[data-item-icon]").forEach((b) =>
      b.addEventListener("click", () => { const [i, ic] = b.dataset.itemIcon.split("|"); items[+i].icon = ic; render(); }));

    // Live-edit fields: numeric changes also refresh the summary in place (no
    // full re-render, so focus is never stolen mid-typing).
    el.querySelectorAll("[data-field]").forEach((inp) =>
      inp.addEventListener("input", () => {
        const i = +inp.dataset.i;
        const k = inp.dataset.field;
        if (k === "name" || k === "portion") {
          items[i][k] = inp.value;
        } else {
          const v = parseFloat(inp.value);
          items[i][k] = Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
          const box = el.querySelector("[data-summary]");
          if (box) box.innerHTML = summaryHtml(totals(items));
        }
      }));

    el.querySelector("[data-cancel]").addEventListener("click", closeModal);
    el.querySelector("[data-save]").addEventListener("click", () => {
      const valid = items.filter((it) => it.name.trim());
      if (!valid.length) { toast("Give at least one item a name."); return; }
      const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      valid.forEach((it) => addMeal({
        name: it.name.trim(),
        kcal: it.kcal, protein: it.protein, fat: it.fat, carbs: it.carbs, sugar: it.sugar, fiber: it.fiber,
        icon: it.icon, portion: it.portion.trim(), time, source: meta.source,
      }));
      addPoints(5);
      closeModal();
      toast(valid.length > 1 ? `${valid.length} items logged. +5 🌿` : `${valid[0].name.trim()} added. +5 🌿`);
      if (ctx.onDone) ctx.onDone();
    });
  }

  render();
}

function reviewHtml(items, expanded, meta, rating) {
  const isAI = meta.source !== "manual";
  const rateChip = isAI ? `
    <div class="flex items-center gap-1">
      <button data-rate-up class="chunky-button w-8 h-8 rounded-full chunky-border flex items-center justify-center ${rating === 1 ? "bg-primary text-on-primary" : "bg-surface-container"}">${icon("thumb_up", "text-sm")}</button>
      <button data-rate-down class="chunky-button w-8 h-8 rounded-full chunky-border flex items-center justify-center ${rating === -1 ? "bg-error-container text-error" : "bg-surface-container"}">${icon("thumb_down", "text-sm")}</button>
    </div>` : "";
  return `
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-headline-md text-headline-md text-on-surface lowercase">${isAI ? "check the breakdown" : "new meal"}</h3>
      ${rateChip}
    </div>
    ${meta.note && isAI ? `<div class="bg-[#ffeadc] rounded-2xl chunky-border p-3 mb-3 flex gap-2 items-start"><span class="material-symbols-outlined text-primary text-sm">eco</span><p class="font-body-md text-sm text-on-surface">${esc(meta.note)}</p></div>` : ""}

    <div data-summary>${summaryHtml(totals(items))}</div>

    <div class="flex flex-col gap-2 my-3" data-items>
      ${items.map((it, i) => itemRow(it, i, i === expanded)).join("")}
    </div>

    <button data-add-item class="chunky-button w-full py-2.5 rounded-full border-dashed border-[2.5px] border-outline flex items-center justify-center gap-1 text-on-surface-variant hover:bg-surface-container mb-4">
      ${icon("add", "text-sm")}<span class="font-label-bold text-label-bold">Add an item</span>
    </button>

    <div class="flex gap-3">
      <button data-cancel class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Cancel</button>
      <button data-save class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow">Log it${items.length > 1 ? " all" : ""}</button>
    </div>
  `;
}

// Score + macro bar + total. Re-rendered on the fly as items change.
function summaryHtml(t) {
  const score = nutritionScore(t);
  return `
    <div class="bg-surface-container rounded-2xl chunky-border p-4 flex flex-col gap-3">
      <div class="flex items-end justify-between">
        <div>
          <p class="font-label-bold text-label-bold text-on-surface-variant">Nutrition score</p>
          <p class="font-headline-md text-headline-md ${scoreClass(score)} lowercase">${scoreLabel(score)}</p>
        </div>
        <div class="text-right">
          <span class="font-display-sm text-display-sm ${scoreClass(score)}">${score}</span>
          <span class="block font-body-md text-xs text-on-surface-variant">/ 100</span>
        </div>
      </div>
      ${macroBar(t)}
      <div class="flex items-center justify-between pt-2 border-t-2 border-outline-variant/40">
        <span class="font-label-bold text-label-bold text-on-surface">Total</span>
        <span class="font-headline-md text-headline-md text-on-surface">${t.kcal.toLocaleString()} kcal</span>
      </div>
    </div>
  `;
}

function macroBar(t) {
  const pc = t.protein * 4, cc = t.carbs * 4, fc = t.fat * 9;
  const sum = pc + cc + fc || 1;
  const seg = (v, cls) => `<div class="${cls}" style="width:${(v / sum) * 100}%"></div>`;
  return `
    <div>
      <div class="flex h-3 rounded-full overflow-hidden chunky-border">
        ${seg(cc, "bg-tertiary-container")}${seg(fc, "bg-secondary")}${seg(pc, "bg-primary")}
      </div>
      <div class="flex justify-between mt-1.5 text-xs font-label-bold">
        <span class="text-tertiary">C ${t.carbs}g</span>
        <span class="text-secondary">F ${t.fat}g</span>
        <span class="text-primary">P ${t.protein}g</span>
      </div>
    </div>
  `;
}

function itemRow(it, i, expanded) {
  if (!expanded) {
    return `
      <div class="bg-surface-container-lowest rounded-2xl chunky-border p-3 flex items-center gap-3">
        <div class="w-9 h-9 rounded-full chunky-border bg-surface-container flex items-center justify-center flex-shrink-0">${icon(it.icon || "restaurant", "text-tertiary-container")}</div>
        <div class="flex-1 min-w-0">
          <p class="font-label-bold text-label-bold text-on-surface truncate">${esc(it.name) || "(unnamed)"}</p>
          <p class="text-xs text-on-surface-variant truncate">${it.portion ? esc(it.portion) + " • " : ""}${it.kcal} kcal</p>
        </div>
        <button data-expand="${i}" class="chunky-button w-8 h-8 rounded-full chunky-border bg-surface-container flex items-center justify-center">${icon("edit", "text-sm")}</button>
        <button data-remove-item="${i}" class="chunky-button w-8 h-8 rounded-full chunky-border bg-error-container text-error flex items-center justify-center">${icon("close", "text-sm")}</button>
      </div>`;
  }
  const macro = (k, lbl) => `<div><input data-field="${k}" data-i="${i}" type="number" min="0" value="${it[k] || ""}" placeholder="0" class="w-full px-1 py-2 rounded-lg chunky-border bg-[#ffeadc] font-body-md text-center text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" /><span class="block text-center text-[10px] text-on-surface-variant mt-0.5">${lbl}</span></div>`;
  return `
    <div class="bg-surface-container-lowest rounded-2xl chunky-border p-3 flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <input data-field="name" data-i="${i}" type="text" value="${escAttr(it.name)}" placeholder="food" class="flex-1 px-3 py-2 rounded-lg chunky-border bg-[#ffeadc] font-label-bold text-label-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
        <button data-expand="${i}" class="chunky-button w-8 h-8 rounded-full chunky-border bg-primary text-on-primary flex items-center justify-center">${icon("check", "text-sm")}</button>
        <button data-remove-item="${i}" class="chunky-button w-8 h-8 rounded-full chunky-border bg-error-container text-error flex items-center justify-center">${icon("close", "text-sm")}</button>
      </div>
      <div class="flex items-center gap-2">
        <input data-field="portion" data-i="${i}" type="text" value="${escAttr(it.portion)}" placeholder="portion — e.g. 1 bowl (~400g)" class="flex-1 px-3 py-2 rounded-lg chunky-border bg-[#ffeadc] font-body-md text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
        <div class="flex items-center gap-1">
          <input data-field="kcal" data-i="${i}" type="number" min="0" value="${it.kcal || ""}" placeholder="0" class="w-20 px-2 py-2 rounded-lg chunky-border bg-[#ffeadc] font-body-md text-center text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
          <span class="text-xs text-on-surface-variant">kcal</span>
        </div>
      </div>
      <div class="grid grid-cols-5 gap-1">
        ${macro("protein", "prot")}${macro("carbs", "carb")}${macro("fat", "fat")}${macro("sugar", "sug")}${macro("fiber", "fib")}
      </div>
      <div class="flex flex-wrap gap-1">
        ${MEAL_ICONS.map((ic) => `<button data-item-icon="${i}|${ic}" class="chunky-button w-8 h-8 rounded-full chunky-border flex items-center justify-center ${ic === it.icon ? "bg-primary text-on-primary" : "bg-surface-container"}">${icon(ic, "text-sm")}</button>`).join("")}
      </div>
    </div>`;
}

// ---- scoring ----
function totals(items) {
  const t = { kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, fiber: 0 };
  for (const it of items) {
    t.kcal += it.kcal; t.protein += it.protein; t.fat += it.fat;
    t.carbs += it.carbs; t.sugar += it.sugar; t.fiber += it.fiber;
  }
  return t;
}

// A gentle, non-medical 0–100 "how nourishing" score: protein + fiber help,
// excess sugar hurts. It's vibes, not nutrition science.
function nutritionScore(t) {
  if (!t.kcal) return 0;
  let s = 45;
  s += Math.min(25, t.protein * 0.5);
  s += Math.min(22, t.fiber * 3);
  s -= Math.min(28, Math.max(0, t.sugar - 12) * 0.9);
  return Math.max(5, Math.min(99, Math.round(s)));
}
function scoreLabel(s) {
  if (!s) return "no food?";
  if (s >= 75) return "glowing.";
  if (s >= 60) return "solid.";
  if (s >= 42) return "eh, average.";
  return "beige alert.";
}
function scoreClass(s) {
  if (s >= 60) return "text-primary";
  if (s >= 42) return "text-tertiary";
  return "text-error";
}

// ---- item helpers ----
function blankItem() {
  return { name: "", portion: "", kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, fiber: 0, icon: MEAL_ICONS[0] };
}
function normItem(x) {
  return {
    name: String(x.name || ""),
    portion: String(x.portion || ""),
    kcal: round(x.kcal), protein: round(x.protein), fat: round(x.fat),
    carbs: round(x.carbs), sugar: round(x.sugar), fiber: round(x.fiber),
    icon: MEAL_ICONS.includes(x.icon) ? x.icon : MEAL_ICONS[0],
  };
}
function fromAIItems(data) {
  const arr = (data && Array.isArray(data.items) ? data.items : []).map((d) => ({
    name: d.name || "",
    portion: d.portion || "",
    kcal: round(d.kcal), protein: round(d.protein_g), fat: round(d.fat_g),
    carbs: round(d.carbs_g), sugar: round(d.sugar_g), fiber: round(d.fiber_g),
    icon: d.icon || MEAL_ICONS[0],
  }));
  return arr.length ? arr : [blankItem()];
}

function round(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}
function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
