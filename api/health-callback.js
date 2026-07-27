// Google redirects here with an auth code. Exchange it for tokens (needs the client
// secret, hence server-side), store them keyed by the device id, then bounce back
// into the app. The health=… flag rides in the query (not the hash) so hash-routing
// stays intact.
import { setToken } from "../lib/store.js";

function baseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
}

export default async function handler(req, res) {
  const base = baseUrl(req);
  const back = (status) => {
    res.writeHead(302, { Location: `${base}/?health=${status}#/settings` });
    res.end();
  };
  try {
    const { code, state, error } = req.query;
    if (error || !code) return back("error");

    const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
    const secret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
    if (!clientId || !secret) return back("error");

    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: String(code),
        client_id: clientId,
        client_secret: secret,
        redirect_uri: `${base}/api/health-callback`,
      }),
    });
    const j = await r.json();
    if (!r.ok || !j.access_token) return back("error");

    await setToken(String(state || "anon"), {
      access_token: j.access_token,
      refresh_token: j.refresh_token, // present because access_type=offline + prompt=consent
      expires_at: Date.now() + (j.expires_in || 3600) * 1000,
      updated_at: Date.now(),
    });
    back("connected");
  } catch (_e) {
    back("error");
  }
}
