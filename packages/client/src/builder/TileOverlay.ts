/**
 * Tile overlay — renders user-placed builder tiles on top of the base map.
 *
 * Implementation: one Excalibur Actor per placed tile. Each actor has a
 * Sprite or Animation graphic (animated tiles render animated in-world).
 *
 * Also draws the "ghost" preview that follows the cursor showing what will be
 * placed next (or a red highlight when in delete mode).
 */
import {
  Actor, Color, Rectangle, Vector,
  Sprite, Animation, GraphicsGroup, Graphic,
} from "excalibur";
import { TILE } from "../tile.js";
import { TilesetIndex, type TileEntry } from "./TilesetIndex.js";
import { getLayer, layerHitOrder, type LayerId } from "./registry/layers.js";

export interface PlacedTile {
  layer:    string;
  x:        number;
  y:        number;
  tileset:  string;
  tileId:   number;
  rotation: number;
  flipH:    boolean;
  flipV:    boolean;
}

// Layer hit-testing order is derived from the DB-loaded layer registry.
// Call `layerHitOrder()` to get a fresh array — cheap (~4 elements).
// Re-exported as a function to preserve the previous const surface with a
// data-live backing store.
export const LAYER_HIT_ORDER = (): LayerId[] => layerHitOrder();

/** Rotation in degrees -> radians. */
function deg2rad(deg: number): number { return (deg * Math.PI) / 180; }

export class TileOverlay extends Actor {
  private tiles: TilesetIndex;

  /** Key: `${layer}:${x},${y}`  → Actor */
  private cells = new Map<string, Actor>();
  /** Data records keyed the same way. */
  private records = new Map<string, PlacedTile>();

  /** Brush ghost actor — always one, repositioned on hover. */
  private ghost: Actor;
  /** Red highlight for erase mode. */
  private ghostHi: Actor;
  /** Cyan highlight for the currently-selected placed tile. */
  private selectionHi: Actor;
  /** Yellow rectangle outlining the bounding box of the active stamp brush
   *  while hovering. Resized per `setStampGhost()` call. Hidden when no
   *  stamp is active. */
  private stampGhost: Actor | null = null;
  private stampGhostRect: Rectangle | null = null;

  constructor(tiles: TilesetIndex) {
    // Position at origin; children are world-positioned individually.
    super({ x: 0, y: 0 });
    this.tiles = tiles;

    // Ghost actors are hidden by default.
    this.ghost       = makeGhostActor();
    this.ghostHi     = makeEraseGhostActor();
    this.selectionHi = makeSelectionGhostActor();
    this.ghost.graphics.visible       = false;
    this.ghostHi.graphics.visible     = false;
    this.selectionHi.graphics.visible = false;
  }

  override onInitialize(): void {
    // Ghosts attach to the scene, not as children of this Actor (so they
    // don't inherit Actor's transform; they use absolute world coords).
    this.scene?.add(this.ghost);
    this.scene?.add(this.ghostHi);
    this.scene?.add(this.selectionHi);

    // Stamp ghost is a rectangle-only actor (no sprite) — cheaper than
    // compositing N tile ghosts for each hover tick.
    this.stampGhost = new Actor({ x: 0, y: 0, z: 302 });
    this.stampGhostRect = new Rectangle({
      width: TILE, height: TILE,
      color: Color.fromRGB(255, 215, 0, 0.08),
      strokeColor: Color.fromRGB(255, 215, 0, 0.9),
      lineWidth: 1,
    });
    this.stampGhost.graphics.use(this.stampGhostRect);
    this.stampGhost.graphics.visible = false;
    this.scene?.add(this.stampGhost);
  }

  // ---------------------------------------------------------------------------
  // Public API (called by BuilderScene)
  // ---------------------------------------------------------------------------

  /** Called on zone change — drops every actor. */
  clear(): void {
    for (const a of this.cells.values()) a.kill();
    this.cells.clear();
    this.records.clear();
  }

  /** Replace overlay state with a server-sent snapshot. */
  reset(tiles: PlacedTile[]): void {
    this.clear();
    for (const t of tiles) this.place(t);
  }

  /** Add / replace a tile placement. */
  place(t: PlacedTile): void {
    const key = keyOf(t.layer, t.x, t.y);

    // Remove existing actor for this cell.
    const existing = this.cells.get(key);
    if (existing) existing.kill();
    this.cells.delete(key);

    const graphic = this.tiles.makeGraphic(t.tileset, t.tileId);
    if (!graphic) {
      console.warn(`[Overlay] Missing graphic for ${t.tileset}:${t.tileId}`);
      return;
    }

    // Match Tiled's tile-layer convention: a tile's bottom-left aligns with
    // the target cell's bottom-left. Sprites bigger than one map tile extend
    // UP and to the RIGHT from the anchor cell (so e.g. tall trees "stand"
    // on their anchor cell, canopy extends upward into neighbouring cells).
    //
    // We keep the Excalibur anchor at (0.5, 0.5) so rotation pivots around
    // the tile centre (the natural rotation axis). To land the bottom-left
    // where Tiled expects, offset `pos` by half the tile's own size.
    const meta = this.tiles.getTileset(t.tileset);
    const tw = meta?.tilewidth  ?? TILE;
    const th = meta?.tileheight ?? TILE;
    const worldX = t.x * TILE + tw / 2;
    const worldY = (t.y + 1) * TILE - th / 2;
    const actor = new Actor({
      x: worldX, y: worldY,
      rotation: deg2rad(t.rotation || 0),
      z: getLayer(t.layer as LayerId).z,
    });
    actor.graphics.use(graphic);
    if (graphic instanceof Animation) {
      // Ensure animation plays from the start.
      graphic.reset();
      graphic.play();
    }
    // Horizontal/vertical flips.
    if (t.flipH) actor.scale = new Vector(-1, actor.scale.y);
    if (t.flipV) actor.scale = new Vector(actor.scale.x, -1);

    this.scene?.add(actor);
    this.cells.set(key, actor);
    this.records.set(key, t);
  }

