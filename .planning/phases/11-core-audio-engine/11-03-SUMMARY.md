---
phase: 11-core-audio-engine
plan: 03
subsystem: protocol, api, ui
tags: [webrtc, opcodes, jsonb, drizzle, settings-ui, volume-sliders]

# Dependency graph
requires:
  - phase: 11-01
    provides: AudioPreferences type and DEFAULT_AUDIO_PREFERENCES constants
provides:
  - ENEMY_NEARBY (70) and ZONE_MUSIC_TAG (71) protocol opcodes across shared/server/client
  - Server-side enemy proximity detection (16-tile radius, state-change debounced)
  - Account-level audio preferences persistence (JSONB column + PUT API)
  - SettingsMenu UI component with 3 volume sliders in GameHUD
  - StateSync callbacks for ENEMY_NEARBY and ZONE_MUSIC_TAG events
affects: [11-04, audio-integration, zone-system, safe-zones]

# Tech tracking
tech-stack:
  added: []
  patterns: [state-change-debounced server events, JSONB preference merge-on-update, gear-icon toggle panel]

key-files:
  created:
    - packages/client/src/ui/components/SettingsMenu.ts
  modified:
    - packages/shared/protocol.json
    - packages/server/src/game/protocol.ts
    - packages/client/src/net/Protocol.ts
    - packages/server/src/game/world.ts
    - packages/client/src/net/StateSync.ts
    - packages/server/src/db/schema.ts
    - packages/server/src/routes/auth.ts
    - packages/client/src/ui/screens/GameHUD.ts

key-decisions:
  - "Enemy proximity uses Manhattan distance (abs(dx)+abs(dz) <= 16) not Chebyshev for detection radius"
  - "enemyNearbyState cleaned up on disconnect via clearHashCache to prevent memory leaks"
  - "Preferences merged server-side (spread existing + new) to allow partial updates"

patterns-established:
  - "State-change debounced events: server tracks per-player state maps, only sends on transition"
  - "JSONB merge-on-update: PUT endpoint merges new keys into existing preferences object"

requirements-completed: [AUDIO-01, AUDIO-02]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 11 Plan 03: Audio Protocol and Settings Summary

**ENEMY_NEARBY/ZONE_MUSIC_TAG opcodes with server proximity detection, account preferences JSONB persistence, and settings menu with volume sliders**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T00:48:30Z
- **Completed:** 2026-03-20T00:53:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- ENEMY_NEARBY (70) and ZONE_MUSIC_TAG (71) opcodes added to all 3 protocol files (shared JSON, server, client)
- Server game loop detects enemy proximity state changes per-player within 16-tile Manhattan radius and sends debounced events
- Account preferences JSONB column with PUT /preferences merge-on-update API
- SettingsMenu component with gear icon, 3 volume sliders, dark theme matching GameHUD

## Task Commits

Each task was committed atomically:

1. **Task 1: Protocol opcodes, server proximity detection, and zone music tags** - `0038195` (feat)
2. **Task 2: Account audio preferences (DB + API) and Settings menu UI** - `933135c` (feat)

## Files Created/Modified
- `packages/shared/protocol.json` - Added ENEMY_NEARBY (70), ZONE_MUSIC_TAG (71), SPAWN_POINT (60), WORLD_READY (100) opcodes
- `packages/server/src/game/protocol.ts` - Added opcodes + packEnemyNearby/packZoneMusicTag functions
- `packages/client/src/net/Protocol.ts` - Added ENEMY_NEARBY and ZONE_MUSIC_TAG opcodes
- `packages/server/src/game/world.ts` - Enemy proximity detection in game loop, 16-tile radius, state-change debounced
- `packages/client/src/net/StateSync.ts` - EnemyNearbyCallback/ZoneMusicTagCallback types, handlers in reliable message switch
- `packages/server/src/db/schema.ts` - preferences JSONB column on accounts table
- `packages/server/src/routes/auth.ts` - accountToJson includes preferences, PUT /preferences merge endpoint
- `packages/client/src/ui/components/SettingsMenu.ts` - New: gear icon toggle, 3 volume sliders (Master, Music, SFX)
- `packages/client/src/ui/screens/GameHUD.ts` - Mounts SettingsMenu in bottom-right corner

## Decisions Made
- Enemy proximity uses Manhattan distance (abs(dx)+abs(dz) <= 16) rather than Chebyshev to match the plan specification
- enemyNearbyState map cleaned up in clearHashCache to prevent memory leaks on disconnect
- Preferences merged server-side using spread operator for partial update support
- ZONE_MUSIC_TAG opcode and handler created now (ready for future zone definitions) but not yet sent by server

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added enemyNearbyState cleanup on disconnect**
- **Found during:** Task 1 (proximity detection implementation)
- **Issue:** enemyNearbyState Map would leak entries for disconnected players
- **Fix:** Added `enemyNearbyState.delete(entityId)` in clearHashCache function
- **Files modified:** packages/server/src/game/world.ts
- **Verification:** clearHashCache now cleans both hashCache and enemyNearbyState
- **Committed in:** 0038195 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added missing SPAWN_POINT and WORLD_READY to shared protocol.json**
- **Found during:** Task 1 (protocol opcode additions)
- **Issue:** shared/protocol.json was missing SPAWN_POINT (60) and WORLD_READY (100) that existed in server/client protocol files
- **Fix:** Added both opcodes to shared JSON to maintain consistency
- **Files modified:** packages/shared/protocol.json
- **Verification:** All three protocol files now have matching opcode sets
- **Committed in:** 0038195 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for correctness and consistency. No scope creep.

## Issues Encountered
- Database push initially failed with wrong credentials (postgres:postgres vs game:game_dev_password) - resolved by reading drizzle.config.ts

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Protocol opcodes and StateSync callbacks ready for audio state machine integration (Plan 04)
- SettingsMenu volume change callback ready to wire into AudioSystem
- Server proximity detection active for ENEMY_NEARBY events
- ZONE_MUSIC_TAG handler ready to receive data when zone system sends music tags

## Self-Check: PASSED

All 8 modified/created files verified on disk. Both task commits (0038195, 933135c) verified in git log.

---
*Phase: 11-core-audio-engine*
*Completed: 2026-03-20*
