# Phase 2: Terrain Classification & Biomes - Research

**Researched:** 2026-03-19
**Domain:** Procedural terrain rendering, movement blocking, river generation, isometric stepped elevation
**Confidence:** HIGH

## Summary

Phase 2 transforms the Phase 1 world map data layer (16 BiomeType values stored in typed arrays) into visible, interactive terrain on the client, and enforces movement rules on the server. The work spans four domains: (1) replacing the legacy 7-tile system with 16 biome-based tiles, (2) generating rivers/lakes as blocking water features in the world data, (3) adding server-side position validation that rejects moves into impassable tiles, and (4) rendering elevation as stepped terrain with cliff faces in Babylon.js.

The existing codebase provides strong foundations. The server's `WorldMap` already has `biomeMap` (Uint8Array), `elevation` (Float32Array), `landmask`, `moisture`, and `temperature` at chunk granularity (900x900). The `queries.ts` module offers O(1) lookups. The client's `TileRegistry` + `Chunk.ts` mesh-building pattern is extensible. The main technical challenges are: (a) a river tracing algorithm that produces variable-width drainage paths on a grid, (b) generating cliff face geometry between elevation bands in the chunk renderer, and (c) inserting movement validation into the server's position-update handler without adding latency to the 20Hz tick.

**Primary recommendation:** Work server-side first (tile walkability lookup, river/lake generation, movement blocking), then client-side (new tile registry, elevation stepping, cliff meshes). No new dependencies needed -- all work uses existing libraries (simplex-noise, alea, Babylon.js MeshBuilder).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rivers use **traced drainage paths** -- flow from high elevation to low, following natural terrain to coast or lakes
- Lakes form in **elevation basins** -- low-elevation areas surrounded by higher terrain
- All water is **fully blocking** -- players must walk around rivers and lakes. No wading, no crossing. Bridges/fords are a future addition.
- Major rivers have **variable width (1-8 tiles)** -- narrow at mountain source, widening toward coast/lake terminus
- **Binary walk/block** -- tiles are either fully walkable or fully impassable, no speed modifiers
- **Blocking terrain types**: deep ocean, shallow ocean, lakes, rivers, mountain peaks (SNOW_PEAK), and cliff edges
- Walkable terrain: forests, desert, swamp, tundra, grassland, highland, meadow, scrubland, beach, boreal forest, river valley (ground near rivers, not the water itself)
- **Silent rejection** on client -- player simply doesn't move into blocked tiles, no animation or message. Server rejects invalid positions.
- **NPCs respect same rules** -- wander AI avoids blocked tiles. Consistent world physics for all entities.
- **Grouped tiles with transition support** -- architecture supports base tiles per biome plus transition tiles at biome boundaries
- **Flat colored tiles for now** -- each biome gets a distinct color. Visual skinning/textures deferred to later
- **Hard edges** at biome boundaries -- no color blending or gradient transitions between adjacent biome tiles
- **Replace legacy tile system** -- the old 7 tiles (void, grass, dirt, stone, water, sand, wood) are replaced entirely. The 16 BiomeType values become the new tile type foundation.
- Transition tiles exist in the data model but render as hard edges until skinned
- **Stepped terrain at 6-8 discrete height levels** -- tiles render at quantized Y positions based on elevation bands from the world map data
- **Vertical cliff faces** between elevation steps -- clean terraced/plateau aesthetic, classic isometric RPG style
- Each elevation band is a flat plateau with vertical drops at transitions
- Height data already exists (Float32Array from Phase 1) -- this phase quantizes it into discrete rendering bands
- Biome color + elevation stepping together convey terrain character (grey tile at high Y = mountain, green tile at low Y = valley)

### Claude's Discretion
- Exact elevation band thresholds (how elevation float maps to 6-8 discrete levels)
- River tracing algorithm specifics (drainage accumulation approach)
- Cliff face mesh generation technique
- Transition tile ID scheme and data encoding
- Chunk mesh rebuilding strategy for stepped heights
- Lake minimum size and placement density

