// Supabase: magic-link auth + local-first cloud sync.
// The app stays snappy and synchronous (localStorage in-memory state); this layer
// loads your data on login and mirrors every change up to Postgres in the
// background. When Supabase isn't configured it all no-ops → local "guest" mode.

let sb = null;        // the supabase client (null in guest mode)
let userId = null;
let ready = false;

export function isCloud() {
  return !!sb;
}
export function currentUser() {
  return sb ? sb.auth.getUser().then((r) => r.data.user) : Promise.resolve(null);
}

// Boot: fetch public config, lazy-load the client. Returns the session (or null).
export async function initSupabase() {
  if (ready) return getSession();
  ready = true;
  let cfg = null;
  try {
    const r = await fetch("/api/config", { cache: "no-store" });
    if (r.ok) cfg = await r.json();
  } catch (_e) {}
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null; // guest mode
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const session = await getSession();
    userId = session?.user?.id || null;
    return session;
  } catch (_e) {
    sb = null;
    return null;
  }
}

export async function getSession() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}
export function onAuth(cb) {
  if (!sb) return;
  sb.auth.onAuthStateChange((_event, session) => {
    userId = session?.user?.id || null;
    cb(session);
  });
}
export async function signInWithEmail(email) {
  if (!sb) throw new Error("cloud not configured");
  return sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}
export async function signOut() {
  if (sb) await sb.auth.signOut();
}

// ---- Load everything for the signed-in user into app-state shape ----
export async function cloudLoad() {
  if (!sb || !userId) return null;
  const [profile, checkins, meals, habits, checks] = await Promise.all([
    sb.from("profiles").select("*").eq("id", userId).maybeSingle().then((r) => r.data),
    sb.from("checkins").select("*").eq("user_id", userId).then((r) => r.data || []),
    sb.from("meals").select("*").eq("user_id", userId).then((r) => r.data || []),
    sb.from("habits").select("*").eq("user_id", userId).order("sort_order").then((r) => r.data || []),
    sb.from("habit_checks").select("*").eq("user_id", userId).then((r) => r.data || []),
  ]);
  if (!profile) return null; // brand-new user, no cloud data yet

  // Full-target days vs floor-only days (the floor/ceiling mechanic).
  const checkMap = {};
  const floorMap = {};
  checks.forEach((c) => {
    if (c.floor) (floorMap[c.habit_id] ||= {})[c.date] = true;
    else (checkMap[c.habit_id] ||= {})[c.date] = true;
  });
  const mealMap = {};
  meals.forEach((m) => {
    (mealMap[m.date] ||= []).push({
      id: m.id, name: m.name, kcal: m.kcal, protein: m.protein, fat: m.fat,
      carbs: m.carbs, sugar: m.sugar, fiber: m.fiber, icon: m.icon, time: m.time, source: m.source,
    });
  });
  const checkinMap = {};
  checkins.forEach((c) => {
    checkinMap[c.date] = {
      sleepHours: Number(c.sleep_hours), sleepQuality: c.sleep_quality,
      mood: c.mood, steps: c.steps, logged: c.logged, loggedAt: c.logged_at,
      gratitude: c.gratitude || "", note: c.note || "", energy: c.energy || null,
    };
  });

  return {
    profile: { name: profile.name || "friend", level: 4, treeHeight: 12 },
    points: profile.points || 0,
    goals: profile.goals || {},
    cosmetics: profile.cosmetics || { unlocked: [], equipped: null },
    settings: profile.settings || {},
    review: profile.review || { focus: "", focusSetAt: null },
    checkins: checkinMap,
    meals: mealMap,
    habits: habits.map((h) => ({ id: h.id, name: h.name, icon: h.icon, color: h.color, target: h.target || "", floor: h.floor || "", checks: checkMap[h.id] || {}, floorChecks: floorMap[h.id] || {} })),
    lastSeen: new Date().toISOString().slice(0, 10),
  };
}

// ---- Push helpers (called from store mutations; no-op in guest mode) ----
function iso() {
  return new Date().toISOString();
}

