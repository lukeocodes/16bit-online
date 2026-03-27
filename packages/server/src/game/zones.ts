/**
 * Zone system — defines safe areas on the map.
 * Safe zones are loaded from the Tiled map's object layer.
 * Disconnecting in a safe zone instantly removes the character.
 * Disconnecting outside leaves them on the map for LINGER_DURATION.
 */

import { getTiledSafeZones, type TiledSafeZone } from "../world/tiled-map.js";

export interface SafeZone {
  id: string;
  name: string;
  mapId: number;
  // Rectangle-based (from Tiled)
  x: number;
  z: number;
  width: number;
  height: number;
  musicTag: string;
}

/** Check if point is inside a safe zone (rectangle-based from Tiled map) */
export function isInSafeZone(mapId: number, x: number, z: number): boolean {
  const zones = getTiledSafeZones();
  for (const zone of zones) {
    const dx = x - zone.tileX;
    const dz = z - zone.tileZ;
    if (dx >= 0 && dx < zone.tileWidth && dz >= 0 && dz < zone.tileHeight) {
      return true;
    }
  }
  return false;
}

export function getSafeZone(mapId: number, x: number, z: number): SafeZone | null {
  const zones = getTiledSafeZones();
  for (const zone of zones) {
    const dx = x - zone.tileX;
    const dz = z - zone.tileZ;
    if (dx >= 0 && dx < zone.tileWidth && dz >= 0 && dz < zone.tileHeight) {
      return {
        id: zone.name,
        name: zone.zoneName,
        mapId: 1,
        x: zone.tileX,
        z: zone.tileZ,
        width: zone.tileWidth,
        height: zone.tileHeight,
        musicTag: zone.musicTag,
      };
    }
  }
  return null;
}

export function getAllSafeZones(): SafeZone[] {
  return getTiledSafeZones().map((zone) => ({
    id: zone.name,
    name: zone.zoneName,
    mapId: 1,
    x: zone.tileX,
    z: zone.tileZ,
    width: zone.tileWidth,
    height: zone.tileHeight,
    musicTag: zone.musicTag,
  }));
}
