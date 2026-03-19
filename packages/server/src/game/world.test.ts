import { describe, it, expect } from "vitest";

/**
 * hashCode is private to world.ts. We replicate it here to test
 * the algorithm and verify consistency with the client.
 *
 * Both server (world.ts) and client (StateSync.ts) must produce
 * identical hashes — otherwise position updates map to wrong entities.
 */

// Server's hashCode (from world.ts)
function serverHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// Client's hashCode (from StateSync.ts) — identical algorithm but >>> 0 for unsigned
function clientHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

describe("hashCode cross-protocol consistency", () => {
  const testIds = [
    "npc-sp-forest-0",
    "npc-sp-forest-1",
    "npc-sp-graveyard-42",
    "player-abc123-def456",
    "a",
    "",
    "skeleton-warrior",
    "npc-sp-test-9999",
  ];

  it("server and client produce the same unsigned u32", () => {
    for (const id of testIds) {
      // Server uses signed then broadcasts as u32 (>>> 0 on write)
      const serverVal = serverHashCode(id) >>> 0;
      const clientVal = clientHashCode(id);
      expect(serverVal, `hash mismatch for "${id}"`).toBe(clientVal);
    }
  });

  it("produces u32 range values (0 to 2^32-1)", () => {
    for (const id of testIds) {
      const val = clientHashCode(id);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(4294967295);
    }
  });

  it("produces different hashes for different IDs", () => {
    const hashes = testIds.filter(id => id.length > 0).map(clientHashCode);
    const unique = new Set(hashes);
    // With 7 non-empty IDs, collisions are statistically unlikely
    expect(unique.size).toBe(hashes.length);
  });

  it("empty string hashes to 0", () => {
    expect(clientHashCode("")).toBe(0);
    expect(serverHashCode("")).toBe(0);
  });

  it("is deterministic", () => {
    const id = "npc-sp-forest-42";
    expect(clientHashCode(id)).toBe(clientHashCode(id));
    expect(serverHashCode(id)).toBe(serverHashCode(id));
  });
});
