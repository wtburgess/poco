// Central app state with localStorage persistence.
import { cloudSync, cloudReset } from "./supabase.js";

const STORAGE_KEY = "poco.state.v1";
// Older builds saved under a different key; read it once so nobody loses data.
const LEGACY_KEYS = ["brady.state.v1"];

// ---- Date helpers ----
// The user's LOCAL calendar date (YYYY-MM-DD). Deliberately not toISOString(),
// which is UTC: east of Greenwich that filed every late-night check-in under
// yesterday, so evening users silently lost streak days at midnight.
export function todayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function dayKeyOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return todayKey(d);
}
// Mon-first week: returns array of 7 date keys for the week containing `ref`.
export function weekKeys(ref = new Date()) {
  const d = new Date(ref);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const c = new Date(d);
    c.setDate(d.getDate() + i);
    return todayKey(c);
  });
}
export const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

// ---- Starting state ----
// Deliberately empty. A new user's first streak, first leaf and first logged meal
// have to be theirs — demo data made every number in the app meaningless.
function seed() {
  return {
    profile: {
      name: "",
      level: 1,
      treeHeight: 0,
      onboarded: false,
    },
    points: 0,
    goals: {
      calories: 2000,
      steps: 8000,
      sleepHours: 8.5,
    },
    settings: {
      healthSync: false, // true only once Fitbit is actually connected
      nutritionTracker: false,
      reminderEnabled: false,
      reminderTime: "08:00",
      lastNotified: null,
      reviewEnabled: true,
      reviewDay: 0, // 0 = Sunday (weekly review prompt day)
    },
    // The one focus from the last weekly review, pinned to the check-in dashboard.
    review: { focus: "", focusSetAt: null },
    // Poco's wardrobe — leaves get spent here.
    cosmetics: {
      unlocked: [],
      equipped: null,
    },
    lastSeen: todayKey(),
    // Daily check-ins keyed by date: { sleepHours, sleepQuality(0-4), mood(0-4), steps, logged }
    checkins: {},
    // Meals keyed by date -> array of { id, name, kcal, time, icon }
    meals: {},
    // Habits track a Target (ceiling) and an Emergency Floor. Hitting the floor
    // keeps a streak alive — the anti "all-or-nothing" mechanic. floorChecks holds
    // floor-only days, keyed by date, parallel to `checks` (the full-target days).
    // Onboarding plants the first one.
    habits: [],
    // Whole dishes saved by name — see addFavorite.
    favorites: [],
  };
}

export function mkid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Load / save ----
let state = load();

function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const k of LEGACY_KEYS) {
        raw = localStorage.getItem(k);
        if (raw) break; // migrate old data; it'll be re-saved under the new key
      }
    }
    if (raw) return migrate(JSON.parse(raw));
  } catch (_e) {}
  const fresh = seed();
  persist(fresh);
  return fresh;
}

// Backfill fields added in later versions so old saves keep working.
function migrate(s) {
  const base = seed();
  // Anyone with an existing save has already "started" — never onboard them again.
  const prevProfile = s.profile || null;
  s.profile = { ...base.profile, ...(prevProfile || {}) };
  // A save that already has a name predates onboarding — having got this far is
  // proof enough. A nameless one (an empty cloud profile) still needs it.
  if (prevProfile && prevProfile.onboarded === undefined) s.profile.onboarded = !!s.profile.name;
  s.settings = { ...base.settings, ...(s.settings || {}) };
  s.cosmetics = { ...base.cosmetics, ...(s.cosmetics || {}) };
  s.review = { ...base.review, ...(s.review || {}) };
  if (!Array.isArray(s.favorites)) s.favorites = [];
  // Backfill floor tracking on habits saved before the floor/ceiling feature.
  (s.habits || []).forEach((h) => { if (!h.floorChecks) h.floorChecks = {}; });
  if (!s.lastSeen) s.lastSeen = todayKey();
  // Treat any past check-in as "logged" so existing users keep their streak.
  const today = todayKey();
  Object.entries(s.checkins || {}).forEach(([k, c]) => {
    if (c.logged === undefined) c.logged = k < today;
  });
  return s;
}

// How many days since the last visit (0 = same day). Set once per boot.
export let sessionReturnGap = 0;
export function noteVisit() {
  const prev = state.lastSeen || todayKey();
  const diff = Math.round(
    (new Date(todayKey()) - new Date(prev)) / 86400000
  );
  sessionReturnGap = Math.max(0, diff);
  state.lastSeen = todayKey();
  persist(state);
  return sessionReturnGap;
}

function persist(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (_e) {}
}

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  persist(state);
  listeners.forEach((fn) => fn(state));
}

export function getState() {
  return state;
}

// Replace the whole state with cloud data on login. Does NOT push back up.
export function hydrate(newState) {
  state = migrate(newState);
  emit();
}

// The profile row bundles name/goals/points/cosmetics/settings — several
// mutations touch it, so they all funnel through here.
function syncProfile() {
  cloudSync("profile", {
    name: state.profile.name,
    goals: state.goals,
    points: state.points,
    cosmetics: state.cosmetics,
    settings: state.settings,
  });
}

