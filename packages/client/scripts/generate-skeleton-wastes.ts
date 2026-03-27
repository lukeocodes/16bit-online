/**
 * Generate the Skeleton Wastes zone (256x256 tiles).
 * Run: bun run scripts/generate-skeleton-wastes.ts
 *
 * Theme: Desolate wasteland with bone-white terrain, dead forests,
 * ruins, and a central fortress. Levels 5-10.
 *
 * Tile IDs (1-indexed for Tiled):
 * 1:grass 2:dirt 3:stone 4:sand 5:water 6:deep_water
 * 7:forest 8:snow 9:swamp 10:mountain 11:path 12:grass_dark
 */

const MAP_W = 256;
const MAP_H = 256;
const CX = MAP_W / 2;
const CZ = MAP_H / 2;

const ground = new Array(MAP_W * MAP_H).fill(2); // dirt default (wasteland)
const collision = new Array(MAP_W * MAP_H).fill(0);

function set(x: number, z: number, tileId: number, blocked = false) {
  if (x < 0 || x >= MAP_W || z < 0 || z >= MAP_H) return;
  ground[z * MAP_W + x] = tileId;
  if (blocked) collision[z * MAP_W + x] = 1;
}

function dist(x1: number, z1: number, x2: number, z2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (z1 - z2) ** 2);
}

let seed = 777;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function noise2d(x: number, z: number): number {
  return (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
}

// --- 1. Base terrain ---
for (let z = 0; z < MAP_H; z++) {
  for (let x = 0; x < MAP_W; x++) {
    const d = dist(x, z, CX, CZ);
    const n = Math.abs(noise2d(x * 0.05, z * 0.05));

    // Ocean border
    if (d > 115 + n * 10) {
      set(x, z, 6, true); // deep water
    } else if (d > 108 + n * 8) {
      set(x, z, 5, true); // shallow water
    } else if (d > 102 + n * 6) {
      set(x, z, 4); // sand beach
    }
    // Mountain ridges (northeast and southwest)
    else if (
      (dist(x, z, CX + 60, CZ - 60) < 30 + n * 15 && n > 0.3) ||
      (dist(x, z, CX - 50, CZ + 70) < 25 + n * 12 && n > 0.35)
    ) {
      set(x, z, 10, true); // mountain (impassable)
    }
    // Dead forest patches
    else if (
      (dist(x, z, CX - 40, CZ - 30) < 25 && n > 0.25) ||
      (dist(x, z, CX + 30, CZ + 40) < 20 && n > 0.3)
    ) {
      set(x, z, 12); // grass_dark (dead forest floor)
    }
    // Swamp areas
    else if (dist(x, z, CX + 50, CZ + 50) < 20 + n * 10) {
      set(x, z, 9); // swamp
    }
    // Stone ruins scattered
    else if (n > 0.7 && d < 90) {
      set(x, z, 3); // stone (ruins)
    }
    // Otherwise dirt/sand wasteland
    else {
      const wastelandNoise = Math.abs(noise2d(x * 0.08, z * 0.08));
      if (wastelandNoise > 0.6) {
        set(x, z, 4); // sandy patches
      }
      // else stays dirt (default)
    }
  }
}

// --- 2. Central fortress (stone plaza) ---
const fortX = CX;
const fortZ = CZ;
for (let z = fortZ - 15; z <= fortZ + 15; z++) {
  for (let x = fortX - 15; x <= fortX + 15; x++) {
    const d = dist(x, z, fortX, fortZ);
    if (d < 12) set(x, z, 3); // stone floor
    else if (d < 15) set(x, z, 2); // dirt border
  }
}

// --- 3. Paths connecting areas ---
function drawPath(x1: number, z1: number, x2: number, z2: number) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
  for (let i = 0; i <= steps; i++) {
    const t = steps > 0 ? i / steps : 0;
    const px = Math.round(x1 + (x2 - x1) * t);
    const pz = Math.round(z1 + (z2 - z1) * t);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const gid = ground[(pz + dz) * MAP_W + (px + dx)];
        if (gid !== 5 && gid !== 6 && gid !== 10) {
          set(px + dx, pz + dz, 11); // path
        }
      }
    }
  }
}

// Path from west entrance to fortress
drawPath(20, CZ, fortX - 15, fortZ);
// Path from fortress to skeleton camp (east)
drawPath(fortX + 15, fortZ, CX + 60, CZ);
// Path from fortress to dead forest (north)
drawPath(fortX, fortZ - 15, fortX, CZ - 50);
// Path from fortress to swamp (southeast)
drawPath(fortX + 15, fortZ + 10, CX + 40, CZ + 40);

// --- 4. Entrance area (west side — where players arrive from starter) ---
const entranceX = 20;
const entranceZ = CZ;
for (let z = entranceZ - 5; z <= entranceZ + 5; z++) {
  for (let x = entranceX - 3; x <= entranceX + 3; x++) {
    set(x, z, 3); // stone entrance platform
  }
}

