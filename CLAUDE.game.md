# Game Development State

Read this file at the start of each conversation to understand where the project is and what to work on next. Update it after completing significant work.

## Current State (2026-03-27)

**Status:** Feature-complete alpha + building system + 2-story buildings + stairs + grid alignment. All committed.

**Renderer:** PixiJS v8 2D isometric. All grids now aligned: `worldToScreen` maps integer tile coords to tile centres (+TILE_HEIGHT_HALF to sy), tile sprite anchor fixed to 16/48 (diamond at top of 48px sprite).

**World:** 256x256 hand-crafted Tiled map (starter.json). Town House is a 2-story building with stairs. Map decorations removed (NPC spawns and buildings kept).

**NPCs in world:** Rabbits (outside town), Goblin Grunts (further out), Skeleton Warriors/Archers (far southeast). Each has unique sprite shape.

## Completed Phases (committed)

| Phase | Description | Commits |
|-------|-------------|---------|
| 0 | Project setup, test suite (450 tests), roadmap | e16dd7d..03d248d |
| 1 | World map data layer — continent gen, biomes, regions | 353e747..bd99f77 |
| 2 | Terrain classification — 18 biomes, walkability, height | 02-* commits |
| 3 | Server-side chunk generation — noise, Redis cache, delivery | 03-* commits |
| 11 | Combat, NPCs, spawn points, XP, leveling, safe zones | 11-* commits |
| 12 | Procedural background music — Tone.js, 20+ tracks, crossfade | 12-* commits |

## Uncommitted Work (current session)

### PixiJS Migration (large, multi-file)
- Replaced Babylon.js with PixiJS v8 across all client rendering
- New files: `renderer/PixiApp.ts`, `renderer/IsoCamera.ts`, `renderer/EntityRenderer.ts`, `renderer/TerrainRenderer.ts`, `renderer/TiledMapRenderer.ts`, `renderer/IsometricRenderer.ts`
- Deleted: `engine/SceneManager.ts`, `engine/IsometricCamera.ts`, `engine/AssetCache.ts`, `ecs/systems/RenderSystem.ts`, `world/Chunk.ts`
- Updated: `Renderable.ts` (mesh -> displayObject), `Game.ts` (full rewrite of rendering pipeline), `vite.config.ts`, `package.json`

### Tiled Map System
- `TiledMapRenderer.ts` — loads Tiled JSON, renders with tile sprites
- `scripts/generate-tileset.ts`, `scripts/generate-starter-map.ts` — tooling
- `public/maps/starter.json`, `public/tilesets/` — map assets
- Server: `tiled-map.ts` — server loads same Tiled JSON for walkability/spawns

### Movement & Animation Improvements
- **Click-to-move with A* pathfinding** — left-click computes optimal path around obstacles (`Pathfinding.ts`), follows path tile-by-tile. 8-directional, max 500 node search, handles unwalkable goals.
- **Right-click to follow+attack** — right-click NPC computes A* path, walks toward them, auto-attacks when in melee range. Recomputes path when idle.
- Right-click empty ground also pathfinds (same as left-click)
- Green diamond marker shows pathfinding destination
- WASD cancels pathfinding and follow
- **Isometric WASD** — W=North, S=South, A=West, D=East (canonical compass; on screen W appears upper-left, D lower-right)
- Smooth camera follow with dt-scaled exponential decay (`IsoCamera.ts`)
- Input processing at render rate (60fps) vs network at tick rate (20Hz)
- Diagonal movement normalization (1/sqrt(2) speed fix)
- Walk bob animation (vertical bounce + body sway via skew)
- Idle breathing animation (subtle scale pulse)
- Remote entity walk detection (position delta -> bob/sway)
- Wall bump feedback animation
- Queued input for seamless direction chaining

### Visual Polish
- Entity facing direction — eyes on sprites shift based on movement direction
- NPC-specific sprites: rabbits (oval+ears), skeletons (thin+ribs), goblins (wide+pointed ears), imps (small+wings+horns)
- Floating damage numbers (red, float up with easing)
- Floating XP gain text (cyan "+N XP" above player on kill)
- Damage flash (red tint)
- Attack lines (brief red line between combatants)
- Death animation (fade out + shrink)
- Target ring (pulsing ellipse, yellow/red based on auto-attack)
- Tile hover cursor (diamond outline follows mouse)
- Ground shadow under entities (green ring for local player)
- Entity scale by type (rabbits small, king rabbit large, etc.)
- Procedural terrain decorations — trees on forest_floor, flowers/bushes on grass, tall grass on grass_dark, reeds on swamp, rocks on sand/snow/stone (seeded for consistency)
- **8-direction sprite sheet system** — `EntitySpriteSheet.ts` renders entity Graphics into per-direction RenderTextures, `SpriteDirection.ts` maps facing vectors to 8 iso directions. Entities swap texture frame when direction changes. Ready for real artist sprite sheets (same API, replace generate with atlas load).
- Town decorations — crates, barrels, lamp posts on stone tiles; path markers; dirt rocks
- **Particle effects** (`ParticleSystem.ts`) — impact sparks on damage, death poof on kill, XP sparkles on gain, walking dust puffs at mid-step. Lightweight Graphics-based with gravity, fade, shrink.

