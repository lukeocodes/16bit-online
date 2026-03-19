# Phase 11: Core Audio Engine - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the game's audio foundation: AudioContext lifecycle management, gain bus architecture (music, SFX, weather, ambient), a music state machine with 7 states and beat-quantized crossfades, and a master intensity variable. This phase installs Tone.js and Howler.js, wires them into the bus system, and includes test tones to verify crossfade behavior. No actual music content or sound effects — those arrive in Phases 12-14.

</domain>

<decisions>
## Implementation Decisions

### Player Audio Controls
- **Master + music/SFX split** — three controls: Master Volume, Music Volume, Sound Effects Volume
- Controls live in a **settings menu** (gear icon in HUD) — not always-visible on the HUD
- Settings persist **server-side per account** (not per character) — audio preferences are player-level, shared across all characters
- No keyboard shortcut for mute — M key is reserved for map

### Music State Triggers
- **Server zone tags** drive music state — server sends zone music/acoustic tags with chunk data or on zone entry. Client reacts to server events, consistent with server-authoritative design.
- Combat music triggers on **COMBAT_STATE opcode** from StateSync (already exists) — instant on aggro
- **Enemy Nearby** detection uses a **new server proximity event** — server sends 'enemy_nearby' when hostile NPCs are within detection radius (~16 tiles)
- Full **7-state machine** built from day one: Exploring, Town, Dungeon, Enemy Nearby, Combat, Boss, + Victory (transient stinger after combat ends)
- Boss fight overrides the state machine entirely — must be manually exited on boss death (per AUDIO-PLAN)

### Tab/Focus Behavior
- On tab away: **duck to ~10% volume** — audio continues quietly in background so player can hear combat/alerts while tabbed out
- On tab return: **instant restore** — volume snaps back to full immediately, no fade-in delay
- AudioContext created on game boot, **resumed on first user interaction** (click/keypress) — standard browser policy compliance, silent until player interacts

### Tone.js & Howler.js Scope
- **Full Tone.js foundation** in Phase 11 — Transport (master BPM clock), basic synth/sampler abstractions, crossfade helpers. Phase 12 provides musical content (scales, motifs, stems).
- Beat-quantized crossfade system built with a **test tone** (simple sine/square) for verification — placeholder removed when real music arrives in Phase 12
- **Howler.js installed and wired** into the SFX gain bus now — Phase 13 adds the actual sound files
- Both libraries connect through the gain bus architecture, not directly to AudioContext output

### Claude's Discretion
- Exact gain bus routing topology and node graph structure
- AudioSystem ECS integration approach (system pattern vs standalone manager)
- Test tone frequency/pattern for crossfade verification
- Synth/sampler abstraction API design
- Settings menu UI layout and styling
- Server-side schema for audio preferences storage
- Specific detection radius for enemy_nearby event

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audio design spec
- `.planning/research/AUDIO-PLAN.md` — Complete audio design reference: music state machine diagram, bus architecture, crossfade rules, all location/combat/exploration music specs, SFX categories, acoustic occlusion system, zone acoustic tags, Web Audio API code examples

### Requirements
- `.planning/REQUIREMENTS.md` — AUDIO-01 (core audio engine, buses, master intensity), AUDIO-02 (music state machine, beat-quantized crossfades)
- `.planning/ROADMAP.md` — Phase 11 success criteria, dependency graph (11 has no deps, 12-14 depend on 11)

