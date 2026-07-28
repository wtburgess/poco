// Shared UI helpers: layout chrome, nav, toast, modal, icons.
import { getState, getEquipped } from "./store.js";

export const NAV = [
  { id: "checkin", label: "Check-in", icon: "task_alt" },
  { id: "food", label: "Food", icon: "restaurant" },
  { id: "health", label: "Health", icon: "favorite" },
  { id: "habits", label: "Habits", icon: "repeat" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function icon(name, extra = "") {
  return `<span class="material-symbols-outlined ${extra}">${name}</span>`;
}

// Inline Poco the sloth mascot (SVG) — chunky organic style, no external asset.
// opts: { mood, accessory, alive }. mood drives his face; accessory is a cosmetic
// id (defaults to whatever's equipped); alive adds the idle bob + blink animation.
export function pocoSvg(size = 48, opts = {}) {
  const mood = opts.mood || "chill";
  const accessory = opts.accessory !== undefined ? opts.accessory : getEquipped();
  const alive = opts.alive ? "poco-alive" : "";
  return `<svg class="poco ${alive}" viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-label="Poco the sloth, feeling ${mood}">
    <!-- shaggy olive fur -->
    <path d="${FUR}" fill="${B_GREEN}" stroke="${B_INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <!-- cream face mask -->
    <path d="M26 46 Q26 33 42 33 Q50 33 58 33 Q74 33 74 46 Q77 57 71 67 Q63 83 50 83 Q37 83 29 67 Q23 57 26 46 Z" fill="${B_CREAM}" stroke="${B_INK}" stroke-width="2.5"/>
    ${brow(mood)}
    <!-- olive eye patches -->
    <circle cx="39" cy="50" r="11" fill="${B_GREEN_D}" stroke="${B_INK}" stroke-width="2"/>
    <circle cx="62" cy="49" r="11.5" fill="${B_GREEN_D}" stroke="${B_INK}" stroke-width="2"/>
    <g class="poco-eyes">${eyes(mood)}</g>
    <!-- big friendly nose -->
    <ellipse cx="50" cy="60" rx="7.6" ry="5.6" fill="${B_NOSE}"/>
    <ellipse cx="47.4" cy="58" rx="1.7" ry="1.1" fill="#fff" opacity="0.35"/>
    ${mouth(mood)}
    ${extras(mood)}
    <!-- signature leaf sprig -->
    <path d="M15 34 Q7 24 18 20" fill="none" stroke="#3c6626" stroke-width="4" stroke-linecap="round"/>
    <path d="M15 24 Q21 19 24 26 Q18 28 15 24 Z" fill="#bef1a0" stroke="#3c6626" stroke-width="2"/>
    ${accessorySvg(accessory)}
  </svg>`;
}

// Illustrated PNG mascot (/poco.png) for the static logo / avatar / hero spots,
// with the inline SVG as an automatic fallback until the image file is added.
export function pocoImg(size = 48) {
  // Zoom-cropped via .poco-face so the illustration's padding is trimmed and it
  // fills its (overflow-hidden) round container. ?v busts any cached 404.
  return `<img src="/poco.png?v=2" alt="Poco" width="${size}" height="${size}" decoding="async" class="poco-face" onerror="window.__pocoFallback&&window.__pocoFallback(this,${size})">`;
}
if (typeof window !== "undefined") {
  window.__pocoFallback = (imgEl, s) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = pocoSvg(s);
    const el = wrap.firstElementChild;
    if (el) imgEl.replaceWith(el);
  };
}

// Poco's palette — muted olive fur, cream face, warm brown ink.
const B_INK = "#43301e";
const B_GREEN = "#8f9161";
const B_GREEN_D = "#787a4c";
const B_CREAM = "#f1ecd6";
const B_NOSE = "#5c4433";
const B_IRIS = "#5a3f28";
const B_TONGUE = "#e07f92";

// Shaggy, spiky fur silhouette — generated once, deterministic so it never jitters.
const FUR = (() => {
  const cx = 50, cy = 55, N = 26;
  const jitter = [0, 1.5, -1, 1, 0, 2, -1.5, 0.5, 1, -1, 0, 1.5, -1, 0.5, 1, -1.5, 0, 1, -1, 1.5, 0, -1, 1, 0, -1.5, 1];
  let d = "";
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const top = Math.max(0, Math.cos(a)); // shaggier at the top
    const r = (i % 2 === 0 ? 46 : 40) + top * 6 + jitter[i];
    d += (i === 0 ? "M" : "L") + (cx + Math.cos(a) * r).toFixed(1) + " " + (cy + Math.sin(a) * r).toFixed(1);
  }
  return d + "Z";
})();

