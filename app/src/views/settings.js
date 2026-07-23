// Settings & account view — editable goals, toggles, reset.
import {
  getState, updateGoals, updateSettings, updateProfile, resetAll,
} from "../store.js";
import { icon, pocoImg, shell, toast, openModal, closeModal } from "../ui.js";
import {
  notifySupported, permission, requestPermission, fireNudge,
} from "../notify.js";
import { enableReminders, disableReminders, updateReminderTime } from "../webpush.js";
import { isCloud, signOut } from "../supabase.js";

export function renderSettings(root) {
  const { profile, goals, settings, points } = getState();

  const body = `
    <!-- Profile -->
    <section class="bg-surface-container-lowest wobbly-border chunky-border card-shadow p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 relative overflow-hidden">
      <div class="absolute -top-2 -right-2 text-primary opacity-20 rotate-12">
        <span class="material-symbols-outlined text-6xl fill-icon">eco</span>
      </div>
      <div class="relative">
        <div class="w-24 h-24 rounded-full chunky-border bg-secondary-container flex items-center justify-center overflow-hidden shadow-[0px_4px_0px_0px_rgba(40,24,11,0.15)]">${pocoImg(88)}</div>
        <button data-edit-name class="chunky-button absolute -bottom-2 -right-2 bg-secondary-container rounded-full w-8 h-8 flex items-center justify-center chunky-border">${icon("edit", "text-on-secondary-fixed text-sm")}</button>
      </div>
      <div class="flex-1 text-center sm:text-left">
        <h2 class="font-headline-md text-headline-md text-on-surface mb-1">${profile.name}</h2>
        <div class="inline-flex items-center gap-2 bg-surface-container px-3 py-1 rounded-full chunky-border">
          ${icon("star", "text-primary text-sm fill-icon")}
          <span class="font-label-bold text-label-bold text-on-surface-variant">Level ${profile.level} Sloth · ${points} 🌿</span>
        </div>
        <p class="font-body-md text-body-md text-on-surface-variant mt-2 flex items-center justify-center sm:justify-start gap-1">
          ${icon("nature", "text-sm")} Current Habitat: ${profile.treeHeight}ft Tree Height
        </p>
      </div>
    </section>

    <!-- Goals -->
    <section class="flex flex-col gap-unit">
      <h3 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2 ml-2">${icon("flag", "text-primary fill-icon")} Daily Goals</h3>
      <div class="bg-surface-container-lowest wobbly-border chunky-border card-shadow p-2">
        ${goalRow("calories", "Calorie Target", `${goals.calories.toLocaleString()} kcal`, "local_fire_department", "error", "error-container", true)}
        ${goalRow("steps", "Daily Steps", `${goals.steps.toLocaleString()} steps`, "directions_walk", "secondary", "secondary-container", true)}
        ${goalRow("sleepHours", "Sleep Duration", `${goals.sleepHours} hours`, "bedtime", "inverse-surface", "surface-dim", false)}
      </div>
    </section>

    <!-- Connected apps -->
    <section class="flex flex-col gap-unit">
      <h3 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2 ml-2 mt-2">${icon("apps", "text-secondary fill-icon")} Connected Apps</h3>
      <div class="bg-surface-container-lowest wobbly-border chunky-border card-shadow p-2">
        ${toggleRow("healthSync", "Health Sync", "monitor_heart", settings.healthSync, true)}
        ${toggleRow("nutritionTracker", "Nutrition Tracker", "restaurant_menu", settings.nutritionTracker, false)}
      </div>
    </section>

    <!-- Daily nudge -->
    <section class="flex flex-col gap-unit">
      <h3 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2 ml-2 mt-2">${icon("notifications_active", "text-tertiary-container fill-icon")} Daily Nudge</h3>
      <div class="bg-surface-container-lowest wobbly-border chunky-border card-shadow p-2">
        <div class="flex items-center justify-between p-4 border-b border-outline-variant/50 border-dashed">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center chunky-border">${icon("alarm", "text-on-surface fill-icon")}</div>
            <div>
              <p class="font-label-bold text-label-bold text-on-surface">Morning check-in reminder</p>
              <p class="text-xs text-on-surface-variant" data-nudge-status>${nudgeStatus(settings)}</p>
            </div>
          </div>
          <div class="relative inline-block w-12 mr-2 align-middle select-none">
            <input data-reminder-toggle ${settings.reminderEnabled ? "checked" : ""} class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white chunky-border appearance-none cursor-pointer z-10 top-0.5 left-0.5 transition-all duration-200" id="tg-reminder" type="checkbox">
            <label class="toggle-label block overflow-hidden h-7 rounded-full ${settings.reminderEnabled ? "bg-primary" : "bg-surface-dim"} chunky-border cursor-pointer transition-colors duration-200" for="tg-reminder"></label>
          </div>
        </div>
        <div class="flex items-center justify-between p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center chunky-border">${icon("schedule", "text-on-surface fill-icon")}</div>
            <p class="font-label-bold text-label-bold text-on-surface">Nudge me at</p>
          </div>
          <div class="flex items-center gap-2">
            <input data-reminder-time type="time" value="${settings.reminderTime}" class="px-3 py-2 rounded-lg chunky-border bg-[#F2EBD4] font-label-bold text-label-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
            <button data-test-nudge class="chunky-button px-3 py-2 rounded-lg chunky-border bg-surface-container font-label-bold text-xs text-on-surface">Test</button>
          </div>
        </div>
        <p class="px-4 pb-3 text-xs text-on-surface-variant flex items-center gap-1">${icon("info", "text-sm")} Poco can only nudge while the app is open in a browser tab.</p>
      </div>
    </section>

    <!-- Actions -->
    <section class="flex flex-col gap-4 mt-2">
      <button data-save-prefs class="tactile-button chunky-button bg-primary text-on-primary font-label-bold text-label-bold py-3 px-6 rounded-full w-full flex items-center justify-center gap-2">${icon("save")} Save Preferences</button>
      ${isCloud() ? `<button data-signout class="tactile-button chunky-button bg-surface-container-lowest text-on-surface font-label-bold text-label-bold py-3 px-6 rounded-full w-full flex items-center justify-center gap-2">${icon("logout")} Sign out</button>` : ""}
      <button data-reset class="tactile-button chunky-button bg-surface-container-lowest text-error font-label-bold text-label-bold py-3 px-6 rounded-full w-full flex items-center justify-center gap-2">${icon("restart_alt")} Reset all data</button>
    </section>
  `;

  root.innerHTML = shell("settings", body);
  wire(root);
}

