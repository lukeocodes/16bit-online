import type { WorkbenchState, WorkbenchAPI } from "./WorkbenchAPI";
import { registry } from "./models/registry";

const CATEGORY_ORDER = ["body", "hair", "headgear", "armor", "legs", "feet", "weapon", "offhand", "npc"];
const CATEGORY_LABELS: Record<string, string> = {
  body: "Bodies",
  hair: "Hair",
  headgear: "Headgear",
  armor: "Armor",
  legs: "Leg Armor",
  feet: "Boots",
  weapon: "Weapons",
  offhand: "Off-hand",
  npc: "NPCs",
};

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
    title.textContent = "MODELS";
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

        const isActive =
          (state.viewMode === "individual" && state.selectedModelId === model.id) ||
          (state.viewMode === "composite" && model.category === "body" && model.id === state.compositeConfig.baseModelId);

        if (isActive) btn.classList.add("active");

        btn.addEventListener("click", () => {
          if (model.category === "body") {
            // Body models show composite view (body + all equipped slots)
            api.setView("composite");
            state.compositeConfig.baseModelId = model.id;
          } else {
            api.setView("individual", model.id);
          }
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
