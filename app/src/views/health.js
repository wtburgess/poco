// Health — a scrubbable Stats & Input view.
// Top to bottom: a coach's takeaway, auto-computed correlations, three trend charts
// you can scrub (tap any day → its raw logs appear in the breakdown), a readable
// "Your reflections" log of gratitude + one-liners, then the raw entry stream.
import {
  getState, weekKeys, WEEKDAY_LABELS, todayKey,
} from "../store.js";
import { icon, pocoImg, shell } from "../ui.js";

const MOOD_WORDS = ["rough", "meh", "okay", "good", "glowing"];

// Session view-state: which day is scrubbed into the breakdown.
let selectedKey = null;

export function renderHealth(root) {
  const { checkins } = getState();
  const keys = weekKeys();
  const today = todayKey();
  // Default the scrubbed day to today if it exists this week, else the latest logged day.
  if (!selectedKey || !keys.includes(selectedKey)) {
    selectedKey = keys.includes(today) ? today : [...keys].reverse().find((k) => checkins[k]) || today;
  }

  const stepsSeries = keys.map((k) => checkins[k]?.steps ?? null);
  const sleepSeries = keys.map((k) => checkins[k]?.sleepHours ?? null);
  const moodSeries = keys.map((k) => (checkins[k]?.mood != null ? checkins[k].mood + 1 : null));

  const body = `
    <div class="mb-1">
      <h1 class="font-display-lg-mobile text-display-lg-mobile text-on-surface mb-1">Stats</h1>
      <p class="font-body-lg text-body-lg text-on-surface-variant">Tap any day to see what you logged.</p>
    </div>

    ${coachCard()}
    ${correlationCarousel()}

    ${trendCard("Movement", fmt(avgOf(stepsSeries), 0), "steps avg", "text-primary", "bg-primary-fixed", "directions_run", "#546346", "#98a886", stepsSeries, 12000, keys, checkins)}
    ${trendCard("Sleep", sleepLabel(avgOf(sleepSeries)), "avg", "text-inverse-surface", "bg-inverse-on-surface", "bedtime", "#3f2d1e", "#c8c7bc", sleepSeries, 10, keys, checkins)}
    ${trendCard("Happiness", fmt(avgOf(moodSeries), 1), "/ 5 avg", "text-tertiary", "bg-secondary-fixed", "mood", "#7c554e", "#edbbb2", moodSeries, 5, keys, checkins)}

    ${dayBreakdown()}

    ${journal()}
    ${feed()}
    <div class="h-6"></div>
  `;

  root.innerHTML = shell("health", body);
  wire(root);
}

// ---- Coach's summary: one actionable takeaway ----
function coachCard() {
  const { text, focus } = coachTakeaway();
  return `
    <div class="bg-[#ffeadc] chunky-border card-shadow rounded-[20px] p-5 flex gap-4 items-start">
      <div class="w-12 h-12 rounded-full chunky-border overflow-hidden bg-secondary-container flex-shrink-0 flex items-center justify-center">${pocoImg(46)}</div>
      <div>
        <p class="font-label-bold text-[11px] text-primary uppercase tracking-wide mb-1">Coach's takeaway</p>
        <p class="font-body-lg text-body-lg text-on-secondary-fixed-variant leading-snug">${text}</p>
        ${focus ? `<p class="mt-2 font-label-bold text-label-bold text-on-surface flex items-center gap-1">${icon("arrow_forward", "text-sm text-primary")} ${focus}</p>` : ""}
      </div>
    </div>`;
}

// ---- Correlation carousel (auto-calculated, swipeable) ----
function correlationCarousel() {
  const cards = correlations();
  if (!cards.length) {
    return insightPlaceholder("Log a few more days and I'll start spotting what moves your numbers.");
  }
  return `
    <div class="-mx-container-padding px-container-padding overflow-x-auto no-scrollbar snap-x snap-mandatory flex gap-3" data-carousel>
      ${cards.map((c) => `
        <div class="snap-start shrink-0 w-[80%] max-w-xs bg-surface-container-lowest chunky-border card-shadow rounded-[20px] p-5">
          <div class="flex items-center gap-2 mb-2">${icon(c.icon, "text-primary fill-icon")}<span class="font-label-bold text-[11px] text-on-surface-variant uppercase tracking-wide">${c.kind}</span></div>
          <p class="font-body-lg text-body-lg text-on-surface leading-snug">${c.text}</p>
        </div>`).join("")}
    </div>`;
}

