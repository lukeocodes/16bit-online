# Phase 3: Server-Side Chunk Generation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace client-side world generation with server-authoritative terrain. The server generates world map data and per-tile heights, persists in Redis, and streams to clients. Clients no longer run worldgen — the server is the single source of truth. This phase also replaces the flat elevation band system with smooth per-tile heights using multi-layer noise, producing realistic rolling hills, mountain ridges, and varied terrain across all biomes.

</domain>

<decisions>
## Implementation Decisions

### World Data Delivery — Two-Layer Architecture
- **Layer 1 (Bulk): World map arrays** — biomeMap, elevation, regionMap, regionBiomes (~3.2MB raw, ~400KB gzipped) sent as part of the HTTP signaling response during WebRTC handshake. Client decompresses while WebRTC negotiates — parallel work, no extra wait.
- **Layer 2 (Streaming): Per-chunk tile detail** — per-tile heights (32x32 Float16 = ~2KB per chunk) streamed on demand via CHUNK_REQUEST/CHUNK_DATA opcodes as the player moves. Server computes, caches in Redis, sends back.
- **Loading screen** shows download progress (existing % loaded screen).
- World data is gzip-compressed before sending.

### Server Persistence
- **PostgreSQL stores the world seed** (configurable via WORLD_SEED env var, defaults to 42).
- **Redis caches the computed world map arrays** — instant delivery to connecting clients without regeneration.
- **Auto-invalidation**: Server stores seed alongside cached data in Redis. If seed differs on startup, regenerate and replace automatically.
- **Per-chunk tile heights cached in Redis** after first computation — subsequent requests for the same chunk served from cache.

