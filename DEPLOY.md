# Deploying Poco + real background push

The app runs as static files; the **morning nudge that fires with the app closed**
needs four things: a service worker (`app/sw.js`), VAPID keys, a place to store the
push subscription, and a daily cron. Vercel provides the last three.

## 0. Prerequisites
- A Vercel account and the repo pushed to GitHub.
- Node installed locally (only to generate the VAPID keys).

## 1. Generate VAPID keys
```bash
npm install
npm run vapid
```
Copy the **Public Key** and **Private Key** it prints.

## 2. Import the project into Vercel
- New Project → import this repo. Framework preset: **Other**. No build command.
- `vercel.json` already wires the static app, the `/api` functions, and the cron.

## 3. Add a subscription store (recommended)
In the project's **Storage** tab, add **Upstash Redis** (a.k.a. Vercel KV). One click.
It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically — `lib/store.js`
picks them up. (Free tier is plenty for this.)

> No-database alternative: skip this and instead paste one subscription JSON into a
> `PUSH_SUBSCRIPTION` env var (see step 6). Simplest infra, but single-device and you
> re-paste + redeploy whenever the subscription changes.

## 4. Set environment variables
Project → Settings → Environment Variables:

| Name | Value |
|------|-------|
| `VAPID_PUBLIC_KEY` | public key from step 1 |
| `VAPID_PRIVATE_KEY` | private key from step 1 |
| `VAPID_SUBJECT` | `mailto:you@example.com` |
| `CRON_SECRET` | any long random string (protects the cron endpoint) |

`KV_REST_API_URL` / `KV_REST_API_TOKEN` come from step 3 automatically.

## 5. Deploy, then subscribe
- Deploy. Open the site, go to **Settings → Daily Nudge**, toggle it on, allow
  notifications. The browser subscribes and POSTs to `/api/subscribe`; the toast
  will say **“Background nudges on”** (vs “while app's open” when there's no backend).
- **iOS:** web push only works from an installed PWA — open in Safari, Share →
  **Add to Home Screen**, launch it from there, then enable the nudge (iOS 16.4+).

## 6. When the nudge fires
- The cron in `vercel.json` runs `GET /api/cron` on a schedule (default `0 12 * * *`
  = 12:00 UTC). It sends every stored subscription one nudge per day.
- **Change the time** by editing the `schedule` in `vercel.json` to your morning in
  **UTC** and redeploying.
- **Precise per-user local time** (e.g. exactly 8am wherever you are) needs a more
  frequent cron (e.g. hourly `0 * * * *`) which requires a Vercel **Pro** plan; on
  Hobby, crons effectively run once per day, so pick the single UTC hour above.
- Test the endpoint manually:
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>.vercel.app/api/cron
  ```

## Local development
`npm run dev` (or `cd app && python3 -m http.server 4173`) serves the static app.
There's no `/api` locally, so the nudge automatically falls back to an **in-tab
timer** — real background push only activates once deployed.
