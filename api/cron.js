// Runs on Vercel's schedule (see vercel.json). Sends each subscriber one nudge
// per day. Vercel adds `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
import { listSubs, addSub, removeSub } from "../lib/store.js";
import { sendTo, isConfigured } from "../lib/push.js";

const NUDGES = [
  "Psst. It's check-in o'clock. Tell me how you slept before I forget my own name.",
  "Poco here. Awake for nearly 4 whole minutes. Let's log your day.",
  "Gentle reminder from a professional relaxer: check in with me today?",
  "Your streak misses you. I miss you. Come tap some buttons.",
];

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!isConfigured()) {
    res.status(200).json({ ok: false, reason: "VAPID keys not configured" });
    return;
  }

  const subs = await listSubs();
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    title: "Poco 🦥",
    body: NUDGES[new Date().getDate() % NUDGES.length],
    url: "/",
  };

  let sent = 0;
  let pruned = 0;
  for (const rec of subs) {
    if (rec.lastSent === today) continue; // one nudge per day
    try {
      await sendTo(rec.subscription, payload);
      sent++;
      await addSub({ ...rec, lastSent: today });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await removeSub(rec.subscription.endpoint);
        pruned++;
      }
    }
  }
  res.status(200).json({ ok: true, total: subs.length, sent, pruned });
}
