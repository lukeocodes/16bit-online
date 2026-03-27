/**
 * Structure Renderer — draws buildings, walls, and other structures on the world.
 *
 * Structures are defined as Tiled object-layer entries with type "structure".
 * Each structure type maps to a drawing function that creates a composite
 * PixiJS Container with Graphics children.
 */

import { Container, Graphics } from "pixi.js";
import { worldToScreen } from "./IsometricRenderer";

export interface StructureDef {
  type: string;
  tileX: number;
  tileZ: number;
  width: number;   // tiles
  height: number;  // tiles
  name?: string;
}

type DrawFn = (def: StructureDef) => Container;

const DRAW_FNS: Record<string, DrawFn> = {
  "wall_stone": drawStoneWall,
  "wall_wood": drawWoodWall,
  "house_small": drawSmallHouse,
  "house_large": drawLargeHouse,
  "tower": drawTower,
  "well": drawWell,
  "market_stall": drawMarketStall,
  "gate": drawGate,
};

export class StructureRenderer {
  public container: Container;
  private structures: Container[] = [];

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;
  }

  /** Build structures from parsed Tiled object data */
  loadStructures(defs: StructureDef[]): void {
    this.clear();
    for (const def of defs) {
      const drawFn = DRAW_FNS[def.type];
      if (!drawFn) continue;

      const struct = drawFn(def);
      const { sx, sy } = worldToScreen(def.tileX, def.tileZ, 0);
      struct.position.set(sx, sy);
      struct.zIndex = (def.tileX + def.tileZ) * 10 + 5; // Slightly above ground
      this.container.addChild(struct);
      this.structures.push(struct);
    }
  }

  clear(): void {
    for (const s of this.structures) s.destroy({ children: true });
    this.structures = [];
  }

  dispose(): void {
    this.clear();
    this.container.destroy();
  }
}

// --- Structure drawing functions ---

function drawStoneWall(def: StructureDef): Container {
  const c = new Container();
  const widthPx = def.width * 32; // Half-tile width in iso
  const g = new Graphics();
  // Wall face
  g.rect(-widthPx / 2, -20, widthPx, 20);
  g.fill(0x888888);
  g.stroke({ width: 1, color: 0x555555 });
  // Wall top (lighter)
  g.rect(-widthPx / 2, -24, widthPx, 4);
  g.fill(0xaaaaaa);
  // Brick lines
  for (let i = 0; i < widthPx; i += 8) {
    g.moveTo(-widthPx / 2 + i, -10);
    g.lineTo(-widthPx / 2 + i, 0);
    g.stroke({ width: 0.5, color: 0x666666, alpha: 0.3 });
  }
  c.addChild(g);
  return c;
}

function drawWoodWall(def: StructureDef): Container {
  const c = new Container();
  const widthPx = def.width * 32;
  const g = new Graphics();
  g.rect(-widthPx / 2, -18, widthPx, 18);
  g.fill(0x8B6914);
  g.stroke({ width: 1, color: 0x5a4510 });
  // Vertical planks
  for (let i = 0; i < widthPx; i += 6) {
    g.moveTo(-widthPx / 2 + i, -18);
    g.lineTo(-widthPx / 2 + i, 0);
    g.stroke({ width: 0.5, color: 0x6B5314, alpha: 0.4 });
  }
  c.addChild(g);
  return c;
}

function drawSmallHouse(_def: StructureDef): Container {
  const c = new Container();
  const g = new Graphics();
  // Walls
  g.rect(-20, -28, 40, 28);
  g.fill(0xd4c4a0);
  g.stroke({ width: 1, color: 0x8B7B58 });
  // Roof (triangle)
  g.poly([{ x: -24, y: -28 }, { x: 0, y: -44 }, { x: 24, y: -28 }]);
  g.fill(0x8B4513);
  g.stroke({ width: 1, color: 0x5a2d0c });
  // Door
  g.rect(-4, -12, 8, 12);
  g.fill(0x5a3810);
  // Window
  g.rect(10, -22, 6, 6);
  g.fill(0x88bbdd);
  g.stroke({ width: 0.5, color: 0x445566 });
  c.addChild(g);
  return c;
}

