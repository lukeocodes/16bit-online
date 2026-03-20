# Phase 3: Server-Side Chunk Generation - Research

**Researched:** 2026-03-20
**Domain:** Server-authoritative terrain generation, binary data streaming, Redis caching, multi-layer noise
**Confidence:** HIGH

## Summary

This phase replaces client-side world generation with server-authoritative terrain. The server generates world map data and per-tile heights using deterministic noise from a configurable seed, persists them in Redis, and streams them to clients. The client's worldgen worker is deleted entirely; all terrain data originates from the server.

The architecture has two layers: (1) bulk world map arrays (biomeMap, elevationBands, regionMap, regionBiomes) sent as gzipped binary in the HTTP signaling response during WebRTC handshake, and (2) per-chunk tile heights (32x32 Float16 = 2KB each) streamed on demand via CHUNK_REQUEST/CHUNK_DATA opcodes over the reliable DataChannel. The discrete elevation band system is replaced with smooth per-tile heights using multi-layer noise (continental + regional + local detail), producing realistic rolling terrain across all biomes.

All existing infrastructure supports this cleanly. The server already has `generateWorld()` producing all needed arrays, Redis is already connected via ioredis, the protocol already defines CHUNK_REQUEST/CHUNK_DATA opcodes (10-13), and the client's `ChunkManager.setWorldData()` already accepts the same typed arrays. Node v25.8.1 natively supports Float16Array and DataView.setFloat16/getFloat16, eliminating the need for polyfills.

