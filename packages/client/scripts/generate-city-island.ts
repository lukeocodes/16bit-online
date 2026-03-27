/**
 * Generate city island map (256x256 tiles).
 * Run: bun run scripts/generate-city-island.ts
 *
 * Island layout (north→south):
 *   z=0-17:    Impassable cliff face. Cave entrance gap at x=119-134.
 *   z=18-90:   Castle grounds — large open stone courtyard feeding off cave.
 *   z=91-148:  City streets — dense road grid with stone building lots.
 *   z=148:     City gate — gap in road-line opening to wilderness.
 *   z=149-210: Wilderness — meadow + flanking forest. Starter NPCs here.
 *   Coast:     Clean layered rings — grass → sand → shallow water → deep water.
 *              Determined entirely by SDF distance, zero noise.
 *
 * Tile GIDs (1-indexed):
 *  1:grass  2:dirt  3:stone  4:sand  5:water  6:deep_water
 *  7:forest_floor  8:snow  9:swamp  10:mountain_rock  11:path  12:grass_dark
 */

const MAP_W = 256;
const MAP_H = 256;

const T_GRASS      = 1;
const T_DIRT       = 2;
const T_STONE      = 3;
const T_SAND       = 4;
const T_WATER      = 5;
const T_DEEP_WATER = 6;
const T_FOREST     = 7;
const T_SNOW       = 8;
const T_MOUNTAIN   = 10;
const T_PATH       = 11;
const T_GRASS_DARK = 12;

const ground    = new Array(MAP_W * MAP_H).fill(T_DEEP_WATER);
const collision = new Array(MAP_W * MAP_H).fill(0);

function set(x: number, z: number, gid: number, blocked = false) {
  if (x < 0 || x >= MAP_W || z < 0 || z >= MAP_H) return;
  ground[z * MAP_W + x] = gid;
  collision[z * MAP_W + x] = blocked ? 1 : 0;
}

// ─── Signed Distance Field — rounded rectangle island ──────────────────────
//
// Returns positive = inside island (dist from nearest edge),
//         negative = outside island (dist from nearest edge).
// Zero noise. Smooth bands guaranteed.

const IS_CX = 128, IS_CZ = 128;
const IS_HW = 106, IS_HD = 108; // half-widths → island x=22-234, z=20-236
const IS_CR = 22;                // corner radius

function islandSDF(x: number, z: number): number {
  const dx = Math.max(Math.abs(x - IS_CX) - (IS_HW - IS_CR), 0);
  const dz = Math.max(Math.abs(z - IS_CZ) - (IS_HD - IS_CR), 0);
  return IS_CR - Math.sqrt(dx * dx + dz * dz);
}

// ─── 1. Coastal and water rings (purely SDF-based) ─────────────────────────

for (let z = 0; z < MAP_H; z++) {
  for (let x = 0; x < MAP_W; x++) {
    const d = islandSDF(x, z);

    if (d >= 12)      { set(x, z, T_DIRT);       } // inner land base (overwritten below)
    else if (d >= 7)  { set(x, z, T_GRASS);       }
    else if (d >= 2)  { set(x, z, T_SAND);        }
    else if (d >= -5) { set(x, z, T_WATER, true); }
    else              { /* stays deep_water */     }
  }
}

// ─── 2. Wilderness zone (z=149-210, inside island) ────────────────────────
//
// Open meadow in the centre, forest flanking east and west.

const WILD_Z0 = 149, WILD_Z1 = 210;
const FOREST_DEPTH = 40; // how far forest penetrates from east/west edges of inner land
const INNER_X0 = 34, INNER_X1 = 222; // approx inner land edge (SDF ≥ 12)

for (let z = WILD_Z0; z <= WILD_Z1; z++) {
  for (let x = 0; x < MAP_W; x++) {
    if (islandSDF(x, z) < 12) continue; // coastal, leave as grass/sand

    const fromLeft  = x - INNER_X0;
    const fromRight = INNER_X1 - x;

    if (fromLeft < FOREST_DEPTH || fromRight < FOREST_DEPTH) {
      set(x, z, T_FOREST);                     // flanking forest
    } else {
      // Meadow: alternate grass / grass_dark bands for visual interest
      const band = Math.floor((z - WILD_Z0) / 8) + Math.floor((x - INNER_X0) / 8);
      set(x, z, band % 3 === 0 ? T_GRASS_DARK : T_GRASS);
    }
  }
}

// Wilderness dirt path — continuation of main avenue southward
const AVE_X0 = 121, AVE_X1 = 134;
for (let z = WILD_Z0; z <= WILD_Z1; z++) {
  for (let x = AVE_X0; x <= AVE_X1; x++) {
    if (islandSDF(x, z) >= 12) set(x, z, T_DIRT);
  }
}

// ─── 3. City road grid (z=91-148) ─────────────────────────────────────────
//
// Dense 4-wide roads on a 28-tile pitch. Stone lots between roads.