// ---- Mutations ----
const DEFAULT_CHECKIN = { sleepHours: 7.5, sleepQuality: 2, mood: 2, steps: 0, gratitude: "", note: "", logged: false };

export function saveCheckin(patch) {
  const key = todayKey();
  // Always merge onto the defaults so a partial first-save can't leave a
  // check-in missing fields (a missing `steps` would crash the check-in view).
  state.checkins[key] = { ...DEFAULT_CHECKIN, ...(state.checkins[key] || {}), ...patch };
  emit();
  cloudSync("checkin", { date: key, c: state.checkins[key] });
}

export function getTodayCheckin() {
  return { ...DEFAULT_CHECKIN, ...(state.checkins[todayKey()] || {}) };
}

export function isCheckinLoggedToday() {
  const c = state.checkins[todayKey()];
  return !!(c && c.logged);
}

// Logged days ending today (or yesterday if today isn't logged yet), tolerating a
// single missed day. Habits already have an emergency floor; this is the check-in's
// version of it — miss a day and Poco waits, miss two in a row and you start over.
// Life happens on a Tuesday, and losing a 12-day run over it is why people quit.
function loggedOn(offset) {
  const c = state.checkins[dayKeyOffset(offset)];
  return !!(c && c.logged);
}

export function checkinStreak() {
  let streak = 0;
  let offset = loggedOn(0) ? 0 : -1;
  let skipped = false;
  while (true) {
    if (loggedOn(offset)) {
      streak++;
      offset--;
      skipped = false;
      continue;
    }
    if (skipped) break; // two blanks back to back — the run is over
    skipped = true;
    offset--;
  }
  return streak;
}

// True when the run is only alive because of the grace day, so the UI can say so
// instead of letting it look like nothing happened.
export function streakOnGrace() {
  return !loggedOn(-1) && checkinStreak() > 0;
}

// Commit today's check-in. Idempotent — awards leaves only on the first log.
export function commitCheckin() {
  const key = todayKey();
  const c = state.checkins[key] || { sleepHours: 7.5, sleepQuality: 2, mood: 2, steps: 0 };
  if (c.logged) {
    return { alreadyLogged: true, streak: checkinStreak(), awarded: 0, bonus: 0, milestone: false };
  }
  c.logged = true;
  c.loggedAt = new Date().toISOString();
  state.checkins[key] = c;
  const streak = checkinStreak();
  const milestone = streak > 0 && streak % 7 === 0;
  const bonus = (milestone ? 50 : 0) + Math.min(streak, 12);
  const awarded = 15 + bonus;
  state.points += awarded;
  emit();
  cloudSync("checkin", { date: key, c });
  syncProfile();
  return { alreadyLogged: false, streak, awarded, bonus, milestone };
}

// Returns the created meal (so callers/sync can reference its id).
export function addMeal(meal) {
  const key = todayKey();
  if (!state.meals[key]) state.meals[key] = [];
  const m = { id: mkid(), ...meal };
  state.meals[key].push(m);
  emit();
  cloudSync("meal.add", { date: key, meal: m });
  return m;
}
export function removeMeal(id) {
  const key = todayKey();
  state.meals[key] = (state.meals[key] || []).filter((m) => m.id !== id);
  emit();
  cloudSync("meal.remove", { id });
}
export function getTodayMeals() {
  return state.meals[todayKey()] || [];
}

// ---- Favourite dishes ----
// A whole meal kept by name — every ingredient, one tap to log the lot.
// ponytail: local only. The cloud profile row has no column for these, and adding
// one would break the upsert for anyone who hasn't run the migration; give them a
// column when favourites need to follow you to a second device.
export function getFavorites() {
  return state.favorites || [];
}

export function addFavorite({ name, icon, items }) {
  const clean = String(name || "").trim() || "My dish";
  const fav = {
    id: mkid(),
    name: clean,
    icon: icon || "restaurant",
    // Copies, not references — editing tomorrow's meal must not rewrite the recipe.
    items: items.map((it) => ({ ...it })),
  };
  const rest = getFavorites().filter((f) => f.name.toLowerCase() !== clean.toLowerCase());
  state.favorites = [fav, ...rest].slice(0, 20);
  emit();
  return fav;
}

export function removeFavorite(id) {
  state.favorites = getFavorites().filter((f) => f.id !== id);
  emit();
}

// The bites you actually eat, most recent first, de-duped by name. Real eating is
// repetitive, so re-logging yesterday's breakfast should be one tap, not a form.
export function recentMeals(limit = 6) {
  const seen = new Map();
  for (let o = 0; o >= -21 && seen.size < limit; o--) {
    for (const m of state.meals[dayKeyOffset(o)] || []) {
      const k = String(m.name || "").trim().toLowerCase();
      if (k && !seen.has(k)) seen.set(k, m);
    }
  }
  return [...seen.values()].slice(0, limit);
}

