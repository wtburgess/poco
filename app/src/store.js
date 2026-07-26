// Central app state with localStorage persistence.
import { cloudSync, cloudReset } from "./supabase.js";

const STORAGE_KEY = "poco.state.v1";
// Older builds saved under a different key; read it once so nobody loses data.
const LEGACY_KEYS = ["brady.state.v1"];

// ---- Date helpers ----
export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
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

// ---- Seed data ----
function seed() {
  const days = weekKeys();
  const today = todayKey();
  // Habit check history keyed by date.
  const meditateChecks = {};
  const walkChecks = {};
  const readChecks = {};
  days.forEach((k, i) => {
    if (i < 4) meditateChecks[k] = true;
    if (i < 5) walkChecks[k] = true;
    if (i === 0 || i === 2) readChecks[k] = true;
  });

  return {
    profile: {
      name: "Alex Explorer",
      level: 4,
      treeHeight: 12,
    },
    points: 240,
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
    lastSeen: today,
    // Daily check-ins keyed by date: { sleepHours, sleepQuality(0-4), mood(0-4), steps, logged }
    // Seed a 3-day streak ending yesterday so today's check-in continues it.
    checkins: {
      [today]: { sleepHours: 7.5, sleepQuality: 3, mood: 3, steps: 4203, logged: false },
      [dayKeyOffset(-1)]: { sleepHours: 7.2, sleepQuality: 3, mood: 4, steps: 9120, logged: true },
      [dayKeyOffset(-2)]: { sleepHours: 6.8, sleepQuality: 2, mood: 3, steps: 10420, logged: true },
      [dayKeyOffset(-3)]: { sleepHours: 8.0, sleepQuality: 4, mood: 4, steps: 8300, logged: true },
    },
    // Meals keyed by date -> array of { id, name, kcal, time, icon }
    meals: {
      [today]: [
        { id: mkid(), name: "Oatmeal & Berries", kcal: 350, time: "8:30 AM", icon: "breakfast_dining" },
        { id: mkid(), name: "Turkey Sandwich", kcal: 420, time: "12:45 PM", icon: "lunch_dining" },
      ],
    },
    // Habits track a Target (ceiling) and an Emergency Floor. Hitting the floor
    // keeps a streak alive — the anti "all-or-nothing" mechanic. floorChecks holds
    // floor-only days, keyed by date, parallel to `checks` (the full-target days).
    habits: [
      { id: mkid(), name: "Meditate", icon: "self_improvement", color: "primary-fixed", target: "10 min", floor: "3 breaths", checks: meditateChecks, floorChecks: {} },
      { id: mkid(), name: "Read", icon: "menu_book", color: "secondary-fixed", target: "20 min", floor: "1 page", checks: readChecks, floorChecks: {} },
      { id: mkid(), name: "Walk", icon: "directions_walk", color: "tertiary-fixed", target: "8k steps", floor: "round the block", checks: walkChecks, floorChecks: {} },
    ],
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
  s.settings = { ...base.settings, ...(s.settings || {}) };
  s.cosmetics = { ...base.cosmetics, ...(s.cosmetics || {}) };
  s.review = { ...base.review, ...(s.review || {}) };
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

// Consecutive logged days ending today (or yesterday if today isn't logged yet).
export function checkinStreak() {
  const logged = (o) => {
    const c = state.checkins[dayKeyOffset(o)];
    return !!(c && c.logged);
  };
  let streak = 0;
  let offset = logged(0) ? 0 : -1;
  while (logged(offset)) {
    streak++;
    offset--;
  }
  return streak;
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
