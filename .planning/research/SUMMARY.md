# Research Summary: Procedural World Generation for Isometric MMO

**Domain:** Procedural multi-continent world generation, terrain classification, region discovery, and massive map support for a browser-based UO-inspired isometric MMO
**Researched:** 2026-03-19
**Overall confidence:** MEDIUM (training data only -- web search and npm verification were unavailable; however, procedural generation libraries and patterns are mature and stable domains where training data is highly reliable)

## Executive Summary

The existing codebase has a solid foundation for extending into a massive procedural world: an ECS entity system, WebRTC networking with binary protocol, a chunk-based world system (32x32 tiles), PostgreSQL + Redis, and a spawn point system with sleep optimization. The world is currently flat and empty -- terrain generates client-side with basic noise, there is one hardcoded safe zone, and one spawn point near the origin. The core challenge is adding three layers: a static world definition (continents, biomes, settlements), a region system (discovery, naming, persistence), and a noise-based terrain generation pipeline -- all while maintaining server authority and the existing 20Hz game loop.

The technology additions are minimal: two new npm packages (`simplex-noise` for coherent noise generation, `alea` for seeded PRNG). Everything else is custom game logic built on the existing PostgreSQL, Redis, and Drizzle stack. The chunk storage format should evolve from JSONB to compressed binary (`bytea`) for 5-10x storage efficiency at scale. The existing protocol already reserves opcodes for chunk request/response (10-13) that just need implementation.

The architecture follows a layered model: World Map Definition (static JSON, design-time data) feeds into a Region System (runtime metadata, discovery tracking) which drives a Chunk Generation Pipeline (deterministic noise + biome rules -> tile data -> PostgreSQL + Redis -> client). Regions are the unit of discovery and seeding -- when a player enters an unexplored region, all chunks within it are generated atomically from a deterministic seed, the discoverer is recorded, and a procedural name is assigned permanently.

The most dangerous pitfalls are: synchronous region seeding blocking the game loop (must be async), O(n) entity iteration for position broadcasts at world scale (must add server-side spatial indexing), per-tile mesh creation causing frame stalls (must optimize chunk rendering), and JSONB chunk storage bloating the database (must use binary). All of these have known solutions that should be implemented before the world has content to stress-test them.

## Key Findings

**Stack:** Only 2 new dependencies needed: `simplex-noise` (noise generation) + `alea` (seeded PRNG). Everything else builds on existing PostgreSQL, Redis, Drizzle, and Babylon.js.

**Architecture:** Three-layer world system (World Map Definition -> Region System -> Chunk Pipeline) built as additive layers on top of existing chunk/entity/zone infrastructure. Regions are the unit of discovery and atomic seeding.

**Critical pitfall:** Synchronous region seeding on the game loop thread will freeze all players when anyone explores a new area. Must use async workers or background processing from day one.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **World Map Definition + Terrain Classification** - Foundation phase. Everything depends on knowing where continents, biomes, and settlements are. Design the static world map data format, terrain classification rules (elevation + moisture + temperature -> biome), and expanded tile type palette. No new npm dependencies needed.
   - Addresses: Multi-continent world map, terrain biome classification, safe zone hierarchy
   - Avoids: No region abstraction pitfall (Pitfall 6), terrain/visual coupling (Pitfall 12)

2. **Server-Side Chunk Generation + Streaming** - Core pipeline. Replace client-side chunk generation with server-authoritative terrain. Implement noise-based generation, PostgreSQL binary storage, Redis caching, and DataChannel chunk delivery.
   - Addresses: Server-fetched chunk data, deterministic terrain from seed, chunk persistence
   - Avoids: JSONB storage bloat (Pitfall 2), HTTP overhead (Pitfall 8), non-deterministic generation (Pitfall 5)

3. **Region System + Discovery** - Gameplay differentiation. Implement regions as first-class entities with atomic seeding, procedural naming, first-explorer attribution, and entry notifications.
   - Addresses: Procedural region seeding, region names, discoverer attribution, region entry notifications
   - Avoids: Synchronous seeding (Pitfall 3), seeding race conditions (Pitfall 10)

4. **Terrain Rendering Optimization** - Performance hardening. Optimize chunk mesh construction (vertex buffers instead of per-tile meshes), implement material pooling, add decoration rendering via instanced meshes.
   - Addresses: Decoration objects, elevation variation, biome visual variety
   - Avoids: Per-tile mesh creation stalls (Pitfall 1), client memory exhaustion (Pitfall 7)