### Client Migration
- **Remove worldgen.worker.ts entirely** — server is the single source of truth. No offline/dev fallback.
- **Worldgen code stays server-only** in packages/server/src/world/. Client never imports server world code. Clean separation.
- **Game.ts flow changes**: connectToServer() receives world map arrays in the signaling response. Calls setWorldData() + initTerrainNoise() with server-provided data. generateWorldAsync() is removed.
- **Client vite config**: Remove the @server/world/* path alias — client no longer needs it.

### Terrain Quality — Smooth Per-Tile Heights
- **Remove discrete elevation bands** — no more 7 flat steps with cliff faces. Each tile sits at its exact computed Y.
- **Multi-layer noise** for terrain generation:
  1. **Continental elevation** — macro shape from worldgen (broad mountains, lowlands, coastlines)
  2. **Regional variation** — biome-specific character (mountains get steep ridges, grasslands get gentle rolls)
  3. **Fine local detail** — small-scale tile-to-tile variation for visual richness
- **All biomes can have steep terrain** — gradient-based blocking (|srcY - dstY| > threshold) applies universally, not just to specific biome types.
- **Mountains are defined by steepness** — consistently steep terrain building through ridgelines and valleys, with traversable paths between peaks.
- **Snow peaks are impassable walls** — the steepest biome, always building to a peak too steep to cross. The natural barrier at the top of mountain ranges.
- **Grassland/meadow**: Mostly gentle rolling hills with occasional steep gully.
- **Forest**: Moderate hills, some steep ravines.
- **Highland/scrubland**: Noticeable slopes, scattered too-steep spots.
- **Desert**: Mostly flat with sudden steep dune ridges or canyon walls.
- **Water/beach/swamp**: Nearly flat.
- Chunk base planes become simple backdrops at average height for distant chunks.

### Server-Side Y Validation
- Server computes per-tile Y using the same multi-layer noise function.
- Server validates player Y positions — rejects position updates where player Y doesn't match expected terrain height.
- Prevents fly/noclip cheats.

### Future-Proofing for Phase 4
- **Phase 3 sends world map + tile heights only** — no decoration/detail layer.
- **Phase 4 will extend CHUNK_REQUEST/CHUNK_DATA** to include decoration data (trees, rocks, wildlife spawns) when regions are discovered.
- Clean separation: Phase 3 owns terrain shape, Phase 4 owns region detail.

### Claude's Discretion
- Exact noise function parameters for each layer (continental, regional, local)
- Height gradient threshold for movement blocking
- Float16 encoding scheme for per-tile heights
- Redis cache key structure and TTL policy
- Gzip compression implementation details
- Chunk request batching/prefetch strategy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### World generation (server-side)
- `packages/server/src/world/worldgen.ts` — Current world generation pipeline: continent generation, noise grids, Voronoi regions, biome classification
- `packages/server/src/world/types.ts` — BiomeType enum (18 values), WorldMap interface with typed arrays
- `packages/server/src/world/biomes.ts` — Biome classification thresholds, continental modifiers
- `packages/server/src/world/constants.ts` — World dimensions (900x900), noise parameters

### Current client terrain system (to be migrated)
- `packages/client/src/world/TerrainNoise.ts` — Per-tile noise with biome profiles (to be moved/replicated server-side)
- `packages/client/src/world/ChunkManager.ts` — Client chunk loading, getTerrainY(), elevation bands (bands to be removed)
- `packages/client/src/world/TilePool.ts` — Thin-instance tile rendering (consumes terrainY resolver — interface stays)
- `packages/client/src/world/Chunk.ts` — Chunk base planes with cliff rendering (cliffs to be removed)
- `packages/client/src/world/worldgen.worker.ts` — Web worker for client-side worldgen (TO BE DELETED)
- `packages/client/src/engine/Game.ts` — generateWorldAsync() orchestration (to be replaced with server data flow)

### Networking and protocol
- `packages/shared/protocol.json` — CHUNK_REQUEST/CHUNK_DATA opcodes (10-13) for per-chunk streaming
- `packages/server/src/routes/rtc.ts` — WebRTC signaling (world data to be added to signaling response)
- `packages/client/src/net/NetworkManager.ts` — Client WebRTC connection (receives signaling response)
- `packages/client/src/net/StateSync.ts` — Terrain Y resolver (stays, fed by server data)

### Persistence
- `packages/server/src/db/schema.ts` — Existing DB schema (world seed storage)
- `packages/server/src/config.ts` — Server config with env var defaults (WORLD_SEED goes here)

### Requirements
- `.planning/REQUIREMENTS.md` — TECH-03 (server-side chunks), TECH-05 (binary format), TECH-06 (seedable PRNG)
- `.planning/ROADMAP.md` — Phase 3 success criteria

### Prior phase context
- `.planning/phases/01-world-map-data-layer/01-CONTEXT.md` — World seed configurable per server, Voronoi regions, continental arrangement
- `.planning/phases/02-terrain-classification-biomes/02-CONTEXT.md` — 18 biome types, binary walk/block, elevation rendering decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **worldgen.ts pipeline**: Full world generation (continents, regions, biomes, elevation) — stays server-side, output cached in Redis
- **TerrainNoise.ts**: Simplex noise with biome profiles — noise logic needs to be replicated/moved to server for per-tile height computation
- **BIOME_TERRAIN_PROFILES**: Per-biome amplitude/frequency/octaves — will be enhanced with multi-layer noise but the profile concept stays
- **TilePool thin instances**: Single-mesh rendering with per-instance matrix+color — consumes terrainY via resolver, interface unchanged
- **ChunkManager.setWorldData()**: Already accepts biomeMap, elevation, regionMap, regionBiomes — will receive from server instead of worker

### Established Patterns
- **Resolver callbacks**: MovementSystem, TilePool, StateSync all use `(x, z) => number` terrain Y resolvers — server migration doesn't change this interface
- **Binary protocol**: Position updates already use 24-byte binary packing — chunk data can use similar binary encoding
- **Redis for caching**: Already used for sessions — extend to world map arrays and per-chunk height data
- **Gzip in Fastify**: Fastify has built-in compression support for HTTP responses

### Integration Points
- **rtc.ts signaling POST**: Where world map arrays get attached to the signaling response
- **Game.ts connectToServer()**: Where client receives and processes world map data
- **ChunkManager.updatePlayerPosition()**: Where CHUNK_REQUEST messages should be sent for nearby chunks
- **config.ts**: Where WORLD_SEED env var gets added

</code_context>

<specifics>
## Specific Ideas

- "Mountains should never be flat and should exist over several levels you can traverse until it gets too steep" — mountains are a journey upward, not a flat plateau with a cliff edge
- "Green stuff should be rolling hills" — grassland/meadow terrain should undulate visibly, not be flat planes
- "We have such a large map to use, I want it to look really good" — terrain quality is a priority, the 900x900 world should showcase varied, realistic-feeling geography
- "Other areas CAN have steep bits" — steepness is universal, not mountain-exclusive. Any biome can have impassable slopes, but mountains are defined by them

</specifics>

<deferred>
## Deferred Ideas

- Per-region decoration data (trees, rocks, wildlife spawns) — Phase 4 Region Discovery
- Biome atmosphere effects (heat shimmer, shadows, fog) — Phase 9
- Texture/skin pass for tile visuals — future phase
- Stamina-based slope traversal cost — future phase (requires stamina system)

</deferred>

---

*Phase: 03-server-side-chunk-generation*
*Context gathered: 2026-03-20*
