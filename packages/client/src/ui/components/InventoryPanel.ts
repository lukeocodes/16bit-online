/**
 * Inventory panel — shows bag contents, equipment slots, item tooltips.
 * Toggled by 'I' key. Equipment slots on left, bag grid on right.
 */

export interface InventoryItem {
  id: string;
  itemId: string;
  name: string;
  icon: string;
  type: string;
  quantity: number;
  equipped: boolean;
  slot: string | null;
}

export class InventoryPanel {
  private container: HTMLElement;
  private bagGrid: HTMLElement;
  private equipSlots: HTMLElement;
  private visible = false;
  private items: InventoryItem[] = [];

  private onEquip: ((itemId: string) => void) | null = null;
  private onUnequip: ((itemId: string) => void) | null = null;
  private onUseItem: ((itemId: string) => void) | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 480px; max-height: 500px; background: #16213eee; border: 2px solid #444;
      border-radius: 10px; padding: 16px; pointer-events: auto; display: none;
      font-family: 'Segoe UI', system-ui, sans-serif; color: #e0e0e0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;";
    const title = document.createElement("h3");
    title.textContent = "Inventory";
    title.style.cssText = "margin:0; font-size:16px; color:#88ddff;";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background:none; border:none; color:#888; font-size:18px; cursor:pointer;";
    closeBtn.onclick = () => this.toggle();
    header.appendChild(title);
    header.appendChild(closeBtn);
    this.container.appendChild(header);

    // Body: equip slots (left) + bag (right)
    const body = document.createElement("div");
    body.style.cssText = "display:flex; gap:12px;";

    // Equipment slots
    this.equipSlots = document.createElement("div");
    this.equipSlots.style.cssText = "width:120px; display:flex; flex-direction:column; gap:4px;";
    const slotNames = ["weapon", "head", "chest", "legs", "feet", "ring", "trinket"];
    for (const slotName of slotNames) {
      const slot = document.createElement("div");
      slot.dataset.slot = slotName;
      slot.style.cssText = `
        height:32px; background:#0a0a1a88; border:1px solid #333; border-radius:4px;
        display:flex; align-items:center; padding:0 8px; font-size:11px; color:#666;
        cursor:pointer; transition: border-color 0.15s;
      `;
      slot.textContent = slotName.charAt(0).toUpperCase() + slotName.slice(1);
      slot.onmouseenter = () => slot.style.borderColor = "#88ddff";
      slot.onmouseleave = () => slot.style.borderColor = "#333";
      this.equipSlots.appendChild(slot);
    }
    body.appendChild(this.equipSlots);

    // Bag grid
    this.bagGrid = document.createElement("div");
    this.bagGrid.style.cssText = `
      flex:1; display:grid; grid-template-columns: repeat(5, 1fr); gap:4px;
      max-height:350px; overflow-y:auto;
    `;
    body.appendChild(this.bagGrid);

    this.container.appendChild(body);
  }

  getElement(): HTMLElement { return this.container; }

  setOnEquip(handler: (itemId: string) => void) { this.onEquip = handler; }
  setOnUnequip(handler: (itemId: string) => void) { this.onUnequip = handler; }
  setOnUseItem(handler: (itemId: string) => void) { this.onUseItem = handler; }

  toggle(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? "block" : "none";
    if (this.visible) this.render();
  }

  isVisible(): boolean { return this.visible; }

  updateItems(items: InventoryItem[]): void {
    this.items = items;
    if (this.visible) this.render();
  }

  private render(): void {
    // Update equipment slots
    const equipped = this.items.filter(i => i.equipped);
    for (const slotEl of this.equipSlots.children) {
      const el = slotEl as HTMLElement;
      const slotName = el.dataset.slot!;
      const item = equipped.find(i => i.slot === slotName);
      if (item) {
        el.innerHTML = `<span style="margin-right:4px">${item.icon}</span><span style="font-size:10px;color:#ccc">${item.name}</span>`;
        el.style.borderColor = "#4488cc";
        el.onclick = () => this.onUnequip?.(item.id);
        el.title = `${item.name} (click to unequip)`;
      } else {
        el.textContent = slotName.charAt(0).toUpperCase() + slotName.slice(1);
        el.style.borderColor = "#333";
        el.onclick = null;
        el.title = `Empty ${slotName} slot`;
      }
    }

    // Update bag grid
    this.bagGrid.innerHTML = "";
    const bagItems = this.items.filter(i => !i.equipped);
    for (const item of bagItems) {
      const cell = document.createElement("div");
      cell.style.cssText = `
        width:52px; height:52px; background:#0a0a1a88; border:1px solid #333;
        border-radius:4px; display:flex; flex-direction:column;
        align-items:center; justify-content:center; cursor:pointer;
        transition: border-color 0.15s; position:relative; user-select:none;
      `;
      cell.innerHTML = `
        <span style="font-size:20px">${item.icon}</span>
        <span style="font-size:8px;color:#888;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.name}</span>
      `;
      if (item.quantity > 1) {
        const qty = document.createElement("span");
        qty.textContent = `${item.quantity}`;
        qty.style.cssText = "position:absolute; bottom:2px; right:4px; font-size:9px; color:#aaa;";
        cell.appendChild(qty);
      }
      cell.onmouseenter = () => cell.style.borderColor = "#88ddff";
      cell.onmouseleave = () => cell.style.borderColor = "#333";
      cell.title = `${item.name}${item.type === "consumable" ? " (click to use)" : item.type === "weapon" || item.type === "armor" ? " (click to equip)" : ""}`;
      cell.onclick = () => {
        if (item.type === "consumable") {
          this.onUseItem?.(item.id);
        } else if (item.type === "weapon" || item.type === "armor") {
          this.onEquip?.(item.id);
        }
      };
      this.bagGrid.appendChild(cell);
    }

    // Empty slots to fill grid
    const emptyCount = Math.max(0, 20 - bagItems.length);
    for (let i = 0; i < emptyCount; i++) {
      const cell = document.createElement("div");
      cell.style.cssText = `
        width:52px; height:52px; background:#0a0a1a44; border:1px solid #222;
        border-radius:4px;
      `;
      this.bagGrid.appendChild(cell);
    }
  }
}
