---
phase: 12-procedural-background-music
plan: 01
subsystem: audio
tags: [tone.js, soundfont, scales, music-theory, lru-cache, phrase-engine, procedural-music]

# Dependency graph
requires:
  - phase: 11-audio-engine-foundation
    provides: AudioSystem, MusicState enum, CrossfadeManager, ToneSetup
provides:
  - TrackDefinition and StemDefinition type interfaces for data-driven track configs
  - InstrumentKey union type with GM_INSTRUMENTS mapping to FluidR3_GM soundfont names
  - Scale/mode system covering all 16 scale types in flat notation
  - SampleCache with LRU eviction for lazy-loading Tone.Sampler instances
  - PhraseEngine for non-repeating phrase selection and Tone.Sequence scheduling
affects: [12-02, 12-03, 12-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [deferred-resolve-for-sync-onload, monotonic-access-counter-lru, flat-notation-scale-system]

key-files:
  created:
    - packages/client/src/audio/music/types.ts
    - packages/client/src/audio/music/scales.ts
    - packages/client/src/audio/music/SampleCache.ts
    - packages/client/src/audio/music/PhraseEngine.ts
    - packages/client/src/audio/__tests__/scales.test.ts
    - packages/client/src/audio/__tests__/SampleCache.test.ts
    - packages/client/src/audio/__tests__/PhraseEngine.test.ts
  modified: []

key-decisions:
  - "Monotonic counter instead of Date.now() for LRU ordering (deterministic in fast test runs)"
  - "Deferred resolve pattern with queueMicrotask for Tone.Sampler onload (handles sync mock + async production)"
  - "Plan's test expectations for E Lydian and D Phrygian Dominant corrected to match actual music theory"

patterns-established:
  - "Flat notation only: All note names use flats (Bb not A#) for FluidR3_GM sample URL compatibility"
  - "Tone mock pattern: vi.mock('tone') with class mocks for Sampler/Sequence matching AudioSystem.test.ts style"
  - "Sparse note sampling: Every major 3rd (C, E, Ab) across octaves 2-6 for memory-efficient Tone.Sampler"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-03-20
---

# Phase 12 Plan 01: Core Music Infrastructure Summary

**Scale/mode system with 16 flat-notation scale types, LRU SampleCache for FluidR3_GM instruments, and PhraseEngine with non-repeating selection and Tone.Sequence scheduling**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T13:12:22Z
- **Completed:** 2026-03-20T13:19:10Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- 16 scale types covering all planned tracks (towns, dungeons, biomes, combat) with correct music theory intervals
- SampleCache loads Tone.Samplers lazily from FluidR3_GM CDN with configurable LRU eviction
- PhraseEngine selects from phrase pools without immediate repeats and creates looping Tone.Sequences
- All 35 tests passing across 3 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Music type definitions and scale/mode system** - `cfead08` (feat)
2. **Task 2: SampleCache LRU and PhraseEngine** - `0627855` (feat)

_Both tasks followed TDD: RED (failing tests) -> GREEN (implementation) -> commit_

## Files Created/Modified
- `packages/client/src/audio/music/types.ts` - TrackDefinition, StemDefinition, InstrumentKey, GM_INSTRUMENTS, SOUNDFONT_BASE
- `packages/client/src/audio/music/scales.ts` - 16 ScaleTypes with getScaleNotes/InOctave/InRange utilities
- `packages/client/src/audio/music/SampleCache.ts` - LRU cache for Tone.Sampler instances with lazy CDN loading
- `packages/client/src/audio/music/PhraseEngine.ts` - Phrase pool selection with no-repeat and Tone.Sequence creation
- `packages/client/src/audio/__tests__/scales.test.ts` - 19 tests for scales and types
- `packages/client/src/audio/__tests__/SampleCache.test.ts` - 9 tests for LRU cache behavior
- `packages/client/src/audio/__tests__/PhraseEngine.test.ts` - 7 tests for phrase selection and scheduling

## Decisions Made
- Used monotonic access counter instead of Date.now() for LRU ordering -- Date.now() has millisecond resolution that fails in fast test runs where multiple cache operations complete in <1ms
- Used deferred resolve pattern with queueMicrotask for Tone.Sampler construction -- avoids TDZ (temporal dead zone) when test mocks call onload synchronously during constructor, while still working with production's async onload
- Corrected plan's test expectations for E Lydian (should include Bb not A) and D Phrygian Dominant (7th is C not Db) to match correct music theory interval patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected E Lydian and D Phrygian Dominant test expectations**
- **Found during:** Task 1 (scales test RED phase)
- **Issue:** Plan specified E Lydian 4th degree as "A" but E Lydian's raised 4th is A# (Bb in flat notation). Plan specified D Phrygian Dominant 7th as "Db" but the interval [0,1,4,5,7,8,10] from D gives C (10 semitones = 0 index = C).
- **Fix:** Updated test expectations to match correct music theory
- **Files modified:** packages/client/src/audio/__tests__/scales.test.ts
- **Verification:** All scale tests pass, "never uses sharp notation" test confirms all flat notation
- **Committed in:** cfead08 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TDZ in Tone.Sampler construction**
- **Found during:** Task 2 (SampleCache implementation)
- **Issue:** `const sampler = new Tone.Sampler({onload: () => resolve(sampler)})` causes ReferenceError when mock calls onload synchronously during construction (before const assignment completes)
- **Fix:** Used ref object pattern with queueMicrotask to defer resolve until after Sampler construction
- **Files modified:** packages/client/src/audio/music/SampleCache.ts
- **Verification:** All 9 SampleCache tests pass including async loading path
- **Committed in:** 0627855 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed LRU eviction using monotonic counter**
- **Found during:** Task 2 (SampleCache LRU access order test)
- **Issue:** Date.now() returns same value for rapid operations in tests, making all cache entries appear equally old, causing wrong eviction order
- **Fix:** Replaced Date.now() with incrementing accessCounter field
- **Files modified:** packages/client/src/audio/music/SampleCache.ts
- **Verification:** LRU access order test passes -- recently used instruments survive eviction
- **Committed in:** 0627855 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 production modules ready for Plan 02 (TrackRegistry, BaseTrack) and Plan 03 (track definitions)
- Scale system covers all 16 scale types needed by the 16 tracks
- SampleCache ready to be used by BaseTrack for instrument loading
- PhraseEngine ready to be used by track implementations for melodic phrase scheduling

## Self-Check: PASSED

- All 7 files exist on disk
- Commit cfead08 found in git log
- Commit 0627855 found in git log
- 35/35 tests passing

---
*Phase: 12-procedural-background-music*
*Completed: 2026-03-20*