function insightPlaceholder(msg) {
  return `<div class="bg-surface-container-lowest chunky-border card-shadow rounded-[20px] p-5 flex items-center gap-3">
    <span class="text-2xl">🌱</span><p class="font-body-md text-body-md text-on-surface-variant">${msg}</p>
  </div>`;
}

// ---- Trend card with a scrubbable day strip + event markers ----
function trendCard(label, value, unit, valueColor, bg, watermark, stroke, leaf, series, max, keys, checkins) {
  return `
    <article class="chunky-border rounded-[1.5rem] p-5 relative overflow-hidden ${bg} card-shadow">
      <div class="absolute -top-2 -right-2 opacity-20"><span class="material-symbols-outlined fill-icon" style="font-size:80px;">${watermark}</span></div>
      <div class="flex justify-between items-start mb-2 relative z-10">
        <div>
          <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider mb-1">${label}</h2>
          <div class="flex items-baseline gap-2"><span class="font-display-lg-mobile text-display-lg-mobile ${valueColor}">${value}</span><span class="font-body-md text-body-md text-on-surface-variant">${unit}</span></div>
        </div>
      </div>
      <div class="w-full h-20 mt-1 relative z-10">${vineChart(series, max, stroke, leaf)}</div>
      <div class="flex mt-1 relative z-10">
        ${keys.map((k, i) => dayTab(k, i, series[i], checkins[k])).join("")}
      </div>
    </article>`;
}

// One tappable day column under a chart: weekday letter, selection ring, and a pin
// dot when that day has a journal note or gratitude logged.
function dayTab(key, i, val, c) {
  const on = key === selectedKey;
  const hasEvent = !!(c && (c.note || c.gratitude));
  return `<button data-day="${key}" class="flex-1 flex flex-col items-center gap-0.5 py-1 rounded-lg ${on ? "bg-on-surface/10" : ""}">
    <span class="text-[10px] leading-none">${hasEvent ? "📝" : "&nbsp;"}</span>
    <span class="font-label-bold text-[11px] ${on ? "text-on-surface" : "text-on-surface-variant"} ${val == null ? "opacity-40" : ""}">${WEEKDAY_LABELS[i]}</span>
    <span class="w-1.5 h-1.5 rounded-full ${on ? "bg-on-surface" : "bg-transparent"}"></span>
  </button>`;
}

// ---- Selected Day Input Breakdown ----
function dayBreakdown() {
  const { checkins, habits } = getState();
  const c = checkins[selectedKey];
  const label = prettyDate(selectedKey);
  if (!c) {
    return `<div class="bg-surface-container-lowest chunky-border card-shadow rounded-[20px] p-5">
      <p class="font-headline-md text-headline-md text-on-surface mb-1">${label}</p>
      <p class="font-body-md text-body-md text-on-surface-variant">Nothing logged this day.</p>
    </div>`;
  }
  const habitLine = habits.map((h) => {
    const st = habitStatus(h, selectedKey);
    const cls = st === "done" ? "bg-primary-fixed text-on-primary-fixed" : st === "floor" ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-surface-container text-on-surface-variant";
    const ic = st === "done" ? "check" : st === "floor" ? "trending_flat" : "close";
    return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full chunky-border text-xs font-label-bold ${cls}">${icon(ic, "text-sm")} ${h.name}</span>`;
  }).join(" ");
  return `
    <div class="bg-surface-container-lowest chunky-border card-shadow rounded-[20px] p-5 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <p class="font-headline-md text-headline-md text-on-surface">${label}</p>
        ${c.logged ? `<span class="text-xs font-label-bold text-primary flex items-center gap-1">${icon("check_circle", "text-sm fill-icon")} logged</span>` : ""}
      </div>
      <div class="flex flex-wrap gap-2">
        ${statChip("bedtime", `${c.sleepHours ?? "—"} hrs`)}
        ${statChip("mood", MOOD_WORDS[c.mood] ?? "—")}
        ${statChip("bolt", energyLabel(c))}
        ${statChip("directions_walk", `${(c.steps ?? 0).toLocaleString()} steps`)}
      </div>
      ${habits.length ? `<div class="flex flex-wrap gap-1.5">${habitLine}</div>` : ""}
      ${c.gratitude ? `<p class="font-body-md text-body-md text-on-surface"><b>Grateful:</b> ${esc(c.gratitude)}</p>` : ""}
      ${c.note ? `<p class="font-body-md text-body-md text-on-surface italic">"${esc(c.note)}"</p>` : ""}
    </div>`;
}

function statChip(ic, text) {
  return `<span class="inline-flex items-center gap-1 bg-surface-container px-3 py-1.5 rounded-full chunky-border font-label-bold text-label-bold text-on-surface">${icon(ic, "text-sm")} ${text}</span>`;
}

