// AI food analysis: a photo and/or text description of a meal → a structured
// nutrition estimate. Free, no SDK — just fetch.
//
//   GET  → { ok, configured, provider }   — probe.
//   POST { image?, text? }                → a nutrition estimate object.
//
// Two free providers, auto-selected by which key is set:
//   • GROQ_API_KEY   → Groq (Llama vision) — recommended, globally-available
//                      free tier. Key: https://console.groq.com/keys
//   • GEMINI_API_KEY → Google Gemini free tier (region/account dependent).
// No key → 501 so the client falls back to manual entry.

export const config = { maxDuration: 30 };

const GROQ_MODEL = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
// Gemini models, tried in order. Lead with the rolling "-latest" aliases so we
// don't pin a version Google later retires for new users (older stable names
// like gemini-2.0-flash / gemini-2.5-flash-lite are already unavailable to new
// keys). Quota/availability are per-model, so fall through to the next.
const GEMINI_PREFERRED = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GEMINI_MODELS = [...new Set([GEMINI_PREFERRED, "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"])];

// Material Symbol names Poco already ships — keep the model on-palette.
const ICONS = [
  "restaurant", "breakfast_dining", "lunch_dining", "dinner_dining",
  "local_cafe", "bakery_dining", "nutrition", "local_pizza", "ramen_dining",
  "egg_alt", "set_meal", "kebab_dining", "icecream", "cake", "local_bar",
  "grocery", "fastfood", "liquor", "cookie",
];

const SYSTEM = `You are Poco's food-logging helper — you turn a photo and/or a short description of a meal into a realistic, ITEMIZED nutrition estimate.

Break the meal into its distinct components and estimate each one separately. A bowl of ramen with a boiled egg and greens is FOUR items (ramen, egg, bok choy, spring onions), not one.

For each item provide: name, portion (e.g. "1 bowl (~400g)", "2 halves (100g)"), kcal, and macros in grams (protein_g, fat_g, carbs_g, sugar_g, fiber_g), plus the closest "icon" and a "confidence".

Rules:
- One item per distinct food or drink you can identify. A single simple food is just one item.
- Estimate for the portion actually shown/described; if the amount is unclear, assume a normal serving.
- Give your best realistic numbers even when unsure — never refuse or return all-zeros just because it's ambiguous. Set "confidence" honestly instead.
- For each item, kcal should be roughly protein_g*4 + carbs_g*4 + fat_g*9.
- "note" is ONE short, warm line about the whole meal (Poco's gentle, playful voice). Mention any portion assumption you made.
- If it clearly isn't food, return a single item with kcal 0, confidence "low", and a note saying it didn't look like food.`;

// Groq/OpenAI-style models don't take a schema object, so spell it out.
const SYSTEM_GROQ = `${SYSTEM}

Respond with ONLY a JSON object (no prose, no markdown fences), shaped exactly:
{
  "items": [
    {
      "name": string, "portion": string, "kcal": integer,
      "protein_g": number, "fat_g": number, "carbs_g": number,
      "sugar_g": number, "fiber_g": number,
      "icon": string (MUST be one of: ${ICONS.join(", ")}),
      "confidence": "low" | "medium" | "high"
    }
  ],
  "note": string
}`;

// Gemini structured-output schema (OpenAPI subset: UPPERCASE types).
const ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    portion: { type: "STRING" },
    kcal: { type: "INTEGER" },
    protein_g: { type: "NUMBER" },
    fat_g: { type: "NUMBER" },
    carbs_g: { type: "NUMBER" },
    sugar_g: { type: "NUMBER" },
    fiber_g: { type: "NUMBER" },
    icon: { type: "STRING", enum: ICONS },
    confidence: { type: "STRING", enum: ["low", "medium", "high"] },
  },
  required: ["name", "portion", "kcal", "protein_g", "fat_g", "carbs_g", "sugar_g", "fiber_g", "icon", "confidence"],
  propertyOrdering: ["name", "portion", "kcal", "protein_g", "fat_g", "carbs_g", "sugar_g", "fiber_g", "icon", "confidence"],
};

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: { type: "ARRAY", items: ITEM_SCHEMA },
    note: { type: "STRING" },
  },
  required: ["items", "note"],
  propertyOrdering: ["items", "note"],
};

