# Technology Stack

**Project:** Procedural World Generation for Isometric MMO
**Researched:** 2026-03-19

## Recommended Stack

### Noise Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `simplex-noise` | ^4.0.3 | Coherent noise for terrain, biome, moisture maps | The standard JS/TS noise library. Pure TypeScript, zero dependencies, tree-shakeable ESM, seeded via constructor. 2D/3D/4D simplex noise. ~2KB gzipped. Used by virtually every JS procedural generation project. Actively maintained. |

**Why not alternatives:**

| Alternative | Why Not |
|-------------|---------|
| `open-simplex-noise` | Older API design, less active. `simplex-noise` v4 covers the same ground with a cleaner interface. |
| `fast-simplex-noise` | Abandoned (last publish 2018). Use `simplex-noise` instead. |
| `noisejs` | Abandoned (last publish 2014). Perlin-only, no TypeScript types. |
| Custom Perlin/simplex implementation | Reinventing the wheel. `simplex-noise` is battle-tested and tiny. |
| Perlin noise in general | Simplex noise is faster for higher dimensions, has fewer directional artifacts, and `simplex-noise` provides it out of the box. |

**Confidence:** MEDIUM (library choice is HIGH based on ecosystem dominance, but exact latest version needs npm verification)

### Seeded Random Number Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `alea` | ^1.0.1 | Seeded PRNG for deterministic procedural generation | Fast, seedable, produces well-distributed values. Used as the seed source for `simplex-noise`'s constructor. Required for deterministic region seeding: same world seed + region coordinates = identical output every time. |

**Why `alea` specifically:** `simplex-noise` v4 accepts a custom random function in its constructor. `alea` returns a function with the right signature. The combo `new SimplexNoise(alea(seed))` is the canonical pattern.

**Alternative:** Use `Math.sin`-based hash (already in the codebase for tile variation). This works for simple hashing but has poor distribution for complex terrain. Alea is cryptographically weak but statistically excellent for game use.

**Confidence:** MEDIUM (standard pairing, version needs npm check)

### Terrain Data Compression

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `CompressionStream` API | Browser built-in | Compress chunk tile data for network transfer | Zero-dependency gzip/deflate in modern browsers. Chunks are 32x32 = 1024 bytes of tile IDs; compression reduces to ~200-400 bytes per chunk for typical terrain. |
| `pako` | ^2.1.0 | Server-side zlib compression (fallback) | If `CompressionStream` is unavailable or for Node.js server-side compression. Well-maintained, fast zlib implementation. |

**Why not:**

| Alternative | Why Not |
|-------------|---------|
| `lz4-js` / `lz-string` | Overkill. Tile data is small (1KB per chunk). Standard deflate is fine and universally supported. |
| Uncompressed transfer | Wasteful over WebRTC. Even with binary protocol, 1KB per chunk adds up when loading 49 chunks (7x7 grid) = ~50KB vs ~15KB compressed. |

**Confidence:** HIGH (CompressionStream is stable in all modern browsers; pako is the standard Node zlib wrapper)

### World Map Data Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL `bytea` columns | Already installed (PG 16) | Store compressed chunk tile data as binary blobs | Current schema uses `jsonb` for tile_data which is wasteful (stores numbers as text). Switching to `bytea` for raw Uint8Array storage cuts storage by 60-70% and eliminates JSON parse overhead. |
| Redis chunk cache | Already installed (Redis 7) | Hot cache for recently accessed chunk data | Players moving through the same area should not hit PostgreSQL repeatedly. Redis TTL-based caching with chunk keys (`chunk:{mapId}:{x}:{y}`) provides sub-millisecond reads. |
| Drizzle ORM `bytea` custom type | Existing (Drizzle 0.38) | Type-safe binary column access | Drizzle supports custom column types. Define a `bytea` custom type that accepts/returns `Buffer`. |

**Why not:**

| Alternative | Why Not |
|-------------|---------|
| File-system storage for chunks | Adds operational complexity. PostgreSQL handles binary blobs well at this scale. Chunks are tiny (~1KB each). Even 1 million chunks = ~1GB, well within PostgreSQL comfort zone. |
| Separate tile database (LevelDB, etc.) | Unnecessary complexity. PostgreSQL with proper indexing handles this scale. Keep the stack minimal. |
| Keep `jsonb` for tile data | `jsonb` stores a 1024-element number array as ~5KB of JSON text vs ~1KB as `bytea`. For millions of chunks, this matters. |

