/**
 * HTML floating modal for browsing / picking tiles.
 *
 * UX:
 *   - Single click  → SELECT (highlight + populate the right-side editor pane)
 *   - Double click  → PLACE (set as current brush + close picker)
 *   - "Place on map" button in the right pane = same as double click
 *
 * The right pane lets the author edit per-tile metadata at runtime
 * (category, name, tags, layer, blocks, hide). Edits POST to
 * `/api/builder/overrides` and persist in the `tile_overrides` table so
 * they're visible to every other builder after the next registry refresh.
 * See AGENTS.md "Data in the Database".
 *
 * The one piece of state that DOES live in localStorage is the picker zoom
 * (S/M/L/XL) under key `builder.picker.size` — that's per-device UI
 * preference, not shared metadata.
 *
 * Renders each tile into a small <canvas> so animated tiles can animate in
 * real time. Animated tiles are tagged with a little "AN" badge.
 */
import { TilesetIndex, type TileEntry, type TilesetMeta } from "./TilesetIndex.js";
import { listCategoriesByOrder, type CategoryDef, type CategoryId } from "./registry/categories.js";
import type { LayerId } from "./registry/layers.js";
import {
  getOverride,
  setOverride,
  clearOverride,
  exportOverridesJson,
  type TileOverride,
} from "./registry/overrides.js";
import { listStamps, refreshStamps, type StampDef } from "./registry/store.js";

export type TilePickHandler = (entry: TileEntry) => void;
export type StampPickHandler = (stamp: StampDef) => void;

/** Sentinel `activeCategory` value that swaps the grid from tile cells to
 *  stamp cards. Not a real category in the DB. */
const STAMPS_CAT = "__stamps__";

/** Layer z-order for stamp-preview compositing. Must match `map_layers.z`
 *  from the registry but hard-coded here so previews work before network
 *  data lands (and because the UI only has 4 layers). */
const LAYER_Z: Record<string, number> = { ground: 10, decor: 20, walls: 60, canopy: 200 };

interface TileTile {
  entry:    TileEntry;
  canvas:   HTMLCanvasElement;
  ctx:      CanvasRenderingContext2D;
  meta:     TilesetMeta;
  /** Animation timer state. */
  frameIdx: number;
  nextAt:   number;
}

type SizeKey = "s" | "m" | "l" | "xl";
const SIZE_LS_KEY = "builder.picker.size";
const DEFAULT_SIZE: SizeKey = "m";

/** Pixel-per-source-pixel scale factor by size key. The picker grid uses
 *  flex-wrap layout where each tile cell is sized to (sourceW × scale,
 *  sourceH × scale), preserving relative scale between tiles instead of
 *  stretching everything into the same fixed cell. So a 16×16 tile takes
 *  a quarter of the area of a 32×32, and an 80×112 tree dominates a row.
 *
 *  M is the "true game scale" baseline (4× source — matches a 16-px tile
 *  to a 64-px display, which is roughly what the in-world camera shows).
 *  S = 0.5×M, L = 1.5×M, XL = 2×M. */
const SCALE_BY_SIZE: Record<SizeKey, number> = { s: 2, m: 4, l: 6, xl: 8 };

/** Maximum source-pixel dimension to render at full scale. Tiles larger than
 *  this in either axis (e.g. 128×128 wall, 80×112 tree) shrink to fit so a
 *  single tile doesn't blow the viewport at XL. Still preserves aspect. */
const MAX_TILE_DISPLAY_PX = 360;

export class TilePicker {
  private root     = document.getElementById("picker")!;
  private grid     = document.getElementById("picker-grid")!;
  private cats     = document.getElementById("picker-cats")!;
  private search   = document.getElementById("picker-search") as HTMLInputElement;
  private closeBtn = document.getElementById("picker-close")!;
  private sizeBar  = document.getElementById("picker-size")!;

  // Right-pane editor refs.
  private dPane    = document.getElementById("picker-detail")!;
  private dEmpty   = document.getElementById("picker-detail-empty")!;
  private dContent = document.getElementById("picker-detail-content") as HTMLDivElement;
  private dCanvas  = document.getElementById("picker-detail-canvas") as HTMLCanvasElement;
  private dmTileset  = document.getElementById("dm-tileset")!;
  private dmTileid   = document.getElementById("dm-tileid")!;
  private dmPos      = document.getElementById("dm-pos")!;
  private dmSrcfile  = document.getElementById("dm-srcfile")!;
  private dmName     = document.getElementById("dm-name")     as HTMLInputElement;
  private dmCat      = document.getElementById("dm-cat")      as HTMLSelectElement;
  private dmLayer    = document.getElementById("dm-layer")    as HTMLSelectElement;
  private dmTags     = document.getElementById("dm-tags")     as HTMLInputElement;
  private dmBlocks   = document.getElementById("dm-blocks")   as HTMLInputElement;
  private dmHide     = document.getElementById("dm-hide")     as HTMLInputElement;
  private dmPlace    = document.getElementById("dm-place")    as HTMLButtonElement;
  private dmSave     = document.getElementById("dm-save")     as HTMLButtonElement;
  private dmRevert   = document.getElementById("dm-revert")   as HTMLButtonElement;
  private dmDelete   = document.getElementById("dm-delete")   as HTMLButtonElement;
  private dmExport   = document.getElementById("dm-export")   as HTMLButtonElement;
  private dmStatus   = document.getElementById("dm-status")!;

  // Source-spritesheet viewer refs. The canvas mirrors the full PNG of the
  // selected tile's parent sheet with a dashed outline on the tile's cell.
  private dmSheetPath   = document.getElementById("dm-sheet-path")!;
  private dmSheetCanvas = document.getElementById("dm-sheet-canvas") as HTMLCanvasElement;
  private dmSheetZoom   = 2;  // pixel multiplier; 1×, 2×, 4× buttons