// A cream eyeball with a brown iris + glint. ix/iy nudge the gaze.
function openEye(cx, cy, r, ix, iy, ir) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${B_CREAM}" stroke="${B_INK}" stroke-width="1.5"/>`
    + `<circle cx="${cx + ix}" cy="${cy + iy}" r="${ir}" fill="${B_IRIS}"/>`
    + `<circle cx="${cx + ix - 1.3}" cy="${cy + iy - 1.3}" r="${(ir * 0.34).toFixed(2)}" fill="#fff"/>`;
}
function heartOnEye(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${B_CREAM}" stroke="${B_INK}" stroke-width="1.5"/>`
    + `<path d="M${cx} ${cy + 3.4} C ${cx - 5} ${cy - 1}, ${cx - 5.4} ${cy - 5}, ${cx - 2.5} ${cy - 5} C ${cx - 0.6} ${cy - 5}, ${cx} ${cy - 3}, ${cx} ${cy - 2.4} C ${cx} ${cy - 3}, ${cx + 0.6} ${cy - 5}, ${cx + 2.5} ${cy - 5} C ${cx + 5.4} ${cy - 5}, ${cx + 5} ${cy - 1}, ${cx} ${cy + 3.4} Z" fill="#ff5d8f"/>`;
}
function closedArc(cx, cy, r, down) {
  const d = down ? `M${cx - r} ${cy - 1} Q${cx} ${cy + r * 0.7} ${cx + r} ${cy - 1}` : `M${cx - r} ${cy + 1} Q${cx} ${cy - r * 0.7} ${cx + r} ${cy + 1}`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${B_CREAM}" stroke="${B_INK}" stroke-width="1.5"/><path d="${d}" fill="none" stroke="${B_INK}" stroke-width="2.5" stroke-linecap="round"/>`;
}
function xEye(cx, cy, r) {
  const o = r * 0.55;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${B_CREAM}" stroke="${B_INK}" stroke-width="1.5"/><path d="M${cx - o} ${cy - o} L${cx + o} ${cy + o} M${cx + o} ${cy - o} L${cx - o} ${cy + o}" stroke="${B_INK}" stroke-width="2.5" stroke-linecap="round"/>`;
}
function halfLid(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${B_CREAM}" stroke="${B_INK}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy + 1.5}" r="3" fill="${B_IRIS}"/><path d="M${cx - r - 0.5} ${cy - 1.5} Q${cx} ${cy - 5} ${cx + r + 0.5} ${cy - 1.5} L${cx + r} ${cy} L${cx - r} ${cy} Z" fill="${B_GREEN_D}" stroke="${B_INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

function eyes(mood) {
  switch (mood) {
    case "happy":     return openEye(39, 50, 7.6, 0, -1.5, 3.6) + openEye(62, 49, 8, 0, -1.5, 3.8);
    case "ecstatic":  return openEye(39, 50, 7.6, 0, -2, 3.8) + openEye(62, 49, 8, 0, -2, 4);
    case "love":      return heartOnEye(39, 50, 7.6) + heartOnEye(62, 49, 8);
    case "sad":       return openEye(39, 50, 7.6, 0.5, -2, 3) + openEye(62, 49, 8, -0.5, -2, 3.2);
    case "panic":     return openEye(39, 50, 7.6, 0, 0, 1.6) + openEye(62, 49, 8, 0, 0, 1.6);
    case "sleepy":    return closedArc(39, 50, 7.6, true) + closedArc(62, 49, 8, true);
    case "zen":       return closedArc(39, 50, 7.6, false) + closedArc(62, 49, 8, false);
    case "dead":      return xEye(39, 50, 7.6) + xEye(62, 49, 8);
    case "suspicious":return openEye(39, 50, 7.6, 1.6, -0.5, 3.4) + halfLid(62, 49, 8);
    // Default: a warm, slightly cheeky gaze.
    default:          return openEye(39, 50, 7.6, 1, 1, 3.6) + openEye(62, 49, 8, -1, 1, 3.8);
  }
}
function brow(mood) {
  const s = `fill="none" stroke="${B_INK}" stroke-width="2.5" stroke-linecap="round"`;
  switch (mood) {
    case "sad":       return `<path d="M31 39 Q38 35 45 39" ${s}/><path d="M55 38 Q62 34 70 38" ${s}/>`;
    case "suspicious":return `<path d="M31 37 Q38 33 46 38" ${s}/><path d="M55 42 Q62 41 71 42" ${s}/>`;
    case "panic":
    case "ecstatic":  return `<path d="M31 36 Q40 31 47 35" ${s}/><path d="M53 35 Q60 31 71 36" ${s}/>`;
    default:          return "";
  }
}
function mouth(mood) {
  const st = `fill="none" stroke="${B_INK}" stroke-width="3" stroke-linecap="round"`;
  // A bit of tongue lolling out the side — Poco's signature goof.
  const tongue = `<path d="M56 70 q5 5 8 1 q0 -5 -5 -4 z" fill="${B_TONGUE}" stroke="${B_INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
  switch (mood) {
    case "happy":     return `<path d="M35 64 Q50 79 65 64" ${st}/>${tongue}`;
    case "love":      return `<path d="M36 64 Q50 80 64 64" fill="#7a3b2e" stroke="${B_INK}" stroke-width="2"/><path d="M44 72 Q50 78 56 72 Z" fill="${B_TONGUE}"/>`;
    case "ecstatic":  return `<path d="M35 63 Q50 85 65 63 Z" fill="#7a3b2e" stroke="${B_INK}" stroke-width="2.5"/><path d="M44 74 Q50 81 56 74 Z" fill="${B_TONGUE}"/>`;
    case "sleepy":    return `<ellipse cx="50" cy="70" rx="3.5" ry="4.5" fill="#7a3b2e"/>`;
    case "dead":      return `<path d="M40 70 q3.5 -3 7 0 q3.5 3 7 0" ${st}/>`;
    case "sad":       return `<path d="M40 72 Q50 65 60 72" ${st}/>`;
    case "panic":     return `<path d="M41 71 q3 -4 6 0 q3 4 6 0" ${st}/>`;
    case "zen":       return `<path d="M42 68 Q50 72 58 68" ${st}/>`;
    case "suspicious":return `<path d="M40 68 Q50 67 60 68" ${st}/>${tongue}`;
    // Default: wide friendly smile + a bit of tongue.
    default:          return `<path d="M36 65 Q50 76 64 65" ${st}/>${tongue}`;
  }
}
function extras(mood) {
  switch (mood) {
    case "sleepy":    return `<text x="72" y="28" font-size="13" fill="#3c6626" font-family="Nunito Sans, sans-serif" font-weight="900">z</text><text x="80" y="20" font-size="9" fill="#3c6626" font-family="Nunito Sans, sans-serif" font-weight="900">z</text>`;
    case "panic":     return `<path d="M79 36 q3.5 6 0 10 q-3.5 -4 0 -10 Z" fill="#7ec8e3" stroke="${B_INK}" stroke-width="1"/>`;
    case "sad":       return `<path d="M35 57 q2 5 0 8 q-2 -3 0 -8 Z" fill="#7ec8e3"/>`;
    case "dead":      return `<path d="M32 60 Q39 63 46 60" fill="none" stroke="#8a6b57" stroke-width="1.5"/><path d="M56 59 Q63 62 70 59" fill="none" stroke="#8a6b57" stroke-width="1.5"/>`;
    case "ecstatic":  return star(85, 26) + star(14, 60) + star(82, 70);
    case "love":      return heartMini(83, 24) + heartMini(15, 30);
    default:          return "";
  }
}
function star(x, y) {
  return `<path d="M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z" fill="#ffd166" stroke="${B_INK}" stroke-width="0.6"/>`;
}
function heartMini(x, y) {
  return `<path d="M${x} ${y + 3} C ${x - 4} ${y - 1}, ${x - 5} ${y - 4}, ${x - 2.5} ${y - 4} C ${x - 1} ${y - 4}, ${x} ${y - 2.5} , ${x} ${y - 2} C ${x} ${y - 2.5}, ${x + 1} ${y - 4}, ${x + 2.5} ${y - 4} C ${x + 5} ${y - 4}, ${x + 4} ${y - 1}, ${x} ${y + 3} Z" fill="#ff5d8f"/>`;
}

// ---- Cosmetics rendered onto Poco ----
function accessorySvg(id) {
  switch (id) {
    case "party_hat":
      return `<path d="M50 1 L37 26 L63 26 Z" fill="#ff5d8f" stroke="#28180b" stroke-width="2.5" stroke-linejoin="round"/><path d="M43 13 L57 13 M40 20 L60 20" stroke="#fff" stroke-width="2"/><circle cx="50" cy="2" r="3.5" fill="#ffd166" stroke="#28180b" stroke-width="1.5"/>`;
    case "shades":
      return `<rect x="23" y="47" width="23" height="13" rx="5" fill="#141414" stroke="#28180b" stroke-width="2"/><rect x="54" y="47" width="23" height="13" rx="5" fill="#141414" stroke="#28180b" stroke-width="2"/><path d="M46 50 Q50 47 54 50" fill="none" stroke="#141414" stroke-width="3"/><path d="M27 50 l4 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M58 50 l4 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`;
    case "monocle":
      return `<circle cx="62" cy="49" r="13" fill="none" stroke="#ffd166" stroke-width="2.5"/><path d="M62 62 Q59 76 53 84" fill="none" stroke="#28180b" stroke-width="1.5"/>`;
    case "mustache":
      return `<path d="M50 65 Q42 63 38 67 Q43 69 50 66 Q57 69 62 67 Q58 63 50 65 Z" fill="#4a3420" stroke="#28180b" stroke-width="1"/>`;
    case "flower_crown":
      return [30, 42, 54, 66].map((x, i) => flower(x, 24 - (i % 2) * 3)).join("");
    case "crown":
      return `<path d="M33 22 L37 10 L44 18 L50 7 L56 18 L63 10 L67 22 Z" fill="#ffd166" stroke="#28180b" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="9" r="2" fill="#ff5d8f"/>`;
    case "snail":
      return `<g transform="translate(72,72)"><ellipse cx="6" cy="8" rx="8" ry="4" fill="#a3d487" stroke="#28180b" stroke-width="1.5"/><path d="M-1 8 q-3 -1 -3 -4" fill="none" stroke="#28180b" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="3" r="6" fill="#f2c078" stroke="#28180b" stroke-width="1.5"/><path d="M9 3 q0 -2.5 2.5 -2.5 q2.5 0 2.5 2.5 q0 2 -2 2" fill="none" stroke="#28180b" stroke-width="1.2"/></g>`;
    case "third_eye":
      return `<path d="M43 27 Q50 24 57 27" fill="none" stroke="#28180b" stroke-width="2" stroke-linecap="round"/><ellipse cx="50" cy="33" rx="6" ry="7" fill="#28180b"/><circle cx="50" cy="34" r="3.4" fill="#fff"/><circle cx="50" cy="35" r="1.9" fill="#28180b"/>`;
    default:
      return "";
  }
}
function flower(x, y) {
  return `<g><circle cx="${x}" cy="${y - 3}" r="2.2" fill="#ff9ec4"/><circle cx="${x - 3}" cy="${y}" r="2.2" fill="#ff9ec4"/><circle cx="${x + 3}" cy="${y}" r="2.2" fill="#ff9ec4"/><circle cx="${x}" cy="${y + 3}" r="2.2" fill="#ff9ec4"/><circle cx="${x}" cy="${y}" r="2" fill="#ffd166"/></g>`;
}

