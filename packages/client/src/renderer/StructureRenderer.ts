/**
 * Structure Renderer — UO-style wall pieces, one per tile.
 *
 * Each wall piece occupies exactly ONE tile position. No stacking.
 *
 * Wall types (one per tile):
 *   "wall_n"      — wall on the north/left face of the tile (NW edge of diamond)
 *   "wall_e"      — wall on the east/right face of the tile (NE edge of diamond)
 *   "wall_corner" — corner piece: both faces visible from this tile
 *   "wall_n_door" — north wall with door opening
 *   "wall_e_door" — east wall with door opening
 *   "wall_n_win"  — north wall with window
 *   "wall_e_win"  — east wall with window
 *
 * Materials: "stone" | "wood" | "plaster"
 */

import { Container, Graphics } from "pixi.js";
import { worldToScreen, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from "./IsometricRenderer";

const WALL_H = 52;          // One story — taller than player sprite (~40px)
const WALL_DEPTH = 3;       // Visual thickness of the top face

export interface WallPiece {
  tileX: number;
  tileZ: number;
  type: "wall_n" | "wall_e" | "wall_corner" | "wall_n_door" | "wall_e_door" | "wall_n_win" | "wall_e_win";
  material: "stone" | "wood" | "plaster";
}

const PALETTES = {
  stone:   { face: 0x8a8a8a, side: 0x666666, top: 0xaaaaaa, trim: 0x444444, mortar: 0x555555 },
  wood:    { face: 0x7a5c1e, side: 0x5a3c0e, top: 0x9a7c2e, trim: 0x3a2010, mortar: 0x4a3010 },
  plaster: { face: 0xcfbc96, side: 0xaf9c76, top: 0xdfcc96, trim: 0x7a6848, mortar: 0x8a7848 },
};

export class StructureRenderer {
  public container: Container;
  private pieces: Container[] = [];

  constructor() {
    this.container = new Container();
    this.container.sortableChildren = true;
  }

  loadWalls(walls: WallPiece[]): void {
    this.clear();
    for (const wall of walls) {
      const piece = buildPiece(wall);
      if (!piece) continue;
      const { sx, sy } = worldToScreen(wall.tileX, wall.tileZ, 0);
      piece.position.set(sx, sy);
      piece.zIndex = (wall.tileX + wall.tileZ) * 10 + 3;
      this.container.addChild(piece);
      this.pieces.push(piece);
    }
  }

  clear(): void {
    for (const p of this.pieces) p.destroy({ children: true });
    this.pieces = [];
  }

  dispose(): void {
    this.clear();
    this.container.destroy();
  }
}

function buildPiece(wall: WallPiece): Container {
  const c = new Container();
  const pal = PALETTES[wall.material] ?? PALETTES.stone;
  const t = wall.type;

  if (t === "wall_n" || t === "wall_n_door" || t === "wall_n_win") {
    faceN(c, pal, t);
  } else if (t === "wall_e" || t === "wall_e_door" || t === "wall_e_win") {
    faceE(c, pal, t);
  } else if (t === "wall_corner") {
    faceN(c, pal, "wall_n");
    faceE(c, pal, "wall_e");
  }
  return c;
}

/**
 * North (left) face — rises from the NW edge of the tile diamond.
 * Covers left half of the tile.
 */
function faceN(c: Container, pal: typeof PALETTES.stone, type: string) {
  const g = new Graphics();
  const hw = TILE_WIDTH_HALF;   // 32
  const hh = TILE_HEIGHT_HALF;  // 16

  // Wall face: left edge of the isometric diamond, extruded upward
  g.poly([
    { x: -hw, y: 0 },
    { x: 0,   y: -hh },
    { x: 0,   y: -hh - WALL_H },
    { x: -hw, y: -WALL_H },
  ]);
  g.fill(pal.face);

  // Top cap (thin depth strip, lighter)
  g.poly([
    { x: -hw, y: -WALL_H },
    { x: 0,   y: -hh - WALL_H },
    { x: WALL_DEPTH, y: -hh - WALL_H + WALL_DEPTH },
    { x: -hw + WALL_DEPTH, y: -WALL_H + WALL_DEPTH },
  ]);
  g.fill(pal.top);

  // Outline
  g.moveTo(-hw, 0);
  g.lineTo(0, -hh);
  g.lineTo(0, -hh - WALL_H);
  g.lineTo(-hw, -WALL_H);
  g.lineTo(-hw, 0);
  g.stroke({ width: 1, color: pal.trim, alpha: 0.6 });

  // Brick/plank detail
  addDetail(g, pal, "n");

  // Opening
  if (type === "wall_n_door") {
    // Door: bottom of wall, 60% width, 75% height
    const dw = hw * 0.5, dh = WALL_H * 0.75;
    g.poly([
      { x: -hw * 0.7,       y: 0 },
      { x: -hw * 0.7 + dw * 0.45, y: -hh * 0.35 },
      { x: -hw * 0.7 + dw * 0.45, y: -hh * 0.35 - dh },
      { x: -hw * 0.7,       y: -dh },
    ]);
    g.fill(0x1a1008);
  } else if (type === "wall_n_win") {
    // Window: mid-height, 40% width
    const wx = -hw * 0.65, wy = -WALL_H * 0.35;
    g.poly([
      { x: wx,             y: wy },
      { x: wx + hw * 0.35, y: wy - hh * 0.28 },
      { x: wx + hw * 0.35, y: wy - hh * 0.28 - WALL_H * 0.3 },
      { x: wx,             y: wy - WALL_H * 0.3 },
    ]);
    g.fill(0x88bbdd);
  }

  c.addChild(g);
}

/**
 * East (right) face — rises from the NE edge of the tile diamond.
 * Covers right half of the tile.
 */
function faceE(c: Container, pal: typeof PALETTES.stone, type: string) {
  const g = new Graphics();
  const hw = TILE_WIDTH_HALF;
  const hh = TILE_HEIGHT_HALF;

  // Wall face: right edge, extruded upward. Slightly darker for depth.
  g.poly([
    { x: 0,  y: -hh },
    { x: hw, y: 0 },
    { x: hw, y: -WALL_H },
    { x: 0,  y: -hh - WALL_H },
  ]);
  g.fill(pal.side);

  // Top cap
  g.poly([
    { x: 0,  y: -hh - WALL_H },
    { x: hw, y: -WALL_H },
    { x: hw - WALL_DEPTH, y: -WALL_H + WALL_DEPTH },
    { x: -WALL_DEPTH, y: -hh - WALL_H + WALL_DEPTH },
  ]);
  g.fill(pal.top);

  // Outline
  g.moveTo(0, -hh);
  g.lineTo(hw, 0);
  g.lineTo(hw, -WALL_H);
  g.lineTo(0, -hh - WALL_H);
  g.lineTo(0, -hh);
  g.stroke({ width: 1, color: pal.trim, alpha: 0.6 });

  addDetail(g, pal, "e");

  if (type === "wall_e_door") {
    const dw = hw * 0.5, dh = WALL_H * 0.75;
    g.poly([
      { x: hw * 0.3,       y: -hh * 0.3 + hh * 0.35 },
      { x: hw * 0.3 + dw * 0.45, y: 0 },
      { x: hw * 0.3 + dw * 0.45, y: -dh },
      { x: hw * 0.3,       y: -hh * 0.3 + hh * 0.35 - dh },
    ]);
    g.fill(0x1a1008);
  } else if (type === "wall_e_win") {
    const wx = hw * 0.3, wy = -WALL_H * 0.35;
    g.poly([
      { x: wx,             y: wy + hh * 0.25 },
      { x: wx + hw * 0.35, y: wy },
      { x: wx + hw * 0.35, y: wy - WALL_H * 0.3 },
      { x: wx,             y: wy + hh * 0.25 - WALL_H * 0.3 },
    ]);
    g.fill(0x88bbdd);
  }

  c.addChild(g);
}

function addDetail(g: Graphics, pal: typeof PALETTES.stone, side: "n" | "e") {
  const hw = TILE_WIDTH_HALF, hh = TILE_HEIGHT_HALF;
  if (pal === PALETTES.stone) {
    // Horizontal mortar lines
    for (let i = 1; i <= 3; i++) {
      const y = -(WALL_H * i) / 4;
      if (side === "n") {
        g.moveTo(-hw, y); g.lineTo(0, y - hh);
      } else {
        g.moveTo(0, y - hh); g.lineTo(hw, y);
      }
      g.stroke({ width: 0.5, color: pal.mortar, alpha: 0.4 });
    }
  } else if (pal === PALETTES.wood) {
    // Vertical planks
    for (let i = 1; i <= 3; i++) {
      if (side === "n") {
        const x = -hw + (hw * i) / 4;
        const dx = (hh * i) / 4;
        g.moveTo(x, 0); g.lineTo(x, -WALL_H);
      } else {
        const x = (hw * i) / 4;
        g.moveTo(x, 0); g.lineTo(x, -WALL_H);
      }
      g.stroke({ width: 0.5, color: pal.mortar, alpha: 0.4 });
    }
  }
}

/**
 * Build wall pieces for a rectangular house footprint.
 * All four sides, one tile per wall piece, no overlaps at corners.
 *
 * @param x0,z0  Top-left corner tile
 * @param w      Width in tiles (interior)
 * @param d      Depth in tiles (interior)
 */
export function makeHouse(
  x0: number, z0: number,
  w: number, d: number,
  mat: WallPiece["material"] = "stone",
  doorWall: "n" | "e" | "s" | "w" = "s",
  doorTile = Math.floor(w / 2),
): WallPiece[] {
  const pieces: WallPiece[] = [];

  // The perimeter is (w+2) × (d+2). Corners are where rows/columns meet.
  // We use NW corner = (x0-1, z0-1) ... SE corner = (x0+w, z0+d)
  // But simpler: walls run along x0..x0+w-1 (north/south) and z0..z0+d-1 (east/west)
  // Corners live at (x0-1,z0-1), (x0+w,z0-1), (x0-1,z0+d), (x0+w,z0+d)

  const x1 = x0 + w - 1;  // last interior column
  const z1 = z0 + d - 1;  // last interior row

  // North wall row: constant Z (z0-1), runs along X axis.
  // +X goes screen lower-right, so this row faces the NE edge → wall_e
  for (let x = x0; x <= x1; x++) {
    const isDoor = doorWall === "n" && x === x0 + doorTile;
    pieces.push({ tileX: x, tileZ: z0 - 1, material: mat, type: isDoor ? "wall_e_door" : "wall_e" });
  }

  // South wall row: constant Z (z0+d), runs along X axis → wall_e
  for (let x = x0; x <= x1; x++) {
    const isDoor = doorWall === "s" && x === x0 + doorTile;
    const isWin = !isDoor && x % 2 === 1;
    pieces.push({ tileX: x, tileZ: z0 + d, material: mat, type: isDoor ? "wall_e_door" : isWin ? "wall_e_win" : "wall_e" });
  }

  // West wall column: constant X (x0-1), runs along Z axis.
  // +Z goes screen lower-left, so this column faces the NW edge → wall_n
  for (let z = z0; z <= z1; z++) {
    const isDoor = doorWall === "w" && z === z0 + Math.floor(d / 2);
    const isWin = !isDoor && z % 2 === 0;
    pieces.push({ tileX: x0 - 1, tileZ: z, material: mat, type: isDoor ? "wall_n_door" : isWin ? "wall_n_win" : "wall_n" });
  }

  // East wall column: constant X (x0+w), runs along Z axis → wall_n
  for (let z = z0; z <= z1; z++) {
    const isDoor = doorWall === "e" && z === z0 + Math.floor(d / 2);
    const isWin = !isDoor && z % 2 === 0;
    pieces.push({ tileX: x0 + w, tileZ: z, material: mat, type: isDoor ? "wall_n_door" : isWin ? "wall_n_win" : "wall_n" });
  }

  // Four corners — each gets its own tile with a corner piece
  pieces.push({ tileX: x0 - 1, tileZ: z0 - 1, material: mat, type: "wall_corner" });
  pieces.push({ tileX: x0 + w, tileZ: z0 - 1, material: mat, type: "wall_corner" });
  pieces.push({ tileX: x0 - 1, tileZ: z0 + d, material: mat, type: "wall_corner" });
  pieces.push({ tileX: x0 + w, tileZ: z0 + d, material: mat, type: "wall_corner" });

  return pieces;
}
