// Returns today's steps + sleep from Fitbit for a given device. Transparently
// refreshes the access token when it's near expiry. { connected:false } when the
// device has never linked (or the refresh failed), so the frontend degrades cleanly.
import { getToken, setToken } from "../lib/store.js";

function basicAuth() {
  return "Basic " + Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString("base64");
}

async function refresh(id, tok) {
  const r = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) return null;
  const next = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || tok.refresh_token,
    expires_at: Date.now() + (j.expires_in || 28800) * 1000,
    user_id: tok.user_id,
    updated_at: Date.now(),
  };
  await setToken(id, next);
  return next;
}

export default async function handler(req, res) {
  try {
    const id = String(req.query.device || "").slice(0, 64);
    let tok = await getToken(id);
    if (!tok) return res.status(200).json({ connected: false });
    if (Date.now() > tok.expires_at - 60000) {
      tok = await refresh(id, tok);
      if (!tok) return res.status(200).json({ connected: false, error: "refresh_failed" });
    }
    const today = new Date().toISOString().slice(0, 10);
    const headers = { Authorization: "Bearer " + tok.access_token };
    const [actR, slpR] = await Promise.all([
      fetch(`https://api.fitbit.com/1/user/-/activities/date/${today}.json`, { headers }),
      fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${today}.json`, { headers }),
    ]);
    const act = actR.ok ? await actR.json() : null;
    const slp = slpR.ok ? await slpR.json() : null;
    const steps = act?.summary?.steps ?? null;
    const mins = slp?.summary?.totalMinutesAsleep ?? null;
    res.status(200).json({
      connected: true,
      date: today,
      steps,
      sleepMinutes: mins,
      sleepHours: mins != null ? +(mins / 60).toFixed(1) : null,
      userId: tok.user_id || null,
    });
  } catch (e) {
    res.status(200).json({ connected: false, error: String(e) });
  }
}
