import { describe, it, expect, beforeEach, vi } from "vitest";
import { EntityManager } from "../ecs/EntityManager";
import { Opcode, packReliable } from "./Protocol";
import { StateSync } from "./StateSync";

describe("StateSync", () => {
  let em: EntityManager;
  let sync: StateSync;

  beforeEach(() => {
    em = new EntityManager();
    sync = new StateSync(em);
    sync.setLocalEntityId("local-player");
  });

  describe("handleReliableMessage — ENTITY_SPAWN", () => {
    it("spawns a remote entity with all components", () => {
      const msg = packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "npc-1",
        name: "Goblin",
        entityType: "npc",
        x: 5, y: 0, z: 10,
        hp: 15, maxHp: 15,
        bodyColor: "#556b2f",
        skinColor: "#6b8e23",
        weaponType: "melee",
      });

      sync.handleReliableMessage(msg);

      const entity = em.getEntity("npc-1");
      expect(entity).toBeDefined();

      const pos = em.getComponent("npc-1", "position");
      expect(pos).toBeDefined();
      expect((pos as any).x).toBe(5);
      expect((pos as any).z).toBe(10);
      expect((pos as any).isRemote).toBe(true);

      const identity = em.getComponent("npc-1", "identity");
      expect(identity).toBeDefined();
      expect((identity as any).name).toBe("Goblin");
      expect((identity as any).entityType).toBe("npc");

      const stats = em.getComponent("npc-1", "stats");
      expect(stats).toBeDefined();
      expect((stats as any).hp).toBe(15);
      expect((stats as any).maxHp).toBe(15);
    });

    it("does not spawn the local player entity", () => {
      const msg = packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "local-player",
        name: "Me",
        x: 0, y: 0, z: 0,
      });

      sync.handleReliableMessage(msg);
      expect(em.getEntity("local-player")).toBeUndefined();
    });

    it("does not duplicate existing entity", () => {
      const msg = packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "npc-1", name: "Goblin", x: 0, y: 0, z: 0,
      });

      sync.handleReliableMessage(msg);
      sync.handleReliableMessage(msg); // Duplicate
      expect(em.getEntityCount()).toBe(1);
    });
  });

  describe("handleReliableMessage — ENTITY_DESPAWN", () => {
    it("removes a remote entity", () => {
      // First spawn
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "npc-1", name: "Goblin", x: 0, y: 0, z: 0,
      }));
      expect(em.getEntity("npc-1")).toBeDefined();

      // Then despawn
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_DESPAWN, {
        entityId: "npc-1",
      }));
      expect(em.getEntity("npc-1")).toBeUndefined();
    });

    it("does not remove local player", () => {
      em.addEntity("local-player");
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_DESPAWN, {
        entityId: "local-player",
      }));
      expect(em.getEntity("local-player")).toBeDefined();
    });
  });

  describe("handleReliableMessage — ENTITY_STATE", () => {
    it("updates HP on an existing entity", () => {
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "npc-1", name: "Goblin", x: 0, y: 0, z: 0, hp: 15, maxHp: 15,
      }));

      sync.handleReliableMessage(packReliable(Opcode.ENTITY_STATE, {
        entityId: "npc-1", hp: 8, maxHp: 15,
      }));

      const stats = em.getComponent("npc-1", "stats");
      expect((stats as any).hp).toBe(8);
    });
  });

  describe("handleReliableMessage — DAMAGE_EVENT", () => {
    it("calls onDamage callback", () => {
      const onDamage = vi.fn();
      sync.setOnDamage(onDamage);

      sync.handleReliableMessage(packReliable(Opcode.DAMAGE_EVENT, {
        attackerId: "p1", targetId: "npc-1", damage: 5, weaponType: "melee",
      }));

      expect(onDamage).toHaveBeenCalledWith("p1", "npc-1", 5, "melee");
    });
  });

  describe("handleReliableMessage — ENTITY_DEATH", () => {
    it("calls onDeath callback", () => {
      const onDeath = vi.fn();
      sync.setOnDeath(onDeath);

      sync.handleReliableMessage(packReliable(Opcode.ENTITY_DEATH, {
        entityId: "npc-1",
      }));

      expect(onDeath).toHaveBeenCalledWith("npc-1");
    });
  });

  describe("handleReliableMessage — COMBAT_STATE", () => {
    it("updates combat component and calls callback", () => {
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "npc-1", name: "Goblin", x: 0, y: 0, z: 0, weaponType: "melee",
      }));

      const onCombat = vi.fn();
      sync.setOnCombatState(onCombat);

      sync.handleReliableMessage(packReliable(Opcode.COMBAT_STATE, {
        entityId: "npc-1", inCombat: true, autoAttacking: true, targetId: "p1",
      }));

      const combat = em.getComponent("npc-1", "combat");
      expect((combat as any).inCombat).toBe(true);
      expect((combat as any).autoAttacking).toBe(true);
      expect((combat as any).targetEntityId).toBe("p1");
      expect(onCombat).toHaveBeenCalledWith("npc-1", true, true, "p1");
    });
  });

  describe("handleReliableMessage — SPAWN_POINT", () => {
    it("stores spawn point data", () => {
      sync.handleReliableMessage(packReliable(Opcode.SPAWN_POINT, {
        id: "sp-1", x: 10, z: 20, distance: 8,
        npcIds: ["goblin-grunt"], maxCount: 4, frequency: 5,
      }));

      expect(sync.spawnPoints.length).toBe(1);
      expect(sync.spawnPoints[0].id).toBe("sp-1");
      expect(sync.spawnPoints[0].x).toBe(10);
      expect(sync.spawnPoints[0].npcIds).toEqual(["goblin-grunt"]);
    });
  });

  describe("handlePositionMessage", () => {
    it("updates remote entity position targets", () => {
      // Spawn entity to register numeric ID mapping
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "npc-1", name: "Goblin", x: 0, y: 0, z: 0,
      }));

      // Build a batched position buffer
      // Need the hash of "npc-1" to match the numericIdMap
      const hash = hashCode("npc-1");
      const ENTRY_SIZE = 20;
      const buf = new ArrayBuffer(2 + ENTRY_SIZE);
      const view = new DataView(buf);
      view.setUint16(0, 1, true); // count = 1
      view.setUint32(2, hash, true);
      view.setFloat32(6, 15.5, true); // x
      view.setFloat32(10, 0, true);   // y
      view.setFloat32(14, 22.3, true); // z
      view.setFloat32(18, 1.57, true); // rotation

      sync.handlePositionMessage(buf);

      const pos = em.getComponent("npc-1", "position");
      expect((pos as any).remoteTargetX).toBeCloseTo(15.5);
      expect((pos as any).remoteTargetZ).toBeCloseTo(22.3);
    });

    it("ignores position updates for local player", () => {
      // Local player would have its own position management
      em.addEntity("local-player");
      // No position component, so it should just skip gracefully
      const buf = new ArrayBuffer(2);
      new DataView(buf).setUint16(0, 0, true); // count = 0
      expect(() => sync.handlePositionMessage(buf)).not.toThrow();
    });

    it("ignores messages with insufficient bytes", () => {
      expect(() => sync.handlePositionMessage(new ArrayBuffer(1))).not.toThrow();
    });

    it("skips entries for unknown numeric IDs", () => {
      const ENTRY_SIZE = 20;
      const buf = new ArrayBuffer(2 + ENTRY_SIZE);
      const view = new DataView(buf);
      view.setUint16(0, 1, true);
      view.setUint32(2, 99999, true); // Unknown hash
      view.setFloat32(6, 50, true);

      // Should not crash, just skip
      expect(() => sync.handlePositionMessage(buf)).not.toThrow();
    });

    it("handles truncated entry gracefully", () => {
      // Header says 1 entry but buffer too small for a full entry
      const buf = new ArrayBuffer(2 + 10); // 10 < 20 byte entry
      const view = new DataView(buf);
      view.setUint16(0, 1, true);

      expect(() => sync.handlePositionMessage(buf)).not.toThrow();
    });
  });

  describe("handleReliableMessage — SYSTEM_MESSAGE", () => {
    it("logs system messages without crashing", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      sync.handleReliableMessage(packReliable(Opcode.SYSTEM_MESSAGE, {
        message: "Server restarting in 5 minutes",
      }));

      expect(spy).toHaveBeenCalledWith("[System]", "Server restarting in 5 minutes");
      spy.mockRestore();
    });
  });

  describe("handleReliableMessage — unknown opcode", () => {
    it("does not crash on unknown opcode", () => {
      expect(() => {
        sync.handleReliableMessage(packReliable(999, { data: "test" }));
      }).not.toThrow();
    });
  });

  describe("handleReliableMessage — callback-less paths", () => {
    it("DAMAGE_EVENT with no callback set does not crash", () => {
      // Don't set onDamage — test the false branch of `if (this.onDamage)`
      expect(() => {
        sync.handleReliableMessage(packReliable(Opcode.DAMAGE_EVENT, {
          attackerId: "a", targetId: "b", damage: 5, weaponType: "melee",
        }));
      }).not.toThrow();
    });

    it("ENTITY_DEATH with no callback set does not crash", () => {
      expect(() => {
        sync.handleReliableMessage(packReliable(Opcode.ENTITY_DEATH, {
          entityId: "dead",
        }));
      }).not.toThrow();
    });

    it("COMBAT_STATE with no callback set still updates component", () => {
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "npc-cb", name: "NPC", x: 0, y: 0, z: 0,
      }));

      // No onCombatState callback set
      sync.handleReliableMessage(packReliable(Opcode.COMBAT_STATE, {
        entityId: "npc-cb", inCombat: true, autoAttacking: false, targetId: null,
      }));

      const combat = em.getComponent("npc-cb", "combat");
      expect((combat as any).inCombat).toBe(true);
    });
  });

  describe("handleReliableMessage — spawn defaults", () => {
    it("uses defaults for missing spawn fields", () => {
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "bare-npc",
        // name, entityType, x, y, z, hp, maxHp, colors, weaponType all missing
      }));

      const identity = em.getComponent("bare-npc", "identity");
      expect((identity as any).name).toBe("Unknown");
      expect((identity as any).entityType).toBe("player");

      const stats = em.getComponent("bare-npc", "stats");
      expect((stats as any).hp).toBe(50);

      const pos = em.getComponent("bare-npc", "position");
      expect((pos as any).x).toBe(0);
    });
  });

  describe("handleReliableMessage — state for missing entity", () => {
    it("ENTITY_STATE for non-existent entity does not crash", () => {
      expect(() => {
        sync.handleReliableMessage(packReliable(Opcode.ENTITY_STATE, {
          entityId: "ghost", hp: 10, maxHp: 20,
        }));
      }).not.toThrow();
    });

    it("COMBAT_STATE for non-existent entity does not crash", () => {
      expect(() => {
        sync.handleReliableMessage(packReliable(Opcode.COMBAT_STATE, {
          entityId: "ghost", inCombat: true, autoAttacking: false, targetId: null,
        }));
      }).not.toThrow();
    });
  });

  describe("despawn cleans up numericIdMap", () => {
    it("position updates for despawned entity are ignored", () => {
      // Spawn then despawn
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_SPAWN, {
        entityId: "npc-temp", name: "Temp", x: 0, y: 0, z: 0,
      }));
      sync.handleReliableMessage(packReliable(Opcode.ENTITY_DESPAWN, {
        entityId: "npc-temp",
      }));

      // Send position update for the despawned entity's hash
      const hash = hashCode("npc-temp");
      const ENTRY_SIZE = 20;
      const buf = new ArrayBuffer(2 + ENTRY_SIZE);
      const view = new DataView(buf);
      view.setUint16(0, 1, true);
      view.setUint32(2, hash, true);
      view.setFloat32(6, 99, true);

      // Should not crash or create ghost state
      expect(() => sync.handlePositionMessage(buf)).not.toThrow();
      expect(em.getEntity("npc-temp")).toBeUndefined();
    });
  });
});

// Replicate the hash function used in StateSync
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}
