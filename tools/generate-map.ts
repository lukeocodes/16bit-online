/**
 * Generates a 256x256 Tiled JSON map with varied terrain.
 * Run: cd tools && npx tsx generate-map.ts
 * Output: ../packages/client/public/maps/starter.json
 */
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const W = 256;
const H = 256;
const TILE_W = 64;
const TILE_H = 32;

// GIDs (firstgid=1, so local id 0 = gid 1)
const GRASS = 1;
const DIRT = 2;
const STONE = 3;
const SAND = 4;
const WATER = 5;
const DEEP_WATER = 6;
const FOREST = 7;
const SNOW = 8;
const SWAMP = 9;
const MOUNTAIN = 10;
const PATH = 11;
const DARK_GRASS = 12;

// Simple seeded RNG
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simplex-like noise (value noise with smooth interpolation)
function createNoise(seed: number) {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
  function grad(hash: number, x: number, y: number) {
    const h = hash & 3;
    return (h < 2 ? x : -x) + (h === 0 || h === 3 ? y : -y);
  }

  return (x: number, y: number) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const a = perm[xi] + yi, b = perm[xi + 1] + yi;
    return lerp(
      lerp(grad(perm[a], xf, yf), grad(perm[b], xf - 1, yf), u),
      lerp(grad(perm[a + 1], xf, yf - 1), grad(perm[b + 1], xf - 1, yf - 1), u),
      v,
    );
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5) {
  let value = 0, amplitude = 1, frequency = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise(x * frequency, y * frequency);
    total += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value / total;
}

const rng = mulberry32(42);
const elevNoise = createNoise(42);
const moistNoise = createNoise(137);
const tempNoise = createNoise(256);
const detailNoise = createNoise(999);

// Town center
const TOWN_X = 128;
const TOWN_Z = 128;
const TOWN_RADIUS = 12;

// Generate terrain
const ground = new Array(W * H).fill(0);

for (let z = 0; z < H; z++) {
  for (let x = 0; x < W; x++) {
    const nx = x / W, nz = z / H;

    // Distance from center of map (for island shape)
    const dcx = (x - W / 2) / (W / 2);
    const dcz = (z - H / 2) / (H / 2);
    const distFromCenter = Math.sqrt(dcx * dcx + dcz * dcz);

    // Elevation: island falloff
    let elev = fbm(elevNoise, nx * 4, nz * 4, 4);
    elev = (elev + 1) / 2; // normalize to 0-1
    elev -= distFromCenter * 0.8; // island falloff
    elev = Math.max(0, elev);

    // Moisture
    let moist = fbm(moistNoise, nx * 3, nz * 3, 3);
    moist = (moist + 1) / 2;

    // Temperature (warmer in south, cooler in north)
    let temp = fbm(tempNoise, nx * 2, nz * 2, 2);
    temp = (temp + 1) / 2;
    temp += (z / H - 0.5) * 0.3; // latitude gradient

    // Determine tile type based on elevation/moisture/temp
    let tile: number;

    if (elev < 0.05) {
      tile = DEEP_WATER;
    } else if (elev < 0.12) {
      tile = WATER;
    } else if (elev < 0.16) {
      tile = SAND;
    } else if (elev > 0.82) {
      tile = SNOW;         // Only the very highest peaks
    } else if (elev > 0.65) {
      tile = MOUNTAIN;     // High mountains
    } else if (elev > 0.55) {
      tile = STONE;        // Rocky highlands
    } else if (moist > 0.7 && elev < 0.3) {
      tile = SWAMP;
    } else if (moist > 0.6 && temp > 0.35) {
      tile = FOREST;       // Dense forest
    } else if (moist > 0.45 && temp > 0.4) {
      tile = DARK_GRASS;   // Lush grassland
    } else if (temp < 0.25 && elev > 0.4) {
      tile = SNOW;         // Only cold + high altitude
    } else if (moist < 0.25) {
      tile = SAND;         // Dry areas become sandy/desert
    } else if (moist < 0.35) {
      tile = DIRT;         // Semi-dry = dirt
    } else {
      tile = GRASS;
    }

    // Detail variation
    const detail = detailNoise(x * 0.3, z * 0.3);
    if (tile === GRASS && detail > 0.3) tile = DARK_GRASS;
    if (tile === DARK_GRASS && detail < -0.3) tile = GRASS;

    ground[z * W + x] = tile;
  }
}

