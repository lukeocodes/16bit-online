---
phase: 11-core-audio-engine
plan: 01
subsystem: audio
tags: [tone.js, howler.js, web-audio-api, gain-bus, audio-context, vitest]

# Dependency graph
requires: []
provides:
  - AudioSystem class with 4 gain buses (music, sfx, weather, ambient) routed through master gain
  - GainBus wrapper with volume/mute/unmute/fadeTo using AudioParam automation
  - ToneSetup for Tone.js initialization and shared AudioContext access
  - HowlerBridge connecting Howler.masterGain to SFX bus
  - Audio type system (MusicState enum, BusName type, AudioPreferences interface)
  - Tab visibility ducking (10% on hidden, instant restore)
  - Master intensity variable (0.0-1.0) scaling bus gains
affects: [11-02, 11-03, 11-04, 12, 13, 14]

# Tech tracking
tech-stack:
  added: [tone 15.1.22, howler 2.2.4, "@types/howler 2.2.12", happy-dom 20.8.4, standardized-audio-context-mock 9.7.28]
  patterns: [gain-bus-architecture, audio-param-automation, visibility-ducking, tone-context-sharing]

key-files:
  created:
    - packages/client/src/audio/types.ts
    - packages/client/src/audio/GainBus.ts
    - packages/client/src/audio/ToneSetup.ts
    - packages/client/src/audio/HowlerBridge.ts
    - packages/client/src/audio/AudioSystem.ts
    - packages/client/src/audio/__tests__/GainBus.test.ts
    - packages/client/src/audio/__tests__/AudioSystem.test.ts
  modified:
    - packages/client/package.json
    - packages/client/vite.config.ts

key-decisions:
  - "Used happy-dom instead of jsdom for vitest DOM environment (lighter weight, faster)"
  - "AudioParam automation (linearRampToValueAtTime) for all gain changes to prevent clicks/pops"
  - "Master intensity scales music/weather fully but SFX only 50% (combat sounds stay audible)"

patterns-established:
  - "GainBus pattern: always use AudioParam automation, never direct gain.value assignment"
  - "Audio test mocking: vi.mock('tone') with mock context + happy-dom for DOM APIs"
  - "Vite audio chunk splitting: tone + standardized-audio-context in separate 'audio' chunk"

requirements-completed: [AUDIO-01]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 11 Plan 01: Core Audio Engine Foundation Summary

**Tone.js/Howler.js gain bus architecture with 4 buses, visibility ducking, master intensity, and AudioContext lifecycle management**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T00:41:46Z
- **Completed:** 2026-03-20T00:45:54Z
- **Tasks:** 2
- **Files modified:** 9 (2 modified, 7 created)

## Accomplishments
- Installed Tone.js 15.x, Howler.js 2.x, and configured Vite audio chunk splitting
- Created complete audio type system: MusicState enum (7 states with priority ordering), BusName type, AudioPreferences interface, crossfade durations, victory timeout
- Implemented GainBus class with volume/mute/unmute/fadeTo all using AudioParam automation to prevent clicks/pops
- Built AudioSystem with 4 gain buses (music, sfx, weather, ambient) through master gain, tab visibility ducking, master intensity scaling, and AudioContext resume on user interaction
- Wired Howler.js masterGain through SFX bus via HowlerBridge
- All 17 unit tests passing (7 GainBus + 10 AudioSystem)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, create types, and update build config** - `7607410` (feat)
2. **Task 2 RED: Add failing tests for GainBus and AudioSystem** - `23067b4` (test)
3. **Task 2 GREEN: Implement GainBus, ToneSetup, HowlerBridge, and AudioSystem** - `a84a3d5` (feat)

## Files Created/Modified
- `packages/client/package.json` - Added tone, howler, @types/howler, happy-dom, standardized-audio-context-mock
- `packages/client/vite.config.ts` - Added audio chunk splitting in manualChunks
- `packages/client/src/audio/types.ts` - MusicState enum, BusName type, AudioPreferences, crossfade durations, victory timeout
- `packages/client/src/audio/GainBus.ts` - GainNode wrapper with volume/mute/unmute/fadeTo via AudioParam automation
- `packages/client/src/audio/ToneSetup.ts` - Tone.js init, Transport config, shared context access, startTone, isToneReady
- `packages/client/src/audio/HowlerBridge.ts` - Disconnects Howler.masterGain from default destination, routes to SFX bus
- `packages/client/src/audio/AudioSystem.ts` - Top-level manager: 4 buses, master gain, visibility ducking, intensity, resume, preferences
- `packages/client/src/audio/__tests__/GainBus.test.ts` - 7 unit tests for GainBus
- `packages/client/src/audio/__tests__/AudioSystem.test.ts` - 10 unit tests for AudioSystem

## Decisions Made
- Used happy-dom (not jsdom) for vitest DOM environment -- lighter weight and sufficient for document event listener testing
- AudioParam automation (linearRampToValueAtTime) used for all gain changes, even "instant" ones (0.01s ramp), to prevent audible clicks/pops per Web Audio API best practices
- Master intensity applies full scaling to music and weather buses, but SFX bus uses 50% base + 50% intensity-scaled formula so combat sounds remain audible at low intensity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added happy-dom for vitest DOM environment**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** AudioSystem.test.ts failed with "document is not defined" because vitest runs in Node.js without DOM APIs
- **Fix:** Installed happy-dom as devDependency, added `// @vitest-environment happy-dom` directive to AudioSystem test file
- **Files modified:** packages/client/package.json, packages/client/src/audio/__tests__/AudioSystem.test.ts
- **Verification:** All 17 tests pass
- **Committed in:** a84a3d5 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for test execution in Node.js environment. No scope creep.

## Issues Encountered
None beyond the happy-dom deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AudioSystem, GainBus, ToneSetup, and HowlerBridge are complete and tested
- Ready for Plan 11-02: Music state machine (7 states with priority) and beat-quantized CrossfadeManager with test tones
- AudioSystem.update(dt) method is stubbed and ready for per-frame audio updates in future plans

## Self-Check: PASSED

All 7 created files verified present. All 3 commits verified in git log.

---
*Phase: 11-core-audio-engine*
*Completed: 2026-03-20*
