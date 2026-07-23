// Thin wrapper around web-push, configured from VAPID env vars.
import webpush from "web-push";

let configured = false;
function ensure() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function isConfigured() {
  return ensure();
}

export async function sendTo(subscription, payload) {
  if (!ensure()) throw new Error("VAPID keys not configured");
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}
