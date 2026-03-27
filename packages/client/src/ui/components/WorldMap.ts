/**
 * World Map overlay — full-screen map toggled with M key.
 * Supports Tiled map data (tile-level) or procedural biome data (chunk-level).
 */

// Tiled GID → RGB color (same as MiniMap)
const TILED_COLORS: Record<number, [number, number, number]> = {
  1:  [77, 140, 60],     // grass
  2:  [160, 130, 80],    // dirt
  3:  [170, 170, 175],   // stone
  4:  [210, 190, 130],   // sand
  5:  [40, 80, 180],     // water
  6:  [15, 30, 90],      // deep_water
  7:  [50, 100, 40],     // forest_floor
  8:  [230, 230, 240],   // snow
  9:  [70, 90, 50],      // swamp
  10: [130, 120, 110],   // mountain_rock
  11: [180, 150, 100],   // path
  12: [55, 110, 45],     // grass_dark
};

const TILED_NAMES: Record<number, string> = {
  1: "Grass", 2: "Dirt", 3: "Stone", 4: "Sand", 5: "Water",
  6: "Deep Water", 7: "Forest", 8: "Snow", 9: "Swamp",
  10: "Mountain", 11: "Path", 12: "Dark Grass",
};

// Procedural biome fallback
const BIOME_COLORS: [number, number, number][] = [
  [13, 26, 77], [26, 51, 115], [194, 179, 128], [77, 128, 51],
  [38, 102, 38], [20, 71, 20], [31, 77, 46], [115, 107, 102],
  [230, 230, 235], [140, 148, 128], [199, 173, 102], [140, 128, 77],
  [64, 77, 38], [102, 115, 77], [102, 140, 64], [77, 107, 51],
  [38, 64, 128], [31, 56, 122],
];

export class WorldMap {
  private overlay: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private biomeData: Uint8Array | null = null;
  private worldWidth = 900;
  private worldHeight = 900;
  private playerTileX = 0;
  private playerTileZ = 0;
  private visible = false;
  private mapImage: ImageData | null = null;

  // Tiled map data
  private tiledGround: number[] | null = null;
  private tiledWidth = 0;
  private tiledHeight = 0;

  setBiomeData(data: Uint8Array, width: number, height: number) {
    this.biomeData = data;
    this.worldWidth = width;
    this.worldHeight = height;
    this.mapImage = null;
  }

  setTiledData(groundData: number[], width: number, height: number) {
    this.tiledGround = groundData;
    this.tiledWidth = width;
    this.tiledHeight = height;
    this.mapImage = null;
  }

  updatePlayerPosition(worldX: number, worldZ: number) {
    this.playerTileX = Math.round(worldX);
    this.playerTileZ = Math.round(worldZ);
    if (this.visible) this.draw();
  }

  toggle() {
    this.visible = !this.visible;
    if (this.overlay) {
      this.overlay.style.display = this.visible ? "flex" : "none";
      if (this.visible) this.draw();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  render(): HTMLElement {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: absolute; inset: 0; display: none;
      background: rgba(0, 0, 0, 0.85);
      justify-content: center; align-items: center;
      pointer-events: auto; z-index: 100;
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      position: relative; background: #0d1117;
      border: 2px solid #444; border-radius: 12px;
      padding: 16px; max-width: 90vw; max-height: 90vh;
    `;

    const titleBar = document.createElement("div");
    titleBar.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px;
    `;

    const title = document.createElement("div");
    title.textContent = "World Map";
    title.style.cssText = "font-size: 16px; font-weight: 600; color: #e0e0e0;";

    const hint = document.createElement("div");
    hint.textContent = "Press M or Esc to close";
    hint.style.cssText = "font-size: 11px; color: #666;";

    titleBar.append(title, hint);
    panel.appendChild(titleBar);

    const canvasWrap = document.createElement("div");
    canvasWrap.style.cssText = "position: relative; display: inline-block;";

    this.canvas = document.createElement("canvas");
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.canvas.style.cssText = `
      width: min(70vw, 70vh); height: min(70vw, 70vh);
      border-radius: 4px; image-rendering: pixelated;
    `;
    this.ctx = this.canvas.getContext("2d")!;
    canvasWrap.appendChild(this.canvas);
    panel.appendChild(canvasWrap);

    // Legend
    const legend = document.createElement("div");
    legend.style.cssText = `
      display: flex; flex-wrap: wrap; gap: 6px 12px;
      margin-top: 12px; max-width: 512px;
    `;
    this.buildLegend(legend);
    panel.appendChild(legend);

    this.overlay.appendChild(panel);

    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.toggle();
    });

    return this.overlay;
  }

