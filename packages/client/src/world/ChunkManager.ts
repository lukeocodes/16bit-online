import { CHUNK_SIZE, TILE_SIZE, CHUNK_LOAD_RADIUS, WORLD_WIDTH, WORLD_HEIGHT, ELEVATION_STEP_HEIGHT } from "./WorldConstants";
import { getTileType } from "./TileRegistry";

export class ChunkManager {
  /** Tracks which chunks have been loaded (by key) */
  private loadedChunks = new Set<string>();
  private mapId: number;

  // World map data (loaded at startup from server)
  private biomeData: Uint8Array | null = null;
  /** Pre-computed elevation bands (0-6) per chunk from server */
  private elevationBands: Uint8Array | null = null;
  /** Per-chunk region ID for region-coherent terrain profiles */
  private regionMap: Uint16Array | null = null;
  /** Compact region ID -> biome lookup */
  private regionBiomes: Uint8Array | null = null;

  /** Per-chunk tile heights from server: key = "cx:cz", value = Float32Array(1024) */
  private chunkHeights = new Map<string, Float32Array>();
  /** Callback to request chunks from server */
  private chunkRequestFn: ((cx: number, cz: number) => void) | null = null;
  /** Set of chunk keys already requested (prevents duplicate requests) */
  private pendingChunkRequests = new Set<string>();
  /** Callback when new chunk data arrives (for terrain renderer invalidation) */
  private onChunkLoadedFn: (() => void) | null = null;

  constructor(mapId = 1) {
    this.mapId = mapId;
  }

  getBiomeData(): Uint8Array | null { return this.biomeData; }

  setChunkRequestFn(fn: (cx: number, cz: number) => void) { this.chunkRequestFn = fn; }

  setOnChunkLoaded(fn: () => void): void { this.onChunkLoadedFn = fn; }

  setChunkHeights(cx: number, cz: number, heights: Float32Array): void {
    const key = `${cx}:${cz}`;
    this.chunkHeights.set(key, heights);
    this.pendingChunkRequests.delete(key);
    this.onChunkLoadedFn?.();
  }

  setWorldData(biomeMap: Uint8Array, elevationBands: Uint8Array, regionMap?: Uint16Array, regionBiomes?: Uint8Array) {
    this.biomeData = biomeMap;
    this.elevationBands = elevationBands;
    if (regionMap) this.regionMap = regionMap;
    if (regionBiomes) this.regionBiomes = regionBiomes;
  }

  /** Raw per-tile height from server data (no smoothing) */
  getRawTileY(worldX: number, worldZ: number): number {
    const tx = Math.floor(worldX);
    const tz = Math.floor(worldZ);
    const chunkX = Math.floor(tx / CHUNK_SIZE);
    const chunkZ = Math.floor(tz / CHUNK_SIZE);
    const key = `${chunkX}:${chunkZ}`;
    const heights = this.chunkHeights.get(key);
    if (heights) {
      const localX = tx - chunkX * CHUNK_SIZE;
      const localZ = tz - chunkZ * CHUNK_SIZE;
      const clampedX = Math.max(0, Math.min(CHUNK_SIZE - 1, localX));
      const clampedZ = Math.max(0, Math.min(CHUNK_SIZE - 1, localZ));
      return heights[clampedZ * CHUNK_SIZE + clampedX];
    }
    return this.getChunkElevationBand(chunkX, chunkZ) * ELEVATION_STEP_HEIGHT;
  }

  /**
   * Get terrain Y matching the heightmap mesh surface exactly.
   * Uses the same 4-corner averaging as TilePool vertices:
   * each corner = avg of 4 tiles, center = avg of 4 corners.
   * Result: 3x3 weighted kernel [1,2,1; 2,4,2; 1,2,1] / 16.
   */
  getTerrainY(worldX: number, worldZ: number): number {
    const tx = Math.floor(worldX);
    const tz = Math.floor(worldZ);
    return (
      this.getRawTileY(tx - 1, tz - 1) + 2 * this.getRawTileY(tx, tz - 1) + this.getRawTileY(tx + 1, tz - 1) +
      2 * this.getRawTileY(tx - 1, tz) + 4 * this.getRawTileY(tx, tz) + 2 * this.getRawTileY(tx + 1, tz) +
      this.getRawTileY(tx - 1, tz + 1) + 2 * this.getRawTileY(tx, tz + 1) + this.getRawTileY(tx + 1, tz + 1)
    ) / 16;
  }

