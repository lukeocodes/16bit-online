/**
 * HUD controller for the world builder.
 *
 * Owns the top bar (zone name + mode), the bottom toolbar (Tiles / Erase /
 * Rotate / Layer / Command), and the command input bar. Exposes event
 * callbacks the scene can subscribe to.
 */
import type { TilesetIndex } from "./TilesetIndex.js";
import type { PlacedTile } from "./TileOverlay.js";
import { drawTile } from "./TilePicker.js";

type Mode  = "place" | "erase" | "block";
type Layer = "ground" | "decor" | "walls" | "canopy";

export class BuilderHud {
  private topbarZone   = document.getElementById("topbar-zone")!;
  private topbarMode   = document.getElementById("topbar-mode")!;
  private btnTiles     = document.getElementById("btn-tiles")!;
  private btnErase     = document.getElementById("btn-erase")!;
  private btnBlocks    = document.getElementById("btn-blocks")!;
  private btnRotate    = document.getElementById("btn-rotate")!;
  private btnCmd       = document.getElementById("btn-cmd")!;
  private layerGroup   = document.getElementById("layer-group")!;
  private brushPreview = document.querySelector<HTMLCanvasElement>("#brush-preview canvas")!;
  private brushLabel   = document.getElementById("brush-label")!;
  private cmdbar       = document.getElementById("cmdbar")!;
  private cmdInput     = document.getElementById("cmdbar-input") as HTMLInputElement;

  private onTilesClick:   (() => void) | null = null;
  private onEraseToggle:  (() => void) | null = null;
  private onBlocksToggle: (() => void) | null = null;
  private onRotate:       (() => void) | null = null;
  private onLayerChange:  ((layer: Layer) => void) | null = null;
  private onCmd:          ((cmd: string) => void) | null = null;

  /** Ghost animation timer for the brush preview. */
  private previewState: {
    tiles: TilesetIndex | null;
    tileset: string; tileId: number;
    frameIdx: number; nextAt: number;
    rafId: number | null;
  } = { tiles: null, tileset: "", tileId: -1, frameIdx: 0, nextAt: 0, rafId: null };

