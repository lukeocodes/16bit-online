export type VolumeChangeCallback = (masterVolume: number, musicVolume: number, sfxVolume: number) => void;

export class SettingsMenu {
  private container: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private visible = false;
  private gearBtn: HTMLElement | null = null;
  private masterSlider: HTMLInputElement | null = null;
  private musicSlider: HTMLInputElement | null = null;
  private sfxSlider: HTMLInputElement | null = null;
  private onVolumeChange: VolumeChangeCallback | null = null;

  setOnVolumeChange(cb: VolumeChangeCallback): void { this.onVolumeChange = cb; }

  render(): HTMLElement {
    // Outer container positioned in bottom-right, above minimap area
    this.container = document.createElement("div");
    this.container.style.cssText = "position: absolute; bottom: 20px; right: 12px; pointer-events: auto; z-index: 10;";

    // Gear icon button
    this.gearBtn = document.createElement("div");
    this.gearBtn.style.cssText = `
      width: 36px; height: 36px; background: #16213ecc; border: 1px solid #444;
      border-radius: 6px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 18px; color: #888; transition: all 0.15s; user-select: none;
    `;
    this.gearBtn.textContent = "\u2699"; // gear unicode
    this.gearBtn.title = "Audio Settings";
    this.gearBtn.onmouseenter = () => { if (this.gearBtn) this.gearBtn.style.color = "#13ef93"; };
    this.gearBtn.onmouseleave = () => { if (this.gearBtn) this.gearBtn.style.color = "#888"; };
    this.gearBtn.onclick = () => this.toggle();
    this.container.appendChild(this.gearBtn);

    // Settings panel (hidden by default)
    this.panel = document.createElement("div");
    this.panel.style.cssText = `
      position: absolute; bottom: 44px; right: 0; width: 220px;
      background: #16213eee; border: 1px solid #444; border-radius: 8px;
      padding: 12px; display: none;
    `;

    const title = document.createElement("div");
    title.textContent = "Audio Settings";
    title.style.cssText = "font-size: 13px; font-weight: 600; color: #e0e0e0; margin-bottom: 10px;";
    this.panel.appendChild(title);

    // Create sliders
    this.masterSlider = this.createSlider("Master Volume", 0.8);
    this.musicSlider = this.createSlider("Music Volume", 0.6);
    this.sfxSlider = this.createSlider("Sound Effects", 1.0);

    this.container.appendChild(this.panel);
    return this.container;
  }

  setVolumes(master: number, music: number, sfx: number): void {
    if (this.masterSlider) this.masterSlider.value = String(master);
    if (this.musicSlider) this.musicSlider.value = String(music);
    if (this.sfxSlider) this.sfxSlider.value = String(sfx);
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.panel) this.panel.style.display = this.visible ? "block" : "none";
    if (this.gearBtn) this.gearBtn.style.borderColor = this.visible ? "#13ef93" : "#444";
  }

  isVisible(): boolean { return this.visible; }

  dispose(): void {
    this.container = null;
    this.panel = null;
    this.gearBtn = null;
  }

  private createSlider(label: string, defaultValue: number): HTMLInputElement {
    const row = document.createElement("div");
    row.style.cssText = "margin-bottom: 8px;";

    const labelEl = document.createElement("div");
    labelEl.style.cssText = "font-size: 11px; color: #aaa; margin-bottom: 4px; display: flex; justify-content: space-between;";
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
      this.fireVolumeChange();
    });

    row.append(labelEl, slider);
    if (this.panel) this.panel.appendChild(row);
    return slider;
  }

  private fireVolumeChange(): void {
    if (!this.onVolumeChange) return;
    const master = this.masterSlider ? Number(this.masterSlider.value) : 0.8;
    const music = this.musicSlider ? Number(this.musicSlider.value) : 0.6;
    const sfx = this.sfxSlider ? Number(this.sfxSlider.value) : 1.0;
    this.onVolumeChange(master, music, sfx);
  }
}
