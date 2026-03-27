/**
 * Generates Float16 height buffers for 32x32 tile chunks.
 * Each chunk is 2048 bytes (1024 tiles * 2 bytes per Float16).
 *
 * Heights are computed per-tile using the terrain noise pipeline
 * and encoded as little-endian Float16 for compact transfer.
 */

import { generateTileHeight } from "./terrain-noise.js";
import { CHUNK_SIZE } from "./constants.js";
import type { WorldMap } from "./types.js";

/**
 * Generate a Float16 height buffer for a single chunk.
 *
 * @param chunkX - Chunk X coordinate in world space
 * @param chunkZ - Chunk Z coordinate in world space
 * @param worldMap - World map data (elevation, biomeMap)
 * @param perm - Permutation table from initServerNoise()
 * @returns Buffer of CHUNK_SIZE * CHUNK_SIZE * 2 bytes (2048) containing Float16 heights
 */
export function generateChunkHeights(
  chunkX: number,
  chunkZ: number,
  worldMap: WorldMap,
  perm: Uint8Array,
): Buffer {
  const tileCount = CHUNK_SIZE * CHUNK_SIZE;
  const buf = Buffer.alloc(tileCount * 2); // 2 bytes per Float16
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // Read per-chunk continental elevation and biome from world map
  const idx = chunkZ * worldMap.width + chunkX;
  const continentalElev = worldMap.elevation[idx] ?? 0;
  const biomeId = worldMap.biomeMap[idx] ?? 0;

  // Get region center for peak-focused mountain generation
  const regionId = worldMap.regionMap[idx] ?? 0;
  const region = worldMap.regions[regionId];
  // Region center in tile coordinates (region centers are in chunk coords)
  const peakTileX = region ? region.centerX * CHUNK_SIZE + CHUNK_SIZE / 2 : 0;
  const peakTileZ = region ? region.centerZ * CHUNK_SIZE + CHUNK_SIZE / 2 : 0;

  for (let tz = 0; tz < CHUNK_SIZE; tz++) {
    for (let tx = 0; tx < CHUNK_SIZE; tx++) {
      const tileX = chunkX * CHUNK_SIZE + tx;
      const tileZ = chunkZ * CHUNK_SIZE + tz;
      const height = generateTileHeight(tileX, tileZ, continentalElev, biomeId, perm, peakTileX, peakTileZ);
      view.setFloat16((tz * CHUNK_SIZE + tx) * 2, height, true); // little-endian
    }
  }

  return buf;
}
