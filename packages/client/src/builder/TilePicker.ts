/**
 * HTML floating modal for browsing / picking tiles.
 *
 * Renders each tile into a small <canvas> so animated tiles can animate in
 * real time. Animated tiles are tagged with a little "AN" badge.
 */
import { TilesetIndex, type TileEntry, type TilesetMeta } from "./TilesetIndex.js";
import { listCategoriesByOrder, type CategoryDef, type CategoryId } from "./registry/categories.js";

export type TilePickHandler = (entry: TileEntry) => void;

interface TileTile {
  entry:    TileEntry;
  canvas:   HTMLCanvasElement;
  ctx:      CanvasRenderingContext2D;
  meta:     TilesetMeta;
  /** Animation timer state. */
  frameIdx: number;
  nextAt:   number;
}

export class TilePicker {
  private root     = document.getElementById("picker")!;
  private grid     = document.getElementById("picker-grid")!;
  private cats     = document.getElementById("picker-cats")!;
  private search   = document.getElementById("picker-search") as HTMLInputElement;
  private closeBtn = document.getElementById("picker-close")!;

  private activeCategory: CategoryId | null = null;
  private onPick: TilePickHandler | null = null;
  private tiles: TileTile[] = [];
  private selectedKey: string | null = null;  // `${tileset}:${tileId}`

  private animRafId: number | null = null;
  private animRunning = false;

  constructor(private index: TilesetIndex) {
    this.closeBtn.addEventListener("click", () => this.close());
    this.search.addEventListener("input", () => this.renderGrid());
    document.addEventListener("keydown", (e) => {
      if (!this.isOpen()) return;
      if (e.key === "Escape") this.close();
    });
  }

  setOnPick(h: TilePickHandler): void { this.onPick = h; }

  isOpen(): boolean { return this.root.classList.contains("open"); }

  setSelected(tileset: string | null, tileId: number | null): void {
    this.selectedKey = (tileset && tileId != null) ? `${tileset}:${tileId}` : null;
    for (const t of this.tiles) {
      const isSel = this.selectedKey === `${t.entry.tileset}:${t.entry.tileId}`;
      t.canvas.parentElement?.classList.toggle("selected", isSel);
    }
  }

  open(): void {
    this.root.classList.add("open");
    // Re-render cats + grid each open so new tilesets (if lazy-loaded) appear.
    this.renderCategories();
    this.renderGrid();
    this.startAnimations();
    this.search.focus();
  }

  close(): void {
    this.root.classList.remove("open");
    this.stopAnimations();
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderCategories(): void {
    // Always show the full canonical taxonomy, even for categories with zero
    // tiles — this makes the intent visible and lets us fill them in over
    // time as tiles get identified / new tilesets get registered.
    const all = listCategoriesByOrder();
    const counts = new Map<CategoryId, number>();
    for (const e of this.index.allEntries()) {
      counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    const totalCount = this.index.allEntries().length;

    this.cats.innerHTML = "";
    // "All" pseudo-category pinned to the top
    const allEl = document.createElement("div");
    allEl.className = "cat" + (this.activeCategory === null ? " active" : "");
    allEl.innerHTML = `All<span class="count">${totalCount}</span>`;
    allEl.addEventListener("click", () => {
      this.activeCategory = null;
      this.renderCategories();
      this.renderGrid();
    });
    this.cats.appendChild(allEl);

    for (const def of all) {
      const el = document.createElement("div");
      el.className = "cat" + (this.activeCategory === def.id ? " active" : "");
      const n = counts.get(def.id) ?? 0;
      el.title = def.description;
      el.innerHTML = `${def.name}<span class="count">${n}</span>`;
      el.addEventListener("click", () => {
        this.activeCategory = def.id;
        this.renderCategories();
        this.renderGrid();
      });
      // Visual cue for empty categories
      if (n === 0) el.style.opacity = "0.45";
      this.cats.appendChild(el);
    }
  }

  private renderGrid(): void {
    this.stopAnimations();
    this.tiles.length = 0;
    this.grid.innerHTML = "";

    const query = this.search.value;
    const entries = this.index.filter(this.activeCategory, query).slice(0, 800);  // cap for perf

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.id = "picker-empty";
      empty.textContent = query ? `No tiles match "${query}"` : "No tiles in this category";
      this.grid.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const meta = this.index.getTileset(entry.tileset);
      if (!meta || !meta.image) continue;

      const cell = document.createElement("div");
      cell.className = "tile";
      cell.title = entry.label;
      if (this.selectedKey === `${entry.tileset}:${entry.tileId}`) {
        cell.classList.add("selected");
      }

      // Size the canvas to the tile's native pixel size — CSS upscales crisp
      // via `image-rendering: pixelated` on the <canvas>.
      const cnv = document.createElement("canvas");
      cnv.width  = meta.tilewidth;
      cnv.height = meta.tileheight;
      const ctx = cnv.getContext("2d");
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      drawTile(ctx, meta, entry, 0);

      cell.appendChild(cnv);

      if (entry.animation && entry.animation.length > 1) {
        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = "AN";
        cell.appendChild(badge);
      }

      cell.addEventListener("click", () => {
        this.setSelected(entry.tileset, entry.tileId);
        this.onPick?.(entry);
        // Dismiss the modal so the user can immediately click the world to
        // place. To pick a different tile, press `B` to reopen.
        this.close();
      });

      this.grid.appendChild(cell);

      if (entry.animation && entry.animation.length > 1) {
        this.tiles.push({
          entry,
          canvas: cnv,
          ctx,
          meta,
          frameIdx: 0,
          nextAt:   performance.now() + entry.animation[0].duration,
        });
      }
    }

    this.startAnimations();
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  private startAnimations(): void {
    if (this.animRunning) return;
    if (this.tiles.length === 0) return;
    this.animRunning = true;
    const tick = () => {
      if (!this.animRunning) return;
      const now = performance.now();
      for (const t of this.tiles) {
        const frames = t.entry.animation!;
        if (now < t.nextAt) continue;
        t.frameIdx = (t.frameIdx + 1) % frames.length;
        t.nextAt = now + frames[t.frameIdx].duration;
        drawTile(t.ctx, t.meta, t.entry, t.frameIdx);
      }
      this.animRafId = requestAnimationFrame(tick);
    };
    this.animRafId = requestAnimationFrame(tick);
  }

  private stopAnimations(): void {
    this.animRunning = false;
    if (this.animRafId != null) cancelAnimationFrame(this.animRafId);
    this.animRafId = null;
  }
}

// -----------------------------------------------------------------------------
// Tile drawing — resolves animation frame tile id -> pixel rect
// -----------------------------------------------------------------------------

/** Draw a tile into a canvas context at the current animation frame. */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  meta: TilesetMeta,
  entry: TileEntry,
  frameIdx: number,
): void {
  if (!meta.image) return;

  let frameTileId = entry.tileId;
  if (entry.animation && entry.animation.length > 0) {
    frameTileId = entry.animation[frameIdx % entry.animation.length].tileId;
  }
  const col = frameTileId % meta.columns;
  const row = Math.floor(frameTileId / meta.columns);
  const sx = col * meta.tilewidth;
  const sy = row * meta.tileheight;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(
    meta.image,
    sx, sy, meta.tilewidth, meta.tileheight,
    0,  0,  ctx.canvas.width, ctx.canvas.height,
  );
}
