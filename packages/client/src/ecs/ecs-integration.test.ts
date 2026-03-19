import { describe, it, expect, beforeEach } from "vitest";
import { EntityManager } from "./EntityManager";
import { createPosition } from "./components/Position";
import { createMovement } from "./components/Movement";
import { createStats } from "./components/Stats";
import { createCombat } from "./components/Combat";
import { MovementSystem } from "./systems/MovementSystem";
import { InterpolationSystem } from "./systems/InterpolationSystem";
import { CombatSystem } from "./systems/CombatSystem";

describe("ECS integration", () => {
  let em: EntityManager;
  let movementSystem: MovementSystem;
  let interpSystem: InterpolationSystem;
  let combatSystem: CombatSystem;

  beforeEach(() => {
    em = new EntityManager();
    movementSystem = new MovementSystem(em);
    interpSystem = new InterpolationSystem(em);
    combatSystem = new CombatSystem(em);
  });

  describe("movement → position → spatial grid", () => {
    it("movement system updates position and spatial index", () => {
      em.addEntity("p1");
      em.addComponent("p1", createPosition(0, 0, 0));
      const mov = createMovement(5.0, 0, 0);
      em.addComponent("p1", mov);

      // Queue a move right
      mov.queuedDx = 1;
      mov.queuedDz = 0;

      // Run movement system until arrival
      for (let i = 0; i < 30; i++) movementSystem.update(0.016);

      const pos = em.getComponent("p1", "position") as any;
      expect(pos.x).toBe(1);
      expect(pos.z).toBe(0);

      // Entity should be findable at new position via spatial grid
      const nearby = em.getEntitiesInRadius(1, 0, 2);
      expect(nearby.length).toBe(1);
      expect(nearby[0].id).toBe("p1");
    });

    it("queued moves chain through multiple tiles", () => {
      em.addEntity("p1");
      em.addComponent("p1", createPosition(0, 0, 0));
      const mov = createMovement(10.0, 0, 0); // Fast speed
      em.addComponent("p1", mov);

      // Move right, then queue down
      mov.queuedDx = 1;
      for (let i = 0; i < 20; i++) movementSystem.update(0.016);

      // Now queue next move
      mov.queuedDz = 1;
      for (let i = 0; i < 20; i++) movementSystem.update(0.016);

      expect(mov.tileX).toBe(1);
      expect(mov.tileZ).toBe(1);
    });
  });

  describe("interpolation + position", () => {
    it("remote entity converges to server target", () => {
      em.addEntity("remote-npc");
      const pos = createPosition(0, 0, 0);
      pos.isRemote = true;
      pos.remoteTargetX = 10;
      pos.remoteTargetZ = 20;
      em.addComponent("remote-npc", pos);

      // Run interpolation for many frames
      for (let i = 0; i < 60; i++) interpSystem.update(0.016);

      expect(pos.x).toBeCloseTo(10, 0);
      expect(pos.z).toBeCloseTo(20, 0);
    });

    it("local entity is not affected by interpolation", () => {
      em.addEntity("local");
      const pos = createPosition(5, 0, 5);
      pos.isRemote = false;
      pos.remoteTargetX = 100; // Should be ignored
      em.addComponent("local", pos);

      interpSystem.update(0.1);
      expect(pos.x).toBe(5); // Unchanged
    });
  });

  describe("combat → stats interaction", () => {
    it("combat damages stats, then regen heals", () => {
      // Attacker
      em.addEntity("atk");
      em.addComponent("atk", createPosition(0, 0, 0));
      em.addComponent("atk", createStats(10, 10, 10));
      em.addComponent("atk", createCombat("melee", 5, 2.0));

      // Target in melee range
      em.addEntity("tgt");
      em.addComponent("tgt", createPosition(1, 0, 0));
      const tgtStats = createStats(10, 10, 10);
      tgtStats.hp = 20;
      tgtStats.maxHp = 20;
      em.addComponent("tgt", tgtStats);
      em.addComponent("tgt", createCombat("melee", 3, 2.0));

      // Engage and run combat
      combatSystem.engageTarget("atk", "tgt");
      for (let i = 0; i < 20; i++) combatSystem.update(0.05);

      // Target should have taken damage
      expect(tgtStats.hp).toBeLessThan(20);
      const damagedHp = tgtStats.hp;

      // Disengage both and wait for combat decay
      combatSystem.cancelAutoAttack("atk");
      combatSystem.cancelAutoAttack("tgt");
      const tgtCombat = em.getComponent("tgt", "combat") as any;
      tgtCombat.inCombat = false; // Force out of combat for regen

      // Run regen ticks
      for (let i = 0; i < 20; i++) combatSystem.update(0.5);

      // Should have regened some HP
      expect(tgtStats.hp).toBeGreaterThan(damagedHp);
      // But not above max
      expect(tgtStats.hp).toBeLessThanOrEqual(20);
    });
  });

  describe("full entity lifecycle", () => {
    it("entity spawn → move → combat → death → cleanup", () => {
      // Player with lots of HP
      em.addEntity("player");
      em.addComponent("player", createPosition(0, 0, 0));
      em.addComponent("player", createStats(10, 10, 10));
      em.addComponent("player", createCombat("melee", 100, 1.0)); // Instant kill damage

      // NPC next to player
      em.addEntity("npc");
      em.addComponent("npc", createPosition(1, 0, 0));
      const npcStats = createStats();
      npcStats.hp = 5;
      npcStats.maxHp = 5;
      em.addComponent("npc", npcStats);
      em.addComponent("npc", createCombat("melee", 1, 2.0));

      // Verify both exist
      expect(em.getEntityCount()).toBe(2);

      // Engage and kill
      combatSystem.engageTarget("player", "npc");
      for (let i = 0; i < 20; i++) combatSystem.update(0.05);

      // NPC should be dead
      expect(npcStats.hp).toBe(0);

      // Player should have disengaged (target dead)
      const playerCombat = em.getComponent("player", "combat") as any;
      expect(playerCombat.autoAttacking).toBe(false);

      // Clean up dead NPC
      em.removeEntity("npc");
      expect(em.getEntityCount()).toBe(1);
      expect(em.getEntity("npc")).toBeUndefined();
    });
  });
});
