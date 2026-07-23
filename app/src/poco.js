// Poco's personality: what mood he's in, what he says, and what he can wear.
import {
  getTodayCheckin, isCheckinLoggedToday, checkinStreak, sessionReturnGap, todayKey,
} from "./store.js";

// ---- The wardrobe (leaves get spent here) ----
export const COSMETICS = [
  { id: "party_hat",   name: "Party Hat",    cost: 50,  emoji: "🎉", blurb: "Every day's a party. A slow, horizontal party." },
  { id: "shades",      name: "Cool Shades",  cost: 90,  emoji: "😎", blurb: "The sun is a lot. Poco copes." },
  { id: "monocle",     name: "Monocle",      cost: 140, emoji: "🧐", blurb: "For the distinguished arboreal gentleman." },
  { id: "mustache",    name: "Leaf 'Stache", cost: 180, emoji: "🥸", blurb: "Suspiciously photosynthetic. Nobody asks." },
  { id: "flower_crown",name: "Flower Crown", cost: 260, emoji: "🌸", blurb: "Feral woodland royalty energy." },
  { id: "crown",       name: "Tiny Crown",   cost: 340, emoji: "👑", blurb: "You earned the throne. Eventually." },
  { id: "snail",       name: "Snail Buddy",  cost: 450, emoji: "🐌", blurb: "His name is Gary. Gary is faster than Poco." },
  { id: "third_eye",   name: "Third Eye",    cost: 800, emoji: "👁️", blurb: "Poco has seen things. All of them. At once." },
];

export function cosmeticById(id) {
  return COSMETICS.find((c) => c.id === id) || null;
}

// Deterministic pick so a line stays put all day instead of flickering on re-render.
function pick(arr, salt = 0) {
  const seed = todayKey();
  let h = salt;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

// A live pick that DOES change as the user fiddles (so Poco reacts to taps).
function reactPick(arr, n) {
  return arr[Math.abs(Math.round(n)) % arr.length];
}

// ---- The hero greeting: mood + a slightly unhinged line ----
// Returns { mood, title, sub }. Reacts live to the in-progress check-in.
export function heroState(firstName) {
  const first = (firstName || "friend").split(" ")[0];
  const logged = isCheckinLoggedToday();
  const streak = checkinStreak();
  const c = getTodayCheckin();
  const gap = sessionReturnGap;

  // 1) Been gone a while and haven't logged yet — the comeback.
  if (gap >= 2 && !logged) {
    return pickTitled([
      { mood: "sad",  title: `Oh. You're back, ${first}.`, sub: `${gap} days. I didn't cry. Sloths can't cry. (I cried.) Log today?` },
      { mood: "love", title: `THERE you are.`, sub: `I've been guarding this app for ${gap} days straight. Please. Check in.` },
      { mood: "suspicious", title: `${gap} days, huh.`, sub: `I'm not mad. I'm a sloth, I don't have the energy to be mad. Let's restart the streak.` },
    ], gap);
  }

  // 2) Already committed today — victory lap.
  if (logged) {
    if (streak >= 7) {
      return pickTitled([
        { mood: "ecstatic", title: `${streak} DAYS, ${first}.`, sub: `We are basically the same organism now. I've never been prouder. I've never felt anything, but still.` },
        { mood: "ecstatic", title: `Streak: ${streak}. Unreal.`, sub: `Scientists are baffled. A consistent human. Log complete — go touch grass, I'll guard the app.` },
      ], streak);
    }
    return pickTitled([
      { mood: "happy", title: `Logged. ${streak}-day streak. 🔥`, sub: `That's it. That's the whole job. Go be a person, ${first}. I'll be here. Horizontal.` },
      { mood: "zen",   title: `Done and done.`, sub: `Peak productivity achieved. For both of us. I'm going to look at a leaf now.` },
      { mood: "love",  title: `${streak} days and counting.`, sub: `You showed up. Again. I'm emotionally invested now and it's your fault.` },
    ], streak);
  }

  // 3) Not logged yet — react to whatever they've entered so far.
  if (c.mood <= 1) {
    return reactTitled([
      { mood: "sad", title: `Rough one, ${first}?`, sub: `Cool cool cool. I'll just be here. Existing. Next to you. No pressure. Log it when you're ready.` },
      { mood: "sad", title: `Heavy day.`, sub: `You don't have to be okay. You just have to tap the button. That's the deal. I'll handle the rest (nothing).` },
    ], c.mood);
  }
  if (c.sleepHours <= 5) {
    return reactTitled([
      { mood: "dead", title: `${c.sleepHours} hours of sleep??`, sub: `Bold. Reckless. I slept 19 and I still feel fragile. I respect you and fear for you equally.` },
      { mood: "dead", title: `We do not sleep, apparently.`, sub: `My whole personality is sleeping and you're out here at ${c.sleepHours} hours. Log the chaos, ${first}.` },
    ], c.sleepHours);
  }
  if (c.mood >= 4) {
    return reactTitled([
      { mood: "ecstatic", title: `Look at you GLOWING.`, sub: `Whatever this energy is, bottle it, sell it, buy me a hat. Log it before it wears off!` },
      { mood: "ecstatic", title: `Someone's thriving.`, sub: `This is the most alive either of us has ever been. Immortalize it. Tap the button, ${first}.` },
    ], c.sleepHours + c.mood);
  }
  if (c.sleepHours >= 9) {
    return { mood: "zen", title: `${c.sleepHours} hours. Chef's kiss.`, sub: `That's the good stuff. That's the sloth lifestyle. You get it. Log the win, ${first}.` };
  }

  // Default nudge to check in.
  return pickTitled([
    { mood: "chill",      title: `Easy does it, ${first}.`, sub: `Poco stretched once today. That was the whole workout. So — how are we?` },
    { mood: "happy",      title: `There you are.`, sub: `He's been staring at the same leaf for an hour. Genuinely thrilling. Check in?` },
    { mood: "suspicious", title: `Oh, it's you.`, sub: `Poco has noticed you and will absolutely not be normal about it. Log your day?` },
    { mood: "chill",      title: `No rush, ${first}.`, sub: `Well — no rush on everything except this one button. Do that button. Gently.` },
  ], 0);
}

function pickTitled(pool, salt) {
  return pick(pool, salt);
}
function reactTitled(pool, n) {
  return reactPick(pool, n);
}

// Short quips for the "already logged, stop tapping" nudge and notifications.
export const DONE_TAPS = [
  "You already logged today. I saw it. It was beautiful.",
  "Still logged. Extremely logged. Go outside.",
  "Tapping me again won't add leaves but I do enjoy the attention.",
  "It's done! We did it! Now we rest. Forever. Well, till tomorrow.",
];
export function doneTap() {
  return DONE_TAPS[Math.floor(Math.random() * DONE_TAPS.length)];
}

export const NUDGES = [
  "🦥 Psst. It's check-in o'clock. Tell me how you slept before I forget my own name.",
  "🌿 Poco here. I've been awake for nearly 4 whole minutes. Let's log your day.",
  "🦥 Gentle reminder from a professional relaxer: check in with me today?",
  "🌱 Your streak misses you. I miss you. Come tap some buttons.",
];
export function nudgeText(streak) {
  if (streak >= 1) return `🔥 ${streak}-day streak on the line. Don't make me get up. Check in?`;
  return NUDGES[Math.floor(Math.random() * NUDGES.length)];
}