const CITY_Z0 = 91, CITY_Z1 = 148;
const CITY_X0 = 34, CITY_X1 = 222;
const BLOCK   = 28, ROAD_W = 4;

function isMainAvenue(x: number): boolean {
  return x >= AVE_X0 && x <= AVE_X1;
}
function isRoad(x: number, z: number): boolean {
  if (isMainAvenue(x)) return true;
  if (x < CITY_X0 || x > CITY_X1) return false;
  const lx = (x - CITY_X0) % BLOCK;
  const lz = (z - CITY_Z0) % BLOCK;
  return lx < ROAD_W || lz < ROAD_W;
}

for (let z = CITY_Z0; z <= CITY_Z1; z++) {
  for (let x = CITY_X0; x <= CITY_X1; x++) {
    if (islandSDF(x, z) < 12) continue;
    set(x, z, isRoad(x, z) ? T_PATH : T_STONE);
  }
}

// City gate row at z=148 — break the last road row for the main avenue gap
for (let x = CITY_X0; x <= CITY_X1; x++) {
  if (islandSDF(x, CITY_Z1) < 12) continue;
  if (isMainAvenue(x)) {
    set(x, CITY_Z1, T_PATH);   // gate opening
  } else {
    set(x, CITY_Z1, T_STONE);  // gate wall (stone line)
  }
}

// ─── 4. Castle grounds (z=22-90) ──────────────────────────────────────────
//
// Large open stone courtyard from the cliff base south to the city grid.
// The main avenue runs through it from the cave entrance.

const CASTLE_Z0 = 22, CASTLE_Z1 = 90;
const CASTLE_X0 = 88, CASTLE_X1 = 168;

for (let z = CASTLE_Z0; z <= CASTLE_Z1; z++) {
  for (let x = 0; x < MAP_W; x++) {
    if (islandSDF(x, z) < 12) continue;

    if (x >= CASTLE_X0 && x <= CASTLE_X1) {
      // Castle grounds: open stone paving
      set(x, z, T_STONE);
    } else {
      // Flanking city area outside castle walls: road grid continues
      const lx = (x - CITY_X0 + MAP_W) % BLOCK;
      const lz = (z - CITY_Z0 + MAP_H) % BLOCK;
      const isR = isMainAvenue(x) || lx < ROAD_W || lz < ROAD_W;
      if (islandSDF(x, z) >= 12) set(x, z, isR ? T_PATH : T_STONE);
    }
  }
}

// Castle perimeter suggestion — dark stone border 2 tiles wide
for (let z = CASTLE_Z0; z <= CASTLE_Z1; z++) {
  for (let x = CASTLE_X0; x <= CASTLE_X1; x++) {
    const onEdge = z <= CASTLE_Z0 + 1 || z >= CASTLE_Z1 - 1 ||
                   x <= CASTLE_X0 + 1 || x >= CASTLE_X1 - 1;
    const inGate = isMainAvenue(x) && z >= CASTLE_Z1 - 5;
    if (onEdge && !inGate && islandSDF(x, z) >= 12) {
      set(x, z, T_MOUNTAIN, true); // castle wall placeholder (impassable)
    }
  }
}

// ─── 5. Cave approach path (z=18-22, in cave gap) ─────────────────────────
for (let z = 18; z < CASTLE_Z0; z++) {
  for (let x = AVE_X0; x <= AVE_X1; x++) {
    set(x, z, T_PATH);
  }
}

// ─── 6. North cliff wall (z=0-17) ─────────────────────────────────────────
//
// Entirely mountain_rock except the cave entrance gap.

const CAVE_X0 = 119, CAVE_X1 = 134;
const CLIFF_Z1 = 18;

for (let z = 0; z < CLIFF_Z1; z++) {
  for (let x = 0; x < MAP_W; x++) {
    if (x >= CAVE_X0 && x <= CAVE_X1) {
      set(x, z, z < 8 ? T_SNOW : T_DIRT, false);
    } else {
      set(x, z, T_MOUNTAIN, true);
    }
  }
}

// ─── 7. Bake collision from tile GIDs ─────────────────────────────────────
for (let z = 0; z < MAP_H; z++) {
  for (let x = 0; x < MAP_W; x++) {
    const gid = ground[z * MAP_W + x];
    if (gid === T_WATER || gid === T_DEEP_WATER || gid === T_MOUNTAIN) {
      collision[z * MAP_W + x] = 1;
    }
  }
}
// Cave gap always passable
for (let z = 0; z < CLIFF_Z1; z++) {
  for (let x = CAVE_X0; x <= CAVE_X1; x++) {
    collision[z * MAP_W + x] = 0;
  }
}

// ─── 8. Map JSON ──────────────────────────────────────────────────────────

const TW = 64, TH = 32; // Tiled pixel coords per tile

