# Phase 11: Core Audio Engine - Research

**Researched:** 2026-03-19
**Domain:** Web Audio API, Tone.js synthesis/transport, Howler.js SFX playback, gain bus architecture, music state machine
**Confidence:** HIGH

## Summary

Phase 11 builds the audio foundation for the isometric MMO: AudioContext lifecycle management, a 4-bus gain architecture (music, SFX, weather, ambient), a 7-state music state machine driven by server events, and beat-quantized crossfades via Tone.js Transport. Two libraries are installed: Tone.js (synthesis, sequencing, Transport clock) and Howler.js (one-shot SFX playback). Both must route through the gain bus system, not directly to AudioContext.destination.

The key technical challenges are: (1) sharing a single AudioContext between Tone.js and Howler.js, (2) beat-quantized crossfades using Transport scheduling with the "@" quantization syntax, (3) AudioContext resume on first user interaction to comply with browser autoplay policy, and (4) tab visibility ducking via the Page Visibility API. The music state machine is a pure state machine that reacts to server events (COMBAT_STATE opcode, zone tags, enemy_nearby proximity events) and drives crossfade transitions between audio states.

Tone.js 15.1.22 (latest stable) provides TypeScript types natively, full ESM support, and the Transport/CrossFade/Gain primitives needed. Howler.js 2.2.4 exposes `Howler.ctx` and `Howler.masterGain` for custom routing but does not support injecting a foreign AudioContext cleanly -- the recommended approach is to let Howler create its own context OR use Tone's context as the shared one and route Howler's master gain node through the bus system. Given the complexity of sharing contexts, the pragmatic approach is to use Tone.js as the primary audio engine (it manages the AudioContext) and use Howler.js purely as an SFX loader/player that connects to the SFX gain bus via its exposed `masterGain` node.

**Primary recommendation:** Use Tone.js as the AudioContext owner. Create 4 GainNode buses (music, sfx, weather, ambient) + 1 master GainNode using the raw Web Audio API from `Tone.getContext().rawContext`. Connect Howler's masterGain into the SFX bus. Build the music state machine as a standalone class (not ECS component) that subscribes to StateSync callbacks and drives Tone.js CrossFade transitions quantized to bar boundaries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Player Audio Controls**: Master + music/SFX split -- three controls: Master Volume, Music Volume, Sound Effects Volume
- Controls live in a **settings menu** (gear icon in HUD) -- not always-visible on the HUD
- Settings persist **server-side per account** (not per character) -- audio preferences are player-level, shared across all characters
- No keyboard shortcut for mute -- M key is reserved for map
- **Music State Triggers**: Server zone tags drive music state -- server sends zone music/acoustic tags with chunk data or on zone entry. Client reacts to server events, consistent with server-authoritative design.
- Combat music triggers on **COMBAT_STATE opcode** from StateSync (already exists) -- instant on aggro
- **Enemy Nearby** detection uses a **new server proximity event** -- server sends 'enemy_nearby' when hostile NPCs are within detection radius (~16 tiles)
- Full **7-state machine** built from day one: Exploring, Town, Dungeon, Enemy Nearby, Combat, Boss, + Victory (transient stinger after combat ends)
- Boss fight overrides the state machine entirely -- must be manually exited on boss death (per AUDIO-PLAN)
- On tab away: **duck to ~10% volume** -- audio continues quietly in background so player can hear combat/alerts while tabbed out
- On tab return: **instant restore** -- volume snaps back to full immediately, no fade-in delay
- AudioContext created on game boot, **resumed on first user interaction** (click/keypress) -- standard browser policy compliance, silent until player interacts
- **Full Tone.js foundation** in Phase 11 -- Transport (master BPM clock), basic synth/sampler abstractions, crossfade helpers. Phase 12 provides musical content (scales, motifs, stems).
- Beat-quantized crossfade system built with a **test tone** (simple sine/square) for verification -- placeholder removed when real music arrives in Phase 12
- **Howler.js installed and wired** into the SFX gain bus now -- Phase 13 adds the actual sound files
- Both libraries connect through the gain bus architecture, not directly to AudioContext output

