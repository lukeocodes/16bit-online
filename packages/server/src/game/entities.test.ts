import { describe, it, expect, beforeEach } from "vitest";
import { entityStore, type ServerEntity } from "./entities.js";

function makeEntity(overrides: Partial<ServerEntity> = {}): ServerEntity {
  return {
    entityId: "e-" + Math.random().toString(36).slice(2, 8),
    characterId: "c-" + Math.random().toString(36).slice(2, 8),
    accountId: "a-1",
    name: "Test",
    entityType: "npc",
    x: 0, y: 0, z: 0,
    rotation: 0,
    mapId: 1,
    lastUpdate: Date.now(),
    ...overrides,
  };
}

describe("EntityStore", () => {
  beforeEach(() => {
    // Clear the singleton store between tests
    for (const e of entityStore.getAll()) {
      entityStore.remove(e.entityId);
    }
  });

  describe("add/get/remove", () => {
    it("stores and retrieves an entity", () => {
      const e = makeEntity({ entityId: "player-1" });
      entityStore.add(e);
      expect(entityStore.get("player-1")).toBe(e);
    });

    it("removes an entity", () => {
      const e = makeEntity({ entityId: "player-2" });
      entityStore.add(e);
      entityStore.remove("player-2");
      expect(entityStore.get("player-2")).toBeUndefined();
    });

    it("remove is safe for non-existent entity", () => {
      expect(() => entityStore.remove("nope")).not.toThrow();
    });
  });

  describe("getByCharacter", () => {
    it("finds entity by character ID", () => {
      const e = makeEntity({ entityId: "e-1", characterId: "char-abc" });
      entityStore.add(e);
      expect(entityStore.getByCharacter("char-abc")).toBe(e);
    });

    it("returns undefined for unknown character", () => {
      expect(entityStore.getByCharacter("char-unknown")).toBeUndefined();
    });

    it("clears character mapping on remove", () => {
      const e = makeEntity({ entityId: "e-2", characterId: "char-def" });
      entityStore.add(e);
      entityStore.remove("e-2");
      expect(entityStore.getByCharacter("char-def")).toBeUndefined();
    });
  });

  describe("getAll / getByType", () => {
    it("returns all entities", () => {
      entityStore.add(makeEntity({ entityId: "a" }));
      entityStore.add(makeEntity({ entityId: "b" }));
      expect(entityStore.getAll().length).toBe(2);
    });

    it("filters by type", () => {
      entityStore.add(makeEntity({ entityId: "p1", entityType: "player" }));
      entityStore.add(makeEntity({ entityId: "n1", entityType: "npc" }));
      entityStore.add(makeEntity({ entityId: "n2", entityType: "npc" }));
      expect(entityStore.getByType("player").length).toBe(1);
      expect(entityStore.getByType("npc").length).toBe(2);
    });
  });

  describe("isAwake", () => {
    it("players are always awake", () => {
      const p = makeEntity({ entityId: "p1", entityType: "player" });
      entityStore.add(p);
      expect(entityStore.isAwake("p1")).toBe(true);
    });

    it("NPC near a player is awake", () => {
      const player = makeEntity({ entityId: "p1", entityType: "player", x: 0, z: 0 });
      const npc = makeEntity({ entityId: "n1", entityType: "npc", x: 10, z: 10 });
      entityStore.add(player);
      entityStore.add(npc);
      // Chebyshev distance = max(|10|, |10|) = 10 ≤ 32
      expect(entityStore.isAwake("n1")).toBe(true);
    });

    it("NPC far from any player is asleep", () => {
      const player = makeEntity({ entityId: "p1", entityType: "player", x: 0, z: 0 });
      const npc = makeEntity({ entityId: "n1", entityType: "npc", x: 50, z: 50 });
      entityStore.add(player);
      entityStore.add(npc);
      // Chebyshev distance = max(50, 50) = 50 > 32
      expect(entityStore.isAwake("n1")).toBe(false);
    });

    it("NPC exactly at awake radius boundary is awake", () => {
      const player = makeEntity({ entityId: "p1", entityType: "player", x: 0, z: 0 });
      const npc = makeEntity({ entityId: "n1", entityType: "npc", x: 32, z: 0 });
      entityStore.add(player);
      entityStore.add(npc);
      expect(entityStore.isAwake("n1")).toBe(true);
    });

    it("NPC just outside awake radius is asleep", () => {
      const player = makeEntity({ entityId: "p1", entityType: "player", x: 0, z: 0 });
      const npc = makeEntity({ entityId: "n1", entityType: "npc", x: 33, z: 0 });
      entityStore.add(player);
      entityStore.add(npc);
      expect(entityStore.isAwake("n1")).toBe(false);
    });

    it("NPC with no players anywhere is asleep", () => {
      const npc = makeEntity({ entityId: "n1", entityType: "npc", x: 0, z: 0 });
      entityStore.add(npc);
      expect(entityStore.isAwake("n1")).toBe(false);
    });

    it("returns false for non-existent entity", () => {
      expect(entityStore.isAwake("ghost")).toBe(false);
    });
  });
});
