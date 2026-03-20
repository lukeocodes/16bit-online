/**
 * Server-side per-tile procedural elevation by biome.
 * Inline 2D simplex noise with biome-specific terrain profiles.
 * No external dependencies — noise is seeded deterministically.
 *
 * Ported from client TerrainNoise.ts with enhanced biome profiles
 * (mountains steeper, snow peaks extreme, water flat).
 */

// Simplex noise constants
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

// 8 gradient directions for 2D simplex
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
] as const;

/**
 * Initialize permutation table from seed.
 * Returns a 512-element Uint8Array (no module state — pass to functions for testability).
 */
export function initServerNoise(seed: number): Uint8Array {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;

  // Fisher-Yates shuffle with LCG PRNG (identical to client)
  let s = seed & 0x7fffffff;
  if (s === 0) s = 1;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }

  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

/** 2D simplex noise, returns approximately [-1, 1] */
export function noise2d(x: number, y: number, perm: Uint8Array): number {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);

  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);

  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    t0 *= t0;
    const g = GRAD2[perm[ii + perm[jj]] & 7];
    n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    t1 *= t1;
    const g = GRAD2[perm[ii + i1 + perm[jj + j1]] & 7];
    n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    t2 *= t2;
    const g = GRAD2[perm[ii + 1 + perm[jj + 1]] & 7];
    n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
  }

  return 70 * (n0 + n1 + n2);
}

/** Terrain profile controlling noise character per biome */
export interface TerrainProfile {
  amplitude: number;
  frequency: number;
  octaves: number;
}

/** Maps 0.0-1.0 continental elevation to world units (0-8) */
export const CONTINENTAL_SCALE = 8.0;

/**
 * Biome terrain profiles keyed by BiomeType enum value.
 * Enhanced from client version:
 * - Mountains: amplitude 3.5 (was 2.5) for steeper terrain
 * - Snow peaks: amplitude 4.5, frequency 0.14 for extreme impassable walls
 * - Water/beach/swamp: stay flat (0.05-0.2)
 */
export const BIOME_TERRAIN_PROFILES: Record<number, TerrainProfile> = {
  0:  { amplitude: 0.05, frequency: 0.04, octaves: 1 },  // DEEP_OCEAN
  1:  { amplitude: 0.1,  frequency: 0.04, octaves: 1 },  // SHALLOW_OCEAN
  2:  { amplitude: 0.15, frequency: 0.05, octaves: 2 },  // BEACH
  3:  { amplitude: 0.7,  frequency: 0.06, octaves: 2 },  // TEMPERATE_GRASSLAND
  4:  { amplitude: 0.9,  frequency: 0.07, octaves: 2 },  // TEMPERATE_FOREST
  5:  { amplitude: 1.1,  frequency: 0.09, octaves: 3 },  // DENSE_FOREST
  6:  { amplitude: 1.0,  frequency: 0.08, octaves: 2 },  // BOREAL_FOREST
  7:  { amplitude: 3.5,  frequency: 0.12, octaves: 4 },  // MOUNTAIN
  8:  { amplitude: 4.5,  frequency: 0.14, octaves: 4 },  // SNOW_PEAK
  9:  { amplitude: 0.6,  frequency: 0.06, octaves: 2 },  // TUNDRA
  10: { amplitude: 0.5,  frequency: 0.05, octaves: 2 },  // DESERT
  11: { amplitude: 0.7,  frequency: 0.07, octaves: 2 },  // SCRUBLAND
  12: { amplitude: 0.2,  frequency: 0.04, octaves: 1 },  // SWAMP
  13: { amplitude: 1.4,  frequency: 0.10, octaves: 3 },  // HIGHLAND
  14: { amplitude: 0.7,  frequency: 0.06, octaves: 2 },  // MEADOW
  15: { amplitude: 0.2,  frequency: 0.05, octaves: 1 },  // RIVER_VALLEY
  16: { amplitude: 0.05, frequency: 0.04, octaves: 1 },  // RIVER
  17: { amplitude: 0.1,  frequency: 0.04, octaves: 1 },  // LAKE
};

/** Fallback profile for unknown biome IDs */
export const DEFAULT_TERRAIN_PROFILE: TerrainProfile = { amplitude: 0.3, frequency: 0.06, octaves: 2 };

/**
 * Compute per-tile terrain height combining three layers:
 * 1. Continental base: continentalElev * CONTINENTAL_SCALE
 * 2. Regional noise: biome-specific fBm (remapped to [0,1] per octave)
 * 3. Fine detail: high-frequency noise at amplitude 0.1
 *
 * @param tileX - World-space tile X coordinate
 * @param tileZ - World-space tile Z coordinate
 * @param continentalElev - Continental elevation 0.0-1.0 from worldMap.elevation
 * @param biomeId - BiomeType enum value
 * @param perm - Permutation table from initServerNoise()
 * @returns Combined height in world units
 */
export function generateTileHeight(
  tileX: number,
  tileZ: number,
  continentalElev: number,
  biomeId: number,
  perm: Uint8Array,
): number {
  // Layer 1: Continental base
  const base = continentalElev * CONTINENTAL_SCALE;

  // Layer 2: Regional noise (biome-specific fBm)
  const profile = BIOME_TERRAIN_PROFILES[biomeId] ?? DEFAULT_TERRAIN_PROFILE;
  let regional = 0;
  let freq = profile.frequency;
  let amp = profile.amplitude;
  for (let o = 0; o < profile.octaves; o++) {
    const n = noise2d(tileX * freq, tileZ * freq, perm);
    regional += (n + 1) * 0.5 * amp; // Remap [-1,1] to [0,1] per octave
    freq *= 2;
    amp *= 0.5;
  }

  // Layer 3: Fine detail noise
  const detail = (noise2d(tileX * 0.15, tileZ * 0.15, perm) + 1) * 0.5 * 0.1;

  return base + regional + detail;
}