### Claude's Discretion
- Exact gain bus routing topology and node graph structure
- AudioSystem ECS integration approach (system pattern vs standalone manager)
- Test tone frequency/pattern for crossfade verification
- Synth/sampler abstraction API design
- Settings menu UI layout and styling
- Server-side schema for audio preferences storage
- Specific detection radius for enemy_nearby event

### Deferred Ideas (OUT OF SCOPE)
- Actual procedural music content (scales, motifs, stems) -- Phase 12
- Combat/movement/weather sound effects -- Phase 13
- Ambient creature sounds and acoustic occlusion -- Phase 14
- Minimap tied to M key -- future phase (WPOL-02)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDIO-01 | Core audio engine with AudioContext lifecycle, separate gain buses (music, SFX, weather, ambient), and master intensity variable | Gain bus architecture using Web Audio API GainNode chain; AudioContext resume via Tone.start() on user gesture; master intensity float (0.0-1.0) modulating all bus gains proportionally |
| AUDIO-02 | Music state machine with states (Exploring, Town, Dungeon, Enemy Nearby, Combat, Boss) and beat-quantized crossfade transitions | 7-state FSM class subscribing to StateSync callbacks (COMBAT_STATE opcode) and server zone tag events; Tone.js Transport for BPM clock; Tone.CrossFade with "@1m" quantization for bar-aligned transitions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tone | 15.1.22 | Synthesis, Transport clock, CrossFade, scheduling | Only mature Web Audio framework with built-in Transport, beat quantization ("@" syntax), equal-power CrossFade, and TypeScript types. ESM native. |
| howler | 2.2.4 | SFX sample playback (loader + sprite) | De facto standard for one-shot audio playback; handles format detection, pooling, and HTML5 fallback. Exposes `Howler.ctx` and `Howler.masterGain` for custom routing. |
| @types/howler | 2.2.12 | TypeScript definitions for Howler.js | Howler.js does not ship its own types. Required for TypeScript project. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| standardized-audio-context-mock | 9.7.28 | Mock AudioContext in vitest tests | Unit testing AudioSystem, MusicStateMachine, and bus routing without a real browser AudioContext |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Howler.js | Raw Web Audio API BufferSource | Howler handles format detection, pooling, and sprite sheets -- hand-rolling this is error-prone. Howler adds ~10KB gzipped. |
| Tone.js CrossFade | Manual equal-power GainNode crossfade | Tone.CrossFade is 4 lines vs ~30 lines of manual gain math. No reason to hand-roll. |
| Tone.js Transport | requestAnimationFrame scheduling | Transport provides sample-accurate beat quantization; rAF has jitter and no concept of musical time. |

**Installation:**
```bash
cd packages/client && bun add tone howler @types/howler
cd packages/client && bun add -d standardized-audio-context-mock
```

**Version verification:** Versions confirmed via npm registry on 2026-03-19:
- tone: 15.1.22 (latest), published with ESM + TypeScript, depends on standardized-audio-context ^25.3.70 + tslib ^2.3.1
- howler: 2.2.4 (latest), no dependencies
- @types/howler: 2.2.12 (latest)

**Vite config update needed:** Add Tone.js to Vite's `manualChunks` to keep bundle splitting clean:
```typescript
manualChunks(id) {
  if (id.includes("@babylonjs")) return "babylon";
  if (id.includes("tone") || id.includes("standardized-audio-context")) return "audio";
}
```

## Architecture Patterns

### Recommended Project Structure
```
packages/client/src/
  audio/
    AudioSystem.ts          # Top-level manager: AudioContext lifecycle, bus creation, visibility ducking
    GainBus.ts              # GainNode wrapper with volume/mute/fade helpers
    MusicStateMachine.ts    # 7-state FSM: Exploring, Town, Dungeon, EnemyNearby, Combat, Boss, Victory
    CrossfadeManager.ts     # Tone.CrossFade wrapper with beat-quantized transition scheduling
    ToneSetup.ts            # Tone.js initialization: Transport config, BPM, shared context
    HowlerBridge.ts         # Howler.js setup: connect masterGain to SFX bus
    types.ts                # MusicState enum, AudioPreferences interface, bus names
  ui/
    components/
      SettingsMenu.ts       # Gear icon panel: Master/Music/SFX volume sliders
```

