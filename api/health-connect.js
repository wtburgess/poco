// Kicks off the Google Health API OAuth flow (this is where Fitbit's Web API is
// migrating to). Redirect the browser to Google's consent screen; the device id
// rides along in `state` so the callback can key the tokens to it.
const SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
].join(" ");

function baseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
}

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
  if (!clientId) {
    res.status(500).send("Health sync isn't configured — set GOOGLE_HEALTH_CLIENT_ID / GOOGLE_HEALTH_CLIENT_SECRET.");
    return;
  }
  const device = String(req.query.device || "anon").slice(0, 64);
  const redirect = `${baseUrl(req)}/api/health-callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline"); // ask for a refresh token
  url.searchParams.set("prompt", "consent");       // ensure a refresh token comes back
  url.searchParams.set("state", device);
  res.writeHead(302, { Location: url.toString() });
  res.end();
}
