// "Log a bite" — the AI-assisted food logging flow.
// Three ways in: snap a Photo, Describe it (with optional voice), or type it in
// by hand. Photo/Describe run through the AI and land on an itemized, editable
// breakdown (name · portion · kcal · macros per item) with a live total,
// nutrition score, and macro bar — BitePal-style. On confirm each item is saved
// as its own entry and a leaf is awarded.
import {
  addMeal, addPoints, recentMeals, getFavorites, addFavorite, removeFavorite,
} from "../store.js";
import { icon, pocoImg, openModal, closeModal, toast } from "../ui.js";
import {
  analyzeFood, resizeImage, speechSupported, dictate,
} from "../foodai.js";

const MEAL_ICONS = ["restaurant", "breakfast_dining", "lunch_dining", "dinner_dining", "local_cafe", "bakery_dining", "nutrition", "ramen_dining", "egg_alt", "local_pizza", "icecream"];

const inputCls = "w-full px-4 py-3 rounded-lg chunky-border bg-[#ffeadc] font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";

// Starter dishes so the picker isn't empty on day one. These are templates, not
// history — tapping one opens the review screen so the portions get a sanity check
// before anything is logged. Figures are ordinary-serving estimates, same class of
// guess the AI makes. Once you save your own, these step aside.
const COMMON_DISHES = [
  {
    name: "Porridge & berries", icon: "breakfast_dining",
    items: [
      { name: "Porridge oats", portion: "50g dry", kcal: 190, protein: 7, carbs: 33, fat: 4, sugar: 1, fiber: 5, icon: "breakfast_dining" },
      { name: "Semi-skimmed milk", portion: "200ml", kcal: 100, protein: 7, carbs: 10, fat: 4, sugar: 10, fiber: 0, icon: "local_cafe" },
      { name: "Blueberries", portion: "80g", kcal: 45, protein: 1, carbs: 11, fat: 0, sugar: 8, fiber: 2, icon: "nutrition" },
    ],
  },
  {
    name: "Chicken salad", icon: "lunch_dining",
    items: [
      { name: "Grilled chicken breast", portion: "150g", kcal: 250, protein: 47, carbs: 0, fat: 6, sugar: 0, fiber: 0, icon: "set_meal" },
      { name: "Mixed leaves", portion: "80g", kcal: 20, protein: 2, carbs: 3, fat: 0, sugar: 1, fiber: 2, icon: "nutrition" },
      { name: "Cherry tomatoes", portion: "100g", kcal: 18, protein: 1, carbs: 4, fat: 0, sugar: 3, fiber: 1, icon: "nutrition" },
      { name: "Olive oil dressing", portion: "1 tbsp", kcal: 120, protein: 0, carbs: 0, fat: 14, sugar: 0, fiber: 0, icon: "restaurant" },
    ],
  },
  {
    name: "Spaghetti bolognese", icon: "dinner_dining",
    items: [
      { name: "Spaghetti, cooked", portion: "200g", kcal: 310, protein: 11, carbs: 62, fat: 2, sugar: 2, fiber: 3, icon: "ramen_dining" },
      { name: "Beef mince (5%)", portion: "125g", kcal: 215, protein: 26, carbs: 0, fat: 12, sugar: 0, fiber: 0, icon: "set_meal" },
      { name: "Tomato sauce", portion: "150g", kcal: 80, protein: 2, carbs: 11, fat: 3, sugar: 8, fiber: 2, icon: "nutrition" },
      { name: "Parmesan", portion: "15g", kcal: 60, protein: 6, carbs: 0, fat: 4, sugar: 0, fiber: 0, icon: "restaurant" },
    ],
  },
  {
    name: "Avocado toast & egg", icon: "bakery_dining",
    items: [
      { name: "Sourdough toast", portion: "2 slices (90g)", kcal: 230, protein: 8, carbs: 45, fat: 2, sugar: 2, fiber: 3, icon: "bakery_dining" },
      { name: "Avocado", portion: "half (75g)", kcal: 120, protein: 2, carbs: 6, fat: 11, sugar: 0, fiber: 5, icon: "nutrition" },
      { name: "Fried egg", portion: "1 egg", kcal: 90, protein: 7, carbs: 0, fat: 7, sugar: 0, fiber: 0, icon: "egg_alt" },
    ],
  },
  {
    name: "Ramen bowl", icon: "ramen_dining",
    items: [
      { name: "Ramen noodles & broth", portion: "1 bowl (~400g)", kcal: 380, protein: 12, carbs: 58, fat: 10, sugar: 3, fiber: 3, icon: "ramen_dining" },
      { name: "Soft-boiled egg", portion: "1 egg", kcal: 70, protein: 6, carbs: 0, fat: 5, sugar: 0, fiber: 0, icon: "egg_alt" },
      { name: "Chashu pork", portion: "60g", kcal: 160, protein: 12, carbs: 1, fat: 12, sugar: 0, fiber: 0, icon: "set_meal" },
      { name: "Greens & spring onion", portion: "60g", kcal: 25, protein: 2, carbs: 4, fat: 0, sugar: 1, fiber: 2, icon: "nutrition" },
    ],
  },
  {
    name: "Yoghurt & granola", icon: "breakfast_dining",
    items: [
      { name: "Greek yoghurt (0%)", portion: "170g pot", kcal: 100, protein: 17, carbs: 6, fat: 0, sugar: 6, fiber: 0, icon: "local_cafe" },
      { name: "Granola", portion: "45g", kcal: 200, protein: 5, carbs: 30, fat: 7, sugar: 9, fiber: 4, icon: "breakfast_dining" },
      { name: "Honey", portion: "1 tsp", kcal: 20, protein: 0, carbs: 6, fat: 0, sugar: 6, fiber: 0, icon: "nutrition" },
    ],
  },
];

