# Domain Pitfalls

**Domain:** Browser MMO with procedural world generation, region persistence, and massive map scale
**Researched:** 2026-03-19
**Confidence:** MEDIUM (based on codebase analysis + domain expertise; web search unavailable for verification)

---

## Critical Pitfalls

Mistakes that cause rewrites, major performance failures, or architectural dead-ends.

### Pitfall 1: Per-Tile Mesh Creation at Scale

**What goes wrong:** The current `Chunk.buildMesh()` creates one `MeshBuilder.CreateGround()` per tile, then merges them with `Mesh.MergeMeshes()`. At 32x32 = 1024 tiles per chunk and 49 chunks loaded (7x7 grid at radius 3), that is 50,176 individual mesh creations and materials per full reload. Babylon.js `MergeMeshes` helps but the construction phase itself causes multi-second frame stalls when crossing chunk boundaries in rapid succession. With a massive world where players walk continuously through wilderness, this becomes a constant stutter source.

**Why it happens:** The current approach was fine for a small test area near origin. It was never designed for a player walking continuously through procedurally generated terrain. The chunk generation is synchronous and blocks the render loop.

**Consequences:**
- Visible frame drops when new chunks load (especially on lower-end hardware and mobile browsers)
- Players crossing chunk boundaries at diagonal angles trigger 3-5 new chunk loads simultaneously
- At massive world scale, this compounds with decoration/tree mesh creation
- GPU memory spikes during MergeMeshes before old chunks are disposed

**Prevention:**
- Replace per-tile mesh creation with a single merged geometry buffer per chunk (build vertex data directly, not via MeshBuilder)
- Use instanced rendering for tiles of the same type (InstancedMesh or thin instances in Babylon.js)
- Make chunk mesh construction asynchronous -- build vertex buffers in a Web Worker, transfer to main thread for GPU upload
- Implement LOD: distant chunks get a single-quad simplified mesh instead of full tile detail
- Pre-generate mesh data on the server side as binary buffers that can be uploaded directly to GPU

**Detection:** Profile `Chunk.buildMesh()` execution time. If it exceeds 8ms (half a 60fps frame), it will cause visible stutters. Currently it likely takes 20-50ms per chunk.

**Phase relevance:** Must be addressed in the terrain rendering phase, before massive world content is added. Retrofitting this is much harder after decoration systems are built on top.

---

### Pitfall 2: Chunk Data as JSONB in PostgreSQL

**What goes wrong:** The existing `chunk_data` table stores `tile_data` as `jsonb` -- a JSON array of 1024 integers per chunk. For a massive world with three continents, you could have hundreds of thousands of chunks. JSONB parsing overhead is ~10x slower than reading raw binary, and each chunk row weighs ~6-10KB in JSONB vs ~1KB as raw bytes. Database storage bloats, query latency increases, and the server spends CPU parsing JSON for every chunk fetch.

**Why it happens:** JSONB is the easy default in Drizzle ORM. It works for prototyping. The cost only becomes apparent at scale when chunk fetches need to be fast (sub-5ms) to avoid blocking player movement.

**Consequences:**
- Database grows 5-10x larger than necessary
- Chunk fetch latency increases from ~1ms (binary) to ~10-15ms (JSONB parse + larger payload)
- Server CPU wasted on JSON.parse for every chunk request
- Cannot efficiently do partial chunk updates (e.g., updating a single tile in a region requires rewriting the entire JSONB blob)
- Backup and replication times increase proportionally

**Prevention:**
- Store tile data as `bytea` (PostgreSQL binary) instead of JSONB. A 32x32 chunk is exactly 1024 bytes as a Uint8Array
- Use Drizzle's `customType` to define a `bytea` column that maps to/from `Buffer`/`Uint8Array`
- Keep `height_data` as binary too (1024 floats = 4096 bytes as Float32Array)
- Reserve JSONB for `static_entities` and metadata where schema flexibility matters
- Add a Redis caching layer for hot chunks (chunks near active players) -- the existing Redis connection is already available

