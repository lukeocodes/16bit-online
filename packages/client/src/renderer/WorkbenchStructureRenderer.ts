import { Application, Container, Graphics, RenderTexture, Sprite } from "pixi.js";
import "../../../../tools/model-workbench/src/models/structures/index";
import { renderModel } from "../../../../tools/model-workbench/src/models/composite";
import { computePalette } from "../../../../tools/model-workbench/src/models/palette";
import type { WallPiece } from "./StructureRenderer";
import { worldToScreen, screenToWorld, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from "./IsometricRenderer";

/**
 * WorkbenchStructureRenderer — replaces StructureRenderer with workbench wall sprites.
 *
 * Canonical orientation: W=North, S=South, A=West, D=East.
 *
 * Scale correction: workbench wall models use T=22, H2=11 as their tile dimensions.
 * The game tile is TILE_WIDTH_HALF=32, TILE_HEIGHT_HALF=16. We scale models by
 * TILE_SCALE = 32/22 so wall faces align exactly with tile diamond edges.
 *
 * Quality: render at 2× for crispness, display at 0.5× to keep visual size.
 *
 * Corners: workbench has no corner model. We render wall-n + wall-w overlaid at
 * the corner tile to produce a convincing L-shaped post.
 */

// Workbench wall geometry constants (from WallN/WallW source)
const T       = 22;   // half tile width in model coords
const H2      = T / 2; // half tile height = 11
const STORY_H = 3 * T; // wall height = 66

// Scale so model geometry matches game tile dimensions exactly
const TILE_SCALE    = TILE_WIDTH_HALF / T;          // 32/22 ≈ 1.4545
const QUALITY       = 2;                              // 2× render quality
const MODEL_SCALE   = TILE_SCALE * QUALITY;           // ≈ 2.909
const DISPLAY_SCALE = 1 / QUALITY;                   // 0.5

// Frame dimensions at MODEL_SCALE (walls at TILE_SCALE fit exactly, × QUALITY for crisp textures)
// Top-cap vertices reach (STORY_H + H2) above tile-centre, so ORIGIN_Y must budget for both.
const FRAME_W  = Math.ceil(T * 2 * MODEL_SCALE + 24);
const ORIGIN_Y = Math.ceil((STORY_H + H2) * MODEL_SCALE + 12);  // y in texture where tile-centre sits
const FRAME_H  = ORIGIN_Y + Math.ceil(H2 * MODEL_SCALE + 12);   // origin + bottom margin

// Sprite anchor: tile centre is at (FRAME_W/2, ORIGIN_Y) in the texture
const ANCHOR_X = 0.5;
const ANCHOR_Y = ORIGIN_Y / FRAME_H;

// Direction depth offset — E < N < S < W, matching DEPTH_E/N/S/W in model types.
// Applied to sprite.zIndex so corner pieces (two models at same tile) layer correctly.
const MODEL_DIR_OFFSET: Record<string, number> = {
  "wall-e":    0,
  "wall-n":    1,
  "wall-s":    2,
  "wall-w":    3,
  "floor-tile": 0,
};

// Material → workbench palette primary colour
const MATERIAL_PRIMARY: Record<string, number> = {
  stone:   0x8a8a8a,
  wood:    0x7a5c1e,
  plaster: 0xcfbc96,
};

/**
 * Map a WallPiece to one or two workbench model IDs.
 *
 * Canonical orientation: W=North, S=South, A=West, D=East.
 *
 *   wall_left  no flip = west  wall (A-side) → wall-n
 *   wall_left  flip    = east  wall (D-side) → wall-s
 *   wall_right no flip = north wall (W-side) → wall-e
 *   wall_right flip    = south wall (S-side) → wall-w
 *
 * Corners pair the two adjacent faces:
 *   NW (flipL=F, flipR=F): west  + north → wall-n + wall-e
 *   NE (flipL=T, flipR=F): east  + north → wall-s + wall-e
 *   SW (flipL=F, flipR=T): west  + south → wall-n + wall-w
 *   SE (flipL=T, flipR=T): east  + south → wall-s + wall-w
 */
function modelsForPiece(piece: WallPiece): string[] {
  const { type, flip, flipL, flipR } = piece;
  switch (type) {
    case "wall_left":
    case "wall_left_door":
    case "wall_left_win":
      return flip ? ["wall-s"] : ["wall-n"];
    case "wall_right":
    case "wall_right_door":
    case "wall_right_win":
      return flip ? ["wall-w"] : ["wall-e"];
    case "wall_corner": {
      const leftFace  = flipL ? "wall-s" : "wall-n";
      const rightFace = flipR ? "wall-w" : "wall-e";
      return [leftFace, rightFace];
    }
    case "floor":
      return ["floor-tile"];
    default:
      return []; // stair_left, stair_right — no workbench model yet
  }
}

// ─── Tracked piece ────────────────────────────────────────────────────────────

export interface TrackedPiece {
  sprites: Sprite[];
  piece: WallPiece;
  /** Index within the source array passed to loadWalls (for tiled pieces), or
   *  a sequential ID for dynamically placed pieces. */
  pieceIndex: number;
  source: "tiled" | "placed";
  /** DB id — only present for source="placed" pieces. */
  dbId?: string;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

export class WorkbenchStructureRenderer {
  private app: Application;
  private textureCache = new Map<string, RenderTexture>();
  private trackedPieces: TrackedPiece[] = [];
  private worldContainer: Container | null = null;
  private ghostSprites: Sprite[] = [];
  private nextPlacedIndex = 100_000; // distinct from tiled indices (0-based)

  constructor(app: Application) {
    this.app = app;
  }

  // ─── Load all Tiled wall pieces at once ────────────────────────────────────

  loadWalls(pieces: WallPiece[], worldContainer: Container): void {
    this.worldContainer = worldContainer;
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const sprites = this.buildSprites(piece, worldContainer);
      if (sprites.length > 0) {
        this.trackedPieces.push({ sprites, piece, pieceIndex: i, source: "tiled" });
      }
    }
  }

  // ─── Dynamic piece management (world builder) ──────────────────────────────

  /** Add a piece that was loaded from the DB (placed by world builder). */
  addPlacedPiece(piece: WallPiece, dbId: string): void {
    if (!this.worldContainer) return;
    const sprites = this.buildSprites(piece, this.worldContainer);
    if (sprites.length === 0) return;
    const pieceIndex = this.nextPlacedIndex++;
    this.trackedPieces.push({ sprites, piece, pieceIndex, source: "placed", dbId });
  }

  /** Remove a piece from the rendered world. */
  removePiece(pieceIndex: number, source: "tiled" | "placed"): void {
    const idx = this.trackedPieces.findIndex(
      p => p.pieceIndex === pieceIndex && p.source === source,
    );
    if (idx === -1) return;
    const tp = this.trackedPieces.splice(idx, 1)[0];
    for (const s of tp.sprites) { s.parent?.removeChild(s); s.destroy(); }
  }

  // ─── Hit testing ──────────────────────────────────────────────────────────

  /**
   * Given world-pixel coordinates (as returned by screen → worldContainer transform),
   * return the TrackedPiece whose tile the cursor is over, or null.
   */
  hitTestPiece(worldPxX: number, worldPxY: number): TrackedPiece | null {
    const { tileX, tileZ } = screenToWorld(worldPxX, worldPxY);
    // Exact tile match first
    for (const tp of this.trackedPieces) {
      if (tp.piece.tileX === Math.round(tileX) && tp.piece.tileZ === Math.round(tileZ)) {
        return tp;
      }
    }
    // Fuzzy match — useful near tile edges
    let best: TrackedPiece | null = null;
    let bestDist = 0.65; // threshold in tile units
    for (const tp of this.trackedPieces) {
      const dx = Math.abs(tp.piece.tileX - tileX);
      const dz = Math.abs(tp.piece.tileZ - tileZ);
      const d = Math.max(dx, dz);
      if (d < bestDist) { bestDist = d; best = tp; }
    }
    return best;
  }

  // ─── Highlighting ─────────────────────────────────────────────────────────

  /** Tint a specific piece (by pieceIndex + source) to indicate hover/selection.
   *  Pass null to clear all highlights. */
  setHighlight(pieceIndex: number | null, source: "tiled" | "placed" = "tiled"): void {
    for (const tp of this.trackedPieces) {
      for (const s of tp.sprites) s.tint = 0xffffff;
    }
    if (pieceIndex === null) return;
    const tp = this.trackedPieces.find(
      p => p.pieceIndex === pieceIndex && p.source === source,
    );
    if (!tp) return;
    for (const s of tp.sprites) s.tint = 0x88bbff;
  }

  /** Highlight multiple pieces (multi-select). */
  setMultiHighlight(refs: Array<{ pieceIndex: number; source: "tiled" | "placed" }>): void {
    for (const tp of this.trackedPieces) {
      for (const s of tp.sprites) s.tint = 0xffffff;
    }
    for (const ref of refs) {
      const tp = this.trackedPieces.find(p => p.pieceIndex === ref.pieceIndex && p.source === ref.source);
      if (tp) for (const s of tp.sprites) s.tint = 0x88bbff;
    }
  }

  // ─── Ghost preview ────────────────────────────────────────────────────────

  /** Show a semi-transparent ghost of `piece` snapped to (tileX, tileZ).
   *  Call with piece=null to hide the ghost. */
  setGhost(piece: WallPiece | null, tileX: number, tileZ: number): void {
    for (const s of this.ghostSprites) { s.parent?.removeChild(s); s.destroy(); }
    this.ghostSprites = [];
    if (!piece || !this.worldContainer) return;

    const ghostPiece = { ...piece, tileX, tileZ };
    const models = modelsForPiece(ghostPiece);
    const elevation = ghostPiece.elevation ?? 0;
    const { sx, sy } = worldToScreen(tileX, tileZ, elevation);
    const zBase = (tileX + tileZ) * 10 + elevation * 1000 + 50_000;

    for (const modelId of models) {
      const texture = this.getTexture(modelId, ghostPiece.material);
      const sprite = new Sprite(texture);
      sprite.anchor.set(ANCHOR_X, ANCHOR_Y);
      sprite.scale.set(DISPLAY_SCALE);
      sprite.position.set(sx, sy);
      sprite.zIndex = zBase + (MODEL_DIR_OFFSET[modelId] ?? 0);
      sprite.alpha = 0.55;
      sprite.tint = 0x88aaff;
      this.worldContainer.addChild(sprite);
      this.ghostSprites.push(sprite);
    }
  }

  // ─── Floor visibility (existing API) ─────────────────────────────────────

  /** Match StructureRenderer API: fade upper-floor walls when player is on ground floor. */
  updateFloorVisibility(playerFloor: number, _underCover: boolean): void {
    for (const { sprites, piece } of this.trackedPieces) {
      const elev = piece.elevation ?? 0;
      const visible = elev === 0 || playerFloor >= elev;
      for (const s of sprites) s.alpha = visible ? 1 : 0.1;
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  dispose(): void {
    for (const tp of this.trackedPieces) {
      for (const s of tp.sprites) { s.parent?.removeChild(s); s.destroy(); }
    }
    this.trackedPieces = [];
    for (const s of this.ghostSprites) { s.parent?.removeChild(s); s.destroy(); }
    this.ghostSprites = [];
    for (const rt of this.textureCache.values()) rt.destroy();
    this.textureCache.clear();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildSprites(piece: WallPiece, worldContainer: Container): Sprite[] {
    const models = modelsForPiece(piece);
    if (models.length === 0) return [];

    const elevation = piece.elevation ?? 0;
    const { sx, sy } = worldToScreen(piece.tileX, piece.tileZ, elevation);
    const zBase = (piece.tileX + piece.tileZ) * 10 + elevation * 1000 + 3;

    const sprites: Sprite[] = [];
    for (const modelId of models) {
      const texture = this.getTexture(modelId, piece.material);
      const sprite = new Sprite(texture);
      sprite.anchor.set(ANCHOR_X, ANCHOR_Y);
      sprite.scale.set(DISPLAY_SCALE);
      sprite.position.set(sx, sy);
      sprite.zIndex = zBase + (MODEL_DIR_OFFSET[modelId] ?? 0);
      worldContainer.addChild(sprite);
      sprites.push(sprite);
    }
    return sprites;
  }

  private getTexture(modelId: string, material: WallPiece["material"]): RenderTexture {
    const key = `${modelId}:${material}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key)!;

    const primary = MATERIAL_PRIMARY[material] ?? MATERIAL_PRIMARY.stone;
    const palette = computePalette(primary, primary, primary, primary, primary, "none");

    const g = new Graphics();
    g.position.set(FRAME_W / 2, ORIGIN_Y);
    // dir=0 (S): iso.y=0.5 > 0, shows outer face; iso.x=0, shows both edges
    renderModel(g, modelId, palette, 0, 0, MODEL_SCALE, false);

    const tempContainer = new Container();
    tempContainer.addChild(g);

    const rt = RenderTexture.create({ width: FRAME_W, height: FRAME_H });
    this.app.renderer.render({ container: tempContainer, target: rt });
    tempContainer.destroy();

    this.textureCache.set(key, rt);
    return rt;
  }
}
