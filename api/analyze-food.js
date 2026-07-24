// AI food analysis: takes a photo and/or text description of a meal and returns
// a structured nutrition estimate. Uses Claude (vision + structured outputs).
//
//   GET  → { ok, configured }        — probe so the client knows whether to
//                                       show the AI flow or fall back to manual.
//   POST { image?, text? }           → a single nutrition estimate object.
//
// When ANTHROPIC_API_KEY is unset we return 501 so the client can fall back to
// plain manual entry instead of pretending the AI is available.
import Anthropic from "@anthropic-ai/sdk";

// Vision estimates can take longer than Vercel's default 10s function limit —
// give the request room so a photo analysis doesn't 504 mid-flight.
export const config = { maxDuration: 60 };

// Material Symbol names Poco already ships — keep the model on-palette.
const ICONS = [
  "restaurant", "breakfast_dining", "lunch_dining", "dinner_dining",
  "local_cafe", "bakery_dining", "nutrition", "local_pizza", "ramen_dining",
  "egg_alt", "set_meal", "kebab_dining", "icecream", "cake", "local_bar",
  "grocery", "fastfood", "liquor", "cookie",
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Short human name for the food, e.g. 'Avocado toast'." },
    kcal: { type: "integer", description: "Total calories for the portion shown/described." },
    protein_g: { type: "number" },
    fat_g: { type: "number" },
    carbs_g: { type: "number" },
    sugar_g: { type: "number" },
    fiber_g: { type: "number" },
    serving: { type: "string", description: "The portion this estimate is for, e.g. '1 bowl (~300g)'." },
    icon: { type: "string", enum: ICONS, description: "Best-matching Material Symbol name." },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string", description: "One short, friendly line — call out assumptions (e.g. assumed a normal serving) or caveats. Keep it under ~140 chars." },
  },
  required: ["name", "kcal", "protein_g", "fat_g", "carbs_g", "sugar_g", "fiber_g", "serving", "icon", "confidence", "note"],
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
  const configured = !!process.env.ANTHROPIC_API_KEY;

  if (req.method === "GET") {
    res.status(200).json({ ok: true, configured });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!configured) {
    res.status(501).json({ error: "AI food logging isn't configured — set ANTHROPIC_API_KEY." });
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

    const content = [];
    if (img) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.media_type, data: img.data },
      });
    }
    content.push({
      type: "text",
      text: text && text.trim()
        ? `Estimate the nutrition for this meal: ${text.trim()}`
        : "Estimate the nutrition for the food in this image.",
    });

    const client = new Anthropic();
    // Stream to dodge intermediate proxy timeouts on vision requests, and keep
    // effort low — a portion estimate doesn't need deep deliberation, so this
    // stays fast and cheap.
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content }],
    });
    const response = await stream.finalMessage();

    if (response.stop_reason === "refusal") {
      res.status(422).json({ error: "Couldn't analyze that one — try a manual entry." });
      return;
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      res.status(502).json({ error: "empty response from the model" });
      return;
    }
    const data = JSON.parse(textBlock.text);
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
