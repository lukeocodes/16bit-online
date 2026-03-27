/**
 * Generate an expanded starter Tiled map (128x128 tiles).
 * Run: bun run scripts/generate-starter-map.ts
 *
 * Layout:
 *   - Central town (stone plaza + paths)
 *   - Eastern forest (skeletons)
 *   - Southwestern swamp (goblins)
 *   - Northern mountains (impassable peaks)
 *   - Southern beach + ocean
 *   - Western dense forest
 *   - Central lake
 *   - River from mountains through the map to the ocean
 *   - Multiple path networks connecting areas
 *
 * Tile IDs (1-indexed for Tiled):
 * 1:grass 2:dirt 3:stone 4:sand 5:water 6:deep_water
 * 7:forest 8:snow 9:swamp 10:mountain 11:path 12:grass_dark
 */

const MAP_W = 128;
const MAP_H = 128;
const CX = MAP_W / 2; // 64
const CZ = MAP_H / 2; // 64

const ground = new Array(MAP_W * MAP_H).fill(1); // grass default
const collision = new Array(MAP_W * MAP_H).fill(0);

function set(x: number, z: number, tileId: number, blocked = false) {
  if (x < 0 || x >= MAP_W || z < 0 || z >= MAP_H) return;
  ground[z * MAP_W + x] = tileId;
  if (blocked) collision[z * MAP_W + x] = 1;
}

function dist(x1: number, z1: number, x2: number, z2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (z1 - z2) ** 2);
}

let seed = 42;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function noise2d(x: number, z: number): number {
  return (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
}

// --- 1. Base terrain from distance/noise ---
for (let z = 0; z < MAP_H; z++) {
  for (let x = 0; x < MAP_W; x++) {
    const dc = dist(x, z, CX, CZ);

    // Mountain range along northern edge (z < 15)
    if (z < 12) {
      if (z < 5) { set(x, z, 8, true); continue; } // snow peaks
      set(x, z, 10, true); continue; // mountain rock
    }
    // Mountain spurs reaching south in the northwest
    if (x < 30 && z < 25 && noise2d(x * 0.1, z * 0.1) > 0.3) {
      if (z < 15) { set(x, z, 10, true); continue; }
    }

    // Southern ocean (z > 115)
    if (z > 120) { set(x, z, 6, true); continue; } // deep water
    if (z > 115) { set(x, z, 5, true); continue; } // shallow water
    if (z > 112) { set(x, z, 4); continue; } // beach

    // Eastern ocean strip (x > 118)
    if (x > 122) { set(x, z, 6, true); continue; }
    if (x > 118) { set(x, z, 5, true); continue; }
    if (x > 115) { set(x, z, 4); continue; }

    // Western cliff edge (x < 8)
    if (x < 5) { set(x, z, 10, true); continue; }
    if (x < 8) { set(x, z, 7); continue; } // dense forest at cliff edge
  }
}

// --- 2. River: flows from north mountains, through center-east, to south ocean ---
for (let z = 12; z < 120; z++) {
  const riverX = 85 + Math.sin(z * 0.08) * 8 + Math.sin(z * 0.03) * 5;
  for (let dx = -2; dx <= 2; dx++) {
    const x = Math.round(riverX + dx);
    if (Math.abs(dx) <= 1) {
      set(x, z, 5, true); // water center
    } else {
      set(x, z, 4); // sandy bank
    }
  }
}

// --- 3. Central lake ---
const lakeX = 45, lakeZ = 80;
for (let z = lakeZ - 10; z <= lakeZ + 10; z++) {
  for (let x = lakeX - 12; x <= lakeX + 12; x++) {
    const d = dist(x, z, lakeX, lakeZ);
    if (d < 6) { set(x, z, 6, true); } // deep water center
    else if (d < 8) { set(x, z, 5, true); } // shallow water ring
    else if (d < 10) { set(x, z, 4); } // sandy shore
  }
}

// --- 4. Town plaza and surroundings ---
for (let z = CZ - 12; z <= CZ + 12; z++) {
  for (let x = CX - 12; x <= CX + 12; x++) {
    const d = dist(x, z, CX, CZ);
    if (d < 6) { set(x, z, 3); } // stone plaza
    else if (d < 9) { set(x, z, 2); } // dirt ring
    else if (d < 12) { set(x, z, 1); } // grass clearing
  }
}

// --- 5. Path network ---
function drawPath(x1: number, z1: number, x2: number, z2: number) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const px = Math.round(x1 + (x2 - x1) * t);
    const pz = Math.round(z1 + (z2 - z1) * t);
    // Skip if already water/mountain
    const existing = ground[pz * MAP_W + px];
    if (existing === 5 || existing === 6 || existing === 10 || existing === 8) continue;
    set(px, pz, 11); // path
    // Widen path slightly
    if (existing !== 3) { // don't overwrite stone
      const nx = px + (Math.abs(x2 - x1) > Math.abs(z2 - z1) ? 0 : 1);
      const nz = pz + (Math.abs(x2 - x1) > Math.abs(z2 - z1) ? 1 : 0);
      const ne = ground[nz * MAP_W + nx];
      if (ne !== 5 && ne !== 6 && ne !== 10 && ne !== 8 && ne !== 3) {
        set(nx, nz, 11);
      }
    }
  }
}

