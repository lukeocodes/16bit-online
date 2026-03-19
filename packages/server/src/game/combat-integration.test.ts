import { describe, it, expect, beforeEach } from "vitest";
import { entityStore, type ServerEntity } from "./entities.js";
import {
  registerEntity,
  unregisterEntity,
  getCombatState,
  engageTarget,
  disengage,
  tick,
} from "./combat.js";

function makeEntity(overrides: Partial<ServerEntity> = {}): ServerEntity {
  return {
    entityId: "e-" + Math.random().toString(36).slice(2, 8),
    characterId: "",
    accountId: "",
    name: "Test",
    entityType: "player",
    x: 0, y: 0, z: 0,
    rotation: 0,
    mapId: 1,
    lastUpdate: Date.now(),
    ...overrides,
  };
}

function addPlayerAt(id: string, x: number, z: number, hp = 50) {
  const e = makeEntity({ entityId: id, entityType: "player", x, z });
  entityStore.add(e);
  registerEntity(id, "melee", 5, 2.0, hp, hp);
  return e;
}

function addNpcAt(id: string, x: number, z: number, hp = 10, weaponType = "melee", damage = 3) {
  const e = makeEntity({ entityId: id, entityType: "npc", x, z });
  entityStore.add(e);
  registerEntity(id, weaponType, damage, 2.0, hp, hp);
  return e;
}

describe("combat integration scenarios", () => {
  beforeEach(() => {
    for (const e of entityStore.getAll()) {
      unregisterEntity(e.entityId);
      entityStore.remove(e.entityId);
    }
  });

  describe("mutual combat", () => {
    it("player and NPC deal damage to each other", () => {
      addPlayerAt("p1", 0, 0, 50);
      addNpcAt("n1", 1, 0, 20);

      engageTarget("p1", "n1");
      // Run several ticks for both to complete attack cycles
      for (let i = 0; i < 100; i++) tick(0.05);

      const pState = getCombatState("p1")!;
      const nState = getCombatState("n1")!;
      // Player should have taken some damage from NPC retaliation
      expect(pState.hp).toBeLessThan(50);
      // NPC should have taken damage from player
      expect(nState.hp).toBeLessThan(20);
    });

    it("faster attacker kills slower one first", () => {
      // Player does 5 damage, NPC does 3 damage, both melee range
      addPlayerAt("p1", 0, 0, 30);
      addNpcAt("n1", 1, 0, 15, "melee", 3);

      engageTarget("p1", "n1");
      let deaths: string[] = [];
      for (let i = 0; i < 200; i++) {
        const result = tick(0.05);
        for (const d of result.deaths) deaths.push(d.entityId);
      }

      // NPC (15 HP) should die before player (30 HP) with 5 vs 3 damage
      expect(deaths).toContain("n1");
      expect(getCombatState("p1")!.hp).toBeGreaterThan(0);
    });
  });

  describe("multiple NPCs vs one player", () => {
    it("multiple NPCs can attack the same player", () => {
      addPlayerAt("p1", 0, 0, 100);
      addNpcAt("n1", 1, 0, 50, "melee", 2);
      addNpcAt("n2", 0, 1, 50, "melee", 2);

      // Both NPCs engage the player
      engageTarget("n1", "p1");
      engageTarget("n2", "p1");

      for (let i = 0; i < 100; i++) tick(0.05);

      // Player should take damage from both
      expect(getCombatState("p1")!.hp).toBeLessThan(100);
    });

    it("player can only auto-attack one target at a time", () => {
      addPlayerAt("p1", 0, 0, 100);
      addNpcAt("n1", 1, 0, 50);
      addNpcAt("n2", 0, 1, 50);

      engageTarget("p1", "n1");
      expect(getCombatState("p1")!.targetId).toBe("n1");

      engageTarget("p1", "n2"); // Switches target
      expect(getCombatState("p1")!.targetId).toBe("n2");
    });
  });

  describe("weapon range", () => {
    it("ranged NPC attacks from distance 3", () => {
      addPlayerAt("p1", 0, 0, 50);
      addNpcAt("n1", 3, 0, 20, "ranged", 4); // Chebyshev dist = 3, ranged range = 4

      engageTarget("n1", "p1");
      tick(0.05);
      tick(0.5);

      expect(getCombatState("p1")!.hp).toBeLessThan(50);
    });

    it("ranged NPC cannot attack from distance 5", () => {
      addPlayerAt("p1", 0, 0, 50);
      addNpcAt("n1", 5, 0, 20, "ranged", 4); // Chebyshev dist = 5, ranged range = 4

      engageTarget("n1", "p1");
      tick(0.05);
      tick(0.5);

      expect(getCombatState("p1")!.hp).toBe(50); // No damage
    });

    it("magic NPC attacks from distance 4", () => {
      addPlayerAt("p1", 0, 0, 50);
      addNpcAt("n1", 4, 0, 20, "magic", 6); // Chebyshev dist = 4, magic range = 4

      engageTarget("n1", "p1");
      tick(0.05);
      tick(0.5);

      expect(getCombatState("p1")!.hp).toBeLessThan(50);
    });

    it("melee NPC cannot attack from distance 2", () => {
      addPlayerAt("p1", 0, 0, 50);
      addNpcAt("n1", 2, 0, 20, "melee", 3); // Chebyshev dist = 2, melee range = 1

      engageTarget("n1", "p1");
      tick(0.05);
      tick(0.5);

      expect(getCombatState("p1")!.hp).toBe(50);
    });
  });

  describe("target death during combat", () => {
    it("attacker disengages when target dies", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0, 1); // 1 HP

      engageTarget("p1", "n1");
      for (let i = 0; i < 20; i++) tick(0.05);

      // Target is dead, attacker should have disengaged
      expect(getCombatState("n1")!.hp).toBe(0);
      expect(getCombatState("p1")!.autoAttacking).toBe(false);
      expect(getCombatState("p1")!.targetId).toBeNull();
    });

    it("HP never goes below 0", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0, 1); // Will die quickly

      engageTarget("p1", "n1");
      for (let i = 0; i < 50; i++) tick(0.05);

      expect(getCombatState("n1")!.hp).toBe(0);
      expect(getCombatState("n1")!.hp).not.toBeLessThan(0);
    });
  });

  describe("sleep optimization", () => {
    it("sleeping NPCs do not take combat ticks", () => {
      // NPC far from any player — should be asleep
      addNpcAt("n1", 100, 100, 10);
      addNpcAt("n2", 101, 100, 10);

      engageTarget("n1", "n2");
      tick(0.05);
      tick(0.5);

      // No player nearby, NPCs are asleep, no damage should occur
      expect(getCombatState("n2")!.hp).toBe(10);
    });

    it("NPCs near a player are awake and fight", () => {
      addPlayerAt("p1", 0, 0, 100);
      addNpcAt("n1", 1, 0, 10);
      addNpcAt("n2", 2, 0, 10);

      // Player wakes up both NPCs
      engageTarget("n1", "n2");
      tick(0.05);
      tick(0.5);

      // n1 should be able to damage n2 since player is nearby (wakes them)
      expect(getCombatState("n2")!.hp).toBeLessThan(10);
    });
  });
});
