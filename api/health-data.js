// Returns today's steps + sleep from the Google Health API for a given device.
// Transparently refreshes the (1-hour) access token. { connected:false } when the
// device has never linked, so the frontend degrades cleanly to manual entry.
import { getToken, setToken } from "../lib/store.js";

const GH = "https://health.googleapis.com/v4/users/me/dataTypes";

async function refresh(id, tok) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tok.refresh_token,
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) return null;
  // Google only returns a new refresh_token sometimes — keep the old one otherwise.
  const next = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || tok.refresh_token,
    expires_at: Date.now() + (j.expires_in || 3600) * 1000,
    updated_at: Date.now(),
  };
  await setToken(id, next);
  return next;
}

// ponytail: UTC day window (start of today → start of tomorrow). Good enough for a
// daily total; switch to the API's civil_start_time filter if local-day precision matters.
function dayWindow() {
  const start = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
  const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10) + "T00:00:00Z";
  return { start, end };
}

async function listPoints(dataType, filter, accessToken) {
  const url = `${GH}/${dataType}/dataPoints?pageSize=10000&filter=${encodeURIComponent(filter)}`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.dataPoints || [];
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
    const { start, end } = dayWindow();
    const [stepPts, sleepPts] = await Promise.all([
      listPoints("steps", `steps.interval.start_time >= "${start}" AND steps.interval.start_time < "${end}"`, tok.access_token),
      listPoints("sleep", `sleep.interval.end_time >= "${start}" AND sleep.interval.end_time < "${end}"`, tok.access_token),
    ]);
    // null (request failed) vs [] (connected but nothing logged yet) → keep steps null
    // in both so we never overwrite a manual entry with a spurious 0.
    const steps = stepPts && stepPts.length ? stepPts.reduce((s, p) => s + (p.steps?.countSum || 0), 0) : null;
    const mins = sleepPts && sleepPts.length ? sleepPts.reduce((s, p) => s + (p.sleep?.summary?.minutesAsleep || 0), 0) : null;
    res.status(200).json({
      connected: true,
      date: new Date().toISOString().slice(0, 10),
      steps,
      sleepMinutes: mins,
      sleepHours: mins != null ? +(mins / 60).toFixed(1) : null,
    });
  } catch (e) {
    res.status(200).json({ connected: false, error: String(e) });
  }
}
