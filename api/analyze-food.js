// AI food analysis: takes a photo and/or text description of a meal and returns
// a structured nutrition estimate. Uses Google Gemini (free tier) via its REST
// API — no SDK dependency, just fetch.
//
//   GET  → { ok, configured }        — probe so the client / verify step knows
//                                       whether the AI backend is wired up.
//   POST { image?, text? }           → a single nutrition estimate object.
//
// Set GEMINI_API_KEY (free key from https://aistudio.google.com/apikey).
// No key → 501 so the client falls back to plain manual entry.

// Gemini Flash is fast, but give the function a little headroom anyway.
export const config = { maxDuration: 30 };

// Free-tier multimodal models. We try them in order and fall through to the
// next one on a quota (429) or not-found (404) error, since free quota is
// granted per-model — if one is tapped out, another often still works.
// GEMINI_MODEL (if set) is tried first.
const PREFERRED = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const MODELS = [...new Set([PREFERRED, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"])];

// Material Symbol names Poco already ships — keep the model on-palette.
const ICONS = [
  "restaurant", "breakfast_dining", "lunch_dining", "dinner_dining",
  "local_cafe", "bakery_dining", "nutrition", "local_pizza", "ramen_dining",
  "egg_alt", "set_meal", "kebab_dining", "icecream", "cake", "local_bar",
  "grocery", "fastfood", "liquor", "cookie",
];

// Gemini uses an OpenAPI-subset schema: UPPERCASE type names, no
// additionalProperties. propertyOrdering keeps the JSON stable.
const SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING", description: "Short human name for the food, e.g. 'Avocado toast'." },
    kcal: { type: "INTEGER", description: "Total calories for the portion shown/described." },
    protein_g: { type: "NUMBER" },
    fat_g: { type: "NUMBER" },
    carbs_g: { type: "NUMBER" },
    sugar_g: { type: "NUMBER" },
    fiber_g: { type: "NUMBER" },
    serving: { type: "STRING", description: "The portion this estimate is for, e.g. '1 bowl (~300g)'." },
    icon: { type: "STRING", enum: ICONS, description: "Best-matching Material Symbol name." },
    confidence: { type: "STRING", enum: ["low", "medium", "high"] },
    note: { type: "STRING", description: "One short, friendly line — call out assumptions or caveats. Under ~140 chars." },
  },
  required: ["name", "kcal", "protein_g", "fat_g", "carbs_g", "sugar_g", "fiber_g", "serving", "icon", "confidence", "note"],
  propertyOrdering: ["name", "kcal", "protein_g", "fat_g", "carbs_g", "sugar_g", "fiber_g", "serving", "icon", "confidence", "note"],
};

const SYSTEM = `You are Poco's food-logging helper — you turn a photo and/or a short description of a meal into a realistic nutrition estimate.

Rules:
- Estimate for the portion actually shown in the image or described in the text. If the amount is unclear, assume a normal single serving and SAY SO in "note".
- Give your best realistic numbers even when unsure — never refuse or return zeros just because it's ambiguous. Set "confidence" honestly instead.
- kcal should be roughly consistent with the macros (protein/carbs ≈ 4 kcal/g, fat ≈ 9 kcal/g).
- Pick the single closest "icon" from the allowed list.
- "note" is one short, warm line (Poco's voice is gentle and a little playful). Mention any assumption you made about portion size.
- If the image or text clearly isn't food, still return the object with kcal 0, confidence "low", and a "note" saying it didn't look like food.`;

function parseImage(image) {
  // Accept a data URL ("data:image/jpeg;base64,....") or a bare base64 string.
  if (!image || typeof image !== "string") return null;
  const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s);
  if (m) return { media_type: m[1], data: m[2] };
  return { media_type: "image/jpeg", data: image };
}

export default async function handler(req, res) {
  const configured = !!process.env.GEMINI_API_KEY;

  if (req.method === "GET") {
    res.status(200).json({ ok: true, configured });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!configured) {
    res.status(501).json({ error: "AI food logging isn't configured — set GEMINI_API_KEY." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { image, text } = body;
    const img = parseImage(image);
    if (!img && !(text && text.trim())) {
      res.status(400).json({ error: "send an image or a text description" });
      return;
    }

    const parts = [];
    if (img) {
      parts.push({ inline_data: { mime_type: img.media_type, data: img.data } });
    }
    parts.push({
      text: text && text.trim()
        ? `Estimate the nutrition for this meal: ${text.trim()}`
        : "Estimate the nutrition for the food in this image.",
    });

    const payload = JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
      },
    });

    let lastStatus = 502;
    let lastMsg = "Analysis failed";
    for (const model of MODELS) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: payload,
      });

      if (r.ok) {
        const data = await r.json();
        // Safety block (no candidate) → let the client fall back to manual.
        if (data.promptFeedback && data.promptFeedback.blockReason) {
          res.status(422).json({ error: "Couldn't analyze that one — try a manual entry." });
          return;
        }
        const cand = data.candidates && data.candidates[0];
        const partWithText = cand && cand.content && cand.content.parts
          ? cand.content.parts.find((p) => typeof p.text === "string")
          : null;
        if (!partWithText) {
          res.status(502).json({ error: "empty response from the model" });
          return;
        }
        res.status(200).json(JSON.parse(partWithText.text));
        return;
      }

      lastStatus = r.status;
      lastMsg = `Analysis failed (${r.status})`;
      try {
        const j = await r.json();
        if (j && j.error && j.error.message) lastMsg = j.error.message;
      } catch { /* keep default */ }

      // Only try the next model on quota (429) or model-not-found (404).
      // Anything else (auth, bad request) won't be fixed by switching models.
      if (r.status !== 429 && r.status !== 404) break;
    }

    if (lastStatus === 429) {
      res.status(429).json({ error: "Gemini's free quota is maxed right now — give it a minute and try again, or add a bite manually." });
      return;
    }
    res.status(502).json({ error: lastMsg });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
