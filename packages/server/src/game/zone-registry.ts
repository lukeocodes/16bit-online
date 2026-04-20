/**
 * Zone registry — maps zone IDs to metadata.
 */

export interface ZoneDefinition {
  id:         string;
  /** Stable numeric ID written to `entity.mapId` and DB `characters.map_id`. */
  numericId:  number;
  name:       string;
  mapFile:    string;
  levelRange: [number, number];
  musicTag:   string;
  exits:      Record<string, { targetZone: string; spawnX: number; spawnZ: number }>;
}

const zones            = new Map<string, ZoneDefinition>();
const zonesByNumericId = new Map<number, ZoneDefinition>();

export function registerZone(zone: ZoneDefinition): void {
  zones.set(zone.id, zone);
  zonesByNumericId.set(zone.numericId, zone);
}

export function getZone(id: string): ZoneDefinition | undefined {
  return zones.get(id);
}

export function getZoneByNumericId(numericId: number): ZoneDefinition | undefined {
  return zonesByNumericId.get(numericId);
}

export function getAllZones(): ZoneDefinition[] {
  return Array.from(zones.values());
}

export function getZoneByMapFile(mapFile: string): ZoneDefinition | undefined {
  for (const zone of zones.values()) {
    if (zone.mapFile === mapFile) return zone;
  }
  return undefined;
}

// -----------------------------------------------------------------------------
// Zone definitions
// -----------------------------------------------------------------------------

// Primary gameplay zone
registerZone({
  id:         "human-meadows",
  numericId:  1,
  name:       "Starter Meadows",
  mapFile:    "starter-area.json",
  levelRange: [1, 5],
  musicTag:   "town",
  exits:      {},
});

// Test zones (Mana Seed sample maps). Reachable via keys 1-9 on the client.
// See tools/import-test-zones.ts for the importer that generates these.
interface TestZoneSpec {
  slot:     number;  // 1-9, matches keybind
  id:       string;
  name:     string;
  dir:      string;  // folder under packages/client/public/maps/test-zones/
  musicTag: string;
}

const TEST_ZONES: TestZoneSpec[] = [
  { slot: 1, id: "test-1-summer-forest",    name: "Summer Forest",    dir: "summer-forest",    musicTag: "field" },
  { slot: 2, id: "test-2-summer-waterfall", name: "Summer Waterfall", dir: "summer-waterfall", musicTag: "field" },
  { slot: 3, id: "test-3-spring-forest",    name: "Spring Forest",    dir: "spring-forest",    musicTag: "field" },
  { slot: 4, id: "test-4-autumn-forest",    name: "Autumn Forest",    dir: "autumn-forest",    musicTag: "field" },
  { slot: 5, id: "test-5-winter-forest",    name: "Winter Forest",    dir: "winter-forest",    musicTag: "field" },
  { slot: 6, id: "test-6-thatch-home",      name: "Thatch Roof Home", dir: "thatch-home",      musicTag: "town"  },
  { slot: 7, id: "test-7-timber-home",      name: "Timber Roof Home", dir: "timber-home",      musicTag: "town"  },
  { slot: 8, id: "test-8-half-timber-home", name: "Half-Timber Home", dir: "half-timber-home", musicTag: "town"  },
  { slot: 9, id: "test-9-stonework-home",   name: "Stonework Home",   dir: "stonework-home",   musicTag: "town"  },
];

// Numeric IDs for test zones live above reserved space (1-99 for real zones).
const TEST_ZONE_BASE_ID = 100;

for (const tz of TEST_ZONES) {
  registerZone({
    id:         tz.id,
    numericId:  TEST_ZONE_BASE_ID + tz.slot,
    name:       tz.name,
    mapFile:    `test-zones/${tz.dir}/map.json`,
    levelRange: [1, 99],
    musicTag:   tz.musicTag,
    exits:      {},
  });
}

export function getTestZoneBySlot(slot: number): ZoneDefinition | undefined {
  const spec = TEST_ZONES.find((t) => t.slot === slot);
  return spec ? getZone(spec.id) : undefined;
}

/** The client TMX path for a zone (co-located with its JSON). */
export function getClientMapFile(zone: ZoneDefinition): string {
  return zone.mapFile.replace(/\.json$/, ".tmx");
}
