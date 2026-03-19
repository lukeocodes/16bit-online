import { describe, it, expect, beforeAll } from "vitest";
import { generateWorld } from "./worldgen.js";
import type { WorldMap } from "./types.js";

describe("worldgen", () => {
  let world: WorldMap;

  beforeAll(() => {
    world = generateWorld(42);
  });

  it("returns complete WorldMap with all required fields", () => {
    expect(world.seed).toBe(42);
    expect(world.width).toBe(900);
    expect(world.height).toBe(900);
    expect(world.continents).toHaveLength(3);
    expect(world.regions.length).toBeGreaterThan(60);
    expect(world.landmask).toBeInstanceOf(Uint8Array);
    expect(world.elevation).toBeInstanceOf(Float32Array);
    expect(world.moisture).toBeInstanceOf(Float32Array);
    expect(world.temperature).toBeInstanceOf(Float32Array);
    expect(world.regionMap).toBeInstanceOf(Uint16Array);
    expect(world.continentMap).toBeInstanceOf(Uint8Array);
    expect(world.biomeMap).toBeInstanceOf(Uint8Array);

    // Verify typed array sizes
    const totalChunks = 900 * 900;
    expect(world.landmask.length).toBe(totalChunks);
    expect(world.elevation.length).toBe(totalChunks);
    expect(world.moisture.length).toBe(totalChunks);
    expect(world.temperature.length).toBe(totalChunks);
    expect(world.regionMap.length).toBe(totalChunks);
    expect(world.continentMap.length).toBe(totalChunks);
    expect(world.biomeMap.length).toBe(totalChunks);
  });

  it("is fully deterministic", () => {
    const world2 = generateWorld(42);

    // Compare seed, dimensions
    expect(world.seed).toBe(world2.seed);
    expect(world.width).toBe(world2.width);
    expect(world.height).toBe(world2.height);
    expect(world.continents.length).toBe(world2.continents.length);
    expect(world.regions.length).toBe(world2.regions.length);

    // Byte-for-byte comparison of typed arrays
    let landmaskMatch = true;
    let regionMapMatch = true;
    let biomeMapMatch = true;
    for (let i = 0; i < world.landmask.length; i++) {
      if (world.landmask[i] !== world2.landmask[i]) {
        landmaskMatch = false;
        break;
      }
    }
    for (let i = 0; i < world.regionMap.length; i++) {
      if (world.regionMap[i] !== world2.regionMap[i]) {
        regionMapMatch = false;
        break;
      }
    }
    for (let i = 0; i < world.biomeMap.length; i++) {
      if (world.biomeMap[i] !== world2.biomeMap[i]) {
        biomeMapMatch = false;
        break;
      }
    }
    expect(landmaskMatch).toBe(true);
    expect(regionMapMatch).toBe(true);
    expect(biomeMapMatch).toBe(true);
  });

  it("completes in under 5 seconds", () => {
    const start = performance.now();
    generateWorld(99);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  it("assigns region biomes from majority chunk biome", () => {
    // For each region, the region's biome should exist among its chunk biomes
    for (const region of world.regions) {
      if (region.chunkCount === 0) continue;

      // Count biome types in this region's chunks
      const biomeCounts = new Map<number, number>();
      for (let i = 0; i < world.regionMap.length; i++) {
        if (world.regionMap[i] === region.id) {
          const biome = world.biomeMap[i];
          biomeCounts.set(biome, (biomeCounts.get(biome) || 0) + 1);
        }
      }

      // Find the most common biome
      let maxCount = 0;
      let majorityBiome = 0;
      for (const [biome, count] of biomeCounts) {
        if (count > maxCount) {
          maxCount = count;
          majorityBiome = biome;
        }
      }

      // The region's biome should match the majority
      expect(region.biome).toBe(majorityBiome);
    }
  });
});
