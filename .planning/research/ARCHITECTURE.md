# Architecture Patterns

**Domain:** Procedural multi-continent world generation for browser MMO
**Researched:** 2026-03-19
**Overall confidence:** MEDIUM (training data only, no web verification available)

## Recommended Architecture

The world system is a layered pipeline: a static **World Definition** defines continental geography and terrain classification at the macro level, a **Region System** manages medium-scale areas with procedural seeding, and the existing **Chunk System** handles tile-level rendering and streaming. Each layer has distinct responsibilities, storage patterns, and lifecycle.

### High-Level System Diagram

```
+------------------------------------------------------------------+
|                        WORLD DEFINITION                          |
|  (Static, authored at build/boot time)                           |
|                                                                  |
|  World Map Data (continent outlines, ocean, elevation heightmap) |
|  Terrain Classification Grid (biome assignment per region cell)  |
|  Settlement Placement (cities, towns, settlements with coords)   |
|  Safe Zone Registry (extends existing zones.ts)                  |
+------------------------------------------------------------------+
          |                              |
          | lookups                      | terrain params
          v                              v
+----------------------------+  +-----------------------------+
|     REGION SYSTEM          |  |    SEED GENERATOR           |
|  (Server-authoritative)    |  |  (Deterministic procgen)    |
|                            |  |                             |
|  Region Registry (in DB)   |  |  Noise functions (simplex)  |
|  Discovery tracking        |  |  Biome-aware tile rules     |
|  Region state machine:     |  |  Decoration placement       |
|    UNEXPLORED -> SEEDING   |  |  Wildlife spawn tables      |
|    -> SEEDED -> PERSISTED  |  |  Tree/rock/foliage density  |
|  Player notes storage      |  |  Terrain feature generation  |
+----------------------------+  +-----------------------------+
          |                              |
          | chunk tile data              | tile arrays
          v                              v
+------------------------------------------------------------------+
|                     CHUNK SYSTEM (existing, extended)             |
|                                                                  |
|  ChunkManager (client) -- loads/unloads based on player pos      |
|  Chunk (client) -- builds mesh from tile data                    |
|  chunkData table (server) -- persisted tile arrays               |
|  Chunk streaming via reliable channel                            |
+------------------------------------------------------------------+
          |
          v
+------------------------------------------------------------------+
|                     ECS + RENDERING (existing)                   |
|                                                                  |
|  EntityManager -- spatial grid, component queries                |
|  RenderSystem -- Babylon.js mesh creation                        |
|  MovementSystem -- player/NPC movement                           |
|  New: DecorationSystem -- static world objects (trees, rocks)    |
|  New: WildlifeSystem -- region-aware NPC spawning                |
+------------------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Location |
|-----------|---------------|-------------------|----------|
| **WorldDefinition** | Static continental geography, elevation, biome grid. Read-only after boot. | RegionSystem (terrain params), ChunkStreamer (ocean/void tiles), SafeZoneRegistry | `packages/server/src/world/definition/` |
| **TerrainClassifier** | Maps world coordinates to biome type using elevation + moisture + temperature grids | SeedGenerator (biome params), WorldDefinition (source data) | `packages/server/src/world/terrain/` |
| **RegionRegistry** | Tracks region boundaries, discovery state, discoverer, notes. State machine for seeding lifecycle. | SeedGenerator (triggers seeding), ChunkStore (receives tile data), Database (persistence) | `packages/server/src/world/regions/` |
| **SeedGenerator** | Deterministic procedural generation of tile data, decorations, and wildlife spawn tables for a region | TerrainClassifier (biome rules), RegionRegistry (seed trigger), ChunkStore (output) | `packages/server/src/world/generation/` |
| **ChunkStreamer** | Serves chunk data to clients on demand. Checks if chunk exists in DB, triggers region seeding if needed. | RegionRegistry, ChunkStore (DB), NetworkManager (WebRTC reliable channel) | `packages/server/src/world/chunks/` |
| **ChunkStore** | Database access layer for chunk_data table. Batch read/write of tile arrays. Redis caching of hot chunks. | PostgreSQL (persistence), Redis (cache), ChunkStreamer (reads), SeedGenerator (writes) | `packages/server/src/world/chunks/` |
| **SafeZoneRegistry** | Extended version of existing zones.ts. Loads safe zones from WorldDefinition. Enforces PvP rules. | WorldDefinition (zone definitions), Combat system (PvP checks) | `packages/server/src/game/zones.ts` (extended) |
| **RegionNotifier** | Sends region entry/exit events to clients. Includes region name, discoverer, notes. | RegionRegistry (lookups), ConnectionManager (broadcasts) | `packages/server/src/world/regions/` |
| **ClientWorldManager** | Extended ChunkManager that requests chunks from server, handles region entry UI, manages decoration entities | ChunkStreamer (requests), RegionNotifier (events), ECS (decoration entities) | `packages/client/src/world/` (extended) |
| **WildlifeSpawner** | Region-aware spawn point system. Creates spawn points when region is seeded. Extends existing spawn-points.ts pattern. | RegionRegistry (spawn table data), SpawnPoint system (existing), EntityStore | `packages/server/src/world/wildlife/` |

### Data Flow

#### 1. World Boot (Server Startup)

```
Server starts
  -> Load WorldDefinition from static data files (JSON/binary)
     - Continental outlines (polygon boundaries or bitmap)
     - Elevation heightmap (low-res grid, e.g., 1 cell = 1 region)
     - Moisture/temperature maps for biome classification
     - Settlement locations with safe zone radii
  -> Initialize TerrainClassifier with world data
  -> Initialize RegionRegistry (loads discovered regions from DB)
  -> Register safe zones from settlement data into SafeZoneRegistry
  -> Start game loop (existing)