  /** Get the region's biome for a chunk coordinate (consistent across entire region) */
  getRegionBiome(chunkX: number, chunkY: number): number {
    if (this.regionMap && this.regionBiomes &&
        chunkX >= 0 && chunkX < WORLD_WIDTH && chunkY >= 0 && chunkY < WORLD_HEIGHT) {
      const regionId = this.regionMap[chunkY * WORLD_WIDTH + chunkX];
      return this.regionBiomes[regionId] ?? 0;
    }
    return this.getChunkBiome(chunkX, chunkY);
  }

  /** Get the discrete elevation band (0-6) for a chunk coordinate */
  getChunkElevationBand(chunkX: number, chunkY: number): number {
    if (!this.elevationBands || chunkX < 0 || chunkX >= WORLD_WIDTH || chunkY < 0 || chunkY >= WORLD_HEIGHT) {
      return 0;
    }
    return this.elevationBands[chunkY * WORLD_WIDTH + chunkX];
  }

  updatePlayerPosition(worldX: number, worldZ: number) {
    const chunkX = Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE));
    const chunkY = Math.floor(worldZ / (CHUNK_SIZE * TILE_SIZE));

    // Request chunk heights in radius
    for (let dx = -CHUNK_LOAD_RADIUS; dx <= CHUNK_LOAD_RADIUS; dx++) {
      for (let dy = -CHUNK_LOAD_RADIUS; dy <= CHUNK_LOAD_RADIUS; dy++) {
        const cx = chunkX + dx;
        const cy = chunkY + dy;
        const key = `${cx}:${cy}`;
        this.loadedChunks.add(`${this.mapId}:${cx}:${cy}:0`);
        if (!this.chunkHeights.has(key) && !this.pendingChunkRequests.has(key) && this.chunkRequestFn) {
          this.pendingChunkRequests.add(key);
          this.chunkRequestFn(cx, cy);
        }
      }
    }

    // Unload chunks outside radius + 1 buffer
    for (const loadedKey of this.loadedChunks) {
      const parts = loadedKey.split(":");
      const cx = Number(parts[1]);
      const cy = Number(parts[2]);
      const dist = Math.max(Math.abs(cx - chunkX), Math.abs(cy - chunkY));
      if (dist > CHUNK_LOAD_RADIUS + 1) {
        this.loadedChunks.delete(loadedKey);
        const hkey = `${cx}:${cy}`;
        this.chunkHeights.delete(hkey);
        this.pendingChunkRequests.delete(hkey);
      }
    }
  }

  dispose() {
    this.loadedChunks.clear();
    this.chunkHeights.clear();
    this.pendingChunkRequests.clear();
  }

  /** Check if a world tile position is walkable based on biome */
  isWalkable(worldX: number, worldZ: number): boolean {
    const biome = this.getChunkBiome(
      Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE)),
      Math.floor(worldZ / (CHUNK_SIZE * TILE_SIZE)),
    );
    return getTileType(biome).walkable;
  }

  /** Get the biome ID at a world tile position */
  getBiomeAt(worldX: number, worldZ: number): number {
    return this.getChunkBiome(
      Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE)),
      Math.floor(worldZ / (CHUNK_SIZE * TILE_SIZE)),
    );
  }

  /** Get the discrete elevation band (0-6) for a world tile position */
  getElevationBandAt(worldX: number, worldZ: number): number {
    return this.getChunkElevationBand(
      Math.floor(worldX / (CHUNK_SIZE * TILE_SIZE)),
      Math.floor(worldZ / (CHUNK_SIZE * TILE_SIZE)),
    );
  }

  private getChunkBiome(chunkX: number, chunkY: number): number {
    if (this.biomeData && chunkX >= 0 && chunkX < WORLD_WIDTH && chunkY >= 0 && chunkY < WORLD_HEIGHT) {
      return this.biomeData[chunkY * WORLD_WIDTH + chunkX];
    }
    return 0; // deep ocean fallback
  }

}
