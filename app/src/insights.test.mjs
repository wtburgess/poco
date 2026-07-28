// Run: node app/src/insights.test.mjs
import assert from "node:assert/strict";
import { lift, correlations, topInsight, INSIGHT_MIN_DAYS } from "./insights.js";

// Build N days of check-ins. `f(i)` returns the day's values.
function days(n, f) {
  const out = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(2026, 0, 1 + i);
    const key = `2026-01-${String(d.getDate()).padStart(2, "0")}`;
    out[key] = { logged: true, ...f(i) };
  }
  return out;
}

// lift needs both sides populated, or one lucky day reads as a pattern.
assert.equal(lift([5], [1]), null, "single-day groups must not produce a lift");
assert.equal(lift([5, 5], []), null, "empty comparison group must not produce a lift");
assert.deepEqual(lift([4, 4], [2, 2]), { deltaPct: 100 });

// Not enough history → nothing at all (no teaser, no placeholder).
const thin = { checkins: days(5, () => ({ mood: 3, steps: 9000, sleepHours: 8 })), habits: [] };
assert.equal(topInsight(thin), null, `under ${INSIGHT_MIN_DAYS} logged days there is no insight`);

// Active days genuinely track with better mood → surfaced.
const active = {
  checkins: days(14, (i) => (i % 2 ? { mood: 4, steps: 12000, sleepHours: 7.5 } : { mood: 1, steps: 2000, sleepHours: 7.5 })),
  habits: [],
};
const top = topInsight(active);
assert.ok(top, "a strong steps/mood pattern over 14 days should surface");
assert.match(top.text, /active days/);

// Flat data → no invented pattern.
const flat = { checkins: days(14, () => ({ mood: 3, steps: 8000, sleepHours: 7.5 })), habits: [] };
assert.equal(topInsight(flat), null, "identical days must not produce an insight");

// Unlogged days don't count toward the threshold.
const unlogged = { checkins: days(14, (i) => ({ logged: false, mood: i % 2 ? 4 : 1, steps: i % 2 ? 12000 : 2000 })), habits: [] };
assert.equal(topInsight(unlogged), null, "only committed check-ins count toward the threshold");

// Strongest pattern wins the top slot.
const both = {
  checkins: days(14, (i) => (i % 2 ? { mood: 4, steps: 12000, sleepHours: 9 } : { mood: 1, steps: 2000, sleepHours: 5 })),
  habits: [],
};
const cards = correlations(both);
assert.ok(cards.length >= 2, "expected several patterns");
assert.ok(cards[0].strength >= cards[1].strength, "cards must be sorted strongest first");

console.log("insights: all checks passed");