  // Bulk-edit panel refs (shown when 2+ tiles are selected).
  private bulkPane   = document.getElementById("picker-detail-bulk") as HTMLDivElement;
  private bulkCount  = document.getElementById("bulk-count")!;
  private bulkCat    = document.getElementById("bulk-cat")    as HTMLSelectElement;
  private bulkLayer  = document.getElementById("bulk-layer")  as HTMLSelectElement;
  private bulkBlocks = document.getElementById("bulk-blocks") as HTMLSelectElement;
  private bulkHide   = document.getElementById("bulk-hide")   as HTMLSelectElement;
  private bulkTags   = document.getElementById("bulk-tags")   as HTMLInputElement;
  private bulkApplyBtn  = document.getElementById("bulk-apply")  as HTMLButtonElement;
  private bulkDeleteBtn = document.getElementById("bulk-delete") as HTMLButtonElement;
  private bulkClearBtn  = document.getElementById("bulk-clear")  as HTMLButtonElement;
  private bulkStatus    = document.getElementById("bulk-status")!;

  /** `null` = All tiles, `STAMPS_CAT` = stamps library, otherwise a
   *  real `tile_categories.id`. */
  private activeCategory: CategoryId | null | typeof STAMPS_CAT = null;
  private onPick: TilePickHandler | null = null;
  private onPickStamp: StampPickHandler | null = null;
  private tiles: TileTile[] = [];
  /** Flat list of every TileEntry currently rendered in the grid (after
   *  category filter + search filter + 800-tile cap), in DOM order. Used
   *  by shift-range selection + select-all-visible, and by
   *  `syncSelectionClasses` to toggle `.tile.selected` on every cell (not
   *  just animated ones like `this.tiles`). */
  private gridEntries: TileEntry[] = [];
  /** Set of selected tile keys (`${tileset}:${tileId}`). Multi-select via
   *  shift/cmd; single-select click resets it to exactly one. When empty,
   *  the detail pane shows the "click a tile" placeholder; when size == 1
   *  the per-tile metadata editor renders; when size >= 2 the bulk-edit
   *  panel renders. */
  private selectedKeys = new Set<string>();
  /** Anchor for shift-click range select. */
  private lastSelectedKey: string | null = null;
  private size: SizeKey = DEFAULT_SIZE;
  /** Detail-canvas live preview (own animation state). */
  private dAnim: { meta: TilesetMeta; entry: TileEntry; ctx: CanvasRenderingContext2D; frameIdx: number; nextAt: number } | null = null;

  private animRafId: number | null = null;
  private animRunning = false;

  /** IntersectionObserver that lazy-paints tile canvases when cells scroll
   *  into view. Watches every cell in `renderGrid()`; unobserves + paints
   *  on first intersect (paint is one-shot). Falls back to immediate paint
   *  in environments without IntersectionObserver. */
  private cellObserver: IntersectionObserver | null = null;

  constructor(private index: TilesetIndex) {
    // rootMargin pre-paints one screen above / below the viewport so fast
    // scrolls don't reveal blank placeholders.
    if (typeof IntersectionObserver !== "undefined") {
      this.cellObserver = new IntersectionObserver(
        (entries) => {
          for (const ent of entries) {
            if (!ent.isIntersecting) continue;
            const cell = ent.target as HTMLDivElement;
            this.paintCell(cell);
            this.cellObserver!.unobserve(cell);
          }
        },
        { root: this.grid, rootMargin: "800px 0px", threshold: 0 },
      );
    }
    this.closeBtn.addEventListener("click", () => this.close());
    this.search.addEventListener("input", () => this.renderGrid());
    document.addEventListener("keydown", (e) => {
      if (!this.isOpen()) return;
      // Don't hijack keys while the user is typing in an input / select /
      // textarea inside the picker (search box, name field, bulk tags, …).
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "Escape") {
        // Escape with a multi-selection clears it first; a second Escape
        // closes the picker. Gives users a way to bail out of a bulk edit
        // without losing the picker state.
        if (this.selectedKeys.size > 0 && !inEditable) {
          this.clearSelection();
          e.preventDefault();
        } else {
          this.close();
        }
        return;
      }
      if (!inEditable && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        this.selectAllVisible();
        return;
      }
      if (!inEditable && (e.key === "Delete" || e.key === "Backspace") && this.selectedKeys.size > 0) {
        e.preventDefault();
        this.deleteSelected();
        return;
      }
      // H = toggle `hide` on every selected tile. Fast way to cull Mana
      // Seed's in-sheet text labels ("Flooring", "Doorway", …) and other
      // junk cells that slipped past the alpha scan. Bulk-safe.
      if (!inEditable && e.key.toLowerCase() === "h" && this.selectedKeys.size > 0) {
        e.preventDefault();
        this.toggleHideSelected();
        return;
      }
    });
    // Restore persisted size; wire up size toggle buttons.
    const stored = (localStorage.getItem(SIZE_LS_KEY) as SizeKey | null);
    if (stored && ["s", "m", "l", "xl"].includes(stored)) this.size = stored;
    this.applySize();
    for (const btn of this.sizeBar.querySelectorAll<HTMLButtonElement>("button[data-size]")) {
      btn.addEventListener("click", () => {
        const k = btn.dataset.size as SizeKey;
        if (k && k !== this.size) {
          this.size = k;
          localStorage.setItem(SIZE_LS_KEY, k);
          this.applySize();
        }
      });
    }