// ---- Your reflections: an easy, readable log of gratitude + one-liners ----
function journal() {
  const { checkins } = getState();
  const rows = Object.keys(checkins).sort().reverse()
    .map((k) => ({ k, c: checkins[k] }))
    .filter(({ c }) => c && (c.gratitude || c.note));
  return `
    <div class="flex flex-col gap-2">
      <h2 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2 mt-3">${icon("auto_stories", "text-primary fill-icon")} Your reflections</h2>
      ${rows.length ? rows.map(journalRow).join("") : insightPlaceholder("Your gratitude notes and one-liners will collect here — jot one on today's check-in.")}
    </div>`;
}
function journalRow({ k, c }) {
  return `<div class="bg-surface-container-lowest chunky-border card-shadow rounded-2xl p-4">
    <p class="font-label-bold text-[11px] text-on-surface-variant uppercase tracking-wide mb-1">${prettyDate(k)}</p>
    ${c.gratitude ? `<p class="font-body-md text-body-md text-on-surface mb-1">🙏 ${esc(c.gratitude)}</p>` : ""}
    ${c.note ? `<p class="font-body-lg text-body-lg text-on-surface italic">"${esc(c.note)}"</p>` : ""}
  </div>`;
}

// ---- Raw data: the full entry stream, always at the bottom ----
function feed() {
  const { checkins } = getState();
  const rows = Object.keys(checkins).sort().reverse().map((k) => ({ k, c: checkins[k] })).filter(({ c }) => c);
  return `
    <div class="flex flex-col gap-2">
      <h2 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2 mt-3">${icon("table_rows", "text-primary")} All entries</h2>
      ${rows.length ? rows.map(feedRow).join("") : insightPlaceholder("No entries yet.")}
    </div>`;
}
function feedRow({ k, c }) {
  return `<button data-day="${k}" class="chunky-button w-full text-left bg-surface-container-lowest chunky-border card-shadow rounded-2xl p-4 flex gap-3 items-start">
    <div class="w-10 h-10 rounded-full chunky-border bg-secondary-container flex items-center justify-center shrink-0">${icon(c.note || c.gratitude ? "edit_note" : "check_circle", "text-tertiary-container")}</div>
    <div class="flex-1 min-w-0">
      <p class="font-label-bold text-label-bold text-on-surface">${prettyDate(k)}</p>
      <p class="text-xs text-on-surface-variant">${c.sleepHours ?? "—"}h · ${MOOD_WORDS[c.mood] ?? "—"} · ${(c.steps ?? 0).toLocaleString()} steps</p>
      ${c.note ? `<p class="text-sm text-on-surface italic truncate">"${esc(c.note)}"</p>` : ""}
      ${c.gratitude ? `<p class="text-sm text-on-surface truncate">🙏 ${esc(c.gratitude)}</p>` : ""}
    </div>
  </button>`;
}

// ---- Analytics ----
// Habit status for a day: done / floor / skipped. Floor + floorChecks come from the
// tracking-mechanics work; this view degrades gracefully if they're absent.
function habitStatus(h, key) {
  if (h.checks[key]) return "done";
  if (h.floorChecks && h.floorChecks[key]) return "floor";
  return "skipped";
}
function energyLabel(c) {
  if (c.energy === "high") return "⚡ high";
  if (c.energy === "low") return "🔋 low";
  return c.sleepQuality != null ? `${["👎", "🙁", "😐", "🙂", "👍"][c.sleepQuality]} rest` : "—";
}

function coachTakeaway() {
  const entries = sortedCheckins();
  if (entries.length < 3) {
    return { text: "Keep checking in — a few more days and I'll turn your data into one clear focus.", focus: "" };
  }
  // Sleep→mood link drives the headline takeaway when it's real.
  const link = sleepMoodLink(entries);
  if (link && link.deltaPct >= 12) {
    return {
      text: `You feel noticeably better on days after 7+ hours of sleep — about <b>${link.deltaPct}% higher</b> mood.`,
      focus: "Protect your sleep window this week.",
    };
  }
  const avgMood = avgOf(entries.map((e) => e.c.mood + 1));
  if (avgMood >= 3.5) return { text: "Steady, upbeat week — your mood's been holding strong. Whatever you're doing, keep it.", focus: "" };
  return { text: "A flatter week. Small wins compound — pick one lever and lean on it.", focus: "Set a single focus in your weekly review." };
}

