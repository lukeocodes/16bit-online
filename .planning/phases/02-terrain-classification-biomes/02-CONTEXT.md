# Phase 2: Terrain Classification & Biomes - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand tile types to 15-20 biomes with water bodies and movement blocking. The world gets diverse terrain — forests, mountains, deserts, swamps, water bodies — with rules governing what players can walk on. This phase bridges the gap between Phase 1's biome data layer (16 BiomeTypes exist as data) and visible, interactive terrain. Visual polish (atmosphere, textures) is Phase 9; server-side chunk streaming is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Water Body Generation
- Rivers use **traced drainage paths** — flow from high elevation to low, following natural terrain to coast or lakes
- Lakes form in **elevation basins** — low-elevation areas surrounded by higher terrain
- All water is **fully blocking** — players must walk around rivers and lakes. No wading, no crossing. Bridges/fords are a future addition.
- Major rivers have **variable width (1-8 tiles)** — narrow at mountain source, widening toward coast/lake terminus

### Movement Blocking
- **Binary walk/block** — tiles are either fully walkable or fully impassable, no speed modifiers
- **Blocking terrain types**: deep ocean, shallow ocean, lakes, rivers, mountain peaks (SNOW_PEAK), and cliff edges
- Walkable terrain: forests, desert, swamp, tundra, grassland, highland, meadow, scrubland, beach, boreal forest, river valley (ground near rivers, not the water itself)
- **Silent rejection** on client — player simply doesn't move into blocked tiles, no animation or message. Server rejects invalid positions.
- **NPCs respect same rules** — wander AI avoids blocked tiles. Consistent world physics for all entities.

### Tile Visual System
- **Grouped tiles with transition support** — architecture supports base tiles per biome plus transition tiles at biome boundaries
- **Flat colored tiles for now** — each biome gets a distinct color. Visual skinning/textures deferred to later
- **Hard edges** at biome boundaries — no color blending or gradient transitions between adjacent biome tiles
- **Replace legacy tile system** — the old 7 tiles (void, grass, dirt, stone, water, sand, wood) are replaced entirely. The 16 BiomeType values become the new tile type foundation.
- Transition tiles exist in the data model but render as hard edges until skinned

### Elevation Rendering
- **Stepped terrain at 6-8 discrete height levels** — tiles render at quantized Y positions based on elevation bands from the world map data
- **Vertical cliff faces** between elevation steps — clean terraced/plateau aesthetic, classic isometric RPG style
- Each elevation band is a flat plateau with vertical drops at transitions
- Height data already exists (Float32Array from Phase 1) — this phase quantizes it into discrete rendering bands
- Biome color + elevation stepping together convey terrain character (grey tile at high Y = mountain, green tile at low Y = valley)

### Claude's Discretion
- Exact elevation band thresholds (how elevation float maps to 6-8 discrete levels)
- River tracing algorithm specifics (drainage accumulation approach)
- Cliff face mesh generation technique
- Transition tile ID scheme and data encoding
- Chunk mesh rebuilding strategy for stepped heights
- Lake minimum size and placement density

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 outputs (world map data layer)
- `packages/server/src/world/types.ts` — BiomeType enum (16 values), LandType enum, WorldMap interface with biomeMap/elevation/moisture/temperature typed arrays
- `packages/server/src/world/worldgen.ts` — World generation pipeline: continent generation, noise grids, Voronoi regions, biome classification
- `packages/server/src/world/biomes.ts` — Biome classification thresholds, continental modifiers (Elf=forest, Dwarf=mountain, Human=diverse)
- `packages/server/src/world/constants.ts` — World dimensions (900x900), continent radius (175), noise parameters
- `packages/shared/world-config.json` — World seed (42), dimensions, chunk size, player speed

### Requirements
- `.planning/REQUIREMENTS.md` — WORLD-02 (expand to 15-20 biome types), WORLD-03 (water bodies), WORLD-05 (movement blocking)
- `.planning/ROADMAP.md` — Phase 2 success criteria and dependencies