### UI Improvements
- **Combat log in chat** — damage dealt/taken, kills, XP gains, level-ups all appear as system messages
- Chat bubbles above entities with speech pointer
- Zone transition notifications for 9 named zones (Starter Town, Rabbit Warren, Goblin Camp, Skeleton Ruins, etc.)
- World map overlay (N key toggle)
- Minimap with entity dots
- HP bars above NPCs/damaged entities
- **Zone exit portal markers** — pulsing purple ellipse on zone exit areas, visible on minimap as purple diamonds
- **Minimap zoom controls** — +/- buttons with 4 zoom levels (24/40/64/96 tile radius)
- **NPC nameplate colors** — passive NPCs (rabbits) in yellow, hostile NPCs in red, players in blue
- **Target panel level display** — shows derived difficulty level (Lv1-Lv8+) based on NPC max HP
- **Multi-zone position broadcast** — server filters entities by mapId, only same-zone entities sent
- **Entity spawn-in animation** — entities grow from 30% + fade in over 350ms with ease-out
- **Screen shake** — camera shakes on taking damage (small) and on killing enemies (bigger)
- **Action bar ability slots** — keybind labels, placeholder icons (Defend/Heal/Fire/Ice/Shock) with color-coded hover

### World Content
- 8 discovery zones added to Tiled map: Rabbit Warren, Goblin Camp, Skeleton Ruins, Goblin Swamp, Imp Forest, King's Grove, Ancient Ruins, Volcanic Rift
- Zone notification appears when player enters/exits named areas

### Zone System (new)
- **Zone registry** (`zone-registry.ts`) — maps zone IDs to Tiled map files, level ranges, music tags, exit connections
- **Zone change protocol** — `ZONE_CHANGE_REQUEST` (client→server) + `ZONE_CHANGE` (server→client) opcodes
- **Server handler** in `rtc.ts` — validates exit, moves entity, sends zone data to client
- **Client handler** in `Game.ts` — loading screen, clear entities, load new Tiled map, reposition player, update minimap
- **Zone exit detection** — `zone_exit` objects on Tiled map, player stepping in triggers server request
- **Loading overlay** — full-screen with zone name, fades out on completion
- **3 starter race lines planned** — human/elf/orc each get their own 1-5 zone, converge at crossroads (5-10)
- Zone exit added to starter map (east edge → Skeleton Wastes)
- **Skeleton Wastes zone created** — 256x256 map with dirt/sand wasteland theme, central ruined fortress, dead forest, bone swamp, mountain ridges. 5 spawn points (skeleton warriors, lords, archers, imps). Discovery zones (Dead Forest, Bone Swamp, Ruined Fortress). Exit back to starter.
- Generator script: `scripts/generate-skeleton-wastes.ts`
- Each zone is 256x256 tiles — full-size maps
- 3 starter race lines planned (human/elf/orc) converging at crossroads

### Server Changes (uncommitted)
- **Multi-zone map loading** — `tiled-map.ts` refactored to per-zone data store (`loadZoneMap`, `getZoneMapData`, `isZoneWalkable`, `getZoneSpawnPoints`). Server loads all registered zones on boot. Legacy single-map API preserved.
- **Zone registry** — `zone-registry.ts` defines zones with exits, level ranges, music tags
- **Zone change handler** in `rtc.ts` — validates exit, moves entity, sends zone metadata to client
- Enemy detection hysteresis (detect at 16 tiles, clear at 22)
- Rabbit spawn moved outside safe zone (148, 110)

## Test Status
- Server: 468/468 passing
- Client ECS: 108/108 passing
- Client audio: 350/371 (21 pre-existing audio test failures — Tone.js mock issues)
- TypeScript: compiles clean (only pre-existing audio type warnings)

## What to Work on Next

Priority order (game designer perspective):

