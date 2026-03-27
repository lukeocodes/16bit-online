import type { WorkbenchState } from "./WorkbenchAPI";
import type { WorkbenchAPI } from "./WorkbenchAPI";
import type { ArmorType } from "./models/palette";
import { computePalette } from "./models/palette";
import { registry } from "./models/registry";

/**
 * Create the control panel. Adapts based on view mode:
 * - Composite: slot selectors + color pickers + animation
 * - Individual: model list + color pickers + animation
 */
export function createControls(
  container: HTMLElement,
  state: WorkbenchState,
  api: WorkbenchAPI
): void {
  let armorType: ArmorType = "leather";

  function rebuildPalette() {
    const p = state.compositeConfig.palette;
    const newPalette = computePalette(p.skin, p.hair, p.eyes, p.primary, p.secondary, armorType);
    Object.assign(state.compositeConfig.palette, newPalette);
  }

  function rebuild() {
    container.innerHTML = "";
    buildViewNav();
    if (state.viewMode === "composite") {
      buildCompositeControls();
    } else {
      buildModelBrowser();
    }
    buildColorControls();
    buildAnimationControls();
    buildInfo();
  }

  // ─── View mode nav ──────────────

  function buildViewNav() {
    appendHeading(container, "View");
    const nav = document.createElement("div");
    nav.className = "radio-group";

    const modes: Array<{ label: string; mode: "composite" | "individual" }> = [
      { label: "Composite", mode: "composite" },
      { label: "Individual", mode: "individual" },
    ];

    for (const m of modes) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "viewMode";
      input.value = m.mode;
      input.checked = state.viewMode === m.mode;
      input.addEventListener("change", () => {
        if (input.checked) {
          api.setView(m.mode, m.mode === "individual" ? (registry.list()[0]?.id ?? null) : undefined);
          rebuild();
        }
      });
      const span = document.createElement("span");
      span.textContent = m.label;
      label.appendChild(input);
      label.appendChild(span);
      nav.appendChild(label);
    }
    container.appendChild(nav);
  }

  // ─── Composite: slot selectors ──

  function buildCompositeControls() {
    const slots: Array<{ label: string; slot: string; category: string }> = [
      { label: "Armor", slot: "torso", category: "armor" },
      { label: "Weapon", slot: "hand-R", category: "weapon" },
      { label: "Off-hand", slot: "hand-L", category: "offhand" },
      { label: "Hair", slot: "head-top", category: "hair" },
      { label: "Headgear", slot: "head-top", category: "headgear" },
    ];

    // Armor type selector (drives palette)
    appendHeading(container, "Armor Type");
    const armorTypes: ArmorType[] = ["none", "cloth", "leather", "mail", "plate"];
    createRadioGroup(container, "armorType", armorTypes, armorType, (v) => {
      armorType = v as ArmorType;
      rebuildPalette();
      // Swap armor model
      const armorModelMap: Record<string, string | null> = {
        none: null,
        cloth: "armor-cloth",
        leather: "armor-leather",
        mail: "armor-mail",
        plate: "armor-plate",
      };
      api.setSlot("torso", armorModelMap[v] ?? null);

      // Swap headgear for plate/mail
      if (v === "plate") {
        api.setSlot("head-top", "helmet-plate");
      } else if (v === "mail") {
        api.setSlot("head-top", "coif-mail");
      } else {
        // Restore hair
        const hasHair = state.compositeConfig.attachments.some(
          (a) => a.slot === "head-top" && a.modelId.startsWith("hair-")
        );
        if (!hasHair) api.setSlot("head-top", "hair-short");
      }
    });

    // Weapon selector
    appendHeading(container, "Weapon");
    const weapons = registry.list("weapon");
    const weaponOpts = ["none", ...weapons.map((w) => w.id)];
    const weaponLabels = ["none", ...weapons.map((w) => w.name)];
    const currentWeapon = state.compositeConfig.attachments.find((a) => a.slot === "hand-R")?.modelId ?? "none";
    createSelectGroup(container, "Weapon", weaponOpts, weaponLabels, currentWeapon, (v) => {
      api.setSlot("hand-R", v === "none" ? null : v);
    });

    // Offhand selector
    appendHeading(container, "Off-hand");
    const offhands = registry.list("offhand");
    const offhandOpts = ["none", ...offhands.map((o) => o.id)];
    const offhandLabels = ["none", ...offhands.map((o) => o.name)];
    const currentOffhand = state.compositeConfig.attachments.find((a) => a.slot === "hand-L")?.modelId ?? "none";
    createSelectGroup(container, "Off-hand", offhandOpts, offhandLabels, currentOffhand, (v) => {
      api.setSlot("hand-L", v === "none" ? null : v);
    });
  }

  // ─── Individual: model browser ──

  function buildModelBrowser() {
    appendHeading(container, "Models");
    const categories = registry.categories();
    for (const cat of categories) {
      const models = registry.list(cat);
      if (models.length === 0) continue;

      const catDiv = document.createElement("div");
      catDiv.style.marginBottom = "8px";

      const catLabel = document.createElement("div");
      catLabel.textContent = cat.toUpperCase();
      catLabel.style.color = "#666";
      catLabel.style.fontSize = "10px";
      catLabel.style.marginBottom = "2px";
      catDiv.appendChild(catLabel);

      for (const model of models) {
        const btn = document.createElement("button");
        btn.textContent = model.name;
        btn.style.width = "100%";
        btn.style.marginTop = "2px";
        btn.style.fontSize = "12px";
        btn.style.padding = "4px 8px";
        if (state.selectedModelId === model.id) {
          btn.style.background = "#53a8b6";
        }
        btn.addEventListener("click", () => {
          api.setView("individual", model.id);
          rebuild();
        });
        catDiv.appendChild(btn);
      }
      container.appendChild(catDiv);
    }

    // Ghost body toggle
    const ghostDiv = document.createElement("div");
    ghostDiv.className = "control-group";
    ghostDiv.style.marginTop = "8px";
    const ghostLabel = document.createElement("label");
    ghostLabel.textContent = "Show body";
    ghostLabel.style.minWidth = "70px";
    const ghostCheck = document.createElement("input");
    ghostCheck.type = "checkbox";
    ghostCheck.checked = state.showGhostBody;
    ghostCheck.addEventListener("change", () => {
      api.setShowGhostBody(ghostCheck.checked);
    });
    ghostDiv.appendChild(ghostLabel);
    ghostDiv.appendChild(ghostCheck);
    container.appendChild(ghostDiv);
  }

  // ─── Colors ─────────────────────

  function buildColorControls() {
    appendHeading(container, "Colors");
    const p = state.compositeConfig.palette;
    createColorPicker(container, "Skin", p.skin, (v) => {
      state.compositeConfig.palette.skin = v;
      rebuildPalette();
    });
    createColorPicker(container, "Hair", p.hair, (v) => {
      state.compositeConfig.palette.hair = v;
      rebuildPalette();
    });
    createColorPicker(container, "Eyes", p.eyes, (v) => {
      state.compositeConfig.palette.eyes = v;
      rebuildPalette();
    });
    createColorPicker(container, "Primary", p.primary, (v) => {
      state.compositeConfig.palette.primary = v;
      rebuildPalette();
    });
    createColorPicker(container, "Secondary", p.secondary, (v) => {
      state.compositeConfig.palette.secondary = v;
      rebuildPalette();
    });
  }

  // ─── Animation ──────────────────

  function buildAnimationControls() {
    appendHeading(container, "Animation");
    const animDiv = document.createElement("div");
    animDiv.className = "control-group";

    const playBtn = document.createElement("button");
    playBtn.textContent = state.playing ? "\u23f8 Pause" : "\u25b6 Play";
    playBtn.style.width = "auto";
    playBtn.style.flex = "0";
    playBtn.style.padding = "4px 12px";
    playBtn.addEventListener("click", () => {
      api.toggleAnimation();
      playBtn.textContent = state.playing ? "\u23f8 Pause" : "\u25b6 Play";
    });

    const speedLabel = document.createElement("label");
    speedLabel.textContent = "Speed";
    speedLabel.style.minWidth = "40px";

    const speedSlider = document.createElement("input");
    speedSlider.type = "range";
    speedSlider.min = "0.1";
    speedSlider.max = "3.0";
    speedSlider.step = "0.1";
    speedSlider.value = String(state.animSpeed);
    speedSlider.addEventListener("input", () => {
      api.setAnimSpeed(parseFloat(speedSlider.value));
    });

    animDiv.appendChild(playBtn);
    animDiv.appendChild(speedLabel);
    animDiv.appendChild(speedSlider);
    container.appendChild(animDiv);
  }

  // ─── Info ───────────────────────

  function buildInfo() {
    const divider = document.createElement("div");
    divider.className = "section-divider";
    container.appendChild(divider);

    const info = document.createElement("div");
    info.id = "info";
    info.innerHTML = `
      <strong>Model Workbench</strong><br>
      Composable model system. Switch between composite and individual views.<br>
      Use <code>window.__workbench</code> for programmatic control.
    `;
    container.appendChild(info);
  }

  // Initial build
  rebuild();
}