  private buildLegend(container: HTMLElement) {
    const colors = this.tiledGround ? TILED_COLORS : null;
    const entries = colors
      ? Object.entries(TILED_NAMES).map(([id, name]) => ({ id: Number(id), name, color: TILED_COLORS[Number(id)] }))
      : [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].map(id => ({
          id, name: ["","","Beach","Grassland","Forest","Dense Forest","Boreal Forest","Mountain","Snow","Tundra","Desert","Scrubland","Swamp","Highland","Meadow","River Valley","River","Lake"][id],
          color: BIOME_COLORS[id],
        }));

    for (const entry of entries) {
      if (!entry.color) continue;
      const item = document.createElement("div");
      item.style.cssText = "display: flex; align-items: center; gap: 4px;";

      const swatch = document.createElement("div");
      const [r, g, b] = entry.color;
      swatch.style.cssText = `
        width: 10px; height: 10px; border-radius: 2px;
        background: rgb(${r},${g},${b}); border: 1px solid #555;
      `;

      const label = document.createElement("span");
      label.textContent = entry.name;
      label.style.cssText = "font-size: 10px; color: #999;";

      item.append(swatch, label);
      container.appendChild(item);
    }
  }

  private draw() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Render the full map image once, then cache
    if (!this.mapImage) {
      const img = ctx.createImageData(cw, ch);
      const data = img.data;

      if (this.tiledGround) {
        this.renderTiledImage(data, cw, ch);
      } else if (this.biomeData) {
        this.renderProceduralImage(data, cw, ch);
      }
      this.mapImage = img;
    }

    ctx.putImageData(this.mapImage, 0, 0);

    // Player marker
    let px: number, py: number;
    if (this.tiledGround) {
      px = (this.playerTileX / this.tiledWidth) * cw;
      py = (this.playerTileZ / this.tiledHeight) * ch;
    } else {
      const chunkX = Math.floor(this.playerTileX / 32);
      const chunkZ = Math.floor(this.playerTileZ / 32);
      px = (chunkX / this.worldWidth) * cw;
      py = (chunkZ / this.worldHeight) * ch;
    }

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "11px monospace";
    const label = `(${this.playerTileX}, ${this.playerTileZ})`;
    ctx.fillText(label, Math.min(px + 10, cw - 80), py - 8);
  }

  private renderTiledImage(data: Uint8ClampedArray, cw: number, ch: number) {
    if (!this.tiledGround) return;
    const scaleX = this.tiledWidth / cw;
    const scaleY = this.tiledHeight / ch;

    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        const tx = Math.floor(px * scaleX);
        const tz = Math.floor(py * scaleY);
        const gid = this.tiledGround[tz * this.tiledWidth + tx];
        const color = TILED_COLORS[gid] || [10, 15, 40];

        const i = (py * cw + px) * 4;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 255;
      }
    }
  }

  private renderProceduralImage(data: Uint8ClampedArray, cw: number, ch: number) {
    if (!this.biomeData) return;
    const scaleX = this.worldWidth / cw;
    const scaleY = this.worldHeight / ch;

    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        const cx = Math.floor(px * scaleX);
        const cz = Math.floor(py * scaleY);
        const biome = this.biomeData[cz * this.worldWidth + cx];
        const color = BIOME_COLORS[biome] || BIOME_COLORS[0];

        const i = (py * cw + px) * 4;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 255;
      }
    }
  }

  dispose() {
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.mapImage = null;
  }
}
