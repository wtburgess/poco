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
    <!-- shaggy head tufts -->
    <circle cx="33" cy="21" r="9" fill="${B_GREEN}" stroke="${B_INK}" stroke-width="3.5"/>
    <circle cx="50" cy="15" r="10" fill="${B_GREEN}" stroke="${B_INK}" stroke-width="3.5"/>
    <circle cx="67" cy="21" r="9" fill="${B_GREEN}" stroke="${B_INK}" stroke-width="3.5"/>
    <!-- green head -->
    <circle cx="50" cy="53" r="40" fill="${B_GREEN}" stroke="${B_INK}" stroke-width="4"/>
    <!-- cream face mask -->
    <path d="M25 44 Q50 32 75 44 Q83 58 74 73 Q64 87 50 87 Q36 87 26 73 Q17 58 25 44 Z" fill="${B_CREAM}" stroke="${B_INK}" stroke-width="2.5"/>
    ${brow(mood)}
    <!-- asymmetric dark eye patches -->
    <ellipse cx="37" cy="52" rx="13" ry="16" fill="${B_PATCH}" transform="rotate(-11 37 52)"/>
    <ellipse cx="63" cy="52" rx="11" ry="14.5" fill="${B_PATCH}" transform="rotate(13 63 52)"/>
    <g class="poco-eyes">${eyes(mood)}</g>
    <path d="M44 62 Q50 57 56 62 Q54 69 50 69 Q46 69 44 62 Z" fill="${B_INK}"/>
    ${mouth(mood)}
    ${extras(mood)}
    <path d="M16 38 Q9 27 19 23" fill="none" stroke="#3c6626" stroke-width="4" stroke-linecap="round"/>
    <path d="M17 27 Q23 23 25 29 Q19 31 17 27 Z" fill="#bef1a0" stroke="#3c6626" stroke-width="2"/>
    ${accessorySvg(accessory)}
  </svg>`;
}

// Poco's palette.
const B_INK = "#3d2817";
const B_GREEN = "#6f9a4d";
const B_CREAM = "#efe6c8";
const B_PATCH = "#4a3320";
const B_TONGUE = "#e06a8b";

function eyeball(cx, cy, r, px, py, pr) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${B_INK}" stroke-width="1.5"/>` +
    `<circle cx="${cx + px}" cy="${cy + py}" r="${pr}" fill="${B_INK}"/>` +
    `<circle cx="${cx + px - 1}" cy="${cy + py - 1}" r="${pr / 3}" fill="#fff"/>`;
}
function heartEye(cx, cy) {
  return `<path d="M${cx} ${cy + 4} C ${cx - 6} ${cy - 2}, ${cx - 7} ${cy - 6}, ${cx - 3.5} ${cy - 6} C ${cx - 1} ${cy - 6}, ${cx} ${cy - 4}, ${cx} ${cy - 3} C ${cx} ${cy - 4}, ${cx + 1} ${cy - 6}, ${cx + 3.5} ${cy - 6} C ${cx + 7} ${cy - 6}, ${cx + 6} ${cy - 2}, ${cx} ${cy + 4} Z" fill="#ff5d8f"/>`;
}
function eyes(mood) {
  switch (mood) {
    // Symmetric & bright when he's up.
    case "happy":     return eyeball(37, 52, 7, 0, -1, 3) + eyeball(63, 51, 7, 0, -1, 3);
    case "ecstatic":  return eyeball(37, 51, 8, 0, -1, 3.6) + eyeball(63, 50, 8, 0, -1, 3.6);
    case "love":      return heartEye(37, 52) + heartEye(63, 51);
    case "sad":       return eyeball(37, 55, 6, 0, -1, 3) + eyeball(63, 54, 6, 0, -1, 3);
    case "panic":     return eyeball(37, 52, 8.5, -1, 0, 1.6) + eyeball(63, 51, 8.5, 1, 0, 1.6);
    case "sleepy":    return `<path d="M30 55 Q37 61 44 55" stroke="${B_INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M56 54 Q63 60 70 54" stroke="${B_INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    case "zen":       return `<path d="M30 56 Q37 50 44 56" stroke="${B_INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M56 55 Q63 49 70 55" stroke="${B_INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    case "dead":      return `<path d="M32 48 L42 58 M42 48 L32 58" stroke="${B_INK}" stroke-width="3" stroke-linecap="round"/><path d="M58 47 L68 57 M68 47 L58 57" stroke="${B_INK}" stroke-width="3" stroke-linecap="round"/>`;
    case "suspicious":return eyeball(37, 52, 8, 2, -1, 3.4) + `<path d="M56 52 Q63 49 70 52" stroke="${B_INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    // Default: the signature wonky, cross-eyed googly stare.
    default:          return eyeball(37, 53, 7.5, -2, 2, 3) + eyeball(63, 51, 5.5, 2, -2, 2.6);
  }
}
function brow(mood) {
  const s = `fill="none" stroke="${B_INK}" stroke-width="3" stroke-linecap="round"`;
  switch (mood) {
    case "sad":       return `<path d="M30 41 Q38 37 45 40" ${s}/><path d="M55 40 Q62 37 70 41" ${s}/>`;
    case "suspicious":return `<path d="M29 39 Q37 35 46 40" ${s}/><path d="M55 44 Q63 43 71 44" ${s}/>`;
    case "panic":
    case "ecstatic":  return `<path d="M29 38 Q40 33 47 37" ${s}/><path d="M53 37 Q60 33 71 38" ${s}/>`;
    default:          return "";
  }
}
function mouth(mood) {
  const stroke = `fill="none" stroke="${B_INK}" stroke-width="3.5" stroke-linecap="round"`;
  // A little tongue lolling out the side — Poco's signature goof.
  const tongue = `<path d="M56 78 q5 5 8 0 q0 -5 -5 -4 z" fill="${B_TONGUE}" stroke="${B_INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  switch (mood) {
    case "happy":     return `<path d="M38 72 Q50 83 62 72" ${stroke}/>${tongue}`;
    case "love":      return `<path d="M39 71 Q50 86 61 71 Z" fill="#7a3b2e" stroke="${B_INK}" stroke-width="2"/><path d="M45 79 Q50 85 55 79 Z" fill="${B_TONGUE}"/>`;
    case "ecstatic":  return `<path d="M37 70 Q50 92 63 70 Z" fill="#7a3b2e" stroke="${B_INK}" stroke-width="2.5"/><path d="M45 81 Q50 88 55 81 Z" fill="${B_TONGUE}"/>`;
    case "sleepy":    return `<ellipse cx="50" cy="77" rx="3.5" ry="5" fill="#7a3b2e"/>`;
    case "dead":      return `<path d="M42 77 q4 -3 8 0 q4 3 8 0" ${stroke}/>`;
    case "sad":       return `<path d="M42 79 Q50 72 58 79" ${stroke}/>`;
    case "panic":     return `<path d="M42 78 q3 -4 6 0 q3 4 6 0" ${stroke}/>`;
    case "zen":       return `<path d="M43 75 Q50 79 57 75" ${stroke}/>`;
    case "suspicious":return `<path d="M43 76 Q50 74 57 76" ${stroke}/>${tongue}`;
    // Default: big goofy grin + side tongue.
    default:          return `<path d="M38 72 Q50 82 62 72" ${stroke}/>${tongue}`;
  }
}
function extras(mood) {
  switch (mood) {
    case "sleepy":    return `<text x="70" y="30" font-size="13" fill="#3c6626" font-family="Nunito Sans, sans-serif" font-weight="900">z</text><text x="78" y="22" font-size="9" fill="#3c6626" font-family="Nunito Sans, sans-serif" font-weight="900">z</text>`;
    case "panic":     return `<path d="M78 34 q3.5 6 0 10 q-3.5 -4 0 -10 Z" fill="#7ec8e3" stroke="#28180b" stroke-width="1"/>`;
    case "sad":       return `<path d="M34 62 q2 5 0 8 q-2 -3 0 -8 Z" fill="#7ec8e3"/>`;
    case "dead":      return `<path d="M31 63 Q37 66 43 63" fill="none" stroke="#8a6b57" stroke-width="1.5"/><path d="M57 63 Q63 66 69 63" fill="none" stroke="#8a6b57" stroke-width="1.5"/>`;
    case "ecstatic":  return star(84, 28) + star(15, 66) + star(80, 74);
    case "love":      return heartMini(80, 26) + heartMini(18, 30);
    default:          return "";
  }
}
function star(x, y) {
  return `<path d="M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z" fill="#ffd166" stroke="#28180b" stroke-width="0.6"/>`;
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
      return `<circle cx="62" cy="55" r="13" fill="none" stroke="#ffd166" stroke-width="2.5"/><path d="M62 68 Q59 80 53 86" fill="none" stroke="#28180b" stroke-width="1.5"/>`;
    case "mustache":
      return `<path d="M50 70 Q42 68 38 72 Q43 74 50 71 Q57 74 62 72 Q58 68 50 70 Z" fill="#4a3420" stroke="#28180b" stroke-width="1"/>`;
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
        <div class="w-11 h-11 rounded-full chunky-border overflow-hidden bg-primary-fixed flex items-center justify-center -rotate-3">
          ${pocoSvg(46, { alive: true })}
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
      <div class="w-12 h-12 rounded-full chunky-border overflow-hidden bg-primary-fixed flex items-center justify-center -rotate-3">${pocoSvg(50, { alive: true })}</div>
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
      <main class="max-w-xl mx-auto px-container-padding pt-6 pb-32 flex flex-col gap-gutter view-enter">
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
  if (onMount) onMount(root);
}
function escClose(e) {
  if (e.key === "Escape") closeModal();
}
export function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
  document.removeEventListener("keydown", escClose);
}

export function pct(n, d) {
  if (!d) return 0;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}