// ─── Helpers ────────────────────────────────────────────────────────

function appendHeading(container: HTMLElement, text: string): void {
  const h2 = document.createElement("h2");
  h2.textContent = text;
  container.appendChild(h2);
}

function createRadioGroup(
  container: HTMLElement,
  name: string,
  options: string[],
  current: string,
  onChange: (value: string) => void
): void {
  const group = document.createElement("div");
  group.className = "radio-group";
  for (const opt of options) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = opt;
    input.checked = opt === current;
    input.addEventListener("change", () => { if (input.checked) onChange(opt); });
    const span = document.createElement("span");
    span.textContent = opt;
    label.appendChild(input);
    label.appendChild(span);
    group.appendChild(label);
  }
  container.appendChild(group);
}

function createSelectGroup(
  container: HTMLElement,
  label: string,
  values: string[],
  labels: string[],
  current: string,
  onChange: (value: string) => void
): void {
  const div = document.createElement("div");
  div.className = "control-group";
  const select = document.createElement("select");
  for (let i = 0; i < values.length; i++) {
    const opt = document.createElement("option");
    opt.value = values[i];
    opt.textContent = labels[i];
    opt.selected = values[i] === current;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => onChange(select.value));
  div.appendChild(select);
  container.appendChild(div);
}

function createColorPicker(
  container: HTMLElement,
  label: string,
  initial: number,
  onChange: (value: number) => void
): void {
  const div = document.createElement("div");
  div.className = "control-group";
  const lbl = document.createElement("label");
  lbl.textContent = label;
  const input = document.createElement("input");
  input.type = "color";
  input.value = "#" + initial.toString(16).padStart(6, "0");
  input.addEventListener("input", () => {
    onChange(parseInt(input.value.slice(1), 16));
  });
  div.appendChild(lbl);
  div.appendChild(input);
  container.appendChild(div);
}
