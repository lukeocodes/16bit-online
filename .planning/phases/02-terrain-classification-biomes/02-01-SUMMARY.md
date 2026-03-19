---
phase: 02-terrain-classification-biomes
plan: 01
subsystem: world-generation
tags: [river-tracing, lake-detection, elevation-banding, walkability, worldgen, alea, typed-arrays]

# Dependency graph
requires:
  - phase: 01-world-map-data-layer
    provides: BiomeType enum, WorldMap with biomeMap/elevation/moisture/landmask, worldgen pipeline
provides:
  - Extended BiomeType enum with RIVER=16 and LAKE=17
  - isWalkable() and isBiomeWalkable() terrain walkability functions
  - getElevationBand() quantizing continuous elevation to 7 discrete levels
  - generateRiversAndLakes() river tracing and lake basin detection
  - BLOCKING_BIOMES set (5 impassable terrain types)
  - River valley post-processing (RIVER_VALLEY biome adjacent to rivers)
affects: [02-02-tile-rendering, 02-03-movement-blocking, 03-chunk-streaming, server-position-validation, npc-wander]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-strategy-lake-detection, flow-accumulation-river-width, seeded-prng-shuffled-candidates]

key-files:
  created:
    - packages/server/src/world/terrain.ts
    - packages/server/src/world/rivers.ts
    - packages/server/src/world/terrain.test.ts
    - packages/server/src/world/rivers.test.ts
  modified:
    - packages/server/src/world/types.ts
    - packages/server/src/world/constants.ts
    - packages/server/src/world/worldgen.ts
    - packages/server/src/world/queries.test.ts

key-decisions:
  - "Dual-strategy lake detection: natural basin detection for explicit basins plus seeded placement for smooth noise terrain"
  - "River width based on per-river flow accumulation (not global), preventing excessive river coverage"
  - "Basin detection requires at least one cardinal neighbor 0.03+ elevation higher to avoid false positives on flat terrain"
  - "Seeded lakes capped at 200 chunks per lake and 15 placement attempts per world"
  - "River valley marking uses 8-connected neighbors (cardinal + diagonal)"

patterns-established:
  - "BLOCKING_BIOMES set pattern: centralized Set<number> for O(1) walkability lookup"
  - "Elevation banding: 7 discrete levels with boundary-based quantization"
  - "Worldgen pipeline extension: new passes inserted between biome classification and region assignment"

requirements-completed: [WORLD-02, WORLD-03]

# Metrics
duration: 13min
completed: 2026-03-19
---

# Phase 02 Plan 01: Terrain Data Layer Summary

**River tracing with variable-width flow accumulation, dual-strategy lake detection, walkability lookup via BLOCKING_BIOMES set, and 7-level elevation banding integrated into worldgen pipeline**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-19T21:45:38Z
- **Completed:** 2026-03-19T21:58:50Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Extended BiomeType enum with RIVER=16 and LAKE=17, keeping all 16 existing values stable
- Created terrain.ts with isWalkable(), getElevationBand(), isBiomeWalkable(), BLOCKING_BIOMES, and ELEVATION_BANDS
- Implemented river tracing algorithm with downhill flow, variable width (1-8 chunks), and ocean/lake termination
- Implemented dual-strategy lake detection (natural basins + seeded placement) with minimum size enforcement
- Integrated river/lake generation into worldgen pipeline between biome classification and region biome assignment
- Full world (900x900) generates in ~1.1s with ~11,500 river chunks, ~2,900 lake chunks, ~5,400 river valley chunks

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend BiomeType enum and create terrain utilities** - `70cdfa0` (test), `5020213` (feat)
2. **Task 2: Implement river tracing and lake detection** - `6c88997` (test), `13b2ce0` (feat)

_TDD tasks have separate RED (test) and GREEN (feat) commits._

## Files Created/Modified
- `packages/server/src/world/types.ts` - Added RIVER=16 and LAKE=17 to BiomeType enum
- `packages/server/src/world/constants.ts` - Added elevation, river, and lake generation constants
- `packages/server/src/world/terrain.ts` - Walkability lookup, elevation banding, BLOCKING_BIOMES set
- `packages/server/src/world/rivers.ts` - River tracing and lake basin detection algorithms
- `packages/server/src/world/worldgen.ts` - Integrated generateRiversAndLakes into pipeline
- `packages/server/src/world/terrain.test.ts` - 17 tests for terrain utilities
- `packages/server/src/world/rivers.test.ts` - 11 tests for river/lake generation
- `packages/server/src/world/queries.test.ts` - Updated BiomeType range check for 0-17

## Decisions Made
- Used dual-strategy lake detection because noise-generated terrain on 900x900 grid rarely produces natural basins (all cardinal neighbors higher), so seeded placement fills the gap
- River width based on per-river flow accumulation rather than global flow to prevent rivers from consuming excessive land area
- Basin detection requires minimum 0.03 elevation rim to distinguish real basins from noise-flat terrain
- Seeded lakes limited to 15 attempts and 200 chunks max per lake to keep total water coverage under 10% of land
- River valley uses 8-connected adjacency (not just 4-cardinal) for natural appearance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated queries.test.ts BiomeType range check**
- **Found during:** Task 2 (full test suite regression check)
- **Issue:** Existing test in queries.test.ts expected biome values 0-15, but RIVER=16 and LAKE=17 are now valid
- **Fix:** Updated `toBeLessThanOrEqual(15)` to `toBeLessThanOrEqual(17)` in getBiomeForChunk test
- **Files modified:** packages/server/src/world/queries.test.ts
- **Verification:** All 430 tests pass
- **Committed in:** 13b2ce0 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed lake detection flooding entire world**
- **Found during:** Task 2 (implementation testing)
- **Issue:** Initial basin detection treated flat terrain (equal-elevation neighbors) as basins, flooding 95%+ of land as LAKE
- **Fix:** Required basin candidates to have at least one neighbor 0.03+ higher, added 200-chunk max per lake, added dual-strategy detection
- **Files modified:** packages/server/src/world/rivers.ts
- **Verification:** Lake coverage now under 10% of land, deterministic from seed
- **Committed in:** 13b2ce0 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Noise-generated terrain at 900x900 chunk resolution rarely creates natural elevation basins (all 4 cardinal neighbors higher), requiring the addition of a seeded lake placement strategy alongside natural basin detection
- River width expansion on small test grids caused lake flooding to overwhelm the test grid, requiring careful test grid design with elevation above the seeded lake range

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- terrain.ts isWalkable() ready for server-side position validation (Plan 02-03)
- BLOCKING_BIOMES and isBiomeWalkable() ready for client-side tile walkability (Plan 02-02)
- getElevationBand() and ELEVATION_BANDS ready for client stepped terrain rendering (Plan 02-02)
- River/lake data baked into biomeMap for chunk streaming (Phase 3)
- All existing tests continue to pass (430 total)

## Self-Check: PASSED

All 5 created/modified files verified on disk. All 4 commit hashes verified in git log.

---
*Phase: 02-terrain-classification-biomes*
*Completed: 2026-03-19*
