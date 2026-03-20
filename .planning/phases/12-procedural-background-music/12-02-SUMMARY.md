---
phase: 12-procedural-background-music
plan: 02
subsystem: audio
tags: [tone-js, web-audio, procedural-music, proximity-mixer, track-registry]

# Dependency graph
requires:
  - phase: 11-core-audio-engine
    provides: "AudioSystem, GainBus, MusicStateMachine, CrossfadeManager, types (MusicState enum)"
provides:
  - "BaseTrack abstract class with start/stop/connect/dispose lifecycle"
  - "ProximityMixer for distance-based stem fading using Manhattan distance"
  - "TrackRegistry mapping MusicState + zoneTag to track factories with default fallback"
affects: [12-procedural-background-music]

# Tech tracking
tech-stack:
  added: []
  patterns: ["BaseTrack lifecycle (start/stop/dispose)", "AudioParam automation for gain ramps", "Manhattan distance proximity fading", "State + zoneTag registry with default fallback"]

key-files:
  created:
    - packages/client/src/audio/music/BaseTrack.ts
    - packages/client/src/audio/music/ProximityMixer.ts
    - packages/client/src/audio/music/TrackRegistry.ts
    - packages/client/src/audio/__tests__/ProximityMixer.test.ts
    - packages/client/src/audio/__tests__/TrackRegistry.test.ts
  modified: []

key-decisions:
  - "ProximityMixer uses Manhattan distance (abs(dx)+abs(dz)) consistent with Phase 11 enemy proximity detection"
  - "TrackRegistry first-registered-per-state becomes default fallback for zones without specific tags"
  - "BaseTrack uses generic Tone.ToneAudioNode array for synths to support any Tone synth type"

patterns-established:
  - "Track lifecycle: extend BaseTrack, implement start(), push samplers/sequences/synths to arrays, dispose is automatic"
  - "Proximity stem fading: addStem with triggerDistance/fullDistance, call update() on game tick"
  - "Track lookup: register(id, state, zoneTag, factory) then getTrack(state, zoneTag) with fallback"

requirements-completed: [AUDIO-03]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 12 Plan 02: Track Lifecycle Framework Summary

**BaseTrack abstract class, Manhattan-distance ProximityMixer, and MusicState+zoneTag TrackRegistry with 19 unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T13:12:40Z
- **Completed:** 2026-03-20T13:16:45Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- BaseTrack abstract class provides automatic sampler/sequence/synth disposal lifecycle for all 16 music tracks
- ProximityMixer fades stems smoothly by Manhattan distance with AudioParam automation (0.3s ramp)
- TrackRegistry resolves MusicState + zoneTag to correct track factory with first-registered default fallback
- Full TDD coverage: 7 ProximityMixer tests + 12 TrackRegistry tests = 19 total, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: BaseTrack + ProximityMixer** - `257cee7` (test, TDD RED) then `78d211c` (feat, TDD GREEN)
2. **Task 2: TrackRegistry** - `6aeaec0` (test, TDD RED) then `7ac4ee7` (feat, TDD GREEN)

_TDD tasks each have two commits (failing test then implementation)_

## Files Created/Modified
- `packages/client/src/audio/music/BaseTrack.ts` - Abstract base class with start/stop/connect/dispose lifecycle, manages sampler/sequence/synth arrays
- `packages/client/src/audio/music/ProximityMixer.ts` - Distance-based stem fading using Manhattan distance and AudioParam gain automation
- `packages/client/src/audio/music/TrackRegistry.ts` - State + zoneTag to TrackFactory mapping with default-per-state fallback
- `packages/client/src/audio/__tests__/ProximityMixer.test.ts` - 7 tests: distance interpolation, Manhattan vs Euclidean, dispose, multi-stem
- `packages/client/src/audio/__tests__/TrackRegistry.test.ts` - 12 tests: register, exact match, zoneTag variants, defaults, clear, fallback

## Decisions Made
- ProximityMixer uses Manhattan distance (consistent with Phase 11 enemy proximity detection at 16 tiles)
- TrackRegistry uses first-registered-per-state as default fallback (Human Town will be the default "town" track)
- BaseTrack stores synths as Tone.ToneAudioNode[] rather than Tone.Synth[] to support PolySynth, FMSynth, NoiseSynth, etc.
- Mock AudioContext pattern in tests: gainNodes carry back-reference to ctx for `gainNode.context.currentTime` access

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added context back-reference to mock GainNode**
- **Found during:** Task 1 (ProximityMixer tests)
- **Issue:** ProximityMixer.update() accesses `gainNode.context.currentTime` but mock GainNodes had no `context` property
- **Fix:** Added `node.context = ctx` back-reference in createMockAudioContext helper
- **Files modified:** packages/client/src/audio/__tests__/ProximityMixer.test.ts
- **Verification:** All 7 tests pass
- **Committed in:** 78d211c (Task 1 implementation commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test mock needed trivial adjustment to match real Web Audio API shape. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BaseTrack, ProximityMixer, and TrackRegistry ready for Plan 03 to define and register all 16 music tracks
- TrackFactory type exported for use by individual track definitions
- ProximityMixer ready for town tracks with proximity stems (tavern, forge, temple)

## Self-Check: PASSED

All 5 created files verified on disk. All 4 task commits verified in git log.

---
*Phase: 12-procedural-background-music*
*Completed: 2026-03-20*