5. **Wildlife + Region-Aware Spawning** - World population. Extend the existing spawn point system with biome-specific wildlife templates. Implement region-level sleep optimization.
   - Addresses: Wildlife encounters, varying creature difficulty, biome-specific fauna
   - Avoids: O(n) broadcast scaling (Pitfall 4), non-biome-aware spawning (Pitfall 15)

6. **PvP Flagging + Safe Zones** - Rules layer. Independent of world generation. Implement criminal/murderer flags, safe zone PvP enforcement, visual indicators. Can be developed in parallel with phases 3-5.
   - Addresses: PvP flagging system, safe zone enforcement, criminal/murderer visual indicators
   - Avoids: Hardcoded safe zone boundaries (Pitfall 13)

7. **Continental Geography + Water** - World shape polish. Generate ocean between continents, rivers, lakes, coastlines. Can be developed in parallel with phases 3-5 after the chunk pipeline exists.
   - Addresses: Continent/ocean/river/lake geography, movement blocking
   - Avoids: Coordinate overflow at extreme positions (Pitfall 9)

**Phase ordering rationale:**
- Phase 1 first because all other systems query the world map for biome/continent/settlement data
- Phase 2 before Phase 3 because regions trigger chunk generation, which must exist first
- Phase 3 before Phase 5 because wildlife spawns are placed during region seeding
- Phase 4 can run parallel with Phase 3 (rendering optimization is independent of region logic)
- Phase 6 is fully independent -- only needs existing combat system and zone infrastructure
- Phase 7 is independent after Phase 2 -- ocean/river generation is just another biome type in the pipeline

**Research flags for phases:**
- Phase 1: Needs careful data format design. Recommend prototyping the world map JSON format and reviewing biome classification rules before committing to schema.
- Phase 2: Standard implementation but needs performance validation. Benchmark chunk generation time and Redis cache hit rates early.
- Phase 3: Region locking and async seeding are the technically hardest parts. May need deeper research into Node.js worker_threads or Redis distributed locking patterns.
- Phase 4: Babylon.js instanced rendering and vertex buffer APIs should be verified against current docs during implementation. Training data is MEDIUM confidence for specific API calls.
- Phase 6: PvP flagging is a well-understood pattern from UO. Low risk, unlikely to need additional research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (noise + PRNG libraries) | MEDIUM | `simplex-noise` and `alea` are ecosystem standards. Exact latest versions unverified (npm unavailable). Library choice is HIGH confidence; versions need verification. |
| Stack (PostgreSQL bytea + Redis) | HIGH | Well-documented, stable features of technologies already in the project. |
| Features (table stakes) | HIGH | Based on direct codebase analysis + well-established MMO design patterns. |
| Features (differentiators) | MEDIUM | UO-specific patterns based on training data. Well-documented game but not verified against live sources. |
| Architecture (layered world system) | HIGH | Standard hierarchical spatial architecture. Direct extension of existing chunk system. |
| Architecture (region atomic seeding) | MEDIUM | Sound pattern but async implementation details (worker_threads, locking) need validation during implementation. |
| Pitfalls (rendering performance) | HIGH | Directly observable from current Chunk.buildMesh() code -- per-tile mesh creation will not scale. |
| Pitfalls (game loop scaling) | HIGH | Directly observable from current broadcastPositions() O(n) scan. |
| Pitfalls (JSONB storage) | HIGH | Directly observable from current schema.ts -- JSONB for tile data is measurably wasteful. |

## Gaps to Address

- **Exact npm package versions:** `simplex-noise` and `alea` versions should be verified with `npm view` before installation. The libraries themselves are correct choices.
- **Babylon.js instanced rendering API:** Current API surface for `InstancedMesh` and thin instances should be verified against Babylon.js 7.x docs before implementing decoration rendering.
- **Node.js worker_threads for async seeding:** The recommended pattern for background region seeding needs API verification. Alternative: use `setImmediate()` to yield to the event loop between chunk generations within a region seed.
- **World map scale validation:** The proposed world dimensions (600x400 chunks, ~120K chunks on land) are theoretical estimates. Validate with actual rendering and network performance before committing to final world size.
- **Redis memory planning:** Estimate actual Redis memory usage for chunk caching at target world scale. Current estimate (~12MB for 30K chunks) needs validation under load.
- **CompressionStream browser support:** Verify `CompressionStream` availability in the user's target browser (note: user uses ungoogled Chromium, which may have different API support than standard Chrome).
