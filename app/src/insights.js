// What the numbers actually say. Pure functions over state — no DOM, no store
// import — so they're testable (see insights.test.mjs) and usable from any view.
//
// ponytail: conditional-average "lift", not a real regression — enough to surface a
// pattern from a handful of check-ins without pretending to be science.

export function avgOf(arr) {
  const nums = arr.filter((n) => n != null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 0;
}

// Percentage difference between two groups' means. Needs 2+ days on each side,
// otherwise a single good day would read as a life-changing pattern.
export function lift(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const ma = avgOf(a), mb = avgOf(b);
  if (!mb) return null;
  return { deltaPct: Math.round(((ma - mb) / mb) * 100) };
}

export function sortedCheckins(checkins = {}) {
  return Object.keys(checkins).sort().map((k) => ({ k, c: checkins[k] })).filter((e) => e.c);
}

// Last night's sleep vs today's mood — the lagged link, not a same-day overlay.
export function sleepMoodLink(entries) {
  const pairs = [];
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1], cur = entries[i];
    if (prev.c.sleepHours != null && cur.c.mood != null) {
      pairs.push({ good: prev.c.sleepHours >= 7, mood: cur.c.mood + 1 });
    }
  }
  return lift(pairs.filter((p) => p.good).map((p) => p.mood), pairs.filter((p) => !p.good).map((p) => p.mood));
}

export function bestHabitMoodLink(entries, habits = []) {
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

export function stepsMoodLink(entries) {
  const withBoth = entries.filter((e) => e.c.steps != null && e.c.mood != null);
  if (withBoth.length < 4) return null;
  const med = median(withBoth.map((e) => e.c.steps));
  return lift(
    withBoth.filter((e) => e.c.steps >= med).map((e) => e.c.mood + 1),
    withBoth.filter((e) => e.c.steps < med).map((e) => e.c.mood + 1)
  );
}

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Every pattern worth showing, strongest first.
export function correlations({ checkins, habits } = {}) {
  const entries = sortedCheckins(checkins);
  const cards = [];
  const push = (l, card) => {
    if (l && Math.abs(l.deltaPct) >= 8) cards.push({ ...card, strength: Math.abs(l.deltaPct) });
  };

  const sleep = sleepMoodLink(entries);
  push(sleep, {
    kind: "Time-lagged ripple", icon: "nightlight",
    text: sleep && `After a <b>7h+ sleep</b> night, your next-day mood is <b>${sleep.deltaPct > 0 ? "+" : ""}${sleep.deltaPct}%</b>.`,
  });

  const hl = bestHabitMoodLink(entries, habits);
  push(hl, {
    kind: "Direct overlay", icon: "insights",
    text: hl && `On days you log <b>${esc(hl.name)}</b>, your mood runs <b>${hl.deltaPct > 0 ? "+" : ""}${hl.deltaPct}%</b>.`,
  });

  const steps = stepsMoodLink(entries);
  push(steps, {
    kind: "Direct overlay", icon: "directions_walk",
    text: steps && `On your more active days, mood is <b>${steps.deltaPct > 0 ? "+" : ""}${steps.deltaPct}%</b>.`,
  });

  return cards.sort((a, b) => b.strength - a.strength);
}

// The one sentence for the dashboard. Held back until there's enough history for
// it to mean anything — a pattern drawn from four days is a coincidence, and no
// placeholder is shown in the meantime.
export const INSIGHT_MIN_DAYS = 10;

export function topInsight(state = {}) {
  const entries = sortedCheckins(state.checkins);
  if (entries.filter((e) => e.c.logged).length < INSIGHT_MIN_DAYS) return null;
  const best = correlations(state)[0];
  return best && best.strength >= 10 ? best : null;
}
