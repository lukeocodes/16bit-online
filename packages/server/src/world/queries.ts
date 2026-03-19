import { generateWorld } from "./worldgen.js";
import type { WorldMap, Region, Continent, WorldConfig } from "./types.js";

let worldMap: WorldMap | null = null;

/**
 * Initialize the world map from a seed. Call once at server startup.
 * Generates the complete world synchronously (~100-500ms).
 */
export function initWorldMap(seed: number, config?: Partial<WorldConfig>): void {
  const start = performance.now();
  worldMap = generateWorld(seed, config);
  const elapsed = (performance.now() - start).toFixed(0);
  console.log(
    `[World] Map initialized in ${elapsed}ms: ` +
      `${worldMap.continents.length} continents, ` +
      `${worldMap.regions.length} regions`,
  );
}

/** Get the full world map. Returns null if not initialized. */
export function getWorldMap(): WorldMap | null {
  return worldMap;
}

/** Get the region containing the given chunk. Returns null if out of bounds. */
export function getRegionForChunk(cx: number, cz: number): Region | null {
  if (!worldMap) return null;
  if (cx < 0 || cx >= worldMap.width || cz < 0 || cz >= worldMap.height)
    return null;
  const regionId = worldMap.regionMap[cz * worldMap.width + cx];
  return worldMap.regions[regionId] ?? null;
}

/** Get the continent containing the given chunk. Returns null if ocean or out of bounds. */
export function getContinentForChunk(cx: number, cz: number): Continent | null {
  if (!worldMap) return null;
  if (cx < 0 || cx >= worldMap.width || cz < 0 || cz >= worldMap.height)
    return null;
  const continentIdx = worldMap.continentMap[cz * worldMap.width + cx];
  if (continentIdx === 0) return null; // ocean
  return worldMap.continents[continentIdx - 1] ?? null;
}

/** Get the biome type for the given chunk. Returns DEEP_OCEAN (0) if out of bounds or uninitialized. */
export function getBiomeForChunk(cx: number, cz: number): number {
  if (!worldMap) return 0; // DEEP_OCEAN
  if (cx < 0 || cx >= worldMap.width || cz < 0 || cz >= worldMap.height)
    return 0;
  return worldMap.biomeMap[cz * worldMap.width + cx];
}

/** Get a region by its ID. Returns null if invalid or uninitialized. */
export function getRegionById(id: number): Region | null {
  if (!worldMap) return null;
  if (id < 0) return null;
  return worldMap.regions[id] ?? null;
}
