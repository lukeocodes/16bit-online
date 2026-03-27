import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { worldToScreen } from "./IsometricRenderer";

export interface WorldItemData {
  id: string;
  zoneId: string;
  tileX: number;
  tileZ: number;
  itemId: string;
  quantity: number;
  name: string;
  icon: string;
}

const ITEM_COLOR = 0xffe066;       // gold diamond
const ITEM_BORDER = 0xaa7700;
const DIAMOND_R = 10;              // half-width of the diamond

export class WorldItemRenderer {
  public container: Container;

  // id → display object
  private items = new Map<string, Container>();

  // id → data (for hit testing)
  private itemData = new Map<string, WorldItemData>();

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;
  }

  addItem(data: WorldItemData): void {
    if (this.items.has(data.id)) return;

    const c = new Container();
    const { sx, sy } = worldToScreen(data.tileX, data.tileZ, 0);

    // Diamond outline
    const g = new Graphics();
    g.poly([
      { x: 0, y: -DIAMOND_R },
      { x: DIAMOND_R, y: 0 },
      { x: 0, y: DIAMOND_R },
      { x: -DIAMOND_R, y: 0 },
    ]);
    g.fill(ITEM_COLOR);
    g.poly([
      { x: 0, y: -DIAMOND_R },
      { x: DIAMOND_R, y: 0 },
      { x: 0, y: DIAMOND_R },
      { x: -DIAMOND_R, y: 0 },
    ]);
    g.stroke({ width: 1.5, color: ITEM_BORDER });

    // Icon label
    const label = new Text({
      text: data.icon,
      style: new TextStyle({ fontSize: 11, fill: 0xffffff }),
    });
    label.anchor.set(0.5, 0.5);
    label.y = -DIAMOND_R - 8;

    c.addChild(g);
    c.addChild(label);
    c.position.set(sx, sy);
    c.zIndex = (data.tileX + data.tileZ) * 10 + 1;

    // Make interactive for click-to-pickup
    c.eventMode = "static";
    c.cursor = "pointer";

    this.container.addChild(c);
    this.items.set(data.id, c);
    this.itemData.set(data.id, data);
  }

  removeItem(id: string): void {
    const c = this.items.get(id);
    if (c) {
      c.destroy();
      this.items.delete(id);
      this.itemData.delete(id);
    }
  }

  setItems(items: WorldItemData[]): void {
    // Clear all then add
    for (const id of this.items.keys()) this.removeItem(id);
    for (const item of items) this.addItem(item);
  }

  /** Returns item id if the given screen coords hit an item, otherwise null */
  hitTest(screenX: number, screenY: number): string | null {
    for (const [id, c] of this.items) {
      const dx = screenX - c.x;
      const dy = screenY - c.y;
      // Diamond hit test: |dx|/R + |dy|/R <= 1
      if (Math.abs(dx) / DIAMOND_R + Math.abs(dy) / DIAMOND_R <= 1.4) {
        return id;
      }
    }
    return null;
  }

  getItemData(id: string): WorldItemData | undefined {
    return this.itemData.get(id);
  }

  dispose(): void {
    for (const id of [...this.items.keys()]) this.removeItem(id);
    this.container.destroy();
  }
}