### Deferred Ideas (OUT OF SCOPE)
- Biome atmosphere effects (heat shimmer, forest shadows, swamp fog) -- Phase 9
- Server-side chunk streaming to replace client generation -- Phase 3
- Bridges and fords across rivers -- future phase
- Texture/skin pass for tile visuals -- future phase
- Smooth terrain slopes between elevation bands -- possible future polish
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORLD-02 | Terrain biome classification system expands tile types from 7 to 15-20 | BiomeType enum (16 values) already exists from Phase 1. New TileRegistry maps each BiomeType to color + walkable flag. Tile data at chunk level uses biome values directly. |
| WORLD-03 | Water bodies (ocean, rivers, lakes) exist as impassable terrain | River tracing + lake basin detection algorithms in worldgen pipeline. New RIVER BiomeType or water overlay on biomeMap. Landmask already has DEEP_OCEAN/SHALLOW_OCEAN/LAKE. |
| WORLD-05 | Movement blocking based on terrain type prevents player traversal | Server-side walkability lookup using biomeMap + isWalkable() function. Validation in rtc.ts position handler and spawn-points.ts wander logic. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| simplex-noise | ^4.0.3 | Noise generation for river/lake algorithms | Already used in Phase 1 worldgen |
| alea | ^1.0.1 | Seedable PRNG for deterministic generation | Already used in Phase 1 worldgen |
| @babylonjs/core | ^7.0.0 | Client rendering (MeshBuilder, StandardMaterial) | Already used for all rendering |
| vitest | ^4.1.0 | Testing framework for server and client | Already configured in both packages |

### No New Dependencies Needed

This phase requires zero new npm packages. All work uses existing libraries:
- River tracing: custom algorithm using existing `elevation` Float32Array + alea PRNG
- Lake detection: custom algorithm scanning `elevation` basins
- Tile rendering: Babylon.js `MeshBuilder.CreateGround` + `MeshBuilder.CreateBox` (already imported)
- Elevation stepping: Math on existing Float32Array data
- Movement blocking: Pure TypeScript logic on existing typed arrays

## Architecture Patterns

### Recommended Project Structure
```
packages/server/src/world/
  types.ts               # ADD: RIVER BiomeType (value 16), WalkableMap type
  biomes.ts              # EXTEND: river/lake classification post-processing
  rivers.ts              # NEW: river tracing + lake basin detection
  terrain.ts             # NEW: walkability lookup, elevation banding
  constants.ts           # EXTEND: elevation band thresholds, river params
  worldgen.ts            # EXTEND: insert river/lake pass after biome classification

packages/client/src/world/
  TileRegistry.ts        # REWRITE: 16+ biome tile definitions with colors + walkable
  Chunk.ts               # REWRITE: elevation-stepped mesh building, cliff faces
  ChunkManager.ts        # EXTEND: pass elevation data to chunks
  TerrainColors.ts       # NEW: biome color palette (single source of truth)

packages/server/src/game/
  spawn-points.ts        # EXTEND: add walkability check before NPC wander move

packages/server/src/routes/
  rtc.ts                 # EXTEND: validate position updates against walkability map
```

### Pattern 1: Walkability Lookup (O(1) per tile)
**What:** A function that takes world-tile coordinates and returns whether the tile is walkable, using the existing biomeMap at chunk granularity.
**When to use:** Server-side position validation (rtc.ts), NPC wander checks (spawn-points.ts), client-side pre-validation.
**Example:**
```typescript
// packages/server/src/world/terrain.ts
import { getWorldMap } from "./queries.js";
import { BiomeType } from "./types.js";

// Biomes that block movement
const BLOCKING_BIOMES = new Set<BiomeType>([
  BiomeType.DEEP_OCEAN,
  BiomeType.SHALLOW_OCEAN,
  BiomeType.SNOW_PEAK,
  // BiomeType.RIVER -- added after river generation
  // BiomeType.LAKE -- already in landmask but needs biomeMap entry
]);

/**
 * Check if a world-tile position is walkable.
 * Converts tile coordinates to chunk coordinates for biomeMap lookup.
 * Returns false for out-of-bounds positions.
 */
export function isWalkable(tileX: number, tileZ: number): boolean {
  const world = getWorldMap();
  if (!world) return false;

  // Convert tile coordinates to chunk coordinates
  // World is 900x900 chunks, each 32x32 tiles
  // Tile (tx, tz) is in chunk (floor(tx/32), floor(tz/32))
  const chunkX = Math.floor(tileX / 32);
  const chunkZ = Math.floor(tileZ / 32);

  if (chunkX < 0 || chunkX >= world.width || chunkZ < 0 || chunkZ >= world.height) {
    return false; // Out of world bounds
  }

  const biome = world.biomeMap[chunkZ * world.width + chunkX] as BiomeType;
  return !BLOCKING_BIOMES.has(biome);
}
```

