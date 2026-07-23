// Client-side helpers for AI food logging: a cached probe of the serverless
// endpoint, the analyze call itself, image downscaling, and Web Speech dictation.
// Everything degrades gracefully — if /api isn't there (guest/local), aiStatus()
// reports unconfigured and the UI falls back to manual entry.

let _statusPromise = null;

// Cached GET probe. Returns { ok, configured }. Never throws — a network/404
// failure (no serverless backend) resolves to unconfigured.
export function aiStatus() {
  if (!_statusPromise) {
    _statusPromise = fetch("/api/analyze-food", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ok: false, configured: false }))
      .catch(() => ({ ok: false, configured: false }));
  }
  return _statusPromise;
}

// POST { image?, text? } → nutrition estimate object. Throws on error so the
// caller can show a message + offer manual entry.
export async function analyzeFood({ image, text } = {}) {
  const r = await fetch("/api/analyze-food", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image, text }),
  });
  if (!r.ok) {
    let msg = `Analysis failed (${r.status})`;
    try {
      const j = await r.json();
      if (j && j.error) msg = j.error;
    } catch { /* keep default */ }
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// Downscale a File/Blob to a JPEG data URL (long edge ≤ maxEdge). Keeps uploads
// small so analysis is fast and cheap. Falls back to the raw data URL if canvas
// isn't available for some reason.
export function resizeImage(file, maxEdge = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("couldn't read that image"));
    };
    img.src = url;
  });
}

// ---- Web Speech API dictation ----
function SpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function speechSupported() {
  return !!SpeechRecognition();
}

// Start dictation. Calls onResult(text, isFinal) as speech comes in.
// Returns a stop() function. onEnd/onError are optional.
export function dictate({ onResult, onEnd, onError } = {}) {
  const SR = SpeechRecognition();
  if (!SR) {
    if (onError) onError(new Error("Voice input isn't supported here."));
    return () => {};
  }
  const rec = new SR();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let text = "";
    let isFinal = false;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) isFinal = true;
    }
    if (onResult) onResult(text.trim(), isFinal);
  };
  rec.onerror = (e) => { if (onError) onError(e.error || e); };
  rec.onend = () => { if (onEnd) onEnd(); };
  try {
    rec.start();
  } catch (e) {
    if (onError) onError(e);
  }
  return () => { try { rec.stop(); } catch { /* ignore */ } };
}
