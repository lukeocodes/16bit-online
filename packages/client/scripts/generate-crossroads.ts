/**
 * Generate the Crossroads zone (256x256 tiles).
 * Run: bun run scripts/generate-crossroads.ts
 *
 * Theme: A central trading hub where all 3 race paths converge.
 * Mixed terrain — grasslands with a large market town, roads
 * leading to each starter zone, and higher-level enemies in the outskirts.
 * Levels 5-10.
 *
 * Tile IDs (1-indexed for Tiled):
 * 1:grass 2:dirt 3:stone 4:sand 5:water 6:deep_water
 * 7:forest_floor 8:snow 9:swamp 10:mountain 11:path 12:grass_dark
 */

import { writeFileSync } from "fs";
import { resolve } from "path";

const MAP_W = 256;
const MAP_H = 256;
const CX = MAP_W / 2;
const CZ = MAP_H / 2;

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

let seed = 314;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// --- Central market town ---
// Large stone square
for (let x = CX - 25; x <= CX + 25; x++) {
  for (let z = CZ - 25; z <= CZ + 25; z++) {
    const d = dist(x, z, CX, CZ);
    if (d < 15) set(x, z, 3);  // Stone market square
    else if (d < 20) set(x, z, 11); // Path ring
    else if (d < 25) set(x, z, 2);  // Dirt outskirts
  }
}

// --- Three main roads to starter zones ---
// West road → Human Meadows (arrives from west)
for (let x = 0; x < CX - 25; x++) {
  for (let w = -2; w <= 2; w++) {
    set(x, CZ + w, 11);
  }
  // Grass alongside road
  for (let w = 3; w <= 5; w++) {
    set(x, CZ + w, 1);
    set(x, CZ - w, 1);
  }
}

// North road → Elf Grove (arrives from north)
for (let z = 0; z < CZ - 25; z++) {
  for (let w = -2; w <= 2; w++) {
    set(CX + w, z, 11);
  }
}

// East road → Orc Wastes (arrives from east)
for (let x = CX + 26; x < MAP_W; x++) {
  for (let w = -2; w <= 2; w++) {
    set(x, CZ + w, 11);
  }
  // Sand transition toward east (orc zone influence)
  if (x > MAP_W - 40) {
    for (let z = CZ - 20; z <= CZ + 20; z++) {
      if (rand() > 0.5) set(x, z, 4); // Sand encroaching
    }
  }
}

// --- Forest patches (northwest and southeast) ---
const forests = [
  { x: 40, z: 40, r: 20 },
  { x: 60, z: 60, r: 15 },
  { x: MAP_W - 50, z: MAP_H - 50, r: 18 },
  { x: MAP_W - 70, z: MAP_H - 40, r: 12 },
];
for (const f of forests) {
  for (let dx = -f.r; dx <= f.r; dx++) {
    for (let dz = -f.r; dz <= f.r; dz++) {
      const d = dist(0, 0, dx, dz);
      if (d < f.r * 0.7) set(f.x + dx, f.z + dz, 7); // Forest floor
      else if (d < f.r && rand() > 0.3) set(f.x + dx, f.z + dz, 12); // Dark grass edge
    }
  }
}

// --- Lake in southwest ---
for (let dx = -15; dx <= 15; dx++) {
  for (let dz = -10; dz <= 10; dz++) {
    const d = dist(0, 0, dx, dz);
    const lx = 50, lz = MAP_H - 60;
    if (d < 6) set(lx + dx, lz + dz, 6);  // Deep water
    else if (d < 10) set(lx + dx, lz + dz, 5); // Water
    else if (d < 13) set(lx + dx, lz + dz, 9); // Swamp shore
  }
}

// --- Mountain ridges (south border, scattered) ---
for (let x = 80; x < MAP_W - 80; x++) {
  for (let z = MAP_H - 12; z < MAP_H; z++) {
    const edgeDist = MAP_H - z;
    if (edgeDist < 4) set(x, z, 10, true);
    else if (edgeDist < 8 && rand() > 0.4) set(x, z, 10, true);
  }
}

// --- Scattered dirt/sand patches for variety ---
for (let i = 0; i < 40; i++) {
  const px = 15 + Math.floor(rand() * (MAP_W - 30));
  const pz = 15 + Math.floor(rand() * (MAP_H - 30));
  if (dist(px, pz, CX, CZ) < 30) continue; // Not in town
  const r = 3 + Math.floor(rand() * 5);
  const tile = rand() > 0.5 ? 2 : 4; // dirt or sand
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (dist(0, 0, dx, dz) < r) set(px + dx, pz + dz, tile);
    }
  }
}

// --- Objects layer ---
const objects: any[] = [];

// Player spawn — center of market
objects.push({
  id: 1, name: "player_spawn", type: "player_spawn",
  x: CX * 64, y: CZ * 32, width: 64, height: 32,
  properties: [{ name: "x", type: "int", value: CX }, { name: "z", type: "int", value: CZ }],
});

// Safe zone — market town
objects.push({
  id: 2, name: "Crossroads Market", type: "safe_zone",
  x: (CX - 20) * 64, y: (CZ - 20) * 32, width: 40 * 64, height: 40 * 32,
  properties: [
    { name: "x", type: "int", value: CX },
    { name: "z", type: "int", value: CZ },
    { name: "radius", type: "int", value: 20 },
  ],
});

