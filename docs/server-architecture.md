# Server architecture

Node.js + tsx (not Bun — `werift` needs Node's UDP stack). Fastify on port 8000. PostgreSQL on 5433 via Drizzle ORM. Redis on 6379 via ioredis.

## Running

```bash
cd packages/server && node --watch --import tsx src/index.ts
```

## Boot order (`src/index.ts`)

```
connectRedis()
  → loadStaticZones()        # zones table → in-memory
  → loadAllUserMaps()        # user_maps → in-memory (adds to same zone registry)
  → load Tiled maps per zone
  → initWorldMap(worldSeed)  # deterministic biome gen, ~100-500ms
  → cacheWorldMapToRedis()
  → loadSavedModelsFromDB()  # model-workbench output
  → loadNpcTemplates()       # npc_templates → in-memory
  → loadItems()              # item_templates → in-memory
  → loadLootTables()         # loot_entries → in-memory
  → loadQuests()             # quests + objectives + rewards → in-memory
  → spawnInitialNpcs()
  → startGameLoop()          # 20Hz
  → app.listen(8000)
```

## File map

- `src/index.ts` — boot (see above).
- `src/app.ts` — Fastify factory, CORS, route registration.
- `src/config.ts` — env vars with sensible dev defaults (works without `.env`).
- `src/routes/rtc.ts` — WebRTC signaling (offer/answer), DataChannel handlers, entity sync, disconnect handling.
- `src/routes/auth.ts` — OAuth2 callback, dev-login, JWT refresh.
- `src/routes/characters.ts` — character CRUD with validation (stats total 30, 3 skills, name unique).
- `src/routes/builder-registry.ts` — `GET /api/builder/registry` + `POST /api/builder/overrides` + friends.
- `src/routes/world-builder.ts` — WebRTC-adjacent endpoints for the world builder.
- `src/routes/world.ts` — legacy world endpoints (procedural-terrain chunk stream).
- `src/routes/models.ts` — model-workbench save/load.
- `src/game/world.ts` — the 20Hz game loop: wander → combat → broadcast damage/death → broadcast state → broadcast positions.
- `src/game/combat.ts` — auto-attack tick, wind-up, damage, retaliation, HP regen.
- `src/game/npc-templates.ts` — types + in-memory cache populated from `npc_templates` DB table.
- `src/game/items.ts` — types + cache for items + loot tables.
- `src/game/quests.ts` — types + cache + per-player progress (ephemeral runtime state).
- `src/game/zone-registry.ts` — in-memory zone lookup; `registerZone()` helper used by user-maps loader.
- `src/game/spawn-points.ts` — spawn points: spawn, respawn, wander, death handling.
- `src/game/entities.ts` — entity store with `isAwake()` sleep optimization.
- `src/game/linger.ts` — 2-minute character linger on unsafe disconnect.
- `src/game/protocol.ts` — binary position packing + JSON reliable message encoding. See [`binary-protocol.md`](binary-protocol.md).
- `src/game/user-maps.ts` — user-authored builder maps (DB + in-memory).
- `src/ws/connections.ts` — WebRTC peer connection + DataChannel tracking.
- `src/db/schema.ts` — Drizzle tables (everything DB-backed; see [`data-policy.md`](data-policy.md)).
- `src/db/postgres.ts` — Drizzle client.
- `src/db/redis.ts` — Redis client.

## Adding NPCs

NPC stat blocks live in the `npc_templates` DB table. To add a new one:

1. Edit `tools/seed-npc-templates.ts` (migration tool — hard-coded data is OK in seed scripts only).
2. Run `DATABASE_URL=… bun tools/seed-npc-templates.ts` to UPSERT.
3. Reference the new template id from a spawn-point's `npcIds[]`.
4. Restart the server — `loadNpcTemplates()` picks up the new row at boot.

## Adding a spawn point

```typescript
addSpawnPoint({
  id:        "sp-unique-id",
  x: 10,
  z: 20,
  mapId:     1,
  npcIds:    ["skeleton-warrior", "skeleton-archer"],
  distance:  8,  // spawn/wander radius
  maxCount:  4,  // alive cap
  frequency: 5,  // respawn seconds
});
```

## Position broadcast format

Batched binary on the unreliable channel: `[count:u16LE]` then N × 20 bytes: `[entityId:u32LE][x:f32LE][y:f32LE][z:f32LE][rotation:f32LE]`. Entity IDs are hashed to u32 via `hashCode()` — the client maintains a reverse map (`numericIdMap` in `StateSync`).

For the full wire protocol including binary opcodes 32-82 and the "adding a new binary message" walkthrough, see [`binary-protocol.md`](binary-protocol.md).