**Detection:** Monitor `chunk_data` table size once you have >1000 chunks. If total size exceeds 10MB for 1000 chunks, the format is too bloated.

**Phase relevance:** Must be addressed when designing the persistence schema, before any chunk data is written at scale. Migrating JSONB to bytea after millions of rows exist is painful.

---

### Pitfall 3: Synchronous Region Seeding on First Exploration

**What goes wrong:** The project requirement says "procedural region seeding on first player exploration." If this seeding (terrain details, trees, decoration, wildlife spawn points) happens synchronously when a player enters an unexplored region, it creates a multi-second server-side stall. During that stall, the 20Hz game loop freezes for ALL players, not just the explorer. With multiple players exploring different regions simultaneously, the server becomes a serial bottleneck.

**Why it happens:** The natural implementation is: player enters region -> check if seeded -> if not, seed now -> return data. This is the simplest path but turns exploration into a server-wide performance hazard.

**Consequences:**
- Game loop tick skips when seeding takes >50ms (one tick at 20Hz)
- All combat, NPC wandering, and position broadcasts pause during seeding
- Multiple simultaneous explorations can cascade into seconds of server unresponsiveness
- Players experience rubber-banding and combat desyncs that appear unrelated to exploration

**Prevention:**
- Run region seeding in a background worker (Node.js worker_threads or a separate process)
- Implement a seeding queue: when a player enters an unseeded region, enqueue the seed job and serve a "loading" placeholder
- Make the seeding process produce deterministic output from a seed value (so it can be regenerated if the worker crashes)
- Separate the game loop timer from I/O-bound seeding operations -- the game loop must never await seeding
- Consider pre-seeding regions within a radius of active players during low server load
- Use Redis as a seeding lock to prevent duplicate seeding when multiple players enter the same unseeded region simultaneously

**Detection:** Monitor game loop tick duration. If any tick exceeds 100ms, something is blocking. Log when seeding starts/completes and compare to tick timing.

**Phase relevance:** Core architectural decision that must be designed in the world generation foundation phase. Cannot be easily retrofitted if seeding is built as synchronous-first.

---

### Pitfall 4: O(N) Entity Iteration for Position Broadcasts at World Scale

**What goes wrong:** The current `broadcastPositions()` in `world.ts` iterates ALL entities for EVERY connected player to find nearby ones (`for (const other of allEntities)`). With a massive multi-continent world, entity count could reach 10,000+ (wildlife, NPCs across all seeded regions). For 100 concurrent players, that is 100 x 10,000 = 1,000,000 iterations per position broadcast. At 20Hz, that is 20 million iterations per second. The game loop cannot sustain this.

**Why it happens:** The current implementation works fine with <50 entities near origin. It was built for a small test area. The server-side `EntityStore` has no spatial indexing (unlike the client-side `EntityManager` which has a spatial grid).

**Consequences:**
- Server tick time exceeds 50ms, causing tick skipping and desync
- CPU pegs at 100% on the game loop thread
- Position broadcasts become delayed, causing rubber-banding for all players
- Server becomes unresponsive to new connections

