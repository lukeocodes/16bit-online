import { Container, Graphics } from "pixi.js";
import type { ChunkManager } from "../world/ChunkManager";
import { getTileType, rgbToHex } from "../world/TileRegistry";
import {
  worldToScreen,
  TILE_WIDTH,
  TILE_HEIGHT,
  TILE_WIDTH_HALF,
  TILE_HEIGHT_HALF,
  ELEVATION_PX,
} from "./IsometricRenderer";

/** How many tiles around the player to render */
const RENDER_RADIUS = 18;

/** Deterministic per-tile color variation */
function tileHash(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function varyColor(color: number, variation: number): number {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + Math.round(variation * 255)));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + Math.round(variation * 200)));
  const b = Math.max(0, Math.min(255, (color & 0xff) + Math.round(variation * 128)));
  return (r << 16) | (g << 8) | b;
}

/**
 * Renders terrain tiles as isometric diamonds using PixiJS Graphics.
 * Reads height/biome data from ChunkManager and draws visible tiles
 * around the player with elevation side faces and biome coloring.
 */
export class TerrainRenderer {
  public container: Container;
  private chunkManager: ChunkManager;
  private tileGraphics = new Map<string, Graphics>();
  private lastCenterX = -Infinity;
  private lastCenterZ = -Infinity;
  private needsRefresh = false;

  constructor(chunkManager: ChunkManager) {
    this.chunkManager = chunkManager;
    this.container = new Container();
    this.container.sortableChildren = true;

    // Listen for new chunk data
    chunkManager.setOnChunkLoaded(() => this.invalidate());
  }

  invalidate(): void {
    this.needsRefresh = true;
  }

  update(playerWorldX: number, playerWorldZ: number): void {
    const cx = Math.floor(playerWorldX);
    const cz = Math.floor(playerWorldZ);

    if (cx === this.lastCenterX && cz === this.lastCenterZ && !this.needsRefresh) return;
    this.lastCenterX = cx;
    this.lastCenterZ = cz;
    this.needsRefresh = false;

    // Track which tiles are still visible
    const visibleKeys = new Set<string>();

    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
        // Diamond-shaped render area
        if (Math.abs(dx) + Math.abs(dz) > RENDER_RADIUS * 1.4) continue;

        const tx = cx + dx;
        const tz = cz + dz;
        const key = `${tx},${tz}`;
        visibleKeys.add(key);

        const elevation = this.chunkManager.getRawTileY(tx, tz);
        const biomeId = this.chunkManager.getBiomeAt(tx, tz);
        const tile = getTileType(biomeId);
        const baseColor = rgbToHex(tile.color);
        const variation = tileHash(tx, tz) * 0.15 - 0.075;
        const color = varyColor(baseColor, variation);

        const { sx, sy } = worldToScreen(tx, tz, elevation);

        let g = this.tileGraphics.get(key);
        if (g) {
          // Reuse — just reposition and redraw
          g.clear();
        } else {
          g = new Graphics();
          this.container.addChild(g);
          this.tileGraphics.set(key, g);
        }

        // Draw isometric diamond (top face)
        g.poly([
          { x: 0, y: -TILE_HEIGHT_HALF },
          { x: TILE_WIDTH_HALF, y: 0 },
          { x: 0, y: TILE_HEIGHT_HALF },
          { x: -TILE_WIDTH_HALF, y: 0 },
        ]);
        g.fill(color);

        // Side faces for elevation
        if (elevation > 0.5) {
          const faceHeight = Math.min(elevation, 4) * ELEVATION_PX;
          // Left face
          g.poly([
            { x: -TILE_WIDTH_HALF, y: 0 },
            { x: 0, y: TILE_HEIGHT_HALF },
            { x: 0, y: TILE_HEIGHT_HALF + faceHeight },
            { x: -TILE_WIDTH_HALF, y: faceHeight },
          ]);
          g.fill(darkenColor(color, 0.6));

          // Right face
          g.poly([
            { x: TILE_WIDTH_HALF, y: 0 },
            { x: 0, y: TILE_HEIGHT_HALF },
            { x: 0, y: TILE_HEIGHT_HALF + faceHeight },
            { x: TILE_WIDTH_HALF, y: faceHeight },
          ]);
          g.fill(darkenColor(color, 0.8));
        }

        // Subtle grid line
        g.poly([
          { x: 0, y: -TILE_HEIGHT_HALF },
          { x: TILE_WIDTH_HALF, y: 0 },
          { x: 0, y: TILE_HEIGHT_HALF },
          { x: -TILE_WIDTH_HALF, y: 0 },
        ]);
        g.stroke({ width: 0.5, color: 0x000000, alpha: 0.1 });

        g.position.set(sx, sy);
        g.zIndex = (tx + tz) * 10;
      }
    }

    // Remove tiles no longer visible
    for (const [key, g] of this.tileGraphics) {
      if (!visibleKeys.has(key)) {
        g.destroy();
        this.tileGraphics.delete(key);
      }
    }
  }

  dispose(): void {
    for (const g of this.tileGraphics.values()) {
      g.destroy();
    }
    this.tileGraphics.clear();
    this.container.destroy();
  }
}