export function cloudSync(kind, p) {
  if (!sb || !userId) return;
  const uid = userId;
  let q;
  switch (kind) {
    case "profile":
      q = sb.from("profiles").upsert({ id: uid, name: p.name, goals: p.goals, points: p.points, cosmetics: p.cosmetics, settings: p.settings, review: p.review, updated_at: iso() });
      break;
    case "checkin":
      q = sb.from("checkins").upsert({ user_id: uid, date: p.date, sleep_hours: p.c.sleepHours, sleep_quality: p.c.sleepQuality, mood: p.c.mood, steps: p.c.steps, gratitude: p.c.gratitude || null, note: p.c.note || null, energy: p.c.energy || null, logged: !!p.c.logged, logged_at: p.c.loggedAt || null, updated_at: iso() });
      break;
    case "meal.add":
      q = sb.from("meals").upsert({ id: p.meal.id, user_id: uid, date: p.date, name: p.meal.name, kcal: p.meal.kcal, protein: p.meal.protein, fat: p.meal.fat, carbs: p.meal.carbs, sugar: p.meal.sugar, fiber: p.meal.fiber, icon: p.meal.icon, time: p.meal.time, source: p.meal.source || "manual", created_at: iso() });
      break;
    case "meal.remove":
      q = sb.from("meals").delete().eq("id", p.id).eq("user_id", uid);
      break;
    case "habit.add":
      q = sb.from("habits").upsert({ id: p.habit.id, user_id: uid, name: p.habit.name, icon: p.habit.icon, color: p.habit.color, target: p.habit.target || null, floor: p.habit.floor || null, sort_order: p.order || 0 });
      break;
    case "habit.remove":
      q = sb.from("habits").delete().eq("id", p.id).eq("user_id", uid);
      break;
    case "habitcheck":
      // A day is either full-target (on), floor-only (floor), or cleared (delete).
      q = (p.on || p.floor)
        ? sb.from("habit_checks").upsert({ user_id: uid, habit_id: p.habitId, date: p.date, floor: !!p.floor })
        : sb.from("habit_checks").delete().eq("habit_id", p.habitId).eq("date", p.date).eq("user_id", uid);
      break;
    default:
      return;
  }
  Promise.resolve(q).then((r) => {
    if (r && r.error) console.warn("[sync]", kind, r.error.message);
  });
}

// Wipe the user's cloud rows and re-push fresh state (used by "reset all data").
export async function cloudReset(state) {
  if (!sb || !userId) return;
  const uid = userId;
  await sb.from("habit_checks").delete().eq("user_id", uid);
  await sb.from("meals").delete().eq("user_id", uid);
  await sb.from("habits").delete().eq("user_id", uid);
  await sb.from("checkins").delete().eq("user_id", uid);
  await cloudPushFull(state);
}

// Push the entire local state up (first-login migration and reset).
export async function cloudPushFull(state) {
  if (!sb || !userId) return;
  const uid = userId;
  await sb.from("profiles").upsert({ id: uid, name: state.profile?.name, goals: state.goals, points: state.points, cosmetics: state.cosmetics, settings: state.settings, review: state.review, updated_at: iso() });
  const checkins = Object.entries(state.checkins || {}).map(([date, c]) => ({ user_id: uid, date, sleep_hours: c.sleepHours, sleep_quality: c.sleepQuality, mood: c.mood, steps: c.steps, gratitude: c.gratitude || null, note: c.note || null, energy: c.energy || null, logged: !!c.logged, logged_at: c.loggedAt || null }));
  if (checkins.length) await sb.from("checkins").upsert(checkins);
  const meals = [];
  Object.entries(state.meals || {}).forEach(([date, arr]) => arr.forEach((m) => meals.push({ id: m.id, user_id: uid, date, name: m.name, kcal: m.kcal, protein: m.protein, fat: m.fat, carbs: m.carbs, sugar: m.sugar, fiber: m.fiber, icon: m.icon, time: m.time, source: m.source || "manual" })));
  if (meals.length) await sb.from("meals").upsert(meals);
  const habits = (state.habits || []).map((h, i) => ({ id: h.id, user_id: uid, name: h.name, icon: h.icon, color: h.color, target: h.target || null, floor: h.floor || null, sort_order: i }));
  if (habits.length) await sb.from("habits").upsert(habits);
  const checks = [];
  (state.habits || []).forEach((h) => {
    Object.keys(h.checks || {}).forEach((date) => { if (h.checks[date]) checks.push({ user_id: uid, habit_id: h.id, date, floor: false }); });
    Object.keys(h.floorChecks || {}).forEach((date) => { if (h.floorChecks[date]) checks.push({ user_id: uid, habit_id: h.id, date, floor: true }); });
  });
  if (checks.length) await sb.from("habit_checks").upsert(checks);
}
