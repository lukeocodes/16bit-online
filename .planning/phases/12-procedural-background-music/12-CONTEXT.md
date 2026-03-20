# Phase 12: Procedural Background Music - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Build every procedural music track defined in the AUDIO-PLAN: 6 town variants (Human/Elf/Dwarf towns + capitals), 2 dungeon types (solo + group), 4 exploration biomes (grasslands, forest, desert, mountains), generic combat, boss fight (3 HP phases), enemy nearby tension, and victory stinger. Each track uses Tone.js synthesis + soundfont samples through the CrossfadeManager's A/B sides. Tracks include layered stems with proximity-based fading, phrase-level melodic variation, BPM drift, and per-track phrase length configuration. All tracks are built and integrated as a single delivery (not incremental). No SFX (Phase 13) or ambient/occlusion (Phase 14).

</domain>

<decisions>
## Implementation Decisions

### Starting Scope
- **Everything in the AUDIO-PLAN** — all 16+ tracks built in this phase
- 6 unique town tracks (Human Town, Elf Town, Dwarf Town, Human Capital, Elf Capital, Dwarf Capital) — each with distinct instruments, scales, and melodic pools
- 2 dungeon tracks (Solo Dungeon, Group Dungeon) — built now, wired when dungeon content exists
- 4 exploration biome tracks (Grasslands, Forest, Desert, Mountains)
- 3 combat variants (Generic Fight, Boss Fight with 3 HP-threshold phases, Enemy Nearby tension)
- Victory stinger (transient)
- **All at once delivery** — full music content system built first, all tracks plugged in together at the end

### Synthesis vs Samples
- **Hybrid approach** — synthesis for pads, drones, bass, drums, brass stabs, effects. Samples for all melodic instruments.
- **All melodic instruments use samples** — guitar, flute, dulcimer, harp, cello, oboe, pan flute, penny whistle, duduk/ney, bagpipe, choir, etc.
- **Sample source: free General MIDI soundfont** (e.g., FluidR3 or MuseScore GM) sliced into individual instrument sets
- **Lazy load per zone** — samples downloaded only when a player enters a zone that needs them. First visit has a brief load, cached after. Keeps initial page load fast.

### Procedural Variation Depth
- **Phrase-level variation** — melodic motifs randomly selected from a pool of 4-8 phrases per track. Rhythm section stays constant. Familiar but not identical each visit.
- **BPM drift ±2-4 BPM** per session — subtle randomization prevents sessions from feeling identical
- **Combat music BPM scales with enemy count** — BPM 130-155 as described in AUDIO-PLAN. More enemies = faster, more intense.
- **Boss fight has 3 HP-threshold phases** — Phase 1 (full theme), Phase 2 (add choir + distortion), Phase 3/enrage (everything at max + tempo shift). Crossfades between phases in ~3 seconds.
- **Per-track phrase length configuration** — some tracks use fixed 4-bar phrases, Elf tracks use variable 7 or 9 bar phrases. Adds musical personality per race.

### Stem Layering Behavior
- **Proximity-based fade** — stems fade in/out smoothly based on distance to relevant POI or zone boundary. Gradual transition.
- **Build proximity system now with placeholder triggers** — use distance from origin as placeholder "town center". Real POIs plug in when Phase 5 delivers settlements.
- **4 overlay stems max** per track (e.g., base town + tavern fiddle + market bustle + weather-influenced music stem). Keeps mixing clean, limits CPU.
- Overlay stems defined per track in the AUDIO-PLAN (e.g., lute/tavern fiddle near inn, anvil stem near forges, choral pad near temples)

### Claude's Discretion
- Soundfont slicing approach and individual instrument file sizes
- Tone.js Sampler vs custom sample player implementation
- Exact phrase pool content (specific note sequences, rhythms, ornaments)
- Procedural melody generation algorithm details
- How to structure the track registry / track definition format
- CrossfadeManager side management during track swaps
- Sample caching strategy (memory limits, eviction)
- Boss HP threshold values (percentages)
- Placeholder trigger positions for proximity stems

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audio design spec (PRIMARY — this is the composition bible)
- `.planning/research/AUDIO-PLAN.md` — Complete music specifications per location: scales/modes, instruments, stems, procedural rules, combat variants, crossfade timing. Sections: Background Music (towns, dungeons, combat, exploration), Music State Machine overview, Implementation Notes.

### Requirements
- `.planning/REQUIREMENTS.md` — AUDIO-03 (procedural background music with layered stems, melodic variation, combat intensity scaling, boss HP phases)
- `.planning/ROADMAP.md` — Phase 12 success criteria, depends on Phase 11

