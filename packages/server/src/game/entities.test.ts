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

  describe("add — spatial grid registration", () => {
    it("does not add to byCharacter when characterId is empty", () => {
      // NPCs have characterId: "" — verifies the falsy branch on line 30
      const npc = makeEntity({ entityId: "npc-1", characterId: "", entityType: "npc" });
      entityStore.add(npc);
      expect(entityStore.getByCharacter("")).toBeUndefined();
      expect(entityStore.get("npc-1")).toBe(npc);
    });

    it("registers two entities in the same cell", () => {
      entityStore.add(makeEntity({ entityId: "a", x: 5, z: 5 }));
      entityStore.add(makeEntity({ entityId: "b", x: 10, z: 10 }));
      // Both in cell (0,0) — both should appear in a nearby query
      const nearby = entityStore.getNearbyEntities(8, 8, 32);
      const ids = nearby.map(n => n.entityId);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
    });
  });

  describe("remove — spatial grid cleanup", () => {
    it("does not delete cell when other entities remain", () => {
      entityStore.add(makeEntity({ entityId: "a", x: 5, z: 5 }));
      entityStore.add(makeEntity({ entityId: "b", x: 10, z: 10 })); // same cell
      entityStore.remove("a");
      // "b" should still be findable
      const nearby = entityStore.getNearbyEntities(10, 10, 5);
      expect(nearby.map(n => n.entityId)).toContain("b");
    });
  });

  describe("updatePosition", () => {
    it("updates entity coordinates", () => {
      const e = makeEntity({ entityId: "e-1", x: 0, z: 0 });
      entityStore.add(e);
      entityStore.updatePosition("e-1", 10, 20);
      expect(e.x).toBe(10);
      expect(e.z).toBe(20);
    });

    it("is safe for missing entity", () => {
      expect(() => entityStore.updatePosition("nope", 5, 5)).not.toThrow();
    });

    it("moves entity between spatial cells on cross-cell move", () => {
      const e = makeEntity({ entityId: "e-1", x: 0, z: 0 });
      entityStore.add(e);
      // Move to a different cell (cell size = 32)
      entityStore.updatePosition("e-1", 50, 50);
      // Should be findable at new position
      const nearby = entityStore.getNearbyEntities(50, 50, 5);
      expect(nearby.map(n => n.entityId)).toContain("e-1");
      // Should NOT be findable at old position
      const old = entityStore.getNearbyEntities(0, 0, 5);
      expect(old.map(n => n.entityId)).not.toContain("e-1");
    });

    it("handles within-cell moves without breaking grid", () => {
      const e = makeEntity({ entityId: "e-1", x: 5, z: 5 });
      entityStore.add(e);
      entityStore.updatePosition("e-1", 10, 10); // same cell (0,0)
      const nearby = entityStore.getNearbyEntities(10, 10, 5);
      expect(nearby.map(n => n.entityId)).toContain("e-1");
    });

    it("moves into a cell already occupied by another entity", () => {
      entityStore.add(makeEntity({ entityId: "resident", x: 50, z: 50 }));
      const mover = makeEntity({ entityId: "mover", x: 0, z: 0 });
      entityStore.add(mover);
      // Move mover into resident's cell
      entityStore.updatePosition("mover", 55, 55);
      const nearby = entityStore.getNearbyEntities(50, 50, 10);
      const ids = nearby.map(n => n.entityId);
      expect(ids).toContain("resident");
      expect(ids).toContain("mover");
    });
  });

  describe("getNearbyEntities", () => {
    it("returns entities within radius", () => {
      entityStore.add(makeEntity({ entityId: "a", x: 5, z: 5 }));
      entityStore.add(makeEntity({ entityId: "b", x: 100, z: 100 }));
      const nearby = entityStore.getNearbyEntities(0, 0, 32);
      expect(nearby.map(n => n.entityId)).toContain("a");
      expect(nearby.map(n => n.entityId)).not.toContain("b");
    });

    it("uses Chebyshev distance, not Euclidean", () => {
      // Chebyshev distance = max(|dx|, |dz|)
      // (30, 30) from origin: Euclidean ≈ 42.4, Chebyshev = 30
      entityStore.add(makeEntity({ entityId: "a", x: 30, z: 30 }));
      const nearby = entityStore.getNearbyEntities(0, 0, 32);
      expect(nearby.map(n => n.entityId)).toContain("a");
    });

    it("works with negative coordinates", () => {
      entityStore.add(makeEntity({ entityId: "neg", x: -10, z: -10 }));
      const nearby = entityStore.getNearbyEntities(-5, -5, 32);
      expect(nearby.map(n => n.entityId)).toContain("neg");
    });

    it("respects custom radius", () => {
      entityStore.add(makeEntity({ entityId: "a", x: 10, z: 0 }));
      expect(entityStore.getNearbyEntities(0, 0, 5).length).toBe(0);
      expect(entityStore.getNearbyEntities(0, 0, 10).length).toBe(1);
    });

    it("reflects position changes from updatePosition", () => {
      const e = makeEntity({ entityId: "mover", x: 0, z: 0 });
      entityStore.add(e);
      entityStore.updatePosition("mover", 100, 100);
      expect(entityStore.getNearbyEntities(0, 0, 10).length).toBe(0);
      expect(entityStore.getNearbyEntities(100, 100, 10).length).toBe(1);
    });

    it("finds entities spanning multiple cells", () => {
      // Cell (0,0) and cell (1,0) — both within radius 32 from (16, 0)
      entityStore.add(makeEntity({ entityId: "cell-0", x: 5, z: 0 }));
      entityStore.add(makeEntity({ entityId: "cell-1", x: 40, z: 0 }));
      const nearby = entityStore.getNearbyEntities(16, 0, 32);
      const ids = nearby.map(n => n.entityId);
      expect(ids).toContain("cell-0");
      expect(ids).toContain("cell-1");
    });

    it("distinguishes cell boundary — x=31 vs x=32", () => {
      entityStore.add(makeEntity({ entityId: "in-cell-0", x: 31, z: 0 }));
      entityStore.add(makeEntity({ entityId: "in-cell-1", x: 32, z: 0 }));
      // Both within radius 32 of origin
      const nearby = entityStore.getNearbyEntities(0, 0, 32);
      expect(nearby.map(n => n.entityId)).toContain("in-cell-0");
      expect(nearby.map(n => n.entityId)).toContain("in-cell-1");
    });

    it("returns empty array when no entities exist", () => {
      expect(entityStore.getNearbyEntities(0, 0, 32)).toEqual([]);
    });

    it("excludes entity exactly one past radius", () => {
      entityStore.add(makeEntity({ entityId: "boundary", x: 33, z: 0 }));
      expect(entityStore.getNearbyEntities(0, 0, 32).length).toBe(0);
    });
  });

  describe("getPlayersNear", () => {
    it("only returns players", () => {
      entityStore.add(makeEntity({ entityId: "p1", entityType: "player", x: 5, z: 5 }));
      entityStore.add(makeEntity({ entityId: "n1", entityType: "npc", x: 5, z: 5 }));
      const players = entityStore.getPlayersNear(0, 0, 32);
      expect(players.length).toBe(1);
      expect(players[0].entityId).toBe("p1");
    });

    it("returns empty when only NPCs are nearby", () => {
      entityStore.add(makeEntity({ entityId: "n1", entityType: "npc", x: 5, z: 5 }));
      entityStore.add(makeEntity({ entityId: "n2", entityType: "npc", x: 10, z: 10 }));
      expect(entityStore.getPlayersNear(0, 0, 32).length).toBe(0);
    });

    it("respects custom radius", () => {
      entityStore.add(makeEntity({ entityId: "p1", entityType: "player", x: 20, z: 0 }));
      expect(entityStore.getPlayersNear(0, 0, 10).length).toBe(0);
      expect(entityStore.getPlayersNear(0, 0, 20).length).toBe(1);
    });

    it("finds multiple players across cells", () => {
      entityStore.add(makeEntity({ entityId: "p1", entityType: "player", x: 5, z: 5 }));
      entityStore.add(makeEntity({ entityId: "p2", entityType: "player", x: 40, z: 0 }));
      const players = entityStore.getPlayersNear(20, 0, 32);
      expect(players.length).toBe(2);
    });
  });

  describe("isAwake — spatial integration", () => {
    it("NPC becomes awake when player moves nearby via updatePosition", () => {
      const player = makeEntity({ entityId: "p1", entityType: "player", x: 100, z: 100 });
      const npc = makeEntity({ entityId: "n1", entityType: "npc", x: 0, z: 0 });
      entityStore.add(player);
      entityStore.add(npc);
      // Initially far apart
      expect(entityStore.isAwake("n1")).toBe(false);
      // Player moves near NPC
      entityStore.updatePosition("p1", 5, 5);
      expect(entityStore.isAwake("n1")).toBe(true);
    });

    it("NPC becomes asleep when player moves away via updatePosition", () => {
      const player = makeEntity({ entityId: "p1", entityType: "player", x: 5, z: 5 });
      const npc = makeEntity({ entityId: "n1", entityType: "npc", x: 0, z: 0 });
      entityStore.add(player);
      entityStore.add(npc);
      expect(entityStore.isAwake("n1")).toBe(true);
      // Player moves far away
      entityStore.updatePosition("p1", 100, 100);
      expect(entityStore.isAwake("n1")).toBe(false);
    });
  });

  describe("spatial grid cleanup", () => {
    it("removes empty cells when last entity leaves", () => {
      const e = makeEntity({ entityId: "e-1", x: 0, z: 0 });
      entityStore.add(e);
      entityStore.remove("e-1");
      // After remove, getNearbyEntities at old position returns nothing
      expect(entityStore.getNearbyEntities(0, 0, 5).length).toBe(0);
    });

    it("cleans up empty cells on cross-cell move", () => {
      const e = makeEntity({ entityId: "solo", x: 0, z: 0 });
      entityStore.add(e);
      entityStore.updatePosition("solo", 100, 100);
      // Old cell should be empty — no results at origin
      expect(entityStore.getNearbyEntities(0, 0, 5).length).toBe(0);
    });
  });
});
