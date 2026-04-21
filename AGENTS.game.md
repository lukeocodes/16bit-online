# Game state

Read this file at the start of each conversation. Update after significant work.

## Current state (2026-04-21)

Top-down Pokemon-style RPG. Excalibur.js v0.30 + `@excaliburjs/plugin-tiled`. Server auth via Fastify + Drizzle. WebRTC for gameplay traffic. Mana Seed art (Seliel the Shaper).

**Map system:** two ways to author maps:

1. **Data-driven painter** (`tools/paint-map/`) — scene specs in `maps-src/*.json` → painter emits TMX (for client rendering) + JSON (for server collision/spawn logic). See [paint-map workflow](docs/paint-map.md).
2. **In-game world builder** (`packages/client/builder.html`) — walk around, open the tile picker, click to place / pickup / rotate / erase tiles live. Stored in the DB (`user_maps` + `user_map_tiles`) and can be frozen to TMX + JSON via `bun tools/freeze-map.ts <numericId | zoneId | all>`. See [world builder](docs/world-builder.md).

**Current playable map:** `starter-area` (48×32, human-meadows zone). Grass base, dark-grass patches, cobblestone path, dirt clearing, small water pond, forest border.

## Known issues

1. **WebRTC DataChannel timeout in Playwright Chromium** — pre-existing. Real browsers connect fine. Do not use Playwright for live gameplay testing.
2. **No NPC spawn points in new map** — the painter only emits the player spawn. Server JSON schema supports NPC spawns but the painter doesn't yet.
3. **Mana Seed tree-wall tiles have transparent lower halves** — visually correct per the art but means the "canvas" below the bottom tree row shows grass. Collision layer covers the full 128×128 footprint regardless.

## Blockers to "fully playable"

In rough order:

1. Port binary position-update decoder (`handlePositionUpdate` currently stub).
2. Wire TMX `player-spawn` object via `entityClassNameFactories` (remove hardcoded 20,15).
3. Wire TMX `camera` object via `entityClassNameFactories`.
4. Add NPC spawn objects to the scene-spec schema + painter.
5. Port `RemotePlayerActor` from `client-old` (sprite, nameplate, interpolation).
6. Port combat visuals (damage numbers, HP bars, attack swings).
7. UI: HP bar, inventory, chat, dialog — all missing from the new client.

## Supplemental docs

- [`docs/world-builder.md`](docs/world-builder.md) — Builder commands, protocol opcodes 200–209, rendering model, v1 limits.
- [`docs/tile-library.md`](docs/tile-library.md) — The 20-category taxonomy, multi-select + bulk edit, source-spritesheet viewer, workflow for adding a new tileset.
- [`docs/paint-map.md`](docs/paint-map.md) — Scene-spec painter workflow, painter architecture, scene-spec gotchas, adding wang terrains / collision.
- [`docs/test-zones.md`](docs/test-zones.md) — Debug teleport keys 1–9 and the Mana Seed sample maps they map to.
- [`docs/data-policy.md`](docs/data-policy.md) — "Data in the Database, NOT in Code" rule + workflows.
- [`docs/history/db-migration-2026-04.md`](docs/history/db-migration-2026-04.md) — Completed migration record (Phase 1 + Phase 2), remaining Phase 1b / Phase 3 sketches.
- [`docs/history/model-workbench.md`](docs/history/model-workbench.md) — Model-workbench final state log.

## Architecture rules (recap — full rationale in `docs/data-policy.md` and AGENTS.md)

- **Server-authoritative** — never put game logic (combat, HP, spawning) in the client.
- **No WebSocket** — all gameplay over WebRTC DataChannels; HTTP POST is only for signalling.
- **Data-driven maps** — edit `maps-src/*.json`, run the painter. Never hand-edit TMX.
- **Clean up** — call `actor.kill()` on Excalibur actors, clear Maps/Sets on entity removal.
- **Data in the DB, not code** — only logic + PNGs outside the DB. Everything queryable is a table.
