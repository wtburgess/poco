# Poco — Slow & Steady Life Tracker

A working app built from the Stitch "Organic Toy-Box" design mockups. Turns the
five static screens into one interactive single-page app with data that persists
in the browser.

## Run it

It uses ES modules, so serve over HTTP (opening `index.html` from disk won't work):

```bash
cd app
python3 -m http.server 4173
```

Then open http://localhost:4173/

## What works

- **Check-in** — adjust sleep, quality, mood, log a walk, quick-add food. Reactive
  Poco mirrors what you enter (sleepy, thrilled, worried, in love…). The **Log
  today** button is a real once-a-day commit that builds a **streak** and awards
  leaves (with milestone bonuses); after logging it flips to a done state so you
  can't farm it.
- **Reactive, dress-up Poco** — the mascot has moods and a slightly unhinged
  running commentary, plus a wardrobe. Spend leaves in **Poco's Closet** (the leaf
  button, top-right) on hats, shades, a monocle, a snail buddy, a third eye… what
  you equip shows up on every Poco in the app.
- **Streak + comeback** — the home screen leads with your streak; if you've been
  gone a couple of days Poco greets you with a guilt-trippy welcome-back.
- **Daily nudge** — opt-in morning browser notification (Settings → Daily Nudge)
  that reminds you to check in. Fires while the app is open in a tab.
- **Food** — add/remove meals (with calories), live intake vs. goal, derived macros, weekly strip.
- **Health** — weekly averages (steps, sleep, happiness) computed from your check-ins, drawn as organic vine charts.
- **Habits** — tap the weekly grid to complete habits, live streaks, add/remove habits, progress tree.
- **Settings** — edit your name and daily goals, connected apps, the daily nudge, reset all data.

All state is saved to `localStorage` (key `poco.state.v1`) and shared across
screens. Old saves are migrated forward automatically.

## Structure

```
app/
  index.html         # shell + Tailwind config + fonts
  src/
    styles.css       # Organic Toy-Box utilities + Poco animations, confetti
    store.js         # state + localStorage + streak/commit + cosmetics + migration
    ui.js            # shared chrome + the reactive Poco SVG (moods & cosmetics)
    poco.js         # Poco's personality: moods, quips, wardrobe catalog
    notify.js        # morning nudge scheduling (browser notifications)
    main.js          # hash router + boot (welcome-back, nudges)
    views/           # checkin, food, health, habits, settings, rewards (closet)
```

The original mockups remain in the sibling folders (`daily_check_in/`, `food_tracker/`, etc.) for reference.