**Key insight:** The world map biomeMap operates at chunk granularity (1 value per 32x32 tile chunk). For Phase 2, this means all 1024 tiles in a chunk share the same biome/walkability. This is acceptable because rivers and terrain features are world-scale (measured in chunks, not tiles). Sub-chunk tile variation comes in Phase 3/4 when server-side chunk generation produces per-tile data. For now, the chunk-level biome is sufficient for movement blocking because the player moves at 5 tiles/sec and chunks are 32 tiles wide -- the blocking granularity is appropriate for rivers (1-8 chunks wide) and ocean boundaries.

### Pattern 2: Elevation Banding (Quantization)
**What:** Convert continuous elevation float (0.0-1.0) to discrete rendering height levels.
**When to use:** Client-side chunk mesh building for stepped terrain.
**Recommended: 7 elevation bands:**

```typescript
// packages/server/src/world/terrain.ts (also shared to client)

// Elevation band thresholds (0.0-1.0 input range)
// Land elevation ranges from ~0.3 to 1.0 (due to +0.3 boost in Phase 1)
// Ocean elevation ranges from 0.0 to ~0.3
export const ELEVATION_BANDS = [
  { min: 0.00, max: 0.15, level: 0, name: "deep_water" },   // Deep ocean floor
  { min: 0.15, max: 0.30, level: 1, name: "shallow_water" }, // Shallow ocean/coast
  { min: 0.30, max: 0.45, level: 2, name: "lowland" },       // Beach, swamp, low valleys
  { min: 0.45, max: 0.60, level: 3, name: "plains" },        // Grassland, forest floor
  { min: 0.60, max: 0.75, level: 4, name: "highland" },      // Hills, highland
  { min: 0.75, max: 0.90, level: 5, name: "mountain" },      // Mountain slopes
  { min: 0.90, max: 1.00, level: 6, name: "peak" },          // Snow peaks, summits
];

export const ELEVATION_STEP_HEIGHT = 1.5; // World units per elevation level

export function getElevationBand(elevation: number): number {
  for (const band of ELEVATION_BANDS) {
    if (elevation < band.max) return band.level;
  }
  return ELEVATION_BANDS.length - 1;
}
```

### Pattern 3: River Tracing via Downhill Flow
**What:** Trace rivers from high-elevation source points downhill to ocean or lake basins.
**When to use:** During world generation, after biome classification.
**Algorithm:**

```typescript
// packages/server/src/world/rivers.ts
// Simplified drainage path algorithm:
//
// 1. Find river source candidates: high-elevation land chunks (elevation > 0.8)
//    with high moisture (> 0.5), seeded deterministically from world seed
//
// 2. For each source, trace downhill:
//    a. Look at 4 cardinal neighbors
//    b. Move to the neighbor with the lowest elevation
//    c. Mark the current chunk as RIVER in biomeMap
//    d. Track accumulated flow (increments at each step)
//    e. River width = clamp(1, floor(flowAccumulation / widthFactor), 8)
//    f. When width > 1, mark adjacent chunks perpendicular to flow direction
//    g. Stop when reaching ocean (landmask < LAND) or a lake, or if stuck
//
// 3. Lake detection:
//    a. Find elevation basins: chunks where all 4 neighbors have higher elevation
//    b. Flood-fill from basin center up to a threshold (basin rim elevation)
//    c. Mark flooded area as LAKE in biomeMap
//    d. Minimum lake size: 4 chunks (to avoid single-chunk puddles)
//
// 4. Post-processing:
//    a. Mark chunks adjacent to rivers as RIVER_VALLEY (walkable ground near water)
//    b. Ensure rivers connect to ocean or lakes (no dangling ends)
```

### Pattern 4: Cliff Face Mesh Generation
**What:** Render vertical faces between tiles at different elevation levels.
**When to use:** Client chunk mesh building when adjacent tiles have different elevation bands.
**Technique:** Use `MeshBuilder.CreatePlane` or custom vertex data for vertical faces on chunk edges where elevation changes.

