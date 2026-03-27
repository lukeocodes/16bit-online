import { getWorldMap, getServerNoisePerm } from "./queries.js";
import { BiomeType } from "./types.js";
import { CHUNK_SIZE } from "./constants.js";
import { generateTileHeight } from "./terrain-noise.js";
import { isInTiledMap, isTiledWalkable } from "./tiled-map.js";

// Biomes that block all movement (player and NPC)
export const BLOCKING_BIOMES = new Set<number>([
  BiomeType.DEEP_OCEAN,
  BiomeType.SHALLOW_OCEAN,
  BiomeType.SNOW_PEAK,
  BiomeType.RIVER,
  BiomeType.LAKE,
]);

// 7 elevation bands quantizing the 0.0-1.0 continuous elevation range
export const ELEVATION_BANDS = [
  { min: 0.00, max: 0.15, level: 0, name: "deep_water" },
  { min: 0.15, max: 0.30, level: 1, name: "shallow_water" },
  { min: 0.30, max: 0.45, level: 2, name: "lowland" },
  { min: 0.45, max: 0.60, level: 3, name: "plains" },
  { min: 0.60, max: 0.75, level: 4, name: "highland" },
  { min: 0.75, max: 0.90, level: 5, name: "mountain" },
  { min: 0.90, max: 1.00, level: 6, name: "peak" },
];

export { ELEVATION_STEP_HEIGHT } from "./constants.js";

/**
 * Convert continuous elevation (0.0-1.0) to discrete band level (0-6).
 */
export function getElevationBand(elevation: number): number {
  for (const band of ELEVATION_BANDS) {
    if (elevation < band.max) return band.level;
  }
  return ELEVATION_BANDS[ELEVATION_BANDS.length - 1].level;
}

/**
 * Check if a tile position is walkable.
 * If the tile is within the Tiled map, uses authoritative Tiled collision data.
 * Otherwise, falls back to procedural world biome checks.
 */
export function isWalkable(tileX: number, tileZ: number): boolean {
  // Tiled map area: use authoritative server-side Tiled data
  if (isInTiledMap(tileX, tileZ)) {
    return isTiledWalkable(tileX, tileZ);
  }

  const world = getWorldMap();
  if (!world) return false;

  const chunkX = Math.floor(tileX / CHUNK_SIZE);
  const chunkZ = Math.floor(tileZ / CHUNK_SIZE);

  if (chunkX < 0 || chunkX >= world.width || chunkZ < 0 || chunkZ >= world.height) {
    return false;
  }

  const biome = world.biomeMap[chunkZ * world.width + chunkX];
  return !BLOCKING_BIOMES.has(biome);
}

/**
 * Check if a biome type is walkable (for use without world map context).
 */
export function isBiomeWalkable(biome: number): boolean {
  return !BLOCKING_BIOMES.has(biome);
}

/** Height gradient threshold for movement blocking (world units) */
export const HEIGHT_GRADIENT_THRESHOLD = 0.8;

/**
 * Check if movement between two tiles is allowed based on height gradient.
 * Returns false if the height difference exceeds HEIGHT_GRADIENT_THRESHOLD.
 */
export function isGradientWalkable(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
  const world = getWorldMap();
  if (!world) return true; // Permissive if world not loaded

  let perm: Uint8Array;
  try {
    perm = getServerNoisePerm();
  } catch {
    return true; // Permissive if noise not initialized
  }

  const fromChunkX = Math.floor(fromX / CHUNK_SIZE);
  const fromChunkZ = Math.floor(fromZ / CHUNK_SIZE);
  const toChunkX = Math.floor(toX / CHUNK_SIZE);
  const toChunkZ = Math.floor(toZ / CHUNK_SIZE);

  if (fromChunkX < 0 || fromChunkX >= world.width || fromChunkZ < 0 || fromChunkZ >= world.height) return false;
  if (toChunkX < 0 || toChunkX >= world.width || toChunkZ < 0 || toChunkZ >= world.height) return false;

  const fromElev = world.elevation[fromChunkZ * world.width + fromChunkX];
  const fromBiome = world.biomeMap[fromChunkZ * world.width + fromChunkX];
  const fromY = generateTileHeight(fromX, fromZ, fromElev, fromBiome, perm);

  const toElev = world.elevation[toChunkZ * world.width + toChunkX];
  const toBiome = world.biomeMap[toChunkZ * world.width + toChunkX];
  const toY = generateTileHeight(toX, toZ, toElev, toBiome, perm);

  return Math.abs(toY - fromY) <= HEIGHT_GRADIENT_THRESHOLD;
}