  /** Remove a tile from a cell. */
  remove(layer: string, x: number, y: number): void {
    const key = keyOf(layer, x, y);
    const actor = this.cells.get(key);
    if (actor) actor.kill();
    this.cells.delete(key);
    this.records.delete(key);
  }

  /** Get the placed tile at a cell, if any. */
  tileAt(layer: string, x: number, y: number): PlacedTile | undefined {
    return this.records.get(keyOf(layer, x, y));
  }

  /** Topmost placed tile at a cell (checks canopy→walls→decor→ground). */
  topmostAt(x: number, y: number): PlacedTile | undefined {
    for (const layer of LAYER_HIT_ORDER()) {
      const t = this.records.get(keyOf(layer, x, y));
      if (t) return t;
    }
    return undefined;
  }

  /** Show / hide / move the in-place selection highlight. */
  setSelectionHighlight(x: number, y: number): void {
    this.selectionHi.pos = new Vector(x * TILE + TILE / 2, y * TILE + TILE / 2);
    this.selectionHi.graphics.visible = true;
  }

  clearSelectionHighlight(): void {
    this.selectionHi.graphics.visible = false;
  }

  /** Update the hovering "ghost" preview. Accepts any builder mode; only
   *  `place` and `erase` produce a visible ghost from this overlay. The
   *  `block` mode draws its own ghost via BlockOverlay. */
  setGhost(
    mode: "place" | "erase" | "block",
    brush: { tileset: string; tileId: number; rotation: number } | null,
    x: number, y: number,
    _layer: string,
  ): void {
    // Hide both, then show the right one.
    this.ghost.graphics.visible   = false;
    this.ghostHi.graphics.visible = false;
    if (mode === "block") return;   // tile ghost hidden in block mode
    if (x < 0 || y < 0) return;

    // 1×1-tile highlights (erase) stay at the cell centre.
    const cellCx = x * TILE + TILE / 2;
    const cellCy = y * TILE + TILE / 2;

    if (mode === "erase") {
      this.ghostHi.pos = new Vector(cellCx, cellCy);
      this.ghostHi.graphics.visible = true;
      return;
    }

    if (brush) {
      const g = this.tiles.makeGraphic(brush.tileset, brush.tileId);
      if (g) {
        // The brush preview must be positioned using Tiled's bottom-left
        // convention so the ghost lands exactly where `place()` will render
        // the tile once clicked (matters a lot for tall tiles like trees).
        const meta = this.tiles.getTileset(brush.tileset);
        const tw = meta?.tilewidth  ?? TILE;
        const th = meta?.tileheight ?? TILE;
        this.ghost.pos = new Vector(
          x * TILE + tw / 2,
          (y + 1) * TILE - th / 2,
        );
        this.ghost.rotation = deg2rad(brush.rotation || 0);
        // Apply semi-transparent preview.
        const wrapped = dim(g);
        this.ghost.graphics.use(wrapped);
        if (g instanceof Animation) { g.reset(); g.play(); }
        this.ghost.graphics.visible = true;
      }
    }
  }

  /** Update the yellow stamp-bounds rectangle that follows the cursor when
   *  a stamp brush is active. Pass `null` or negative coords to hide. */
  setStampGhost(stamp: { width: number; height: number; name?: string } | null, x: number, y: number): void {
    if (!this.stampGhost || !this.stampGhostRect) return;
    if (!stamp || x < 0 || y < 0) {
      this.stampGhost.graphics.visible = false;
      return;
    }
    // Rebuild the rectangle at the stamp's exact tile size (16 px per cell).
    const w = stamp.width  * TILE;
    const h = stamp.height * TILE;
    this.stampGhostRect = new Rectangle({
      width: w, height: h,
      color: Color.fromRGB(255, 215, 0, 0.08),
      strokeColor: Color.fromRGB(255, 215, 0, 0.9),
      lineWidth: 1,
    });
    this.stampGhost.graphics.use(this.stampGhostRect);
    // Actor anchor defaults to (0.5, 0.5) → position is rectangle centre.
    this.stampGhost.pos.setTo(x * TILE + w / 2, y * TILE + h / 2);
    this.stampGhost.graphics.visible = true;
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function keyOf(layer: string, x: number, y: number): string {
  return `${layer}:${x},${y}`;
}

function makeGhostActor(): Actor {
  const a = new Actor({ x: 0, y: 0, z: 200 });
  return a;
}

function makeEraseGhostActor(): Actor {
  const a = new Actor({ x: 0, y: 0, z: 300 });
  const rect = new Rectangle({
    width: TILE, height: TILE,
    color: Color.Transparent,
    strokeColor: Color.Red,
    lineWidth: 1,
  });
  a.graphics.use(rect);
  return a;
}

function makeSelectionGhostActor(): Actor {
  const a = new Actor({ x: 0, y: 0, z: 301 });
  const rect = new Rectangle({
    width: TILE, height: TILE,
    color: Color.Transparent,
    strokeColor: Color.Cyan,
    lineWidth: 1,
  });
  a.graphics.use(rect);
  return a;
}

/** Wrap a graphic with ~50% opacity for the hover ghost.
 *  Always clones first — the source Sprite/Animation is cached by the
 *  SpriteSheet and reused across every placed tile + the ghost, so mutating
 *  opacity in place would fade every placed tile too. */
function dim(g: Graphic): Graphic {
  const cloned = g.clone();
  cloned.opacity = 0.55;
  return cloned;
}
