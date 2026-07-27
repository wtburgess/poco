// Unlinks a device: best-effort revoke at Google, then drop the stored tokens.
import { getToken, delToken } from "../lib/store.js";

export default async function handler(req, res) {
  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const id = String(req.query.device || body.device || "").slice(0, 64);
  try {
    const tok = await getToken(id);
    if (tok?.access_token) {
      await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(tok.access_token), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }).catch(() => {});
    }
    await delToken(id);
    res.status(200).json({ ok: true });
  } catch (_e) {
    res.status(200).json({ ok: false });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (_e) { return {}; }
}