**Confidence:** HIGH (PostgreSQL bytea is well-documented, Drizzle custom types are stable)

### Terrain Classification System (No New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Noise octave layering (custom code) | N/A | Multi-layer terrain: elevation, moisture, temperature, biome | Standard technique: layer multiple noise samples at different frequencies/amplitudes. No library needed -- this is 50-100 lines of utility code on top of `simplex-noise`. |
| Voronoi-based region boundaries (custom code) | N/A | Organic-feeling region edges rather than grid-aligned zones | Simple distance-to-nearest-point calculation. No library needed for 2D Voronoi -- scatter seed points per continent, assign terrain to nearest. |

**Why custom code instead of a library:**

Terrain classification (biome assignment from noise values) is project-specific logic. Libraries like `d3-voronoi` or `delaunator` solve computational geometry problems that are overkill here. For region boundaries, simple distance calculations with jittered grid points produce excellent results.

**Confidence:** HIGH (standard procedural generation technique, widely documented)

### World Map Definition (No New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Static JSON world map | Shared package | Define continent shapes, city locations, region boundaries, safe zones | The project requires pre-determined terrain classification with procedural detail. A JSON definition file in `packages/shared/` defines the macro world: continent outlines (as polygon coordinates), city/town/settlement locations, ocean boundaries. Server reads this at startup; client receives relevant portions. |

**Why JSON over database:**

World map topology (continents, cities) is design data that changes during development, not runtime data. It belongs in version control, not the database. The database stores generated chunk data (runtime). The JSON map defines where continents are and what biomes exist (design time).

**Confidence:** HIGH (architectural pattern, no dependency risk)

### Spatial Indexing Enhancement (No New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Region-level spatial index (custom code) | N/A | Efficient lookup of which region/biome/zone a coordinate belongs to | Current EntityStore does O(n) scans for nearby entities. For world generation, need O(1) lookups: "what region is tile (x,z) in?" A pre-computed lookup table indexed by chunk coordinates suffices. The existing spatial grid pattern (16-tile cells) extends naturally. |

**Why not a spatial library (rbush, etc.):**

| Alternative | Why Not |
|-------------|---------|
| `rbush` | R-tree for dynamic spatial queries. Regions are static -- a simple HashMap or 2D array lookup is faster and simpler. |
| `quadtree-js` | Same argument. Quadtrees optimize dynamic insert/query. Static world data should use direct coordinate-to-region mapping. |

**Confidence:** HIGH (architectural decision, no dependency)

## Recommended Stack Summary

### New Dependencies (install into packages)

```bash
# Server (procedural generation runs server-side)
cd packages/server
bun add simplex-noise alea

# Client (no new runtime dependencies needed)
# CompressionStream is a browser built-in
# Chunk decompression handled natively

# Shared (no new dependencies)
# World map definition is static JSON
```

**Optional (only if CompressionStream causes issues in target browsers):**
```bash
cd packages/server
bun add pako
bun add -D @types/pako
```

### Total New Dependencies: 2 (simplex-noise + alea)

This is deliberately minimal. Procedural world generation is mostly custom game logic built on top of noise functions. The project already has PostgreSQL, Redis, Drizzle, and a chunk system. The new work is:

1. Noise-based terrain generation logic (custom code using `simplex-noise`)
2. World map definition (static JSON data)
3. Chunk persistence pipeline (PostgreSQL `bytea` + Redis cache)
4. Region system (custom game logic)

None of these require heavy library additions.

## Architecture Integration Points

### Where New Code Lives

| Package | New Code | Purpose |
|---------|----------|---------|
| `packages/server/src/world/` | New directory | World generation, terrain classification, region seeding |
| `packages/server/src/world/generator.ts` | New file | Noise-based chunk generation from world map + seed |
| `packages/server/src/world/world-map.ts` | New file | Load and query the static world map definition |
| `packages/server/src/world/regions.ts` | New file | Region discovery, naming, player notes |
| `packages/server/src/world/biomes.ts` | New file | Biome definitions, tile mapping rules |
| `packages/shared/world-map.json` | New file | Static multi-continent world definition |
| `packages/shared/biomes.json` | New file | Biome type definitions and tile mappings |
| `packages/client/src/world/ChunkManager.ts` | Modified | Fetch chunks from server instead of local generation |

