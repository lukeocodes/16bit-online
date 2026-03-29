export type VolumeChangeCallback = (masterVolume: number, musicVolume: number, sfxVolume: number) => void;
export type RenderQuality = "low" | "medium" | "high" | "ultra";
export type QualityChangeCallback = (quality: RenderQuality) => void;

const QUALITY_LABELS: Record<RenderQuality, { label: string; desc: string }> = {
  low:   { label: "Low",   desc: "96×128 — saves memory, ideal for low-end devices" },
  medium:{ label: "Medium",desc: "144×192 — balanced quality and memory use" },
  high:  { label: "High",  desc: "192×256 — sharp at 2× zoom, good for Retina" },
  ultra: { label: "Ultra", desc: "288×384 — crisp at 4× zoom / 4K displays (high memory)" },
};

const QUALITY_STORAGE_KEY = "renderQuality";

export function loadSavedQuality(): RenderQuality {
  const saved = localStorage.getItem(QUALITY_STORAGE_KEY) as RenderQuality | null;
  if (saved && saved in QUALITY_LABELS) return saved;
  return "high"; // sensible default; Game.ts can override with autoDetectQuality()
}

type NavSection = "audio" | "graphics";

// ─── Settings modal (sidebar + content) ────────────────────────────────────

class SettingsModal {
  private backdrop: HTMLElement;
  private contentArea: HTMLElement;
  private activeNav: NavSection = "audio";
  private navBtns = new Map<NavSection, HTMLElement>();

  private masterSlider: HTMLInputElement | null = null;
  private musicSlider: HTMLInputElement | null = null;
  private sfxSlider: HTMLInputElement | null = null;
  private onVolumeChange: VolumeChangeCallback | null = null;
  private onQualityChange: QualityChangeCallback | null = null;
  private currentQuality: RenderQuality = loadSavedQuality();

