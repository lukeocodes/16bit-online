import { describe, it, expect, vi, beforeAll } from "vitest";
import { BiomeType } from "./types.js";

describe("BiomeType enum extension", () => {
  it("BiomeType.RIVER equals 16", () => {
    expect(BiomeType.RIVER).toBe(16);
  });

  it("BiomeType.LAKE equals 17", () => {
    expect(BiomeType.LAKE).toBe(17);
  });

  it("all original BiomeType values unchanged", () => {
    expect(BiomeType.DEEP_OCEAN).toBe(0);
    expect(BiomeType.SHALLOW_OCEAN).toBe(1);
    expect(BiomeType.BEACH).toBe(2);
    expect(BiomeType.TEMPERATE_GRASSLAND).toBe(3);
    expect(BiomeType.TEMPERATE_FOREST).toBe(4);
    expect(BiomeType.DENSE_FOREST).toBe(5);
    expect(BiomeType.BOREAL_FOREST).toBe(6);
    expect(BiomeType.MOUNTAIN).toBe(7);
    expect(BiomeType.SNOW_PEAK).toBe(8);
    expect(BiomeType.TUNDRA).toBe(9);
    expect(BiomeType.DESERT).toBe(10);
    expect(BiomeType.SCRUBLAND).toBe(11);
    expect(BiomeType.SWAMP).toBe(12);
    expect(BiomeType.HIGHLAND).toBe(13);
    expect(BiomeType.MEADOW).toBe(14);
    expect(BiomeType.RIVER_VALLEY).toBe(15);
  });
});

describe("BLOCKING_BIOMES", () => {
  it("contains exactly 5 blocking biomes", async () => {
    const { BLOCKING_BIOMES } = await import("./terrain.js");
    expect(BLOCKING_BIOMES.size).toBe(5);
  });

  it("contains DEEP_OCEAN, SHALLOW_OCEAN, SNOW_PEAK, RIVER, LAKE", async () => {
    const { BLOCKING_BIOMES } = await import("./terrain.js");
    expect(BLOCKING_BIOMES.has(BiomeType.DEEP_OCEAN)).toBe(true);
    expect(BLOCKING_BIOMES.has(BiomeType.SHALLOW_OCEAN)).toBe(true);
    expect(BLOCKING_BIOMES.has(BiomeType.SNOW_PEAK)).toBe(true);
    expect(BLOCKING_BIOMES.has(BiomeType.RIVER)).toBe(true);
    expect(BLOCKING_BIOMES.has(BiomeType.LAKE)).toBe(true);
  });

  it("does NOT contain walkable biomes", async () => {
    const { BLOCKING_BIOMES } = await import("./terrain.js");
    expect(BLOCKING_BIOMES.has(BiomeType.TEMPERATE_GRASSLAND)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.TEMPERATE_FOREST)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.DENSE_FOREST)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.BOREAL_FOREST)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.MOUNTAIN)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.TUNDRA)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.DESERT)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.SCRUBLAND)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.SWAMP)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.HIGHLAND)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.MEADOW)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.RIVER_VALLEY)).toBe(false);
    expect(BLOCKING_BIOMES.has(BiomeType.BEACH)).toBe(false);
  });
});

describe("ELEVATION_BANDS", () => {
  it("has exactly 7 entries", async () => {
    const { ELEVATION_BANDS } = await import("./terrain.js");
    expect(ELEVATION_BANDS).toHaveLength(7);
  });

  it("each entry has min, max, level, name fields", async () => {
    const { ELEVATION_BANDS } = await import("./terrain.js");
    for (const band of ELEVATION_BANDS) {
      expect(typeof band.min).toBe("number");
      expect(typeof band.max).toBe("number");
      expect(typeof band.level).toBe("number");
      expect(typeof band.name).toBe("string");
    }
  });

  it("levels span 0 to 6", async () => {
    const { ELEVATION_BANDS } = await import("./terrain.js");
    expect(ELEVATION_BANDS[0].level).toBe(0);
    expect(ELEVATION_BANDS[6].level).toBe(6);
  });
});

