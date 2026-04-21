# Client Agent Guide

## Data Goes in the Database, NOT in Client Code
Client has **no persistent data**. No JSON manifests, no hand-written registry arrays, no seed-data `.ts` files, no `localStorage.setItem` for anything except purely-local UI state (camera position, picker zoom level, etc.). Tile categories, tileset definitions, sub-regions, per-tile overrides, empty-tile flags, map-item schemas, NPC definitions, spawn points, quests, zones — **all DB-backed, fetched on boot or via WebRTC**. See AGENTS.md "Data in the Database" for the full rule and rationale. If you're about to `import foo from './data.json'` or create a `const FOO: Def[] = [...]` registry, stop.

## Runtime
- Bun + Vite for dev (`bunx --bun vite` on port 5173)
- Vite proxies `/api` to http://localhost:8000

## Rendering engine — Excalibur.js v0.30
The client uses **[Excalibur.js](https://excaliburjs.com/) v0.30** for 2D top-down rendering, NOT PixiJS, NOT Babylon.js. All rendering types come from the `excalibur` package.

```typescript
import { Engine, Scene, Actor, Sprite, Animation, ImageSource, SpriteSheet, Vector, Color } from "excalibur";
```

Tiled maps are loaded via the companion plugin `@excaliburjs/plugin-tiled`.

Key concepts:
- **Engine** — the root (`main.ts` constructs one with `DisplayMode.FitScreen`).
- **Scene** — container for actors; switched via `game.goToScene("builder")`. Two scenes today:
  - `GameScene` (`src/scenes/GameScene.ts`) — gameplay + combat
  - `BuilderScene` (`src/builder/BuilderScene.ts`) — world builder
- **Actor** — anything that draws + has position. Use `actor.graphics.use(sprite | animation)` to attach graphics. `actor.graphics.opacity` controls alpha (0-1).
- **z-index** — `actor.z` determines draw order within a scene. Layer z values come from the DB (`ground=0`, `decor=20`, `walls=60`, `canopy=80`); player is at `PLAYER_Z=50` so walls + canopy draw above.
- **Sprite / Animation** — constructed from a `SpriteSheet` via `TilesetIndex.makeGraphic(tileset, tileId)`.
- **Camera** — `scene.camera.strategy.lockToActor(player)` for follow.

## File map
- `src/main.ts` — boot: auth, create Engine, add scenes, start
- `src/tile.ts` — TILE_SIZE constant + helpers
- `src/scenes/GameScene.ts` — gameplay scene: TMX loading, player movement, combat render
- `src/actors/PlayerActor.ts` — local player actor
- `src/actors/RemotePlayerActor.ts` — interpolated remote players
- `src/net/NetworkManager.ts` — WebRTC signaling + DataChannels (NO WebSocket)
- `src/builder/main.ts` — builder scene boot
- `src/builder/BuilderScene.ts` — world builder scene (tile placement, block drawing, camera)
- `src/builder/BuilderHud.ts` — builder HUD overlays (category bar, brush info)
- `src/builder/TilePicker.ts` — the big tile library modal (categories, grid, metadata editor, multi-select, bulk edit, source-sheet viewer)
- `src/builder/TileOverlay.ts` — Excalibur Actor that owns every placed tile in the user map; draws ghosts + selection highlights
- `src/builder/BlockOverlay.ts` — renders collision blocks (red tint in debug mode)
- `src/builder/TilesetIndex.ts` — loads DB registry + tileset PNGs + builds `SpriteSheet`s; `makeGraphic(tileset, tileId)` returns a ready `Sprite | Animation`
- `src/builder/registry/` — type contracts + `store.ts` (fetches the registry from `/api/builder/registry` on boot)

`PixiApp.ts`, `IsoCamera.ts`, `EntityRenderer.ts`, `TerrainRenderer.ts`, `IsometricRenderer.ts`, `TiledMapRenderer.ts`, `Router.ts`, `GameHUD.ts`, `src/ecs/*` — **none of these exist any more**. They were part of the old PixiJS/ECS architecture that was replaced when the project switched to Excalibur + Tiled-plugin scenes.

## Tiled map system
Maps are hand-crafted in Tiled (TMX files) or painted programmatically by `tools/paint-map/`. The Excalibur `plugin-tiled` loads TMX files and turns them into Excalibur layers + object layers (spawn points, safe zones) automatically. Tileset PNG + TSX files live in `packages/client/public/maps/` and are ingested into the DB by `tools/ingest-tilesets.ts`.

## Adding an actor
```typescript
const actor = new Actor({ x, y, z: layerZ, rotation });
actor.graphics.use(tilesetIndex.makeGraphic(tileset, tileId)!);
scene.add(actor);
```
To make a tile fade when the player walks behind it: `actor.graphics.opacity = 0.5`.

## Adding UI screens
HTML + CSS + DOM event handlers (not an Excalibur UI kit). Example: `packages/client/builder.html` + `src/builder/TilePicker.ts` wires `<button>` / `<select>` / `<input>` refs directly. No router framework — screens are shown/hidden by toggling a root `<div>`'s visibility.

## Remote player interpolation
`RemotePlayerActor` (29 lines) stores a target position from network updates and lerps toward it on Excalibur's `onPreUpdate` tick.

## Dev hooks
- `window.__builder = { game, net, scene, tiles }` — exposed by `src/builder/main.ts` for Playwright/manual inspection.
- `window.__game` — similar in gameplay scene (see Playwright testing notes in AGENTS.md).