function goalRow(key, label, valueText, ic, iconColor, bg, border) {
  return `<button data-goal="${key}" class="w-full flex items-center justify-between p-4 text-left ${border ? "border-b border-outline-variant/50 border-dashed" : ""} hover:bg-surface-container/40 transition-colors rounded-lg">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-${bg} flex items-center justify-center chunky-border">${icon(ic, `text-${iconColor} fill-icon`)}</div>
      <div>
        <p class="font-label-bold text-label-bold text-on-surface">${label}</p>
        <p class="font-body-md text-sm text-on-surface-variant" data-goal-value="${key}">Target: ${valueText}</p>
      </div>
    </div>
    ${icon("chevron_right", "text-on-surface-variant")}
  </button>`;
}

function toggleRow(key, label, ic, checked, border) {
  return `<div class="flex items-center justify-between p-4 ${border ? "border-b border-outline-variant/50 border-dashed" : ""}">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center chunky-border">${icon(ic, "text-on-surface fill-icon")}</div>
      <p class="font-label-bold text-label-bold text-on-surface">${label}</p>
    </div>
    <div class="relative inline-block w-12 mr-2 align-middle select-none">
      <input data-toggle-setting="${key}" ${checked ? "checked" : ""} class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white chunky-border appearance-none cursor-pointer z-10 top-0.5 left-0.5 transition-all duration-200" id="tg-${key}" type="checkbox">
      <label class="toggle-label block overflow-hidden h-7 rounded-full ${checked ? "bg-primary" : "bg-surface-dim"} chunky-border cursor-pointer transition-colors duration-200" for="tg-${key}"></label>
    </div>
  </div>`;
}

function nudgeStatus(settings) {
  if (!notifySupported()) return "This browser can't show notifications.";
  if (permission() === "denied") return "Blocked in your browser settings.";
  if (settings.reminderEnabled) return `On · daily around ${settings.reminderTime}`;
  return "Off";
}

const GOAL_META = {
  calories: { label: "Calorie Target", unit: "kcal", step: 50, min: 1000, max: 5000 },
  steps: { label: "Daily Steps", unit: "steps", step: 500, min: 1000, max: 30000 },
  sleepHours: { label: "Sleep Duration", unit: "hours", step: 0.5, min: 4, max: 12 },
};

