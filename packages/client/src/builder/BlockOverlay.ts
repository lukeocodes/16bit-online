/**
 * Collision-block overlay.
 *
 * A "block" is a per-cell collision marker, decoupled from tile visuals.
 * This lets a tree sprite (5×7 tiles) have a 1-cell trunk block without the
 * whole sprite footprint becoming impassable. The author places blocks
 * explicitly; they render as blue-outlined squares in builder mode and are
 * invisible in play mode (they'll be baked into the server's collision layer
 * by the freeze tool).
 *
 * Blocks live in their own Actor pool, one actor per block, anchored at the
 * cell's top-left with a 16×16 Rectangle graphic in cyan. Z is chosen so
 * blocks render above all tile layers (including canopy) in builder mode so
 * they're always visible.
 */
import { Actor, Color, Rectangle, Vector } from "excalibur";
import { TILE } from "../tile.js";

export interface Block { x: number; y: number; }

/** Draw blocks above everything else in builder mode. */
const BLOCK_Z = 300;

export class BlockOverlay extends Actor {
  /** Keyed by `${x},${y}`. */
  private cells = new Map<string, Actor>();
  private records = new Map<string, Block>();

  /** Hover ghost — the "about to place" indicator. */
  private ghost: Actor;
  /** Hover ghost — the "about to delete an existing block" indicator. */
  private removeGhost: Actor;

  constructor() {
    super({ x: 0, y: 0 });
    this.ghost       = makeGhostActor(Color.fromRGB(80, 180, 255, 0.8));
    this.removeGhost = makeGhostActor(Color.Red);
    this.ghost.graphics.visible       = false;
    this.removeGhost.graphics.visible = false;
  }

  override onInitialize(): void {
    this.scene?.add(this.ghost);
    this.scene?.add(this.removeGhost);
  }

  // ---------------------------------------------------------------------------
  // Queries — `hasBlock` (not `has`) because Excalibur's Entity already
  // defines `has(componentType)` and we must not shadow it.
  // ---------------------------------------------------------------------------

  hasBlock(x: number, y: number): boolean {
    return this.records.has(keyOf(x, y));
  }

  all(): Block[] {
    return Array.from(this.records.values());
  }

  count(): number {
    return this.records.size;
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /** Wipe and reload from a server snapshot. */
  reset(blocks: Block[]): void {
    for (const a of this.cells.values()) a.kill();
    this.cells.clear();
    this.records.clear();
    for (const b of blocks) this.place(b.x, b.y);
  }

  clear(): void {
    for (const a of this.cells.values()) a.kill();
    this.cells.clear();
    this.records.clear();
  }

  place(x: number, y: number): void {
    const key = keyOf(x, y);
    if (this.cells.has(key)) return;
    const actor = makeBlockActor(x, y);
    this.scene?.add(actor);
    this.cells.set(key, actor);
    this.records.set(key, { x, y });
  }

  remove(x: number, y: number): void {
    const key = keyOf(x, y);
    const actor = this.cells.get(key);
    if (actor) actor.kill();
    this.cells.delete(key);
    this.records.delete(key);
  }

  // ---------------------------------------------------------------------------
  // Hover ghost
  // ---------------------------------------------------------------------------

  setGhost(
    mode: "place" | "erase" | "off",
    x: number, y: number,
  ): void {
    this.ghost.graphics.visible       = false;
    this.removeGhost.graphics.visible = false;
    if (mode === "off" || x < 0 || y < 0) return;
    const worldX = x * TILE + TILE / 2;
    const worldY = y * TILE + TILE / 2;
    if (mode === "erase") {
      this.removeGhost.pos = new Vector(worldX, worldY);
      this.removeGhost.graphics.visible = true;
    } else {
      this.ghost.pos = new Vector(worldX, worldY);
      this.ghost.graphics.visible = true;
    }
  }

  /** Toggle opacity of every placed block actor. Used to fade blocks when
   *  the builder is in non-block modes so they don't obscure tile work. */
  setEmphasised(emphasised: boolean): void {
    for (const a of this.cells.values()) {
      if (a.graphics.current) a.graphics.current.opacity = emphasised ? 0.95 : 0.35;
    }
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function keyOf(x: number, y: number): string { return `${x},${y}`; }

function makeBlockActor(x: number, y: number): Actor {
  const a = new Actor({
    x: x * TILE + TILE / 2,
    y: y * TILE + TILE / 2,
    z: BLOCK_Z,
  });
  const outline = new Rectangle({
    width: TILE, height: TILE,
    color: Color.fromRGB(80, 180, 255, 0.18),       // faint blue fill
    strokeColor: Color.fromRGB(80, 180, 255, 0.95), // blue border
    lineWidth: 1,
  });
  a.graphics.use(outline);
  return a;
}

function makeGhostActor(color: Color): Actor {
  const a = new Actor({ x: 0, y: 0, z: BLOCK_Z + 1 });
  const outline = new Rectangle({
    width: TILE, height: TILE,
    color: Color.Transparent,
    strokeColor: color,
    lineWidth: 1,
  });
  a.graphics.use(outline);
  return a;
}