### Pattern 1: Gain Bus Architecture (Web Audio API)
**What:** A tree of GainNode instances routing all audio through categorized buses before hitting destination.
**When to use:** Always -- this is the foundational audio routing pattern.
**Example:**
```typescript
// Source: Web Audio API spec + AUDIO-PLAN.md bus architecture
//
// AudioContext.destination
//   <- masterGain (master volume control + intensity scaling)
//     <- musicBus (GainNode) -- Tone.js synths/players route here
//     <- sfxBus (GainNode) -- Howler.masterGain connects here
//     <- weatherBus (GainNode) -- Weather synthesis (Phase 13)
//     <- ambientBus (GainNode) -- Ambient sounds (Phase 14)

const ctx = Tone.getContext().rawContext as AudioContext;
const masterGain = ctx.createGain();
masterGain.connect(ctx.destination);

const musicBus = ctx.createGain();
musicBus.connect(masterGain);

const sfxBus = ctx.createGain();
sfxBus.connect(masterGain);

const weatherBus = ctx.createGain();
weatherBus.connect(masterGain);

const ambientBus = ctx.createGain();
ambientBus.connect(masterGain);

// Connect Howler to SFX bus
Howler.masterGain.disconnect();
Howler.masterGain.connect(sfxBus);
```

### Pattern 2: Music State Machine (Finite State Machine)
**What:** A 7-state FSM that maps game events to music states and triggers crossfade transitions.
**When to use:** Whenever game state changes require music transitions.
**Example:**
```typescript
// Source: AUDIO-PLAN.md state machine diagram + CONTEXT.md decisions

enum MusicState {
  Exploring = "exploring",
  Town = "town",
  Dungeon = "dungeon",
  EnemyNearby = "enemy_nearby",
  Combat = "combat",
  Boss = "boss",
  Victory = "victory",
}

// Priority ordering (higher overrides lower):
// Boss > Combat > EnemyNearby > Victory > Dungeon > Town > Exploring

// Transition rules:
// - Exploring -> Town: zone tag change (crossfade ~2-4s, quantized to bar)
// - Exploring -> EnemyNearby: server enemy_nearby event (crossfade ~2s)
// - EnemyNearby -> Combat: COMBAT_STATE opcode (crossfade ~1s, quantized)
// - Combat -> Victory: all enemies dead (stinger, then fade to ambient)
// - Any -> Boss: boss encounter event (overrides state machine entirely)
// - Boss -> Victory: boss death event (manual exit)
```

### Pattern 3: Beat-Quantized Crossfade via Tone.js Transport
**What:** Schedule crossfade transitions to snap to the next bar boundary for musically seamless transitions.
**When to use:** Every music state transition.
**Example:**
```typescript
// Source: Tone.js docs - quantization + CrossFade + Transport
import * as Tone from "tone";

// "@1m" means "quantize to the next measure boundary"
// "@4n" means "quantize to the next quarter note"

function scheduleTransition(crossFade: Tone.CrossFade, targetFade: number, duration: string = "2m") {
  // Schedule the crossfade to begin at the next bar boundary
  Tone.getTransport().schedule((time) => {
    crossFade.fade.linearRampTo(targetFade, Tone.Time(duration).toSeconds(), time);
  }, "@1m"); // Quantized to next measure
}

// Usage: transition from state A (fade=0) to state B (fade=1)
scheduleTransition(crossFade, 1, "4m"); // 4-measure crossfade starting at next bar
```

