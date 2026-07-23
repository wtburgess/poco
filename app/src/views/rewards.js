// Poco's Closet — where leaves finally get spent.
import {
  getState, unlockCosmetic, equipCosmetic, isUnlocked, getEquipped,
} from "../store.js";
import { COSMETICS } from "../poco.js";
import { icon, pocoSvg, openModal, closeModal, toast, celebrate } from "../ui.js";

export function openCloset(afterChange) {
  render(afterChange);
}

function render(afterChange) {
  const { points } = getState();
  const equipped = getEquipped();

  const grid = COSMETICS.map((c) => card(c, points)).join("");

  openModal(
    `
    <div class="flex items-center justify-between mb-1">
      <h3 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2">${icon("checkroom", "text-primary fill-icon")} Poco's Closet</h3>
      <div class="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full chunky-border bg-tertiary-fixed">
        ${icon("energy_savings_leaf", "text-primary fill-icon")}
        <span class="font-label-bold text-label-bold text-on-tertiary-fixed">${points}</span>
      </div>
    </div>
    <p class="font-body-md text-sm text-on-surface-variant mb-4">Spend your leaves dressing up a sloth. This is what it was all for.</p>

    <div class="flex items-center gap-4 mb-4 bg-surface-container-low rounded-2xl chunky-border p-3">
      <div class="w-20 h-20 rounded-full chunky-border bg-secondary-container flex items-center justify-center flex-shrink-0 overflow-hidden">
        ${pocoSvg(74, { mood: "ecstatic", accessory: equipped })}
      </div>
      <div class="flex-1">
        <p class="font-label-bold text-label-bold text-on-surface">${equipped ? "Looking fabulous." : "Naked sloth. Bold choice."}</p>
        <p class="text-xs text-on-surface-variant">${equipped ? "Tap “Wearing” to strip back down." : "Unlock something below."}</p>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 max-h-[46vh] overflow-y-auto no-scrollbar pr-0.5" data-grid>
      ${grid}
    </div>

    <button data-close class="chunky-button mt-4 w-full py-3 rounded-full chunky-border bg-surface-container font-label-bold text-label-bold text-on-surface">Done</button>
  `,
    {
      onMount: (mroot) => {
        mroot.querySelector("[data-close]").addEventListener("click", closeModal);

        mroot.querySelectorAll("[data-buy]").forEach((b) =>
          b.addEventListener("click", () => {
            const id = b.dataset.buy;
            const cost = +b.dataset.cost;
            const c = COSMETICS.find((x) => x.id === id);
            if (unlockCosmetic(id, cost)) {
              celebrate();
              toast(`Unlocked ${c.name}! Looking good 🌿`, "checkroom");
              afterChange?.();
              render(afterChange);
            } else {
              const need = cost - getState().points;
              toast(`${need} more leaves for that one 🍃`, "energy_savings_leaf");
            }
          })
        );

        mroot.querySelectorAll("[data-equip]").forEach((b) =>
          b.addEventListener("click", () => {
            const id = b.dataset.equip || null;
            equipCosmetic(id);
            afterChange?.();
            render(afterChange);
          })
        );
      },
    }
  );
}

function card(c, points) {
  const owned = isUnlocked(c.id);
  const equipped = getEquipped() === c.id;
  const afford = points >= c.cost;

  let action;
  if (equipped) {
    action = `<button data-equip="" class="chunky-button w-full py-2 rounded-full chunky-border bg-primary text-on-primary font-label-bold text-xs flex items-center justify-center gap-1">${icon("check", "text-sm")} Wearing</button>`;
  } else if (owned) {
    action = `<button data-equip="${c.id}" class="chunky-button w-full py-2 rounded-full chunky-border bg-secondary-container text-on-secondary-fixed font-label-bold text-xs">Wear it</button>`;
  } else if (afford) {
    action = `<button data-buy="${c.id}" data-cost="${c.cost}" class="chunky-button w-full py-2 rounded-full chunky-border bg-tertiary-fixed text-on-tertiary-fixed font-label-bold text-xs flex items-center justify-center gap-1">${icon("energy_savings_leaf", "text-sm text-primary fill-icon")} ${c.cost}</button>`;
  } else {
    action = `<button disabled class="w-full py-2 rounded-full chunky-border border-dashed bg-surface-container/50 text-on-surface-variant font-label-bold text-xs flex items-center justify-center gap-1 opacity-70">${icon("lock", "text-sm")} ${c.cost}</button>`;
  }

  return `<div class="flex flex-col items-center gap-1.5 p-3 rounded-2xl chunky-border ${equipped ? "bg-primary-container/40" : "bg-surface-container-lowest"} card-shadow">
    <div class="w-16 h-16 rounded-full chunky-border bg-secondary-container flex items-center justify-center overflow-hidden ${owned ? "" : "opacity-90"}">
      ${pocoSvg(58, { mood: "happy", accessory: c.id })}
    </div>
    <p class="font-label-bold text-label-bold text-on-surface leading-tight text-center">${c.name}</p>
    <p class="text-[11px] text-on-surface-variant text-center leading-tight mb-1 min-h-[28px]">${c.blurb}</p>
    ${action}
  </div>`;
}
