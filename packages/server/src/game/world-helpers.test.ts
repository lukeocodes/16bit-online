import { describe, it, expect } from "vitest";

/**
 * Test pure helpers from world.ts: hashCode and
 * the batched position binary format.
 *
 * These are extracted since world.ts has side effects
 * (setInterval, connectionManager) that make direct import hard.
 */

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// Replicate broadcastPositions batching format
const ENTRY_SIZE = 20;

function packBatchedPositions(
  entries: Array<{ id: string; x: number; y: number; z: number; r: number }>
): Buffer {
  const buf = Buffer.alloc(2 + entries.length * ENTRY_SIZE);
  buf.writeUInt16LE(entries.length, 0);
  for (let i = 0; i < entries.length; i++) {
    const offset = 2 + i * ENTRY_SIZE;
    buf.writeUInt32LE(hashCode(entries[i].id) >>> 0, offset);
    buf.writeFloatLE(entries[i].x, offset + 4);
    buf.writeFloatLE(entries[i].y, offset + 8);
    buf.writeFloatLE(entries[i].z, offset + 12);
    buf.writeFloatLE(entries[i].r, offset + 16);
  }
  return buf;
}

function unpackBatchedPositions(buf: Buffer): Array<{ entityId: number; x: number; y: number; z: number; rotation: number }> {
  const count = buf.readUInt16LE(0);
  const result: Array<{ entityId: number; x: number; y: number; z: number; rotation: number }> = [];
  for (let i = 0; i < count; i++) {
    const offset = 2 + i * ENTRY_SIZE;
    if (offset + ENTRY_SIZE > buf.length) break;
    result.push({
      entityId: buf.readUInt32LE(offset),
      x: buf.readFloatLE(offset + 4),
      y: buf.readFloatLE(offset + 8),
      z: buf.readFloatLE(offset + 12),
      rotation: buf.readFloatLE(offset + 16),
    });
  }
  return result;
}

describe("world helpers", () => {
  describe("batched position format", () => {
    it("round-trips a single entity", () => {
      const buf = packBatchedPositions([
        { id: "npc-1", x: 5.5, y: 0, z: 10.25, r: 1.57 },
      ]);
      const result = unpackBatchedPositions(buf);
      expect(result.length).toBe(1);
      expect(result[0].entityId).toBe(hashCode("npc-1") >>> 0);
      expect(result[0].x).toBeCloseTo(5.5);
      expect(result[0].z).toBeCloseTo(10.25);
      expect(result[0].rotation).toBeCloseTo(1.57);
    });

    it("round-trips multiple entities", () => {
      const buf = packBatchedPositions([
        { id: "e-1", x: 1, y: 0, z: 2, r: 0 },
        { id: "e-2", x: 3, y: 0, z: 4, r: 1.0 },
        { id: "e-3", x: -5, y: 1, z: -10, r: -3.14 },
      ]);
      const result = unpackBatchedPositions(buf);
      expect(result.length).toBe(3);
      expect(result[0].x).toBeCloseTo(1);
      expect(result[1].x).toBeCloseTo(3);
      expect(result[2].x).toBeCloseTo(-5);
      expect(result[2].y).toBeCloseTo(1);
    });

    it("empty batch has 2-byte header with count 0", () => {
      const buf = packBatchedPositions([]);
      expect(buf.length).toBe(2);
      expect(buf.readUInt16LE(0)).toBe(0);
      expect(unpackBatchedPositions(buf)).toEqual([]);
    });

    it("entry size is exactly 20 bytes per entity", () => {
      const buf = packBatchedPositions([
        { id: "x", x: 0, y: 0, z: 0, r: 0 },
      ]);
      expect(buf.length).toBe(2 + 20);
    });

    it("handles max u16 entity count in header", () => {
      // Verify the count field can hold up to 65535
      const buf = Buffer.alloc(2);
      buf.writeUInt16LE(65535, 0);
      expect(buf.readUInt16LE(0)).toBe(65535);
    });
  });

  describe("Chebyshev distance filtering (server logic)", () => {
    function isNearby(selfX: number, selfZ: number, otherX: number, otherZ: number, radius = 32): boolean {
      return Math.max(Math.abs(otherX - selfX), Math.abs(otherZ - selfZ)) <= radius;
    }

    it("entities within radius are nearby", () => {
      expect(isNearby(0, 0, 10, 10)).toBe(true);
      expect(isNearby(0, 0, 32, 0)).toBe(true);
      expect(isNearby(5, 5, 5, 5)).toBe(true); // Same position
    });

    it("entities outside radius are not nearby", () => {
      expect(isNearby(0, 0, 33, 0)).toBe(false);
      expect(isNearby(0, 0, 50, 50)).toBe(false);
    });

    it("Chebyshev distance handles negative coords", () => {
      expect(isNearby(-10, -10, 10, 10)).toBe(true); // max(20, 20) = 20 <= 32
      expect(isNearby(-20, -20, 20, 20)).toBe(false); // max(40, 40) = 40 > 32
    });

    it("diagonal distance uses max, not Euclidean", () => {
      // Chebyshev: max(32, 32) = 32 → nearby
      // Euclidean: sqrt(32² + 32²) ≈ 45.25 → would be out of range
      expect(isNearby(0, 0, 32, 32)).toBe(true);
    });
  });
});