// Set a habit's status for a day: "done" (full target), "floor" (minimum), or
// "none". Floor and done are mutually exclusive on a given day.
export function setHabitDay(habitId, dateKey, status) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return;
  if (!h.floorChecks) h.floorChecks = {};
  h.checks[dateKey] = status === "done";
  h.floorChecks[dateKey] = status === "floor";
  emit();
  cloudSync("habitcheck", { habitId, date: dateKey, on: status === "done", floor: status === "floor" });
}
// Kept for callers that only care about the full-target toggle.
export function toggleHabit(habitId, dateKey) {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h) return;
  setHabitDay(habitId, dateKey, h.checks[dateKey] ? "none" : "done");
}
// The status of a habit on a day: "done" | "floor" | "none".
export function habitDayStatus(h, dateKey) {
  if (h.checks[dateKey]) return "done";
  if (h.floorChecks && h.floorChecks[dateKey]) return "floor";
  return "none";
}
export function addHabit({ name, icon, color, target, floor }) {
  const h = { id: mkid(), name, icon, color, target: target || "", floor: floor || "", checks: {}, floorChecks: {} };
  state.habits.push(h);
  emit();
  cloudSync("habit.add", { habit: h, order: state.habits.length - 1 });
}

// Contextual micro-tags (energy / vibe) attach to a day's check-in, so the stats
// view can surface them as markers and use them in correlations.
export function tagDay(dateKey, patch) {
  state.checkins[dateKey] = { ...DEFAULT_CHECKIN, ...(state.checkins[dateKey] || {}), ...patch };
  emit();
  cloudSync("checkin", { date: dateKey, c: state.checkins[dateKey] });
}
export function removeHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);
  emit();
  cloudSync("habit.remove", { id });
}

// Current streak = consecutive KEPT days ending today (or yesterday if today's not
// done yet). Hitting the floor counts as kept — that's the whole point of the floor.
export function habitStreak(habit) {
  const kept = (o) => {
    const k = dayKeyOffset(o);
    return !!(habit.checks[k] || (habit.floorChecks && habit.floorChecks[k]));
  };
  let streak = 0;
  let offset = kept(0) ? 0 : -1; // today may still be blank without breaking the run
  while (kept(offset)) {
    streak++;
    offset--;
  }
  return streak;
}

// ---- Weekly review ----
// Habit completion across the given week: overall %, per-habit tallies, and the
// habit that lagged most (for the "friction" step).
export function weeklyHabitStats(ref = new Date()) {
  const keys = weekKeys(ref);
  const perHabit = state.habits.map((h) => ({
    habit: h,
    done: keys.filter((k) => h.checks[k]).length,
    of: keys.length,
  }));
  const done = perHabit.reduce((s, p) => s + p.done, 0);
  const total = perHabit.reduce((s, p) => s + p.of, 0);
  const lowest = perHabit.slice().sort((a, b) => a.done - b.done)[0] || null;
  return { pct: total ? Math.round((done / total) * 100) : 0, perHabit, lowest, keys };
}

// Days this week with a committed check-in (secondary "wins" stat).
export function weeklyCheckinCount(ref = new Date()) {
  return weekKeys(ref).filter((k) => state.checkins[k] && state.checkins[k].logged).length;
}

// Average logged steps over the last N days (used by the adaptive-nudge step).
// Only counts days that actually have a check-in so a gap doesn't drag it to zero.
export function recentStepAvg(days = 21) {
  let sum = 0, n = 0;
  for (let o = 1; o <= days; o++) {
    const c = state.checkins[dayKeyOffset(-o)];
    if (c) { sum += c.steps || 0; n++; }
  }
  return n ? Math.round(sum / n) : 0;
}

export function getWeeklyFocus() {
  return (state.review && state.review.focus) || "";
}
export function setWeeklyFocus(text) {
  state.review = { ...(state.review || {}), focus: text, focusSetAt: new Date().toISOString() };
  emit();
}

export function updateGoals(patch) {
  state.goals = { ...state.goals, ...patch };
  emit();
  syncProfile();
}
export function updateProfile(patch) {
  state.profile = { ...state.profile, ...patch };
  emit();
  syncProfile();
}
export function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  emit();
  syncProfile();
}
export function addPoints(n) {
  state.points += n;
  emit();
  syncProfile();
}

// ---- Cosmetics (the leaf sink) ----
export function isUnlocked(id) {
  return state.cosmetics.unlocked.includes(id);
}
export function getEquipped() {
  return state.cosmetics.equipped;
}
// Buy a cosmetic if affordable; returns true on success. No-op if already owned.
export function unlockCosmetic(id, cost) {
  if (isUnlocked(id)) return true;
  if (state.points < cost) return false;
  state.points -= cost;
  state.cosmetics.unlocked.push(id);
  state.cosmetics.equipped = id;
  emit();
  syncProfile();
  return true;
}
export function equipCosmetic(id) {
  state.cosmetics.equipped = id; // null clears
  emit();
  syncProfile();
}

export function resetAll() {
  state = seed();
  emit();
  cloudReset(state);
}