### Pattern 4: AudioContext Lifecycle Management
**What:** Create AudioContext on game boot, resume on first user interaction, handle browser suspension.
**When to use:** Game initialization and user interaction handlers.
**Example:**
```typescript
// Source: Tone.js Autoplay wiki + MDN Web Audio best practices

// In AudioSystem.init():
// 1. Tone.js creates AudioContext internally on import
// 2. On first user click/keypress, call Tone.start() to resume
// 3. Listen for visibilitychange for tab ducking

async function resumeAudioOnInteraction(): Promise<void> {
  if (Tone.getContext().state === "running") return;

  const resume = async () => {
    await Tone.start();
    console.log("[Audio] AudioContext resumed");
    document.removeEventListener("click", resume);
    document.removeEventListener("keydown", resume);
  };

  document.addEventListener("click", resume, { once: false });
  document.addEventListener("keydown", resume, { once: false });
}

// Tab visibility ducking (per CONTEXT.md: duck to ~10%, instant restore)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    masterGain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
  } else {
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.01); // ~instant
  }
});
```

### Pattern 5: Master Intensity Variable
**What:** A single float (0.0-1.0) that globally influences stem density, SFX volume, and weather presence.
**When to use:** Driven by game state (combat intensity, zone danger level, etc.)
**Example:**
```typescript
// Source: AUDIO-PLAN.md implementation notes

class AudioSystem {
  private _intensity = 0.5; // Default: medium

  set intensity(value: number) {
    this._intensity = Math.max(0, Math.min(1, value));
    // Scale bus volumes proportionally
    this.musicBus.gain.linearRampToValueAtTime(
      this.musicVolume * this._intensity,
      this.ctx.currentTime + 0.3
    );
    this.weatherBus.gain.linearRampToValueAtTime(
      this.weatherVolume * this._intensity,
      this.ctx.currentTime + 0.3
    );
    // SFX bus is less affected (combat sounds should stay audible)
    this.sfxBus.gain.linearRampToValueAtTime(
      this.sfxVolume * (0.5 + 0.5 * this._intensity),
      this.ctx.currentTime + 0.3
    );
  }
}
```