```typescript
// In Chunk.ts buildMesh():
// For each tile, check its 4 cardinal neighbors' elevation bands.
// If neighbor is lower, create a vertical face on that edge.
//
// Face dimensions:
// - Width: TILE_SIZE (1.0)
// - Height: (myLevel - neighborLevel) * ELEVATION_STEP_HEIGHT
// - Position: tile edge, centered vertically between the two levels
//
// The face uses a cliff color (darker version of tile's biome color)
// or a dedicated cliff material (grey stone).
//
// For Babylon.js, creating individual planes per cliff face and
// merging them into the chunk mesh via Mesh.MergeMeshes is the pattern
// already established by the existing Chunk.ts code.
```

### Anti-Patterns to Avoid
- **Per-tile-position walkability check on every frame:** Only check walkability when a move is initiated, not every tick. The current movement system already has discrete tile-to-tile moves.
- **Smooth height interpolation on client:** The decision is stepped terrain. Do not lerp between elevation bands -- quantize to discrete levels and render hard plateaus.
- **Modifying biomeMap in-place during river tracing:** Create a separate riverMap or copy of biomeMap to avoid corrupting the base biome data. Rivers overlay biomes; they don't replace the underlying biome classification.
- **Bare `@babylonjs/core` imports:** Always use deep imports (`@babylonjs/core/Meshes/meshBuilder`). Note: `ChunkManager.ts` line 1 currently has a bare import that should be fixed.
- **Generating rivers at chunk-load time:** Rivers must be generated once during world generation (deterministic from seed), not per-chunk on demand. The entire river network must be coherent across the world.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Noise generation | Custom Perlin/simplex | `simplex-noise` (already installed) | Correctness, performance, well-tested |
| Seedable PRNG | `Math.random()` wrapper | `alea` (already installed) | Determinism guarantee, proven library |
| Mesh merging | Manual vertex buffer management | `Mesh.MergeMeshes()` from Babylon.js | Already proven in Chunk.ts, handles normals/UVs/indices |
| Spatial lookups | Iterating all entities | `entityStore.getNearbyEntities()` | Already built with spatial grid in entities.ts |

**Key insight:** No new libraries needed. The existing simplex-noise + alea handle all procedural generation. Babylon.js MeshBuilder handles all mesh creation. The main work is algorithmic (river tracing, elevation banding) not library integration.

## Common Pitfalls

### Pitfall 1: Chunk-vs-Tile Coordinate Confusion
**What goes wrong:** The world map operates at chunk granularity (900x900 chunks), but players and entities move at tile granularity (28,800x28,800 tiles). Confusing these coordinate systems causes off-by-32x errors.
**Why it happens:** Both systems use (x, z) coordinates. Functions like `getBiomeForChunk()` expect chunk coords, but entity positions are in tile coords.
**How to avoid:** Always have explicit conversion functions:
```typescript
function tileToChunk(tileX: number): number { return Math.floor(tileX / CHUNK_SIZE); }
function chunkToTile(chunkX: number): number { return chunkX * CHUNK_SIZE; }
```
**Warning signs:** Entities falling through terrain, walkability checks passing for ocean tiles, rivers appearing in wrong locations.

### Pitfall 2: River Generation Infinite Loops
**What goes wrong:** A river trace gets stuck in a local minimum where all neighbors have equal or higher elevation, creating an infinite loop.
**Why it happens:** Flat terrain or noise artifacts can create elevation plateaus.
**How to avoid:** Add a visited-set and max-step limit to the river tracer. If stuck (no lower neighbor), flood-fill a small lake and continue from the lake's lowest unvisited rim point, or terminate.
**Warning signs:** World generation hangs or takes >5 seconds.

### Pitfall 3: Chunk Mesh Performance with Cliff Faces
**What goes wrong:** Adding cliff face meshes triples the polygon count, causing frame drops when many chunks are visible.
**Why it happens:** Each elevation transition creates 1+ additional faces per tile edge. With CHUNK_LOAD_RADIUS=3 (49 chunks), this adds up fast.
**How to avoid:** Merge all cliff faces into the chunk mesh (already the pattern). Use a single shared material for cliff faces across all chunks. Consider InstancedMesh or thin instances for repeated cliff geometries if performance is an issue.
**Warning signs:** Frame rate drops below 30fps when looking at mountainous terrain.

### Pitfall 4: Inconsistent Walkability Between Client and Server
**What goes wrong:** Client allows a move that the server rejects (or vice versa), causing rubber-banding.
**Why it happens:** Client and server use different data to determine walkability. Currently the client generates chunks locally with different data than the server's worldMap.
**How to avoid:** The walkability source of truth must be the server's biomeMap. For Phase 2, the client can do optimistic prediction using the same biome data (shared via chunk data), but the server is authoritative. The key is that both use the same BLOCKING_BIOMES set. Export the walkability rules from shared code.
**Warning signs:** Player position snaps back after moving into what looks walkable on screen.