  constructor() {
    this.btnTiles.addEventListener("click",  () => this.onTilesClick?.());
    this.btnErase.addEventListener("click",  () => this.onEraseToggle?.());
    this.btnBlocks.addEventListener("click", () => this.onBlocksToggle?.());
    this.btnRotate.addEventListener("click", () => this.onRotate?.());
    this.btnCmd.addEventListener("click",    () => this.openCommand());

    for (const btn of this.layerGroup.querySelectorAll<HTMLButtonElement>("button[data-layer]")) {
      btn.addEventListener("click", () => {
        const l = (btn.dataset.layer || "ground") as Layer;
        this.setLayer(l);
        this.onLayerChange?.(l);
      });
    }

    this.cmdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = this.cmdInput.value.trim();
        this.cmdInput.value = "";
        this.closeCommand();
        if (v) this.onCmd?.(v);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.cmdInput.value = "";
        this.closeCommand();
      }
    });
  }

  setOnTilesClick(h: () => void)   { this.onTilesClick = h; }
  setOnEraseToggle(h: () => void)  { this.onEraseToggle = h; }
  setOnBlocksToggle(h: () => void) { this.onBlocksToggle = h; }
  setOnRotate(h: () => void)       { this.onRotate = h; }
  setOnLayerChange(h: (l: Layer) => void) { this.onLayerChange = h; }
  setOnCmd(h: (c: string) => void) { this.onCmd = h; }

  setZone(name: string) { this.topbarZone.textContent = name; }

  setMode(m: Mode) {
    this.topbarMode.textContent = m.toUpperCase();
    this.topbarMode.classList.toggle("delete", m === "erase");
    this.topbarMode.classList.toggle("block",  m === "block");
    this.btnErase.classList.toggle("active",  m === "erase");
    this.btnBlocks.classList.toggle("active", m === "block");
  }

  setLayer(l: string) {
    for (const btn of this.layerGroup.querySelectorAll<HTMLButtonElement>("button[data-layer]")) {
      btn.classList.toggle("active", btn.dataset.layer === l);
    }
  }

  /** Show a short-lived "selected tile" chip in the brush slot. Clears when
   *  selection goes away. Distinct from brush: the selected tile stays in
   *  the world, whereas the brush is "about to be placed". */
  setSelection(tiles: TilesetIndex, selected: PlacedTile | null): void {
    const ctx = this.brushPreview.getContext("2d");
    if (!ctx) return;
    this.stopPreviewAnim();
    ctx.clearRect(0, 0, this.brushPreview.width, this.brushPreview.height);
    if (!selected) {
      // Fall back to brush display if there's no selection.
      this.brushLabel.textContent = "none";
      this.brushLabel.classList.add("none");
      return;
    }
    const meta  = tiles.getTileset(selected.tileset);
    const entry = tiles.find(selected.tileset, selected.tileId);
    if (!meta || !entry) {
      this.brushLabel.textContent = `${selected.tileset}#${selected.tileId}`;
      return;
    }
    this.brushLabel.textContent = `selected: ${meta.name} #${selected.tileId} (${selected.rotation}°) @ ${selected.x},${selected.y} [${selected.layer}]`;
    this.brushLabel.classList.remove("none");
    this.brushPreview.width  = meta.tilewidth;
    this.brushPreview.height = meta.tileheight;
    drawTile(ctx, meta, entry, 0);
    if (entry.animation && entry.animation.length > 1) {
      this.previewState = {
        tiles, tileset: selected.tileset, tileId: selected.tileId,
        frameIdx: 0, nextAt: performance.now() + entry.animation[0].duration,
        rafId: null,
      };
      this.runPreviewAnim();
    }
  }

  /** Update the brush-preview canvas to reflect the currently held tile. */
  setBrush(
    tiles: TilesetIndex,
    brush: { tileset: string; tileId: number; rotation: number } | null,
  ): void {
    const ctx = this.brushPreview.getContext("2d");
    if (!ctx) return;
    this.stopPreviewAnim();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.brushPreview.width, this.brushPreview.height);

    if (!brush) {
      this.brushLabel.textContent = "none";
      this.brushLabel.classList.add("none");
      return;
    }

    const meta  = tiles.getTileset(brush.tileset);
    const entry = tiles.find(brush.tileset, brush.tileId);
    if (!meta || !entry) {
      this.brushLabel.textContent = `${brush.tileset}#${brush.tileId}`;
      return;
    }
    this.brushLabel.textContent = `${meta.name} #${brush.tileId} (${brush.rotation}°)`;
    this.brushLabel.classList.remove("none");

    // Size the canvas to the tile native size (CSS upscales via pixelated).
    this.brushPreview.width  = meta.tilewidth;
    this.brushPreview.height = meta.tileheight;

    drawTile(ctx, meta, entry, 0);

    if (entry.animation && entry.animation.length > 1) {
      this.previewState = {
        tiles, tileset: brush.tileset, tileId: brush.tileId,
        frameIdx: 0, nextAt: performance.now() + entry.animation[0].duration,
        rafId: null,
      };
      this.runPreviewAnim();
    }
  }

  // -------------------------------------------------------------------------
  // Command bar
  // -------------------------------------------------------------------------

  isCommandOpen(): boolean { return this.cmdbar.classList.contains("open"); }

  openCommand(): void {
    this.cmdbar.classList.add("open");
    this.cmdInput.focus();
  }

  closeCommand(): void {
    this.cmdbar.classList.remove("open");
    this.cmdInput.blur();
  }

  // -------------------------------------------------------------------------
  // Toasts
  // -------------------------------------------------------------------------

  showToast(msg: string, isError = false): void {
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      position:   "fixed",
      left:       "50%",
      bottom:     "60px",
      transform:  "translateX(-50%)",
      background: isError ? "rgba(220,60,60,0.92)" : "rgba(30,30,30,0.92)",
      color:      "#fff",
      padding:    "8px 14px",
      borderRadius: "4px",
      zIndex:     "100",
      fontSize:   "12px",
      maxWidth:   "520px",
      pointerEvents: "none",
      transition: "opacity 0.3s",
    } as CSSStyleDeclaration);
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; }, 2000);
    setTimeout(() => { el.remove(); }, 2400);
  }

  // -------------------------------------------------------------------------
  // Private — animated preview tick
  // -------------------------------------------------------------------------

  private runPreviewAnim(): void {
    const s = this.previewState;
    if (!s.tiles) return;
    const ctx = this.brushPreview.getContext("2d");
    if (!ctx) return;
    const meta  = s.tiles.getTileset(s.tileset);
    const entry = s.tiles.find(s.tileset, s.tileId);
    if (!meta || !entry || !entry.animation) return;

    const tick = () => {
      if (!s.tiles || s.tileId < 0) return;
      const now = performance.now();
      if (now >= s.nextAt) {
        s.frameIdx = (s.frameIdx + 1) % entry.animation!.length;
        s.nextAt = now + entry.animation![s.frameIdx].duration;
        drawTile(ctx, meta, entry, s.frameIdx);
      }
      s.rafId = requestAnimationFrame(tick);
    };
    s.rafId = requestAnimationFrame(tick);
  }

  private stopPreviewAnim(): void {
    const s = this.previewState;
    if (s.rafId != null) cancelAnimationFrame(s.rafId);
    s.rafId = null;
    s.tiles = null;
    s.tileId = -1;
  }
}