### Anti-Patterns to Avoid
- **Connecting audio nodes directly to AudioContext.destination:** Always route through the gain bus hierarchy. Direct connections bypass volume controls and intensity scaling.
- **Using setInterval/setTimeout for musical timing:** Use Tone.Transport.schedule for sample-accurate timing. Browser timers have 4-16ms jitter.
- **Creating AudioContext in a module top-level scope:** Browsers block AudioContext creation before user interaction. Create lazily or use Tone.js's built-in deferred creation.
- **Calling Tone.start() outside a user gesture handler:** Will silently fail in Chrome, Safari, and Firefox. Must be inside click/keydown/touchstart event handler.
- **Sharing AudioContext by assigning `Howler.ctx = toneCtx`:** This does not work reliably (GitHub issue #1510). Instead, let each library manage its own context internals and connect Howler's masterGain output into the SFX bus.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Equal-power crossfade | Manual gain curves with cos/sin | `Tone.CrossFade` | Equal-power math is tricky; Tone.CrossFade handles it correctly with signal-rate fade control |
| Beat-quantized scheduling | requestAnimationFrame + manual BPM math | `Tone.Transport.schedule(cb, "@1m")` | Transport provides sample-accurate scheduling; rAF has jitter and no musical time concept |
| SFX loading + format detection | Raw `fetch()` + `decodeAudioData()` + format sniffing | `Howler` + `Howl` | Howler handles MP3/OGG/WAV detection, audio sprites, pooling, and mobile quirks |
| AudioContext lifecycle | Manual `new AudioContext()` + resume dance | `Tone.start()` + `Tone.getContext()` | Tone.js wraps standardized-audio-context, handles cross-browser shims |
| Gain ramping with automation | `gain.value = x` (clicks/pops) | `gain.linearRampToValueAtTime()` | Direct value assignment causes audible clicks. AudioParam automation methods produce smooth transitions |

**Key insight:** The Web Audio API is low-level by design. Tone.js and Howler.js exist precisely because hand-rolling synthesis scheduling, equal-power fading, and format-aware sample loading is complex and error-prone. Use them for their strengths (Tone.js for musical timing/synthesis, Howler.js for sample playback) and only drop to raw Web Audio for the bus routing topology.

## Common Pitfalls

### Pitfall 1: AudioContext Autoplay Policy
**What goes wrong:** AudioContext starts in "suspended" state; all audio is silent even though code runs correctly.
**Why it happens:** Chrome 71+, Safari, and Firefox block AudioContext from running until a user gesture occurs.
**How to avoid:** Call `Tone.start()` inside a click/keydown handler. Wire this into the existing InputManager event listeners in the Game constructor. Add a one-time interaction listener that removes itself after first resume.
**Warning signs:** `Tone.getContext().state === "suspended"` after game loads; no audio output despite Transport running.

### Pitfall 2: GainNode Clicks and Pops
**What goes wrong:** Audible clicks/pops when changing volume.
**Why it happens:** Setting `gain.value` directly causes a discontinuous jump in the audio signal.
**How to avoid:** Always use AudioParam automation methods: `gain.linearRampToValueAtTime()`, `gain.exponentialRampToValueAtTime()`, or `gain.setTargetAtTime()`. Even for "instant" changes, use a very short ramp (0.01s).
**Warning signs:** Clicking sounds when adjusting volume sliders or when tab visibility changes.

### Pitfall 3: Tone.js Context Must Be Set Before Node Creation
**What goes wrong:** Nodes created before `Tone.setContext()` cannot connect to nodes created after.
**Why it happens:** Web Audio API nodes are bound to their AudioContext at creation time. Different contexts cannot share nodes.
**How to avoid:** Initialize Tone.js context first (or use its default), then create all Tone nodes. If using `Tone.setContext()`, call it before any `new Tone.Synth()` etc.
**Warning signs:** "Cannot connect to a destination that belongs to a different audio context" errors.

### Pitfall 4: Transport Must Be Started for Quantization
**What goes wrong:** Scheduled events with "@1m" quantization never fire.
**Why it happens:** Tone.Transport starts in stopped state. Quantized events require the Transport to be running to calculate the next bar boundary.
**How to avoid:** Call `Tone.getTransport().start()` after AudioContext is running. Start Transport when entering the game world, not on page load.
**Warning signs:** `scheduleRepeat` and `schedule` callbacks never execute; crossfades never happen.

### Pitfall 5: Howler.masterGain.disconnect() Side Effects
**What goes wrong:** After disconnecting Howler's masterGain from its default destination and reconnecting to the SFX bus, future Howl instances may not route correctly.
**Why it happens:** Howler internally manages its audio graph. Disconnecting and reconnecting the masterGain must happen after Howler has fully initialized its internal state.
**How to avoid:** Ensure `Howler.ctx` exists (play a silent sound or access `Howler.ctx` to trigger lazy init), then disconnect/reconnect. Do this once during AudioSystem initialization, not repeatedly.
**Warning signs:** Some sounds play through speakers directly (bypassing SFX bus), others are silent.

### Pitfall 6: Victory State Timing
**What goes wrong:** Victory stinger plays but ambient music never resumes, or stinger is cut short.
**Why it happens:** Victory is a transient state -- it plays a short stinger then must auto-transition back to the ambient state (Exploring/Town/Dungeon).
**How to avoid:** Use `Tone.Transport.scheduleOnce()` to schedule the transition back to ambient after the stinger duration. Victory state should have a fixed timeout (e.g., 3-5 seconds).
**Warning signs:** Getting stuck in Victory state after combat ends.

### Pitfall 7: Memory Leaks from Audio Nodes
**What goes wrong:** Audio nodes accumulate over time, causing memory growth and eventually audio glitches.
**Why it happens:** Web Audio API nodes are not garbage collected while connected. Old CrossFade instances, synths, and gain nodes persist.
**How to avoid:** Dispose Tone.js nodes when no longer needed (`synth.dispose()`). Clear scheduled Transport events when transitioning states. The AudioSystem.dispose() method must clean up all nodes.
**Warning signs:** Increasing memory usage over long play sessions; audio starts glitching after many state transitions.

## Code Examples

Verified patterns from official sources:

### Tone.js Initialization and Transport
```typescript
// Source: Tone.js wiki (AudioContext, Transport, Autoplay)
import * as Tone from "tone";

// Tone.js automatically creates an AudioContext on import.
// Access the raw Web Audio API context:
const rawCtx = Tone.getContext().rawContext as AudioContext;

// Configure Transport
const transport = Tone.getTransport();
transport.bpm.value = 120; // Default BPM for the game
transport.timeSignature = 4; // 4/4 time

// Start Transport (must be after Tone.start())
transport.start();

// Schedule a repeating event every measure
transport.scheduleRepeat((time) => {
  // This fires at the start of every measure with sample-accurate timing
  console.log("Bar boundary at", time);
}, "1m");
```

### Tone.js CrossFade with Quantization
```typescript
// Source: Tone.js docs (CrossFade, quantization "@" syntax)
import * as Tone from "tone";

const crossFade = new Tone.CrossFade(0); // Start at input A
// crossFade.a ← connect source A
// crossFade.b ← connect source B
// crossFade.connect(musicBusAdapter); // Route to music bus

// Transition to source B at next bar boundary over 2 measures
const transport = Tone.getTransport();
transport.schedule((time) => {
  crossFade.fade.linearRampTo(1, Tone.Time("2m").toSeconds(), time);
}, "@1m");
```

### Howler.js SFX Bus Integration
```typescript
// Source: Howler.js GitHub README + issue #618
import { Howl, Howler } from "howler";

// Ensure Howler has initialized its AudioContext
// (accessing Howler.ctx triggers lazy init)
const howlerCtx = Howler.ctx;

// Reroute Howler's master output to our SFX bus
if (Howler.masterGain && sfxBusGainNode) {
  Howler.masterGain.disconnect();
  Howler.masterGain.connect(sfxBusGainNode);
}

// Play a test sound (Phase 13 will add real SFX files)
const testSound = new Howl({
  src: ["data:audio/wav;base64,..."], // inline silent WAV or test beep
  volume: 0.5,
});
```

### Page Visibility Ducking
```typescript
// Source: MDN Page Visibility API + CONTEXT.md tab behavior decisions
function setupVisibilityDucking(masterGain: GainNode, ctx: AudioContext) {
  document.addEventListener("visibilitychange", () => {
    const now = ctx.currentTime;
    if (document.hidden) {
      // Duck to 10% over 100ms
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0.1, now + 0.1);
    } else {
      // Instant restore
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(1.0, now + 0.01);
    }
  });
}
```

### AudioSystem as ECS-Compatible Manager
```typescript
// Source: Existing ECS system pattern (AnimationSystem.ts)
// Recommendation: AudioSystem is a standalone manager (not an ECS system)
// because it doesn't iterate entities -- it reacts to events and manages
// global audio state. However, it follows the same constructor + update(dt) pattern.

class AudioSystem {
  constructor() {
    // Initialize AudioContext, buses, state machine
  }

  update(dt: number) {
    // Called from Loop.onRender for smooth audio parameter updates
    // Update master intensity interpolation
    // Poll state machine for pending transitions
  }

  dispose() {
    // Clean up all audio nodes, Transport events, Howler instances
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new AudioContext()` on page load | Create lazily, resume on user gesture via `Tone.start()` | Chrome 71 (2018), now universal | AudioContext starts suspended; must handle lifecycle |
| HTML5 `<audio>` for game audio | Web Audio API + Tone.js for synthesis, Howler.js for samples | Mature since 2020+ | Full control over routing, effects, spatialization |
| `gain.value = x` for volume changes | `gain.linearRampToValueAtTime()` | Always best practice | Eliminates clicks/pops from discontinuous gain jumps |
| `setInterval` for musical timing | `Tone.Transport.schedule()` with "@" quantization | Tone.js v14+ | Sample-accurate beat-aligned scheduling |
| Tone.js CommonJS (`require`) | Tone.js 15.x ESM (`import * as Tone from "tone"`) | Tone.js 15.0 | Native ESM, `"type": "module"` in package.json, tree-shakeable |

**Deprecated/outdated:**
- `Tone.Master` was renamed to `Tone.getDestination()` in Tone.js 14+
- `Tone.context` (lowercase) is still available but `Tone.getContext()` is preferred in v15
- Howler.js 1.x API is completely different from 2.x; all examples must use 2.x API

## Open Questions

1. **Shared AudioContext between Tone.js and Howler.js**
   - What we know: Howler.js creates its own AudioContext lazily. Setting `Howler.ctx` to a foreign context does not work reliably (GitHub issue #1510 remains open). However, we can disconnect `Howler.masterGain` and reconnect it to our SFX bus GainNode.
   - What's unclear: Whether Howler's masterGain reconnection is stable across all Howl instances created after reconnection.
   - Recommendation: Test during implementation. If Howler routing is unstable, fall back to creating Howl instances with `html5: true` (bypasses Web Audio) or use raw Web Audio BufferSource for SFX in Phase 13 instead. For Phase 11, the wiring just needs to be demonstrated with a test tone.

2. **Server-side audio preferences schema**
   - What we know: The `accounts` table exists with basic fields. Audio preferences (masterVolume, musicVolume, sfxVolume) need to be stored per-account.
   - What's unclear: Whether to add columns directly to accounts table or create a separate `account_preferences` table.
   - Recommendation: Add a `preferences` JSONB column to the accounts table. This allows flexible key-value storage without migrations for each new preference. Example: `{ "masterVolume": 0.8, "musicVolume": 0.6, "sfxVolume": 1.0 }`.

3. **Enemy Nearby server event protocol**
   - What we know: A new server proximity event is needed. The existing opcode range has SPAWN_POINT at 60 and WORLD_READY at 100.
   - What's unclear: Exact opcode number, payload format, and debounce strategy.
   - Recommendation: Use opcode 70 (ENEMY_NEARBY) with payload `{ entityIds: string[], distance: number }`. Server checks proximity at tick rate; debounce by only sending when state changes (entering/leaving detection radius).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.x |
| Config file | `packages/client/vitest.config.ts` |
| Quick run command | `cd packages/client && bunx vitest run --reporter=verbose` |
| Full suite command | `cd packages/client && bunx vitest run --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIO-01a | AudioSystem creates 4 gain buses + master | unit | `cd packages/client && bunx vitest run src/audio/AudioSystem.test.ts -t "gain buses"` | Wave 0 |
| AUDIO-01b | Master intensity scales bus gains proportionally | unit | `cd packages/client && bunx vitest run src/audio/AudioSystem.test.ts -t "intensity"` | Wave 0 |
| AUDIO-01c | AudioContext resumes on user interaction | unit | `cd packages/client && bunx vitest run src/audio/AudioSystem.test.ts -t "resume"` | Wave 0 |
| AUDIO-01d | Tab visibility ducks master gain to 10% | unit | `cd packages/client && bunx vitest run src/audio/AudioSystem.test.ts -t "visibility"` | Wave 0 |
| AUDIO-02a | MusicStateMachine transitions between 7 states | unit | `cd packages/client && bunx vitest run src/audio/MusicStateMachine.test.ts -t "transitions"` | Wave 0 |
| AUDIO-02b | State priority ordering (Boss > Combat > EnemyNearby > ...) | unit | `cd packages/client && bunx vitest run src/audio/MusicStateMachine.test.ts -t "priority"` | Wave 0 |
| AUDIO-02c | Victory auto-transitions back to ambient after timeout | unit | `cd packages/client && bunx vitest run src/audio/MusicStateMachine.test.ts -t "victory"` | Wave 0 |
| AUDIO-02d | CrossfadeManager schedules transitions quantized to bar | unit | `cd packages/client && bunx vitest run src/audio/CrossfadeManager.test.ts -t "quantized"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/client && bunx vitest run src/audio/`
- **Per wave merge:** `cd packages/client && bunx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/client/src/audio/AudioSystem.test.ts` -- covers AUDIO-01 (bus creation, lifecycle, intensity, visibility)
- [ ] `packages/client/src/audio/MusicStateMachine.test.ts` -- covers AUDIO-02 (state transitions, priority, victory timeout)
- [ ] `packages/client/src/audio/CrossfadeManager.test.ts` -- covers AUDIO-02 (beat-quantized crossfade scheduling)
- [ ] Mock setup for AudioContext in test files using `standardized-audio-context-mock` or vi.mock
- [ ] Install: `cd packages/client && bun add -d standardized-audio-context-mock`

**Testing strategy for Web Audio:** Since vitest runs in Node.js (no real AudioContext), tests must mock the Web Audio API. The `standardized-audio-context-mock` package provides mock AudioContext, GainNode, and other Web Audio nodes. For Tone.js-specific tests, mock the Tone module with `vi.mock("tone")` and provide stubs for Transport, CrossFade, and getContext. The MusicStateMachine can be tested purely as a state machine (no audio mocking needed) if its audio side-effects are abstracted behind an interface.

## Sources

### Primary (HIGH confidence)
- [Tone.js GitHub Wiki - AudioContext](https://github.com/Tonejs/Tone.js/wiki/AudioContext) - Context management, setContext, getContext
- [Tone.js GitHub Wiki - Transport](https://github.com/tonejs/tone.js/wiki/Transport) - BPM, scheduling, scheduleRepeat
- [Tone.js GitHub Wiki - Autoplay](https://github.com/Tonejs/Tone.js/wiki/Autoplay) - Tone.start(), browser policy compliance
- [Tone.js CrossFade docs](https://tonejs.github.io/docs/r13/CrossFade) - Equal power fading API
- [Tone.js Quantization example](https://tonejs.github.io/examples/quantization) - "@" syntax for beat alignment
- [Howler.js GitHub](https://github.com/goldfire/howler.js) - Howler.ctx, Howler.masterGain, API reference
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) - document.visibilitychange
- [MDN Web Audio API best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) - GainNode automation, AudioContext resume
- [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay) - User gesture requirements

### Secondary (MEDIUM confidence)
- [Howler.js issue #618](https://github.com/goldfire/howler.js/issues/618) - masterGain disconnect/reconnect pattern
- [Howler.js issue #1510](https://github.com/goldfire/howler.js/issues/1510) - Cannot pass custom AudioContext (limitation confirmed)
- [Howler.js issue #1105](https://github.com/goldfire/howler.js/issues/1105) - AudioContext resume via Howler
- [Dynamic Music in Games using WebAudio](https://cschnack.de/blog/2020/webaudio/) - Multilayer crossfade patterns, beat-aligned scheduling
- [web.dev - Developing game audio with Web Audio API](https://web.dev/articles/webaudio-games) - Gain bus architecture for games
- [npm registry](https://www.npmjs.com/) - Package version verification (tone 15.1.22, howler 2.2.4, @types/howler 2.2.12)

### Tertiary (LOW confidence)
- [standardized-audio-context-mock npm](https://www.npmjs.com/package/standardized-audio-context-mock) - Mock library for testing; version 9.7.28 confirmed but untested with Tone.js 15.x specifically

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Tone.js and Howler.js are the established libraries for browser audio synthesis and SFX playback. Versions confirmed via npm registry.
- Architecture: HIGH - Gain bus pattern is standard Web Audio API practice. State machine pattern is well-established for game music. Integration points in existing codebase are well-documented in CONTEXT.md.
- Pitfalls: HIGH - AudioContext autoplay policy, GainNode clicks, and Transport lifecycle are well-documented issues with multiple official sources confirming behavior.
- Howler.js routing: MEDIUM - The masterGain disconnect/reconnect pattern is documented in GitHub issues but the official README does not cover this use case. Testing during implementation is recommended.
- Testing strategy: MEDIUM - standardized-audio-context-mock exists but compatibility with Tone.js 15.x and vitest specifically has not been verified.

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days -- Tone.js and Howler.js are stable, slow-moving libraries)