// Leaf-confetti burst for celebrations.
export function celebrate() {
  const root = document.getElementById("toast-root");
  const burst = document.createElement("div");
  burst.className = "confetti";
  const bits = ["🌿", "🍃", "🌱", "✨", "🍀"];
  for (let i = 0; i < 22; i++) {
    const s = document.createElement("span");
    s.textContent = bits[i % bits.length];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDelay = Math.random() * 0.35 + "s";
    s.style.animationDuration = 1.4 + Math.random() * 1.1 + "s";
    s.style.fontSize = 14 + Math.random() * 16 + "px";
    burst.appendChild(s);
  }
  root.appendChild(burst);
  setTimeout(() => burst.remove(), 2800);
}

export function topBar() {
  const { points } = getState();
  return `
  <header class="w-full sticky top-0 z-40 bg-background border-b-border-width border-on-secondary-fixed shadow-[var(--shadow-soft)]">
    <div class="flex items-center justify-between px-container-padding py-unit w-full max-w-3xl md:max-w-5xl mx-auto md:pl-72">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-full chunky-border overflow-hidden bg-primary-fixed flex items-center justify-center">
          ${pocoImg(44)}
        </div>
        <h1 class="font-display-sm text-display-sm font-black text-primary tracking-tight">Poco</h1>
      </div>
      <button data-action="rewards" class="chunky-button flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full chunky-border bg-tertiary-fixed shadow-[var(--shadow-soft)]">
        ${icon("energy_savings_leaf", "text-primary fill-icon")}
        <span class="font-label-bold text-label-bold text-on-tertiary-fixed">${points}</span>
      </button>
    </div>
  </header>`;
}