  constructor(private onClose: () => void) {
    this.backdrop = document.createElement("div");
    this.backdrop.style.cssText = `
      position: absolute; inset: 0; z-index: 950;
      background: rgba(0,0,0,0.75); backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto;
    `;
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.close();
    });

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: #16213e; border: 1px solid #334; border-radius: 12px;
      width: 560px; height: 380px; display: flex; overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.8);
    `;

    modal.appendChild(this.buildSidebar());
    this.contentArea = document.createElement("div");
    this.contentArea.style.cssText = "flex: 1; padding: 28px 28px; overflow-y: auto;";
    modal.appendChild(this.contentArea);
    this.backdrop.appendChild(modal);

    this.showSection("audio");
  }

  setOnVolumeChange(cb: VolumeChangeCallback) { this.onVolumeChange = cb; }
  setOnQualityChange(cb: QualityChangeCallback) { this.onQualityChange = cb; }

  setVolumes(master: number, music: number, sfx: number) {
    if (this.masterSlider) this.masterSlider.value = String(master);
    if (this.musicSlider) this.musicSlider.value = String(music);
    if (this.sfxSlider) this.sfxSlider.value = String(sfx);
  }

  getElement(): HTMLElement { return this.backdrop; }

  close() { this.onClose(); }

  private buildSidebar(): HTMLElement {
    const sidebar = document.createElement("div");
    sidebar.style.cssText = `
      width: 160px; flex-shrink: 0; border-right: 1px solid #334;
      padding: 24px 12px; display: flex; flex-direction: column; gap: 4px;
    `;

    const heading = document.createElement("div");
    heading.textContent = "Settings";
    heading.style.cssText = "font-size: 14px; font-weight: 700; color: #e0e0e0; margin-bottom: 14px; padding-left: 8px;";
    sidebar.appendChild(heading);

    const sections: { id: NavSection; label: string }[] = [
      { id: "audio",    label: "Audio"    },
      { id: "graphics", label: "Graphics" },
    ];

    for (const { id, label } of sections) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.style.cssText = `
        width: 100%; padding: 8px 10px; background: transparent;
        border: none; border-radius: 6px; color: #aaa;
        font-size: 12px; font-family: monospace; text-align: left;
        cursor: pointer; transition: all 0.12s;
      `;
      btn.onclick = () => this.showSection(id);
      this.navBtns.set(id, btn);
      sidebar.appendChild(btn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "← Back";
    closeBtn.style.cssText = `
      margin-top: auto; width: 100%; padding: 8px 10px; background: transparent;
      border: 1px solid #334; border-radius: 6px; color: #666;
      font-size: 11px; font-family: monospace; text-align: left;
      cursor: pointer; transition: all 0.12s;
    `;
    closeBtn.onmouseenter = () => { closeBtn.style.color = "#ccc"; closeBtn.style.borderColor = "#556"; };
    closeBtn.onmouseleave = () => { closeBtn.style.color = "#666"; closeBtn.style.borderColor = "#334"; };
    closeBtn.onclick = () => this.close();
    sidebar.appendChild(closeBtn);

    return sidebar;
  }

  private showSection(id: NavSection) {
    this.activeNav = id;

    for (const [navId, btn] of this.navBtns) {
      const active = navId === id;
      btn.style.background = active ? "#ffffff18" : "transparent";
      btn.style.color = active ? "#13ef93" : "#aaa";
    }

    this.contentArea.innerHTML = "";
    if (id === "audio")    this.contentArea.appendChild(this.buildAudioSection());
    if (id === "graphics") this.contentArea.appendChild(this.buildGraphicsSection());
  }

  private buildAudioSection(): HTMLElement {
    const section = document.createElement("div");

    const heading = document.createElement("div");
    heading.textContent = "Audio";
    heading.style.cssText = "font-size: 15px; font-weight: 600; color: #e0e0e0; margin-bottom: 20px;";
    section.appendChild(heading);

    this.masterSlider = this.addSlider(section, "Master Volume", 0.8);
    this.musicSlider = this.addSlider(section, "Music Volume", 0.6);
    this.sfxSlider = this.addSlider(section, "Sound Effects", 1.0);

    return section;
  }

  private buildGraphicsSection(): HTMLElement {
    const section = document.createElement("div");

    const heading = document.createElement("div");
    heading.textContent = "Graphics";
    heading.style.cssText = "font-size: 15px; font-weight: 600; color: #e0e0e0; margin-bottom: 6px;";
    section.appendChild(heading);

    const subheading = document.createElement("div");
    subheading.textContent = "Render Quality";
    subheading.style.cssText = "font-size: 11px; color: #888; margin-bottom: 14px;";
    section.appendChild(subheading);

    const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1;
    const note = document.createElement("div");
    note.textContent = `Your display: ${dpr}× pixel density`;
    note.style.cssText = "font-size: 10px; color: #556; margin-bottom: 16px; font-family: monospace;";
    section.appendChild(note);

    for (const quality of ["low", "medium", "high", "ultra"] as RenderQuality[]) {
      const { label, desc } = QUALITY_LABELS[quality];
      const row = document.createElement("div");
      const isActive = quality === this.currentQuality;
      row.style.cssText = `
        padding: 10px 12px; border-radius: 6px; cursor: pointer; margin-bottom: 6px;
        border: 1px solid ${isActive ? "#13ef93" : "#334"};
        background: ${isActive ? "#13ef9318" : "transparent"};
        transition: all 0.12s;
      `;

      const titleRow = document.createElement("div");
      titleRow.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 2px;";

      const dot = document.createElement("div");
      dot.style.cssText = `
        width: 8px; height: 8px; border-radius: 50%;
        background: ${isActive ? "#13ef93" : "#334"}; flex-shrink: 0;
        transition: background 0.12s;
      `;

      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      labelEl.style.cssText = `font-size: 13px; color: ${isActive ? "#13ef93" : "#ccc"}; font-weight: 600; transition: color 0.12s;`;

      const descEl = document.createElement("div");
      descEl.textContent = desc;
      descEl.style.cssText = "font-size: 10px; color: #667; font-family: monospace; padding-left: 16px;";

      titleRow.append(dot, labelEl);
      row.append(titleRow, descEl);

      row.onclick = () => {
        this.currentQuality = quality;
        localStorage.setItem(QUALITY_STORAGE_KEY, quality);
        this.onQualityChange?.(quality);
        // Rebuild section to update active state
        this.contentArea.innerHTML = "";
        this.contentArea.appendChild(this.buildGraphicsSection());
      };
      row.onmouseenter = () => {
        if (quality !== this.currentQuality) {
          row.style.borderColor = "#556";
          row.style.background = "#ffffff08";
        }
      };
      row.onmouseleave = () => {
        if (quality !== this.currentQuality) {
          row.style.borderColor = "#334";
          row.style.background = "transparent";
        }
      };

      section.appendChild(row);
    }

    return section;
  }

  private addSlider(parent: HTMLElement, label: string, defaultValue: number): HTMLInputElement {
    const row = document.createElement("div");
    row.style.cssText = "margin-bottom: 16px;";

    const labelEl = document.createElement("div");
    labelEl.style.cssText = "font-size: 11px; color: #aaa; margin-bottom: 5px; display: flex; justify-content: space-between;";
    const labelText = document.createElement("span");
    labelText.textContent = label;
    const valueText = document.createElement("span");
    valueText.textContent = `${Math.round(defaultValue * 100)}%`;
    labelEl.append(labelText, valueText);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.01";
    slider.value = String(defaultValue);
    slider.style.cssText = "width: 100%; accent-color: #13ef93; cursor: pointer;";

    slider.addEventListener("input", () => {
      valueText.textContent = `${Math.round(Number(slider.value) * 100)}%`;
      if (!this.onVolumeChange) return;
      const master = this.masterSlider ? Number(this.masterSlider.value) : 0.8;
      const music = this.musicSlider ? Number(this.musicSlider.value) : 0.6;
      const sfx = this.sfxSlider ? Number(this.sfxSlider.value) : 1.0;
      this.onVolumeChange(master, music, sfx);
    });

    row.append(labelEl, slider);
    parent.appendChild(row);
    return slider;
  }
}

// ─── Pause menu (Escape) ────────────────────────────────────────────────────

export class SettingsMenu {
  private backdrop: HTMLElement | null = null;
  private settingsModal: SettingsModal | null = null;
  private visible = false;

  private onVolumeChange: VolumeChangeCallback | null = null;
  private onQualityChange: QualityChangeCallback | null = null;
  private onSwitchCharacter: (() => void) | null = null;
  private onDisconnect: (() => void) | null = null;

  setOnVolumeChange(cb: VolumeChangeCallback): void { this.onVolumeChange = cb; }
  setOnQualityChange(cb: QualityChangeCallback): void { this.onQualityChange = cb; }
  setOnSwitchCharacter(cb: () => void): void { this.onSwitchCharacter = cb; }
  setOnDisconnect(cb: () => void): void { this.onDisconnect = cb; }

  render(): HTMLElement {
    this.backdrop = document.createElement("div");
    this.backdrop.style.cssText = `
      position: absolute; inset: 0; z-index: 900;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(2px);
      display: none; align-items: center; justify-content: center;
      pointer-events: auto;
    `;
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.hide();
    });
    this.backdrop.appendChild(this.buildPausePanel());
    return this.backdrop;
  }

  private buildPausePanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.style.cssText = `
      background: #16213e; border: 1px solid #334; border-radius: 12px;
      width: 240px; padding: 32px 24px;
      display: flex; flex-direction: column; gap: 10px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    `;

    const title = document.createElement("div");
    title.textContent = "Paused";
    title.style.cssText = "font-size: 20px; font-weight: 700; color: #e0e0e0; margin-bottom: 8px; text-align: center;";
    panel.appendChild(title);

    panel.appendChild(this.menuBtn("Settings", () => this.openSettings()));
    panel.appendChild(this.menuBtn("Switch Character", () => {
      this.hide();
      this.onSwitchCharacter?.();
    }));
    panel.appendChild(this.menuBtn("Disconnect", () => {
      this.hide();
      this.onDisconnect?.();
    }, true));

    return panel;
  }

  private menuBtn(label: string, onClick: () => void, danger = false): HTMLElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = `
      width: 100%; padding: 11px 14px; background: transparent;
      border: 1px solid ${danger ? "#c0392b55" : "#334"}; border-radius: 6px;
      color: ${danger ? "#e74c3c" : "#ccc"}; font-size: 13px; font-family: monospace;
      text-align: center; cursor: pointer; transition: all 0.15s;
    `;
    btn.onmouseenter = () => {
      btn.style.background = danger ? "#c0392b22" : "#ffffff11";
      btn.style.color = danger ? "#ff6b6b" : "#fff";
      btn.style.borderColor = danger ? "#e74c3c" : "#556";
    };
    btn.onmouseleave = () => {
      btn.style.background = "transparent";
      btn.style.color = danger ? "#e74c3c" : "#ccc";
      btn.style.borderColor = danger ? "#c0392b55" : "#334";
    };
    btn.onclick = onClick;
    return btn;
  }

  private openSettings(): void {
    if (!this.backdrop) return;
    if (!this.settingsModal) {
      this.settingsModal = new SettingsModal(() => {
        // Remove modal from DOM when closed
        this.settingsModal?.getElement().remove();
        this.settingsModal = null;
      });
      if (this.onVolumeChange) this.settingsModal.setOnVolumeChange(this.onVolumeChange);
      if (this.onQualityChange) this.settingsModal.setOnQualityChange(this.onQualityChange);
    }
    this.backdrop.appendChild(this.settingsModal.getElement());
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.settingsModal?.setVolumes(master, music, sfx);
  }

  show(): void {
    this.visible = true;
    if (this.backdrop) this.backdrop.style.display = "flex";
  }

  hide(): void {
    this.visible = false;
    if (this.backdrop) this.backdrop.style.display = "none";
    // Also close settings modal if open
    this.settingsModal?.getElement().remove();
    this.settingsModal = null;
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  isVisible(): boolean { return this.visible; }
  isSettingsOpen(): boolean { return this.settingsModal !== null; }

  closeSettings(): void {
    this.settingsModal?.getElement().remove();
    this.settingsModal = null;
  }

  dispose(): void {
    this.backdrop = null;
    this.settingsModal = null;
  }
}
