import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Opcode, packPosition } from "./net/Protocol";

/**
 * Contract tests — verify that the client's Protocol.ts opcodes
 * stay in sync with the shared protocol.json specification.
 */

const sharedDir = resolve(import.meta.dirname, "../../shared");
const protocol = JSON.parse(readFileSync(resolve(sharedDir, "protocol.json"), "utf-8"));
const constants = JSON.parse(readFileSync(resolve(sharedDir, "constants.json"), "utf-8"));

describe("client ↔ shared protocol contract", () => {
  describe("opcodes match protocol.json", () => {
    it("all protocol.json opcodes have matching client values", () => {
      const specOpcodes = protocol.opcodes;
      for (const [name, specValue] of Object.entries(specOpcodes)) {
        if (name in Opcode) {
          expect(
            Opcode[name as keyof typeof Opcode],
            `Client Opcode.${name} doesn't match protocol.json`
          ).toBe(specValue);
        }
      }
    });

    it("client has all protocol.json opcodes", () => {
      const specOpcodes = protocol.opcodes;
      for (const name of Object.keys(specOpcodes)) {
        expect(
          name in Opcode,
          `Client missing opcode: ${name}`
        ).toBe(true);
      }
    });

    it("client opcodes are unique", () => {
      const values = Object.values(Opcode);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe("client ↔ server opcode alignment", () => {
    // Server opcodes (hardcoded to verify cross-package consistency)
    const SERVER_OPCODES: Record<string, number> = {
      POSITION_UPDATE: 1,
      ENTITY_SPAWN: 2,
      ENTITY_DESPAWN: 3,
      TARGET_SELECT: 40,
      AUTO_ATTACK_TOGGLE: 41,
      AUTO_ATTACK_CANCEL: 42,
      DAMAGE_EVENT: 50,
      ENTITY_DEATH: 51,
      ENTITY_STATE: 52,
      COMBAT_STATE: 53,
      SPAWN_POINT: 60,
      WORLD_READY: 100,
      PING: 253,
      PONG: 254,
    };

    it("shared opcodes match between client and server", () => {
      for (const [name, serverValue] of Object.entries(SERVER_OPCODES)) {
        if (name in Opcode) {
          expect(
            Opcode[name as keyof typeof Opcode],
            `Opcode.${name} differs: client vs server`
          ).toBe(serverValue);
        }
      }
    });
  });

  describe("binary format", () => {
    it("client position size matches spec", () => {
      const buf = packPosition(1, 0, 0, 0, 0);
      expect(buf.byteLength).toBe(protocol.binaryFormat.positionUpdate.totalBytes);
    });
  });
});

describe("client ↔ shared constants", () => {
  it("constants.json is loadable and has expected shape", () => {
    expect(constants.CHUNK_SIZE).toBe(32);
    expect(constants.TILE_SIZE).toBe(1.0);
    expect(constants.ENTITY_LOAD_RADIUS).toBe(32);
    expect(constants.SERVER_TICK_RATE).toBe(20);
    expect(constants.CLIENT_TICK_RATE).toBe(20);
  });

  it("stat constraints allow valid character creation", () => {
    // Must be able to allocate STAT_POINTS_TOTAL across 3 stats
    // with each stat between STAT_MIN and STAT_MAX
    const { STAT_POINTS_TOTAL, STAT_MIN, STAT_MAX } = constants;
    expect(STAT_MIN * 3).toBeLessThanOrEqual(STAT_POINTS_TOTAL);
    expect(STAT_MAX + STAT_MIN * 2).toBeGreaterThanOrEqual(STAT_POINTS_TOTAL);
  });
});
