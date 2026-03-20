# Phase 12: Procedural Background Music - Research

**Researched:** 2026-03-20
**Domain:** Tone.js procedural music generation, soundfont sampling, adaptive game audio
**Confidence:** HIGH

## Summary

Phase 12 builds all procedural background music tracks for the game: 6 town variants, 2 dungeon types, 4 exploration biomes, generic combat, boss fight (3 HP phases), enemy nearby tension, and a victory stinger. The existing Phase 11 infrastructure provides the audio engine (AudioSystem, GainBus, MusicStateMachine, CrossfadeManager) and Tone.js Transport already running at 120 BPM in 4/4 time. This phase's job is to create the music content that plugs into the CrossfadeManager's A/B sides and responds to MusicStateMachine transitions.

The core technical challenge is building a track system where each track is a self-contained music generator (combining Tone.Sampler for melodic instruments with Tone.Synth/FMSynth/NoiseSynth for synthesis) that starts, stops, and connects to the CrossfadeManager's inactive side before transitions fire. Samples come from the gleitz/midi-js-soundfonts FluidR3_GM set -- pre-rendered individual MP3 note files hosted on GitHub Pages, loaded lazily per zone via Tone.Sampler with automatic pitch interpolation. Procedural variation uses Tone.Sequence and Tone.Part for phrase scheduling, with phrase pools, BPM drift, and stochastic ornament injection.

**Primary recommendation:** Build a TrackRegistry that maps MusicState + zone metadata to track definitions. Each track definition specifies instruments (Sampler URLs or synth configs), phrase pools, scale/mode, stem layers, and procedural rules. A MusicContentManager orchestrates track lifecycle: pre-loads the next track onto the CrossfadeManager's inactive side when MusicStateMachine.onTransition fires, manages sample caching with LRU eviction, and handles stem overlay fading based on proximity.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Everything in the AUDIO-PLAN** -- all 16+ tracks built in this phase
- 6 unique town tracks (Human Town, Elf Town, Dwarf Town, Human Capital, Elf Capital, Dwarf Capital) -- each with distinct instruments, scales, and melodic pools
- 2 dungeon tracks (Solo Dungeon, Group Dungeon) -- built now, wired when dungeon content exists
- 4 exploration biome tracks (Grasslands, Forest, Desert, Mountains)
- 3 combat variants (Generic Fight, Boss Fight with 3 HP-threshold phases, Enemy Nearby tension)
- Victory stinger (transient)
- **All at once delivery** -- full music content system built first, all tracks plugged in together at the end
- **Hybrid approach** -- synthesis for pads, drones, bass, drums, brass stabs, effects. Samples for all melodic instruments.
- **All melodic instruments use samples** -- guitar, flute, dulcimer, harp, cello, oboe, pan flute, penny whistle, duduk/ney, bagpipe, choir, etc.
- **Sample source: free General MIDI soundfont** (e.g., FluidR3 or MuseScore GM) sliced into individual instrument sets
- **Lazy load per zone** -- samples downloaded only when a player enters a zone that needs them. First visit has a brief load, cached after. Keeps initial page load fast.
- **Phrase-level variation** -- melodic motifs randomly selected from a pool of 4-8 phrases per track. Rhythm section stays constant. Familiar but not identical each visit.
- **BPM drift +/-2-4 BPM** per session -- subtle randomization prevents sessions from feeling identical
- **Combat music BPM scales with enemy count** -- BPM 130-155 as described in AUDIO-PLAN
- **Boss fight has 3 HP-threshold phases** -- Phase 1 (full theme), Phase 2 (add choir + distortion), Phase 3/enrage (everything at max + tempo shift). Crossfades between phases in ~3 seconds.
- **Per-track phrase length configuration** -- some tracks use fixed 4-bar phrases, Elf tracks use variable 7 or 9 bar phrases
- **Proximity-based fade** -- stems fade in/out smoothly based on distance to relevant POI or zone boundary
- **Build proximity system now with placeholder triggers** -- use distance from origin as placeholder "town center". Real POIs plug in when Phase 5 delivers settlements.
- **4 overlay stems max** per track (e.g., base town + tavern fiddle + market bustle + weather-influenced music stem)

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