### Existing codebase (integration points)
- `packages/client/src/engine/Game.ts` — System orchestrator: constructor wires systems, loop.onTick/onRender hooks. Lines 76-85 register StateSync callbacks (damage, death, combat state) — audio hooks go here
- `packages/client/src/engine/Loop.ts` — Fixed 20Hz tick + variable render loop. Audio updates on render loop for smooth synthesis
- `packages/client/src/engine/InputManager.ts` — Click/keydown listeners (lines 38-57) for AudioContext resume on first interaction
- `packages/client/src/net/StateSync.ts` — Existing callbacks: onDamage, onDeath, onCombatState. Combat music trigger source.
- `packages/client/src/net/Protocol.ts` — Opcodes: DAMAGE_EVENT (50), ENTITY_DEATH (51), COMBAT_STATE (53), WORLD_READY (100)
- `packages/client/src/main.ts` — Game lifecycle: Game constructor (line 39), connectToServer (line 53), game.start (line 57). Audio init sequence hooks here.
- `packages/client/src/ui/screens/GameHUD.ts` — Action bar with buttons. Settings menu attaches here.
- `packages/client/src/ui/Router.ts` — Screen state machine: login > onboarding > create > select > game
- `packages/client/src/ecs/EntityManager.ts` — ECS store with spatial grid (16-tile cells). Potential positional audio source.
- `packages/client/src/ecs/systems/AnimationSystem.ts` — Reference ECS system pattern: constructor(EntityManager) + update(dt)
- `packages/server/src/routes/characters.ts` — Character CRUD. Account-level audio settings could extend user/auth data.
- `packages/server/src/game/zones.ts` — SafeZone definitions. Zone tags for music state could extend this pattern.

### Prior phase context
- `.planning/phases/01-world-map-data-layer/01-CONTEXT.md` — Server-authoritative design principle, ECS patterns
- `.planning/phases/02-terrain-classification-biomes/02-CONTEXT.md` — Zone/biome data structure decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **StateSync callbacks**: onDamage, onDeath, onCombatState already dispatch combat events — direct hook points for audio state changes
- **InputManager event listeners**: click/keydown handlers available for AudioContext resume on first interaction
- **ECS system pattern**: All systems follow constructor(EntityManager) + update(dt) — AudioSystem can follow same pattern
- **EntityManager spatial grid**: 16-tile cell resolution — useful for spatial audio proximity checks
- **GameHUD action bar**: Existing button container for adding settings gear icon

### Established Patterns
- **Server-authoritative**: All game state changes flow from server. Zone music tags should follow this pattern.
- **ECS architecture**: New features = new components + systems. Audio fits as a system (and optionally per-entity audio component).
- **Protocol opcodes**: Binary for positions, JSON for reliable events. New enemy_nearby event uses reliable channel.
- **Sleep optimization**: Entities far from players don't tick — spatial audio should respect similar proximity rules.

### Integration Points
- **Game.ts constructor** (~line 65): Initialize AudioSystem alongside other systems
- **Game.ts StateSync callbacks** (~lines 76-85): Wire audio triggers for damage/death/combat
- **Loop.onRender**: AudioSystem update for smooth synthesis timing
- **main.ts game lifecycle**: AudioContext creation and resume sequence
- **GameHUD**: Settings menu with volume sliders
- **Server auth/user data**: Account-level audio preferences storage

</code_context>

<specifics>
## Specific Ideas

- M key is reserved for map — no keyboard mute shortcut. Audio controls are settings-menu-only.
- AUDIO-PLAN music state machine diagram is the canonical reference for state transitions and crossfade timing
- Per the AUDIO-PLAN: "Crossfades between states should happen on beat boundaries to avoid jarring cuts — quantise transitions to the nearest bar"
- Per the AUDIO-PLAN: "Weather SFX runs on a completely separate audio graph from music so it never interferes with music ducking/fading"
- Boss fight overrides the state machine entirely and must be manually exited on boss death

</specifics>

<deferred>
## Deferred Ideas

- Actual procedural music content (scales, motifs, stems) — Phase 12
- Combat/movement/weather sound effects — Phase 13
- Ambient creature sounds and acoustic occlusion — Phase 14
- Minimap tied to M key — future phase (WPOL-02)

</deferred>

---

*Phase: 11-core-audio-engine*
*Context gathered: 2026-03-19*
