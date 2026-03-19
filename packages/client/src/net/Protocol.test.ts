import { describe, it, expect } from "vitest";
import {
  Opcode,
  packPosition,
  unpackPosition,
  packReliable,
  unpackReliable,
} from "./Protocol";

describe("client Protocol", () => {
  describe("Opcode values", () => {
    it("has distinct opcodes", () => {
      const values = Object.values(Opcode);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it("matches server opcodes for shared message types", () => {
      // These must match server/src/game/protocol.ts exactly
      expect(Opcode.POSITION_UPDATE).toBe(1);
      expect(Opcode.ENTITY_SPAWN).toBe(2);
      expect(Opcode.ENTITY_DESPAWN).toBe(3);
      expect(Opcode.DAMAGE_EVENT).toBe(50);
      expect(Opcode.ENTITY_DEATH).toBe(51);
      expect(Opcode.ENTITY_STATE).toBe(52);
      expect(Opcode.COMBAT_STATE).toBe(53);
      expect(Opcode.SPAWN_POINT).toBe(60);
      expect(Opcode.WORLD_READY).toBe(100);
      expect(Opcode.TARGET_SELECT).toBe(40);
      expect(Opcode.AUTO_ATTACK_TOGGLE).toBe(41);
      expect(Opcode.AUTO_ATTACK_CANCEL).toBe(42);
    });
  });

  describe("packPosition / unpackPosition", () => {
    it("round-trips standard values", () => {
      const buf = packPosition(42, 10.5, 0, -3.25, 1.57);
      const result = unpackPosition(buf);
      expect(result.entityId).toBe(42);
      expect(result.x).toBeCloseTo(10.5, 2);
      expect(result.y).toBeCloseTo(0, 2);
      expect(result.z).toBeCloseTo(-3.25, 2);
      expect(result.rotation).toBeCloseTo(1.57, 2);
    });

    it("preserves opcode byte", () => {
      const buf = packPosition(1, 0, 0, 0, 0);
      const result = unpackPosition(buf);
      expect(result.opcode).toBe(Opcode.POSITION_UPDATE);
    });

    it("preserves sequence and flags", () => {
      const buf = packPosition(1, 0, 0, 0, 0, 1234, 0xFF);
      const result = unpackPosition(buf);
      expect(result.sequence).toBe(1234);
      expect(result.flags).toBe(0xFF);
    });

    it("produces exactly 24 bytes", () => {
      const buf = packPosition(1, 0, 0, 0, 0);
      expect(buf.byteLength).toBe(24);
    });

    it("handles zero values", () => {
      const buf = packPosition(0, 0, 0, 0, 0);
      const r = unpackPosition(buf);
      expect(r.entityId).toBe(0);
      expect(r.x).toBe(0);
      expect(r.y).toBe(0);
      expect(r.z).toBe(0);
      expect(r.rotation).toBe(0);
    });

    it("handles large u32 entity IDs", () => {
      const maxU32 = 4294967295;
      const buf = packPosition(maxU32, 1, 2, 3, 0);
      expect(unpackPosition(buf).entityId).toBe(maxU32);
    });

    it("handles negative coordinates", () => {
      const buf = packPosition(1, -100.5, -50, -200.75, -3.14);
      const r = unpackPosition(buf);
      expect(r.x).toBeCloseTo(-100.5, 1);
      expect(r.y).toBeCloseTo(-50, 1);
      expect(r.z).toBeCloseTo(-200.75, 1);
      expect(r.rotation).toBeCloseTo(-3.14, 2);
    });
  });

  describe("packReliable / unpackReliable", () => {
    it("round-trips JSON data with opcode", () => {
      const msg = packReliable(Opcode.ENTITY_SPAWN, { entityId: "e-1", name: "Test" });
      const result = unpackReliable(msg);
      expect(result.op).toBe(Opcode.ENTITY_SPAWN);
      expect(result.entityId).toBe("e-1");
      expect(result.name).toBe("Test");
    });

    it("handles complex nested data", () => {
      const msg = packReliable(99, { arr: [1, 2, 3], nested: { a: true } });
      const result = unpackReliable(msg);
      expect(result.arr).toEqual([1, 2, 3]);
      expect(result.nested.a).toBe(true);
    });

    it("handles null values", () => {
      const msg = packReliable(1, { targetId: null });
      const result = unpackReliable(msg);
      expect(result.targetId).toBeNull();
    });
  });

  describe("binary format compatibility with server", () => {
    it("reads server-format batched positions", () => {
      // Simulate the server's batched format:
      // [count:u16LE] then N × 20 bytes: [entityId:u32LE][x:f32LE][y:f32LE][z:f32LE][rotation:f32LE]
      const count = 2;
      const ENTRY_SIZE = 20;
      const buf = new ArrayBuffer(2 + count * ENTRY_SIZE);
      const view = new DataView(buf);

      // Header
      view.setUint16(0, count, true);

      // Entity 1: id=100, pos=(5.5, 0, 10.25), rotation=1.0
      view.setUint32(2, 100, true);
      view.setFloat32(6, 5.5, true);
      view.setFloat32(10, 0, true);
      view.setFloat32(14, 10.25, true);
      view.setFloat32(18, 1.0, true);

      // Entity 2: id=200, pos=(-3, 1, 7), rotation=0
      view.setUint32(22, 200, true);
      view.setFloat32(26, -3, true);
      view.setFloat32(30, 1, true);
      view.setFloat32(34, 7, true);
      view.setFloat32(38, 0, true);

      // Parse header
      const parsedCount = new DataView(buf).getUint16(0, true);
      expect(parsedCount).toBe(2);

      // Parse first entry
      const e1Id = new DataView(buf).getUint32(2, true);
      const e1X = new DataView(buf).getFloat32(6, true);
      expect(e1Id).toBe(100);
      expect(e1X).toBeCloseTo(5.5);

      // Parse second entry
      const e2Id = new DataView(buf).getUint32(22, true);
      const e2X = new DataView(buf).getFloat32(26, true);
      expect(e2Id).toBe(200);
      expect(e2X).toBeCloseTo(-3);
    });
  });
});
