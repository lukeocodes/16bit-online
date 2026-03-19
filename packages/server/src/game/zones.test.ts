import { describe, it, expect } from "vitest";
import { isInSafeZone, getSafeZone, getAllSafeZones } from "./zones.js";

describe("zones", () => {
  describe("isInSafeZone", () => {
    it("returns true at the town center", () => {
      expect(isInSafeZone(1, 0, 0)).toBe(true);
    });

    it("returns true inside the radius", () => {
      expect(isInSafeZone(1, 5, 0)).toBe(true);
      expect(isInSafeZone(1, 0, 5)).toBe(true);
      expect(isInSafeZone(1, 4, 4)).toBe(true); // ~5.66, inside radius 8
    });

    it("returns true exactly at the radius boundary", () => {
      // radius 8, point (8, 0) → dist = 8
      expect(isInSafeZone(1, 8, 0)).toBe(true);
    });

    it("returns false just outside the radius", () => {
      // (6, 6) → dist = ~8.49
      expect(isInSafeZone(1, 6, 6)).toBe(false);
    });

    it("returns false far from town", () => {
      expect(isInSafeZone(1, 50, 50)).toBe(false);
    });

    it("returns false on a different mapId", () => {
      expect(isInSafeZone(2, 0, 0)).toBe(false);
    });

    it("handles negative coordinates", () => {
      expect(isInSafeZone(1, -5, -5)).toBe(true); // ~7.07, inside
      expect(isInSafeZone(1, -6, -6)).toBe(false); // ~8.49, outside
    });
  });

  describe("getSafeZone", () => {
    it("returns the zone object when inside", () => {
      const zone = getSafeZone(1, 0, 0);
      expect(zone).not.toBeNull();
      expect(zone!.id).toBe("town-spawn");
      expect(zone!.name).toBe("Town");
    });

    it("returns null when outside", () => {
      expect(getSafeZone(1, 100, 100)).toBeNull();
    });

    it("returns null for wrong mapId", () => {
      expect(getSafeZone(99, 0, 0)).toBeNull();
    });
  });

  describe("getAllSafeZones", () => {
    it("returns the full list of safe zones", () => {
      const zones = getAllSafeZones();
      expect(zones.length).toBeGreaterThanOrEqual(1);
      expect(zones[0].id).toBe("town-spawn");
    });
  });
});
