import type { WorkbenchState, WorkbenchAPI } from "./WorkbenchAPI";
import { registry } from "./models/registry";
import { computeHumanoidSkeleton } from "./models/skeleton";
import type { Direction } from "./models/types";

const CATEGORY_ORDER = [
  "body", "npc", "hair", "headgear", "shoulders", "armor",
  "gauntlets", "legs", "feet", "weapon", "offhand", "construction",
];

const CATEGORY_LABELS: Record<string, string> = {
  body: "Bodies",
  hair: "Hair",
  headgear: "Headgear",
  shoulders: "Shoulders",
  armor: "Armor",
  gauntlets: "Gauntlets",
  legs: "Legs",
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
 * Left nav panel — model browser grouped by category with search + filter chips.
 */
export function createModelNav(
  container: HTMLElement,
  state: WorkbenchState,
  api: WorkbenchAPI,
  onSelect: () => void
): { refresh: () => void } {
  const navSearch = document.getElementById("nav-search") as HTMLInputElement;
  const navFilters = document.getElementById("nav-filters") as HTMLElement;
  const navList = document.getElementById("nav-list") as HTMLElement;
  const navCount = document.getElementById("nav-count") as HTMLElement;

  let activeFilter: string | null = null;
  let searchQuery = "";
  const buttonMap = new Map<string, HTMLButtonElement>();

  // Build filter chips
  function buildFilters() {
    navFilters.innerHTML = "";
    const allChip = document.createElement("button");
    allChip.className = "filter-chip" + (activeFilter === null ? " active" : "");
    allChip.textContent = "All";
    allChip.addEventListener("click", () => { activeFilter = null; buildList(); updateFilterChips(); });
    navFilters.appendChild(allChip);

    for (const cat of CATEGORY_ORDER) {
      const models = registry.list(cat as any);
      if (models.length === 0) continue;
      const chip = document.createElement("button");
      chip.className = "filter-chip" + (activeFilter === cat ? " active" : "");
      chip.textContent = CATEGORY_LABELS[cat] ?? cat;
      chip.addEventListener("click", () => { activeFilter = cat; buildList(); updateFilterChips(); });
      navFilters.appendChild(chip);
    }
    // DB saved chip
    if (state.savedModels.length > 0) {
      const chip = document.createElement("button");
      chip.className = "filter-chip" + (activeFilter === "saved" ? " active" : "");
      chip.textContent = `Saved (${state.savedModels.length})`;
      chip.style.borderColor = "var(--warn)";
      chip.style.color = "var(--warn)";
      chip.addEventListener("click", () => { activeFilter = "saved"; buildList(); updateFilterChips(); });
      navFilters.appendChild(chip);
    }
  }

  function updateFilterChips() {
    const chips = navFilters.querySelectorAll<HTMLButtonElement>(".filter-chip");
    chips.forEach(chip => {
      const label = chip.textContent?.split(" (")[0] ?? "";
      const isAll = label === "All";
      const isSaved = label === "Saved";
      chip.classList.toggle("active",
        (isAll && activeFilter === null) ||
        (!isAll && !isSaved && CATEGORY_LABELS[activeFilter ?? ""] === label) ||
        (isSaved && activeFilter === "saved")
      );
    });
  }

  function buildList() {
    navList.innerHTML = "";
    buttonMap.clear();
    let count = 0;

    const query = searchQuery.toLowerCase().trim();

    // DB saved models section (show at top when filter=saved or when searching with results)
    if (state.serverOnline && (activeFilter === null || activeFilter === "saved")) {
      const matchingSaved = state.savedModels.filter(m => {
        if (query && !m.name.toLowerCase().includes(query)) return false;
        return true;
      });
      if (matchingSaved.length > 0) {
        const sectionLabel = document.createElement("div");
        sectionLabel.className = "nav-section-label db-section";
        sectionLabel.textContent = "Saved (DB)";
        navList.appendChild(sectionLabel);
        for (const saved of matchingSaved) {
          count++;
          const btn = document.createElement("button");
          btn.className = "model-btn db-model";
          const nameSpan = document.createElement("span");
          nameSpan.style.flex = "1";
          nameSpan.textContent = saved.name;
          const badge = document.createElement("span");
          badge.className = "model-badge";
          badge.textContent = saved.isNpc ? "NPC" : "PC";
          btn.appendChild(nameSpan);
          btn.appendChild(badge);
          btn.addEventListener("click", () => {
            api.loadSavedModel(saved.id);
            refresh();
            onSelect();
          });
          navList.appendChild(btn);
        }
      }
    }

    if (activeFilter === "saved") {
      navCount.textContent = `${count}`;
      return;
    }

    // Base models section
    for (const cat of CATEGORY_ORDER) {
      if (activeFilter !== null && activeFilter !== cat) continue;
      const models = registry.list(cat as any).filter(m => {
        if (!query) return true;
        return m.name.toLowerCase().includes(query) || m.id.includes(query);
      });
      if (models.length === 0) continue;

      const sectionLabel = document.createElement("div");
      sectionLabel.className = "nav-section-label";
      sectionLabel.textContent = CATEGORY_LABELS[cat] ?? cat;
      navList.appendChild(sectionLabel);

      for (const model of models) {
        count++;
        const isRootModel = model.slot === "root" && model.category !== "construction";
        const isActive =
          (state.viewMode === "individual" && state.selectedModelId === model.id) ||
          (state.viewMode === "composite" && isRootModel && model.id === state.compositeConfig.baseModelId);

        const btn = document.createElement("button");
        btn.className = "model-btn" + (isActive ? " active" : "");
        btn.dataset.modelId = model.id;

        const nameSpan = document.createElement("span");
        nameSpan.style.flex = "1";
        nameSpan.textContent = model.name;

        const badge = document.createElement("span");
        badge.className = "model-badge";
        badge.textContent = model.slot === "root" ? "body" : model.slot;
        btn.appendChild(nameSpan);
        btn.appendChild(badge);

        btn.addEventListener("click", () => {
          if (isRootModel) {
            if (state.compositeConfig.baseModelId !== model.id) {
              state.compositeConfig.baseModelId = model.id;
              filterAttachmentsForBase(state, model.id);
            }
            api.setView("composite");
          } else {
            api.setView("individual", model.id);
          }
          const url = new URL(window.location.href);
          url.searchParams.set("model", model.id);
          history.replaceState(null, "", url.toString());
          refresh();
          onSelect();
        });

        buttonMap.set(model.id, btn);
        navList.appendChild(btn);
      }
    }

    navCount.textContent = `${count}`;
  }

  function refresh() {
    // Update active states without full rebuild
    for (const [id, btn] of buttonMap) {
      const isActive =
        (state.viewMode === "individual" && state.selectedModelId === id) ||
        (state.viewMode === "composite" && id === state.compositeConfig.baseModelId);
      btn.classList.toggle("active", isActive);
    }
    // Rebuild if saved models changed
    buildFilters();
    buildList();
  }

  navSearch.addEventListener("input", () => {
    searchQuery = navSearch.value;
    buildList();
  });

  buildFilters();
  buildList();

  return { refresh };
}