### Current tile/movement systems (to be replaced/extended)
- `packages/client/src/world/TileRegistry.ts` — Current 7 tile types with id/name/color/walkable. To be replaced with biome-based tiles.
- `packages/client/src/world/Chunk.ts` — Tile rendering (meshes grouped by tileId, merged per chunk). Needs elevation support.
- `packages/client/src/world/ChunkManager.ts` — Client chunk loading. Currently generates locally — will need biome-aware generation.
- `packages/client/src/ecs/systems/MovementSystem.ts` — Client movement (no blocking). Needs walkability checks.
- `packages/server/src/routes/rtc.ts` — Server position handling (no validation). Needs terrain blocking validation.
- `packages/server/src/game/spawn-points.ts` — NPC wander AI (no terrain avoidance). Needs blocking awareness.

### Chunk protocol
- `packages/shared/protocol.json` — CHUNK_REQUEST/CHUNK_DATA opcodes (10-13)
- `packages/server/src/routes/world.ts` — Current /chunks endpoint serving hardcoded procedural data
- `packages/shared/constants.json` — CHUNK_SIZE (32), MAX_PLAYER_SPEED (5.0)

### Prior phase context
- `.planning/phases/01-world-map-data-layer/01-CONTEXT.md` — Phase 1 decisions on continental arrangement, ocean structure, region system

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **BiomeType enum** (16 values): Already defined in server types.ts — DEEP_OCEAN through RIVER_VALLEY. Direct mapping to new tile types.
- **WorldMap typed arrays**: biomeMap (Uint8Array), elevation (Float32Array), moisture, temperature all indexed by `[z * width + x]` at chunk granularity. Rivers and elevation bands can query these directly.
- **Region system**: Voronoi regions with biome classification by majority vote. Region boundaries already computed.
- **TileRegistry pattern**: Extensible tile registration with id/name/color/walkable. Can be expanded to 16+ biome tiles.
- **Chunk mesh merging**: Chunk.ts groups tiles by type and merges into single meshes. Pattern works for biome tiles.

### Established Patterns
- **O(1) spatial queries**: biomeMap[z * width + x] lookup for any chunk coordinate. Movement validation can use this directly.
- **Server-authoritative design**: All game state changes server-side. Movement validation fits this pattern.
- **Sleep optimization**: Entities far from players don't tick. NPC terrain avoidance should respect this.
- **mapId system**: Used throughout for multi-map support. World map uses single mapId with spatial partitioning.

### Integration Points
- **Server position updates** (rtc.ts line ~135): Where terrain validation must be inserted — reject moves into blocking tiles
- **NPC wander logic** (spawn-points.ts line ~140): Where terrain avoidance must be added — check target tile before moving
- **Chunk generation** (ChunkManager.ts): Where biome-based tile data replaces current procedural generation
- **TileRegistry** (TileRegistry.ts): Where new biome tile types are registered with colors and walkable flags
- **Chunk rendering** (Chunk.ts): Where elevation stepping modifies tile mesh Y positions

</code_context>

<specifics>
## Specific Ideas

- User wants "skinning later" — flat colored tiles now, textured tiles in a future pass. Architecture should support swapping colors for textures without structural changes.
- 6-8 elevation levels with vertical cliff faces — classic isometric terraced look, not smooth terrain
- Variable-width rivers (narrow at source, wide at mouth) — geographic realism is valued
- UO-style silent movement rejection — no flashy feedback, just can't walk there

</specifics>

<deferred>
## Deferred Ideas

- Biome atmosphere effects (heat shimmer, forest shadows, swamp fog) — Phase 9
- Server-side chunk streaming to replace client generation — Phase 3
- Bridges and fords across rivers — future phase
- Texture/skin pass for tile visuals — future phase
- Smooth terrain slopes between elevation bands — possible future polish

</deferred>

---

*Phase: 02-terrain-classification-biomes*
*Context gathered: 2026-03-19*