```

#### 2. Player Moves Into Unexplored Area (Region Seeding)

```
Player position update received (existing flow)
  -> ChunkStreamer checks: does client need chunks?
     -> For each needed chunk:
        1. Check ChunkStore (Redis cache first, then PostgreSQL)
        2. If chunk exists: send to client via reliable channel
        3. If chunk does NOT exist:
           a. Determine which region this chunk belongs to
           b. Check RegionRegistry: is region seeded?
           c. If NOT seeded:
              - Lock region (prevent double-seeding)
              - TerrainClassifier.classify(regionX, regionY) -> biome
              - SeedGenerator.generate(regionId, biome, seed)
                -> Produces tile data for ALL chunks in region
                -> Produces decoration placement list
                -> Produces wildlife spawn table
              - Write all chunks to ChunkStore (batch insert)
              - Write decoration/wildlife data to RegionRegistry
              - Mark region as SEEDED in RegionRegistry
              - WildlifeSpawner.activateRegion(regionId)
              - Unlock region
           d. Send chunk to client
  -> RegionNotifier checks: did player cross region boundary?
     -> If entering new region:
        - If region has no discoverer: assign this player as discoverer
        - Generate procedural region name (if not yet named)
        - Persist discovery to DB
        - Send REGION_ENTER event to client (name, discoverer, note)
