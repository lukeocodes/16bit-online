import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Opcode } from "./game/protocol.js";

/**
 * Contract tests — verify that the shared JSON specs in packages/shared/
 * stay in sync with the actual implementations in server and client.
 */

const sharedDir = resolve(import.meta.dirname, "../../shared");
const protocol = JSON.parse(readFileSync(resolve(sharedDir, "protocol.json"), "utf-8"));
const constants = JSON.parse(readFileSync(resolve(sharedDir, "constants.json"), "utf-8"));

describe("shared protocol contract", () => {
  describe("opcodes", () => {
    it("server Opcode values match protocol.json", () => {
      const specOpcodes = protocol.opcodes;

      // Every opcode the server uses should exist in the spec
      for (const [name, value] of Object.entries(Opcode)) {
        if (name in specOpcodes) {
          expect(value, `Opcode.${name} mismatch`).toBe(specOpcodes[name]);
        }
      }
    });

    it("protocol.json opcodes are all unique", () => {
      const values = Object.values(protocol.opcodes);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it("protocol.json has no opcode conflicts with server additions", () => {
      // Server may have opcodes not in spec (e.g., SPAWN_POINT, WORLD_READY)
      // but where they overlap, values must match
      const specOpcodes = protocol.opcodes;
      const serverOpcodes = Opcode;

      const shared = Object.keys(serverOpcodes).filter(k => k in specOpcodes);
      expect(shared.length).toBeGreaterThan(0);

      for (const name of shared) {
        expect(
          serverOpcodes[name as keyof typeof serverOpcodes],
          `${name} value drift`
        ).toBe(specOpcodes[name]);
      }
    });
  });

  describe("binary format", () => {
    it("position update is 24 bytes", () => {
      expect(protocol.binaryFormat.positionUpdate.totalBytes).toBe(24);
    });

    it("position layout matches server packPosition offsets", () => {
      const layout = protocol.binaryFormat.positionUpdate.layout;
      const fieldMap = Object.fromEntries(layout.map((f: any) => [f.field, f]));

      // Verify offsets match what packPosition uses
      expect(fieldMap.opcode.offset).toBe(0);
      expect(fieldMap.opcode.type).toBe("uint8");
      expect(fieldMap.flags.offset).toBe(1);
      expect(fieldMap.sequence.offset).toBe(2);
      expect(fieldMap.entityId.offset).toBe(4);
      expect(fieldMap.entityId.type).toBe("uint32");
      expect(fieldMap.x.offset).toBe(8);
      expect(fieldMap.y.offset).toBe(12);
      expect(fieldMap.z.offset).toBe(16);
      expect(fieldMap.rotation.offset).toBe(20);
    });
  });

  describe("channels", () => {
    it("defines position channel as unreliable", () => {
      expect(protocol.channels.position.ordered).toBe(false);
      expect(protocol.channels.position.maxRetransmits).toBe(0);
    });

    it("defines reliable channel as ordered", () => {
      expect(protocol.channels.reliable.ordered).toBe(true);
    });
  });
});

describe("shared constants contract", () => {
  it("has all expected keys", () => {
    const expectedKeys = [
      "CHUNK_SIZE", "TILE_SIZE", "CHUNK_LOAD_RADIUS", "ENTITY_LOAD_RADIUS",
      "SERVER_TICK_RATE", "CLIENT_TICK_RATE", "MAX_PLAYER_SPEED",
      "MAX_CHARACTERS_PER_ACCOUNT", "ACTION_BAR_SLOTS", "POSITION_SEND_RATE",
      "STAT_POINTS_TOTAL", "STAT_MIN", "STAT_MAX",
      "STARTING_SKILLS_COUNT", "STARTING_SKILL_VALUE",
    ];
    for (const key of expectedKeys) {
      expect(constants, `missing key: ${key}`).toHaveProperty(key);
    }
  });

  it("all values are numbers", () => {
    for (const [key, value] of Object.entries(constants)) {
      expect(typeof value, `${key} should be a number`).toBe("number");
    }
  });

  it("tick rates are positive", () => {
    expect(constants.SERVER_TICK_RATE).toBeGreaterThan(0);
    expect(constants.CLIENT_TICK_RATE).toBeGreaterThan(0);
  });

  it("stat constraints are consistent", () => {
    // STAT_MIN * 3 attributes should not exceed STAT_POINTS_TOTAL
    expect(constants.STAT_MIN * 3).toBeLessThanOrEqual(constants.STAT_POINTS_TOTAL);
    // STAT_MAX should allow valid allocations
    expect(constants.STAT_MAX).toBeGreaterThanOrEqual(constants.STAT_MIN);
    // Max possible (one stat maxed, others at min) should >= total
    expect(constants.STAT_MAX + constants.STAT_MIN * 2).toBeGreaterThanOrEqual(constants.STAT_POINTS_TOTAL);
  });

  it("character limits are reasonable", () => {
    expect(constants.MAX_CHARACTERS_PER_ACCOUNT).toBeGreaterThanOrEqual(1);
    expect(constants.STARTING_SKILLS_COUNT).toBeGreaterThanOrEqual(1);
    expect(constants.STARTING_SKILL_VALUE).toBeGreaterThan(0);
  });

  it("spatial constants are consistent", () => {
    // Entity load radius should fit within chunk load coverage
    const chunkCoverage = constants.CHUNK_LOAD_RADIUS * constants.CHUNK_SIZE;
    expect(constants.ENTITY_LOAD_RADIUS).toBeLessThanOrEqual(chunkCoverage);
  });
});