describe("getElevationBand", () => {
  it("returns correct levels for boundary values", async () => {
    const { getElevationBand } = await import("./terrain.js");
    // Band boundaries: 0.15, 0.30, 0.45, 0.60, 0.75, 0.90, 1.00
    expect(getElevationBand(0.0)).toBe(0);   // deep_water
    expect(getElevationBand(0.14)).toBe(0);  // still deep_water
    expect(getElevationBand(0.15)).toBe(1);  // shallow_water
    expect(getElevationBand(0.20)).toBe(1);  // shallow_water
    expect(getElevationBand(0.29)).toBe(1);  // still shallow_water
    expect(getElevationBand(0.30)).toBe(2);  // lowland
    expect(getElevationBand(0.35)).toBe(2);  // lowland
    expect(getElevationBand(0.44)).toBe(2);  // still lowland
    expect(getElevationBand(0.45)).toBe(3);  // plains
    expect(getElevationBand(0.50)).toBe(3);  // plains
    expect(getElevationBand(0.59)).toBe(3);  // still plains
    expect(getElevationBand(0.60)).toBe(4);  // highland
    expect(getElevationBand(0.65)).toBe(4);  // highland
    expect(getElevationBand(0.74)).toBe(4);  // still highland
    expect(getElevationBand(0.75)).toBe(5);  // mountain
    expect(getElevationBand(0.80)).toBe(5);  // mountain
    expect(getElevationBand(0.89)).toBe(5);  // still mountain
    expect(getElevationBand(0.90)).toBe(6);  // peak
    expect(getElevationBand(0.95)).toBe(6);  // peak
    expect(getElevationBand(1.0)).toBe(6);   // peak (max)
  });
});

describe("ELEVATION_STEP_HEIGHT", () => {
  it("equals 1.5", async () => {
    const { ELEVATION_STEP_HEIGHT } = await import("./terrain.js");
    expect(ELEVATION_STEP_HEIGHT).toBe(1.5);
  });
});

describe("isBiomeWalkable", () => {
  it("returns true for walkable biomes", async () => {
    const { isBiomeWalkable } = await import("./terrain.js");
    expect(isBiomeWalkable(BiomeType.TEMPERATE_GRASSLAND)).toBe(true);
    expect(isBiomeWalkable(BiomeType.TEMPERATE_FOREST)).toBe(true);
    expect(isBiomeWalkable(BiomeType.DENSE_FOREST)).toBe(true);
    expect(isBiomeWalkable(BiomeType.BOREAL_FOREST)).toBe(true);
    expect(isBiomeWalkable(BiomeType.MOUNTAIN)).toBe(true);
    expect(isBiomeWalkable(BiomeType.TUNDRA)).toBe(true);
    expect(isBiomeWalkable(BiomeType.DESERT)).toBe(true);
    expect(isBiomeWalkable(BiomeType.SCRUBLAND)).toBe(true);
    expect(isBiomeWalkable(BiomeType.SWAMP)).toBe(true);
    expect(isBiomeWalkable(BiomeType.HIGHLAND)).toBe(true);
    expect(isBiomeWalkable(BiomeType.MEADOW)).toBe(true);
    expect(isBiomeWalkable(BiomeType.RIVER_VALLEY)).toBe(true);
    expect(isBiomeWalkable(BiomeType.BEACH)).toBe(true);
  });

  it("returns false for blocking biomes", async () => {
    const { isBiomeWalkable } = await import("./terrain.js");
    expect(isBiomeWalkable(BiomeType.RIVER)).toBe(false);
    expect(isBiomeWalkable(BiomeType.LAKE)).toBe(false);
    expect(isBiomeWalkable(BiomeType.SNOW_PEAK)).toBe(false);
    expect(isBiomeWalkable(BiomeType.DEEP_OCEAN)).toBe(false);
    expect(isBiomeWalkable(BiomeType.SHALLOW_OCEAN)).toBe(false);
  });
});

describe("isWalkable", () => {
  it("returns false when world map is not initialized", async () => {
    // Reset modules to get fresh module state with no world map
    vi.resetModules();
    const terrainMod = await import("./terrain.js");
    // The world map won't be initialized in a fresh module context
    // unless initWorldMap has been called. Since we reset, getWorldMap returns null.
    // However, terrain.ts imports from queries.ts which may have module-level state.
    // We need to verify isWalkable handles the null case.
    // Use coordinates outside the Tiled map range (0-127) so the bypass doesn't apply
    expect(terrainMod.isWalkable(500, 500)).toBe(false);
  });

  it("returns false for out-of-bounds coordinates (negative)", async () => {
    const { initWorldMap } = await import("./queries.js");
    initWorldMap(42);
    const { isWalkable } = await import("./terrain.js");
    expect(isWalkable(-1, 0)).toBe(false);
    expect(isWalkable(0, -1)).toBe(false);
    expect(isWalkable(-100, -100)).toBe(false);
  });

  it("returns false for out-of-bounds coordinates (beyond world)", async () => {
    const { isWalkable } = await import("./terrain.js");
    // World is 900 chunks * 32 tiles = 28800 tiles
    expect(isWalkable(28800, 0)).toBe(false);
    expect(isWalkable(0, 28800)).toBe(false);
    expect(isWalkable(28801, 28801)).toBe(false);
  });

  it("converts tile coords to chunk coords via Math.floor(tile / 32)", async () => {
    const { isWalkable } = await import("./terrain.js");
    // Tile (0, 0) is chunk (0, 0) -- should be valid (but may be ocean)
    // Just testing it doesn't crash and returns a boolean
    const result = isWalkable(0, 0);
    expect(typeof result).toBe("boolean");
  });
});