    this.populateCategoryDropdown();
    this.wireDetailForm();
  }

  private applySize(): void {
    this.root.classList.remove("size-s", "size-m", "size-l", "size-xl");
    this.root.classList.add(`size-${this.size}`);
    for (const btn of this.sizeBar.querySelectorAll<HTMLButtonElement>("button[data-size]")) {
      btn.classList.toggle("active", btn.dataset.size === this.size);
    }
    // Tiles must be re-laid-out at the new scale.
    if (this.isOpen()) this.renderGrid();
  }

  // ---------------------------------------------------------------------------
  // Right-pane editor
  // ---------------------------------------------------------------------------

  private populateCategoryDropdown(): void {
    this.dmCat.innerHTML = "";
    for (const def of listCategoriesByOrder()) {
      const opt = document.createElement("option");
      opt.value = def.id;
      opt.textContent = def.name;
      this.dmCat.appendChild(opt);
    }

    // Bulk dropdown gets a leading "(no change)" placeholder so fields
    // the user doesn't touch aren't written to each tile's override.
    this.bulkCat.innerHTML = "";
    const noChange = document.createElement("option");
    noChange.value = "";
    noChange.textContent = "(no change)";
    this.bulkCat.appendChild(noChange);
    for (const def of listCategoriesByOrder()) {
      const opt = document.createElement("option");
      opt.value = def.id;
      opt.textContent = def.name;
      this.bulkCat.appendChild(opt);
    }
  }

  private wireDetailForm(): void {
    const dirty = () => this.dPane.classList.add("dirty");
    [this.dmName, this.dmCat, this.dmLayer, this.dmTags, this.dmBlocks, this.dmHide]
      .forEach((el) => el.addEventListener("input",  dirty));
    [this.dmCat, this.dmLayer, this.dmBlocks, this.dmHide]
      .forEach((el) => el.addEventListener("change", dirty));

    this.dmPlace.addEventListener("click",  () => this.placeSelected());
    this.dmSave.addEventListener("click",   () => this.saveSelected());
    this.dmRevert.addEventListener("click", () => this.revertSelected());
    this.dmDelete.addEventListener("click", () => this.deleteSelected());
    this.dmExport.addEventListener("click", () => this.exportOverrides());

    // Bulk-edit panel actions.
    this.bulkApplyBtn.addEventListener("click",  () => this.bulkApply());
    this.bulkDeleteBtn.addEventListener("click", () => this.bulkDelete());
    this.bulkClearBtn.addEventListener("click",  () => this.clearSelection());

    // Sheet-view zoom buttons. Each carries data-zoom="1|2|4"; re-render the
    // sheet after toggling the active class on the bar.
    const zoomBar = document.querySelector("#picker-detail .dsheet-zoom");
    zoomBar?.querySelectorAll<HTMLButtonElement>("button[data-zoom]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const z = +(btn.dataset.zoom ?? "2");
        this.dmSheetZoom = z;
        zoomBar.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const first = this.firstSelected();
        if (first && this.selectedKeys.size === 1) {
          const m = this.index.getTileset(first.tileset);
          if (m) this.renderSheetView(m, first);
        }
      });
    });
  }

  private showDetailEmpty(): void {
    this.dEmpty.style.display = "block";
    this.dContent.hidden = true;
    this.bulkPane.hidden = true;
    this.stopDetailAnim();
    this.dPane.classList.remove("dirty");
  }

  /** Populate the right pane with the selected tile's metadata + preview. */
  private renderDetail(entry: TileEntry): void {
    const meta = this.index.getTileset(entry.tileset);
    if (!meta) return;
    this.dEmpty.style.display = "none";
    this.dContent.hidden = false;
    this.bulkPane.hidden = true;
    this.dPane.classList.remove("dirty");

    // Preview canvas — use native tile size; CSS scales it up (max 256px).
    this.dCanvas.width  = meta.tilewidth;
    this.dCanvas.height = meta.tileheight;
    const ctx = this.dCanvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      drawTile(ctx, meta, entry, 0);
      // Drive its own animation (independent of grid loop, so it keeps going
      // even when the grid is offscreen / re-rendered).
      this.startDetailAnim(meta, entry, ctx);
    }

    this.dmTileset.textContent = meta.name;
    this.dmTileid.textContent  = String(entry.tileId);
    this.dmPos.textContent     = `col ${entry.col}, row ${entry.row}  (${meta.tilewidth}×${meta.tileheight})`;
    this.dmSrcfile.textContent = meta.file;

    // Form values come from the override if present; otherwise from the
    // resolved entry (which already includes sub-region effects).
    const ov = getOverride(entry.tileset, entry.tileId) ?? {};
    this.dmName.value   = ov.name ?? "";
    this.dmCat.value    = ov.category ?? entry.category;
    this.dmLayer.value  = ov.defaultLayer ?? entry.defaultLayer;
    this.dmTags.value   = (ov.tags ?? meta.def.tags ?? []).join(", ");
    this.dmBlocks.checked = ov.blocks  ?? entry.blocks;
    this.dmHide.checked   = ov.hide    ?? entry.hidden;

    this.dmStatus.textContent = "";

    this.renderSheetView(meta, entry);
  }

  /** Render the full parent PNG with a dashed outline on the selected
   *  tile's source cell. Lets the reviewer see the tile in the sheet's
   *  original context while categorizing. */
  private renderSheetView(meta: TilesetMeta, entry: TileEntry): void {
    if (!meta.image) return;
    this.dmSheetPath.textContent = `${meta.imageUrl}  (${meta.imageWidth}×${meta.imageHeight}px, ${meta.columns}×${Math.ceil(meta.tilecount / meta.columns)} cells)`;

    const canvas = this.dmSheetCanvas;
    const scale = this.dmSheetZoom;
    canvas.width  = meta.imageWidth  * scale;
    canvas.height = meta.imageHeight * scale;
    // Keep the CSS size equal to the backing store so the canvas takes its
    // pixel dimensions; the `image-rendering: pixelated` CSS rule handles
    // crispness. (If the sheet is wider than the pane, the wrapper div
    // scrolls horizontally.)
    canvas.style.width  = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(meta.image, 0, 0, meta.imageWidth, meta.imageHeight, 0, 0, canvas.width, canvas.height);

    // Highlight the selected tile's rect in the scaled space.
    const hx = entry.sx * scale;
    const hy = entry.sy * scale;
    const hw = entry.sw * scale;
    const hh = entry.sh * scale;

    // Semi-transparent fill so the tile stays visible.
    ctx.fillStyle = "rgba(90, 170, 255, 0.12)";
    ctx.fillRect(hx, hy, hw, hh);

    // Dashed outline (two passes — dark underlay + bright top — for contrast
    // against any sheet background).
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.strokeRect(hx + 1, hy + 1, hw - 2, hh - 2);
    ctx.strokeStyle = "rgba(120, 200, 255, 1)";
    ctx.strokeRect(hx, hy, hw, hh);
    ctx.setLineDash([]);

    // Auto-scroll the wrapper so the highlight is visible when the sheet
    // is larger than the viewport.
    const wrap = canvas.parentElement;
    if (wrap) {
      const wantLeft = hx - 40;
      const wantTop  = hy - 40;
      if (wantLeft < wrap.scrollLeft || wantLeft + hw + 80 > wrap.scrollLeft + wrap.clientWidth) {
        wrap.scrollLeft = Math.max(0, wantLeft);
      }
      if (wantTop < wrap.scrollTop || wantTop + hh + 80 > wrap.scrollTop + wrap.clientHeight) {
        wrap.scrollTop = Math.max(0, wantTop);
      }
    }
  }

  private startDetailAnim(meta: TilesetMeta, entry: TileEntry, ctx: CanvasRenderingContext2D): void {
    this.stopDetailAnim();
    if (!entry.animation || entry.animation.length <= 1) return;
    this.dAnim = { meta, entry, ctx, frameIdx: 0, nextAt: performance.now() + entry.animation[0].duration };
    // Kick the loop in case nothing else is animating.
    if (!this.animRunning) this.startAnimations();
  }

  private stopDetailAnim(): void {
    this.dAnim = null;
  }

  /** Compute a minimal TileOverride from the current form state for the
   *  single-selected tile, omitting any field that matches the resolved
   *  entry's effective value. */
  private collectFormOverride(): { ov: TileOverride; isEmpty: boolean } {
    const first = this.firstSelected();
    if (!first || this.selectedKeys.size !== 1) return { ov: {}, isEmpty: true };
    const meta = this.index.getTileset(first.tileset);
    if (!meta) return { ov: {}, isEmpty: true };

    const ov: TileOverride = {};
    const trimmedName = this.dmName.value.trim();
    if (trimmedName) ov.name = trimmedName;
    if (this.dmCat.value && this.dmCat.value !== first.category) ov.category = this.dmCat.value as CategoryId;
    if (this.dmLayer.value && this.dmLayer.value !== first.defaultLayer) ov.defaultLayer = this.dmLayer.value as LayerId;
    const tags = this.dmTags.value.split(",").map((s) => s.trim()).filter(Boolean);
    const tilesetTags = (meta.def.tags ?? []).join(",");
    if (tags.length && tags.join(",") !== tilesetTags) ov.tags = tags;
    if (this.dmBlocks.checked !== first.blocks) ov.blocks = this.dmBlocks.checked;
    if (this.dmHide.checked   !== first.hidden) ov.hide   = this.dmHide.checked;

    return { ov, isEmpty: Object.keys(ov).length === 0 };
  }

  private async saveSelected(): Promise<void> {
    const e = this.firstSelected();
    if (!e || this.selectedKeys.size !== 1) return;
    const { ov, isEmpty } = this.collectFormOverride();
    try {
      if (isEmpty) await clearOverride(e.tileset, e.tileId);
      else         await setOverride(e.tileset, e.tileId, ov);
    } catch (err) {
      this.flashStatus(`Save failed: ${(err as Error).message}`);
      return;
    }
    this.index.refreshEntries(e.tileset);
    const updated = this.index.find(e.tileset, e.tileId);
    this.renderCategories();
    this.renderGrid();
    if (updated) this.renderDetail(updated);
    this.flashStatus(isEmpty ? "Override cleared" : "Saved");
  }

  private async revertSelected(): Promise<void> {
    const e = this.firstSelected();
    if (!e || this.selectedKeys.size !== 1) return;
    try {
      await clearOverride(e.tileset, e.tileId);
    } catch (err) {
      this.flashStatus(`Revert failed: ${(err as Error).message}`);
      return;
    }
    this.index.refreshEntries(e.tileset);
    const updated = this.index.find(e.tileset, e.tileId);
    this.renderCategories();
    this.renderGrid();
    if (updated) this.renderDetail(updated);
    this.flashStatus("Reverted to source");
  }

  /** Delete — route to single or bulk flow based on selection size. */
  private async deleteSelected(): Promise<void> {
    if (this.selectedKeys.size === 0) return;
    if (this.selectedKeys.size === 1) {
      const e = this.firstSelected()!;
      const existing = getOverride(e.tileset, e.tileId) ?? {};
      try {
        await setOverride(e.tileset, e.tileId, { ...existing, hide: true });
      } catch (err) {
        this.flashStatus(`Delete failed: ${(err as Error).message}`);
        return;
      }
      this.index.refreshEntries(e.tileset);
      this.selectedKeys.clear();
      this.lastSelectedKey = null;
      this.renderCategories();
      this.renderGrid();
      this.showDetailEmpty();
      this.flashStatus(`Deleted ${e.label}`);
      return;
    }
    await this.bulkDelete();
  }

  private placeSelected(): void {
    const first = this.firstSelected();
    if (!first) return;
    this.onPick?.(first);
    this.close();
  }

  /** Keyboard `H` handler — toggle `hide` on every selected tile.
   *  If any are currently visible, hides them all; if all are already
   *  hidden, reveals them all. Batched over the existing override endpoint.
   *  Sequential to avoid hammering the server. */
  private async toggleHideSelected(): Promise<void> {
    if (this.selectedKeys.size === 0) return;
    const entries = this.selectedEntries();
    if (entries.length === 0) return;

    // If ANY selected tile is currently not hidden, flip the whole set
    // to hidden; otherwise unhide them all.
    const anyVisible = entries.some((e) => !e.hidden);
    const newHide = anyVisible;

    let failed = 0;
    for (const e of entries) {
      const existing = getOverride(e.tileset, e.tileId) ?? {};
      try {
        await setOverride(e.tileset, e.tileId, { ...existing, hide: newHide });
      } catch (err) {
        failed++;
        console.warn(`toggleHide ${e.tileset}:${e.tileId} failed:`, err);
      }
    }

    // Refresh entries on every touched tileset.
    const touched = new Set(entries.map((e) => e.tileset));
    for (const file of touched) this.index.refreshEntries(file);

    this.selectedKeys.clear();
    this.lastSelectedKey = null;
    this.renderCategories();
    this.renderGrid();
    this.showDetailEmpty();
    const label = newHide ? "Hid" : "Unhid";
    const suffix = failed > 0 ? ` (${failed} failed)` : "";
    this.flashStatus(`${label} ${entries.length} tile${entries.length === 1 ? "" : "s"}${suffix}`);
  }

  // ---------------------------------------------------------------------------
  // Bulk edit (2+ tiles selected)
  // ---------------------------------------------------------------------------

  private renderBulkDetail(entries: TileEntry[]): void {
    this.dEmpty.style.display = "none";
    this.dContent.hidden = true;
    this.bulkPane.hidden = false;
    this.stopDetailAnim();
    this.bulkCount.textContent =
      `${entries.length} tile${entries.length === 1 ? "" : "s"} selected`;
    // Reset form to "(no change)" each time the selection changes so we
    // don't accidentally carry over the previous bulk edit's values.
    this.bulkCat.value    = "";
    this.bulkLayer.value  = "";
    this.bulkBlocks.value = "";
    this.bulkHide.value   = "";
    this.bulkTags.value   = "";
    this.bulkStatus.textContent = "";
  }

  /** For each selected tile, merge the non-"(no change)" bulk fields into
   *  its existing override and POST. Sequential rather than parallel so we
   *  don't hammer the server with hundreds of simultaneous requests; the
   *  existing endpoint is cheap enough that this is near-instant for <200
   *  tiles. Errors flash but don't abort the batch — partial success is
   *  better than none. */
  private async bulkApply(): Promise<void> {
    const entries = this.selectedEntries();
    if (entries.length === 0) return;

    const cat    = this.bulkCat.value    || null;
    const layer  = this.bulkLayer.value  || null;
    const blocks = this.bulkBlocks.value === "" ? null : this.bulkBlocks.value === "true";
    const hide   = this.bulkHide.value   === "" ? null : this.bulkHide.value   === "true";
    const tagsRaw = this.bulkTags.value.trim();
    const tags = tagsRaw
      ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : null;

    if (cat === null && layer === null && blocks === null && hide === null && tags === null) {
      this.bulkStatus.textContent = "Nothing to apply — leave a field as (no change) to skip it";
      return;
    }

    this.bulkStatus.textContent = `Applying to ${entries.length}…`;
    let ok = 0, failed = 0;
    const tilesetsTouched = new Set<string>();
    for (const e of entries) {
      const existing = getOverride(e.tileset, e.tileId) ?? {};
      const merged: TileOverride = { ...existing };
      if (cat   !== null) merged.category     = cat as CategoryId;
      if (layer !== null) merged.defaultLayer = layer as LayerId;
      if (blocks!== null) merged.blocks       = blocks;
      if (hide  !== null) merged.hide         = hide;
      if (tags  !== null) merged.tags         = tags;
      try {
        await setOverride(e.tileset, e.tileId, merged);
        tilesetsTouched.add(e.tileset);
        ok++;
      } catch (err) {
        console.warn(`bulkApply ${e.tileset}:${e.tileId} failed:`, err);
        failed++;
      }
    }

    for (const ts of tilesetsTouched) this.index.refreshEntries(ts);
    this.renderCategories();
    this.renderGrid();
    // Re-render bulk pane with the remaining selection (entries may have
    // moved categories or been hidden; the set of keys stays the same).
    const still = this.selectedEntries();
    if (still.length >= 2)      this.renderBulkDetail(still);
    else if (still.length === 1) this.renderDetail(still[0]);
    else                         this.showDetailEmpty();

    this.bulkStatus.textContent = failed === 0
      ? `Applied to ${ok} tile${ok === 1 ? "" : "s"}`
      : `Applied to ${ok}; ${failed} failed (see console)`;
  }

  /** Set `hide: true` on every selected tile — the bulk equivalent of
   *  clicking Delete in the single-tile pane. */
  private async bulkDelete(): Promise<void> {
    const entries = this.selectedEntries();
    if (entries.length === 0) return;

    this.bulkStatus.textContent = `Deleting ${entries.length}…`;
    let ok = 0, failed = 0;
    const tilesetsTouched = new Set<string>();
    for (const e of entries) {
      const existing = getOverride(e.tileset, e.tileId) ?? {};
      try {
        await setOverride(e.tileset, e.tileId, { ...existing, hide: true });
        tilesetsTouched.add(e.tileset);
        ok++;
      } catch (err) {
        console.warn(`bulkDelete ${e.tileset}:${e.tileId} failed:`, err);
        failed++;
      }
    }

    for (const ts of tilesetsTouched) this.index.refreshEntries(ts);
    // Drop selection — the tiles are gone from the grid now.
    this.selectedKeys.clear();
    this.lastSelectedKey = null;
    this.renderCategories();
    this.renderGrid();
    this.showDetailEmpty();
    this.flashStatus(failed === 0
      ? `Deleted ${ok} tile${ok === 1 ? "" : "s"}`
      : `Deleted ${ok}; ${failed} failed (see console)`);
  }

  private exportOverrides(): void {
    const json = exportOverridesJson();
    navigator.clipboard?.writeText(json).then(
      () => this.flashStatus("Overrides copied to clipboard"),
      () => this.flashStatus("Clipboard write failed — see console"),
    );
    console.log("[overrides]\n" + json);
  }

  private flashStatus(msg: string): void {
    this.dmStatus.textContent = msg;
    setTimeout(() => { if (this.dmStatus.textContent === msg) this.dmStatus.textContent = ""; }, 2200);
  }

  setOnPick(h: TilePickHandler): void { this.onPick = h; }
  setOnPickStamp(h: StampPickHandler): void { this.onPickStamp = h; }

  isOpen(): boolean { return this.root.classList.contains("open"); }

  private entryKey(e: TileEntry): string {
    return `${e.tileset}:${e.tileId}`;
  }

  /** Resolve every selected key back to a TileEntry (dropping any that
   *  no longer exist — e.g. after a bulk delete). Order follows the grid's
   *  filtered view so "first selected" is predictable. */
  private selectedEntries(): TileEntry[] {
    const out: TileEntry[] = [];
    for (const e of this.index.allEntries()) {
      if (this.selectedKeys.has(this.entryKey(e))) out.push(e);
    }
    return out;
  }

  private firstSelected(): TileEntry | null {
    return this.selectedEntries()[0] ?? null;
  }

  /** Visually sync the `.selected` class on every grid cell with the
   *  current `selectedKeys` set. Iterates the grid's DOM children (not
   *  `this.tiles`, which only tracks animated cells). Cheap — one
   *  classList toggle per visible cell, capped at 800 by renderGrid. */
  private syncSelectionClasses(): void {
    const cells = this.grid.children;
    for (let i = 0; i < cells.length && i < this.gridEntries.length; i++) {
      const isSel = this.selectedKeys.has(this.entryKey(this.gridEntries[i]));
      (cells[i] as HTMLElement).classList.toggle("selected", isSel);
    }
  }

  /** Public helper kept for external callers (setSelected → picker brush).
   *  Clears the multi-selection and sets a single tile as the selection. */
  setSelected(tileset: string | null, tileId: number | null): void {
    this.selectedKeys.clear();
    if (tileset && tileId != null) {
      const k = `${tileset}:${tileId}`;
      this.selectedKeys.add(k);
      this.lastSelectedKey = k;
    } else {
      this.lastSelectedKey = null;
    }
    this.syncSelectionClasses();
  }

  /** Select every tile currently visible in the grid (respects active
   *  category + search filter). Used by Cmd/Ctrl+A. */
  private selectAllVisible(): void {
    for (const e of this.gridEntries) this.selectedKeys.add(this.entryKey(e));
    if (this.gridEntries.length > 0) {
      this.lastSelectedKey = this.entryKey(this.gridEntries[this.gridEntries.length - 1]);
    }
    this.syncSelectionClasses();
    this.refreshDetail();
  }

  private clearSelection(): void {
    this.selectedKeys.clear();
    this.lastSelectedKey = null;
    this.syncSelectionClasses();
    this.refreshDetail();
  }

  /** Select/deselect/range based on modifier keys. Mirrors Finder/Explorer
   *  conventions:
   *    plain click  → replace selection with just this tile
   *    meta/ctrl    → toggle this tile in/out of the set
   *    shift        → select range from anchor to this (inclusive) using
   *                   the grid's current filtered order. If there's no
   *                   anchor yet, falls back to plain click. */
  private handleCellClick(entry: TileEntry, ev: MouseEvent): void {
    const k = this.entryKey(entry);
    if (ev.shiftKey && this.lastSelectedKey) {
      const order = this.gridEntries.map((e) => this.entryKey(e));
      const a = order.indexOf(this.lastSelectedKey);
      const b = order.indexOf(k);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) this.selectedKeys.add(order[i]);
      } else {
        // Anchor no longer in the filtered view — just add this tile.
        this.selectedKeys.add(k);
      }
    } else if (ev.metaKey || ev.ctrlKey) {
      if (this.selectedKeys.has(k)) this.selectedKeys.delete(k);
      else                           this.selectedKeys.add(k);
      this.lastSelectedKey = k;
    } else {
      this.selectedKeys.clear();
      this.selectedKeys.add(k);
      this.lastSelectedKey = k;
    }
    this.syncSelectionClasses();
    this.refreshDetail();
  }

  /** Pick the right detail panel (empty/single/bulk) based on selection size. */
  private refreshDetail(): void {
    const entries = this.selectedEntries();
    if (entries.length === 0)       this.showDetailEmpty();
    else if (entries.length === 1)  this.renderDetail(entries[0]);
    else                             this.renderBulkDetail(entries);
  }

  open(): void {
    this.root.classList.add("open");
    // Re-render cats + grid each open so new tilesets (if lazy-loaded) appear.
    this.renderCategories();
    this.renderGrid();
    this.refreshDetail();
    this.startAnimations();
    this.search.focus();
  }

  close(): void {
    this.root.classList.remove("open");
    this.stopAnimations();
    this.stopDetailAnim();
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

    // "Stamps" pseudo-category — multi-tile compositions uploaded from
    // TMX files. Pinned below the regular taxonomy with a divider style
    // so authors see it as a distinct library, not "just another category".
    const divider = document.createElement("div");
    divider.style.cssText = "border-top: 1px solid #333; margin: 6px 4px; opacity: 0.4";
    this.cats.appendChild(divider);
    const stampsEl = document.createElement("div");
    const stampCount = listStamps().length;
    stampsEl.className = "cat" + (this.activeCategory === STAMPS_CAT ? " active" : "");
    stampsEl.title = "Multi-tile compositions. Upload a Tiled TMX to add one.";
    stampsEl.innerHTML = `Stamps<span class="count">${stampCount}</span>`;
    stampsEl.addEventListener("click", () => {
      this.activeCategory = STAMPS_CAT;
      this.renderCategories();
      this.renderGrid();
    });
    if (stampCount === 0) stampsEl.style.opacity = "0.55";
    this.cats.appendChild(stampsEl);
  }

  private renderGrid(): void {
    this.stopAnimations();
    this.tiles.length = 0;
    this.gridEntries.length = 0;
    // Disconnect observer on each re-render; cells are about to be GC'd.
    this.cellObserver?.disconnect();
    this.grid.innerHTML = "";

    if (this.activeCategory === STAMPS_CAT) {
      this.renderStampsGrid();
      return;
    }

    const query = this.search.value;
    // No cap — every filtered tile is represented as a lightweight
    // placeholder cell. `paintCell()` fills in the canvas lazily when the
    // cell scrolls into view via `this.cellObserver` (IntersectionObserver).
    const entries = this.index.filter(this.activeCategory as CategoryId | null, query);
    this.gridEntries = entries;

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.id = "picker-empty";
      empty.textContent = query ? `No tiles match "${query}"` : "No tiles in this category";
      this.grid.appendChild(empty);
      return;
    }

    const scale = SCALE_BY_SIZE[this.size];
    // Keep entries addressable by DOM-index so `paintCell()` doesn't need
    // to re-query the tile index.
    const entriesByIndex = entries;

    for (let i = 0; i < entriesByIndex.length; i++) {
      const entry = entriesByIndex[i];
      const meta  = this.index.getTileset(entry.tileset);
      if (!meta || !meta.image) continue;

      const cell = document.createElement("div");
      cell.className = "tile";
      cell.title = entry.label;
      cell.dataset.idx = String(i);
      if (this.selectedKeys.has(`${entry.tileset}:${entry.tileId}`)) {
        cell.classList.add("selected");
      }

      // True-to-scale sizing: cell is sourceW * scale wide, sourceH * scale
      // tall. A 16×16 tile occupies 64×64 at M scale; a 32×32 tile occupies
      // 128×128 — visibly twice as big. Cap to MAX_TILE_DISPLAY_PX so giant
      // tiles (128×128 walls, 80×112 trees) don't blow up the viewport.
      let dispW = meta.tilewidth  * scale;
      let dispH = meta.tileheight * scale;
      if (dispW > MAX_TILE_DISPLAY_PX || dispH > MAX_TILE_DISPLAY_PX) {
        const k = MAX_TILE_DISPLAY_PX / Math.max(dispW, dispH);
        dispW = Math.round(dispW * k);
        dispH = Math.round(dispH * k);
      }
      cell.style.width  = `${dispW}px`;
      cell.style.height = `${dispH}px`;

      // Click modifiers:
      //   plain        → replace selection, show single detail
      //   meta/ctrl    → toggle this tile in/out of multi-selection
      //   shift        → range select from last anchor to here
      // Double click   → PLACE (set as brush + close picker)
      cell.addEventListener("click", (ev) => {
        this.handleCellClick(entry, ev);
      });
      cell.addEventListener("dblclick", () => {
        this.setSelected(entry.tileset, entry.tileId);
        this.onPick?.(entry);
        this.close();
      });

      this.grid.appendChild(cell);

      if (this.cellObserver) {
        this.cellObserver.observe(cell);
      } else {
        // No IntersectionObserver (fallback env) — paint synchronously.
        this.paintCell(cell);
      }
    }

    this.startAnimations();
  }

  /** Render the stamp-library view. Each stamp becomes a card showing a
   *  composite preview of all its tiles (composited in layer-z order), the
   *  stamp name + dimensions, and a delete button. Click = select +
   *  populate detail pane; double-click = pick stamp + close picker.
   *
   *  Also injects an "Upload TMX" card at the start that opens a file
   *  picker + POSTs the selected file to `/api/stamps`.
   */
  private renderStampsGrid(): void {
    const query = this.search.value.trim().toLowerCase();
    const stamps = listStamps().filter(s =>
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.slug.toLowerCase().includes(query) ||
      (s.category ?? "").toLowerCase().includes(query)
    );

    // Upload card (always first)
    const upload = document.createElement("div");
    upload.className = "tile stamp-card stamp-upload";
    upload.style.cssText = `
      width: 160px; height: 140px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; background: #1a1a1a; border: 2px dashed #666; cursor: pointer;
      color: #ccc; font-size: 13px; text-align: center; padding: 8px;
    `;
    upload.innerHTML = `<div style="font-size:26px; line-height:1">＋</div><div>Upload TMX</div><div style="font-size:10px; opacity:0.6">Tiled export → stamp</div>`;
    upload.addEventListener("click", () => this.promptUploadStamp());
    this.grid.appendChild(upload);

    if (stamps.length === 0) {
      const empty = document.createElement("div");
      empty.id = "picker-empty";
      empty.textContent = query
        ? `No stamps match "${query}"`
        : "No stamps yet. Upload a TMX to add one.";
      empty.style.marginLeft = "12px";
      this.grid.appendChild(empty);
      return;
    }

    for (const stamp of stamps) {
      const card = document.createElement("div");
      card.className = "tile stamp-card";
      card.title = `${stamp.name} — ${stamp.width}×${stamp.height}, ${stamp.tiles.length} tile(s)`;
      // Stamp card size: fixed display width so previews are consistent,
      // regardless of underlying stamp dimensions.
      card.style.cssText = `
        width: 160px; height: 140px;
        display: flex; flex-direction: column; align-items: stretch; padding: 0;
        background: #1a1a1a;
      `;

      // Preview canvas renders the stamp to a 16-px-per-tile canvas, then
      // CSS scales it to fit the card. image-rendering: pixelated keeps
      // the scale-down crisp-ish.
      const preview = document.createElement("canvas");
      preview.width  = Math.max(1, stamp.width * 16);
      preview.height = Math.max(1, stamp.height * 16);
      preview.style.cssText = `
        flex: 1; width: 100%; min-height: 0; object-fit: contain;
        image-rendering: pixelated;
        background: repeating-conic-gradient(#242424 0 25%, #1c1c1c 0 50%) 0 0/8px 8px;
      `;
      const ctx = preview.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        drawStampComposite(ctx, stamp, this.index);
      }

      const label = document.createElement("div");
      label.style.cssText = `
        font-size: 11px; line-height: 1.2; padding: 4px 6px;
        background: #111; color: #ccc; border-top: 1px solid #333;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      `;
      label.innerHTML = `<strong>${escapeHtml(stamp.name)}</strong><br><span style="opacity:0.6">${stamp.width}×${stamp.height} · ${stamp.tiles.length}t</span>`;

      card.appendChild(preview);
      card.appendChild(label);

      card.addEventListener("click", () => {
        this.renderStampDetail(stamp);
      });
      card.addEventListener("dblclick", () => {
        this.onPickStamp?.(stamp);
        this.close();
      });

      this.grid.appendChild(card);
    }
  }

  /** Open a file chooser, send the selected TMX to `/api/stamps`, then
   *  refresh the stamp list and re-render. */
  private promptUploadStamp(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".tmx,application/xml,text/xml";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const name = prompt("Stamp name?", f.name.replace(/\.tmx$/i, ""));
      if (!name) return;
      const xml = await f.text();
      try {
        const res = await fetch("/api/stamps/", {
          method:  "POST",
          headers: {
            "content-type":   "application/xml",
            "x-stamp-name":   name,
          },
          body: xml,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          this.flashStatus(`Upload failed: ${err.detail}`);
          return;
        }
        const out = await res.json() as { stamp: { slug: string; tileCount: number }; warnings?: string[] };
        await refreshStamps();
        this.renderCategories();
        this.renderGrid();
        const warns = (out.warnings ?? []).length;
        this.flashStatus(`Uploaded '${out.stamp.slug}' (${out.stamp.tileCount} tile${out.stamp.tileCount === 1 ? "" : "s"}${warns ? `, ${warns} warning${warns === 1 ? "" : "s"}` : ""})`);
      } catch (err) {
        this.flashStatus(`Upload failed: ${(err as Error).message}`);
      }
    };
    input.click();
  }

  /** Right-pane detail for a stamp (distinct from per-tile detail). Shows
   *  a large composite preview, slug/dimensions/tile-count, a Place on map
   *  button, and a Delete button. */
  private renderStampDetail(stamp: StampDef): void {
    this.dEmpty.style.display = "none";
    this.dContent.hidden = true;
    this.bulkPane.hidden = true;
    this.stopDetailAnim();

    // Overload the "empty" pane as a stamp info pane — simpler than adding
    // dedicated DOM. Real refactor: add a third pane container.
    this.dEmpty.style.display = "block";
    this.dEmpty.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding: 4px;";

    const h = document.createElement("div");
    h.innerHTML = `<strong>${escapeHtml(stamp.name)}</strong>`;
    h.style.cssText = "font-size: 14px;";
    wrap.appendChild(h);

    const meta = document.createElement("div");
    meta.style.cssText = "font-size: 11px; color: #aaa; line-height: 1.5;";
    meta.innerHTML =
      `Slug: <code>${stamp.slug}</code><br>` +
      `Dimensions: ${stamp.width} × ${stamp.height} tiles<br>` +
      `Tile count: ${stamp.tiles.length}<br>` +
      (stamp.category ? `Category: ${stamp.category}<br>` : "") +
      (stamp.description ? `${escapeHtml(stamp.description)}<br>` : "");
    wrap.appendChild(meta);

    const preview = document.createElement("canvas");
    preview.width  = Math.max(1, stamp.width * 16);
    preview.height = Math.max(1, stamp.height * 16);
    preview.style.cssText = `
      width: 100%; max-width: 100%; image-rendering: pixelated;
      background: repeating-conic-gradient(#242424 0 25%, #1c1c1c 0 50%) 0 0/8px 8px;
      border: 1px solid #333; border-radius: 2px;
    `;
    const ctx = preview.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      drawStampComposite(ctx, stamp, this.index);
    }
    wrap.appendChild(preview);

    const placeBtn = document.createElement("button");
    placeBtn.textContent = "Place on map";
    placeBtn.className = "primary";
    placeBtn.addEventListener("click", () => {
      this.onPickStamp?.(stamp);
      this.close();
    });
    wrap.appendChild(placeBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete stamp";
    delBtn.style.background = "#5a2020";
    delBtn.style.color = "#fee";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete stamp '${stamp.name}'? This cannot be undone.`)) return;
      const res = await fetch(`/api/stamps/${encodeURIComponent(stamp.slug)}`, { method: "DELETE" });
      if (!res.ok) {
        this.flashStatus(`Delete failed: ${res.statusText}`);
        return;
      }
      await refreshStamps();
      this.renderCategories();
      this.renderGrid();
      this.showDetailEmpty();
      this.flashStatus(`Deleted '${stamp.name}'`);
    });
    wrap.appendChild(delBtn);

    this.dEmpty.appendChild(wrap);
  }

  /** Lazily paint a tile cell's canvas on first viewport intersection.
   *  Idempotent: if `dataset.painted === "1"` we skip. Registers animated
   *  tiles into `this.tiles` so the RAF loop animates them. */
  private paintCell(cell: HTMLDivElement): void {
    if (cell.dataset.painted === "1") return;
    const idx = +(cell.dataset.idx ?? "-1");
    const entry = this.gridEntries[idx];
    if (!entry) return;
    const meta = this.index.getTileset(entry.tileset);
    if (!meta || !meta.image) return;

    const cnv = document.createElement("canvas");
    cnv.width  = meta.tilewidth;
    cnv.height = meta.tileheight;
    const ctx = cnv.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawTile(ctx, meta, entry, 0);
    cell.appendChild(cnv);

    if (entry.animation && entry.animation.length > 1) {
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = "AN";
      cell.appendChild(badge);
      this.tiles.push({
        entry,
        canvas: cnv,
        ctx,
        meta,
        frameIdx: 0,
        nextAt:   performance.now() + entry.animation[0].duration,
      });
      // Ensure the animation RAF is running now that we have a new animated
      // tile in the viewport.
      this.startAnimations();
    }

    cell.dataset.painted = "1";
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  private startAnimations(): void {
    if (this.animRunning) return;
    if (this.tiles.length === 0 && !this.dAnim) return;
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
      // Detail pane preview tick
      if (this.dAnim) {
        const d = this.dAnim;
        const frames = d.entry.animation!;
        if (now >= d.nextAt) {
          d.frameIdx = (d.frameIdx + 1) % frames.length;
          d.nextAt   = now + frames[d.frameIdx].duration;
          drawTile(d.ctx, d.meta, d.entry, d.frameIdx);
        }
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
// Stamp composite rendering — paints all tiles of a stamp into one canvas.
// -----------------------------------------------------------------------------

/** Draw every tile in `stamp` onto `ctx`, preserving layer z-order so
 *  canopy renders over walls over decor over ground. Uses the first frame
 *  of any animated tiles (no runtime animation in previews). Missing
 *  tilesets render as transparent. */
export function drawStampComposite(
  ctx: CanvasRenderingContext2D,
  stamp: StampDef,
  index: TilesetIndex,
): void {
  const sorted = [...stamp.tiles].sort((a, b) => (LAYER_Z[a.layer] ?? 0) - (LAYER_Z[b.layer] ?? 0));
  ctx.imageSmoothingEnabled = false;
  for (const t of sorted) {
    const meta = index.getTileset(t.tileset);
    if (!meta || !meta.image) continue;
    const col = t.tileId % meta.columns;
    const row = Math.floor(t.tileId / meta.columns);
    const sx = col * meta.tilewidth;
    const sy = row * meta.tileheight;
    // Destination in composite pixels: one stamp grid cell = 16×16. For
    // tiles that span more than 1×1 (e.g. 32×32 wall), paint at the
    // stamp-grid origin, letting the larger tile visually occupy the
    // expected area. We don't scale — sprite pixels land 1:1.
    ctx.drawImage(
      meta.image,
      sx, sy, meta.tilewidth, meta.tileheight,
      t.x * 16, t.y * 16, meta.tilewidth, meta.tileheight,
    );
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