### Deferred Ideas (OUT OF SCOPE)
- Combat/movement/weather sound effects -- Phase 13
- Ambient creature/NPC sounds -- Phase 14
- Acoustic occlusion filtering of music -- Phase 14
- Real POI/settlement proximity triggers -- Phase 5 (using placeholders for now)
- Day/night music variation -- v2 (WPOL-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDIO-03 | Procedural background music using Tone.js with layered stems per location type (towns, dungeons, biomes) and procedural melodic variation | Full coverage: Tone.Sampler for melodic instruments, Tone.Synth/FMSynth/NoiseSynth/MembraneSynth for synthesis, Tone.Sequence/Part/Pattern for phrase scheduling, CrossfadeManager A/B sides for transitions, FluidR3_GM soundfonts for sample source, proximity-based stem fading for layered stems |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tone | 15.1.22 | Synthesis, sampling, sequencing, transport | Already in project; owns AudioContext; Sampler, Synth, PolySynth, Sequence, Part, Pattern, Transport |
| howler | 2.2.4 | One-shot SFX (not used in this phase) | Already in project; bridged to SFX bus |

### Supporting (no new dependencies needed)
| Resource | Version | Purpose | When to Use |
|----------|---------|---------|-------------|
| gleitz/midi-js-soundfonts FluidR3_GM | gh-pages | Pre-rendered GM soundfont samples as individual MP3 files | Loaded at runtime via Tone.Sampler baseUrl for all melodic instruments |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gleitz/midi-js-soundfonts (CDN) | tonejs-instruments (npm) | tonejs-instruments has only 19 instruments; FluidR3_GM has 128 GM instruments covering all needs (dulcimer, pan flute, oboe, bagpipe, etc.) |
| gleitz/midi-js-soundfonts (CDN) | WebAudioFont (surikov) | WebAudioFont uses its own player API, not Tone.Sampler; adds unnecessary complexity |
| gleitz CDN hosting | Self-hosted samples in /public | CDN is zero-build-cost and cached globally; self-hosting adds 50-100MB to repo. Use CDN for dev, consider self-hosting for production if CDN latency is a concern |

**No new npm dependencies required.** All music generation uses Tone.js APIs already installed. Samples are loaded at runtime from the gleitz GitHub Pages CDN.

**Sample URL pattern:**
```
https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/{instrument-name}-mp3/{Note}{Octave}.mp3
```
Example: `https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3/C4.mp3`

Note naming: `A0` through `C8`, flats use `b` suffix (e.g., `Ab3`, `Bb4`, `Db5`). This is directly compatible with Tone.Sampler note mapping.

## Architecture Patterns

### Recommended Project Structure
```
packages/client/src/audio/
  music/
    MusicContentManager.ts    # Orchestrates track lifecycle, bridges state machine to tracks
    TrackRegistry.ts           # Maps MusicState + zone metadata to track definitions
    TrackDefinition.ts         # Type definitions for track configs
    BaseTrack.ts               # Abstract base: start/stop/dispose, stem management
    SampleCache.ts             # LRU cache for Tone.Sampler instances, lazy loading
    PhraseEngine.ts            # Phrase pool selection, scheduling, variation injection
    ProximityMixer.ts          # Distance-based stem fading with placeholder triggers
    scales.ts                  # Scale/mode definitions (major, dorian, lydian, phrygian, etc.)
    tracks/
      HumanTownTrack.ts        # Each track: instruments, phrases, stems, procedural rules
      ElfTownTrack.ts
      DwarfTownTrack.ts
      HumanCapitalTrack.ts
      ElfCapitalTrack.ts
      DwarfCapitalTrack.ts
      SoloDungeonTrack.ts
      GroupDungeonTrack.ts
      GrasslandsTrack.ts
      ForestTrack.ts
      DesertTrack.ts
      MountainsTrack.ts
      CombatTrack.ts
      BossFightTrack.ts
      EnemyNearbyTrack.ts
      VictoryStinger.ts
  __tests__/
    MusicContentManager.test.ts
    TrackRegistry.test.ts
    PhraseEngine.test.ts
    SampleCache.test.ts
    ProximityMixer.test.ts
    scales.test.ts
```

### Pattern 1: Track Lifecycle via CrossfadeManager A/B Sides
**What:** When MusicStateMachine fires onTransition, MusicContentManager loads the new track onto the CrossfadeManager's inactive side, then the CrossfadeManager's existing bar-quantized crossfade blends between them.
**When to use:** Every state transition (exploring -> town, town -> combat, etc.)
**Example:**
```typescript
// MusicContentManager wires into existing onTransition
musicStateMachine.onTransition((from, to) => {
  // 1. Determine which track to play based on state + zone metadata
  const trackDef = trackRegistry.getTrack(to, currentZoneMetadata);

  // 2. Get the inactive side of the crossfade
  const inactiveSide = crossfadeManager.getCurrentSide() === "a" ? "b" : "a";

  // 3. Stop the track currently on the inactive side (if any)
  if (activeTracks.has(inactiveSide)) {
    activeTracks.get(inactiveSide)!.stop();
  }

  // 4. Load and start the new track connected to the inactive side
  const track = trackDef.create();
  track.connect(crossfadeManager.getCrossFade()[inactiveSide]);
  track.start();
  activeTracks.set(inactiveSide, track);

  // 5. CrossfadeManager.transition() is already called by AudioSystem.init() wiring
  // The bar-quantized crossfade handles the blend automatically
});
```

### Pattern 2: Phrase-Level Procedural Variation with Tone.Sequence
**What:** Each track defines a pool of melodic phrases. A PhraseEngine selects phrases randomly at phrase boundaries, schedules them via Tone.Sequence or Tone.Part, and injects ornaments stochastically.
**When to use:** All tracks with melodic content (towns, exploration biomes, combat)
**Example:**
```typescript
// Phrase pool for Human Town guitar melody (C Major / Mixolydian)
const phrasePool = [
  ["C4", "E4", "G4", "A4", "G4", "E4", "D4", "C4"],  // Phrase 1
  ["G4", "A4", "Bb4", "A4", "G4", "F4", "E4", "D4"],  // Phrase 2 (Mixolydian)
  ["E4", "G4", "C5", "B4", "A4", "G4", "F4", "E4"],   // Phrase 3
  // ... 4-8 phrases per track
];

// Schedule phrase changes at bar boundaries
const sequence = new Tone.Sequence((time, noteIndex) => {
  const phrase = currentPhrase;
  if (noteIndex < phrase.length) {
    sampler.triggerAttackRelease(phrase[noteIndex], "8n", time);
  }
}, Array.from({ length: 8 }, (_, i) => i), "8n");

// At each phrase boundary, randomly select next phrase
transport.scheduleRepeat((time) => {
  currentPhrase = phrasePool[Math.floor(Math.random() * phrasePool.length)];
}, "1m"); // Every measure (bar)
```

### Pattern 3: Lazy Sample Loading with Tone.Sampler
**What:** Tone.Sampler loads individual note MP3s from the FluidR3_GM CDN. Only load samples needed for the current zone. Use sparse note mapping (every 3rd note) since Sampler auto-interpolates.
**When to use:** All melodic instruments (guitar, flute, harp, cello, etc.)
**Example:**
```typescript
async function loadInstrument(instrumentName: string): Promise<Tone.Sampler> {
  const baseUrl = `https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/${instrumentName}-mp3/`;

  // Sparse mapping: every major 3rd. Sampler pitch-shifts to fill gaps.
  const urls: Record<string, string> = {
    "C2": "C2.mp3", "E2": "E2.mp3", "Ab2": "Ab2.mp3",
    "C3": "C3.mp3", "E3": "E3.mp3", "Ab3": "Ab3.mp3",
    "C4": "C4.mp3", "E4": "E4.mp3", "Ab4": "Ab4.mp3",
    "C5": "C5.mp3", "E5": "E5.mp3", "Ab5": "Ab5.mp3",
    "C6": "C6.mp3",
  };

  return new Promise((resolve) => {
    const sampler = new Tone.Sampler({
      urls,
      baseUrl,
      onload: () => resolve(sampler),
    });
  });
}
```

### Pattern 4: Stem Layering with Proximity-Based Fading
**What:** Each track has a base layer (always audible) plus up to 4 overlay stems that fade based on distance to points of interest. Uses GainNode automation for smooth fading.
**When to use:** Town tracks (tavern fiddle near inn, anvil near forges, choir near temples)
**Example:**
```typescript
interface StemLayer {
  name: string;
  source: Tone.Sampler | Tone.Synth;  // The sound generator
  gainNode: GainNode;                   // Controls fade level
  triggerDistance: number;               // Distance at which stem starts fading in
  fullDistance: number;                  // Distance at which stem is at full volume
}

function updateStemProximity(stems: StemLayer[], playerPos: { x: number; z: number }, poi: { x: number; z: number }) {
  const dist = Math.abs(playerPos.x - poi.x) + Math.abs(playerPos.z - poi.z); // Manhattan
  for (const stem of stems) {
    const t = Math.max(0, Math.min(1,
      1 - (dist - stem.fullDistance) / (stem.triggerDistance - stem.fullDistance)
    ));
    const now = stem.gainNode.context.currentTime;
    stem.gainNode.gain.setValueAtTime(stem.gainNode.gain.value, now);
    stem.gainNode.gain.linearRampToValueAtTime(t, now + 0.3);
  }
}
```

### Pattern 5: Combat BPM Scaling
**What:** Combat track adjusts Transport BPM based on enemy count. Uses Tone.Transport.bpm.rampTo() for smooth transitions.
**When to use:** Generic combat track, enemy nearby tension track
**Example:**
```typescript
// BPM range: 130 (1 enemy) to 155 (5+ enemies)
function updateCombatBPM(enemyCount: number): void {
  const minBPM = 130;
  const maxBPM = 155;
  const clampedCount = Math.min(5, Math.max(1, enemyCount));
  const targetBPM = minBPM + ((clampedCount - 1) / 4) * (maxBPM - minBPM);
  Tone.getTransport().bpm.rampTo(targetBPM, 2); // Ramp over 2 seconds
}
```

### Pattern 6: Boss Fight Phase Transitions
**What:** Boss track has 3 phases driven by HP thresholds. Phase transitions crossfade stem layers over ~3 seconds (not the full A/B crossfade -- these are internal stem changes within a single track).
**When to use:** Boss fight track only
**Example:**
```typescript
// Phase thresholds (Claude's discretion on exact values)
const BOSS_PHASES = {
  phase1: { hpAbove: 0.6, stems: ["orchestra", "drums"] },
  phase2: { hpAbove: 0.3, stems: ["orchestra", "drums", "choir", "distortion"] },
  phase3: { hpAbove: 0.0, stems: ["orchestra", "drums", "choir", "distortion", "enrage"] },
};

function updateBossPhase(bossHpPercent: number): void {
  // Determine current phase from HP
  // Fade in/out stems over 3 seconds for phase transitions
  // Phase 3 also triggers tempo shift via Transport.bpm.rampTo()
}
```

### Anti-Patterns to Avoid
- **Loading all samples at startup:** Would add 50-100MB+ to initial load. Always lazy-load per zone.
- **Creating new Sampler instances on every phrase:** Samplers are heavyweight (decode audio buffers into RAM). Create once per instrument, reuse across phrases. Dispose when zone changes.
- **Scheduling with setTimeout/setInterval:** Always use Tone.Transport scheduling (schedule, scheduleRepeat, Sequence, Part) for musical timing. Browser timers drift and are not beat-aligned.
- **Changing Transport BPM without rampTo:** Abrupt BPM changes cause jarring tempo jumps. Always use `bpm.rampTo(target, duration)`.
- **Connecting generators directly to AudioContext destination:** All music audio MUST route through CrossfadeManager's .a or .b inputs, which routes through the music GainBus. Never bypass the bus architecture.
- **Forgetting to dispose Tone nodes:** Every Sampler, Synth, Sequence, Part created must be disposed when a track stops. Leaked nodes cause memory bloat and phantom audio.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Note pitch interpolation | Custom resampling | Tone.Sampler auto-interpolation | Sampler already pitch-shifts between sparse samples; loading every 3rd note gives full chromatic range |
| Beat-quantized scheduling | Manual Transport.position calculations | `"@1m"` quantization syntax | Tone.js has built-in quantization; "@1m" = next bar, "@4n" = next quarter note |
| Arpeggio patterns | Custom index cycling | Tone.Pattern with "up"/"down"/"upDown" | Pattern handles arpeggiator logic, iteration, and transport sync |
| Evenly-spaced note sequences | Manual time offset math | Tone.Sequence | Sequence auto-spaces events at a given subdivision |
| Complex note timing | Array of setTimeout calls | Tone.Part with [time, note] pairs | Part handles arbitrary timing with transport-synced playback |
| Smooth BPM transitions | Manual BPM interpolation loop | Transport.bpm.rampTo(target, duration) | BPM is a signal-rate value with built-in ramping |
| Crossfade between tracks | Custom gain automation | CrossfadeManager (Phase 11) | Already built with bar-quantized transitions |
| Drum synthesis | Loading drum samples | Tone.MembraneSynth (kick/tom), Tone.NoiseSynth (snare/hat), Tone.MetalSynth (cymbal) | Purpose-built percussion synths; no samples needed for drums |

**Key insight:** Tone.js provides musical primitives (Sampler, Sequence, Part, Pattern, Transport) that handle the hard parts of music scheduling. The implementation work is defining the musical content (phrase pools, scale degrees, instrument choices) and wiring the lifecycle (load, connect, start, stop, dispose).

## Common Pitfalls

### Pitfall 1: AudioBuffer Memory Explosion
**What goes wrong:** Loading all instruments for all zones simultaneously. Each decoded AudioBuffer is ~10-50x larger than its MP3. 15 instruments with full note ranges can consume 4-5GB RAM.
**Why it happens:** Eager loading or forgetting to dispose samplers when zones change.
**How to avoid:** LRU cache with a cap (e.g., 6-8 instruments max in memory). When loading a new zone's instruments, evict least-recently-used instruments first. Sparse note mapping (every major 3rd instead of every note) cuts buffer count by 3x.
**Warning signs:** Browser tab memory > 500MB, "Aw, Snap!" crashes on mobile.

### Pitfall 2: Race Condition on Track Swap
**What goes wrong:** MusicStateMachine fires transition before the new track's samples finish loading. CrossfadeManager fades to the inactive side which has silence or a half-loaded track.
**Why it happens:** Tone.Sampler.onload is async; CDN latency can be 200-2000ms.
**How to avoid:** Pre-load likely next tracks based on current state. If samples aren't ready when transition fires, play a synthesized fallback (drone/pad) while samples load, then hot-swap once ready.
**Warning signs:** Brief silence during zone transitions, especially on first visit.

### Pitfall 3: Transport BPM Affects All Scheduled Events
**What goes wrong:** Changing BPM for combat music speeds up/slows down ambient tracks that are still playing during the crossfade overlap.
**Why it happens:** Tone.Transport.bpm is global -- all Sequences, Parts, and scheduled callbacks use it.
**How to avoid:** Only change BPM when the combat track is the sole active track (after crossfade completes). Or: use a separate timing source (requestAnimationFrame with manual beat tracking) for non-combat tracks, reserving Transport BPM for the active track. Simplest approach: accept BPM only applies to the active track, and the ~2 second crossfade overlap with a slightly wrong BPM on the outgoing track is imperceptible.
**Warning signs:** Ambient music playing noticeably faster/slower during combat transitions.

### Pitfall 4: Tone.js Sequence/Part Not Stopping Cleanly
**What goes wrong:** Calling .stop() on a Sequence doesn't immediately silence notes already triggered. Notes ring out after track is supposed to be silent.
**Why it happens:** Tone.Sequence schedules notes ahead; stopping cancels future events but not already-triggered ADSR envelopes.
**How to avoid:** After .stop(), call .releaseAll() on all Samplers/Synths, then .dispose(). Or: use short release envelopes on instruments so notes decay quickly.
**Warning signs:** Ghost notes bleeding into the new track after transition.

### Pitfall 5: Note Naming Mismatch Between Scale and Sampler
**What goes wrong:** Scale engine generates "A#4" but FluidR3_GM files use "Bb4". Or vice versa.
**Why it happens:** Enharmonic equivalents (sharp vs flat naming). FluidR3_GM uses flats (Ab, Bb, Db, Eb, Gb). Tone.Sampler accepts both but the URL mapping must match the file names.
**How to avoid:** Standardize on flat notation in all scale definitions. The scales.ts module should always output flat names. If a scale naturally uses sharps (e.g., F# minor), convert to enharmonic flat equivalents for sample lookup.
**Warning signs:** "404 Not Found" errors in console for sample URLs.

### Pitfall 6: Forgetting to Start Transport Before Scheduling
**What goes wrong:** Sequences and Parts don't play. No callbacks fire.
**Why it happens:** Tone.Transport must be in "started" state. Phase 11's ToneSetup.startTone() starts it, but only after user interaction (AudioContext resume).
**How to avoid:** MusicContentManager must check AudioSystem.isResumed() before starting tracks. If not resumed, queue the track start for after resume.
**Warning signs:** Music never plays; no errors in console.

## Code Examples

### Tone.Sampler with FluidR3_GM CDN Loading
```typescript
// Source: Tone.js docs 15.1.22 + gleitz/midi-js-soundfonts pattern
const SOUNDFONT_BASE = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/";

// GM instrument names (underscore-separated, lowercase)
const GM_INSTRUMENTS = {
  acousticGuitar: "acoustic_guitar_nylon",
  flute: "flute",
  cello: "cello",
  harp: "orchestral_harp",
  oboe: "oboe",
  panFlute: "pan_flute",
  dulcimer: "dulcimer",
  bagpipe: "bagpipe",
  choirAahs: "choir_aahs",
  trumpet: "trumpet",
  trombone: "trombone",
  tuba: "tuba",
  frenchHorn: "french_horn",
  violin: "violin",
  marimba: "marimba",
  sitar: "sitar",
  shanai: "shanai",        // closest to duduk/ney
  pennywhistle: "piccolo",  // closest available
} as const;

function createSampler(instrumentKey: string): Promise<Tone.Sampler> {
  const gmName = GM_INSTRUMENTS[instrumentKey as keyof typeof GM_INSTRUMENTS];
  const baseUrl = `${SOUNDFONT_BASE}${gmName}-mp3/`;

  // Sparse mapping: sample every major 3rd for memory efficiency
  const notes = ["C", "E", "Ab"];
  const octaves = [2, 3, 4, 5, 6];
  const urls: Record<string, string> = {};
  for (const oct of octaves) {
    for (const note of notes) {
      urls[`${note}${oct}`] = `${note}${oct}.mp3`;
    }
  }

  return new Promise((resolve, reject) => {
    const sampler = new Tone.Sampler({
      urls,
      baseUrl,
      onload: () => resolve(sampler),
      onerror: (err) => reject(err),
    });
  });
}
```

### Tone.Sequence for Phrase Playback
```typescript
// Source: Tone.js wiki Events page + Tone.Sequence docs
function createMelodicSequence(
  sampler: Tone.Sampler,
  phrasePool: string[][],
  subdivision: string = "8n"
): Tone.Sequence {
  let currentPhraseIndex = Math.floor(Math.random() * phrasePool.length);

  const sequence = new Tone.Sequence(
    (time, stepIndex) => {
      const phrase = phrasePool[currentPhraseIndex];
      if (stepIndex < phrase.length && phrase[stepIndex] !== null) {
        sampler.triggerAttackRelease(phrase[stepIndex], subdivision, time, 0.7);
      }
      // At the last step, pick next phrase
      if (stepIndex === phrase.length - 1) {
        currentPhraseIndex = Math.floor(Math.random() * phrasePool.length);
      }
    },
    Array.from({ length: phrasePool[0].length }, (_, i) => i),
    subdivision
  );

  sequence.loop = true;
  return sequence;
}
```

### Synthesized Percussion (No Samples Needed)
```typescript
// Source: Tone.js docs - MembraneSynth, NoiseSynth, MetalSynth
function createDrumKit() {
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
  });

  const snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
  });

  const hihat = new Tone.MetalSynth({
    frequency: 400,
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  });

  return { kick, snare, hihat };
}
```

### Synthesized Pads/Drones (No Samples Needed)
```typescript
// Source: Tone.js docs - FMSynth, PolySynth
function createPadSynth(): Tone.PolySynth {
  return new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1,
    modulationIndex: 3,
    oscillator: { type: "sine" },
    envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 },
    modulation: { type: "triangle" },
    modulationEnvelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1 },
    volume: -12,
  });
}

function createDroneSynth(): Tone.Synth {
  return new Tone.Synth({
    oscillator: { type: "sawtooth4" },  // Sawtooth with only first 4 harmonics
    envelope: { attack: 3, decay: 0, sustain: 1, release: 5 },
    volume: -18,
  });
}
```

### Transport BPM Ramping
```typescript
// Source: Tone.js Transport wiki, Transport.bpm.rampTo docs
function setSessionBPMDrift(baseBPM: number, driftRange: number = 4): void {
  const drift = (Math.random() * driftRange * 2) - driftRange; // +/- driftRange
  const sessionBPM = baseBPM + drift;
  Tone.getTransport().bpm.value = sessionBPM;
}

function rampCombatBPM(enemyCount: number): void {
  const bpm = 130 + Math.min(4, enemyCount - 1) * 6.25; // 130-155 range
  Tone.getTransport().bpm.rampTo(bpm, 2);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tone.Buffer for sample loading | Tone.Sampler with onload + Tone.loaded() | Tone.js v14+ | Sampler manages its own buffer loading; no need for manual Buffer management |
| .toMaster() for routing | .toDestination() or .connect() | Tone.js v14+ (2020) | .toMaster() deprecated; use .toDestination() or explicit .connect() |
| Manual voice allocation | Tone.PolySynth wrapping mono synths | Stable since v14 | PolySynth handles voice stealing, allocation, and parameter distribution |
| Import entire Tone.js | Tree-shakeable imports in v15 | Tone.js v15 | `import * as Tone from "tone"` is standard but individual imports possible |

**Deprecated/outdated:**
- `Tone.Buffer.on('load')` -- use `Tone.loaded()` promise or Sampler's onload callback
- `.toMaster()` -- use `.toDestination()` or `.connect(node)`
- `Tone.Transport` (static) -- use `Tone.getTransport()` (already correct in Phase 11 code)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 with happy-dom |
| Config file | packages/client/vitest.config.ts |
| Quick run command | `cd packages/client && bunx vitest run src/audio/` |
| Full suite command | `cd packages/client && bunx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIO-03a | TrackRegistry resolves correct track for state + zone | unit | `cd packages/client && bunx vitest run src/audio/__tests__/TrackRegistry.test.ts -x` | No -- Wave 0 |
| AUDIO-03b | MusicContentManager loads track to inactive side before transition | unit | `cd packages/client && bunx vitest run src/audio/__tests__/MusicContentManager.test.ts -x` | No -- Wave 0 |
| AUDIO-03c | PhraseEngine selects from pool, never repeats identically within N phrases | unit | `cd packages/client && bunx vitest run src/audio/__tests__/PhraseEngine.test.ts -x` | No -- Wave 0 |
| AUDIO-03d | SampleCache respects LRU eviction and max instrument count | unit | `cd packages/client && bunx vitest run src/audio/__tests__/SampleCache.test.ts -x` | No -- Wave 0 |
| AUDIO-03e | ProximityMixer fades stems based on Manhattan distance | unit | `cd packages/client && bunx vitest run src/audio/__tests__/ProximityMixer.test.ts -x` | No -- Wave 0 |
| AUDIO-03f | Scale definitions output correct notes in flat notation | unit | `cd packages/client && bunx vitest run src/audio/__tests__/scales.test.ts -x` | No -- Wave 0 |
| AUDIO-03g | Combat BPM scales correctly with enemy count (130-155) | unit | `cd packages/client && bunx vitest run src/audio/__tests__/MusicContentManager.test.ts -x` | No -- Wave 0 |
| AUDIO-03h | Boss phases transition at HP thresholds | unit | `cd packages/client && bunx vitest run src/audio/__tests__/BossFightTrack.test.ts -x` | No -- Wave 0 |
| AUDIO-03i | All 16 tracks integrate and play via __audio dev API | manual-only | Playwright MCP + `__audio` console API | N/A |

### Sampling Rate
- **Per task commit:** `cd packages/client && bunx vitest run src/audio/`
- **Per wave merge:** `cd packages/client && bunx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/audio/__tests__/TrackRegistry.test.ts` -- covers AUDIO-03a
- [ ] `src/audio/__tests__/MusicContentManager.test.ts` -- covers AUDIO-03b, AUDIO-03g
- [ ] `src/audio/__tests__/PhraseEngine.test.ts` -- covers AUDIO-03c
- [ ] `src/audio/__tests__/SampleCache.test.ts` -- covers AUDIO-03d
- [ ] `src/audio/__tests__/ProximityMixer.test.ts` -- covers AUDIO-03e
- [ ] `src/audio/__tests__/scales.test.ts` -- covers AUDIO-03f
- [ ] `src/audio/__tests__/BossFightTrack.test.ts` -- covers AUDIO-03h

## Open Questions

1. **FluidR3_GM CDN reliability for production**
   - What we know: gleitz.github.io/midi-js-soundfonts serves files from GitHub Pages; free, no API key, Creative Commons license
   - What's unclear: GitHub Pages has soft bandwidth limits. In production with many concurrent players, CDN may throttle.
   - Recommendation: Use gleitz CDN for development. For production, copy needed instrument samples to project's own CDN or /public directory. This is a production deployment concern, not a Phase 12 blocker.

2. **Transport BPM sharing between tracks during crossfade**
   - What we know: Tone.Transport.bpm is global. During a crossfade, both old and new tracks hear the same BPM.
   - What's unclear: If combat exits to ambient during a crossfade, should BPM ramp back to 120 immediately or after crossfade completes?
   - Recommendation: Ramp BPM back to the new track's base BPM at crossfade start. The 2-3 second overlap with slightly shifting BPM on the outgoing track is musically acceptable and avoids complexity.

3. **Exact GM instrument mapping for fantasy instruments**
   - What we know: FluidR3_GM has 128 GM instruments. Most map obviously (flute, cello, oboe, harp).
   - What's unclear: "Duduk/ney" maps closest to "shanai" (GM #112) or possibly "oboe" with different envelope. "Penny whistle" maps closest to "piccolo" (GM #73). "Hammered dulcimer" is "dulcimer" (GM #16).
   - Recommendation: Test these mappings during implementation. Some instruments may need synth-based alternatives or envelope tweaking if the GM approximation sounds wrong.

4. **Biome/zone metadata format for track selection**
   - What we know: Server sends ZONE_MUSIC_TAG with "exploring"/"town"/"dungeon" string. Game.ts maps these to MusicState.
   - What's unclear: How to distinguish between Human Town and Elf Town, or Grasslands vs Forest, when MusicState is just "Town" or "Exploring"?
   - Recommendation: Extend ZONE_MUSIC_TAG or add a separate zone metadata channel that includes biome type and racial affiliation. For now, use placeholder logic: default to Human Town for "town" state, grasslands for "exploring" state, with a metadata field ready for real zone data.

## Sources

### Primary (HIGH confidence)
- [Tone.js Sampler docs v15.1.22](https://tonejs.github.io/docs/15.1.22/classes/Sampler.html) -- Sampler API, constructor options, polyphonic behavior, pitch interpolation
- [Tone.js Transport wiki](https://github.com/tonejs/tone.js/wiki/Transport) -- schedule, scheduleRepeat, BPM ramping, quantization
- [Tone.js Events wiki](https://github.com/Tonejs/Tone.js/wiki/Events) -- Sequence, Part, Pattern, Loop class differences
- [Tone.js Instruments wiki](https://github.com/Tonejs/Tone.js/wiki/Instruments) -- Synth types: FMSynth, AMSynth, NoiseSynth, MembraneSynth, MetalSynth, PolySynth
- [Tone.js Connections wiki](https://github.com/Tonejs/Tone.js/wiki/Connections) -- .chain(), .fan(), .connect() patterns

### Secondary (MEDIUM confidence)
- [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) -- FluidR3_GM pre-rendered soundfonts, 128 GM instruments, MP3/OGG format
- [gleitz GitHub Pages CDN](https://gleitz.github.io/midi-js-soundfonts/) -- Direct browser access to individual instrument samples
- [nbrosowsky/tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) -- Alternative sample library (19 instruments only, evaluated and not recommended)
- [Tone.js memory issue #996](https://github.com/Tonejs/Tone.js/issues/996) -- AudioBuffer memory consumption with many samples (4-5GB documented)
- [Tone.js memory issue #620](https://github.com/Tonejs/Tone.js/issues/620) -- Proper dispose pattern for Sampler/Buffer

### Tertiary (LOW confidence)
- [Procedural game music techniques](https://www.thegameaudioco.com/making-your-game-s-music-more-dynamic-vertical-layering-vs-horizontal-resequencing) -- Vertical layering vs horizontal resequencing concepts
- [WebAudioFont](https://github.com/surikov/webaudiofont) -- Alternative approach (evaluated, not recommended due to non-Tone.js API)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Tone.js 15.1.22 already installed and used in Phase 11; FluidR3_GM is the de facto standard free GM soundfont
- Architecture: HIGH - CrossfadeManager A/B pattern is already built; Tone.Sampler/Sequence/Part APIs are well-documented
- Pitfalls: HIGH - Memory explosion and dispose issues are documented in Tone.js GitHub issues; Transport BPM sharing is a known architectural constraint
- Musical content: MEDIUM - Exact phrase pools and instrument mappings are implementation details that require iterative tuning

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (Tone.js stable, FluidR3_GM static)
