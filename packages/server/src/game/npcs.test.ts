import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { entityStore } from "./entities.js";
import { unregisterEntity } from "./combat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

vi.mock("../ws/connections.js", () => ({
  connectionManager: {
    broadcastReliable: vi.fn(),
    getAll: vi.fn(() => []),
  },
}));

// Mock terrain to always allow movement (world map not initialized in tests)
vi.mock("../world/terrain.js", () => ({
  isWalkable: vi.fn(() => true),
}));

import { loadTiledMap } from "../world/tiled-map.js";
import { spawnInitialNpcs, handleNpcDeath, getNpcTemplate, getNpcIds, isSpawnedNPC, cleanup } from "./npcs.js";

// Load the Tiled map so spawn points are available
beforeAll(() => {
  loadTiledMap(resolve(__dirname, "../../../client/public/maps/starter.json"));
});

describe("npcs", () => {
  beforeEach(() => {
    cleanup();
    for (const e of entityStore.getAll()) {
      unregisterEntity(e.entityId);
      entityStore.remove(e.entityId);
    }
  });

  afterEach(() => {
    cleanup();
  });

  describe("spawnInitialNpcs", () => {
    it("spawns NPCs at all spawn points", () => {
      spawnInitialNpcs();

      const npcs = entityStore.getByType("npc");
      // 12 spawn points from Tiled map:
      // town_rabbits(4) + roadside_goblins(3) + skeleton_camp(5) + goblin_swamp(4)
      // + forest_imps(4) + lakeside_goblins(4) + desert_skeletons(4) + north_rabbits(6)
      // + elite_ruins(3) + imp_volcano(4) + goblin_fortress(6) + kings_grove(1) = 48
      expect(npcs.length).toBe(48);
    });

    it("all spawned NPCs are tracked", () => {
      spawnInitialNpcs();

      for (const npc of entityStore.getByType("npc")) {
        expect(isSpawnedNPC(npc.entityId)).toBe(true);
      }
    });

    it("spawned NPCs have valid templates", () => {
      spawnInitialNpcs();

      for (const npc of entityStore.getByType("npc")) {
        const template = getNpcTemplate(npc.entityId);
        expect(template).toBeDefined();
        expect(["skeleton", "goblin", "rabbit", "imp"]).toContain(template!.groupId);
      }
    });
  });

  describe("handleNpcDeath", () => {
    it("removes NPC from entity store", () => {
      vi.useFakeTimers();
      spawnInitialNpcs();

      const npc = entityStore.getByType("npc")[0];
      handleNpcDeath(npc.entityId);

      expect(entityStore.get(npc.entityId)).toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe("getNpcTemplate", () => {
    it("returns undefined for non-NPC entity", () => {
      expect(getNpcTemplate("player-1")).toBeUndefined();
    });
  });

  describe("getNpcIds", () => {
    it("returns empty array (legacy stub)", () => {
      expect(getNpcIds()).toEqual([]);
    });
  });
});
