/**
 * Structure Renderer — 3D wall pieces and corner posts.
 *
 * Each piece is a proper 3D rectangular prism:
 *   - Wall:  outer face + inner face + top face. Depth = WALL_DEPTH.
 *   - Post:  left face + right face + top cap.  Width = POST_W.
 *
 * Wall types:
 *   "wall_left"       — NW-facing wall panel (\ edge of tile)
 *   "wall_right"      — NE-facing wall panel (/ edge of tile)
 *   "wall_corner"     — square corner post
 *   "wall_left_door"  — NW wall with door opening (frame only)
 *   "wall_right_door" — NE wall with door opening (frame only)
 *   "wall_left_win"   — NW wall with window hole
 *   "wall_right_win"  — NE wall with window hole
 *
 * Materials: "stone" | "wood" | "plaster"
 */

import { Container, Graphics } from "pixi.js";
import { worldToScreen, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from "./IsometricRenderer";

const WALL_H    = 52;  // height of one storey
const WALL_DEPTH = 4;  // 3D thickness of wall (top face depth in screen px)
const POST_W    = 14;  // corner post half-width
const POST_H    = 7;   // corner post iso height (POST_W * TILE_HEIGHT_HALF / TILE_WIDTH_HALF)

// Depth direction vectors (how far the inner face is offset from the outer face)
// wall_left  (NW face): depth goes toward +x world → screen (+1, +0.5) per unit
// wall_right (NE face): depth goes toward -x world → screen (-1, +0.5) per unit
const L_DX = WALL_DEPTH,  L_DY = WALL_DEPTH / 2;   // left  wall depth shift
const R_DX = -WALL_DEPTH, R_DY = WALL_DEPTH / 2;   // right wall depth shift

export interface WallPiece {
  tileX: number;
  tileZ: number;
  type: "wall_left" | "wall_right" | "wall_corner"
      | "wall_left_door"  | "wall_right_door"
      | "wall_left_win"   | "wall_right_win";
  material: "stone" | "wood" | "plaster";
}

const PALETTES = {
  stone:   { face: 0x8a8a8a, inner: 0x7a7a7a, side: 0x666666, top: 0xaaaaaa, trim: 0x444444, mortar: 0x555555 },
  wood:    { face: 0x7a5c1e, inner: 0x6a4c0e, side: 0x5a3c0e, top: 0x9a7c2e, trim: 0x3a2010, mortar: 0x4a3010 },
  plaster: { face: 0xcfbc96, inner: 0xbfac86, side: 0xaf9c76, top: 0xdfcc96, trim: 0x7a6848, mortar: 0x8a7848 },
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
  const c   = new Container();
  const pal = PALETTES[wall.material] ?? PALETTES.stone;
  const t   = wall.type;

  if (t === "wall_left" || t === "wall_left_door" || t === "wall_left_win")
    drawLeft(c, pal, t);
  else if (t === "wall_right" || t === "wall_right_door" || t === "wall_right_win")
    drawRight(c, pal, t);
  else if (t === "wall_corner")
    drawPost(c, pal);

  return c;
}

// ─── NW-facing wall piece ────────────────────────────────────────────────────

function drawLeft(c: Container, pal: typeof PALETTES.stone, type: string) {
  const g  = new Graphics();
  const hw = TILE_WIDTH_HALF;   // 32
  const hh = TILE_HEIGHT_HALF;  // 16

  if (type === "wall_left_door") {
    const fw = 3;
    // Left post
    g.poly([{ x: -hw, y: 0 }, { x: -hw+fw, y: -fw*.5 },
            { x: -hw+fw, y: -WALL_H }, { x: -hw, y: -WALL_H }]);
    g.fill(pal.face);
    // Right post
    g.poly([{ x: -fw*2, y: -hh+fw }, { x: 0, y: -hh },
            { x: 0, y: -WALL_H }, { x: -fw*2, y: -WALL_H+fw }]);
    g.fill(pal.face);
    // Lintel
    g.poly([{ x: -hw, y: -WALL_H }, { x: 0, y: -hh-WALL_H },
            { x: 0, y: -hh-WALL_H+fw*2 }, { x: -hw, y: -WALL_H+fw*2 }]);
    g.fill(pal.face);
    topCapLeft(g, pal);
    c.addChild(g);
    return;
  }

  if (type === "wall_left_win") {
    const wT = WALL_H * .6, wB = WALL_H * .25, wL = .3, wR = .7;
    const lx = (t: number) => -hw + hw * t;
    const ly = (t: number) => -hh * t;
    g.poly([{ x: -hw, y: 0 }, { x: 0, y: -hh }, { x: 0, y: -hh-wB }, { x: -hw, y: -wB }]);           g.fill(pal.face);
    g.poly([{ x: -hw, y: -wT }, { x: 0, y: -hh-wT }, { x: 0, y: -hh-WALL_H }, { x: -hw, y: -WALL_H }]); g.fill(pal.face);
    g.poly([{ x: -hw, y: -wB }, { x: lx(wL), y: ly(wL)-wB }, { x: lx(wL), y: ly(wL)-wT }, { x: -hw, y: -wT }]); g.fill(pal.face);
    g.poly([{ x: lx(wR), y: ly(wR)-wB }, { x: 0, y: -hh-wB }, { x: 0, y: -hh-wT }, { x: lx(wR), y: ly(wR)-wT }]); g.fill(pal.face);
    g.moveTo(lx(wL), ly(wL)-wB); g.lineTo(lx(wR), ly(wR)-wB);
    g.lineTo(lx(wR), ly(wR)-wT); g.lineTo(lx(wL), ly(wL)-wT); g.lineTo(lx(wL), ly(wL)-wB);
    g.stroke({ width: 1.5, color: pal.trim });
    topCapLeft(g, pal);
    addDetail(g, pal, "left");
    c.addChild(g);
    return;
  }

  // ── Solid wall: outer face + top + inner face ──
  // Outer face
  g.poly([{ x: -hw, y: 0 }, { x: 0, y: -hh },
          { x: 0, y: -hh-WALL_H }, { x: -hw, y: -WALL_H }]);
  g.fill(pal.face);

  // Top face (depth strip)
  g.poly([{ x: -hw, y: -WALL_H },          { x: 0, y: -hh-WALL_H },
          { x: L_DX, y: -hh-WALL_H+L_DY }, { x: -hw+L_DX, y: -WALL_H+L_DY }]);
  g.fill(pal.top);

  // Inner face (inside of building)
  g.poly([{ x: -hw+L_DX, y:    L_DY }, { x: L_DX, y: -hh+L_DY },
          { x: L_DX,    y: -hh-WALL_H+L_DY }, { x: -hw+L_DX, y: -WALL_H+L_DY }]);
  g.fill(pal.inner);

  // Outer edge outline
  g.moveTo(-hw, 0); g.lineTo(0, -hh); g.lineTo(0, -hh-WALL_H); g.lineTo(-hw, -WALL_H); g.lineTo(-hw, 0);
  g.stroke({ width: 1, color: pal.trim, alpha: 0.6 });

  addDetail(g, pal, "left");
  c.addChild(g);
}

// ─── NE-facing wall piece ────────────────────────────────────────────────────

function drawRight(c: Container, pal: typeof PALETTES.stone, type: string) {
  const g  = new Graphics();
  const hw = TILE_WIDTH_HALF;
  const hh = TILE_HEIGHT_HALF;

  if (type === "wall_right_door") {
    const fw = 3;
    g.poly([{ x: 0, y: -hh }, { x: fw*2, y: -hh+fw },
            { x: fw*2, y: -WALL_H+fw }, { x: 0, y: -WALL_H }]);
    g.fill(pal.side);
    g.poly([{ x: hw-fw, y: -fw*.5 }, { x: hw, y: 0 },
            { x: hw, y: -WALL_H }, { x: hw-fw, y: -WALL_H }]);
    g.fill(pal.side);
    g.poly([{ x: 0, y: -hh-WALL_H }, { x: hw, y: -WALL_H },
            { x: hw, y: -WALL_H+fw*2 }, { x: 0, y: -hh-WALL_H+fw*2 }]);
    g.fill(pal.side);
    topCapRight(g, pal);
    c.addChild(g);
    return;
  }

  if (type === "wall_right_win") {
    const wT = WALL_H * .6, wB = WALL_H * .25, wL = .3, wR = .7;
    const lx = (t: number) => hw * t;
    const ly = (t: number) => -hh * t;
    g.poly([{ x: 0, y: -hh }, { x: hw, y: 0 }, { x: hw, y: -wB }, { x: 0, y: -hh-wB }]); g.fill(pal.side);
    g.poly([{ x: 0, y: -hh-wT }, { x: hw, y: -wT }, { x: hw, y: -WALL_H }, { x: 0, y: -hh-WALL_H }]); g.fill(pal.side);
    g.poly([{ x: 0, y: -hh-wB }, { x: lx(wL), y: ly(wL)-wB }, { x: lx(wL), y: ly(wL)-wT }, { x: 0, y: -hh-wT }]); g.fill(pal.side);
    g.poly([{ x: lx(wR), y: ly(wR)-wB }, { x: hw, y: -wB }, { x: hw, y: -wT }, { x: lx(wR), y: ly(wR)-wT }]); g.fill(pal.side);
    g.moveTo(lx(wL), ly(wL)-wB); g.lineTo(lx(wR), ly(wR)-wB);
    g.lineTo(lx(wR), ly(wR)-wT); g.lineTo(lx(wL), ly(wL)-wT); g.lineTo(lx(wL), ly(wL)-wB);
    g.stroke({ width: 1.5, color: pal.trim });
    topCapRight(g, pal);
    addDetail(g, pal, "right");
    c.addChild(g);
    return;
  }

  // ── Solid wall: outer face + top + inner face ──
  // Outer face
  g.poly([{ x: 0, y: -hh }, { x: hw, y: 0 },
          { x: hw, y: -WALL_H }, { x: 0, y: -hh-WALL_H }]);
  g.fill(pal.side);

  // Top face (depth strip)
  g.poly([{ x: 0, y: -hh-WALL_H },          { x: hw, y: -WALL_H },
          { x: hw+R_DX, y: -WALL_H+R_DY },   { x: R_DX, y: -hh-WALL_H+R_DY }]);
  g.fill(pal.top);

  // Inner face
  g.poly([{ x: R_DX, y: -hh+R_DY }, { x: hw+R_DX, y: R_DY },
          { x: hw+R_DX, y: -WALL_H+R_DY }, { x: R_DX, y: -hh-WALL_H+R_DY }]);
  g.fill(pal.inner);

  // Outer edge outline
  g.moveTo(0, -hh); g.lineTo(hw, 0); g.lineTo(hw, -WALL_H); g.lineTo(0, -hh-WALL_H); g.lineTo(0, -hh);
  g.stroke({ width: 1, color: pal.trim, alpha: 0.6 });

  addDetail(g, pal, "right");
  c.addChild(g);
}

// ─── Corner post ─────────────────────────────────────────────────────────────

function drawPost(c: Container, pal: typeof PALETTES.stone) {
  const g = new Graphics();

  // Left face (NW)
  g.poly([{ x: -POST_W, y: 0 }, { x: 0, y: -POST_H },
          { x: 0, y: -POST_H-WALL_H }, { x: -POST_W, y: -WALL_H }]);
  g.fill(pal.face);

  // Right face (NE)
  g.poly([{ x: 0, y: -POST_H }, { x: POST_W, y: 0 },
          { x: POST_W, y: -WALL_H }, { x: 0, y: -POST_H-WALL_H }]);
  g.fill(pal.side);

  // Top diamond cap
  g.poly([{ x: -POST_W, y: -WALL_H }, { x: 0, y: -POST_H-WALL_H },
          { x: POST_W, y: -WALL_H }, { x: 0, y: POST_H-WALL_H }]);
  g.fill(pal.top);

  // Crisp outlines
  g.moveTo(-POST_W, 0); g.lineTo(0, -POST_H); g.lineTo(POST_W, 0);
  g.moveTo(-POST_W, -WALL_H); g.lineTo(0, -POST_H-WALL_H); g.lineTo(POST_W, -WALL_H);
  g.moveTo(-POST_W, 0); g.lineTo(-POST_W, -WALL_H);
  g.moveTo(POST_W,  0); g.lineTo(POST_W,  -WALL_H);
  g.moveTo(0, -POST_H); g.lineTo(0, -POST_H-WALL_H);
  g.stroke({ width: 1.5, color: pal.trim });

  c.addChild(g);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function topCapLeft(g: Graphics, pal: typeof PALETTES.stone) {
  const hw = TILE_WIDTH_HALF, hh = TILE_HEIGHT_HALF;
  g.poly([{ x: -hw, y: -WALL_H }, { x: 0, y: -hh-WALL_H },
          { x: L_DX, y: -hh-WALL_H+L_DY }, { x: -hw+L_DX, y: -WALL_H+L_DY }]);
  g.fill(pal.top);
}

function topCapRight(g: Graphics, pal: typeof PALETTES.stone) {
  const hw = TILE_WIDTH_HALF, hh = TILE_HEIGHT_HALF;
  g.poly([{ x: 0, y: -hh-WALL_H }, { x: hw, y: -WALL_H },
          { x: hw+R_DX, y: -WALL_H+R_DY }, { x: R_DX, y: -hh-WALL_H+R_DY }]);
  g.fill(pal.top);
}

function addDetail(g: Graphics, pal: typeof PALETTES.stone, side: "left" | "right") {
  const hw = TILE_WIDTH_HALF, hh = TILE_HEIGHT_HALF;
  if (pal === PALETTES.stone) {
    for (let i = 1; i <= 3; i++) {
      const y = -(WALL_H * i) / 4;
      if (side === "left") { g.moveTo(-hw, y); g.lineTo(0, y - hh); }
      else                 { g.moveTo(0, y - hh); g.lineTo(hw, y); }
      g.stroke({ width: 0.5, color: pal.mortar, alpha: 0.4 });
    }
  } else if (pal === PALETTES.wood) {
    for (let i = 1; i <= 3; i++) {
      if (side === "left") { const x = -hw + (hw * i) / 4; g.moveTo(x, 0); g.lineTo(x, -WALL_H); }
      else                 { const x = (hw * i) / 4;       g.moveTo(x, 0); g.lineTo(x, -WALL_H); }
      g.stroke({ width: 0.5, color: pal.mortar, alpha: 0.4 });
    }
  }
}

// ─── Building factory ─────────────────────────────────────────────────────────

/**
 * Build wall pieces for a rectangular house.
 * @param x0,z0  top-left interior corner
 * @param w,d    interior width/depth in tiles
 */
export function makeHouse(
  x0: number, z0: number,
  w: number, d: number,
  mat: WallPiece["material"] = "stone",
  doorWall: "n" | "e" | "s" | "w" = "s",
  doorTile = Math.floor(w / 2),
): WallPiece[] {
  const pieces: WallPiece[] = [];
  const x1 = x0 + w - 1;
  const z1 = z0 + d - 1;

  // North wall (wall_right along z0-1)
  for (let x = x0; x <= x1; x++) {
    const isDoor = doorWall === "n" && x === x0 + doorTile;
    pieces.push({ tileX: x, tileZ: z0-1, material: mat, type: isDoor ? "wall_right_door" : "wall_right" });
  }
  // South wall (wall_right along z0+d)
  for (let x = x0; x <= x1; x++) {
    const isDoor = doorWall === "s" && x === x0 + doorTile;
    const isWin  = !isDoor && x % 2 === 1;
    pieces.push({ tileX: x, tileZ: z0+d, material: mat,
      type: isDoor ? "wall_right_door" : isWin ? "wall_right_win" : "wall_right" });
  }
  // West wall (wall_left along x0-1)
  for (let z = z0; z <= z1; z++) {
    const isDoor = doorWall === "w" && z === z0 + Math.floor(d/2);
    const isWin  = !isDoor && z % 2 === 0;
    pieces.push({ tileX: x0-1, tileZ: z, material: mat,
      type: isDoor ? "wall_left_door" : isWin ? "wall_left_win" : "wall_left" });
  }
  // East wall (wall_left along x0+w)
  for (let z = z0; z <= z1; z++) {
    const isDoor = doorWall === "e" && z === z0 + Math.floor(d/2);
    const isWin  = !isDoor && z % 2 === 0;
    pieces.push({ tileX: x0+w, tileZ: z, material: mat,
      type: isDoor ? "wall_left_door" : isWin ? "wall_left_win" : "wall_left" });
  }
  // Four corner posts
  pieces.push({ tileX: x0-1, tileZ: z0-1, material: mat, type: "wall_corner" });
  pieces.push({ tileX: x0+w, tileZ: z0-1, material: mat, type: "wall_corner" });
  pieces.push({ tileX: x0-1, tileZ: z0+d, material: mat, type: "wall_corner" });
  pieces.push({ tileX: x0+w, tileZ: z0+d, material: mat, type: "wall_corner" });

  return pieces;
}