// Carve rivers
function carveRiver(startX: number, startZ: number, dirX: number, dirZ: number, length: number, width: number) {
  let x = startX, z = startZ;
  for (let i = 0; i < length; i++) {
    const rx = Math.round(x), rz = Math.round(z);
    for (let dw = -width; dw <= width; dw++) {
      for (let dh = -width; dh <= width; dh++) {
        const tx = rx + dw, tz = rz + dh;
        if (tx >= 0 && tx < W && tz >= 0 && tz < H) {
          if (Math.abs(dw) + Math.abs(dh) <= width) {
            ground[tz * W + tx] = WATER;
          }
          // Sand border
          if (Math.abs(dw) + Math.abs(dh) === width + 1) {
            const existing = ground[tz * W + tx];
            if (existing !== WATER && existing !== DEEP_WATER) {
              ground[tz * W + tx] = SAND;
            }
          }
        }
      }
    }
    x += dirX + (rng() - 0.5) * 1.5;
    z += dirZ + (rng() - 0.5) * 1.5;
    // Slight course change
    dirX += (rng() - 0.5) * 0.1;
    dirZ += (rng() - 0.5) * 0.1;
  }
}

// River from north to south
carveRiver(100, 20, 0.3, 1, 200, 2);
// River from west to east
carveRiver(30, 150, 1, 0.2, 180, 1);

// Lake
function carveLake(cx: number, cz: number, rx: number, rz: number) {
  for (let z = cz - rz - 1; z <= cz + rz + 1; z++) {
    for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      if (x < 0 || x >= W || z < 0 || z >= H) continue;
      const dx = (x - cx) / rx, dz = (z - cz) / rz;
      const dist = dx * dx + dz * dz;
      if (dist < 0.8) {
        ground[z * W + x] = WATER;
      } else if (dist < 1.2) {
        const existing = ground[z * W + x];
        if (existing !== WATER && existing !== DEEP_WATER) {
          ground[z * W + x] = SAND;
        }
      }
    }
  }
}

carveLake(180, 100, 12, 8);
carveLake(60, 200, 8, 10);

// Town: stone center with paths radiating out
for (let z = TOWN_Z - TOWN_RADIUS; z <= TOWN_Z + TOWN_RADIUS; z++) {
  for (let x = TOWN_X - TOWN_RADIUS; x <= TOWN_X + TOWN_RADIUS; x++) {
    if (x < 0 || x >= W || z < 0 || z >= H) continue;
    const dist = Math.sqrt((x - TOWN_X) ** 2 + (z - TOWN_Z) ** 2);
    if (dist <= TOWN_RADIUS * 0.5) {
      ground[z * W + x] = STONE;
    } else if (dist <= TOWN_RADIUS * 0.8) {
      ground[z * W + x] = DIRT;
    } else if (dist <= TOWN_RADIUS) {
      ground[z * W + x] = GRASS;
    }
  }
}

// Paths from town to points of interest — bridges over water
function carvePath(x1: number, z1: number, x2: number, z2: number) {
  let x = x1, z = z1;
  while (Math.abs(x - x2) > 1 || Math.abs(z - z2) > 1) {
    const rx = Math.round(x), rz = Math.round(z);
    if (rx >= 0 && rx < W && rz >= 0 && rz < H) {
      const existing = ground[rz * W + rx];
      // Paths overwrite everything except stone (town center)
      // This creates bridge crossings over rivers/water
      if (existing !== STONE) {
        ground[rz * W + rx] = PATH;
      }
    }
    const dx = x2 - x, dz = z2 - z;
    const len = Math.sqrt(dx * dx + dz * dz);
    x += dx / len + (rng() - 0.5) * 0.5;
    z += dz / len + (rng() - 0.5) * 0.5;
  }
}

// Paths to spawn areas
carvePath(TOWN_X, TOWN_Z, 180, 160); // NE to skeleton area
carvePath(TOWN_X, TOWN_Z, 60, 180);  // SW to goblin area
carvePath(TOWN_X, TOWN_Z, 160, 80);  // East to elite area
carvePath(TOWN_X, TOWN_Z, 80, 60);   // NW exploration

// Collision layer: non-zero where ground is non-walkable (water, deep_water, mountain, snow peak)
const collision = new Array(W * H).fill(0);
const COLLISION_GID = 1; // any non-zero value = blocked
for (let i = 0; i < W * H; i++) {
  const tile = ground[i];
  if (tile === WATER || tile === DEEP_WATER || tile === MOUNTAIN) {
    collision[i] = COLLISION_GID;
  }
}

// Objects
const objects: any[] = [];
let objId = 1;

// Player spawn (town center)
objects.push({
  id: objId++,
  name: "player_spawn",
  type: "spawn",
  x: TOWN_X * TILE_W,
  y: TOWN_Z * TILE_H,
  width: 0, height: 0,
  properties: [{ name: "spawnType", type: "string", value: "player" }],
});