// Direct-overlay + time-lagged correlation cards, computed where the data supports it.
function correlations() {
  const entries = sortedCheckins();
  const cards = [];
  const link = sleepMoodLink(entries);
  if (link && Math.abs(link.deltaPct) >= 8) {
    cards.push({
      kind: "Time-lagged ripple", icon: "nightlight",
      text: `After a <b>7h+ sleep</b> night, your next-day mood is <b>${link.deltaPct > 0 ? "+" : ""}${link.deltaPct}%</b>.`,
    });
  }
  const hl = bestHabitMoodLink(entries);
  if (hl && Math.abs(hl.deltaPct) >= 8) {
    cards.push({
      kind: "Direct overlay", icon: "insights",
      text: `On days you log <b>${esc(hl.name)}</b>, your mood runs <b>${hl.deltaPct > 0 ? "+" : ""}${hl.deltaPct}%</b>.`,
    });
  }
  const stepMood = stepsMoodLink(entries);
  if (stepMood && Math.abs(stepMood.deltaPct) >= 8) {
    cards.push({
      kind: "Direct overlay", icon: "directions_walk",
      text: `On your more active days, mood is <b>${stepMood.deltaPct > 0 ? "+" : ""}${stepMood.deltaPct}%</b>.`,
    });
  }
  return cards;
}

// ponytail: simple conditional-average "lift", not a real regression — enough to
// surface a pattern from a handful of check-ins without pretending to be science.
function sleepMoodLink(entries) {
  const pairs = [];
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1], cur = entries[i];
    if (prev.c.sleepHours != null && cur.c.mood != null) pairs.push({ good: prev.c.sleepHours >= 7, mood: cur.c.mood + 1 });
  }
  return lift(pairs.filter((p) => p.good).map((p) => p.mood), pairs.filter((p) => !p.good).map((p) => p.mood));
}
function bestHabitMoodLink(entries) {
  const { habits } = getState();
  let best = null;
  for (const h of habits) {
    const on = [], off = [];
    for (const e of entries) {
      if (e.c.mood == null) continue;
      (h.checks[e.k] ? on : off).push(e.c.mood + 1);
    }
    const l = lift(on, off);
    if (l && (!best || Math.abs(l.deltaPct) > Math.abs(best.deltaPct))) best = { ...l, name: h.name };
  }
  return best;
}
function stepsMoodLink(entries) {
  const withBoth = entries.filter((e) => e.c.steps != null && e.c.mood != null);
  if (withBoth.length < 4) return null;
  const med = median(withBoth.map((e) => e.c.steps));
  return lift(withBoth.filter((e) => e.c.steps >= med).map((e) => e.c.mood + 1), withBoth.filter((e) => e.c.steps < med).map((e) => e.c.mood + 1));
}
function lift(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const ma = avgOf(a), mb = avgOf(b);
  if (!mb) return null;
  return { deltaPct: Math.round(((ma - mb) / mb) * 100) };
}

// ---- helpers ----
function sortedCheckins() {
  const { checkins } = getState();
  return Object.keys(checkins).sort().map((k) => ({ k, c: checkins[k] })).filter((e) => e.c);
}
function vineChart(series, max, stroke, leafFill) {
  const pts = series.map((v, i) => ({ x: (i / 6) * 100, y: v == null ? null : 38 - (Math.max(0, Math.min(max, v)) / max) * 34 })).filter((p) => p.y != null);
  if (pts.length < 2) {
    return `<svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40"><line x1="0" y1="35" x2="100" y2="35" stroke="${stroke}" stroke-width="2" stroke-dasharray="3 3" opacity="0.4"/></svg>`;
  }
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], cur = pts[i];
    d += ` Q ${(prev.x + cur.x) / 2},${prev.y} ${cur.x},${cur.y}`;
  }
  const leaves = pts.map((p, i) => (i % 2 === 1 ? `<path d="M ${p.x},${p.y} q 5,-5 3,-10 q -6,3 -3,10 z" fill="${leafFill}" stroke="${stroke}" stroke-width="1.2"/>` : "")).join("");
  return `<svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40"><path d="${d}" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/>${leaves}</svg>`;
}
function avgOf(arr) {
  const nums = arr.filter((n) => n != null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 0;
}
function fmt(n, dp) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function sleepLabel(hours) {
  const h = Math.floor(hours), m = Math.round((hours - h) * 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
function prettyDate(key) {
  const d = new Date(key + "T00:00:00");
  if (key === todayKey()) return "Today";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wire(root) {
  // Scrub a day — from any chart strip or the feed.
  root.querySelectorAll("[data-day]").forEach((b) =>
    b.addEventListener("click", () => { selectedKey = b.dataset.day; renderHealth(root); })
  );
}
