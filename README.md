# Isometric MMO

An Ultima Online-inspired isometric multiplayer online game built with modern web technologies. Features real-time multiplayer via WebRTC DataChannels, server-authoritative game logic, and a Babylon.js 3D client.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Client Engine | [Babylon.js](https://www.babylonjs.com/) | Isometric 3D rendering (orthographic camera) |
| Client Bundler | [Vite](https://vitejs.dev/) | HMR dev server, tree-shaking, chunked builds |
| Client Runtime | [Bun](https://bun.sh/) | Package manager, Vite runner |
| Server Framework | [Fastify](https://fastify.dev/) | REST API, HTTP signaling |
| Server Runtime | [Node.js](https://nodejs.org/) + [tsx](https://github.com/privatenumber/tsx) | Required for werift's UDP/DTLS stack |
| WebRTC | [werift](https://github.com/nicely-tn/werift-webrtc) (server) / native (browser) | Unreliable DataChannels for positions, reliable for events |
| Database | [PostgreSQL](https://www.postgresql.org/) via [Drizzle ORM](https://orm.drizzle.team/) | Accounts, characters, world data |
| Cache/Realtime | [Redis](https://redis.io/) via [ioredis](https://github.com/redis/ioredis) | Session state, spatial tracking, pub/sub |
| Auth | OAuth2 PKCE ([id.dx.deepgram.com](https://id.dx.deepgram.com)) + dev login | OIDC-compliant with game JWT sessions |

## Architecture

```
┌─────────────┐    HTTP POST     ┌──────────────┐
│   Browser    │ ──── /offer ───► │   Fastify    │
│  (Babylon.js)│ ◄─── SDP ────── │   (Node.js)  │
│             │                  │              │
│  DataChannel │ ◄─── positions ─ │  Game Loop   │
│  (unreliable)│  (20Hz batched) │  (20Hz tick) │
│             │                  │              │
│  DataChannel │ ◄─── events ──► │  Combat/NPC  │
│  (reliable)  │  (JSON msgs)    │  Systems     │
└─────────────┘                  └──────┬───────┘
                                        │
                              ┌─────────┴─────────┐
                              │  PostgreSQL Redis  │
                              └───────────────────┘
```

### Key Design Decisions

- **Server-authoritative**: All combat, NPC behavior, HP, and state live on the server. The client is a rendering engine.
- **WebRTC over WebSocket**: Position updates use unreliable/unordered DataChannels (UDP-like) — lost packets are skipped, not retransmitted. Reliable channel handles combat events, spawns, and state.
- **HTTP signaling**: One `POST /api/rtc/offer` + `POST /api/rtc/answer` exchange replaces WebSocket signaling. No persistent signaling connection needed.
- **ECS architecture**: Client uses Entity-Component-System pattern — entities are IDs, components are data, systems process them. Easy to extend without touching existing code.
- **Tile-based movement**: Characters move tile-to-tile with smooth interpolation. Input queuing makes held keys feel responsive.
- **Batched position updates**: All nearby entity positions packed into one binary message per tick per player, not individual packets.
- **Spatial hash grid**: Server-side EntityStore uses 32-tile cell spatial hashing for O(1) proximity queries. Broadcasts and sleep checks query a 3x3 cell grid instead of iterating all entities.
- **NPC sleep optimization**: Entities with no players nearby skip all processing (combat, regen, wandering).

## Project Structure

```
game/
├── packages/
│   ├── client/                    # Babylon.js TypeScript client
│   │   ├── src/
│   │   │   ├── main.ts           # Entry point, boot sequence
│   │   │   ├── engine/           # Game, SceneManager, IsometricCamera, Loop, Input
│   │   │   ├── ecs/              # EntityManager, components, systems
│   │   │   ├── world/            # ChunkManager, Chunk, TileRegistry
│   │   │   ├── net/              # NetworkManager (WebRTC), StateSync, Protocol
│   │   │   ├── ui/               # Router, UIManager, screens (Login, CharCreate, HUD)
│   │   │   ├── auth/             # AuthManager, PKCE, TokenStore
│   │   │   ├── state/            # SessionState, PlayerState, GameState
│   │   │   └── dev/              # PlaywrightAPI (dev-only testing interface)
│   │   ├── index.html
│   │   └── vite.config.ts
│   │
│   ├── server/                    # Fastify TypeScript server
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point, startup
│   │   │   ├── app.ts            # Fastify app factory
│   │   │   ├── config.ts         # Environment config
│   │   │   ├── routes/           # auth, characters, world, rtc (HTTP signaling)
│   │   │   ├── auth/             # OAuth2, JWT, middleware
│   │   │   ├── db/               # Drizzle schema, postgres client, redis client
│   │   │   ├── ws/               # Connection manager (WebRTC peer tracking)
│   │   │   └── game/             # Server game systems
│   │   │       ├── world.ts      # 20Hz game loop, position/state broadcasting
│   │   │       ├── combat.ts     # Auto-attack, damage, HP regen
│   │   │       ├── entities.ts   # Entity store with spatial hash grid
│   │   │       ├── npc-templates.ts  # Type system with inheritance
│   │   │       ├── spawn-points.ts   # Spawn point item system
│   │   │       ├── npcs.ts       # NPC initialization
│   │   │       ├── zones.ts      # Safe zone definitions
│   │   │       ├── linger.ts     # Disconnect lingering (2 min outside safe zones)
│   │   │       └── protocol.ts   # Binary + JSON message encoding
│   │   └── drizzle.config.ts
│   │
│   └── shared/                    # Shared constants and protocol definitions
│       ├── constants.json
│       └── protocol.json
│
├── docker-compose.yml             # PostgreSQL + Redis
├── .env.example
├── package.json                   # Bun workspace root
└── CLAUDE.md                      # Dev instructions
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager + client tooling)
- [Node.js](https://nodejs.org/) 18+ (server runtime)
- [Docker](https://www.docker.com/) (PostgreSQL + Redis)

### Setup

```bash
# Clone and install
bun install

# Start databases
docker compose up -d

# Push database schema
cd packages/server && DATABASE_URL="postgresql://game:game_dev_password@localhost:5433/game" bunx drizzle-kit push

# Copy env file and set your OAuth client ID
cp .env.example .env
# Edit .env: set OAUTH_CLIENT_ID (or use dev login which needs no OAuth)
```

### Running

```bash
# Terminal 1: Server
cd packages/server && node --watch --import tsx src/index.ts

# Terminal 2: Client
cd packages/client && bunx --bun vite
```

Open http://localhost:5173 in Chrome. Use the dev login (any username/password) to get in.

> **Note**: Ungoogled Chromium blocks WebRTC. Use regular Chrome, Firefox, or Safari.

### Docker Services

| Service | Port | Credentials |
|---------|------|-------------|
| PostgreSQL | 5433 | `game` / `game_dev_password` / `game` |
| Redis | 6379 | No auth |

Port 5433 is used because 5432 may conflict with a local PostgreSQL installation.

## Game Systems

### Combat

- **Auto-attack**: Right-click enemy to target + engage, or left-click to select then Caps Lock to toggle
- **Weapon types**: Melee (range 1), Ranged (range 4), Magic (range 4)
- **Wind-up**: 500ms cancel window before damage lands
- **Retaliation**: Damaged NPCs auto-attack back
- **Combat state**: Entered when damage dealt/received, decays after 6 seconds
- **HP regen**: +1 HP every 0.5s when out of combat

### NPC System

NPCs are defined through an inheritance-based template system:

```
Category (Wildlife/Monster/Interactive)
  └── Group (Skeleton, Imp, Goblin, Rabbit)
       └── Variant (Skeleton Warrior, Skeleton Archer, etc.)
```

Each variant defines stat **ranges** — individual NPCs get randomized stats on spawn:
- HP, weapon damage, attack speed, STR/DEX/INT
- Behavior flags: aggressive, flees, wanders, canTalk

### Spawn Points

Invisible map items that manage NPC populations:

| Property | Description |
|----------|-------------|
| `npcIds` | Which template variants can spawn here |
| `distance` | Radius for spawning and wandering |
| `maxCount` | Maximum alive NPCs from this point |
| `frequency` | Seconds between respawns after death |

NPCs wander randomly within their spawn point radius when not in combat. In dev mode, spawn points are visible as yellow dots with radius rings.

### Disconnect Handling

- **Safe zone** (town, 8-tile radius from origin): Character removed instantly on disconnect
- **Outside safe zone**: Character lingers on the map for 2 minutes, can still be attacked
- **Reconnect**: If character is lingering, player reconnects to it with current HP/state
- **Position persistence**: Last position saved to PostgreSQL on disconnect, loaded on reconnect

### Networking Protocol

**Position channel** (unreliable, unordered):
- Batched binary format: `[count:u16] + N × [entityId:u32][x:f32][y:f32][z:f32][rotation:f32]`
- One message per tick per player containing all nearby entity positions

**Reliable channel** (ordered):
- JSON messages for: entity spawn/despawn, combat events, damage, death, state updates, spawn points

### Client ECS

| Component | Data |
|-----------|------|
| Position | x, y, z, rotation, remote interpolation targets |
| Movement | Tile-based: current tile, target tile, progress, queued direction |
| Renderable | Babylon.js mesh reference, colors, visibility |
| Identity | Name, entity type, isLocal flag |
| Stats | HP, mana, stamina, STR/DEX/INT |
| Combat | Weapon type, auto-attack state, target, in-combat flag |

| System | Responsibility |
|--------|---------------|
| MovementSystem | Tile-to-tile interpolation (runs every frame) |
| InterpolationSystem | Smooth remote entity position lerping |
| RenderSystem | Mesh creation, positioning, damage flash, target ring |
| AnimationSystem | Walking bob animation |

## Testing

### Running Tests

```bash
# Server tests
cd packages/server && npx vitest run

# Client tests
cd packages/client && npx vitest run

# With coverage report
cd packages/server && npx vitest run --coverage
cd packages/client && npx vitest run --coverage

# Watch mode
cd packages/server && npx vitest
cd packages/client && npx vitest
```

### Coverage Summary

| Package | Tests | Stmts | Branch | Funcs | Lines |
|---------|-------|-------|--------|-------|-------|
| Server | 357 | 96% | 95% | 94% | 96% |
| Client | 224 | 25% | 29% | 27% | 26% |
| **Total** | **581** | | | | |

> Server coverage excludes only boot files (`index.ts`) and infrastructure connections (`postgres.ts`, `redis.ts`). All game logic, routes, and WebRTC signaling are tested. Client percentages include untestable modules (Babylon.js rendering, WebRTC networking, DOM UI screens).

### Modules at 100% Line Coverage (34)

**Server (21):** app, combat, entities, npc-templates, npcs, protocol, spawn-points, world (game loop), zones, config, jwt, middleware, oauth, auth (routes), characters (routes), world (routes), rtc (routes), connections, linger, world-helpers, world-loop

**Client (13):** Position, Movement, Renderable, Identity, Stats, Combat (all ECS components), Protocol, InterpolationSystem, MovementSystem, CombatSystem, StateSync, Loop, AssetCache

### Test Architecture

| Category | Files | Tests | What's Covered |
|----------|-------|-------|----------------|
| Server game logic | 10 | 171 | Combat, entities (spatial hash), zones, linger, spawn-points, NPC templates, protocol, world loop, world helpers |
| Server routes | 5 | 55 | WebRTC offer/answer, auth (dev-login, OAuth, refresh), characters CRUD, world chunks |
| Server auth | 3 | 14 | JWT round-trip, middleware (all 401 paths), OAuth token exchange |
| Server validation | 2 | 40 | Character name/race/stats/skills rules, config defaults |
| Server contracts | 3 | 22 | Protocol.json opcode sync, binary format, constants consistency |
| Server infra | 2 | 6 | App factory, schema |
| Client ECS | 5 | 74 | All 6 component factories, EntityManager + spatial grid, 3 systems |
| Client networking | 2 | 34 | Protocol pack/unpack, StateSync message routing + hash mapping |
| Client auth | 3 | 28 | AuthManager (PKCE, dev login, refresh), TokenStore, PKCEUtils |
| Client state | 3 | 27 | SessionState, GameState, PlayerState |
| Client engine | 2 | 19 | Fixed timestep loop (spiral cap), LRU asset cache |
| Client integration | 2 | 12 | ECS cross-system pipeline, shared protocol contracts |
| **Totals** | **42** | **581** | |

### Cross-Package Contract Tests

Both packages verify their `Opcode` values match the shared `protocol.json` spec, ensuring the binary position format and reliable message opcodes stay aligned between server and client. The `hashCode` function (used for entity ID → u32 mapping in binary positions) is tested for cross-package consistency.

## Dev Tools

### Playwright API

In dev mode (`bunx --bun vite`), `window.__game` exposes a testing API:

```javascript
// Query
__game.getPlayerPosition()        // { x, y, z }
__game.getEntityList()            // [{ id, name, type, x, z, hp, maxHp }]
__game.getPlayerCombat()          // { inCombat, autoAttacking, targetId }
__game.isConnected()              // boolean

// Actions
__game.move("w")                  // Move one tile (w/a/s/d)
__game.selectTarget("npc-id")     // Select entity
__game.toggleAutoAttack("npc-id") // Toggle auto-attack

// Async utilities
await __game.waitForEntity("id")           // Wait for entity to exist
await __game.waitForCombatState(true)      // Wait for combat state
await __game.waitForHp("id", 5, "lt")     // Wait for HP < 5
```

### WebRTC Check

The client detects restricted browsers (e.g., ungoogled Chromium) on page load and shows a warning toast before the user attempts to connect.

## Key Constants

| Constant | Value |
|----------|-------|
| Chunk size | 32×32 tiles |
| Entity load radius | 32 tiles |
| Chunk load radius | 3 chunks |
| Server tick rate | 20Hz |
| Position send rate | 15Hz |
| Camera zoom | 8 (orthographic units) |
| Movement speed | 3 tiles/sec |
| Linger duration | 2 minutes |
| Safe zone radius | 8 tiles |
