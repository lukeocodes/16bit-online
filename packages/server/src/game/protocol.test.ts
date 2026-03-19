import { describe, it, expect } from "vitest";
import {
  Opcode,
  packReliable,
  packEntitySpawn,
  packEntityDespawn,
  packDamageEvent,
  packEntityDeath,
  packEntityState,
  packCombatState,
  packSpawnPoint,
  packPosition,
  unpackPosition,
} from "./protocol.js";

describe("protocol", () => {
  describe("Opcode values", () => {
    it("has distinct opcodes for each message type", () => {
      const values = Object.values(Opcode);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it("has expected opcode assignments", () => {
      expect(Opcode.POSITION_UPDATE).toBe(1);
      expect(Opcode.ENTITY_SPAWN).toBe(2);
      expect(Opcode.ENTITY_DESPAWN).toBe(3);
      expect(Opcode.DAMAGE_EVENT).toBe(50);
      expect(Opcode.ENTITY_DEATH).toBe(51);
      expect(Opcode.WORLD_READY).toBe(100);
    });
  });

  describe("packReliable", () => {
    it("produces valid JSON with op field", () => {
      const msg = packReliable(42, { foo: "bar" });
      const parsed = JSON.parse(msg);
      expect(parsed.op).toBe(42);
      expect(parsed.foo).toBe("bar");
    });
  });

  describe("packEntitySpawn", () => {
    it("includes all required fields", () => {
      const msg = JSON.parse(packEntitySpawn("e-1", "TestNPC", 10, 0, 20, "npc", 15, 15, "#ff0000", "#00ff00", "ranged"));
      expect(msg.op).toBe(Opcode.ENTITY_SPAWN);
      expect(msg.entityId).toBe("e-1");
      expect(msg.name).toBe("TestNPC");
      expect(msg.x).toBe(10);
      expect(msg.y).toBe(0);
      expect(msg.z).toBe(20);
      expect(msg.entityType).toBe("npc");
      expect(msg.hp).toBe(15);
      expect(msg.maxHp).toBe(15);
      expect(msg.bodyColor).toBe("#ff0000");
      expect(msg.weaponType).toBe("ranged");
    });

    it("uses defaults for optional params", () => {
      const msg = JSON.parse(packEntitySpawn("e-2", "Player", 0, 0, 0));
      expect(msg.entityType).toBe("player");
      expect(msg.hp).toBe(50);
      expect(msg.maxHp).toBe(50);
    });
  });

  describe("packEntityDespawn", () => {
    it("produces despawn message", () => {
      const msg = JSON.parse(packEntityDespawn("e-99"));
      expect(msg.op).toBe(Opcode.ENTITY_DESPAWN);
      expect(msg.entityId).toBe("e-99");
    });
  });

  describe("packDamageEvent", () => {
    it("includes attacker, target, damage, and weapon type", () => {
      const msg = JSON.parse(packDamageEvent("atk-1", "tgt-1", 7, "magic"));
      expect(msg.op).toBe(Opcode.DAMAGE_EVENT);
      expect(msg.attackerId).toBe("atk-1");
      expect(msg.targetId).toBe("tgt-1");
      expect(msg.damage).toBe(7);
      expect(msg.weaponType).toBe("magic");
    });
  });

  describe("packEntityDeath", () => {
    it("produces death message", () => {
      const msg = JSON.parse(packEntityDeath("dead-1"));
      expect(msg.op).toBe(Opcode.ENTITY_DEATH);
      expect(msg.entityId).toBe("dead-1");
    });
  });

  describe("packEntityState", () => {
    it("includes hp and maxHp", () => {
      const msg = JSON.parse(packEntityState("e-1", 25, 50));
      expect(msg.op).toBe(Opcode.ENTITY_STATE);
      expect(msg.hp).toBe(25);
      expect(msg.maxHp).toBe(50);
    });
  });

  describe("packCombatState", () => {
    it("includes combat state fields", () => {
      const msg = JSON.parse(packCombatState("e-1", true, true, "e-2"));
      expect(msg.op).toBe(Opcode.COMBAT_STATE);
      expect(msg.entityId).toBe("e-1");
      expect(msg.inCombat).toBe(true);
      expect(msg.autoAttacking).toBe(true);
      expect(msg.targetId).toBe("e-2");
    });

    it("handles null targetId", () => {
      const msg = JSON.parse(packCombatState("e-1", false, false, null));
      expect(msg.targetId).toBeNull();
    });
  });

  describe("packSpawnPoint", () => {
    it("includes all spawn point data", () => {
      const msg = JSON.parse(packSpawnPoint("sp-1", 10, 20, 8, ["goblin-grunt", "goblin-shaman"], 4, 5));
      expect(msg.op).toBe(Opcode.SPAWN_POINT);
      expect(msg.id).toBe("sp-1");
      expect(msg.x).toBe(10);
      expect(msg.z).toBe(20);
      expect(msg.distance).toBe(8);
      expect(msg.npcIds).toEqual(["goblin-grunt", "goblin-shaman"]);
      expect(msg.maxCount).toBe(4);
      expect(msg.frequency).toBe(5);
    });
  });

  describe("packPosition / unpackPosition", () => {
    it("round-trips standard coordinates", () => {
      const buf = packPosition(42, 10.5, 0, -3.25, 1.57);
      const result = unpackPosition(buf);
      expect(result.entityId).toBe(42);
      expect(result.x).toBeCloseTo(10.5, 2);
      expect(result.y).toBeCloseTo(0, 2);
      expect(result.z).toBeCloseTo(-3.25, 2);
      expect(result.rotation).toBeCloseTo(1.57, 2);
    });

    it("handles zero values", () => {
      const buf = packPosition(0, 0, 0, 0, 0);
      const result = unpackPosition(buf);
      expect(result.entityId).toBe(0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);
      expect(result.rotation).toBe(0);
    });

    it("handles large entity IDs (u32 range)", () => {
      const maxU32 = 4294967295;
      const buf = packPosition(maxU32, 1, 2, 3, 0);
      expect(unpackPosition(buf).entityId).toBe(maxU32);
    });

    it("handles negative coordinates", () => {
      const buf = packPosition(1, -100.5, -50, -200.75, -3.14);
      const result = unpackPosition(buf);
      expect(result.x).toBeCloseTo(-100.5, 1);
      expect(result.y).toBeCloseTo(-50, 1);
      expect(result.z).toBeCloseTo(-200.75, 1);
      expect(result.rotation).toBeCloseTo(-3.14, 2);
    });

    it("produces a buffer of exactly 24 bytes", () => {
      const buf = packPosition(1, 0, 0, 0, 0);
      expect(buf.length).toBe(24);
    });

    it("sets the correct opcode byte", () => {
      const buf = packPosition(1, 0, 0, 0, 0);
      expect(buf.readUInt8(0)).toBe(Opcode.POSITION_UPDATE);
    });
  });
});