// NPC spawn points — spread across the map for exploration
const spawns = [
  // Near town (easy) — rabbits for flavor, weak goblins
  { name: "town_rabbits", x: 148, z: 110, npcIds: "rabbit,rabbit", maxCount: 4, distance: 8, frequency: 15 },
  { name: "roadside_goblins", x: 150, z: 148, npcIds: "goblin-grunt,goblin-grunt", maxCount: 3, distance: 8, frequency: 12 },

  // Medium distance — skeleton camps, goblin camps, imps
  { name: "skeleton_camp", x: 180, z: 160, npcIds: "skeleton-warrior,skeleton-archer", maxCount: 5, distance: 10, frequency: 8 },
  { name: "goblin_swamp", x: 60, z: 185, npcIds: "goblin-grunt,goblin-shaman", maxCount: 4, distance: 8, frequency: 10 },
  { name: "forest_imps", x: 90, z: 60, npcIds: "lesser-imp,lesser-imp", maxCount: 4, distance: 8, frequency: 10 },
  { name: "lakeside_goblins", x: 200, z: 110, npcIds: "goblin-grunt,goblin-grunt", maxCount: 4, distance: 10, frequency: 10 },
  { name: "desert_skeletons", x: 200, z: 200, npcIds: "skeleton-warrior,skeleton-archer", maxCount: 4, distance: 8, frequency: 10 },
  { name: "north_rabbits", x: 80, z: 40, npcIds: "rabbit,rabbit,rabbit", maxCount: 6, distance: 15, frequency: 20 },

  // Far (harder) — elites, greater imps, skeleton lords
  { name: "elite_ruins", x: 170, z: 85, npcIds: "skeleton-lord,skeleton-mage", maxCount: 3, distance: 6, frequency: 15 },
  { name: "imp_volcano", x: 220, z: 45, npcIds: "greater-imp,lesser-imp", maxCount: 4, distance: 8, frequency: 12 },
  { name: "goblin_fortress", x: 40, z: 220, npcIds: "goblin-grunt,goblin-shaman,goblin-grunt", maxCount: 6, distance: 10, frequency: 8 },

  // Special — King Rabbit hidden in the forest
  { name: "kings_grove", x: 55, z: 55, npcIds: "king-rabbit", maxCount: 1, distance: 3, frequency: 60 },
];

for (const sp of spawns) {
  objects.push({
    id: objId++,
    name: sp.name,
    type: "spawn",
    x: sp.x * TILE_W,
    y: sp.z * TILE_H,
    width: 0, height: 0,
    properties: [
      { name: "spawnType", type: "string", value: "npc" },
      { name: "npcIds", type: "string", value: sp.npcIds },
      { name: "maxCount", type: "int", value: sp.maxCount },
      { name: "distance", type: "int", value: sp.distance },
      { name: "frequency", type: "int", value: sp.frequency },
    ],
  });
}

// Safe zone (town)
objects.push({
  id: objId++,
  name: "town_safe_zone",
  type: "safe_zone",
  x: (TOWN_X - TOWN_RADIUS) * TILE_W,
  y: (TOWN_Z - TOWN_RADIUS) * TILE_H,
  width: TOWN_RADIUS * 2 * TILE_W,
  height: TOWN_RADIUS * 2 * TILE_H,
  properties: [
    { name: "zoneName", type: "string", value: "Starter Town" },
    { name: "musicTag", type: "string", value: "town" },
  ],
});

// Build Tiled JSON
const tiledMap = {
  compressionlevel: -1,
  height: H,
  width: W,
  tilewidth: TILE_W,
  tileheight: TILE_H,
  infinite: false,
  orientation: "isometric",
  renderorder: "right-down",
  type: "map",
  version: "1.10",
  tiledversion: "1.11.0",
  nextlayerid: 4,
  nextobjectid: objId,
  layers: [
    {
      id: 1,
      name: "ground",
      type: "tilelayer",
      width: W,
      height: H,
      data: ground,
      opacity: 1,
      visible: true,
      x: 0, y: 0,
    },
    {
      id: 2,
      name: "collision",
      type: "tilelayer",
      width: W,
      height: H,
      data: collision,
      opacity: 1,
      visible: true,
      x: 0, y: 0,
    },
    {
      id: 3,
      name: "objects",
      type: "objectgroup",
      objects,
      opacity: 1,
      visible: true,
      x: 0, y: 0,
      draworder: "topdown",
    },
  ],
  tilesets: [
    { firstgid: 1, source: "../tilesets/terrain.tsj" },
  ],
};

const outPath = resolve(__dirname, "../packages/client/public/maps/starter.json");
writeFileSync(outPath, JSON.stringify(tiledMap));
console.log(`Generated ${W}x${H} map (${(JSON.stringify(tiledMap).length / 1024).toFixed(0)}KB) -> ${outPath}`);
console.log(`  ${spawns.length} NPC spawn points, 1 safe zone, 1 player spawn`);
console.log(`  Town center at (${TOWN_X}, ${TOWN_Z})`);
