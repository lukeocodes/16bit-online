# Performance rules

Invariants that protect the 20Hz tick budget + keep memory bounded over long sessions.

## Binary vs JSON split

**Default to binary** for anything sent more than once per second or during combat. Binary rules + the opcode table live in [`docs/binary-protocol.md`](binary-protocol.md).

## Delta broadcasting

`broadcastState()` uses `lastBroadcastState` to skip sending unchanged HP. Do the same for any value that changes rarely — track last-sent, skip if equal.

## Sleep optimisation

All entities with no player within 32 tiles are skipped in the game loop via the awake set. New NPC behaviour must check `entity.isAwake()` before ticking. The server-authoritative combat + wander systems already honour this; don't write a new system that ignores it.

## Entity cleanup

Always remove entries from `Map` / `Set` when entities despawn (`EntityManager.removeEntity` clears spatial grid cells). Memory leaks from unflushed maps will grow unbounded over a multi-hour session.

Client-side: call `actor.kill()` on Excalibur actors when they're removed from the scene; destroy owned `ImageSource` / `SpriteSheet` if they were created single-use (most come from the shared `TilesetIndex` which owns them for the session).

## Particles / animations in the game loop

**Never use `requestAnimationFrame` or `setTimeout` for game-visible animations.** Hook into the engine tick (`Loop.ts` / Excalibur's `onPreUpdate`) so they advance with the game clock. RAF callbacks accumulate and are not cancelled on scene unload; tab-switching pauses them.

## Decoration scroll-out

Terrain decorations (trees, rocks, etc.) are destroyed when they scroll outside the camera viewport. Do not keep unbounded sprite lists for world decorations.

## Position broadcast

Unreliable channel, batched binary `[count:u16LE]` + N × 20 bytes per entity. See [`docs/binary-protocol.md`](binary-protocol.md). Never send positions over the reliable channel.