**Primary recommendation:** Implement the two-layer data delivery (HTTP bulk + DataChannel streaming), move TerrainNoise to the server, cache everything in Redis with seed-based invalidation, and delete the client's worldgen worker.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Two-Layer Architecture**: Layer 1 = bulk world map arrays via HTTP signaling response (gzipped); Layer 2 = per-chunk tile heights via CHUNK_REQUEST/CHUNK_DATA opcodes
- **Remove worldgen.worker.ts entirely** -- server is single source of truth, no offline/dev fallback
- **Remove discrete elevation bands** -- each tile sits at its exact computed Y from multi-layer noise
- **Multi-layer noise**: continental elevation + regional variation + fine local detail
- **PostgreSQL stores the world seed** (WORLD_SEED env var, defaults to 42)
- **Redis caches world map arrays and per-chunk tile heights** with seed-based auto-invalidation
- **Server validates player Y positions** against expected terrain height
- **Mountains defined by steepness** -- consistently steep terrain building through ridgelines and valleys
- **Snow peaks are impassable walls** -- the steepest biome, always building to a peak too steep to cross
- **All biomes can have steep terrain** -- gradient-based blocking (|srcY - dstY| > threshold) applies universally
- **Phase 3 sends world map + tile heights only** -- no decoration/detail layer (Phase 4)
- **Client vite config**: remove the @server/world/* path alias

### Claude's Discretion
- Exact noise function parameters for each layer (continental, regional, local)
- Height gradient threshold for movement blocking
- Float16 encoding scheme for per-tile heights
- Redis cache key structure and TTL policy
- Gzip compression implementation details
- Chunk request batching/prefetch strategy

### Deferred Ideas (OUT OF SCOPE)
- Per-region decoration data (trees, rocks, wildlife spawns) -- Phase 4
- Biome atmosphere effects (heat shimmer, shadows, fog) -- Phase 9
- Texture/skin pass for tile visuals -- future phase
- Stamina-based slope traversal cost -- future phase (requires stamina system)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TECH-03 | Server-side chunk generation replaces client-side generation -- chunk data streamed via existing CHUNK_REQUEST/CHUNK_DATA protocol opcodes (10-13) | Two-layer architecture: bulk world map via HTTP signaling, per-chunk heights via DataChannel opcodes 10-11. Server TerrainNoise generates heights, Redis caches, client receives and renders. |
| TECH-05 | Chunk storage uses binary format (bytea) instead of JSONB for 5-10x storage efficiency at world scale | Per-chunk tile heights stored as 2KB Float16 binary buffers in Redis (not PostgreSQL). Redis `setBuffer`/`getBuffer` for binary. Existing `chunk_data` PG table with JSONB is not used for tile heights -- Redis serves as the cache layer. |
| TECH-06 | Seedable PRNG (alea) used for all procedural generation to guarantee deterministic region reproduction | alea already installed (1.0.1) and used in worldgen. TerrainNoise uses LCG PRNG seeded deterministically. Same seed + same coordinates = identical output. Redis cache keyed by seed for invalidation. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ioredis | 5.10.1 | Redis client for caching world map and chunk data | Already installed, supports Buffer natively, `setBuffer`/`getBuffer` for binary |
| alea | 1.0.1 | Seedable PRNG for deterministic generation | Already installed, used throughout worldgen pipeline |
| simplex-noise | 4.0.3 | Noise generation for world map | Already installed, used in continents/elevation generation |
| Node.js zlib | built-in | Gzip compression for world map arrays | Native module, no external dependency, `gzipSync`/`gunzipSync` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Float16Array / DataView.setFloat16 | ES2025 (native) | 16-bit float encoding for per-tile heights | Node v25.8.1 and modern browsers support natively -- no polyfill needed |
| @fastify/compress | 8.3.1 | HTTP response compression | Only if auto-compressing all Fastify responses; manual zlib is simpler for this use case |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual zlib gzip | @fastify/compress | Plugin adds global compression; manual gzip gives precise control over which responses are compressed and how |
| Redis for chunk cache | PostgreSQL bytea | Redis is faster for hot data; PG bytea is durable but chunks are deterministic so re-computation is cheap |
| Float16 | Float32 | Float32 = 4KB/chunk vs Float16 = 2KB/chunk; Float16 has ~3 decimal digits precision which is sufficient for terrain heights (max range ~65504) |

**Installation:**
```bash
# No new dependencies needed -- all already installed
# If @fastify/compress is desired (optional):
cd packages/server && bun add @fastify/compress
```

## Architecture Patterns

### Recommended Project Structure
```
packages/server/src/world/
  worldgen.ts          # Existing world generation pipeline
  terrain-noise.ts     # NEW: moved from client, multi-layer noise for per-tile heights
  chunk-cache.ts       # NEW: Redis cache for world map arrays and per-chunk tile heights
  chunk-generator.ts   # NEW: generates per-chunk Float16 height buffers
  queries.ts           # Existing: add world map serialization for bulk delivery
  terrain.ts           # Existing: update walkability to use gradient blocking
  types.ts             # Existing: add chunk height types
  constants.ts         # Existing

packages/client/src/world/
  ChunkManager.ts      # Modified: receives data from server, no local generation
  TilePool.ts          # Unchanged: consumes terrainY resolver as before
  Chunk.ts             # Modified: remove cliff/ramp rendering, use smooth heights
  WorldConstants.ts    # Unchanged
  TerrainNoise.ts      # DELETED (moved to server)
  worldgen.worker.ts   # DELETED (server is single source of truth)

packages/client/src/net/
  NetworkManager.ts    # Modified: receives world map arrays in signaling response
  StateSync.ts         # Modified: handles CHUNK_DATA messages for per-tile heights
```

### Pattern 1: Two-Layer Data Delivery
**What:** World map arrays delivered via HTTP response; per-chunk heights streamed on demand via DataChannel
**When to use:** Initial client connection and ongoing chunk loading
**Example:**
```typescript
// Server: rtc.ts /offer endpoint -- add world map to signaling response
const worldMapBinary = await getOrCacheWorldMapBinary(config.world.seed);
// worldMapBinary is pre-gzipped Buffer from Redis

return {
  sdp: pc.localDescription!.sdp,
  type: pc.localDescription!.type,
  spawn: { x: entity.x, y: entity.y, z: entity.z, mapId: entity.mapId },
  iceServers: [...],
  worldMap: worldMapBinary.toString("base64"), // base64 for JSON transport
};

// Client: NetworkManager.ts -- decode world map from signaling response
const compressed = Uint8Array.from(atob(offer.worldMap), c => c.charCodeAt(0));
const decompressed = await decompressGzip(compressed);
// Parse typed arrays from decompressed buffer
```

### Pattern 2: Redis Cache with Seed Invalidation
**What:** All generated data cached in Redis with seed embedded in the key
**When to use:** Server startup and every chunk/worldmap request
**Example:**
```typescript
// Cache key includes seed for automatic invalidation
const WORLD_MAP_KEY = `worldmap:seed:${seed}`;
const CHUNK_KEY = (cx: number, cz: number) => `chunk:seed:${seed}:${cx}:${cz}`;

// On startup: check if cached world map matches current seed
const cached = await redis.getBuffer(WORLD_MAP_KEY);
if (cached) {
  // Use cached data -- no regeneration needed
} else {
  // Generate, serialize, cache
  const binary = serializeWorldMap(worldMap);
  const gzipped = zlib.gzipSync(binary);
  await redis.setBuffer(WORLD_MAP_KEY, gzipped);
  // No TTL -- world map persists until seed changes
}
```

### Pattern 3: Multi-Layer Noise for Per-Tile Heights
**What:** Three noise layers produce realistic terrain per-tile
**When to use:** Per-chunk height generation on the server
**Example:**
```typescript
// Layer 1: Continental elevation (from worldgen elevation array)
const continentalY = worldMap.elevation[chunkZ * WORLD_WIDTH + chunkX];

// Layer 2: Regional variation (biome-specific character)
const profile = BIOME_TERRAIN_PROFILES[biomeId];
let regionNoise = 0;
let freq = profile.frequency;
let amp = profile.amplitude;
for (let o = 0; o < profile.octaves; o++) {
  regionNoise += noise2d(tileX * freq, tileZ * freq) * amp;
  freq *= 2; amp *= 0.5;
}

// Layer 3: Fine local detail (universal, adds micro-variation)
const detail = noise2d(tileX * 0.15, tileZ * 0.15) * 0.1;

// Combine layers
const tileY = continentalY * CONTINENTAL_SCALE + regionNoise + detail;
```

### Pattern 4: Chunk Request/Response over DataChannel
**What:** Client requests chunks it needs; server computes/caches and returns heights
**When to use:** When player moves near unloaded chunks
**Example:**
```typescript
// Client: sends CHUNK_REQUEST via reliable DataChannel
network.sendReliable(packReliable(Opcode.CHUNK_REQUEST, { cx: 450, cz: 300 }));

// Server: handles CHUNK_REQUEST, generates or retrieves from Redis
const cacheKey = `chunk:seed:${seed}:${cx}:${cz}`;
let heightData = await redis.getBuffer(cacheKey);
if (!heightData) {
  heightData = generateChunkHeights(cx, cz); // Returns Float16 buffer (2048 bytes)
  await redis.setBuffer(cacheKey, heightData);
}
// Send back via reliable DataChannel
conn.reliableChannel.send(Buffer.from(packChunkData(cx, cz, heightData)));
```

### Anti-Patterns to Avoid
- **Sending Float32 elevation array to client:** The full 3.2MB Float32Array is unnecessary. Send Uint8 elevation bands (810KB) for chunk base planes, or compute base plane Y from the per-tile height average.
- **Client-side worldgen fallback:** The CONTEXT.md explicitly says "no offline/dev fallback." Delete the worker entirely.
- **Using JSON for chunk height data:** Binary Float16 is 2KB; JSON would be 10-20KB per chunk. Use binary over the DataChannel.
- **Storing per-chunk data in PostgreSQL:** Chunks are deterministic from seed -- Redis cache is sufficient. If Redis is flushed, regenerate on demand. PG bytea adds write latency and is overkill for reproducible data.
- **Compressing individual chunk responses:** At 2KB per chunk, the overhead of gzip framing (~18 bytes header) provides minimal benefit. Only gzip the bulk world map.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gzip compression | Custom compression | Node.js `zlib.gzipSync` / `zlib.gunzipSync` | Battle-tested, fast, streaming support if needed |
| Float16 encoding | Manual IEEE 754 half-precision bit manipulation | Native `DataView.setFloat16()` / `Float16Array` | ES2025 standard, Node v25+ and modern browsers support natively |
| Binary data in Redis | Base64 encoding of typed arrays | `redis.setBuffer()` / `redis.getBuffer()` | ioredis natively handles Buffer, no encoding overhead |
| Seedable PRNG | LCG or custom implementation | `alea` library | Already in use, well-tested, fast |
| Client-side decompression | Manual inflate | `DecompressionStream` API (web standard) | Available in all modern browsers, streaming decompression |

**Key insight:** Every building block for this phase already exists in the project or the platform. The work is integration and architecture, not library adoption.

## Common Pitfalls

### Pitfall 1: World Map Serialization Format Mismatch
**What goes wrong:** Client expects typed arrays in one order/format, server serializes differently
**Why it happens:** No explicit binary format specification; assumptions about array layout
**How to avoid:** Define a fixed binary header format: `[magic:u32][seed:u32][width:u16][height:u16][biomeMapLen:u32][elevBandsLen:u32][regionMapLen:u32][regionBiomesLen:u32]` followed by the raw array buffers in that exact order. Both server and client share this spec.
**Warning signs:** Client renders all-ocean or garbage terrain after connection

### Pitfall 2: Gzip in JSON Response
**What goes wrong:** Gzipped binary cannot be embedded directly in a JSON response from Fastify
**Why it happens:** JSON strings can't contain arbitrary binary bytes
**How to avoid:** Base64-encode the gzipped buffer before putting it in the JSON response. On the client, atob() + Uint8Array decode, then DecompressionStream or pako to decompress. Alternative: use a separate HTTP endpoint that returns raw binary with Content-Encoding: gzip.
**Warning signs:** JSON.parse errors, corrupted data

### Pitfall 3: DataChannel Binary Message Size Limits
**What goes wrong:** Large binary messages over WebRTC DataChannel may be fragmented or dropped
**Why it happens:** SCTP (underlying DataChannel transport) has MTU limits (~1200 bytes for unreliable, larger for reliable)
**How to avoid:** Per-chunk Float16 data is only 2KB + header, well within the reliable DataChannel's typical 16KB-256KB message limit. For the reliable channel (ordered), werift handles SCTP fragmentation. No batching needed at 2KB per message.
**Warning signs:** Chunk data arrives corrupted or incomplete

### Pitfall 4: Blocking the Game Loop with Chunk Generation
**What goes wrong:** Generating chunk heights synchronously in the game tick blocks position broadcasts
**Why it happens:** Multi-layer noise for 32x32 tiles involves 3072+ noise evaluations (1024 tiles x 3 layers)
**How to avoid:** Handle CHUNK_REQUEST in the reliable channel message handler (which runs on the connection's event loop, not the game tick interval). Use `setImmediate` or process in batches if needed. At ~0.1ms per chunk, even 10 simultaneous requests add only ~1ms.
**Warning signs:** Position updates lag when new players connect or teleport

### Pitfall 5: Race Condition Between World Map and Chunk Requests
**What goes wrong:** Client connects, starts requesting chunks before world map data is fully loaded
**Why it happens:** World map arrives via HTTP response, chunks requested after DataChannel opens
**How to avoid:** Client must fully parse and install world map data (biomeMap, elevationBands, regionMap, regionBiomes) before starting the game loop that triggers chunk requests. The existing flow already does this: `connectToServer()` is awaited before `start()` is called.
**Warning signs:** Chunk heights don't match biome expectations, visual discontinuities

### Pitfall 6: Client Decompression Browser Compatibility
**What goes wrong:** DecompressionStream API not available in older browsers
**Why it happens:** DecompressionStream is relatively new
**How to avoid:** Use a small fallback. DecompressionStream is supported in Chrome 80+, Firefox 113+, Safari 16.4+. For safety, the client can check `typeof DecompressionStream !== 'undefined'` and fall back to a manual inflate if needed (e.g., pako, ~45KB). However, given this is a WebRTC game that already requires modern browsers, DecompressionStream is safe to use.
**Warning signs:** Connection works but world map fails to load on specific browsers

### Pitfall 7: Elevation Band Removal Breaking MovementSystem
**What goes wrong:** Removing elevation bands breaks the `canMoveTo` check that uses `elevationBandResolver`
**Why it happens:** Current MovementSystem has two checks: elevation band difference AND per-tile height difference. Removing bands while keeping the gradient check is correct, but both client and server must be updated consistently.
**How to avoid:** Replace the dual check with a single gradient-based check: `|srcY - dstY| > HEIGHT_GRADIENT_THRESHOLD`. Update both MovementSystem (client) and position validation (server). The threshold should be tuned per the user's terrain quality goals.
**Warning signs:** Players can walk up impossibly steep terrain, or are blocked on gentle slopes

## Code Examples

### World Map Binary Serialization
```typescript
// Source: Custom for this project, based on existing typed array patterns

/** Serialize world map arrays into a single binary buffer for transport */
export function serializeWorldMap(
  biomeMap: Uint8Array,
  elevationBands: Uint8Array,
  regionMap: Uint16Array,
  regionBiomes: Uint8Array,
  seed: number,
  width: number,
  height: number,
): Buffer {
  const headerSize = 4 + 4 + 2 + 2 + 4 * 4; // magic + seed + w + h + 4 lengths
  const totalSize = headerSize
    + biomeMap.byteLength
    + elevationBands.byteLength
    + regionMap.byteLength
    + regionBiomes.byteLength;

  const buf = Buffer.alloc(totalSize);
  let offset = 0;

  // Header
  buf.writeUInt32LE(0x574D4150, offset); offset += 4; // "WMAP" magic
  buf.writeUInt32LE(seed, offset); offset += 4;
  buf.writeUInt16LE(width, offset); offset += 2;
  buf.writeUInt16LE(height, offset); offset += 2;
  buf.writeUInt32LE(biomeMap.byteLength, offset); offset += 4;
  buf.writeUInt32LE(elevationBands.byteLength, offset); offset += 4;
  buf.writeUInt32LE(regionMap.byteLength, offset); offset += 4;
  buf.writeUInt32LE(regionBiomes.byteLength, offset); offset += 4;

  // Payloads
  Buffer.from(biomeMap.buffer).copy(buf, offset); offset += biomeMap.byteLength;
  Buffer.from(elevationBands.buffer).copy(buf, offset); offset += elevationBands.byteLength;
  Buffer.from(regionMap.buffer, regionMap.byteOffset, regionMap.byteLength).copy(buf, offset);
  offset += regionMap.byteLength;
  Buffer.from(regionBiomes.buffer).copy(buf, offset);

  return buf;
}
```

### Client-Side Decompression and Parsing
```typescript
// Source: Custom for this project