// --- Build Tiled JSON ---
const map = {
  compressionlevel: -1,
  width: MAP_W,
  height: MAP_H,
  tilewidth: 64,
  tileheight: 32,
  orientation: "isometric",
  renderorder: "right-down",
  tiledversion: "1.10.2",
  type: "map",
  version: "1.10",
  infinite: false,
  nextlayerid: 4,
  nextobjectid: 20,
  tilesets: [{ firstgid: 1, source: "../tilesets/terrain.tsj" }],
  layers: [
    {
      id: 1, name: "ground", type: "tilelayer",
      width: MAP_W, height: MAP_H,
      data: ground,
      opacity: 1, visible: true, x: 0, y: 0,
    },
    {
      id: 2, name: "collision", type: "tilelayer",
      width: MAP_W, height: MAP_H,
      data: collision,
      opacity: 1, visible: true, x: 0, y: 0,
    },
    {
      id: 3, name: "objects", type: "objectgroup",
      draworder: "topdown",
      objects: [
        // Player spawn (west entrance)
        {
          id: 1, name: "player_spawn", type: "spawn",
          x: entranceX * 64, y: entranceZ * 32, width: 0, height: 0, rotation: 0, visible: true,
          properties: [{ name: "spawnType", type: "string", value: "player" }],
        },
        // Skeleton warriors near fortress
        {
          id: 2, name: "fortress_skeletons", type: "spawn",
          x: (CX + 20) * 64, y: CZ * 32, width: 0, height: 0, rotation: 0, visible: true,
          properties: [
            { name: "spawnType", type: "string", value: "npc" },
            { name: "npcIds", type: "string", value: "skeleton-warrior,skeleton-archer" },
            { name: "maxCount", type: "int", value: 6 },
            { name: "distance", type: "int", value: 12 },
            { name: "frequency", type: "int", value: 8 },
          ],
        },
        // Skeleton lords in the fortress
        {
          id: 3, name: "fortress_lords", type: "spawn",
          x: CX * 64, y: CZ * 32, width: 0, height: 0, rotation: 0, visible: true,
          properties: [
            { name: "spawnType", type: "string", value: "npc" },
            { name: "npcIds", type: "string", value: "skeleton-lord,skeleton-mage" },
            { name: "maxCount", type: "int", value: 3 },
            { name: "distance", type: "int", value: 8 },
            { name: "frequency", type: "int", value: 20 },
          ],
        },
        // Skeleton archers in dead forest
        {
          id: 4, name: "dead_forest_archers", type: "spawn",
          x: (CX - 40) * 64, y: (CZ - 30) * 32, width: 0, height: 0, rotation: 0, visible: true,
          properties: [
            { name: "spawnType", type: "string", value: "npc" },
            { name: "npcIds", type: "string", value: "skeleton-archer,skeleton-archer,skeleton-warrior" },
            { name: "maxCount", type: "int", value: 5 },
            { name: "distance", type: "int", value: 10 },
            { name: "frequency", type: "int", value: 10 },
          ],
        },
        // Greater imps in swamp
        {
          id: 5, name: "swamp_imps", type: "spawn",
          x: (CX + 50) * 64, y: (CZ + 50) * 32, width: 0, height: 0, rotation: 0, visible: true,
          properties: [
            { name: "spawnType", type: "string", value: "npc" },
            { name: "npcIds", type: "string", value: "greater-imp,lesser-imp" },
            { name: "maxCount", type: "int", value: 4 },
            { name: "distance", type: "int", value: 8 },
            { name: "frequency", type: "int", value: 12 },
          ],
        },
        // Fortress safe zone (rest point)
        {
          id: 10, name: "fortress_camp", type: "safe_zone",
          x: (CX - 8) * 64, y: (CZ - 8) * 32,
          width: 16 * 64, height: 16 * 32,
          rotation: 0, visible: true,
          properties: [
            { name: "zoneName", type: "string", value: "Ruined Fortress" },
            { name: "musicTag", type: "string", value: "dungeon" },
          ],
        },
        // Discovery zones
        {
          id: 11, name: "dead_forest_zone", type: "zone",
          x: (CX - 55) * 64, y: (CZ - 45) * 32,
          width: 30 * 64, height: 30 * 32,
          rotation: 0, visible: true,
          properties: [{ name: "zoneName", type: "string", value: "Dead Forest" }],
        },
        {
          id: 12, name: "bone_swamp_zone", type: "zone",
          x: (CX + 35) * 64, y: (CZ + 35) * 32,
          width: 30 * 64, height: 30 * 32,
          rotation: 0, visible: true,
          properties: [{ name: "zoneName", type: "string", value: "Bone Swamp" }],
        },
        // Zone exit back to starter meadows (west edge)
        {
          id: 15, name: "exit_to_starter", type: "zone_exit",
          x: 5 * 64, y: (CZ - 3) * 32,
          width: 5 * 64, height: 6 * 32,
          rotation: 0, visible: true,
          properties: [{ name: "exitId", type: "string", value: "exit-to-starter" }],
        },
      ],
      opacity: 1, visible: true, x: 0, y: 0,
    },
  ],
  properties: [
    { name: "mapName", type: "string", value: "Skeleton Wastes" },
    { name: "mapId", type: "int", value: 2 },
  ],
};

const outPath = new URL("../public/maps/skeleton-wastes.json", import.meta.url).pathname;
Bun.write(outPath, JSON.stringify(map));
console.log(`Map written: ${outPath} (${MAP_W}x${MAP_H})`);

// Stats
const counts: Record<string, number> = {};
for (const t of ground) { counts[t] = (counts[t] || 0) + 1; }
const names = ["", "grass", "dirt", "stone", "sand", "water", "deep_water", "forest", "snow", "swamp", "mountain", "path", "grass_dark"];
for (const [id, count] of Object.entries(counts)) {
  console.log(`  ${names[+id] || `tile${id}`}: ${count}`);
}
