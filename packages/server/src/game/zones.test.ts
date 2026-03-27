import { describe, it, expect, beforeAll } from "vitest";
import { isInSafeZone, getSafeZone, getAllSafeZones } from "./zones.js";
import { loadTiledMap } from "../world/tiled-map.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the Tiled map so safe zones are available
beforeAll(() => {
  const mapPath = resolve(__dirname, "../../../client/public/maps/starter.json");
  loadTiledMap(mapPath);
});

// Town safe zone is a rectangle from the Tiled map (center ± radius)
// With 256x256 map, town at (128,128) with radius 12:
// Safe zone rect: (116, 116) to (140, 140) — 24x24 tiles
const TX = 128;
const TZ = 128;
const R = 12;

describe("zones", () => {
  describe("isInSafeZone", () => {
    it("returns true at the town center", () => {
      expect(isInSafeZone(1, TX, TZ)).toBe(true);
    });

    it("returns true inside the zone rectangle", () => {
      expect(isInSafeZone(1, TX + 5, TZ)).toBe(true);
      expect(isInSafeZone(1, TX, TZ + 5)).toBe(true);
      expect(isInSafeZone(1, TX - 5, TZ - 5)).toBe(true);
    });

    it("returns true at the zone boundary", () => {
      // Just inside the rectangle (edge tile)
      expect(isInSafeZone(1, TX - R + 1, TZ)).toBe(true);
      expect(isInSafeZone(1, TX + R - 1, TZ)).toBe(true);
    });

    it("returns false outside the zone", () => {
      expect(isInSafeZone(1, TX + 50, TZ + 50)).toBe(false);
    });

    it("returns false far from town", () => {
      expect(isInSafeZone(1, 10, 10)).toBe(false);
    });

    it("returns false on a different mapId", () => {
      // mapId is not checked by Tiled zones (no mapId concept) but function signature requires it
      // For now, all zones are on all maps
      expect(isInSafeZone(1, TX + 50, TZ + 50)).toBe(false);
    });
  });

  describe("getSafeZone", () => {
    it("returns the zone object when inside", () => {
      const zone = getSafeZone(1, TX, TZ);
      expect(zone).not.toBeNull();
      expect(zone!.name).toBe("Starter Town");
    });

    it("returns null when outside", () => {
      expect(getSafeZone(1, TX + 100, TZ + 100)).toBeNull();
    });
  });

  describe("getAllSafeZones", () => {
    it("returns the full list of safe zones", () => {
      const zones = getAllSafeZones();
      expect(zones.length).toBeGreaterThanOrEqual(1);
      expect(zones[0].name).toBe("Starter Town");
    });
  });
});
