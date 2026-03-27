/**
 * NPC initialization — reads spawn points from the Tiled map.
 * All NPC management is handled by spawn-points.ts.
 */

import { addSpawnPoint, cleanup as cleanupSpawnPoints, handleNPCDeath as spHandleDeath, getSpawnPointTemplate, isSpawnedNPC, tickWandering, tickRespawns, getAllSpawnPoints, type SpawnPoint } from "./spawn-points.js";
import type { NPCTemplate } from "./npc-templates.js";
import { getTiledSpawnPoints, getZoneSpawnPoints } from "../world/tiled-map.js";
import { getAllZones } from "./zone-registry.js";

export function spawnInitialNpcs() {
  // Spawn NPCs from all loaded zone maps
  let totalPoints = 0;
  for (const zone of getAllZones()) {
    const zoneSpawns = getZoneSpawnPoints(zone.id);
    for (let i = 0; i < zoneSpawns.length; i++) {
      const sp = zoneSpawns[i];
      addSpawnPoint({
        id: `sp-${zone.id}-${sp.name || `spawn-${i}`}`,
        x: sp.tileX,
        z: sp.tileZ,
        mapId: zone.id === "human-meadows" ? 1 : 2, // TODO: proper mapId mapping
        npcIds: sp.npcIds,
        distance: sp.distance,
        maxCount: sp.maxCount,
        frequency: sp.frequency,
      });
      totalPoints++;
    }
  }

  // Fallback: if no zone spawns loaded, use legacy default
  if (totalPoints === 0) {
    const tiledSpawns = getTiledSpawnPoints();
    for (let i = 0; i < tiledSpawns.length; i++) {
      const sp = tiledSpawns[i];
      addSpawnPoint({
        id: `sp-${sp.name || `tiled-${i}`}`,
        x: sp.tileX, z: sp.tileZ, mapId: 1,
        npcIds: sp.npcIds, distance: sp.distance,
        maxCount: sp.maxCount, frequency: sp.frequency,
      });
    }
  }

  console.log(`[NPCs] Spawn points initialized: ${getAllSpawnPoints().length} points across ${getAllZones().length} zones`);
}

export function handleNpcDeath(entityId: string) {
  spHandleDeath(entityId);
}

export function getNpcTemplate(entityId: string): NPCTemplate | undefined {
  return getSpawnPointTemplate(entityId);
}

export function getNpcIds(): string[] {
  return []; // No longer tracked globally
}

export { isSpawnedNPC, tickWandering, tickRespawns };

export function cleanup() {
  cleanupSpawnPoints();
}