/** Decompress gzipped world map and extract typed arrays */
async function parseWorldMapBinary(base64Data: string): Promise<{
  seed: number; width: number; height: number;
  biomeMap: Uint8Array; elevationBands: Uint8Array;
  regionMap: Uint16Array; regionBiomes: Uint8Array;
}> {
  // Decode base64
  const binary = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  // Decompress gzip
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(binary);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const decompressed = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let pos = 0;
  for (const c of chunks) { decompressed.set(c, pos); pos += c.length; }

  // Parse header
  const view = new DataView(decompressed.buffer);
  let offset = 0;
  const magic = view.getUint32(offset, true); offset += 4;
  if (magic !== 0x574D4150) throw new Error("Invalid world map magic");
  const seed = view.getUint32(offset, true); offset += 4;
  const width = view.getUint16(offset, true); offset += 2;
  const height = view.getUint16(offset, true); offset += 2;
  const biomeLen = view.getUint32(offset, true); offset += 4;
  const elevLen = view.getUint32(offset, true); offset += 4;
  const regionLen = view.getUint32(offset, true); offset += 4;
  const regionBiomesLen = view.getUint32(offset, true); offset += 4;

  // Extract arrays
  const biomeMap = new Uint8Array(decompressed.buffer, offset, biomeLen); offset += biomeLen;
  const elevationBands = new Uint8Array(decompressed.buffer, offset, elevLen); offset += elevLen;
  const regionMap = new Uint16Array(decompressed.buffer.slice(offset, offset + regionLen));
  offset += regionLen;
  const regionBiomes = new Uint8Array(decompressed.buffer, offset, regionBiomesLen);

  return { seed, width, height, biomeMap, elevationBands, regionMap, regionBiomes };
}
```

### Per-Chunk Height Generation (Server)
```typescript
// Source: Adapted from existing client TerrainNoise.ts patterns

