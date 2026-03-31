/**
 * WorldBuilderHUD — thin HTML overlay that appears at the top of the screen
 * when world builder mode is active.
 *
 * The HUD provides:
 *   • An "Add Item" button that opens the piece-selection dialog
 *   • An "Exit WB" / Esc button
 *   • A mode label so the player knows they're in WB mode
 */

import type { WallPiece } from "../../renderer/StructureRenderer";
import { PIECE_NAMES } from "../../engine/WorldBuilderMode";

export class WorldBuilderHUD {
  private el: HTMLElement;
  private dialogEl: HTMLElement | null = null;

  onAddItem?: (piece: WallPiece) => void;
  onExit?:    () => void;

  constructor() {
    this.el = this.buildHUD();
    document.body.appendChild(this.el);
  }

  show(): void { this.el.style.display = "flex"; }

  hide(): void {
    this.el.style.display = "none";
    this.closeDialog();
  }

  dispose(): void {
    this.el.remove();
    this.closeDialog();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private buildHUD(): HTMLElement {
    const el = document.createElement("div");
    el.id = "wb-hud";
    el.style.cssText = `
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 38px;
      background: rgba(8,12,24,0.93);
      border-bottom: 1px solid rgba(100,140,255,0.35);
      z-index: 9500;
      align-items: center;
      padding: 0 14px;
      gap: 12px;
      font-family: monospace;
      user-select: none;
    `;

    const icon = document.createElement("span");
    icon.textContent = "⬡";
    icon.style.cssText = "color: #6688dd; font-size: 16px; line-height: 1;";
    el.appendChild(icon);

    const label = document.createElement("span");
    label.textContent = "WORLD BUILDER";
    label.style.cssText = "color: #88aaff; font-size: 11px; font-weight: bold; letter-spacing: 2.5px;";
    el.appendChild(label);

    const sep = document.createElement("div");
    sep.style.cssText = "width: 1px; height: 20px; background: rgba(100,140,255,0.25);";
    el.appendChild(sep);

    const addBtn = document.createElement("button");
    addBtn.textContent = "+ Add Item";
    addBtn.style.cssText = this.btnCss("rgba(80,120,220,0.2)", "#88aaff");
    addBtn.addEventListener("click", () => this.openItemDialog());
    el.appendChild(addBtn);

    const hint = document.createElement("span");
    hint.textContent = "Left-click to select · Right-click to move";
    hint.style.cssText = "color: rgba(170,185,220,0.5); font-size: 10px; margin-left: 4px;";
    el.appendChild(hint);

    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    el.appendChild(spacer);

    const exitBtn = document.createElement("button");
    exitBtn.textContent = "Exit WB  [Esc]";
    exitBtn.style.cssText = this.btnCss("rgba(220,70,70,0.15)", "#ff9999");
    exitBtn.addEventListener("click", () => this.onExit?.());
    el.appendChild(exitBtn);

    return el;
  }

  private btnCss(bg: string, color: string): string {
    return `
      background: ${bg};
      color: ${color};
      border: 1px solid currentColor;
      border-radius: 3px;
      padding: 4px 10px;
      cursor: pointer;
      font-family: monospace;
      font-size: 11px;
    `.replace(/\n\s+/g, " ").trim();
  }

  private openItemDialog(): void {
    this.closeDialog();

    const el = document.createElement("div");
    el.id = "wb-item-dialog";
    el.style.cssText = `
      position: fixed;
      top: 48px;
      left: 50%;
      transform: translateX(-50%);
      width: 500px;
      max-height: 72vh;
      overflow-y: auto;
      background: rgba(8,12,24,0.98);
      border: 1px solid rgba(100,140,255,0.4);
      border-radius: 6px;
      z-index: 10000;
      padding: 16px 18px 14px;
      font-family: monospace;
      box-shadow: 0 8px 32px rgba(0,0,0,0.7);
    `;

    const title = document.createElement("div");
    title.textContent = "Select Piece to Place";
    title.style.cssText = "color: #88aaff; font-size: 13px; font-weight: bold; margin-bottom: 14px; letter-spacing: 1px;";
    el.appendChild(title);

    const materials: Array<WallPiece["material"]> = ["stone", "wood", "plaster"];
    const types = Object.keys(PIECE_NAMES) as Array<keyof typeof PIECE_NAMES>;

    for (const type of types) {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; gap: 8px; margin-bottom: 7px;";

      const typeLabel = document.createElement("span");
      typeLabel.textContent = PIECE_NAMES[type];
      typeLabel.style.cssText = "color: #b0bcd4; font-size: 11px; width: 120px; flex-shrink: 0;";
      row.appendChild(typeLabel);

      for (const mat of materials) {
        const btn = document.createElement("button");
        btn.textContent = mat;
        btn.style.cssText = this.btnCss("rgba(60,80,120,0.3)", "#c0cce0") + " font-size: 11px; padding: 3px 10px;";
        btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(100,140,255,0.25)"; });
        btn.addEventListener("mouseleave", () => { btn.style.background = "rgba(60,80,120,0.3)"; });
        btn.addEventListener("click", () => {
          const piece: WallPiece = {
            tileX: 0, tileZ: 0,
            type: type as WallPiece["type"],
            material: mat,
          };
          this.onAddItem?.(piece);
          this.closeDialog();
        });
        row.appendChild(btn);
      }
      el.appendChild(row);
    }

    const footer = document.createElement("div");
    footer.style.cssText = "margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(100,140,255,0.15); display: flex; justify-content: flex-end;";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = this.btnCss("rgba(220,70,70,0.12)", "#ff9999");
    cancelBtn.addEventListener("click", () => this.closeDialog());
    footer.appendChild(cancelBtn);
    el.appendChild(footer);

    document.body.appendChild(el);
    this.dialogEl = el;
  }

  closeDialog(): void {
    if (this.dialogEl) {
      this.dialogEl.remove();
      this.dialogEl = null;
    }
  }
}