// Town → East (toward skeletons)
drawPath(CX + 6, CZ, CX + 30, CZ);
drawPath(CX + 30, CZ, CX + 30, CZ + 15);

// Town → West (toward dense forest)
drawPath(CX - 6, CZ, CX - 25, CZ);

// Town → South (toward lake area)
drawPath(CX, CZ + 6, CX, CZ + 25);
drawPath(CX, CZ + 25, lakeX, lakeZ - 10);

// Town → North (toward mountains)
drawPath(CX, CZ - 6, CX, CZ - 30);

// Town → Southwest (toward swamp)
drawPath(CX - 6, CZ + 6, CX - 30, CZ + 30);

// --- 6. Biome zones ---

// Eastern forest (temperate + dark)
for (let z = CZ - 20; z <= CZ + 30; z++) {
  for (let x = CX + 15; x <= CX + 50; x++) {
    if (x >= MAP_W || z < 0 || z >= MAP_H) continue;
    const existing = ground[z * MAP_W + x];
    if (existing !== 1) continue; // only replace default grass
    if (rand() > 0.35) {
      set(x, z, rand() > 0.4 ? 7 : 12); // forest floor / dark grass
    }
  }
}

// Western dense forest
for (let z = CZ - 30; z <= CZ + 30; z++) {
  for (let x = 8; x <= CX - 15; x++) {
    if (z < 15 || z >= MAP_H) continue;
    const existing = ground[z * MAP_W + x];
    if (existing !== 1) continue;
    if (rand() > 0.25) {
      set(x, z, 7); // dense forest
    } else if (rand() > 0.5) {
      set(x, z, 12); // dark grass
    }
  }
}

// Southwestern swamp
for (let z = CZ + 15; z <= CZ + 45; z++) {
  for (let x = 10; x <= CX - 10; x++) {
    if (z >= MAP_H) continue;
    const existing = ground[z * MAP_W + x];
    if (existing !== 1 && existing !== 7) continue;
    const d = dist(x, z, 30, CZ + 30);
    if (d < 20 && rand() > 0.3) {
      set(x, z, 9); // swamp
    }
  }
}

// Sandy area near south beach
for (let z = 100; z <= 112; z++) {
  for (let x = 20; x <= 100; x++) {
    const existing = ground[z * MAP_W + x];
    if (existing !== 1) continue;
    if (rand() > 0.5) {
      set(x, z, 4); // sand
    }
  }
}

// --- 7. Scatter variety across remaining grass ---
for (let z = 0; z < MAP_H; z++) {
  for (let x = 0; x < MAP_W; x++) {
    if (ground[z * MAP_W + x] !== 1) continue;
    if (rand() > 0.88) set(x, z, 12); // dark grass patches
  }
}