// NPC spawn points — higher level enemies
const spawns = [
  { id: "sp-cross-skeleton-1", x: 40, z: 40, npcIds: ["skeleton-warrior", "skeleton-mage"], maxCount: 4, distance: 12, frequency: 5 },
  { id: "sp-cross-skeleton-2", x: MAP_W - 50, z: MAP_H - 50, npcIds: ["skeleton-warrior", "skeleton-archer", "skeleton-lord"], maxCount: 5, distance: 14, frequency: 5 },
  { id: "sp-cross-goblin-1", x: MAP_W - 40, z: 50, npcIds: ["goblin-grunt", "goblin-shaman"], maxCount: 4, distance: 10, frequency: 6 },
  { id: "sp-cross-imp-1", x: 60, z: MAP_H - 60, npcIds: ["imp"], maxCount: 3, distance: 8, frequency: 7 },
  { id: "sp-cross-rabbit-1", x: CX - 50, z: CZ - 40, npcIds: ["rabbit"], maxCount: 3, distance: 10, frequency: 10 },
  { id: "sp-cross-mix-1", x: CX + 60, z: CZ - 50, npcIds: ["skeleton-warrior", "goblin-grunt", "imp"], maxCount: 6, distance: 15, frequency: 4 },
];

let objId = 10;
for (const sp of spawns) {
  objects.push({
    id: objId++, name: sp.id, type: "spawn_point",
    x: sp.x * 64, y: sp.z * 32, width: 64, height: 32,
    properties: [
      { name: "x", type: "int", value: sp.x },
      { name: "z", type: "int", value: sp.z },
      { name: "npcIds", type: "string", value: sp.npcIds.join(",") },
      { name: "maxCount", type: "int", value: sp.maxCount },
      { name: "distance", type: "int", value: sp.distance },
      { name: "frequency", type: "int", value: sp.frequency },
    ],
  });
}

// Discovery zones
const discZones = [
  { name: "Darkwood Forest", x: 40, z: 40, r: 20 },
  { name: "Skeleton Ruins", x: MAP_W - 50, z: MAP_H - 50, r: 18 },
  { name: "Goblin Outskirts", x: MAP_W - 40, z: 50, r: 14 },
  { name: "Misty Lake", x: 50, z: MAP_H - 60, r: 14 },
  { name: "Battle Plains", x: CX + 60, z: CZ - 50, r: 16 },
];
for (const zone of discZones) {
  objects.push({
    id: objId++, name: zone.name, type: "zone",
    x: (zone.x - zone.r) * 64, y: (zone.z - zone.r) * 32,
    width: zone.r * 2 * 64, height: zone.r * 2 * 32,
    properties: [
      { name: "x", type: "int", value: zone.x },
      { name: "z", type: "int", value: zone.z },
      { name: "radius", type: "int", value: zone.r },
    ],
  });
}

// Zone exits — 3 entrances from starter zones + 1 to skeleton wastes
const exits = [
  { name: "exit-to-human", type: "zone_exit", x: 3, z: CZ, targetZone: "human-meadows", spawnX: 240, spawnZ: 128 },
  { name: "exit-to-elf", type: "zone_exit", x: CX, z: 3, targetZone: "elf-grove", spawnX: 128, spawnZ: 240 },
  { name: "exit-to-orc", type: "zone_exit", x: MAP_W - 6, z: CZ, targetZone: "orc-wastes", spawnX: 20, spawnZ: 128 },
  { name: "exit-to-wastes", type: "zone_exit", x: CX, z: MAP_H - 6, targetZone: "skeleton-wastes", spawnX: 128, spawnZ: 20 },
];
for (const exit of exits) {
  objects.push({
    id: objId++, name: exit.name, type: exit.type,
    x: (exit.x - 3) * 64, y: (exit.z - 3) * 32, width: 6 * 64, height: 6 * 32,
    properties: [
      { name: "targetZone", type: "string", value: exit.targetZone },
      { name: "spawnX", type: "int", value: exit.spawnX },
      { name: "spawnZ", type: "int", value: exit.spawnZ },
    ],
  });
}

// --- Build Tiled JSON ---
const map = {
  compressionlevel: -1,
  height: MAP_H,
  width: MAP_W,
  infinite: false,
  orientation: "isometric",
  renderorder: "right-down",
  tilewidth: 64,
  tileheight: 32,
  tiledversion: "1.11.0",
  type: "map",
  version: "1.10",
  nextlayerid: 4,
  nextobjectid: objId + 1,
  tilesets: [{ firstgid: 1, source: "../tilesets/terrain.tsj" }],
  layers: [
    {
      id: 1, name: "ground", type: "tilelayer",
      x: 0, y: 0, width: MAP_W, height: MAP_H,
      data: ground, visible: true, opacity: 1,
    },
    {
      id: 2, name: "collision", type: "tilelayer",
      x: 0, y: 0, width: MAP_W, height: MAP_H,
      data: collision, visible: false, opacity: 1,
    },
    {
      id: 3, name: "objects", type: "objectgroup",
      objects, visible: true, opacity: 1,
      x: 0, y: 0,
    },
  ],
};

const outPath = resolve(import.meta.dir, "../public/maps/crossroads.json");
writeFileSync(outPath, JSON.stringify(map));
console.log(`Generated Crossroads zone: ${MAP_W}x${MAP_H} → ${outPath}`);
console.log(`  Spawns: ${spawns.length}, Zones: ${discZones.length}, Exits: ${exits.length}`);