```

#### 3. Chunk Streaming to Client

```
Server determines client needs chunk (based on player position)
  -> ChunkStore.getChunk(mapId, chunkX, chunkY)
     -> Redis: GET chunk:{mapId}:{chunkX}:{chunkY}
     -> If miss: PostgreSQL SELECT from chunk_data
     -> If miss: trigger region seeding (flow #2)
  -> Pack chunk data: opcode CHUNK_DATA + chunkX + chunkY + compressed tile bytes
  -> Send via reliable DataChannel
  -> Client receives:
     -> ChunkManager.loadChunkFromData(chunkX, chunkY, 0, tileData)
     -> Chunk.buildMesh() creates Babylon.js ground tiles
```

#### 4. Region Discovery Notification

```
Server detects player crossed region boundary
  -> RegionRegistry.getRegion(regionId)
  -> If region.discoveredBy is null:
     - Set discoveredBy = playerId
     - Set discoveredAt = now
     - Generate procedural name using region seed
     - Persist to DB
  -> Pack REGION_ENTER event: { regionId, name, discoveredBy, note }
  -> Send to player via reliable channel
  -> Client shows region banner UI (name + discoverer's note)
```

### Hierarchical Spatial Organization

The world uses a three-tier spatial hierarchy:

```
CONTINENT (largest)
  - Defined by WorldDefinition polygons/bitmap
  - Contains multiple regions
  - Has racial affiliation (Human/Elf/Dwarf)
  - Scale: hundreds of regions per continent

REGION (medium)
  - Fixed-size area, e.g., 8x8 chunks = 256x256 tiles
  - Unit of procedural generation (seeded atomically)
  - Unit of discovery (player discovers entire region)
  - Contains settlements (safe zones) or is wilderness
  - Scale: 5-10 minute walk across

CHUNK (smallest, existing)
  - 32x32 tiles (existing)
  - Unit of streaming to client
  - Unit of rendering (mesh per chunk)
  - Unit of database storage
  - Scale: seconds to walk across
```

**Why 8x8 chunks per region (256x256 tiles):** At MAX_PLAYER_SPEED of 5.0 tiles/sec, a 256-tile region takes ~51 seconds to cross in a straight line. For wilderness regions where 5-10 minute walks between settlements are desired, multiple regions in sequence achieve this. 256x256 is small enough to seed quickly (65K tiles) but large enough to feel like a distinct area. The 8x8 chunk alignment also means region boundaries align with chunk boundaries, preventing partial-chunk seeding complexity.

### World Definition Data Structure

The WorldDefinition is the static "master plan" for the world. It is NOT procedurally generated at runtime -- it is authored (or generated once offline) and shipped as data files.

```typescript
// packages/server/src/world/definition/types.ts

interface WorldDefinition {
  width: number;          // world width in region cells
  height: number;         // world height in region cells
  continents: Continent[];
  settlements: Settlement[];
}

interface Continent {
  id: string;             // "human", "elf", "dwarf"
  name: string;           // "Britannia", "Faerwood", "Khazdum"
  race: "human" | "elf" | "dwarf";
  // Bitmap or polygon defining which region cells belong to this continent
  // Simplest: 2D array where cells[y][x] = continentId or "ocean"
}

interface Settlement {
  id: string;
  name: string;
  continentId: string;
  type: "city" | "town" | "settlement";
  regionX: number;        // which region cell
  regionY: number;
  centerX: number;        // tile position within region
  centerZ: number;
  radius: number;         // safe zone radius in tiles
  race: "human" | "elf" | "dwarf";
}

// Low-resolution grids (one value per region cell)
interface TerrainGrids {
  elevation: Float32Array;   // 0.0 (sea level) to 1.0 (mountain peak)
  moisture: Float32Array;    // 0.0 (arid) to 1.0 (wet)
  temperature: Float32Array; // 0.0 (frozen) to 1.0 (tropical)
  landmask: Uint8Array;      // 0 = ocean, 1 = land, 2 = lake, 3 = river
}
```

**Key decision: Pre-authored vs fully procedural WorldDefinition.** The project requirements state terrain classification is "pre-determined" and "deterministic (pre-set)." This means the WorldDefinition should be authored data, not generated at server boot. This gives control over continental shapes, settlement placement, and the narrative geography. The *detail* (individual tiles, trees, decorations) is what gets procedurally seeded on first exploration.

### Terrain Classification Pipeline

```
For a given region cell (regionX, regionY):

1. Read elevation, moisture, temperature from TerrainGrids
2. Apply biome classification rules:

   elevation > 0.8                    -> MOUNTAIN
   elevation > 0.6 && moisture < 0.3  -> HIGHLAND_ARID
   elevation > 0.6                    -> HIGHLAND_FOREST
   elevation < 0.15                   -> COASTAL
   moisture < 0.2 && temp > 0.6       -> DESERT
   moisture < 0.3                     -> SCRUBLAND
   moisture > 0.7 && temp > 0.5       -> SWAMP
   moisture > 0.6                     -> DENSE_FOREST
   temp < 0.2                         -> TUNDRA
   temp < 0.35                        -> BOREAL_FOREST
   default                            -> TEMPERATE_FOREST

3. Each biome maps to generation rules:
   - Tile palette (which tile IDs to use, with weights)
   - Decoration density (trees per chunk, rocks per chunk)
   - Decoration types (oak vs pine vs palm)
   - Wildlife spawn table (wolves in forests, scorpions in desert)
   - Terrain roughness (how much elevation variation within tiles)
```

### Procedural Seed Generation

**The seed for each region is deterministic**, derived from the region coordinates and a global world seed. This means:

```typescript
function regionSeed(worldSeed: number, regionX: number, regionY: number): number {
  // Deterministic hash combining world seed with region coords
  return hash(worldSeed, regionX, regionY);
}
```

Using this seed, `SeedGenerator` produces identical output no matter when or how many times it runs. This is critical because:

1. If the server restarts mid-seeding, it can re-seed and get the same result
2. Multiple servers (future scaling) would produce identical worlds
3. The world is reproducible from the world seed alone (backup strategy)

**Noise function recommendation: Simplex noise** (or OpenSimplex2). Use it with the region seed to produce tile-level variation within each chunk. The biome classification (from TerrainClassifier) determines the *rules*; the noise determines the *placement*.

```typescript
// Pseudocode for generating one chunk's tile data
function generateChunkTiles(
  regionSeed: number,
  biome: BiomeType,
  chunkX: number,
  chunkY: number
): Uint8Array {
  const noise = createNoise2D(regionSeed);
  const rules = BIOME_RULES[biome];
  const tiles = new Uint8Array(32 * 32);

  for (let z = 0; z < 32; z++) {
    for (let x = 0; x < 32; x++) {
      const worldX = chunkX * 32 + x;
      const worldZ = chunkY * 32 + z;

      // Multi-octave noise for terrain variation
      const n = fbm(noise, worldX, worldZ, octaves=4, lacunarity=2, gain=0.5);

      // Map noise value to tile ID using biome rules
      tiles[z * 32 + x] = rules.tileFromNoise(n);
    }
  }

  return tiles;
}
```

### Region State Machine

```
                   Player enters area
                         |
                         v
  +------------+    +----------+    +---------+    +-----------+
  | UNEXPLORED | -> | SEEDING  | -> | SEEDED  | -> | PERSISTED |
  +------------+    +----------+    +---------+    +-----------+
       |                 |               |               |
   No data in DB    Generating       In memory,      In PostgreSQL
   No chunks exist  tiles + decor    writing to DB    + Redis cache
   No discoverer    Lock held        Chunks available  Fully stable
```

- **UNEXPLORED**: Default state. No region record in DB.
- **SEEDING**: Triggered by first player proximity. Lock prevents concurrent seeding. All chunks for this region are generated atomically.
- **SEEDED**: Generation complete, data written to DB. Chunks are servable. Discovery event fires.
- **PERSISTED**: Identical to SEEDED but emphasizes the data is durable. This is the terminal state.

**Concurrency control**: Use a Redis lock (`SETNX region:lock:{regionId}`) with a TTL (e.g., 30 seconds) to prevent two server threads from seeding the same region simultaneously. If a second player enters while seeding is in progress, they wait (or receive a "generating..." indicator).

### Database Schema Extensions

```sql
-- Region tracking
CREATE TABLE regions (
  id SERIAL PRIMARY KEY,
  region_x INTEGER NOT NULL,
  region_y INTEGER NOT NULL,
  continent_id VARCHAR(50) NOT NULL,
  biome VARCHAR(50) NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'unexplored',
  seed BIGINT NOT NULL,
  discovered_by UUID REFERENCES characters(id),
  discovered_at TIMESTAMPTZ,
  name VARCHAR(100),
  note TEXT,
  wildlife_spawn_data JSONB,
  decoration_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_x, region_y)
);

-- Index for spatial lookups
CREATE INDEX idx_regions_coords ON regions(region_x, region_y);

-- Extend existing chunk_data for compressed binary storage
-- (existing schema already supports this via tileData JSONB,
--  but switch to bytea for efficiency at scale)
```

**Migration path for chunk_data**: The existing `tileData` column uses JSONB (tile IDs as array). For a world with thousands of regions (each containing 64 chunks of 1024 tiles), storing as JSONB is wasteful. Migrate to compressed binary (`bytea` column with zlib-compressed Uint8Array). This reduces storage by ~10x and speeds up reads.

### Redis Caching Strategy

```
Chunk cache:
  Key: chunk:{mapId}:{chunkX}:{chunkY}:{chunkZ}
  Value: compressed tile data (binary)
  TTL: 1 hour (hot chunks near active players)
  Eviction: LRU

Region cache:
  Key: region:{regionX}:{regionY}
  Value: JSON (state, biome, discoverer, name, note)
  TTL: 30 minutes
  Eviction: LRU

Region lock:
  Key: region:lock:{regionX}:{regionY}
  Value: server instance ID
  TTL: 30 seconds (auto-release on crash)
```

**Why Redis for chunks:** The existing game already uses Redis. Chunk data is read-heavy (many clients request the same chunks) and changes never after initial seeding. A Redis cache layer prevents PostgreSQL from becoming a bottleneck when many players cluster in the same area.

### Client-Side Architecture Changes

The existing `ChunkManager` generates chunks locally with `generateChunkData()`. This must change to:

1. **Request chunks from server** instead of generating locally
2. **Cache received chunks** in an IndexedDB or in-memory LRU to avoid re-requesting
3. **Handle async chunk loading** (show placeholder until chunk arrives)
4. **Process region entry events** from the reliable channel

```typescript
// Extended ChunkManager flow:
updatePlayerPosition(worldX, worldZ) {
  const neededChunks = calculateNeededChunks(worldX, worldZ);
  for (const {cx, cy} of neededChunks) {
    if (!this.chunks.has(key) && !this.pendingRequests.has(key)) {
      this.pendingRequests.add(key);
      this.networkManager.requestChunk(mapId, cx, cy);
    }
  }
  // Unload distant chunks (existing logic)
}

onChunkDataReceived(chunkX, chunkY, chunkZ, tileData) {
  this.pendingRequests.delete(key);
  this.loadChunkFromData(chunkX, chunkY, chunkZ, tileData);
  // Optionally cache in IndexedDB for next session
}
```

### New Protocol Messages

```json
{
  "CHUNK_REQUEST": 10,     // existing opcode, now used
  "CHUNK_DATA": 11,        // existing opcode, now used
  "REGION_ENTER": 70,      // new: player entered a region
  "REGION_DISCOVER": 71,   // new: player discovered a region (first explorer)
  "REGION_NOTE_SET": 72,   // new: player set a note on a region
  "REGION_INFO": 73,       // new: server sends region metadata
  "WORLD_MAP_DATA": 80     // new: continental overview for minimap
}
```

The protocol already defines CHUNK_REQUEST (10) and CHUNK_DATA (11) opcodes that are not yet implemented. These should be used for chunk streaming.

**CHUNK_REQUEST format** (client to server, reliable):
```json
{ "op": 10, "mapId": 1, "chunkX": 5, "chunkY": -3 }
```

**CHUNK_DATA format** (server to client, reliable):
Binary: `[opcode:u8][chunkX:i16][chunkY:i16][compressed_length:u16][compressed_tile_data:bytes]`

Using binary for chunk data because each chunk is 1024 bytes uncompressed (32x32 Uint8Array). With simple RLE or zlib, this compresses to 100-400 bytes depending on terrain complexity.

### Wildlife Integration with Existing Spawn System

The existing `spawn-points.ts` is well-designed and should be extended, not replaced. The key change: spawn points are currently hardcoded in `npcs.ts`. For the world system, spawn points are generated by the SeedGenerator as part of region seeding.

```
Region seeded
  -> SeedGenerator produces wildlife spawn table:
     [
       { npcIds: ["wolf", "dire-wolf"], x: 128, z: 45, distance: 12, maxCount: 3, frequency: 10 },
       { npcIds: ["deer", "rabbit"], x: 200, z: 180, distance: 20, maxCount: 5, frequency: 8 },
     ]
  -> WildlifeSpawner stores this in RegionRegistry
  -> When players are near region: activate spawn points (call addSpawnPoint)
  -> When no players near region: deactivate spawn points (call removeSpawnPoint)
     This extends the existing NPC sleep optimization pattern
```

### Decoration System (Static World Objects)

Trees, rocks, and other static decorations are NOT entities in the ECS. They are part of the chunk mesh or instanced geometry. This is critical for performance -- a single region could have hundreds of trees, and making each an ECS entity would overwhelm the system.

```
Decorations are:
  - Generated by SeedGenerator alongside tile data
  - Stored per-chunk as a decoration list: [{type, localX, localZ, rotation, scale}]
  - Rendered on client as instanced meshes (one draw call per decoration type per chunk)
  - NOT collidable for now (walk through trees -- UO style)
  - Persisted in chunk_data.staticEntities (existing column)
```

The existing `chunk_data` table already has a `staticEntities` JSONB column. This is where decoration data goes.

## Patterns to Follow

### Pattern 1: Deterministic Seeding with World Seed

**What:** All procedural generation derives from a single world seed plus spatial coordinates. No randomness.

**When:** Every time terrain, decorations, or wildlife spawn tables are generated.

**Why:** Reproducibility is non-negotiable for a persistent world. If the database is lost, the entire world can be regenerated from the seed. Two servers running the same seed produce identical worlds.

```typescript
import { createNoise2D } from 'open-simplex-noise';

const WORLD_SEED = 42; // stored in config, never changes

function deterministicRandom(seed: number, x: number, y: number): number {
  // Simple hash-based PRNG seeded by coordinates
  let h = seed;
  h = Math.imul(h ^ (x * 374761393), 668265263);
  h = Math.imul(h ^ (y * 2654435761), 2246822519);
  h = (h ^ (h >>> 13)) >>> 0;
  return h / 4294967296; // 0.0 to 1.0
}
```

### Pattern 2: Region-Atomic Generation

**What:** When a region is seeded, ALL chunks in that region are generated in a single batch operation. No partial regions.

**When:** First player enters any chunk belonging to an unexplored region.

**Why:** Biome transitions, river paths, and decoration patterns span multiple chunks. Generating one chunk at a time would create visible seams and inconsistencies at chunk boundaries within a region.

```typescript
async function seedRegion(regionX: number, regionY: number): Promise<void> {
  const lock = await acquireRegionLock(regionX, regionY);
  if (!lock) return; // another process is seeding

  try {
    const biome = terrainClassifier.classify(regionX, regionY);
    const seed = regionSeed(WORLD_SEED, regionX, regionY);

    // Generate ALL chunks for this region (e.g., 8x8 = 64 chunks)
    const chunks: ChunkData[] = [];
    const decorations: DecorationData[] = [];

    for (let cy = 0; cy < REGION_SIZE_CHUNKS; cy++) {
      for (let cx = 0; cx < REGION_SIZE_CHUNKS; cx++) {
        const absChunkX = regionX * REGION_SIZE_CHUNKS + cx;
        const absChunkY = regionY * REGION_SIZE_CHUNKS + cy;
        const tiles = generateChunkTiles(seed, biome, absChunkX, absChunkY);
        const decor = generateDecorations(seed, biome, absChunkX, absChunkY);
        chunks.push({ chunkX: absChunkX, chunkY: absChunkY, tiles });
        decorations.push({ chunkX: absChunkX, chunkY: absChunkY, items: decor });
      }
    }

    // Batch write to database
    await chunkStore.batchInsert(chunks);
    await regionRegistry.markSeeded(regionX, regionY, biome, decorations);

  } finally {
    await releaseRegionLock(regionX, regionY);
  }
}
```

### Pattern 3: Extend, Don't Replace Existing Systems

**What:** New world systems wrap and extend existing code. The existing spawn system, entity store, chunk manager, and zone system remain intact.

**When:** Every integration point between new world code and existing game code.

**Why:** The existing systems are tested and working. The project constraint is "expand, don't replace." New world features should feel like plugins to the existing architecture.

```
Existing zones.ts     -> SafeZoneRegistry loads zones from WorldDefinition
Existing spawn-points.ts -> WildlifeSpawner creates spawn points per region
Existing ChunkManager -> Extended to request chunks from server
Existing protocol.ts  -> New opcodes added, same pack/unpack pattern
Existing EntityStore  -> No changes needed, wildlife entities use same format
```

### Pattern 4: Sleep Optimization at Region Level

**What:** Regions with no nearby players are "asleep." Wildlife spawn points are deactivated. No server ticks are spent on dormant regions.

**When:** Region has no players within a configurable radius (e.g., 2 regions away).

**Why:** A world with thousands of regions cannot tick all wildlife simultaneously. The existing NPC sleep pattern (only tick if player within 32 tiles) already demonstrates this. Extend it to region granularity.

```typescript
// In the game loop, alongside existing tickWandering():
function tickRegions() {
  const activeRegions = getRegionsNearPlayers(REGION_ACTIVE_RADIUS);

  for (const region of activeRegions) {
    if (!region.spawnsActive) {
      wildlifeSpawner.activateRegion(region.id);
      region.spawnsActive = true;
    }
  }

  for (const region of previouslyActiveRegions) {
    if (!activeRegions.has(region.id)) {
      wildlifeSpawner.deactivateRegion(region.id);
      region.spawnsActive = false;
    }
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side World Generation

**What:** Generating tile data on the client (as the current `ChunkManager.generateChunkData()` does).

**Why bad:** Different clients could see different terrain if generation code diverges. Server cannot enforce terrain rules (walkability, safe zones). Cheaters could modify terrain locally. Breaks the "server-authoritative" constraint.

**Instead:** Server generates all tile data. Client only renders what the server sends. The existing `loadChunkFromData()` method is the correct approach.

### Anti-Pattern 2: Per-Chunk Procedural Generation

**What:** Generating chunks individually as players request them.

**Why bad:** Features that span chunk boundaries (rivers, roads, biome transitions, large decorations) will have visible seams. Two adjacent chunks generated at different times may not agree on shared edges.

**Instead:** Generate entire regions atomically (Pattern 2). All chunks in a region are produced in one pass, ensuring cross-chunk consistency.

### Anti-Pattern 3: Storing Full Tile Data in JSONB

**What:** Using PostgreSQL JSONB for tile arrays (the current schema's approach).

**Why bad:** A 32x32 chunk stored as JSON array `[1,1,1,2,3,1,...]` is ~3-5KB per chunk. With 64 chunks per region and thousands of regions, this is 200KB-320KB per region, or hundreds of megabytes for a full world. JSONB also has parsing overhead on read.

**Instead:** Store as compressed binary (`bytea` column). A Uint8Array of 1024 bytes compresses to 100-400 bytes with zlib. 10x storage reduction, faster reads, faster writes.

### Anti-Pattern 4: Eager World Seeding

**What:** Seeding all regions at server boot or during world creation.

**Why bad:** A world with 10,000 regions, each producing 64 chunks of 1024 tiles, is 640 million tiles to generate. This could take minutes to hours and consumes massive database storage for regions no player may visit for weeks.

**Instead:** Lazy seeding on first player proximity (the project's stated design). Only seed regions that players actually explore. This also creates the meaningful "discovery" moment.

### Anti-Pattern 5: Decorations as ECS Entities

**What:** Creating an ECS entity for every tree, rock, and bush in the world.

**Why bad:** A forest region could have 500+ trees. Each as an ECS entity means 500 entries in EntityManager, 500 spatial grid updates, 500 network spawn messages. This crushes both server and client performance.

**Instead:** Decorations are static mesh data baked into chunk rendering. Use instanced rendering on the client (one mesh template per decoration type, rendered at multiple positions with a single draw call).

## Scalability Considerations

| Concern | 10 Players | 100 Players | 1000 Players |
|---------|------------|-------------|--------------|
| **Active regions** | 5-10 | 30-80 | 100-400 |
| **Seeded regions in DB** | 20-50 | 200-500 | 1000-3000 |
| **Wildlife entities** | 50-100 | 300-800 | 1000-4000 |
| **Chunk cache (Redis)** | 500 chunks, ~200KB | 5000 chunks, ~2MB | 30K chunks, ~12MB |
| **DB chunk storage** | 3K chunks, ~1.2MB | 30K chunks, ~12MB | 200K chunks, ~80MB |
| **Seeding frequency** | Rare (1-2/min) | Moderate (5-10/min) | Burst-y (20-50/min on launch) |
| **Position broadcasts** | O(n^2) fine at 10 | O(n^2) visible, use spatial filtering | Need spatial partitioning |

**Key bottleneck at scale: Position broadcasts.** The current `broadcastPositions()` iterates all entities for every connection (O(n*m) where n=connections, m=entities). At 1000 players, this must use spatial indexing on the server side (similar to the client's spatial grid). This is an existing architectural concern, not new to the world system.

**Database write bursts:** When a new server launches or a large group of players explores new territory, many regions may need seeding simultaneously. Solution: queue seeding requests and process them with a bounded worker pool (e.g., max 5 concurrent region seeds). Players in the queue see a brief loading indicator.

## Suggested Build Order

Build order is driven by dependencies. Each phase should be independently testable.

### Phase 1: World Definition + Terrain Classification (Foundation)

**Must come first** because every other system depends on knowing "what biome is at this location."

- Create WorldDefinition data format and loader
- Create TerrainClassifier (elevation + moisture + temperature -> biome)
- Author initial world map data (3 continents, ocean, settlements)
- Extend SafeZoneRegistry to load from WorldDefinition
- **Testable:** Unit tests for terrain classification. Visual tool to preview world map.

### Phase 2: Server-Side Chunk Generation + Streaming (Core Pipeline)

**Depends on Phase 1** (needs biome data). **Unblocks Phase 3-5.**

- Implement SeedGenerator with deterministic noise-based tile generation
- Implement ChunkStore with PostgreSQL persistence + Redis cache
- Implement ChunkStreamer (server sends chunks to clients via reliable channel)
- Modify client ChunkManager to request chunks from server instead of generating locally
- Wire up CHUNK_REQUEST/CHUNK_DATA protocol messages
- Migrate chunk_data storage from JSONB to compressed binary
- **Testable:** Player loads into world, sees server-generated terrain. Different biomes produce visually distinct tiles.

### Phase 3: Region System + Discovery (Core Gameplay)

**Depends on Phase 2** (needs chunk generation). **Unblocks Phase 4-5.**

- Implement RegionRegistry (DB table, state machine, locking)
- Implement region-atomic generation (seed all chunks in region at once)
- Implement RegionNotifier (region entry/exit events)
- Implement procedural name generation for regions
- Implement discovery tracking (first explorer attribution)
- Implement player notes on regions
- Client UI for region entry banner
- **Testable:** Player walks into unexplored area, sees "You discovered [Region Name]" banner. Region is persisted. Second player entering sees discoverer's name.

### Phase 4: Decorations + Visual Detail (Polish)

**Depends on Phase 2** (needs chunk data pipeline). **Independent of Phase 3.**

- Extend SeedGenerator to produce decoration placement data
- Implement client-side instanced rendering for decorations
- Create decoration types per biome (trees, rocks, bushes, flowers)
- Store decoration data in chunk_data.staticEntities
- Extend TileRegistry with new biome-specific tile types
- **Testable:** Forests have trees, deserts have cacti, mountains have boulders. Decorations are consistent across sessions.

### Phase 5: Wildlife + Region-Aware Spawning (Gameplay)

**Depends on Phase 3** (needs region seeding and lifecycle). Extends Phase 1's spawn system.

- Implement WildlifeSpawner (creates spawn points from region seed data)
- Create wildlife NPC templates per biome (wolves, bears, deer, etc.)
- Implement region-level sleep optimization (activate/deactivate spawns)
- Extend existing spawn-points.ts with dynamic add/remove
- **Testable:** Exploring a forest region spawns wolves. Leaving the area despawns them. Returning re-activates them.

### Phase 6: PvP Flagging + Safe Zones (Rules)

**Depends on Phase 1** (needs safe zone data from settlements). **Independent of Phases 3-5.**

- Implement criminal flagging system
- Enforce safe zone PvP restrictions
- Integrate with existing combat system
- Region-aware PvP rules (e.g., guard zones in settlements)
- **Testable:** Attack another player outside safe zone, receive criminal flag. Cannot attack inside safe zone.

### Phase 7: Continental Geography + Water (World Shape)

**Depends on Phase 2** (needs chunk generation for water tiles). Can run parallel with Phases 3-5.

- Implement ocean tile generation between continents
- Implement rivers and lakes within continents
- Implement coastline generation (beach biome transition)
- Movement blocking for water tiles (existing walkable=false in TileRegistry)
- **Testable:** Continents are separated by ocean. Rivers flow through terrain. Players cannot walk into water.

### Dependency Graph

```
Phase 1 (World Definition)
  |
  +-> Phase 2 (Chunk Generation + Streaming)
  |     |
  |     +-> Phase 3 (Region System + Discovery)
  |     |     |
  |     |     +-> Phase 5 (Wildlife)
  |     |
  |     +-> Phase 4 (Decorations) [parallel with 3]
  |     |
  |     +-> Phase 7 (Water/Geography) [parallel with 3-5]
  |
  +-> Phase 6 (PvP + Safe Zones) [parallel with 2-5]
```

## Sources

- Codebase analysis: `packages/client/src/world/`, `packages/server/src/game/`, `packages/server/src/db/schema.ts`
- Project requirements: `.planning/PROJECT.md`
- Architecture baseline: `.planning/codebase/ARCHITECTURE.md`
- Domain knowledge: Procedural generation patterns (simplex noise, deterministic seeding, hierarchical spatial organization) -- MEDIUM confidence, from training data, not verified with current sources
- Redis locking patterns -- MEDIUM confidence, well-established pattern but specifics unverified
- Babylon.js instanced rendering -- MEDIUM confidence, capability exists in Babylon.js but API specifics should be verified against current docs during implementation

**Note:** Web search was unavailable during this research. All procedural generation and MMO architecture recommendations are based on training data and established patterns. Verify noise library choices (open-simplex-noise vs alternatives) and Babylon.js instancing APIs against current documentation before implementation.