const dishKcal = (d) => d.items.reduce((s, it) => s + (it.kcal || 0), 0);

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
  const recents = recentMeals(6);
  const favs = getFavorites();
  // Once a starter dish is saved, yours is the only copy worth showing.
  const commons = COMMON_DISHES.filter((d) => !favs.some((f) => f.name.toLowerCase() === d.name.toLowerCase()));
  const html = `
    <div class="flex items-center gap-3 mb-4">
      <div class="w-11 h-11 flex-shrink-0 bg-secondary-container rounded-full chunky-border flex items-center justify-center overflow-hidden">${pocoImg(42)}</div>
      <div>
        <h3 class="font-headline-md text-headline-md text-on-surface">Log a bite</h3>
        <p class="font-body-md text-sm text-on-surface-variant">Snap it, say it, or type it.</p>
      </div>
    </div>
    <div class="flex gap-3 mb-3">
      <button data-camera class="chunky-button flex-1 bg-primary text-on-primary chunky-border card-shadow rounded-[16px] py-4 flex flex-col items-center justify-center gap-1">
        ${icon("photo_camera", "fill-icon")}<span class="font-label-bold text-label-bold">Camera</span>
      </button>
      <button data-gallery class="chunky-button flex-1 bg-secondary-container chunky-border card-shadow rounded-[16px] py-4 flex flex-col items-center justify-center gap-1">
        ${icon("photo_library", "text-primary")}<span class="font-label-bold text-label-bold text-on-surface">Gallery</span>
      </button>
    </div>
    <button data-describe class="chunky-button w-full bg-surface-container chunky-border card-shadow rounded-[16px] py-4 flex items-center justify-center gap-2 hover:bg-secondary-container mb-3">
      ${icon("mic", "text-primary")}<span class="font-label-bold text-label-bold text-on-surface">Describe it</span>
    </button>
    ${favs.length ? `
      <div class="mb-3">
        <p class="font-label-bold text-[11px] text-on-surface-variant uppercase tracking-wide mb-2">Your dishes · logs everything in one tap</p>
        <div class="flex flex-col gap-2">
          ${favs.map((f, i) => `
            <div class="flex items-center gap-2">
              <button data-fav="${i}" class="chunky-button flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-2xl chunky-border card-shadow bg-primary-fixed text-on-primary-container text-left">
                ${icon(f.icon || "restaurant", "text-sm shrink-0")}
                <span class="font-label-bold text-label-bold flex-1 min-w-0 truncate">${esc(f.name)}</span>
                <span class="text-xs shrink-0">${f.items.length} · ${dishKcal(f)} kcal</span>
              </button>
              <button data-unfav="${i}" aria-label="Remove ${escAttr(f.name)} from favourites" class="chunky-button w-9 h-9 shrink-0 rounded-full chunky-border bg-surface-container text-on-surface-variant flex items-center justify-center">${icon("star", "text-sm text-tertiary fill-icon")}</button>
            </div>`).join("")}
        </div>
      </div>` : ""}

    ${commons.length && favs.length < 3 ? `
      <div class="mb-3">
        <p class="font-label-bold text-[11px] text-on-surface-variant uppercase tracking-wide mb-2">Common dishes · tap to adjust</p>
        <div class="flex flex-wrap gap-2">
          ${commons.map((d, i) => `
            <button data-dish="${i}" class="chunky-button flex items-center gap-1.5 pl-2 pr-3 py-2 rounded-full chunky-border bg-surface-container text-on-surface">
              ${icon(d.icon, "text-sm text-primary")}
              <span class="font-label-bold text-label-bold">${esc(d.name)}</span>
              <span class="text-xs text-on-surface-variant">${dishKcal(d)}</span>
            </button>`).join("")}
        </div>
      </div>` : ""}

    ${recents.length ? `
      <div class="mb-3">
        <p class="font-label-bold text-[11px] text-on-surface-variant uppercase tracking-wide mb-2">Again?</p>
        <div class="flex flex-wrap gap-2">
          ${recents.map((m, i) => `
            <button data-again="${i}" class="chunky-button flex items-center gap-1.5 pl-2 pr-3 py-2 rounded-full chunky-border bg-surface-container text-on-surface">
              ${icon(m.icon || "restaurant", "text-sm text-primary")}
              <span class="font-label-bold text-label-bold">${esc(m.name)}</span>
              <span class="text-xs text-on-surface-variant">${m.kcal || 0}</span>
            </button>`).join("")}
        </div>
      </div>` : ""}

    <!-- capture="environment" opens the camera directly; the plain input opens the photo library. -->
    <input data-file-camera type="file" accept="image/*" capture="environment" class="hidden" />
    <input data-file-gallery type="file" accept="image/*" class="hidden" />
    <button data-manual class="w-full text-center font-label-bold text-sm text-on-surface-variant py-2 underline decoration-dashed underline-offset-4">or enter it manually</button>
    <button data-cancel class="w-full text-center font-label-bold text-sm text-on-surface-variant py-2 mt-1">Cancel</button>
  `;
  setStage(ctx, html, (el) => {
    el.querySelector("[data-cancel]").addEventListener("click", closeModal);
    el.querySelector("[data-manual]").addEventListener("click", () => renderReview(ctx, [blankItem()], { source: "manual" }));
    const wirePick = (btnSel, inputSel) => {
      const input = el.querySelector(inputSel);
      el.querySelector(btnSel).addEventListener("click", () => input.click());
      input.addEventListener("change", () => {
        if (input.files && input.files[0]) handlePhoto(ctx, input.files[0]);
      });
    };
    wirePick("[data-camera]", "[data-file-camera]");
    wirePick("[data-gallery]", "[data-file-gallery]");
    el.querySelector("[data-describe]").addEventListener("click", () => renderDescribe(ctx));

    // A saved dish is already tuned, so it logs outright — every ingredient, one tap.
    el.querySelectorAll("[data-fav]").forEach((b) =>
      b.addEventListener("click", () => {
        const fav = favs[+b.dataset.fav];
        const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        fav.items.forEach((it) => addMeal({ ...it, time, source: "favorite" }));
        addPoints(5);
        closeModal();
        toast(`${fav.name} logged — ${fav.items.length} items. +5 🌿`, "star");
        if (ctx.onDone) ctx.onDone();
      })
    );

    el.querySelectorAll("[data-unfav]").forEach((b) =>
      b.addEventListener("click", () => {
        const fav = favs[+b.dataset.unfav];
        removeFavorite(fav.id);
        toast(`${fav.name} removed from favourites`, "star");
        renderChoose(ctx);
      })
    );

    // A common dish is a template, not your meal — open it for a portion check
    // rather than logging someone else's idea of dinner.
    el.querySelectorAll("[data-dish]").forEach((b) =>
      b.addEventListener("click", () => {
        const d = commons[+b.dataset.dish];
        renderReview(ctx, d.items.map((it) => ({ ...it })), { source: "dish", dishName: d.name, dishIcon: d.icon });
      })
    );

    // One tap re-logs a bite you've had before, macros and all — no AI round-trip,
    // no form. Most days' eating is a repeat of some other day's.
    el.querySelectorAll("[data-again]").forEach((b) =>
      b.addEventListener("click", () => {
        const { id, time, ...meal } = recents[+b.dataset.again];
        addMeal({ ...meal, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
        addPoints(5);
        closeModal();
        toast(`${meal.name} again. +5 🌿`);
        if (ctx.onDone) ctx.onDone();
      })
    );
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
  let fixing = -1;   // index of the item being corrected in words
  let fixBusy = false;
  let naming = false; // saving this whole spread as a favourite dish

  function render() {
    setStage(ctx, reviewHtml(items, expanded, meta, rating, fixing, fixBusy, naming), wire);
    if (naming) ctx.stageEl.querySelector("[data-fav-name]")?.select();
    if (fixing >= 0) ctx.stageEl.querySelector("[data-fix-text]")?.focus({ preventScroll: true });
    else if (expanded >= 0) ctx.stageEl.querySelector(`[data-field='name'][data-i='${expanded}']`)?.focus({ preventScroll: true });
  }

  // Re-estimate one item from a sentence: "that was tofu, not chicken", "it was
  // the large bowl". The correction can come back as several items (a wrong guess
  // often hid a second food), so whatever returns replaces the one being fixed.
  async function applyFix(i, said) {
    fixBusy = true;
    render();
    try {
      const data = await analyzeFood({ text: fixPrompt(items[i], said) });
      const fixed = fromAIItems(data);
      items.splice(i, 1, ...fixed);
      fixing = -1;
      expanded = -1;
      fixBusy = false;
      render();
      toast(fixed.length > 1 ? `Split into ${fixed.length} items.` : `Updated: ${fixed[0].name}`, "auto_fix_high");
    } catch (e) {
      fixBusy = false;
      render();
      toast(e && e.message ? e.message : "Couldn't reach the analyzer.", "error");
    }
  }

  function wire(el) {
    // ---- Save the whole spread as a reusable dish ----
    el.querySelector("[data-fav-save]")?.addEventListener("click", () => { naming = true; render(); });
    el.querySelector("[data-fav-cancel]")?.addEventListener("click", () => { naming = false; render(); });
    el.querySelector("[data-fav-confirm]")?.addEventListener("click", () => {
      const named = el.querySelector("[data-fav-name]").value.trim();
      const withNames = items.filter((it) => it.name.trim());
      if (!withNames.length) { toast("Name at least one item first."); return; }
      const fav = addFavorite({ name: named || defaultDishName(items, meta), icon: dishIcon(items, meta), items: withNames });
      naming = false;
      render();
      toast(`${fav.name} saved — one tap next time ⭐`, "star");
    });

    // ---- Fix-in-words ----
    el.querySelectorAll("[data-fix]").forEach((b) =>
      b.addEventListener("click", () => { fixing = +b.dataset.fix; render(); }));
    el.querySelector("[data-fix-cancel]")?.addEventListener("click", () => { fixing = -1; render(); });
    const fixText = el.querySelector("[data-fix-text]");
    const fixGo = () => {
      const said = fixText.value.trim();
      if (!said) { fixText.focus(); return; }
      applyFix(fixing, said);
    };
    el.querySelector("[data-fix-go]")?.addEventListener("click", fixGo);
    const fixMic = el.querySelector("[data-fix-mic]");
    if (fixMic && fixText) wireMic(fixMic, fixText);

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

// ponytail: the correction rides the existing analyze endpoint — the old numbers go
// in as an anchor and the sentence overrides them. No server change. If accuracy
// disappoints, give /api/analyze-food a real "fix this item" mode.
function fixPrompt(it, said) {
  const macros = `protein ${it.protein}g, carbs ${it.carbs}g, fat ${it.fat}g`;
  return `I logged "${it.name || "an item"}"${it.portion ? ` (${it.portion})` : ""} at ${it.kcal} kcal — ${macros}. `
    + `That estimate is wrong: ${said}. Re-estimate what I actually ate, applying that correction.`;
}

// The dish's default name: whatever it was picked from, else the item carrying
// most of the calories — that's the thing people call the meal.
function defaultDishName(items, meta) {
  if (meta.dishName) return meta.dishName;
  const biggest = items.slice().sort((a, b) => (b.kcal || 0) - (a.kcal || 0))[0];
  return (biggest && biggest.name.trim()) || "My dish";
}
function dishIcon(items, meta) {
  if (meta.dishIcon) return meta.dishIcon;
  const biggest = items.slice().sort((a, b) => (b.kcal || 0) - (a.kcal || 0))[0];
  return (biggest && biggest.icon) || "restaurant";
}

function reviewHtml(items, expanded, meta, rating, fixing, fixBusy, naming) {
  // Only a genuine AI guess gets a thumbs rating — a template or a hand-typed
  // meal isn't the model's work to judge.
  const isAI = meta.source !== "manual" && meta.source !== "dish";
  const rateChip = isAI ? `
      <button data-rate-up class="chunky-button w-8 h-8 rounded-full chunky-border flex items-center justify-center ${rating === 1 ? "bg-primary text-on-primary" : "bg-surface-container"}">${icon("thumb_up", "text-sm")}</button>
      <button data-rate-down class="chunky-button w-8 h-8 rounded-full chunky-border flex items-center justify-center ${rating === -1 ? "bg-error-container text-error" : "bg-surface-container"}">${icon("thumb_down", "text-sm")}</button>` : "";
  const title = meta.dishName ? esc(meta.dishName) : (isAI ? "check the breakdown" : "new meal");
  return `
    <div class="flex items-center justify-between gap-2 mb-3">
      <h3 class="font-headline-md text-headline-md text-on-surface lowercase min-w-0 truncate">${title}</h3>
      <div class="flex items-center gap-1 shrink-0">
        ${rateChip}
        <button data-fav-save aria-label="Save as a favourite dish" class="chunky-button w-8 h-8 rounded-full chunky-border bg-surface-container text-tertiary flex items-center justify-center">${icon("star", "text-sm")}</button>
      </div>
    </div>

    ${naming ? `
      <div class="bg-primary-fixed rounded-2xl chunky-border p-3 mb-3 flex flex-col gap-2">
        <p class="font-label-bold text-label-bold text-on-primary-container">Save this as a dish</p>
        <input data-fav-name type="text" maxlength="40" value="${escAttr(defaultDishName(items, meta))}"
          class="w-full px-3 py-2 rounded-lg chunky-border bg-surface-container-lowest font-label-bold text-label-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
        <p class="text-xs text-on-primary-container">All ${items.length} ${items.length === 1 ? "item" : "items"} come back in one tap.</p>
        <div class="flex gap-2">
          <button data-fav-cancel class="chunky-button flex-1 py-2.5 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Cancel</button>
          <button data-fav-confirm class="chunky-button flex-1 py-2.5 rounded-full chunky-border bg-on-surface text-surface font-label-bold text-label-bold card-shadow">Save dish</button>
        </div>
      </div>` : ""}
    ${meta.note && isAI ? `<div class="bg-[#ffeadc] rounded-2xl chunky-border p-3 mb-3 flex gap-2 items-start"><span class="material-symbols-outlined text-primary text-sm">eco</span><p class="font-body-md text-sm text-on-surface">${esc(meta.note)}</p></div>` : ""}

    <div data-summary>${summaryHtml(totals(items))}</div>

    <div class="flex flex-col gap-2 my-3" data-items>
      ${items.map((it, i) => itemRow(it, i, i === expanded, i === fixing, fixBusy)).join("")}
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

// One item, in correction mode: say (or type) what's wrong and let the AI redo it.
// Beats hunting for which of eight number fields was the wrong one.
function fixRow(it, i, busy) {
  if (busy) {
    return `
      <div class="bg-surface-container-lowest rounded-2xl chunky-border p-4 flex items-center gap-3">
        <span class="material-symbols-outlined animate-spin text-primary">progress_activity</span>
        <p class="font-label-bold text-label-bold text-on-surface-variant">Rethinking ${esc(it.name) || "that one"}…</p>
      </div>`;
  }
  const canVoice = speechSupported();
  return `
    <div class="bg-primary-fixed rounded-2xl chunky-border p-3 flex flex-col gap-2">
      <p class="font-label-bold text-label-bold text-on-primary-container">What's wrong with "${esc(it.name) || "this"}"?</p>
      <div class="relative">
        <textarea data-fix-text rows="2" maxlength="200" placeholder="that was tofu, not chicken · it was the big bowl · no oil"
          class="w-full px-3 py-2 rounded-lg chunky-border bg-surface-container-lowest font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none ${canVoice ? "pr-12" : ""}"></textarea>
        ${canVoice ? `<button data-fix-mic class="chunky-button absolute right-2 bottom-2 w-9 h-9 rounded-full chunky-border bg-surface-container flex items-center justify-center">${icon("mic", "text-primary text-sm")}</button>` : ""}
      </div>
      <div class="flex gap-2">
        <button data-fix-cancel class="chunky-button flex-1 py-2.5 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Cancel</button>
        <button data-fix-go class="chunky-button flex-1 py-2.5 rounded-full chunky-border bg-on-surface text-surface font-label-bold text-label-bold card-shadow">Fix it</button>
      </div>
    </div>`;
}

function itemRow(it, i, expanded, fixing, fixBusy) {
  if (fixing) return fixRow(it, i, fixBusy);
  if (!expanded) {
    return `
      <div class="bg-surface-container-lowest rounded-2xl chunky-border p-3 flex items-center gap-2">
        <button data-expand="${i}" class="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div class="w-9 h-9 rounded-full chunky-border bg-surface-container flex items-center justify-center flex-shrink-0">${icon(it.icon || "restaurant", "text-tertiary-container")}</div>
          <div class="flex-1 min-w-0">
            <p class="font-label-bold text-label-bold text-on-surface break-words">${esc(it.name) || "(unnamed)"}</p>
            <p class="text-xs text-on-surface-variant break-words">${it.portion ? esc(it.portion) + " • " : ""}${it.kcal} kcal</p>
          </div>
          <span class="material-symbols-outlined text-on-surface-variant text-base flex-shrink-0">edit</span>
        </button>
        <button data-fix="${i}" aria-label="Fix ${escAttr(it.name)} in words" class="chunky-button w-8 h-8 rounded-full chunky-border bg-surface-container text-primary flex items-center justify-center flex-shrink-0">${icon("mic", "text-sm")}</button>
        <button data-remove-item="${i}" class="chunky-button w-8 h-8 rounded-full chunky-border bg-error-container text-error flex items-center justify-center flex-shrink-0">${icon("close", "text-sm")}</button>
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
      <button data-fix="${i}" class="chunky-button w-full py-2.5 rounded-full chunky-border bg-primary-fixed text-on-primary-container flex items-center justify-center gap-2">
        ${icon("mic", "text-sm")}<span class="font-label-bold text-label-bold">Just tell me what's wrong</span>
      </button>
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
