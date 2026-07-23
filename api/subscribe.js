// Saves a push subscription so the cron can nudge it later.
import { addSub } from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { subscription, time, tzOffset } = body;
    if (!subscription || !subscription.endpoint) {
      res.status(400).json({ error: "missing subscription" });
      return;
    }
    await addSub({
      subscription,
      time: time || "08:00",
      tzOffset: Number.isFinite(tzOffset) ? tzOffset : 0,
      createdAt: Date.now(),
      lastSent: null,
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