1. ~~Commit the uncommitted work~~ — DONE (7024efb). 125 files, 14k lines.
2. **Entity art** — Being handled in a separate session. NOT using sprite sheets. `EntitySpriteSheet.ts` disabled. Entities use PixiJS Graphics mode (body+head+eyes).
3. ~~More abilities~~ — DONE. All 5 work: Defend/Heal/Fire/Ice/Shock with cooldowns, element-colored damage, HUD overlays.
4. ~~Performance pass (critical)~~ — DONE (793f3a7, ae6ff33). Entity cleanup leak, delta broadcasts, awake set cache, particle swap-and-pop, spawn/death RAF→game loop, lerp speed tuning, tick rate alignment.
5. ~~Performance pass (high pt1)~~ — DONE (e7e4bd1). HP bar dirty flags, respawn queue (no more setTimeout swarm).
6. ~~Performance pass (high pt2)~~ — DONE (7c9f527). Binary protocol for DAMAGE/STATE/DEATH (90% bandwidth reduction). Zone sharding deferred to architecture phase.
7. ~~Equipment/inventory/loot~~ — DONE (f272ca1). Full loop: kill→loot→inventory (I key)→equip/unequip→use potions→stat bonuses in combat. Equipment damage/armor applied to melee + abilities.
8. ~~More zones~~ — DONE (02e9ba9). All 5 zones live: Human Meadows, Elf Grove, Orc Wastes, Crossroads, Skeleton Wastes. Full zone network with exits connecting all zones.
9. ~~Structure pieces~~ — DONE (33522a4). UO-style wall-piece system: individual wall segments (1 tile wide, thin, 1 story tall). N/E facing, stone/wood/plaster materials, wall/window/door variants. Buildings composed from many wall pieces. 5 buildings in starter town.
10. ~~Dungeon instances~~ — DONE (8060fb8). Full loop: entrance on Crossroads → server gen → client renders → boss defeat → exit portal.
11. **NPC aggro** — DONE (22c6b46). Hostile NPCs detect players within 8 tiles and auto-engage.
12. ~~Quest system~~ — DONE (326f56d). 5 kill quests, quest UI (J key), XP rewards on turn-in, auto-accept on login. Full quest loop complete.
13. ~~3D walls~~ — DONE (d04d42b+). Full redesign: outer face + inner face + top face with correct depth direction per wall orientation (flip system). Corner posts with L-shaped top cap. Windows transparent (4-section geometry). Doors transparent (frame only). WALL_H=78 (1.5x taller floors).
14. ~~Stairs + second story~~ — DONE (5074d92+). makeHouse(floors=2) adds second floor walls, floor panels, stair_left piece. Player elevation updates as they cross stair tiles. Upper stories fade to 10% opacity when player is inside.
15. ~~Grid alignment~~ — DONE (086067e+). worldToScreen now maps integer tile coords to tile centres (+TILE_HEIGHT_HALF to sy). Tile sprite anchor fixed 32/48→16/48. All grids (tiles, walls, player, cursor, items) aligned.
16. ~~Map decorations removed~~ — DONE (87695d0). NPC spawns and buildings kept.

## Known Issues
- Audio tests have 21 pre-existing failures (Tone.js mocking)
- Spawn point debug circles visible in dev mode (intentional)
- Dungeon NPCs share spatial grid with overworld (minor)
- Stair elevation formula gives 0.5×FLOOR_ELEVATION at stair tile centre (correct — halfway up)

## Performance Optimizations Applied
- Binary protocol for DAMAGE/STATE/DEATH (90% bandwidth reduction)
- Delta-only state broadcasts (skip unchanged HP)
- Pre-computed awake set per tick (O(1) vs O(N*cells))
- Zero-alloc iterators: iterNearbyEntities, iterAll
- HP bar dirty flags (skip redraw when HP unchanged)
- Respawn queue replaces setTimeout swarm
- Spawn/death animations in game loop (no rogue RAF)
- Particle swap-and-pop removal
- Shared broadcast buffer (one alloc per broadcast)
- Zone-filtered entity spawn on join
- Decoration destroy on scroll-out (prevent memory growth)
- Dungeon NPC reverse lookup map (O(1) boss death check)
- Periodic XP/position persistence (30s crash recovery)
- Interpolation lerp speed tuned for 20Hz tick
- Client position send aligned to 20Hz
- DataChannel maxPacketLifeTime=200ms for stale packet drop

## Architecture Quick Reference
- **Server-authoritative** — client only renders, never runs game logic
- **WebRTC DataChannels** — unreliable for positions (20Hz), reliable for events
- **ECS pattern** — components + systems, don't put logic in Game.ts
- **PixiJS v8** — world container with sortableChildren, manual render from Loop.ts
- **Tiled maps** — hand-crafted in Tiled editor, served from public/maps/
- **Isometric math** — `sx = (tx - tz) * 32`, `sy = (tx + tz) * 16 - elevation * 16`