### Pitfall 5: Elevation Data Granularity Mismatch
**What goes wrong:** Elevation is per-chunk (32x32 tiles) but needs to be per-tile for smooth stepped terrain within a chunk.
**Why it happens:** Phase 1 stores one elevation value per chunk, not per tile. All 32x32 tiles in a chunk would be at the same height.
**How to avoid:** For Phase 2, use the chunk-level elevation for the entire chunk's height. This means each chunk is a single flat plateau at its quantized elevation band. Cliff faces appear at chunk boundaries where adjacent chunks have different elevation bands. Per-tile elevation variation within a chunk would come with server-side chunk generation in Phase 3. This is consistent with the "stepped terrain" decision -- entire chunks are plateaus.
**Warning signs:** Terrain looks like a blocky heightmap with 32x32 tile steps -- which is actually the correct look for this phase.

### Pitfall 6: River Width Perpendicular to Flow Direction
**What goes wrong:** Wide rivers (width > 1 chunk) expand in the wrong direction, creating blobs instead of elongated rivers.
**Why it happens:** The width expansion must be perpendicular to the flow direction, but the flow direction changes at each step.
**How to avoid:** Track the flow direction (dx, dz from previous step) and expand the river marking perpendicular to it. For a river flowing in the +X direction, expand in the Z direction. For diagonal flow, expand in both perpendicular axes.
**Warning signs:** Wide river sections appear as square blobs rather than elongated channels.

## Code Examples

### Biome Tile Registration (replacing legacy 7 tiles)
```typescript
// packages/client/src/world/TileRegistry.ts
import { Color3 } from "@babylonjs/core/Maths/math.color";

export interface TileType {
  id: number;        // Maps to BiomeType enum value
  name: string;
  color: Color3;
  walkable: boolean;
  elevation?: string; // Hint for rendering (not used for logic)
}

// Colors chosen for visual distinctness at flat-color rendering
const TILE_TYPES: TileType[] = [
  { id: 0,  name: "deep_ocean",         color: new Color3(0.05, 0.10, 0.30), walkable: false },
  { id: 1,  name: "shallow_ocean",      color: new Color3(0.10, 0.20, 0.45), walkable: false },
  { id: 2,  name: "beach",              color: new Color3(0.76, 0.70, 0.50), walkable: true },
  { id: 3,  name: "temperate_grassland", color: new Color3(0.30, 0.50, 0.20), walkable: true },
  { id: 4,  name: "temperate_forest",   color: new Color3(0.15, 0.40, 0.15), walkable: true },
  { id: 5,  name: "dense_forest",       color: new Color3(0.08, 0.28, 0.08), walkable: true },
  { id: 6,  name: "boreal_forest",      color: new Color3(0.12, 0.30, 0.18), walkable: true },
  { id: 7,  name: "mountain",           color: new Color3(0.45, 0.42, 0.40), walkable: true },
  { id: 8,  name: "snow_peak",          color: new Color3(0.90, 0.90, 0.92), walkable: false },
  { id: 9,  name: "tundra",             color: new Color3(0.55, 0.58, 0.50), walkable: true },
  { id: 10, name: "desert",             color: new Color3(0.78, 0.68, 0.40), walkable: true },
  { id: 11, name: "scrubland",          color: new Color3(0.55, 0.50, 0.30), walkable: true },
  { id: 12, name: "swamp",              color: new Color3(0.25, 0.30, 0.15), walkable: true },
  { id: 13, name: "highland",           color: new Color3(0.40, 0.45, 0.30), walkable: true },
  { id: 14, name: "meadow",             color: new Color3(0.40, 0.55, 0.25), walkable: true },
  { id: 15, name: "river_valley",       color: new Color3(0.30, 0.42, 0.20), walkable: true },
  // New types added by Phase 2:
  { id: 16, name: "river",              color: new Color3(0.15, 0.25, 0.50), walkable: false },
  { id: 17, name: "lake",               color: new Color3(0.12, 0.22, 0.48), walkable: false },
];
```

