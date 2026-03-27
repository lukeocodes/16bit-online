import { describe, it, expect } from "vitest";
import { createPosition } from "./Position";
import { createMovement } from "./Movement";
import { createStats } from "./Stats";
import { createCombat, WEAPON_RANGE } from "./Combat";
import { createIdentity } from "./Identity";
import { createRenderable } from "./Renderable";

describe("ECS component factories", () => {
  describe("createPosition", () => {
    it("creates with defaults", () => {
      const pos = createPosition();
      expect(pos.type).toBe("position");
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      expect(pos.z).toBe(0);
      expect(pos.rotation).toBe(0);
      expect(pos.mapId).toBe(1);
      expect(pos.isRemote).toBe(false);
    });

    it("initializes remote targets to match position", () => {
      const pos = createPosition(10, 5, 20);
      expect(pos.remoteTargetX).toBe(10);
      expect(pos.remoteTargetY).toBe(5);
      expect(pos.remoteTargetZ).toBe(20);
    });

    it("accepts custom values", () => {
      const pos = createPosition(3, 1, 7, 1.57, 2);
      expect(pos.x).toBe(3);
      expect(pos.y).toBe(1);
      expect(pos.z).toBe(7);
      expect(pos.rotation).toBe(1.57);
      expect(pos.mapId).toBe(2);
    });
  });

  describe("createMovement", () => {
    it("creates with defaults", () => {
      const mov = createMovement();
      expect(mov.type).toBe("movement");
      expect(mov.speed).toBe(5.0);
      expect(mov.tileX).toBe(0);
      expect(mov.tileZ).toBe(0);
      expect(mov.moving).toBe(false);
    });

    it("starts idle (progress = 1)", () => {
      const mov = createMovement();
      expect(mov.progress).toBe(1);
    });

    it("target matches start position", () => {
      const mov = createMovement(3.0, 10, 20);
      expect(mov.tileX).toBe(10);
      expect(mov.tileZ).toBe(20);
      expect(mov.targetX).toBe(10);
      expect(mov.targetZ).toBe(20);
    });

    it("has no queued direction by default", () => {
      const mov = createMovement();
      expect(mov.queuedDx).toBe(0);
      expect(mov.queuedDz).toBe(0);
    });
  });

  describe("createStats", () => {
    it("creates with defaults", () => {
      const stats = createStats();
      expect(stats.type).toBe("stats");
      expect(stats.str).toBe(10);
      expect(stats.dex).toBe(10);
      expect(stats.int).toBe(10);
    });

    it("initializes all pools to 50", () => {
      const stats = createStats();
      expect(stats.hp).toBe(50);
      expect(stats.maxHp).toBe(50);
      expect(stats.mana).toBe(50);
      expect(stats.maxMana).toBe(50);
      expect(stats.stamina).toBe(50);
      expect(stats.maxStamina).toBe(50);
    });

    it("accepts custom stat values", () => {
      const stats = createStats(15, 5, 10);
      expect(stats.str).toBe(15);
      expect(stats.dex).toBe(5);
      expect(stats.int).toBe(10);
    });
  });

  describe("createCombat", () => {
    it("creates with defaults", () => {
      const combat = createCombat();
      expect(combat.type).toBe("combat");
      expect(combat.weaponType).toBe("melee");
      expect(combat.weaponDamage).toBe(5);
      expect(combat.attackSpeed).toBe(2.0);
    });

    it("starts disengaged", () => {
      const combat = createCombat();
      expect(combat.autoAttacking).toBe(false);
      expect(combat.targetEntityId).toBeNull();
      expect(combat.inCombat).toBe(false);
      expect(combat.windingUp).toBe(false);
    });

    it("has 0.5s wind-up time", () => {
      const combat = createCombat();
      expect(combat.windUpTime).toBe(0.5);
    });

    it("accepts custom weapon config", () => {
      const combat = createCombat("ranged", 8, 3.0);
      expect(combat.weaponType).toBe("ranged");
      expect(combat.weaponDamage).toBe(8);
      expect(combat.attackSpeed).toBe(3.0);
    });
  });

  describe("WEAPON_RANGE", () => {
    it("melee has range 1", () => {
      expect(WEAPON_RANGE.melee).toBe(1);
    });

    it("ranged has range 4", () => {
      expect(WEAPON_RANGE.ranged).toBe(4);
    });

    it("magic has range 4", () => {
      expect(WEAPON_RANGE.magic).toBe(4);
    });
  });

  describe("createIdentity", () => {
    it("creates with required fields", () => {
      const id = createIdentity("e-42", "Gandalf");
      expect(id.type).toBe("identity");
      expect(id.entityId).toBe("e-42");
      expect(id.name).toBe("Gandalf");
    });

    it("defaults to player type and non-local", () => {
      const id = createIdentity("e-1", "Test");
      expect(id.entityType).toBe("player");
      expect(id.isLocal).toBe(false);
    });

    it("accepts NPC entity type", () => {
      const id = createIdentity("n-1", "Goblin", "npc");
      expect(id.entityType).toBe("npc");
    });

    it("accepts local flag", () => {
      const id = createIdentity("p-1", "Me", "player", true);
      expect(id.isLocal).toBe(true);
    });
  });

  describe("createRenderable", () => {
    it("creates with defaults", () => {
      const r = createRenderable();
      expect(r.type).toBe("renderable");
      expect(r.meshType).toBe("player");
      expect(r.bodyColor).toBe("#4466aa");
      expect(r.skinColor).toBe("#e8c4a0");
      expect(r.hairColor).toBe("#2c1b0e");
    });

    it("starts with no display object and visible", () => {
      const r = createRenderable();
      expect(r.displayObject).toBeNull();
      expect(r.visible).toBe(true);
    });

    it("accepts custom colors", () => {
      const r = createRenderable("npc", "#ff0000", "#00ff00", "#0000ff");
      expect(r.meshType).toBe("npc");
      expect(r.bodyColor).toBe("#ff0000");
      expect(r.skinColor).toBe("#00ff00");
      expect(r.hairColor).toBe("#0000ff");
    });
  });
});
