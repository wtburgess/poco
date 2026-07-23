// Forgets a push subscription (called when the user turns nudges off).
import { removeSub } from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const endpoint = body.endpoint || body.subscription?.endpoint;
    if (!endpoint) {
      res.status(400).json({ error: "missing endpoint" });
      return;
    }
    await removeSub(endpoint);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
