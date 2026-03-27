import type { WorkbenchState, WorkbenchAPI } from "./WorkbenchAPI";
import { registry } from "./models/registry";
import { computeHumanoidSkeleton } from "./models/skeleton";
import type { Direction } from "./models/types";

const CATEGORY_ORDER = ["body", "hair", "headgear", "shoulders", "armor", "gauntlets", "legs", "feet", "weapon", "offhand", "npc", "construction"];
const CATEGORY_LABELS: Record<string, string> = {
  body: "Bodies",
  hair: "Hair",
  headgear: "Headgear",
  shoulders: "Shoulders",
  armor: "Armor",
  gauntlets: "Gauntlets",
  legs: "Leg Armor",
  feet: "Boots",
  weapon: "Weapons",
  offhand: "Off-hand",
  npc: "NPCs",
  construction: "Construction",
};

/** Remove attachments for slots that the given base model does not expose. */
function filterAttachmentsForBase(state: WorkbenchState, baseModelId: string): void {
  const model = registry.get(baseModelId);
  if (!model) return;
  const skeleton = computeHumanoidSkeleton(0 as Direction, 0);
  const available = new Set(Object.keys(model.getAttachmentPoints(skeleton)));
  state.compositeConfig.attachments = state.compositeConfig.attachments.filter(
    a => available.has(a.slot)
  );
}

/**
 * Left nav panel — model browser grouped by category.
 * Clicking a model switches the preview to that model.
 */
export function createModelNav(
  container: HTMLElement,
  state: WorkbenchState,
  api: WorkbenchAPI,
  onSelect: () => void
): { refresh: () => void } {
  const buttons = new Map<string, HTMLButtonElement>();

  function build() {
    container.innerHTML = "";

    const title = document.createElement("div");
    title.style.cssText = "font-size:14px;font-weight:700;color:#53a8b6;margin-bottom:10px;";
    const totalCount = registry.list().length;
    title.innerHTML = `MODELS <span style="font-size:10px;font-weight:400;color:#666;">${totalCount}</span>`;
    container.appendChild(title);

    for (const cat of CATEGORY_ORDER) {
      const models = registry.list(cat as any);
      if (models.length === 0) continue;

      const h3 = document.createElement("h3");
      h3.textContent = CATEGORY_LABELS[cat] ?? cat;
      container.appendChild(h3);

      for (const model of models) {
        const btn = document.createElement("button");
        btn.className = "model-btn";
        btn.textContent = model.name;
        btn.dataset.modelId = model.id;

        // Body/NPC root models use composite view so equipment slots are shown.
        // Construction items are root but have no slots — always individual view.
        const isRootModel = model.slot === "root" && model.category !== "construction";

        const isActive =
          (state.viewMode === "individual" && state.selectedModelId === model.id) ||
          (state.viewMode === "composite" && isRootModel && model.id === state.compositeConfig.baseModelId);

        if (isActive) btn.classList.add("active");

        btn.addEventListener("click", () => {
          if (isRootModel) {
            // Root models (bodies + NPCs) show composite view so slots are visible.
            // When switching body, drop attachments for slots the new body doesn't have.
            if (state.compositeConfig.baseModelId !== model.id) {
              state.compositeConfig.baseModelId = model.id;
              filterAttachmentsForBase(state, model.id);
            }
            api.setView("composite");
          } else {
            api.setView("individual", model.id);
          }
          // Sync model ID to URL so it can be bookmarked / linked
          const url = new URL(window.location.href);
          url.searchParams.set("model", model.id);
          history.replaceState(null, "", url.toString());
          refresh();
          onSelect();
        });

        buttons.set(model.id, btn);
        container.appendChild(btn);
      }
    }
  }

  function refresh() {
    for (const [id, btn] of buttons) {
      const isActive =
        (state.viewMode === "individual" && state.selectedModelId === id) ||
        (state.viewMode === "composite" && id === state.compositeConfig.baseModelId);
      btn.classList.toggle("active", isActive);
    }
  }

  build();
  return { refresh };
}