### Server-Side Position Validation
```typescript
// In packages/server/src/routes/rtc.ts, position channel handler:
positionChannel.onMessage.subscribe((msg: Buffer) => {
  if (msg.length >= 24) {
    const newX = msg.readFloatLE(8);
    entity.y = msg.readFloatLE(12);
    const newZ = msg.readFloatLE(16);
    entity.rotation = msg.readFloatLE(20);
    entity.lastUpdate = Date.now();

    // Phase 2: Validate movement against terrain
    if (isWalkable(Math.round(newX), Math.round(newZ))) {
      entityStore.updatePosition(entityId, newX, newZ);
    }
    // Silent rejection: just don't update position. Client will correct.
  }
});
```

### NPC Wander with Terrain Check
```typescript
// In packages/server/src/game/spawn-points.ts tickWandering():
// Before moving NPC, check target tile walkability:
const targetX = Math.round(point.x + Math.cos(angle) * dist);
const targetZ = Math.round(point.z + Math.sin(angle) * dist);

// Phase 2: Check walkability before moving
if (!isWalkable(targetX, targetZ)) continue;

// Then proceed with existing move logic...
```

### Stepped Elevation Chunk Rendering
```typescript
// In Chunk.ts buildMesh(), modify tile Y position:
// elevationLevel comes from the chunk's world-map elevation data
const tileY = elevationLevel * ELEVATION_STEP_HEIGHT;

tile.position.x = worldX + pos.x * TILE_SIZE + TILE_SIZE / 2;
tile.position.z = worldZ + pos.z * TILE_SIZE + TILE_SIZE / 2;
tile.position.y = tileY; // Was: this.chunkZ * 3 (hardcoded)

// For cliff faces at chunk edges:
// Check neighboring chunk's elevation level
// If different, create a vertical plane on that edge
if (neighborElevationLevel < elevationLevel) {
  const cliffHeight = (elevationLevel - neighborElevationLevel) * ELEVATION_STEP_HEIGHT;
  const cliff = MeshBuilder.CreatePlane("cliff", {
    width: TILE_SIZE,
    height: cliffHeight
  }, scene);
  // Position at edge between this tile and lower neighbor
  // Add to meshes array for merge
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 7 hardcoded tile types | 16 BiomeType enum values from Phase 1 | Phase 1 (completed) | Direct mapping to new tile registry |
| Client-side procedural chunks | Chunk data from worldMap biomeMap | Phase 2 (this phase) | Terrain matches world map |
| No movement validation | Server-side walkability checks | Phase 2 (this phase) | Prevents walking through water/mountains |
| Flat terrain (Y=0 for all tiles) | Stepped elevation (7 levels) | Phase 2 (this phase) | Visual depth and terrain character |

**Important context on coordinate systems:**
- World map: 900x900 **chunks**, each value represents a 32x32 tile area
- Entities: positions in **tile** coordinates (0-28,799 range)
- Chunk key: `mapId:chunkX:chunkY:chunkZ` where chunkZ was previously always 0
- The existing `chunkZ` in Chunk.ts is NOT elevation -- it's a vertical layer index. Phase 2 uses the world map elevation data for height, mapped through the elevation banding function.

## Open Questions

1. **Sub-chunk tile variation within same-biome chunks**
   - What we know: Phase 1 biomeMap is per-chunk (one biome per 32x32 tiles). Phase 3 adds server-side chunk generation with per-tile data.
   - What's unclear: Should Phase 2 generate any per-tile variation (e.g., slight color noise), or should every tile in a chunk be identical?
   - Recommendation: Keep tiles uniform per chunk for Phase 2. Per-tile variation is Phase 3/4 scope. This simplifies the mesh building and avoids duplicating work.

2. **River data storage: overlay vs new BiomeType values**
   - What we know: BiomeType enum goes 0-15. Rivers need representation in biomeMap.
   - What's unclear: Should rivers be a new BiomeType (16, 17) extending the enum, or a separate overlay array (riverMap: Uint8Array)?
   - Recommendation: Add RIVER=16 and LAKE=17 to BiomeType enum. This keeps the walkability check simple (just check biomeMap). The original biome under a river can be stored separately if needed for Phase 4 (region seeding), but for Phase 2 the river replaces the biome value.

3. **Cliff faces at world-map chunk boundaries**
   - What we know: Each chunk has one elevation value. Cliff faces appear at chunk boundaries.
   - What's unclear: When a player is at the edge of loaded chunks, how to know the neighbor chunk's elevation for cliff rendering?
   - Recommendation: The client needs elevation data for the chunk's neighbors. When loading a chunk, also query the 4 cardinal neighbor elevations (available from worldMap since it's precomputed). Pass neighbor elevation data as part of the chunk loading context.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `packages/server/vitest.config.ts` |
| Quick run command | `cd packages/server && npx vitest run src/world/rivers.test.ts` |
| Full suite command | `cd packages/server && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORLD-02 | 16+ biome tile types registered with correct walkability flags | unit | `cd packages/server && npx vitest run src/world/terrain.test.ts -t "tile types"` | Wave 0 |
| WORLD-02 | BiomeType enum extended with RIVER (16) and LAKE (17) | unit | `cd packages/server && npx vitest run src/world/terrain.test.ts -t "biome types"` | Wave 0 |
| WORLD-03 | Rivers trace from high elevation to ocean/lake | unit | `cd packages/server && npx vitest run src/world/rivers.test.ts -t "river tracing"` | Wave 0 |
| WORLD-03 | Lakes form in elevation basins with minimum size | unit | `cd packages/server && npx vitest run src/world/rivers.test.ts -t "lake detection"` | Wave 0 |
| WORLD-03 | River width increases with flow accumulation (1-8 chunks) | unit | `cd packages/server && npx vitest run src/world/rivers.test.ts -t "river width"` | Wave 0 |
| WORLD-05 | isWalkable returns false for blocking biomes | unit | `cd packages/server && npx vitest run src/world/terrain.test.ts -t "walkability"` | Wave 0 |
| WORLD-05 | Server rejects position updates to blocked tiles | unit | `cd packages/server && npx vitest run src/world/terrain.test.ts -t "position validation"` | Wave 0 |
| WORLD-05 | NPC wander avoids blocked tiles | unit | `cd packages/server && npx vitest run src/world/terrain.test.ts -t "NPC wander"` | Wave 0 |
| WORLD-02 | Client TileRegistry has all 18 tile types with colors | unit | Client-side visual validation via Playwright | Wave 0 |
| WORLD-02 | Elevation banding quantizes correctly to 7 levels | unit | `cd packages/server && npx vitest run src/world/terrain.test.ts -t "elevation band"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/server && npx vitest run`
- **Per wave merge:** `cd packages/server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/world/rivers.test.ts` -- river tracing, lake detection, width scaling
- [ ] `packages/server/src/world/terrain.test.ts` -- walkability checks, elevation banding, tile type mapping, position validation
- [ ] No new framework install needed -- vitest already configured

