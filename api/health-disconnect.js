// Unlinks a device: best-effort revoke at Fitbit, then drop the stored tokens.
import { getToken, delToken } from "../lib/store.js";

export default async function handler(req, res) {
  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const id = String(req.query.device || body.device || "").slice(0, 64);
  try {
    const tok = await getToken(id);
    if (tok?.access_token && process.env.FITBIT_CLIENT_ID) {
      await fetch("https://api.fitbit.com/oauth2/revoke", {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token: tok.access_token }),
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
