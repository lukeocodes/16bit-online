import type { Screen } from "../UIManager";
import { MiniMap } from "../components/MiniMap";
import { WorldMap } from "../components/WorldMap";
import { SettingsMenu } from "../components/SettingsMenu";
import { ChatBox } from "../components/ChatBox";
import { InventoryPanel } from "../components/InventoryPanel";

export interface TargetInfo {
  name: string;
  hp: number;
  maxHp: number;
}

export class GameHUD implements Screen {
  private container: HTMLElement | null = null;
  private targetPanel: HTMLElement | null = null;
  private targetName: HTMLElement | null = null;
  private targetHpFill: HTMLElement | null = null;
  private targetHpText: HTMLElement | null = null;
  private autoAttackBtn: HTMLElement | null = null;
  private combatIndicator: HTMLElement | null = null;
  private playerPanel: HTMLElement | null = null;

  public miniMap: MiniMap;
  public worldMap: WorldMap;
  public settingsMenu: SettingsMenu;
  public chatBox: ChatBox;
  public inventory: InventoryPanel;

  private onAutoAttackToggle: (() => void) | null = null;
  private onAbilityUse: ((slot: number) => void) | null = null;
  private abilitySlots: HTMLElement[] = [];

  constructor() {
    this.miniMap = new MiniMap();
    this.worldMap = new WorldMap();
    this.settingsMenu = new SettingsMenu();
    this.chatBox = new ChatBox();
    this.inventory = new InventoryPanel();
  }

  setOnAutoAttackToggle(handler: () => void) {
    this.onAutoAttackToggle = handler;
  }

  setOnAbilityUse(handler: (slot: number) => void) {
    this.onAbilityUse = handler;
  }