function wire(root) {
  // Toggles
  root.querySelectorAll("[data-toggle-setting]").forEach((cb) =>
    cb.addEventListener("change", () => {
      updateSettings({ [cb.dataset.toggleSetting]: cb.checked });
      const label = cb.nextElementSibling;
      label.className = `toggle-label block overflow-hidden h-7 rounded-full ${cb.checked ? "bg-primary" : "bg-surface-dim"} chunky-border cursor-pointer transition-colors duration-200`;
    })
  );

  // Edit goals
  root.querySelectorAll("[data-goal]").forEach((b) =>
    b.addEventListener("click", () => goalModal(b.dataset.goal, () => renderSettings(root)))
  );

  // Edit name
  root.querySelector("[data-edit-name]").addEventListener("click", () => nameModal(() => renderSettings(root)));

  // Daily nudge controls
  const rt = root.querySelector("[data-reminder-toggle]");
  if (rt) {
    rt.addEventListener("change", async () => {
      const time = getState().settings.reminderTime || "08:00";
      if (rt.checked) {
        try {
          const mode = await enableReminders(time);
          toast(
            mode === "push" ? "Background nudges on 🌿" : "Nudges on (while app's open) 🌿",
            "notifications_active"
          );
        } catch (_e) {
          toast("Allow notifications to enable nudges", "notifications_off");
        }
      } else {
        await disableReminders();
        toast("Nudges off", "notifications_off");
      }
      renderSettings(root);
    });
  }
  root.querySelector("[data-reminder-time]")?.addEventListener("change", async (e) => {
    await updateReminderTime(e.target.value);
    toast(`Nudge set for ${e.target.value}`, "schedule");
    renderSettings(root);
  });
  root.querySelector("[data-test-nudge]")?.addEventListener("click", async () => {
    const p = await requestPermission();
    if (p !== "granted") {
      toast("Allow notifications first", "notifications_off");
      renderSettings(root);
      return;
    }
    fireNudge(true);
    toast("Sent a test nudge 🦥", "notifications_active");
  });

  root.querySelector("[data-save-prefs]").addEventListener("click", () => toast("Preferences saved", "check_circle"));

  root.querySelector("[data-signout]")?.addEventListener("click", async () => {
    await signOut();
    location.reload();
  });

  root.querySelector("[data-reset]").addEventListener("click", () => {
    if (confirm("Reset all data and start fresh? This clears your check-ins, meals, and habits.")) {
      resetAll();
      renderSettings(root);
      toast("Fresh start 🌱", "restart_alt");
    }
  });
}

function goalModal(key, onDone) {
  const meta = GOAL_META[key];
  const cur = getState().goals[key];
  openModal(
    `
    <h3 class="font-headline-md text-headline-md text-on-surface mb-1">${meta.label}</h3>
    <p class="font-body-md text-sm text-on-surface-variant mb-4">Set your daily target (${meta.unit}).</p>
    <div class="flex items-center justify-center gap-4 mb-6">
      <button data-step="-1" class="chunky-button w-12 h-12 rounded-full chunky-border bg-surface-container flex items-center justify-center card-shadow">${icon("remove")}</button>
      <div class="text-center min-w-[120px]">
        <span class="font-display-sm text-display-sm text-primary" data-value>${cur.toLocaleString()}</span>
        <span class="block font-label-bold text-label-bold text-on-surface-variant">${meta.unit}</span>
      </div>
      <button data-step="1" class="chunky-button w-12 h-12 rounded-full chunky-border bg-surface-container flex items-center justify-center card-shadow">${icon("add")}</button>
    </div>
    <div class="flex gap-3">
      <button data-cancel class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Cancel</button>
      <button data-save class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow">Save</button>
    </div>
  `,
    {
      onMount: (mroot) => {
        let val = cur;
        const valEl = mroot.querySelector("[data-value]");
        mroot.querySelectorAll("[data-step]").forEach((b) =>
          b.addEventListener("click", () => {
            val = +(val + parseInt(b.dataset.step, 10) * meta.step).toFixed(1);
            val = Math.max(meta.min, Math.min(meta.max, val));
            valEl.textContent = val.toLocaleString();
          })
        );
        mroot.querySelector("[data-cancel]").addEventListener("click", closeModal);
        mroot.querySelector("[data-save]").addEventListener("click", () => {
          updateGoals({ [key]: val });
          closeModal();
          toast("Goal updated", "flag");
          if (onDone) onDone();
        });
      },
    }
  );
}

function nameModal(onDone) {
  const cur = getState().profile.name;
  openModal(
    `
    <h3 class="font-headline-md text-headline-md text-on-surface mb-4">Your name</h3>
    <input data-field="name" type="text" value="${cur.replace(/"/g, "&quot;")}" class="w-full mb-6 px-4 py-3 rounded-lg chunky-border bg-[#F2EBD4] font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary" />
    <div class="flex gap-3">
      <button data-cancel class="chunky-button flex-1 py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Cancel</button>
      <button data-save class="chunky-button flex-1 py-3 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-label-bold card-shadow">Save</button>
    </div>
  `,
    {
      onMount: (mroot) => {
        const input = mroot.querySelector("[data-field='name']");
        input.focus();
        input.select();
        mroot.querySelector("[data-cancel]").addEventListener("click", closeModal);
        mroot.querySelector("[data-save]").addEventListener("click", () => {
          const name = input.value.trim();
          if (!name) return;
          updateProfile({ name });
          closeModal();
          toast("Saved", "check_circle");
          if (onDone) onDone();
        });
      },
    }
  );
}