**Prevention:**
- Add a server-side spatial grid (matching the client's `EntityManager` pattern with 16-tile cells) to the `EntityStore`
- Use the NPC sleep system pattern that already exists (`isAwake()`) but extend it to skip position broadcasting for sleeping entities entirely
- Partition the world into zones/regions with independent entity lists -- only iterate entities within the same zone as the player
- Consider separate game loop workers per continent or world region (Node.js worker_threads) for true parallelism
- `broadcastPositions()` should use spatial queries, not full iteration

**Detection:** Profile `gameTick()` total execution time. If it exceeds 25ms (half of the 50ms tick interval), broadcast is too slow. Also monitor entity count -- if it exceeds 500 with current code, problems begin.

**Phase relevance:** Must be solved before wildlife spawning across the massive world. The spawn point system will create thousands of entities; the broadcast system must handle them before they exist.

---

### Pitfall 5: Terrain Generation Seed Determinism Failures

**What goes wrong:** Procedural generation must be perfectly deterministic given the same seed -- the same region seed must produce identical terrain on every invocation, forever. JavaScript's `Math.random()` is not seedable. If the generation algorithm uses `Math.random()` (as the current `spawn-points.ts` does for NPC positioning and the current `ChunkManager` uses `Math.sin` for pseudo-random), different runs produce different results, or results vary across Node.js versions. When a region is "seeded on first exploration" but the algorithm cannot reproduce the same output, the persistence guarantee breaks.

**Why it happens:** `Math.random()` is the most natural choice and works for non-deterministic tasks (NPC wander direction). Developers forget that terrain generation has a fundamentally different requirement: reproducibility.

**Consequences:**
- Region data must be stored in full rather than regenerated from seed, increasing storage by orders of magnitude
- If stored data is lost or corrupted, the region cannot be regenerated
- Cross-server region generation (if you ever scale horizontally) produces inconsistent results
- Unit testing terrain generation becomes non-reproducible

**Prevention:**
- Use a seedable PRNG library (e.g., `alea`, `seedrandom`, or implement a simple mulberry32/xoshiro128 PRNG)
- Every procedural generation function must accept a seed parameter, never use `Math.random()`
- The region seed should be derivable from world coordinates: `regionSeed = hash(worldSeed, regionX, regionY)` so it can always be recalculated
- Store only the seed + generation algorithm version, not the full output (unless the output is modified post-generation)
- Version the generation algorithm: if you change the algorithm, old regions keep their stored data, new regions use the new algorithm
- Write tests that verify generation determinism: `generate(seed) === generate(seed)` across 1000 runs

**Detection:** Run the generation function twice with the same inputs. If outputs differ, determinism is broken. Automate this as a CI test.

**Phase relevance:** Must be established as a foundation before any procedural generation code is written. Retrofitting determinism into non-deterministic code requires rewriting every generation function.

---

### Pitfall 6: No Concept of "Region" as a First-Class Entity

**What goes wrong:** The project describes regions (5-10 minute walking distances, discoverable, nameable, with notes). But the current codebase only has "chunks" (32x32 tiles) and "maps" (worldMaps table). A region is a higher-level concept that spans multiple chunks but is not a map. If regions are bolted on as an afterthought rather than designed as a first-class data model, you get inconsistent boundaries, discovery tracking bugs, and an inability to query "which region am I in?" efficiently.

**Why it happens:** Chunks are a rendering/streaming concern. Regions are a gameplay concern. They operate at different scales and serve different purposes, but developers often try to make chunks do double-duty as regions (or vice versa), leading to awkward coupling.

**Consequences:**
- Region boundaries that don't align with chunk boundaries cause edge-case bugs (player is in chunk A but region B, or straddles two regions)
- Discovery tracking requires scanning all chunks to determine if a region has been visited
- Region metadata (name, discoverer, notes) has no natural home in the data model
- Server cannot efficiently answer "what region is position X,Y in?" without scanning
- Safe zone enforcement becomes boundary-dependent and error-prone

**Prevention:**
- Design a `regions` table separate from `chunk_data`: `id, name, continent_id, biome, bounds (polygon or bounding box), discoverer_id, discovered_at, notes, is_safe_zone, seed`
- Regions should have explicit geometric boundaries (rectangles or polygons), not derive boundaries from chunk groupings
- Implement a spatial lookup for regions: given world coordinates, return the containing region in O(1) via a grid index or R-tree
- The region-to-chunk relationship should be many-to-one (a chunk belongs to exactly one region) with a precomputed mapping
- Region entry/exit detection should happen on the server and be broadcast as reliable events

**Detection:** If you find yourself writing code that asks "which chunks belong to this region?" by iterating all chunks, the data model is wrong. The mapping should be direct.

**Phase relevance:** Must be designed in the world map/data model phase, before any terrain or region content is generated.

---

### Pitfall 7: Client Memory Exhaustion from Unbounded Chunk/Entity Caching

**What goes wrong:** In a massive world where players can walk for 10+ minutes continuously, the client accumulates meshes, textures, materials, and entity data. The current `ChunkManager` disposes chunks outside `CHUNK_LOAD_RADIUS + 1`, but disposal timing and GPU memory reclamation are not guaranteed. Babylon.js material and texture caches grow indefinitely. After 30 minutes of exploration, the browser tab uses 2GB+ of memory and crashes (especially on mobile/tablets).

**Why it happens:** The current unload radius (CHUNK_LOAD_RADIUS + 1 = 4 chunks) seems reasonable, but materials and textures created per-chunk are not properly pooled. Each chunk creates `new StandardMaterial()` instances. Even after `mesh.dispose()`, materials persist in Babylon.js's internal cache unless explicitly disposed. Decoration objects (trees, rocks) compound this further.

**Consequences:**
- Browser tab crashes after extended exploration sessions (out-of-memory)
- Gradual FPS degradation as GPU memory fills
- Mobile browsers are especially vulnerable (1-2GB memory limit)
- Players learn to avoid exploration (the core feature) because it crashes their browser

**Prevention:**
- Implement a material pool: reuse materials by tile type instead of creating new ones per chunk
- Use Babylon.js `AssetContainer` or a custom asset pool for decoration meshes (trees, rocks) -- dispose instances, not base meshes
- Track total client memory budget (estimate from mesh count + texture dimensions) and aggressively dispose when approaching limits
- Implement chunk mesh recycling: instead of creating new meshes, rewrite vertex buffers of pooled mesh objects
- Set explicit unload distances for different asset types (chunks, decorations, entities, particles)
- Profile with Chrome DevTools Memory tab during 30-minute exploration sessions to find leaks

**Detection:** Monitor `engine.scenes[0].meshes.length` and `engine.scenes[0].materials.length` over time. If they grow monotonically despite chunk disposal, there is a leak. Also monitor browser `performance.memory.usedJSHeapSize` (Chrome only).

**Phase relevance:** Must be addressed alongside the terrain rendering overhaul. Every new visual system (decorations, trees, wildlife) must be built with pooling from the start.

---

## Moderate Pitfalls

### Pitfall 8: Chunk Loading via HTTP Instead of DataChannel

**What goes wrong:** The current `worldRoutes` serves chunk data over HTTP GET. For a player moving continuously through a massive world, this means a new HTTP request for every chunk enter. HTTP requests have overhead (headers, TLS, connection management, auth token validation per request). With 3-5 chunks loading per second during movement, this creates noticeable latency spikes and increases server request load.

**Prevention:**
- Use the existing reliable DataChannel for chunk requests and responses. The protocol already defines `CHUNK_REQUEST` (opcode 10) and `CHUNK_DATA` (opcode 11) but they appear unused.
- Send chunk data as binary over the DataChannel (1024 bytes for tile data is well within DataChannel message size limits).
- Implement prefetching: request chunks 1-2 ahead of the player's movement direction.
- Keep HTTP as a fallback for initial login world state, but use DataChannel for streaming during gameplay.

**Detection:** If chunk load latency exceeds 100ms and correlates with network round-trip time (rather than generation time), the HTTP overhead is the bottleneck.

**Phase relevance:** Should be implemented when building the chunk streaming system, before the massive world is populated.

---

### Pitfall 9: World Map Coordinate Overflow and Precision

**What goes wrong:** A massive multi-continent world with "5-10 minute walking distances between safe zones" at `MAX_PLAYER_SPEED: 5.0` tiles/sec means distances of 1500-3000 tiles between settlements. Three continents with multiple regions each could span 50,000+ tiles in each dimension. The current position format uses `float32` (in the binary protocol) which has ~7 decimal digits of precision. At coordinate 50,000, float32 precision is ~0.004 -- enough for tile-level accuracy but not for smooth sub-tile interpolation. At 100,000+ coordinates, jitter becomes visible.

**Prevention:**
- Use world-relative coordinates for storage and server logic, but camera-relative (offset) coordinates for rendering and network transmission
- Implement a coordinate origin rebasing system: the client renders relative to a local origin that shifts as the player moves between chunks
- Keep the binary protocol's float32 but transmit positions as offsets from the player's current chunk origin (reducing the magnitude to 0-1024 range where float32 has excellent precision)
- Test rendering and interpolation at extreme coordinates (50000+) early to identify jitter before building world content there

**Detection:** Walk a character to coordinates (50000, 50000) and observe entity interpolation. If entities visibly jitter or snap between positions, float32 precision is insufficient at that range.

**Phase relevance:** Must be considered in the world coordinate system design, before continent layouts are placed at large offsets.

---

### Pitfall 10: Seeding Race Conditions with Multiple Simultaneous Explorers

**What goes wrong:** Two players enter an unseeded region at nearly the same time. Both detect "not seeded" and both trigger seeding. Result: either the region is seeded twice (wasting resources and potentially producing inconsistent state if not perfectly deterministic), or database write conflicts occur, or one player gets stale/empty data while the other's seed is in progress.

**Prevention:**
- Use Redis as a distributed lock for region seeding: `SET region:seed:{regionId} LOCK NX EX 30` (only one process can seed a given region)
- The first player to acquire the lock seeds the region; subsequent requests wait or receive a "seeding in progress" signal and retry
- After seeding completes, write to PostgreSQL and cache in Redis; release the lock
- If the seeding process crashes (lock expires), another player can acquire the lock and re-seed (deterministic generation means the same result)
- Design the client to gracefully handle "region not yet available" -- show the terrain classification (biome color) as a placeholder while detailed data loads

**Detection:** Stress test with multiple players entering the same unseeded region simultaneously. If the database shows duplicate entries or the server logs duplicate seeding operations, the race condition exists.

**Phase relevance:** Must be designed into the region seeding system from the start. Adding distributed locking after the fact is messy.

---

### Pitfall 11: Monolithic Game Loop Cannot Scale to Multi-Continent World

**What goes wrong:** The current `world.ts` runs a single `setInterval(gameTick, 50ms)` that processes ALL entities, ALL combat, ALL NPC wandering, and ALL broadcasts. With a massive three-continent world, this single loop must handle thousands of entities across vastly separated regions. Even with sleep optimization, the loop still iterates all entities to check if they are awake.

**Prevention:**
- Partition the world into independent "zones" (continents or sub-regions), each with its own game loop running in a worker_thread
- Use SharedArrayBuffer or message passing for cross-zone interactions (rare in a massive world -- most interactions are local)
- The main thread handles connection management, auth, and zone routing; workers handle game simulation
- Start with a single-threaded approach but design entity storage with zone partitioning from the start so migration to workers is straightforward
- At minimum, replace the `getAll()` iteration pattern with zone-scoped queries

**Detection:** If `gameTick()` execution time exceeds 30ms with >500 entities, the single-thread model is reaching its limit.

**Phase relevance:** The zone partitioning data model should be designed early (with the region system). The actual worker_thread migration can happen later, but the data model must support it.

---

### Pitfall 12: Terrain Classification and Visual Detail Coupling

**What goes wrong:** The project describes "pre-determined terrain classification" (biomes, elevation, water) with "procedural detail on first exploration." If the terrain classification layer and the visual detail layer are tightly coupled, changes to classification (adjusting continent shapes, moving biome boundaries) require re-seeding all affected regions. The world design phase cannot iterate on continent layout without destroying existing exploration data.

**Prevention:**
- Implement terrain classification as a completely separate layer from visual detail
- Classification should be a deterministic function of world coordinates (noise functions, predefined maps, or a combination) that can be queried without database access
- Visual detail (specific tile variants, tree placement, decoration) is seeded on top of classification and stored in the database
- If classification changes in a region that has already been seeded, the stored visual detail is invalidated and must be re-seeded (but this should be an explicit, controlled operation, not automatic)
- Version the classification algorithm so old stored data can be identified as stale

**Detection:** If you cannot change a continent's coastline without manually wiping and re-seeding all affected chunk data, the coupling is too tight.

**Phase relevance:** Must be designed when building the world map foundation. The classification system should be fully functional before any visual seeding is implemented.

---

### Pitfall 13: Safe Zone Boundaries as Hardcoded Coordinates

**What goes wrong:** Cities, towns, and settlements are safe zones where PvP is disabled. If safe zone boundaries are hardcoded as coordinate ranges (or tied to specific chunk coordinates), they become brittle when world layout changes and impossible to manage at scale across hundreds of settlements.

**Prevention:**
- Safe zones should be a property of regions, not coordinates. A region's `is_safe_zone` flag determines PvP rules.
- The server checks "is the attacker's current region a safe zone?" not "are the attacker's coordinates within [x1,y1,x2,y2]?"
- This means the region lookup (Pitfall 6) is a prerequisite for safe zone enforcement
- Allow graduated safety: cities are fully safe, town outskirts might have delayed flagging, wilderness is open PvP
- Encode safe zone rules in region metadata, not in combat code

**Detection:** If the combat system has coordinate-based boundary checks instead of region-based checks, the approach is wrong.

**Phase relevance:** Depends on the region system being in place. Should be implemented when PvP flagging is added.

---

## Minor Pitfalls

### Pitfall 14: Procedural Name Generation Producing Inappropriate or Duplicate Names

**What goes wrong:** Region names generated procedurally can produce offensive words, unpronounceable strings, or duplicates across the world. Players see a region called "Shitford" or every third region has a similar-sounding name.

**Prevention:**
- Use a curated syllable/word bank instead of pure random character generation
- Implement a blocklist check against common offensive words and their phonetic variants
- Store generated names in a database unique index to prevent duplicates
- Generate name candidates in batches and filter, rather than accepting the first result
- Allow cultural/linguistic variation by continent (Elvish-sounding names on the Elf continent, etc.)

**Detection:** Generate 10,000 names and review them manually. Run them through a profanity filter. Check for duplicates.

**Phase relevance:** Address when implementing the region discovery system.

---

### Pitfall 15: Wildlife Spawn Points Without Region Awareness

**What goes wrong:** Wildlife spawn points are placed without considering region biome or terrain. Desert regions spawn forest wolves, coastal regions spawn mountain goats. The world feels incoherent.

**Prevention:**
- Tie spawn point templates to biome types: each biome defines which wildlife can appear
- When a region is seeded, generate spawn points based on the region's terrain classification, not randomly
- Use the existing spawn point system but parameterize it with biome-appropriate NPC template lists
- Test by walking through biome transitions and verifying wildlife changes

**Detection:** If the same NPC types appear everywhere regardless of terrain, biome-aware spawning is missing.

**Phase relevance:** Address when implementing wildlife encounters, after the biome/terrain classification system is in place.

---

### Pitfall 16: Missing Chunk Request Deduplication on Client

**What goes wrong:** Player moves rapidly, triggering `updatePlayerPosition()` multiple times before the first chunk response arrives. The client sends duplicate requests for the same chunk, wasting bandwidth and server resources. With the current code, `loadChunk()` is called if `!this.chunks.has(key)`, but the chunk is only added to the map after mesh building completes. During the async gap, multiple `loadChunk()` calls fire for the same coordinates.

**Prevention:**
- Maintain a `Set<string>` of in-flight chunk requests in `ChunkManager`
- Before requesting a chunk, check both `chunks` (loaded) and `pendingChunks` (in-flight)
- Remove from `pendingChunks` when the chunk data arrives or the request fails
- Implement request cancellation for chunks that fall outside the load radius before their response arrives

**Detection:** Log chunk requests and look for duplicates (same coordinates requested multiple times within 1 second).

**Phase relevance:** Address when converting chunk loading from synchronous local generation to async server-fetched data.

---

### Pitfall 17: Ignoring the Isometric Camera Perspective in World Design

**What goes wrong:** World content (terrain, decorations, buildings) is designed for a top-down or free-camera perspective but looks wrong from the fixed isometric angle. Trees block important views, terrain elevation changes are invisible, region transitions are not noticeable from the isometric angle.

**Prevention:**
- All procedural generation rules must be tested from the actual isometric camera angle, not just in data
- Tree and decoration placement should respect camera-facing visibility (no large objects in the "near" direction that block the player)
- Terrain elevation must be exaggerated enough to be visible in isometric projection (UO used very subtle elevation)
- Region transition indicators (ground color changes, border markers) must be visible at the isometric zoom level

**Detection:** Walk through generated terrain with the actual game camera. If you cannot distinguish biomes or see region transitions, the visual design does not work for isometric.

**Phase relevance:** Relevant throughout all visual content phases. Establish visual guidelines early when prototyping terrain rendering.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| World map data model | No region abstraction (Pitfall 6), JSONB storage (Pitfall 2) | Design regions as first-class entities with binary chunk storage from day one |
| Terrain classification | Coupled to visual detail (Pitfall 12), coordinate overflow (Pitfall 9) | Separate classification from detail; test at extreme coordinates |
| Procedural generation engine | Non-deterministic PRNG (Pitfall 5), synchronous seeding (Pitfall 3) | Use seedable PRNG everywhere; async seeding with worker threads |
| Chunk streaming | HTTP overhead (Pitfall 8), no deduplication (Pitfall 16), memory leaks (Pitfall 7) | Use DataChannel; deduplicate requests; pool materials and meshes |
| Terrain rendering | Per-tile mesh creation (Pitfall 1), isometric perspective (Pitfall 17) | Build vertex buffers directly; test everything in isometric view |
| Region discovery | Name generation (Pitfall 14), race conditions (Pitfall 10) | Curated syllable banks; Redis distributed locks for seeding |
| Wildlife spawning | O(N) broadcasts (Pitfall 4), no biome awareness (Pitfall 15) | Server-side spatial indexing; biome-to-spawn-template mapping |
| PvP and safe zones | Hardcoded boundaries (Pitfall 13) | Region-based safety rules, not coordinate checks |
| Scale and performance | Monolithic game loop (Pitfall 11) | Zone-partitioned data model from the start; migrate to workers later |

---

## Codebase-Specific Observations

These are not pitfalls per se, but existing patterns that will amplify the pitfalls above if not addressed:

1. **Duplicated chunk generation logic.** `ChunkManager.generateChunkData()` (client) and `worldRoutes.generateChunkData()` (server) are copy-pasted with identical logic. When procedural generation becomes complex, this duplication will cause client/server terrain mismatches. Move shared generation to `packages/shared/`.

2. **EntityStore.getAll() returns a new array every call.** `Array.from(this.entities.values())` allocates on every invocation. In the game loop, this is called multiple times per tick. With thousands of entities, GC pressure increases. Switch to iteration over the Map directly or cache the array.

3. **hashCode() for entity IDs uses string hashing.** The `hashCode()` function in `world.ts` converts string entity IDs to uint32 for the binary protocol. With thousands of entities, hash collisions become statistically likely (birthday problem: ~50% chance of collision at ~77,000 entities with uint32). Consider using a sequential numeric ID assignment for the binary protocol and mapping to/from string UUIDs on the boundaries.

4. **No connection-scoped entity tracking.** `broadcastPositions()` iterates all entities for every connection. If connections tracked which entities are "known" to them, you could avoid re-sending full entity state for already-known entities and send deltas instead.

## Sources

- Direct codebase analysis of the existing game project (all files referenced above)
- Domain expertise on procedural generation, MMO server architecture, Babylon.js rendering performance, and WebRTC-based multiplayer systems
- Confidence reduced to MEDIUM overall because web search was unavailable to verify current best practices against external sources