export function sideNav(active) {
  return `
  <nav class="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-surface-container border-r-border-width border-on-secondary-fixed px-4 py-6 gap-2 z-30">
    <div class="flex items-center gap-2 px-3 mb-6">
      <div class="w-12 h-12 rounded-full chunky-border overflow-hidden bg-primary-fixed flex items-center justify-center">${pocoImg(48)}</div>
      <span class="font-display-sm text-display-sm font-black text-primary tracking-tight">Poco</span>
    </div>
    ${NAV.map((n) => navItemDesktop(n, active)).join("")}
    <p class="mt-auto px-3 font-body-md text-xs text-on-surface-variant">Slow and steady 🌿</p>
  </nav>`;
}

function navItemDesktop(n, active) {
  const on = n.id === active;
  return `<a href="#/${n.id}" class="flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
    on
      ? "bg-primary-container text-on-primary-container border-border-width border-on-secondary-fixed"
      : "text-on-surface-variant hover:bg-secondary-container/50"
  }">
    ${icon(n.icon, on ? "fill-icon" : "")}
    <span class="font-label-bold text-label-bold">${n.label}</span>
  </a>`;
}

export function bottomNav(active) {
  return `
  <nav class="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch px-1 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] bg-surface-container border-t-border-width border-on-secondary-fixed shadow-[var(--shadow-soft-up)]">
    ${NAV.map((n) => {
      const on = n.id === active;
      return `<a href="#/${n.id}" aria-label="${n.label}" aria-current="${on ? "page" : "false"}" class="flex-1 min-w-0 flex flex-col items-center gap-1 py-0.5 transition-transform active:scale-90">
        <span class="flex items-center justify-center w-14 h-8 rounded-full transition-colors ${
          on
            ? "bg-primary-container text-on-primary-container border-border-width border-on-secondary-fixed"
            : "text-on-surface-variant"
        }">${icon(n.icon, on ? "fill-icon" : "")}</span>
        <span class="font-label-bold text-[11px] leading-none truncate max-w-full ${on ? "text-primary font-black" : "text-on-surface-variant"}">${n.label}</span>
      </a>`;
    }).join("")}
  </nav>`;
}

// Wraps a view body with the standard chrome.
export function shell(active, bodyHtml) {
  return `
    ${sideNav(active)}
    <div class="md:pl-64 min-h-screen">
      ${topBar()}
      <main class="max-w-xl mx-auto px-container-padding pt-6 pb-32 flex flex-col gap-gutter">
        ${bodyHtml}
      </main>
    </div>
    ${bottomNav(active)}
  `;
}

// ---- Toast ----
export function toast(message, iconName = "energy_savings_leaf") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${icon(iconName, "fill-icon")}<span>${message}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 250);
  }, 2200);
}

// ---- Modal ----
export function openModal(innerHtml, { onMount } = {}) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>
    <div class="modal-sheet" role="dialog" aria-modal="true">${innerHtml}</div>
  </div>`;
  const backdrop = root.querySelector("[data-modal-backdrop]");
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", escClose);
  document.body.style.overflow = "hidden"; // stop the page scrolling behind the sheet
  if (onMount) onMount(root);
}
function escClose(e) {
  if (e.key === "Escape") closeModal();
}
export function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
  document.removeEventListener("keydown", escClose);
  document.body.style.overflow = "";
}

export function pct(n, d) {
  if (!d) return 0;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}