### Database Schema Additions

```sql
-- Evolve chunk_data to use bytea instead of jsonb
ALTER TABLE chunk_data ALTER COLUMN tile_data TYPE bytea;

-- New: region discovery tracking
CREATE TABLE regions (
  id SERIAL PRIMARY KEY,
  map_id INTEGER NOT NULL,
  region_x INTEGER NOT NULL,     -- region grid coordinate
  region_z INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,    -- procedurally generated name
  biome VARCHAR(50) NOT NULL,
  discovered_by UUID REFERENCES characters(id),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  player_note TEXT,
  UNIQUE(map_id, region_x, region_z)
);

-- New: track which chunks have been seeded
CREATE TABLE seeded_chunks (
  map_id INTEGER NOT NULL,
  chunk_x INTEGER NOT NULL,
  chunk_y INTEGER NOT NULL,
  seeded_at TIMESTAMPTZ DEFAULT NOW(),
  seed_version INTEGER DEFAULT 1,  -- allows re-seeding if algorithm changes
  PRIMARY KEY (map_id, chunk_x, chunk_y)
);
```

### Redis Cache Keys

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `chunk:{mapId}:{x}:{y}` | 1 hour | Compressed tile data for hot chunks |
| `region:{mapId}:{rx}:{rz}` | 24 hours | Region metadata (name, discoverer, biome) |
| `worldmap:continents` | No expiry | Parsed continent boundary data |

### Protocol Additions

| Opcode | Name | Direction | Channel | Format |
|--------|------|-----------|---------|--------|
| 10 | `CHUNK_REQUEST` | Client -> Server | Reliable | `{ mapId, chunkX, chunkY }` |
| 11 | `CHUNK_DATA` | Server -> Client | Reliable | Binary: compressed tile data |
| 14 | `REGION_ENTER` | Server -> Client | Reliable | `{ regionName, biome, discoveredBy, playerNote }` |
| 15 | `REGION_DISCOVERED` | Server -> Client | Reliable | `{ regionName, discoveredBy }` |

Opcodes 10-13 already exist in protocol.json. 10 and 11 just need implementation. 14 and 15 are new.

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| `three.js` terrain libraries | Wrong renderer. This project uses Babylon.js. |
| `terrain.js` / `terrain-generator` | Abandoned npm packages, last updated 2017-2019. Roll your own with `simplex-noise`. |
| `mapgen` / `mapgen2` (Red Blob Games) | Interesting research code but not a production library. Take inspiration from the algorithms, implement in TypeScript. |
| `libnoise` JavaScript ports | Poor TypeScript support, large bundle size, unmaintained. |
| WebAssembly noise generators | Premature optimization. JS simplex noise generates a 32x32 chunk in <1ms. WASM adds complexity for no measurable gain at this scale. |
| GPU-based terrain generation (compute shaders) | The server generates terrain, not the client. Server has no GPU. Keep generation in plain TypeScript. |
| Procedural generation on the client | Violates server-authoritative constraint. Client must receive chunk data from server. Generation must happen server-side for consistency across all players. |
| MongoDB / document store for chunks | Already have PostgreSQL. Don't add another database. PostgreSQL with bytea handles binary chunk data efficiently. |
| Separate microservice for world generation | Unnecessary architectural complexity for this scale. Keep generation in the game server process. |

## Sources

- Training data knowledge on `simplex-noise` npm package (dominant JS noise library, verified by widespread use in game dev community)
- Training data knowledge on `alea` PRNG (standard seeded random pairing with simplex-noise)
- Existing codebase analysis: schema.ts, ChunkManager.ts, world.ts, zones.ts, protocol.json
- PostgreSQL bytea documentation (stable, well-documented feature)
- CompressionStream Web API (Baseline 2023, supported in all modern browsers)

**Note:** Version numbers for `simplex-noise` and `alea` are based on training data (May 2025 cutoff). Verify exact latest versions with `npm view simplex-noise version` and `npm view alea version` before installing. The library recommendations themselves are high confidence -- these are the ecosystem standards.