/** Generate per-tile heights for a chunk, returns 2048-byte Float16 buffer */
export function generateChunkHeights(
  chunkX: number, chunkZ: number,
  worldMap: WorldMap,
  noisePerm: Uint8Array,
): Buffer {
  const CHUNK_SIZE = 32;
  const buf = Buffer.alloc(CHUNK_SIZE * CHUNK_SIZE * 2); // Float16 = 2 bytes per tile
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const chunkIdx = chunkZ * worldMap.width + chunkX;
  const continentalElev = worldMap.elevation[chunkIdx];
  const biomeId = worldMap.biomeMap[chunkIdx];
  const profile = BIOME_TERRAIN_PROFILES[biomeId];

  for (let tz = 0; tz < CHUNK_SIZE; tz++) {
    for (let tx = 0; tx < CHUNK_SIZE; tx++) {
      const tileX = chunkX * CHUNK_SIZE + tx;
      const tileZ = chunkZ * CHUNK_SIZE + tz;

      // Layer 1: Continental base
      const base = continentalElev * CONTINENTAL_SCALE;

      // Layer 2: Regional noise (biome-specific)
      let regional = 0;
      let freq = profile.frequency;
      let amp = profile.amplitude;
      for (let o = 0; o < profile.octaves; o++) {
        regional += (noise2d(tileX * freq, tileZ * freq, noisePerm) + 1) * 0.5 * amp;
        freq *= 2; amp *= 0.5;
      }

      // Layer 3: Fine detail
      const detail = (noise2d(tileX * 0.15, tileZ * 0.15, noisePerm) + 1) * 0.5 * 0.1;

      const tileY = base + regional + detail;
      const idx = (tz * CHUNK_SIZE + tx) * 2;
      view.setFloat16(idx, tileY, true); // little-endian
    }
  }

  return buf;
}
```

### CHUNK_DATA Message Format
```typescript
// Binary format for chunk data over DataChannel
// [opcode:u8] [chunkX:i16LE] [chunkZ:i16LE] [heightData:2048 bytes Float16]
// Total: 1 + 2 + 2 + 2048 = 2053 bytes

