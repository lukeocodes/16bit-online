import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { entityStore, type ServerEntity } from "./entities.js";
import { registerEntity, unregisterEntity } from "./combat.js";

// Mock connectionManager to avoid WebRTC dependency
vi.mock("../ws/connections.js", () => ({
  connectionManager: {
    broadcastReliable: vi.fn(),
    getAll: vi.fn(() => []),
  },
}));

import { startLingering, cancelLingering, isLingering, cleanup } from "./linger.js";

function makeEntity(id: string, x = 0, z = 0): ServerEntity {
  return {
    entityId: id,
    characterId: `char-${id}`,
    accountId: "a-1",
    name: "Test",
    entityType: "player",
    x, y: 0, z,
    rotation: 0,
    mapId: 1,
    lastUpdate: Date.now(),
  };
}

describe("linger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanup();
    // Clear entity store
    for (const e of entityStore.getAll()) {
      unregisterEntity(e.entityId);
      entityStore.remove(e.entityId);
    }
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("startLingering", () => {
    it("marks entity as lingering", () => {
      const e = makeEntity("p1");
      entityStore.add(e);
      registerEntity("p1");

      startLingering("p1", "char-p1");
      expect(isLingering("p1")).toBe(true);
    });

    it("resets timer on double disconnect", () => {
      const e = makeEntity("p1");
      entityStore.add(e);
      registerEntity("p1");

      startLingering("p1", "char-p1");
      startLingering("p1", "char-p1"); // second call resets
      expect(isLingering("p1")).toBe(true);
    });
  });

  describe("cancelLingering", () => {
    it("cancels linger on reconnect", () => {
      const e = makeEntity("p1");
      entityStore.add(e);
      registerEntity("p1");

      startLingering("p1", "char-p1");
      expect(cancelLingering("p1")).toBe(true);
      expect(isLingering("p1")).toBe(false);
    });

    it("returns false if not lingering", () => {
      expect(cancelLingering("nobody")).toBe(false);
    });
  });

  describe("isLingering", () => {
    it("returns false for unknown entity", () => {
      expect(isLingering("ghost")).toBe(false);
    });
  });

  describe("timer expiry", () => {
    it("removes entity after 2 minutes", () => {
      const e = makeEntity("p1");
      entityStore.add(e);
      registerEntity("p1");

      startLingering("p1", "char-p1");
      expect(entityStore.get("p1")).toBeDefined();

      // Advance past linger duration (2 minutes)
      vi.advanceTimersByTime(2 * 60 * 1000);

      expect(isLingering("p1")).toBe(false);
      expect(entityStore.get("p1")).toBeUndefined();
    });

    it("does not remove entity before timer expires", () => {
      const e = makeEntity("p1");
      entityStore.add(e);
      registerEntity("p1");

      startLingering("p1", "char-p1");

      // Advance 1 minute — not yet expired
      vi.advanceTimersByTime(60 * 1000);

      expect(isLingering("p1")).toBe(true);
      expect(entityStore.get("p1")).toBeDefined();
    });

    it("cancel prevents removal", () => {
      const e = makeEntity("p1");
      entityStore.add(e);
      registerEntity("p1");

      startLingering("p1", "char-p1");
      cancelLingering("p1");

      // Advance past expiry
      vi.advanceTimersByTime(3 * 60 * 1000);

      // Entity should still exist (cancel prevented removal)
      expect(entityStore.get("p1")).toBeDefined();
    });
  });

  describe("timer expiry — edge cases", () => {
    it("handles entity already removed from store before timer fires", () => {
      const e = makeEntity("p1");
      entityStore.add(e);
      registerEntity("p1");

      startLingering("p1", "char-p1");

      // Remove entity from store BEFORE timer fires (simulates external cleanup)
      entityStore.remove("p1");

      // Timer fires — removeLingering should handle missing entity gracefully
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(isLingering("p1")).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("clears all lingering entries", () => {
      entityStore.add(makeEntity("p1"));
      entityStore.add(makeEntity("p2"));
      registerEntity("p1");
      registerEntity("p2");

      startLingering("p1", "char-p1");
      startLingering("p2", "char-p2");

      cleanup();

      expect(isLingering("p1")).toBe(false);
      expect(isLingering("p2")).toBe(false);
    });
  });
});