function drawLargeHouse(_def: StructureDef): Container {
  const c = new Container();
  const g = new Graphics();
  // Walls
  g.rect(-30, -36, 60, 36);
  g.fill(0xd4c4a0);
  g.stroke({ width: 1, color: 0x8B7B58 });
  // Roof
  g.poly([{ x: -34, y: -36 }, { x: 0, y: -56 }, { x: 34, y: -36 }]);
  g.fill(0x8B4513);
  g.stroke({ width: 1, color: 0x5a2d0c });
  // Door
  g.rect(-5, -16, 10, 16);
  g.fill(0x5a3810);
  // Windows (2)
  g.rect(-22, -28, 8, 8);
  g.fill(0x88bbdd);
  g.stroke({ width: 0.5, color: 0x445566 });
  g.rect(14, -28, 8, 8);
  g.fill(0x88bbdd);
  g.stroke({ width: 0.5, color: 0x445566 });
  // Chimney
  g.rect(16, -52, 6, 16);
  g.fill(0x777777);
  c.addChild(g);
  return c;
}

function drawTower(_def: StructureDef): Container {
  const c = new Container();
  const g = new Graphics();
  // Tower body
  g.rect(-12, -50, 24, 50);
  g.fill(0x999999);
  g.stroke({ width: 1, color: 0x666666 });
  // Battlements
  for (let i = -12; i < 12; i += 6) {
    g.rect(i, -56, 4, 6);
    g.fill(0x888888);
  }
  // Arrow slit
  g.rect(-1, -35, 2, 8);
  g.fill(0x222222);
  // Door
  g.roundRect(-4, -12, 8, 12, 4);
  g.fill(0x5a3810);
  c.addChild(g);
  return c;
}

function drawWell(_def: StructureDef): Container {
  const c = new Container();
  const g = new Graphics();
  // Stone ring
  g.ellipse(0, 0, 10, 6);
  g.fill(0x888888);
  g.stroke({ width: 1, color: 0x555555 });
  // Water inside
  g.ellipse(0, 0, 7, 4);
  g.fill(0x4488cc);
  // Support posts
  g.rect(-8, -16, 2, 16);
  g.fill(0x6B5314);
  g.rect(6, -16, 2, 16);
  g.fill(0x6B5314);
  // Crossbar
  g.rect(-8, -16, 16, 2);
  g.fill(0x6B5314);
  c.addChild(g);
  return c;
}

function drawMarketStall(_def: StructureDef): Container {
  const c = new Container();
  const g = new Graphics();
  // Counter
  g.rect(-16, -8, 32, 8);
  g.fill(0x8B6914);
  g.stroke({ width: 1, color: 0x5a4510 });
  // Canopy (colored cloth)
  g.poly([{ x: -20, y: -24 }, { x: 20, y: -24 }, { x: 16, y: -8 }, { x: -16, y: -8 }]);
  g.fill(0xcc4444);
  g.stroke({ width: 1, color: 0x882222 });
  // Support poles
  g.rect(-16, -24, 2, 24);
  g.fill(0x6B5314);
  g.rect(14, -24, 2, 24);
  g.fill(0x6B5314);
  // Goods on counter
  g.circle(-6, -10, 3);
  g.fill(0xddaa44);
  g.circle(2, -10, 2);
  g.fill(0x44aa44);
  g.circle(8, -10, 2.5);
  g.fill(0xaa4444);
  c.addChild(g);
  return c;
}

function drawGate(_def: StructureDef): Container {
  const c = new Container();
  const g = new Graphics();
  // Left pillar
  g.rect(-18, -40, 8, 40);
  g.fill(0x888888);
  g.stroke({ width: 1, color: 0x555555 });
  // Right pillar
  g.rect(10, -40, 8, 40);
  g.fill(0x888888);
  g.stroke({ width: 1, color: 0x555555 });
  // Arch
  g.arc(0, -30, 14, Math.PI, 0, false);
  g.stroke({ width: 3, color: 0x888888 });
  // Gate bars
  for (let i = -10; i <= 10; i += 4) {
    g.moveTo(i, -30);
    g.lineTo(i, 0);
    g.stroke({ width: 1, color: 0x444444, alpha: 0.6 });
  }
  c.addChild(g);
  return c;
}