// NPC spawn locations (wilderness)
const spawns = [
  { id: 4, name: "meadow_rabbits_w",  x: 96,  z: 165, npcIds: "rabbit,rabbit",          max: 4, dist: 10, freq: 15 },
  { id: 5, name: "meadow_rabbits_e",  x: 160, z: 165, npcIds: "rabbit,rabbit",          max: 4, dist: 10, freq: 15 },
  { id: 6, name: "meadow_rabbits_c",  x: 128, z: 185, npcIds: "rabbit,rabbit",          max: 3, dist: 8,  freq: 12 },
  { id: 7, name: "forest_goblins_w",  x: 70,  z: 188, npcIds: "goblin-grunt",           max: 3, dist: 8,  freq: 14 },
  { id: 8, name: "forest_goblins_e",  x: 186, z: 188, npcIds: "goblin-grunt",           max: 3, dist: 8,  freq: 14 },
  { id: 9, name: "deep_forest_w",     x: 55,  z: 205, npcIds: "goblin-grunt,goblin-grunt", max: 4, dist: 10, freq: 10 },
  { id: 10, name: "deep_forest_e",    x: 201, z: 205, npcIds: "goblin-grunt,goblin-grunt", max: 4, dist: 10, freq: 10 },
];

const map = {
  version: "1.10", tiledversion: "1.11.0", type: "map",
  orientation: "isometric", renderorder: "right-down",
  infinite: false,
  width: MAP_W, height: MAP_H,
  tilewidth: TW, tileheight: TH,
  tilesets: [{ firstgid: 1, source: "../tilesets/terrain.tsj" }],
  layers: [
    {
      id: 1, name: "ground", type: "tilelayer",
      width: MAP_W, height: MAP_H,
      data: ground, opacity: 1, visible: true, x: 0, y: 0,
    },
    {
      id: 2, name: "collision", type: "tilelayer",
      width: MAP_W, height: MAP_H,
      data: collision.map((v) => (v ? 10 : 0)),
      opacity: 0.3, visible: false, x: 0, y: 0,
    },
    {
      id: 3, name: "objects", type: "objectgroup",
      objects: [
        // Player spawns in the city, near the castle south entrance
        {
          id: 1, name: "player_spawn", type: "spawn",
          x: 128 * TW, y: 110 * TH, width: 0, height: 0,
          properties: [{ name: "spawnType", type: "string", value: "player" }],
        },
        // Safe zone covers the full city (castle + streets)
        {
          id: 2, name: "city_safe_zone", type: "safe_zone",
          x: CASTLE_X0 * TW, y: CASTLE_Z0 * TH,
          width: (CASTLE_X1 - CASTLE_X0) * TW, height: (CITY_Z1 - CASTLE_Z0) * TH,
          properties: [
            { name: "zoneName", type: "string", value: "City of Foundations" },
            { name: "musicTag", type: "string", value: "town" },
          ],
        },
        // Wilderness discovery zones
        {
          id: 3, name: "starter_meadow", type: "zone",
          x: INNER_X0 * TW, y: WILD_Z0 * TH,
          width: (INNER_X1 - INNER_X0) * TW, height: 40 * TH,
          properties: [{ name: "zoneName", type: "string", value: "Starter Meadow" }],
        },
        // Cave entrance — future tunnel zone exit
        {
          id: 11, name: "cave_entrance", type: "zone_exit",
          x: CAVE_X0 * TW, y: 0,
          width: (CAVE_X1 - CAVE_X0 + 1) * TW, height: 6 * TH,
          properties: [
            { name: "exitId", type: "string", value: "cave-tunnel" },
            { name: "label", type: "string", value: "Cave Entrance" },
          ],
        },
        // NPC spawns
        ...spawns.map((sp) => ({
          id: sp.id, name: sp.name, type: "spawn",
          x: sp.x * TW, y: sp.z * TH, width: 0, height: 0,
          properties: [
            { name: "spawnType", type: "string", value: "npc" },
            { name: "npcIds",   type: "string", value: sp.npcIds },
            { name: "maxCount", type: "int",    value: sp.max },
            { name: "distance", type: "int",    value: sp.dist },
            { name: "frequency",type: "int",    value: sp.freq },
          ],
        })),
      ],
      opacity: 1, visible: true, x: 0, y: 0,
    },
  ],
  properties: [
    { name: "mapName", type: "string", value: "City Island" },
    { name: "mapId",   type: "int",    value: 1 },
  ],
};

const outPath = new URL("../public/maps/starter.json", import.meta.url).pathname;
Bun.write(outPath, JSON.stringify(map));
console.log(`Map written: ${outPath} (${MAP_W}x${MAP_H})`);

const names: Record<number, string> = {
  1:"grass",2:"dirt",3:"stone",4:"sand",5:"water",6:"deep_water",
  7:"forest",8:"snow",9:"swamp",10:"mountain",11:"path",12:"grass_dark",
};
const counts: Record<number, number> = {};
for (const t of ground) counts[t] = (counts[t] || 0) + 1;
for (const [id, n] of Object.entries(counts).sort((a, b) => +a[0] - +b[0])) {
  console.log(`  ${(names[+id] ?? "tile" + id).padEnd(12)} ${n}`);
}