  /** Update ability slot visual to show cooldown overlay */
  updateAbilityCooldown(slot: number, remainingSec: number) {
    const el = this.abilitySlots[slot];
    if (!el) return;
    // Grey out + show timer text
    el.style.opacity = remainingSec > 0 ? "0.4" : "1";
    const existing = el.querySelector(".cd-overlay") as HTMLElement;
    if (remainingSec > 0) {
      if (existing) {
        existing.textContent = `${remainingSec}s`;
      } else {
        const overlay = document.createElement("span");
        overlay.className = "cd-overlay";
        overlay.textContent = `${remainingSec}s`;
        overlay.style.cssText = "position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:14px; color:#fff; background:#00000088; border-radius:6px;";
        el.appendChild(overlay);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  render(): HTMLElement {
    this.container = document.createElement("div");
    this.container.style.cssText = "width: 100%; height: 100%; position: relative; pointer-events: none;";
    // All child panels re-enable pointer-events individually

    this.container.appendChild(this.createPlayerInfo());
    this.container.appendChild(this.createTargetPanel());
    this.container.appendChild(this.createActionBar());
    this.container.appendChild(this.createMiniMap());
    this.container.appendChild(this.chatBox.render());
    this.container.appendChild(this.worldMap.render());
    this.container.appendChild(this.settingsMenu.render());
    this.container.appendChild(this.inventory.getElement());

    return this.container;
  }

  updateTarget(info: TargetInfo | null) {
    if (!this.targetPanel) return;

    if (!info) {
      this.targetPanel.style.display = "none";
      return;
    }

    this.targetPanel.style.display = "block";
    if (this.targetName) {
      // Derive difficulty level from max HP: 10→Lv1, 15→Lv2, 25→Lv4, 40→Lv6, 50→Lv8
      const level = Math.max(1, Math.round(info.maxHp / 6));
      this.targetName.textContent = `${info.name}  Lv${level}`;
    }
    if (this.targetHpFill) {
      const pct = Math.max(0, (info.hp / info.maxHp) * 100);
      this.targetHpFill.style.width = `${pct}%`;
      this.targetHpFill.style.background = pct > 50 ? "#e74c3c" : pct > 25 ? "#e67e22" : "#c0392b";
    }
    if (this.targetHpText) this.targetHpText.textContent = `${info.hp} / ${info.maxHp}`;
  }

  updateAutoAttack(active: boolean) {
    if (!this.autoAttackBtn) return;
    this.autoAttackBtn.style.background = active ? "#cc333388" : "#0a0a1a88";
    this.autoAttackBtn.style.borderColor = active ? "#ff4444" : "#444";
    this.autoAttackBtn.style.color = active ? "#ff6666" : "#555";
  }

  updateCombat(inCombat: boolean) {
    if (!this.combatIndicator) return;
    this.combatIndicator.style.display = inCombat ? "block" : "none";
    if (this.playerPanel) {
      this.playerPanel.style.borderColor = inCombat ? "#cc3333" : "#333";
    }
  }

  setPlayerName(name: string) {
    const el = this.container?.querySelector("#player-name-label");
    if (el) el.textContent = name;
  }

  updatePlayerHp(hp: number, maxHp: number, mana: number, maxMana: number, stamina: number, maxStamina: number) {
    this.updateBar("hp", hp, maxHp);
    this.updateBar("mp", mana, maxMana);
    this.updateBar("st", stamina, maxStamina);
  }

  /** Show a zone entry/exit notification centered on screen */
  showZoneNotification(text: string): void {
    if (!this.container) return;

    const el = document.createElement("div");
    el.style.cssText = `
      position: absolute; top: 25%; left: 50%; transform: translate(-50%, -50%);
      color: #f0e8d0; font-size: 22px; font-weight: bold; font-family: 'Segoe UI', system-ui, sans-serif;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5);
      letter-spacing: 2px; text-transform: uppercase;
      opacity: 0; pointer-events: none;
      transition: opacity 0.6s ease-in;
    `;
    el.textContent = text;
    this.container.appendChild(el);

    // Fade in
    requestAnimationFrame(() => { el.style.opacity = "1"; });

    // Fade out after 2s, remove after 3s
    setTimeout(() => { el.style.transition = "opacity 1s ease-out"; el.style.opacity = "0"; }, 2000);
    setTimeout(() => { el.remove(); }, 3000);
  }

  private updateBar(id: string, value: number, max: number) {
    const fill = this.container?.querySelector(`#bar-fill-${id}`) as HTMLElement | null;
    const text = this.container?.querySelector(`#bar-text-${id}`) as HTMLElement | null;
    if (fill) fill.style.width = `${Math.max(0, (value / max) * 100)}%`;
    if (text) text.textContent = `${value}`;
  }

  private createActionBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.style.cssText = `
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); pointer-events: auto;
      display: flex; gap: 4px; background: #16213ecc; border: 1px solid #333;
      border-radius: 8px; padding: 8px;
    `;

    // Auto-attack button (first slot)
    this.autoAttackBtn = document.createElement("div");
    this.autoAttackBtn.style.cssText = `
      width: 52px; height: 52px; background: #0a0a1a88;
      border: 2px solid #444; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; flex-direction: column;
      color: #555; font-size: 10px; cursor: pointer;
      transition: all 0.15s; user-select: none;
    `;
    this.autoAttackBtn.innerHTML = `<span style="font-size:18px">⚔</span><span>Attack</span>`;
    this.autoAttackBtn.title = "Toggle Auto-Attack (Caps Lock)";
    this.autoAttackBtn.onclick = () => {
      if (this.onAutoAttackToggle) this.onAutoAttackToggle();
    };
    bar.appendChild(this.autoAttackBtn);

    // Ability slots with keybind labels and placeholder icons
    const slotDefs = [
      { key: "2", icon: "🛡", label: "Defend", color: "#4488cc" },
      { key: "3", icon: "💊", label: "Heal", color: "#44cc66" },
      { key: "4", icon: "🔥", label: "Fire", color: "#cc6622" },
      { key: "5", icon: "❄", label: "Ice", color: "#66aadd" },
      { key: "6", icon: "⚡", label: "Shock", color: "#cccc44" },
    ];
    for (const def of slotDefs) {
      const slot = document.createElement("div");
      slot.style.cssText = `
        width: 52px; height: 52px; background: #0a0a1a88;
        border: 1px solid #444; border-radius: 6px;
        display: flex; align-items: center; justify-content: center; flex-direction: column;
        color: #555; font-size: 10px; cursor: pointer;
        transition: border-color 0.15s; position: relative; user-select: none;
      `;
      slot.innerHTML = `<span style="font-size:16px; opacity:0.4">${def.icon}</span><span style="opacity:0.3">${def.label}</span>`;
      // Keybind indicator
      const keybind = document.createElement("span");
      keybind.textContent = def.key;
      keybind.style.cssText = `position:absolute; top:2px; right:4px; font-size:9px; color:#666;`;
      slot.appendChild(keybind);
      slot.onmouseenter = () => (slot.style.borderColor = def.color);
      slot.onmouseleave = () => (slot.style.borderColor = "#444");
      slot.onclick = () => { if (this.onAbilityUse) this.onAbilityUse(parseInt(def.key) - 1); };
      slot.title = `${def.label} (${def.key})`;
      this.abilitySlots.push(slot);
      bar.appendChild(slot);
    }

    return bar;
  }

  private createPlayerInfo(): HTMLElement {
    this.playerPanel = document.createElement("div");
    this.playerPanel.style.cssText = `
      position: absolute; top: 12px; left: 12px; pointer-events: auto;
      background: #16213ecc; border: 2px solid #333; border-radius: 8px;
      padding: 12px 16px; min-width: 160px; transition: border-color 0.3s;
    `;

    const name = document.createElement("div");
    name.id = "player-name-label";
    name.textContent = "Player";
    name.style.cssText = "font-size: 14px; font-weight: 600; color: #e0e0e0; margin-bottom: 8px; position: relative;";

    this.combatIndicator = document.createElement("span");
    this.combatIndicator.textContent = " IN COMBAT";
    this.combatIndicator.style.cssText = `
      font-size: 10px; color: #ff4444; font-weight: 700; letter-spacing: 1px; display: none;
    `;
    name.appendChild(this.combatIndicator);

    this.playerPanel.appendChild(name);

    const bars = [
      { id: "hp", label: "HP", color: "#e74c3c", value: 50, max: 50 },
      { id: "mp", label: "MP", color: "#3498db", value: 50, max: 50 },
      { id: "st", label: "ST", color: "#f39c12", value: 50, max: 50 },
    ];

    for (const bar of bars) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; gap: 6px; margin-bottom: 4px;";

      const label = document.createElement("span");
      label.textContent = bar.label;
      label.style.cssText = "width: 20px; font-size: 11px; color: #888;";

      const track = document.createElement("div");
      track.style.cssText = "flex: 1; height: 6px; background: #333; border-radius: 3px; overflow: hidden;";

      const fill = document.createElement("div");
      fill.id = `bar-fill-${bar.id}`;
      fill.style.cssText = `height: 100%; background: ${bar.color}; border-radius: 3px; width: ${(bar.value / bar.max) * 100}%; transition: width 0.2s;`;
      track.appendChild(fill);

      const text = document.createElement("span");
      text.id = `bar-text-${bar.id}`;
      text.textContent = `${bar.value}`;
      text.style.cssText = "width: 28px; text-align: right; font-size: 11px; color: #aaa;";

      row.append(label, track, text);
      this.playerPanel.appendChild(row);
    }

    // XP bar
    const xpRow = document.createElement("div");
    xpRow.style.cssText = "display: flex; align-items: center; gap: 6px; margin-top: 6px;";

    const xpLabel = document.createElement("span");
    xpLabel.id = "xp-level";
    xpLabel.textContent = "Lv 1";
    xpLabel.style.cssText = "width: 32px; font-size: 11px; color: #c8a848; font-weight: 600;";

    const xpTrack = document.createElement("div");
    xpTrack.style.cssText = "flex: 1; height: 4px; background: #333; border-radius: 2px; overflow: hidden;";

    const xpFill = document.createElement("div");
    xpFill.id = "bar-fill-xp";
    xpFill.style.cssText = "height: 100%; background: #c8a848; border-radius: 2px; width: 0%; transition: width 0.3s;";
    xpTrack.appendChild(xpFill);

    const xpText = document.createElement("span");
    xpText.id = "bar-text-xp";
    xpText.textContent = "0";
    xpText.style.cssText = "width: 28px; text-align: right; font-size: 10px; color: #888;";

    xpRow.append(xpLabel, xpTrack, xpText);
    this.playerPanel.appendChild(xpRow);

    return this.playerPanel;
  }

  updateXp(xpIntoLevel: number, xpToNext: number, level: number) {
    const fill = this.container?.querySelector("#bar-fill-xp") as HTMLElement | null;
    const text = this.container?.querySelector("#bar-text-xp") as HTMLElement | null;
    const label = this.container?.querySelector("#xp-level") as HTMLElement | null;
    if (fill) fill.style.width = `${Math.max(0, (xpIntoLevel / xpToNext) * 100)}%`;
    if (text) text.textContent = `${xpIntoLevel}`;
    if (label) label.textContent = `Lv ${level}`;
  }

  showXpGain(amount: number) {
    if (!this.container) return;
    const el = document.createElement("div");
    el.textContent = `+${amount} XP`;
    el.style.cssText = `
      position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
      color: #c8a848; font-size: 16px; font-weight: bold; pointer-events: none;
      text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      opacity: 1; transition: all 1.5s ease-out;
    `;
    this.container.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(-40px)";
    });
    setTimeout(() => el.remove(), 1600);
  }

  showLevelUp(level: number) {
    if (!this.container) return;
    const el = document.createElement("div");
    el.textContent = `LEVEL UP! → ${level}`;
    el.style.cssText = `
      position: absolute; top: 35%; left: 50%; transform: translate(-50%, -50%);
      color: #ffd700; font-size: 28px; font-weight: bold; pointer-events: none;
      text-shadow: 0 2px 12px rgba(255,215,0,0.6), 0 0 30px rgba(255,215,0,0.3);
      letter-spacing: 3px; text-transform: uppercase;
      opacity: 0; transition: opacity 0.4s ease-in;
    `;
    this.container.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = "1"; });
    setTimeout(() => { el.style.transition = "opacity 1s ease-out"; el.style.opacity = "0"; }, 2500);
    setTimeout(() => el.remove(), 3600);
  }

  private createTargetPanel(): HTMLElement {
    this.targetPanel = document.createElement("div");
    this.targetPanel.style.cssText = `
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%); pointer-events: auto;
      background: #16213ecc; border: 1px solid #555; border-radius: 8px;
      padding: 10px 16px; min-width: 180px; display: none; text-align: center;
    `;

    this.targetName = document.createElement("div");
    this.targetName.style.cssText = "font-size: 13px; font-weight: 600; color: #e0e0e0; margin-bottom: 6px;";
    this.targetName.textContent = "";

    const hpTrack = document.createElement("div");
    hpTrack.style.cssText = "height: 8px; background: #333; border-radius: 4px; overflow: hidden; margin-bottom: 4px;";

    this.targetHpFill = document.createElement("div");
    this.targetHpFill.style.cssText = "height: 100%; background: #e74c3c; border-radius: 4px; width: 100%; transition: width 0.2s;";
    hpTrack.appendChild(this.targetHpFill);

    this.targetHpText = document.createElement("div");
    this.targetHpText.style.cssText = "font-size: 11px; color: #aaa;";

    this.targetPanel.append(this.targetName, hpTrack, this.targetHpText);
    return this.targetPanel;
  }

  private createMiniMap(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      position: absolute; top: 12px; right: 12px; pointer-events: auto;
    `;
    wrapper.appendChild(this.miniMap.render());
    return wrapper;
  }

  dispose() {
    this.miniMap.dispose();
    this.worldMap.dispose();
    this.settingsMenu.dispose();
    this.container = null;
    this.targetPanel = null;
    this.autoAttackBtn = null;
  }
}
