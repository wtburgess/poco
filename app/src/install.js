// "Add Poco to your home screen" nudge — a real installable PWA icon, not a
// browser shortcut. On Android/Chrome we capture the native beforeinstallprompt and
// drive it from our own bottom sheet; on iOS Safari (no such event) we show the
// manual Add-to-Home-Screen steps. Respects "Not now" and never nags once installed.
import { icon, pocoImg } from "./ui.js";

const KEY = "poco.install.v1";
const SNOOZE_DAYS = 7;
let deferred = null; // the captured beforeinstallprompt event (Android/Chrome)

function readState() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_e) { return {}; }
}
function remember(patch) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readState(), ...patch })); } catch (_e) {}
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function isIOS() {
  const ua = navigator.userAgent || "";
  const iDevice = /iphone|ipad|ipod/i.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return (iDevice || iPadOS) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}
function snoozed() {
  const s = readState();
  if (s.installed) return true;
  if (!s.dismissedAt) return false;
  return (Date.now() - s.dismissedAt) / 86400000 < SNOOZE_DAYS;
}

export function initInstall() {
  if (isStandalone()) { remember({ installed: true }); return; } // already a home-screen app
  if (snoozed()) return;

  if (isIOS()) {
    // No programmatic prompt on iOS — surface the manual steps after a short beat.
    setTimeout(() => showSheet(true), 1600);
    return;
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    showSheet(false);
  });
  window.addEventListener("appinstalled", () => { remember({ installed: true }); hideSheet(); });
}

function root() {
  let el = document.getElementById("install-root");
  if (!el) { el = document.createElement("div"); el.id = "install-root"; document.body.appendChild(el); }
  return el;
}

function showSheet(ios) {
  const r = root();
  r.innerHTML = `
    <div class="install-backdrop" data-install-backdrop>
      <div class="install-sheet" role="dialog" aria-label="Install Poco">
        <div class="install-grip"></div>
        <div class="flex items-start gap-4">
          <div class="w-16 h-16 rounded-2xl chunky-border overflow-hidden bg-primary-fixed flex items-center justify-center shrink-0">${pocoImg(60)}</div>
          <div class="flex-1">
            <h3 class="font-headline-md text-headline-md text-on-surface leading-tight mb-1">Put Poco on your home screen</h3>
            <p class="font-body-md text-body-md text-on-surface-variant">Opens like a real app — no browser tabs, no app store. Just me, living on your phone. Horizontally.</p>
          </div>
        </div>
        ${ios ? `
          <div class="mt-4 bg-surface-container rounded-2xl chunky-border p-3 font-body-md text-body-md text-on-surface flex items-center gap-1 flex-wrap">
            Tap ${icon("ios_share", "text-primary")} then <b>Add to Home Screen</b>.
          </div>
          <button data-install-close class="chunky-button w-full mt-4 py-3 rounded-full chunky-border card-shadow bg-primary text-on-primary font-label-bold text-label-bold">Got it 🌿</button>
        ` : `
          <div class="flex gap-3 mt-5">
            <button data-install-dismiss class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container text-on-surface font-label-bold text-label-bold">Not now</button>
            <button data-install-go class="chunky-button flex-1 py-3 rounded-full chunky-border card-shadow bg-primary text-on-primary font-label-bold text-label-bold flex items-center justify-center gap-1">${icon("install_mobile", "text-sm")} Install</button>
          </div>
        `}
      </div>
    </div>`;

  const bd = r.querySelector("[data-install-backdrop]");
  bd.addEventListener("click", (e) => { if (e.target === bd) snoozeAndHide(); });
  r.querySelector("[data-install-dismiss]")?.addEventListener("click", snoozeAndHide);
  r.querySelector("[data-install-close]")?.addEventListener("click", snoozeAndHide);
  r.querySelector("[data-install-go]")?.addEventListener("click", async () => {
    if (!deferred) { snoozeAndHide(); return; }
    hideSheet();
    deferred.prompt();
    try { await deferred.userChoice; } catch (_e) {}
    remember({ dismissedAt: Date.now() }); // installed → appinstalled marks it; else snooze
    deferred = null;
  });
}

function snoozeAndHide() {
  remember({ dismissedAt: Date.now() });
  hideSheet();
}
function hideSheet() {
  const el = document.getElementById("install-root");
  if (el) el.innerHTML = "";
}

// Test-only hook so the sheet can be previewed without the native event firing.
if (typeof window !== "undefined") window.__pocoInstallPreview = (ios = false) => showSheet(ios);
