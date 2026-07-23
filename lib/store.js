// Push-subscription storage. Uses Upstash Redis / Vercel KV when configured,
// falls back to a single subscription from an env var, then to in-memory (dev).
import { Redis } from "@upstash/redis";

const HASH_KEY = "poco:subs";
const mem = new Map();
let redis;

function client() {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function parse(v) {
  if (v && typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch (_e) {
    return null;
  }
}

// record = { subscription, time, tzOffset, createdAt, lastSent }
export async function addSub(record) {
  const endpoint = record?.subscription?.endpoint;
  if (!endpoint) return;
  const r = client();
  if (r) {
    await r.hset(HASH_KEY, { [endpoint]: JSON.stringify(record) });
    return;
  }
  mem.set(endpoint, record);
}

export async function removeSub(endpoint) {
  if (!endpoint) return;
  const r = client();
  if (r) {
    await r.hdel(HASH_KEY, endpoint);
    return;
  }
  mem.delete(endpoint);
}

export async function listSubs() {
  const r = client();
  if (r) {
    const all = (await r.hgetall(HASH_KEY)) || {};
    return Object.values(all).map(parse).filter(Boolean);
  }
  // No KV: allow a single subscription pasted into an env var.
  const raw = process.env.PUSH_SUBSCRIPTION;
  if (raw) {
    const sub = parse(raw);
    if (sub) return [{ subscription: sub, time: "08:00", tzOffset: 0, lastSent: null }];
  }
  return [...mem.values()];
}
