import { describe, it, expect, beforeEach, vi } from "vitest";
import { EntityManager } from "../EntityManager";
import { createPosition } from "../components/Position";
import { createStats } from "../components/Stats";
import { createCombat } from "../components/Combat";
import { CombatSystem } from "./CombatSystem";

function addEntity(em: EntityManager, id: string, x: number, z: number, hp = 50, weaponType: "melee" | "ranged" | "magic" = "melee", damage = 5) {
  em.addEntity(id);
  em.addComponent(id, createPosition(x, 0, z));
  const stats = createStats();
  stats.hp = hp;
  stats.maxHp = hp;
  em.addComponent(id, stats);
  em.addComponent(id, createCombat(weaponType, damage, 2.0));
}

describe("CombatSystem (client)", () => {
  let em: EntityManager;
  let system: CombatSystem;

  beforeEach(() => {
    em = new EntityManager();
    system = new CombatSystem(em);
  });

  describe("engageTarget / cancelAutoAttack", () => {
    it("sets auto-attack on target", () => {
      addEntity(em, "p1", 0, 0);
      addEntity(em, "n1", 1, 0, 10);

      system.engageTarget("p1", "n1");
      const combat = em.getComponent("p1", "combat") as any;
      expect(combat.autoAttacking).toBe(true);
      expect(combat.targetEntityId).toBe("n1");
    });

    it("toggles off when engaging same target", () => {
      addEntity(em, "p1", 0, 0);
      addEntity(em, "n1", 1, 0);

      system.engageTarget("p1", "n1");
      system.engageTarget("p1", "n1");
      const combat = em.getComponent("p1", "combat") as any;
      expect(combat.autoAttacking).toBe(false);
      expect(combat.targetEntityId).toBeNull();
    });

    it("switches target", () => {
      addEntity(em, "p1", 0, 0);
      addEntity(em, "n1", 1, 0);
      addEntity(em, "n2", 0, 1);

      system.engageTarget("p1", "n1");
      system.engageTarget("p1", "n2");
      expect((em.getComponent("p1", "combat") as any).targetEntityId).toBe("n2");
    });

    it("cancelAutoAttack disengages", () => {
      addEntity(em, "p1", 0, 0);
      addEntity(em, "n1", 1, 0);

      system.engageTarget("p1", "n1");
      system.cancelAutoAttack("p1");
      const combat = em.getComponent("p1", "combat") as any;
      expect(combat.autoAttacking).toBe(false);
    });
  });

  describe("attack cycle", () => {
    it("deals damage after wind-up", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 5);
      addEntity(em, "n1", 1, 0, 20);

      system.engageTarget("p1", "n1");
      system.update(0.05); // Starts wind-up
      system.update(0.5);  // Wind-up completes

      expect((em.getComponent("n1", "stats") as any).hp).toBeLessThan(20);
    });

    it("fires onDamage callback", () => {
      const onDamage = vi.fn();
      system.setOnDamage(onDamage);

      addEntity(em, "p1", 0, 0, 50, "melee", 5);
      addEntity(em, "n1", 1, 0, 20);

      system.engageTarget("p1", "n1");
      system.update(0.05);
      system.update(0.5);

      expect(onDamage).toHaveBeenCalledWith(expect.objectContaining({
        attackerId: "p1",
        targetId: "n1",
        damage: 5,
        weaponType: "melee",
      }));
    });

    it("target retaliates after being hit", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 5);
      addEntity(em, "n1", 1, 0, 20, "melee", 3);

      system.engageTarget("p1", "n1");
      system.update(0.05);
      system.update(0.5);

      const npcCombat = em.getComponent("n1", "combat") as any;
      expect(npcCombat.autoAttacking).toBe(true);
      expect(npcCombat.targetEntityId).toBe("p1");
    });

    it("does not attack out of melee range", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 5);
      addEntity(em, "n1", 3, 0, 20); // Chebyshev dist = 3 > melee range 1

      system.engageTarget("p1", "n1");
      system.update(0.05);
      system.update(0.5);

      expect((em.getComponent("n1", "stats") as any).hp).toBe(20);
    });

    it("ranged attacks from distance 3", () => {
      addEntity(em, "p1", 0, 0, 50, "ranged", 4);
      addEntity(em, "n1", 3, 0, 20); // Chebyshev dist = 3 <= ranged range 4

      system.engageTarget("p1", "n1");
      system.update(0.05);
      system.update(0.5);

      expect((em.getComponent("n1", "stats") as any).hp).toBeLessThan(20);
    });
  });

  describe("dead entities", () => {
    it("dead entity disengages and leaves combat", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 100);
      addEntity(em, "n1", 1, 0, 1); // Dies in one hit

      system.engageTarget("p1", "n1");
      system.update(0.05);
      system.update(0.5);

      const npcCombat = em.getComponent("n1", "combat") as any;
      expect(npcCombat.autoAttacking).toBe(false);
      expect(npcCombat.inCombat).toBe(false);
    });

    it("attacker disengages when target is dead", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 100);
      addEntity(em, "n1", 1, 0, 1);

      system.engageTarget("p1", "n1");
      for (let i = 0; i < 20; i++) system.update(0.05);

      const playerCombat = em.getComponent("p1", "combat") as any;
      expect(playerCombat.autoAttacking).toBe(false);
    });

    it("HP never goes below 0", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 999);
      addEntity(em, "n1", 1, 0, 5);

      system.engageTarget("p1", "n1");
      system.update(0.05);
      system.update(0.5);

      expect((em.getComponent("n1", "stats") as any).hp).toBe(0);
    });
  });

  describe("HP regen", () => {
    it("regens when out of combat", () => {
      addEntity(em, "p1", 0, 0, 50);
      const stats = em.getComponent("p1", "stats") as any;
      stats.hp = 40;

      system.update(0.5);
      expect(stats.hp).toBe(41);
    });

    it("does not regen while in combat", () => {
      addEntity(em, "p1", 0, 0, 50);
      const stats = em.getComponent("p1", "stats") as any;
      const combat = em.getComponent("p1", "combat") as any;
      stats.hp = 40;
      combat.inCombat = true;
      combat.combatTimer = 6.0;

      system.update(0.5);
      expect(stats.hp).toBe(40);
    });

    it("does not regen above maxHp", () => {
      addEntity(em, "p1", 0, 0, 50);
      system.update(0.5);
      expect((em.getComponent("p1", "stats") as any).hp).toBe(50);
    });
  });

  describe("combat decay", () => {
    it("exits combat after 6s", () => {
      addEntity(em, "p1", 0, 0);
      const combat = em.getComponent("p1", "combat") as any;
      combat.inCombat = true;
      combat.combatTimer = 6.0;

      system.update(6.0);
      expect(combat.inCombat).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("skips target with no position component", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 5);

      // Create target with combat but no position
      em.addEntity("no-pos");
      em.addComponent("no-pos", createStats());
      em.addComponent("no-pos", createCombat());

      system.engageTarget("p1", "no-pos");
      // Should not crash — line 81 guard (targetPos check)
      expect(() => {
        for (let i = 0; i < 20; i++) system.update(0.05);
      }).not.toThrow();
    });

    it("disengages when target entity is removed", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 5);
      addEntity(em, "tgt", 1, 0, 20);

      system.engageTarget("p1", "tgt");
      em.removeEntity("tgt"); // Remove target mid-combat

      system.update(0.05);
      expect((em.getComponent("p1", "combat") as any).autoAttacking).toBe(false);
    });

    it("engageTarget on non-existent attacker is safe", () => {
      expect(() => system.engageTarget("ghost", "nobody")).not.toThrow();
    });

    it("cancelAutoAttack on non-existent entity is safe", () => {
      expect(() => system.cancelAutoAttack("ghost")).not.toThrow();
    });

    it("target with no stats component still processes", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 5);

      // Target with position and combat but no stats
      em.addEntity("no-stats");
      em.addComponent("no-stats", createPosition(1, 0, 0));
      em.addComponent("no-stats", createCombat());

      system.engageTarget("p1", "no-stats");
      expect(() => {
        for (let i = 0; i < 20; i++) system.update(0.05);
      }).not.toThrow();
    });

    it("entity with combat but no stats skips dead check", () => {
      // Combat component without stats — selfStats is undefined, hp check skipped
      em.addEntity("no-stats-self");
      em.addComponent("no-stats-self", createPosition(0, 0, 0));
      em.addComponent("no-stats-self", createCombat());

      expect(() => system.update(0.05)).not.toThrow();
    });

    it("target already auto-attacking does not re-retaliate", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 5);
      addEntity(em, "n1", 1, 0, 30, "melee", 3);
      addEntity(em, "other", 0, 1, 50); // NPC's existing target must exist

      // NPC is already attacking a different entity
      const npcCombat = em.getComponent("n1", "combat") as any;
      npcCombat.autoAttacking = true;
      npcCombat.targetEntityId = "other";

      // Player attacks NPC — NPC should NOT switch target (already attacking)
      system.engageTarget("p1", "n1");
      system.update(0.05);
      system.update(0.5); // Player hits NPC

      // NPC keeps its original target
      expect(npcCombat.targetEntityId).toBe("other");
    });

    it("regen timer initializes on first tick", () => {
      addEntity(em, "p1", 0, 0, 50);
      const stats = em.getComponent("p1", "stats") as any;
      const combat = em.getComponent("p1", "combat") as any;
      stats.hp = 45;

      // _regenTimer starts at 0 from createCombat
      expect(combat._regenTimer).toBe(0);

      // Tick less than 0.5s — timer accumulates
      system.update(0.3);
      expect(combat._regenTimer).toBeCloseTo(0.3);
      expect(stats.hp).toBe(45); // No regen yet

      // Tick past threshold
      system.update(0.3);
      expect(stats.hp).toBe(46); // Regen fired
      expect(combat._regenTimer).toBe(0); // Reset
    });

    it("dealDamage with no targetStats is safe", () => {
      addEntity(em, "p1", 0, 0, 50, "melee", 5);

      // Target has position and combat but NO stats
      em.addEntity("fragile");
      em.addComponent("fragile", createPosition(1, 0, 0));
      em.addComponent("fragile", createCombat());
      // No stats component — dealDamage should bail

      system.engageTarget("p1", "fragile");
      system.update(0.05);
      system.update(0.5);

      // Should not crash, player stays engaged but damage has no effect
      expect(() => system.update(0.05)).not.toThrow();
    });
  });
});
