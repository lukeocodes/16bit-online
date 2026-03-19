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

function addPlayerAt(id: string, x: number, z: number) {
  const e = makeEntity({ entityId: id, entityType: "player", x, z });
  entityStore.add(e);
  registerEntity(id, "melee", 5, 2.0, 50, 50);
  return e;
}

function addNpcAt(id: string, x: number, z: number, hp = 10) {
  const e = makeEntity({ entityId: id, entityType: "npc", x, z });
  entityStore.add(e);
  registerEntity(id, "melee", 3, 2.0, hp, hp);
  return e;
}

describe("combat", () => {
  beforeEach(() => {
    // Clear entity store and combat states
    for (const e of entityStore.getAll()) {
      unregisterEntity(e.entityId);
      entityStore.remove(e.entityId);
    }
  });

  describe("registerEntity / getCombatState", () => {
    it("creates initial combat state", () => {
      addPlayerAt("p1", 0, 0);
      const state = getCombatState("p1");
      expect(state).toBeDefined();
      expect(state!.hp).toBe(50);
      expect(state!.maxHp).toBe(50);
      expect(state!.autoAttacking).toBe(false);
      expect(state!.inCombat).toBe(false);
    });

    it("unregister removes combat state", () => {
      addPlayerAt("p1", 0, 0);
      unregisterEntity("p1");
      expect(getCombatState("p1")).toBeUndefined();
    });
  });

  describe("engageTarget", () => {
    it("sets auto-attack on target", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0);

      engageTarget("p1", "n1");
      const s = getCombatState("p1")!;
      expect(s.autoAttacking).toBe(true);
      expect(s.targetId).toBe("n1");
    });

    it("toggling on same target disengages", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0);

      engageTarget("p1", "n1");
      engageTarget("p1", "n1"); // toggle off
      const s = getCombatState("p1")!;
      expect(s.autoAttacking).toBe(false);
      expect(s.targetId).toBeNull();
    });

    it("switching target updates targetId", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0);
      addNpcAt("n2", 0, 1);

      engageTarget("p1", "n1");
      engageTarget("p1", "n2");
      expect(getCombatState("p1")!.targetId).toBe("n2");
    });
  });

  describe("disengage", () => {
    it("clears auto-attack state", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0);

      engageTarget("p1", "n1");
      disengage("p1");
      const s = getCombatState("p1")!;
      expect(s.autoAttacking).toBe(false);
      expect(s.targetId).toBeNull();
    });

    it("is safe on non-existent entity", () => {
      expect(() => disengage("ghost")).not.toThrow();
    });
  });

  describe("tick — attack cycle", () => {
    it("deals damage after wind-up completes", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0, 10);

      engageTarget("p1", "n1");

      // Tick past attack cooldown (initially 0 so wind-up starts immediately)
      tick(0.05); // attackTimer <= 0, starts wind-up (0.5s)
      tick(0.5);  // wind-up completes, damage dealt

      const npcState = getCombatState("n1")!;
      expect(npcState.hp).toBeLessThan(10);
    });

    it("produces damage events", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0, 10);

      engageTarget("p1", "n1");
      tick(0.05);
      const result = tick(0.5);
      expect(result.damage.length).toBeGreaterThan(0);
      expect(result.damage[0].attackerId).toBe("p1");
      expect(result.damage[0].targetId).toBe("n1");
    });

    it("kills target and produces death event", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0, 1); // 1 HP, will die in one hit (player does 5 damage)

      engageTarget("p1", "n1");
      tick(0.05);
      const result = tick(0.5);
      expect(result.deaths.length).toBe(1);
      expect(result.deaths[0].entityId).toBe("n1");
      expect(getCombatState("n1")!.hp).toBe(0);
    });

    it("sets both attacker and target into combat", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0, 20);

      engageTarget("p1", "n1");
      tick(0.05);
      tick(0.5);

      expect(getCombatState("p1")!.inCombat).toBe(true);
      expect(getCombatState("n1")!.inCombat).toBe(true);
    });

    it("target retaliates after being hit", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0, 20);

      engageTarget("p1", "n1");
      tick(0.05);
      tick(0.5); // player hits NPC

      const npcState = getCombatState("n1")!;
      expect(npcState.autoAttacking).toBe(true);
      expect(npcState.targetId).toBe("p1");
    });

    it("does not attack if target is out of range", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 5, 5, 10); // Chebyshev distance = 5, melee range = 1

      engageTarget("p1", "n1");
      tick(0.05);
      tick(0.5);

      expect(getCombatState("n1")!.hp).toBe(10); // No damage dealt
    });
  });

  describe("tick — HP regen", () => {
    it("regenerates HP when out of combat", () => {
      addPlayerAt("p1", 0, 0);
      const s = getCombatState("p1")!;
      s.hp = 40; // Damage the player

      // Tick enough time for regen (1 HP per 0.5s when not in combat)
      tick(0.5);
      expect(getCombatState("p1")!.hp).toBe(41);
    });

    it("does not regen above maxHp", () => {
      addPlayerAt("p1", 0, 0);
      const s = getCombatState("p1")!;
      s.hp = 50; // Full HP

      tick(0.5);
      expect(getCombatState("p1")!.hp).toBe(50);
    });

    it("does not regen while in combat", () => {
      addPlayerAt("p1", 0, 0);
      // Place NPC far away so it can't retaliate (melee range 1)
      addNpcAt("n1", 5, 5, 20);

      engageTarget("p1", "n1");
      tick(0.05);
      // Player can't hit NPC (out of range), but manually set combat state
      const s = getCombatState("p1")!;
      s.inCombat = true;
      s.combatTimer = 6.0;
      s.hp = 40;

      tick(0.5);
      // Still in combat, should not regen
      expect(getCombatState("p1")!.hp).toBe(40);
    });

    it("regens after combat decay expires", () => {
      addPlayerAt("p1", 0, 0);

      // Manually put player in combat state without an NPC in range
      const s = getCombatState("p1")!;
      s.inCombat = true;
      s.combatTimer = 6.0;
      s.hp = 40;

      // Tick past the 6s combat decay — combat ends AND one regen tick fires
      tick(6.0);
      expect(s.inCombat).toBe(false);
      expect(getCombatState("p1")!.hp).toBe(41); // +1 from regen in same tick

      // Continue regening
      tick(0.5);
      expect(getCombatState("p1")!.hp).toBe(42); // +1 more
    });
  });

  describe("tick — dead entities", () => {
    it("dead entities are disengaged and leave combat", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 1, 0, 1);

      engageTarget("p1", "n1");
      tick(0.05);
      tick(0.5); // Kill NPC

      const npcState = getCombatState("n1")!;
      expect(npcState.hp).toBe(0);
      expect(npcState.autoAttacking).toBe(false);
      expect(npcState.inCombat).toBe(false);
    });
  });

  describe("tick — edge cases", () => {
    it("skips entity registered in combat but removed from entity store", () => {
      // Register combat state, then remove from entity store (orphaned state)
      addPlayerAt("p1", 0, 0);
      entityStore.remove("p1"); // Orphan the combat state

      // Should not crash — line 67 guard
      expect(() => tick(0.05)).not.toThrow();
    });

    it("engageTarget on non-existent entity is safe", () => {
      expect(() => engageTarget("ghost", "nobody")).not.toThrow();
    });

    it("unknown weapon type falls back to range 1", () => {
      addPlayerAt("p1", 0, 0);
      addNpcAt("n1", 2, 0, 20);

      // Manually set an unknown weapon type
      const s = getCombatState("p1")!;
      s.weaponType = "laser" as any;
      s.autoAttacking = true;
      s.targetId = "n1";

      tick(0.05); // Start wind-up
      tick(0.5);  // Complete wind-up

      // Distance is 2, unknown weapon falls back to range 1, so no damage
      expect(getCombatState("n1")!.hp).toBe(20);
    });

    it("attacker disengages when target has no combat state", () => {
      addPlayerAt("p1", 0, 0);
      // Add entity to store but don't register combat
      const raw = makeEntity({ entityId: "raw-npc", entityType: "npc", x: 1, z: 0 });
      entityStore.add(raw);

      engageTarget("p1", "raw-npc");
      tick(0.05);
      tick(0.5);

      // Should have disengaged (no target combat state)
      expect(getCombatState("p1")!.autoAttacking).toBe(false);
    });

    it("regen accumulates fractional time before ticking", () => {
      addPlayerAt("p1", 0, 0);
      const s = getCombatState("p1")!;
      s.hp = 40;

      // Small ticks that don't individually reach 0.5s
      tick(0.1);
      tick(0.1);
      tick(0.1);
      tick(0.1);
      expect(s.hp).toBe(40); // Not yet 0.5s accumulated

      tick(0.1); // Total 0.5s — regen fires
      expect(s.hp).toBe(41);
    });
  });
});
