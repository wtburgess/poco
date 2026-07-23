// Passwordless magic-link login screen (shown when Supabase is configured
// and there's no active session).
import { pocoImg, icon, toast } from "../ui.js";
import { signInWithEmail } from "../supabase.js";

export function renderLogin(root) {
  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="w-full max-w-sm bg-surface-container-lowest chunky-border card-shadow rounded-[28px] p-8 text-center">
        <div class="flex justify-center mb-4">
          <div class="w-28 h-28 rounded-full chunky-border bg-primary-fixed flex items-center justify-center overflow-hidden">${pocoImg(110)}</div>
        </div>
        <h1 class="font-display-sm text-display-sm text-primary mb-1">Poco</h1>
        <p class="font-body-md text-body-md text-on-surface-variant mb-6">Slow &amp; steady. Sign in to track your days.</p>
        <div data-form>
          <input data-email type="email" inputmode="email" autocomplete="email" placeholder="you@email.com"
            class="w-full mb-3 px-4 py-3 rounded-[16px] chunky-border bg-[#F2EBD4] font-body-md text-on-surface text-center focus:outline-none focus:ring-2 focus:ring-primary" />
          <button data-send class="chunky-button w-full py-3.5 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow flex items-center justify-center gap-2">
            ${icon("auto_awesome", "text-sm")} Send me a magic link
          </button>
          <p class="text-xs text-on-surface-variant mt-3">No password — we'll email you a link to tap.</p>
        </div>
      </div>
    </div>`;

  const emailEl = root.querySelector("[data-email]");
  const sendBtn = root.querySelector("[data-send]");
  emailEl.focus();

  const send = async () => {
    const email = emailEl.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast("Enter a valid email", "mail");
      emailEl.focus();
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    try {
      const { error } = await signInWithEmail(email);
      if (error) throw error;
      root.querySelector("[data-form]").innerHTML = `
        <div class="flex flex-col items-center gap-2 py-2">
          <div class="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center chunky-border">${icon("mark_email_read", "text-on-primary-container fill-icon")}</div>
          <p class="font-label-bold text-label-bold text-on-surface">Check your email</p>
          <p class="text-sm text-on-surface-variant">We sent a magic link to <span class="font-label-bold">${email}</span>. Tap it on this device to sign in.</p>
        </div>`;
    } catch (e) {
      toast(e.message || "Couldn't send link", "error");
      sendBtn.disabled = false;
      sendBtn.innerHTML = `${icon("auto_awesome", "text-sm")} Send me a magic link`;
    }
  };

  sendBtn.addEventListener("click", send);
  emailEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });
}