// --- Tiled JSON output ---
const map = {
  compressionlevel: -1,
  height: MAP_H,
  width: MAP_W,
  infinite: false,
  orientation: "isometric",
  renderorder: "right-down",
  tilewidth: 64,
  tileheight: 32,
  type: "map",
  version: "1.10",
  tiledversion: "1.11.0",
  nextlayerid: 4,
  nextobjectid: 20,
  tilesets: [{ firstgid: 1, source: "../tilesets/terrain.tsj" }],
  layers: [
    {
      id: 1, name: "ground", type: "tilelayer",
      width: MAP_W, height: MAP_H, data: ground,
      opacity: 1, visible: true, x: 0, y: 0,
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
        // Player spawn at town center
        {
          id: 1, name: "player_spawn", type: "spawn",
          x: CX * 64, y: CZ * 32, width: 0, height: 0,
          properties: [{ name: "spawnType", type: "string", value: "player" }],
        },
        // Skeletons in eastern forest
        {
          id: 2, name: "skeleton_spawn", type: "spawn",
          x: (CX + 25) * 64, y: (CZ + 10) * 32, width: 0, height: 0,
          properties: [
            { name: "spawnType", type: "string", value: "npc" },
            { name: "npcIds", type: "string", value: "skeleton-warrior,skeleton-archer" },
            { name: "maxCount", type: "int", value: 5 },
            { name: "distance", type: "int", value: 10 },
            { name: "frequency", type: "int", value: 8 },
          ],
        },
        // Goblins in southwestern swamp
        {
          id: 3, name: "goblin_spawn", type: "spawn",
          x: (CX - 30) * 64, y: (CZ + 30) * 32, width: 0, height: 0,
          properties: [
            { name: "spawnType", type: "string", value: "npc" },
            { name: "npcIds", type: "string", value: "goblin-grunt,goblin-shaman" },
            { name: "maxCount", type: "int", value: 4 },
            { name: "distance", type: "int", value: 8 },
            { name: "frequency", type: "int", value: 10 },
          ],
        },
        // Skeleton Lords near lake (harder area)
        {
          id: 4, name: "skeleton_lord_spawn", type: "spawn",
          x: (lakeX + 15) * 64, y: (lakeZ) * 32, width: 0, height: 0,
          properties: [
            { name: "spawnType", type: "string", value: "npc" },
            { name: "npcIds", type: "string", value: "skeleton-lord,skeleton-mage" },
            { name: "maxCount", type: "int", value: 3 },
            { name: "distance", type: "int", value: 6 },
            { name: "frequency", type: "int", value: 15 },
          ],
        },
        // Town safe zone
        {
          id: 5, name: "town_safe_zone", type: "safe_zone",
          x: (CX - 12) * 64, y: (CZ - 12) * 32,
          width: 24 * 64, height: 24 * 32,
          properties: [
            { name: "zoneName", type: "string", value: "Starter Town" },
            { name: "musicTag", type: "string", value: "town" },
          ],
        },
      ],
      opacity: 1, visible: true, x: 0, y: 0,
    },
  ],
  properties: [
    { name: "mapName", type: "string", value: "Starter Island" },
    { name: "mapId", type: "int", value: 1 },
  ],
};

const outPath = new URL("../public/maps/starter.json", import.meta.url).pathname;
Bun.write(outPath, JSON.stringify(map));
console.log(`Map written: ${outPath} (${MAP_W}x${MAP_H})`);

// Stats
const counts: Record<string, number> = {};
for (const t of ground) { counts[t] = (counts[t] || 0) + 1; }
const names = ["", "grass", "dirt", "stone", "sand", "water", "deep_water", "forest", "snow", "swamp", "mountain", "path", "grass_dark"];
for (const [id, count] of Object.entries(counts)) {
  console.log(`  ${names[+id] || `tile${id}`}: ${count}`);
}