export function packChunkData(cx: number, cz: number, heightData: Buffer): Buffer {
  const HEADER = 5; // opcode(1) + cx(2) + cz(2)
  const buf = Buffer.alloc(HEADER + heightData.length);
  buf.writeUInt8(Opcode.CHUNK_DATA, 0);
  buf.writeInt16LE(cx, 1);
  buf.writeInt16LE(cz, 3);
  heightData.copy(buf, HEADER);
  return buf;
}

export function packChunkRequest(cx: number, cz: number): string {
  return JSON.stringify({ op: Opcode.CHUNK_REQUEST, cx, cz });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side worldgen in web worker | Server generates, streams to client | This phase | Server is single source of truth for all terrain |
| 7 discrete elevation bands (flat steps + cliffs) | Smooth per-tile noise heights | This phase | Realistic rolling terrain, no visual stairstepping |
| Client imports @server/world via Vite alias | Server-only world code, clean package separation | This phase | Eliminates cross-package dependency, cleaner builds |
| JSONB for chunk storage (existing schema) | Binary Float16 in Redis | This phase | 10x less storage, microsecond retrieval |
| Float32 for tile heights | Float16 for network transport | This phase | 50% bandwidth reduction, sufficient precision for terrain Y |

**Deprecated/outdated:**
- `worldgen.worker.ts`: Deleted entirely -- server owns generation
- `TerrainNoise.ts` (client): Moved to server, enhanced with multi-layer noise
- `ELEVATION_STEP_HEIGHT` / elevation bands: Replaced by smooth per-tile heights
- Cliff/ramp rendering in `Chunk.ts`: Removed -- smooth terrain has no discrete cliffs
- `@server/world` Vite alias in client config: Removed -- client never imports server code
- `getElevationBand()` in ChunkManager: Replaced by per-tile terrainY from server data

## Data Size Analysis

### Layer 1: World Map Arrays (HTTP Bulk)
| Array | Type | Size | Purpose |
|-------|------|------|---------|
| biomeMap | Uint8Array | 810,000 bytes (810 KB) | Per-chunk biome IDs for coloring |
| elevationBands | Uint8Array | 810,000 bytes (810 KB) | Per-chunk elevation bands for base plane Y |
| regionMap | Uint16Array | 1,620,000 bytes (1.6 MB) | Per-chunk region IDs |
| regionBiomes | Uint8Array | ~500 bytes | Region ID to biome mapping |
| **Total raw** | | **~3.2 MB** | |
| **Gzipped** | | **~40-400 KB** | Spatially coherent data compresses 8-80x |

Note: Actual gzip ratio depends on data entropy. Simulated spatially coherent data compresses to ~40KB. Real-world data with more variation may reach ~100-200KB. The 400KB estimate from CONTEXT.md is conservative.

### Layer 2: Per-Chunk Tile Heights (DataChannel Streaming)
| Property | Value |
|----------|-------|
| Tiles per chunk | 32 x 32 = 1024 |
| Bytes per tile | 2 (Float16) |
| Raw chunk data | 2,048 bytes (2 KB) |
| With header | 2,053 bytes |
| Chunks in load radius 2 | (2*2+1)^2 = 25 chunks |
| Initial load payload | ~50 KB |

### Float16 Precision Assessment
| Property | Value |
|----------|-------|
| Range | -65504 to +65504 |
| Precision | ~3.3 significant decimal digits |
| Terrain Y range | ~0.0 to ~15.0 world units (7 elev levels x 1.5 + noise) |
| Resolution at Y=10 | ~0.01 world units |
| Acceptable? | Yes -- visual difference is sub-pixel at camera distance |

## Open Questions

1. **Elevation bands for chunk base planes -- keep or derive?**
   - What we know: Discrete elevation bands are being removed for tile heights. But the Chunk base plane mesh still needs a Y position.
   - What's unclear: Should chunk base planes use the average of the 1024 per-tile heights in that chunk, or should we keep sending elevationBands as a simple Uint8Array for base plane positioning?
   - Recommendation: Keep elevationBands Uint8Array in the world map bulk data for now. It's only 810KB and gives a clean chunk base plane Y without needing per-tile height data first. The base plane is a distant visual backdrop anyway.

2. **Height gradient threshold value**
   - What we know: Current MovementSystem has `MAX_TILE_HEIGHT_DIFF = 0.8` world units. Mountains need "consistently steep terrain" per user. Snow peaks must be "impassable walls."
   - What's unclear: What threshold values produce the right feel for each biome character.
   - Recommendation: Keep 0.8 as the universal gradient threshold. Tune biome noise profiles to make mountains naturally produce many tile pairs exceeding 0.8, while grassland produces few. Snow peaks get extreme amplitude/frequency so almost all tiles exceed threshold. This is a tuning task, not a threshold-per-biome task.

3. **Server-side Y validation precision**
   - What we know: Server must validate player Y matches expected terrain height. Server uses Float64 noise computation, client receives Float16.
   - What's unclear: What tolerance to use for Y validation given Float16 quantization.
   - Recommendation: Allow a tolerance of 0.1 world units (much larger than Float16 error at typical terrain heights). This catches fly hacks (Y off by several units) while accepting Float16 rounding.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `packages/server/vitest.config.ts` (server), `packages/client/vitest.config.ts` (client) |
| Quick run command | `cd packages/server && bun run test` |
| Full suite command | `cd packages/server && bun run test && cd ../client && bun run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TECH-03 | Server generates chunk data and streams via CHUNK_DATA opcode | unit | `cd packages/server && bunx vitest run src/world/chunk-generator.test.ts -t "generates" --reporter=verbose` | No -- Wave 0 |
| TECH-03 | Client receives and applies world map from signaling response | unit | `cd packages/client && bunx vitest run src/net/NetworkManager.test.ts -t "world map" --reporter=verbose` | No -- Wave 0 |
| TECH-05 | Chunk heights stored as binary Float16 in Redis | unit | `cd packages/server && bunx vitest run src/world/chunk-cache.test.ts -t "binary" --reporter=verbose` | No -- Wave 0 |
| TECH-06 | Same seed always produces identical terrain | unit | `cd packages/server && bunx vitest run src/world/chunk-generator.test.ts -t "deterministic" --reporter=verbose` | No -- Wave 0 |
| TECH-06 | Redis cache invalidated when seed changes | unit | `cd packages/server && bunx vitest run src/world/chunk-cache.test.ts -t "seed invalidation" --reporter=verbose` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/server && bun run test` (server tests most critical for this phase)
- **Per wave merge:** `cd packages/server && bun run test && cd ../client && bun run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/world/chunk-generator.test.ts` -- covers TECH-03, TECH-06 (deterministic generation, Float16 output)
- [ ] `packages/server/src/world/chunk-cache.test.ts` -- covers TECH-05, TECH-06 (Redis binary storage, seed invalidation)
- [ ] `packages/server/src/world/terrain-noise.test.ts` -- covers multi-layer noise determinism, biome profile correctness
- [ ] `packages/client/src/world/ChunkManager.test.ts` -- covers client-side chunk data reception and terrain Y resolution

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All canonical references from CONTEXT.md read and analyzed
- Node.js v25.8.1: Verified Float16Array and DataView.setFloat16/getFloat16 work natively
- ioredis 5.10.1: Verified `setBuffer`/`getBuffer` for binary data handling
- zlib (Node built-in): Verified gzipSync/gunzipSync available

### Secondary (MEDIUM confidence)
- [MDN Float16Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float16Array) -- ES2025 standard, Stage 4, shipping in browsers since April 2025
- [MDN DataView.setFloat16](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setFloat16) -- confirmed available in Node and browsers
- [ioredis binary data](https://ioredis.com/can-i-handle-binary-data-with-ioredis/) -- confirmed Buffer support, `getBuffer` variant
- [@fastify/compress](https://github.com/fastify/fastify-compress) -- v8.3.1 available if needed

### Tertiary (LOW confidence)
- Gzip compression ratios: Simulated with synthetic spatially coherent data. Real world map data will have different entropy. The 40-400KB range is estimated; actual measurement needed during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use, no new dependencies
- Architecture: HIGH -- two-layer delivery pattern well-defined by CONTEXT.md decisions, all integration points identified in existing code
- Pitfalls: HIGH -- identified through direct codebase analysis, particularly the serialization format, DataChannel limits, and elevation band removal cascade
- Data sizes: MEDIUM -- raw sizes computed precisely, gzip ratios estimated from simulation
- Noise parameters: MEDIUM -- biome profiles exist but multi-layer tuning is discretionary and requires iteration

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain, no fast-moving dependencies)
