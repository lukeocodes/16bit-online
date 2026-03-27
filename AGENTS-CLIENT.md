# Client Agent Guide

## Runtime
- Bun + Vite for dev (`bunx --bun vite` on port 5173)
- Vite proxies `/api` to http://localhost:8000

## File Map
- `src/main.ts` — Boot: WebRTC check, router setup, game lifecycle, disconnect handling
- `src/engine/Game.ts` — Orchestrator: connects systems, handles input, manages HUD
- `src/engine/Loop.ts` — Fixed 20Hz tick + variable render loop
- `src/engine/InputManager.ts` — WASD + click + Caps Lock handlers
- `src/renderer/PixiApp.ts` — PixiJS Application wrapper, world container, resize handling
- `src/renderer/IsoCamera.ts` — 2D isometric camera (container translate + scale with smooth follow)
- `src/renderer/EntityRenderer.ts` — PixiJS sprite-based entity rendering, damage flash, attack lines, target ring
- `src/renderer/TerrainRenderer.ts` — Procedural terrain fallback (reads ChunkManager data)
- `src/renderer/TiledMapRenderer.ts` — Loads and renders Tiled JSON maps with tileset sprites
- `src/renderer/IsometricRenderer.ts` — Isometric projection math (worldToScreen, screenToWorld)
- `src/ecs/EntityManager.ts` — Entity store + spatial grid (clean up empty cells!)
- `src/ecs/components/` — Position, Movement, Renderable, Identity, Stats, Combat
- `src/ecs/systems/` — Movement, Animation, Interpolation
- `src/net/NetworkManager.ts` — WebRTC connection via HTTP signaling, no WebSocket
- `src/net/StateSync.ts` — Server → client entity sync, numeric ID hash mapping
- `src/net/Protocol.ts` — Opcodes, binary pack/unpack
- `src/ui/Router.ts` — Screen state machine: login → onboard → create → select → game
- `src/ui/screens/` — LoginScreen, OnboardingScreen, CharacterCreateScreen, CharacterSelectScreen, GameHUD, LoadingScreen
- `src/dev/PlaywrightAPI.ts` — Dev-only `window.__game` testing interface

## PixiJS Rendering
The client uses **PixiJS v8** for 2D isometric rendering (replaced Babylon.js 3D).
```typescript
import { Container, Sprite, Graphics, Texture } from "pixi.js";
```
- World container has `sortableChildren = true` — set `zIndex` for depth sorting
- Isometric projection: `sx = (tx - tz) * 32`, `sy = (tx + tz) * 16 - elevation * 16`
- Entity picking: screen click → inverse iso projection → spatial grid query
- Render loop: PixiJS auto-render disabled, `app.render()` called from Loop.ts

## Tiled Map System
Maps are hand-crafted in Tiled editor format and loaded client-side.
- Map JSON files: `public/maps/` (served by Vite)
- Tileset images + TSJ: `public/tilesets/`
- Generator scripts: `scripts/generate-tileset.ts`, `scripts/generate-starter-map.ts`
- `TiledMapRenderer` loads map JSON, parses tileset, renders tile sprites
- Collision from tile properties (`walkable: bool` per tile type)
- Object layer defines spawn points, safe zones, player spawn
- Falls back to procedural terrain if no Tiled map loads

## Adding ECS Components
1. Create `src/ecs/components/MyComponent.ts` with interface + factory
2. Add to union type in `EntityManager.ts`
3. Create system in `src/ecs/systems/MySystem.ts`
4. Wire into `Game.ts` render or tick loop

## Adding UI Screens
1. Create `src/ui/screens/MyScreen.ts` implementing `Screen` interface
2. Add to `ScreenName` union in Router.ts
3. Add case in `navigateTo()` switch
4. Set `pointer-events: auto` on clickable panels, `pointer-events: none` on container

## Remote Entity Interpolation
Remote entities don't snap to server positions. `InterpolationSystem` lerps toward `remoteTargetX/Z` each frame at `LERP_SPEED * dt`. Position component has `isRemote` flag.

## Renderable Component
Uses PixiJS `Container` (not Babylon Mesh):
```typescript
interface RenderableComponent {
  type: "renderable";
  displayObject: Container | null;  // PixiJS container
  meshType: string;
  bodyColor: string;
  skinColor: string;
  hairColor: string;
  visible: boolean;
}
```