## Sources

### Primary (HIGH confidence)
- `packages/server/src/world/types.ts` -- BiomeType enum (16 values), WorldMap interface with typed arrays
- `packages/server/src/world/biomes.ts` -- Biome classification thresholds, elevation ranges (land 0.3-1.0)
- `packages/server/src/world/continents.ts` -- Elevation generation with +0.3 land boost, noise parameters
- `packages/server/src/world/queries.ts` -- O(1) world map query API, module-level singleton
- `packages/server/src/world/constants.ts` -- WORLD_WIDTH=900, CHUNK_SIZE=32, noise parameters
- `packages/client/src/world/Chunk.ts` -- Current mesh building with MeshBuilder.CreateGround + MergeMeshes
- `packages/client/src/world/TileRegistry.ts` -- Current 7-tile system to be replaced
- `packages/server/src/routes/rtc.ts` -- Position update handler (line 131-139), injection point for validation
- `packages/server/src/game/spawn-points.ts` -- NPC wander logic (line 116-153), injection point for terrain checks

### Secondary (MEDIUM confidence)
- [Red Blob Games - Procedural River Drainage Basins](https://www.redblobgames.com/x/1723-procedural-river-growing/) -- Drainage path algorithm concepts
- [Babylon.js Docs - Ground from HeightMap](https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/set/ground_hmap) -- MeshBuilder height options
- [Babylon.js Docs - CreateRibbon](https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/param/ribbon/) -- Potential cliff face mesh technique

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries verified in package.json
- Architecture: HIGH -- clear insertion points identified in existing code, patterns match established codebase conventions
- Pitfalls: HIGH -- coordinate system issues verified by reading actual code, elevation ranges verified from Phase 1 test data
- River algorithm: MEDIUM -- algorithm design is sound but specific tuning parameters (source thresholds, width scaling factor, lake minimum size) will need empirical adjustment during implementation

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no external dependency changes expected)
