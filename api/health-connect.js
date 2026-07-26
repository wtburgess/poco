// Kicks off the Fitbit OAuth flow: redirect the browser to Fitbit's consent screen.
// The device id rides along in `state` so the callback can key the tokens to it.
function baseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
}

export default function handler(req, res) {
  const clientId = process.env.FITBIT_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("Fitbit isn't configured — set FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET.");
    return;
  }
  const device = String(req.query.device || "anon").slice(0, 64);
  const redirect = `${baseUrl(req)}/api/health-callback`;
  const url = new URL("https://www.fitbit.com/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "activity sleep"); // steps + sleep
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("state", device);
  url.searchParams.set("prompt", "consent");
  res.writeHead(302, { Location: url.toString() });
  res.end();
}