### Phase 11 audio engine (integration points)
- `packages/client/src/audio/AudioSystem.ts` — Top-level manager. `getBus("music")` returns music GainBus. `getMusicStateMachine()` and `getCrossfadeManager()` for state/crossfade access.
- `packages/client/src/audio/CrossfadeManager.ts` — Two-sided A/B crossfade. Connect synths/samplers to `.getCrossFade().a` and `.b`. `transition(from, to)` schedules bar-quantized fade. `getCurrentSide()` for active side.
- `packages/client/src/audio/MusicStateMachine.ts` — 7-state FSM. `onTransition(callback)` fires on state change. `getState()`, `getAmbientState()`, `requestState()`, `forceState()`.
- `packages/client/src/audio/ToneSetup.ts` — `getToneTransport()` for scheduling. `Tone.getTransport().schedule(..., "@1m")` for bar-aligned events.
- `packages/client/src/audio/GainBus.ts` — `node` property is raw GainNode. `setVolume()`, `fadeTo()`.
- `packages/client/src/audio/types.ts` — MusicState enum, CROSSFADE_DURATIONS, VICTORY_TIMEOUT_MS.
- `packages/client/src/engine/Game.ts` — StateSync callbacks already wire combat/enemy/zone events to MusicStateMachine. AudioSystem.update() on render loop.
- `packages/client/src/main.ts` — Dev `__audio` API for console testing.

### Prior phase context
- `.planning/phases/11-core-audio-engine/11-CONTEXT.md` — Phase 11 decisions: Tone.js owns AudioContext, server-authoritative music triggers, tab ducking, settings menu

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CrossfadeManager A/B sides**: Connect music generators to `crossFade.a` and `crossFade.b`. On state transition, the manager fades between them. Phase 12 must load the next track onto the inactive side before transition fires.
- **MusicStateMachine.onTransition**: Already wired to CrossfadeManager in AudioSystem.init(). Phase 12 hooks into this to know when to prepare the next track.
- **Tone.js Transport**: Running at 120 BPM, 4/4 time. Use `Transport.schedule()` and `Transport.scheduleRepeat()` for phrase sequencing.
- **Music GainBus**: `audioSystem.getBus("music").node` is the output destination for all music generators.
- **Master intensity**: `audioSystem.intensity` (0.0-1.0) already scales music bus. Phase 12 can also use it to drive stem density.
- **Dev __audio API**: Console testing interface for state transitions and crossfade verification.

### Established Patterns
- **Tone.js for synthesis**: All audio routing through Tone.js context. Use `Tone.Synth`, `Tone.Sampler`, `Tone.Sequence`, `Tone.Pattern` for music content.
- **Bar-quantized scheduling**: All transitions quantized to `@1m`. Phase 12 phrase changes should also align to bar boundaries.
- **Server-authoritative triggers**: Music state driven by server events (zone tags, combat state, enemy proximity). Phase 12 reacts to state machine transitions, doesn't drive them.

### Integration Points
- **CrossfadeManager.getCrossFade().a / .b**: Where music generators connect their output
- **MusicStateMachine.onTransition()**: Where Phase 12 learns about state changes to prepare tracks
- **AudioSystem.init()**: Where Phase 12's music content manager gets initialized
- **Tone.Transport**: Master clock for sequencing phrases, scheduling pattern changes

</code_context>

<specifics>
## Specific Ideas

- AUDIO-PLAN is the composition bible — each track's scale/mode, instruments, and procedural rules are defined there
- Elf music deliberately uses variable phrase lengths (7 or 9 bars) to "avoid mechanical repetition"
- Boss fight has a "short silence + bass drop stinger" at fight start per AUDIO-PLAN
- Combat music percussion pattern is "randomised per encounter" per AUDIO-PLAN
- Forest music uses "stochastic" melodic phrase triggers with "silence gaps allowed to breathe"
- Desert music has "silence between phrases increases in emptier zones"
- Per AUDIO-PLAN: "Use Tone.js Transport to keep all music synced to a master BPM clock"

</specifics>

<deferred>
## Deferred Ideas

- Combat/movement/weather sound effects — Phase 13
- Ambient creature/NPC sounds — Phase 14
- Acoustic occlusion filtering of music — Phase 14
- Real POI/settlement proximity triggers — Phase 5 (using placeholders for now)
- Day/night music variation — v2 (WPOL-01)

</deferred>

---

*Phase: 12-procedural-background-music*
*Context gathered: 2026-03-20*
