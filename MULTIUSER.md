# Turning on multi-user (Supabase)

Poco is local-first and works fully offline in **guest mode**. Everything for
multi-user is already built — magic-link auth, a login screen, and a sync engine
(`app/src/supabase.js`) that mirrors every change per user. It stays dormant until
Supabase is configured. Flip it on in ~10 minutes:

## 1. Create a Supabase project
[supabase.com](https://supabase.com) → New project. Note the **Project URL** and the
**anon public** key (Project Settings → API).

## 2. Create the schema
Open the project's **SQL Editor**, paste the whole of [`db/schema.sql`](db/schema.sql),
and run it. This creates the tables and — importantly — the **Row-Level Security**
policies so each user can only ever read/write their own rows. (Re-runnable if you
need to.)

## 3. Enable email magic-link auth
Authentication → Providers → **Email** → enable. Under **URL Configuration**, add your
production origin (e.g. `https://your-poco.vercel.app`) to **Site URL** and the
**Redirect URLs** — the login sends users back to `window.location.origin`.

## 4. Set env vars in Vercel
Project → Settings → Environment Variables:

```
SUPABASE_URL       = <your Project URL>
SUPABASE_ANON_KEY  = <your anon public key>
```

The app's `/api/config` endpoint serves these to the browser. The anon key is
**designed to be public** — Row-Level Security is what protects the data.

## 5. Redeploy
Any push, or "Redeploy" in Vercel. Done — visitors now get a login screen, and each
account has its own private data, synced across their devices.

## Notes
- **Until steps 1–5 are done, nothing changes** — Poco keeps running in guest/local
  mode (no login, data in `localStorage`).
- **First login migrates** whatever's in that browser's local state up to the new
  account (`cloudPushFull`), so you won't lose your current data.
- **What syncs:** check-ins (incl. gratitude, one-liner, energy tag), sleep/mood/steps,
  floor/ceiling habits + their checks, meals, cosmetics/points/goals/settings, and the
  weekly-review focus.
- **Fitbit** links per *device* (an unguessable id in browser storage), not per account
  — fine for personal use; each device connects its own Fitbit. If Poco ever needs
  shared-account Fitbit, move `api/health-*` token keying to the Supabase user id.