function activeProvider() {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

function userText(text) {
  return text && text.trim()
    ? `Estimate the nutrition for this meal: ${text.trim()}`
    : "Estimate the nutrition for the food in this image.";
}

// Normalize to a full data URL (Groq) — accepts a data URL or bare base64.
function toDataUrl(image) {
  if (!image || typeof image !== "string") return null;
  return image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
}

// Split a data URL / bare base64 into { media_type, data } (Gemini).
function parseImage(image) {
  if (!image || typeof image !== "string") return null;
  const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s);
  if (m) return { media_type: m[1], data: m[2] };
  return { media_type: "image/jpeg", data: image };
}

function extractJson(s) {
  if (!s) return null;
  let t = String(s).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function callGroq({ image, text }) {
  const content = [{ type: "text", text: userText(text) }];
  const url = toDataUrl(image);
  if (url) content.push({ type: "image_url", image_url: { url } });

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_GROQ },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1024,
      temperature: 0.4,
    }),
  });

  if (!r.ok) {
    let msg = `Analysis failed (${r.status})`;
    try { const j = await r.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch { /* keep */ }
    throw httpError(msg, r.status);
  }
  const data = await r.json();
  const parsed = extractJson(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
  if (!parsed) throw httpError("empty response from the model", 502);
  return parsed;
}

async function callGemini({ image, text }) {
  const parts = [];
  const img = parseImage(image);
  if (img) parts.push({ inline_data: { mime_type: img.media_type, data: img.data } });
  parts.push({ text: userText(text) });

  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: GEMINI_SCHEMA },
  });

  let lastStatus = 502;
  let lastMsg = "Analysis failed";
  for (const model of GEMINI_MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: payload,
    });
    if (r.ok) {
      const data = await r.json();
      if (data.promptFeedback && data.promptFeedback.blockReason) throw httpError("safety", 422);
      const cand = data.candidates && data.candidates[0];
      const part = cand && cand.content && cand.content.parts
        ? cand.content.parts.find((p) => typeof p.text === "string") : null;
      if (!part) throw httpError("empty response from the model", 502);
      return JSON.parse(part.text);
    }
    lastStatus = r.status;
    lastMsg = `Analysis failed (${r.status})`;
    try { const j = await r.json(); if (j && j.error && j.error.message) lastMsg = j.error.message; } catch { /* keep */ }
    // Quota (429), not-found (404), and "model unavailable" (400) are all worth
    // trying the next model; auth/permission (401/403) are not.
    if (r.status !== 429 && r.status !== 404 && r.status !== 400) break;
  }
  throw httpError(lastMsg, lastStatus);
}

export default async function handler(req, res) {
  const provider = activeProvider();
  const configured = !!provider;

  if (req.method === "GET") {
    res.status(200).json({ ok: true, configured, provider });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!configured) {
    res.status(501).json({ error: "AI food logging isn't configured — set GROQ_API_KEY (or GEMINI_API_KEY)." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { image, text } = body;
    if (!image && !(text && text.trim())) {
      res.status(400).json({ error: "send an image or a text description" });
      return;
    }

    const result = provider === "groq" ? await callGroq({ image, text }) : await callGemini({ image, text });
    res.status(200).json(result);
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    if (status === 429) {
      res.status(429).json({ error: "The AI's free quota is maxed right now — wait a minute and try again, or add a bite manually." });
      return;
    }
    if (status === 422) {
      res.status(422).json({ error: "Couldn't analyze that one — try a manual entry." });
      return;
    }
    res.status(status >= 400 && status < 500 ? 502 : 500).json({ error: e && e.message ? e.message : String(e) });
  }
}
