# Codebase Structure

**Analysis Date:** 2026-03-19

## Directory Layout

```
isometric-mmo/
├── packages/
│   ├── client/                       # Babylon.js TypeScript client (Vite)
│   │   ├── src/
│   │   │   ├── main.ts               # Entry point, app boot
│   │   │   ├── auth/                 # OAuth2 and session management
│   │   │   ├── ecs/                  # Entity Component System
│   │   │   │   ├── EntityManager.ts
│   │   │   │   ├── components/       # Component type definitions
│   │   │   │   └── systems/          # ECS systems
│   │   │   ├── engine/               # Game loop, rendering, input
│   │   │   ├── net/                  # Network and protocol
│   │   │   ├── state/                # Global state (auth, session)
│   │   │   ├── ui/                   # Screen and UI components
│   │   │   ├── world/                # Chunk and spatial management
│   │   │   ├── dev/                  # Dev-only utilities
│   │   │   └── types/                # Shared TypeScript types
│   │   ├── public/
│   │   │   └── assets/               # Game models, textures, UI assets
│   │   ├── dist/                     # Vite build output
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   ├── server/                       # Fastify TypeScript server
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point, main loop
│   │   │   ├── app.ts                # Fastify app setup
│   │   │   ├── config.ts             # Environment configuration
│   │   │   ├── auth/                 # OAuth2 and JWT
│   │   │   ├── db/                   # Database (PostgreSQL, Redis)
│   │   │   ├── game/                 # Game simulation logic
│   │   │   ├── routes/               # HTTP endpoints
│   │   │   └── ws/                   # WebRTC connection management
│   │   ├── tsconfig.json
│   │   └── drizzle.config.ts
│   │
│   └── shared/                       # Shared constants and protocol
│       ├── constants.json            # Game configuration
│       └── protocol.json             # Network protocol definitions
│
├── docker-compose.yml                # PostgreSQL + Redis
├── package.json                      # Monorepo root
└── bun.lock                          # Lockfile
```

## Directory Purposes

**packages/client/src/auth/:**
- Purpose: OAuth2 PKCE login flow and token management
- Contains: AuthManager (orchestrates login), PKCEUtils (code challenge), TokenStore (localStorage wrapper)
- Key files: `AuthManager.ts`

**packages/client/src/ecs/:**
- Purpose: Entity Component System for data-driven game logic
- Contains: EntityManager (registry and spatial grid), component definitions, update systems
- Key files: `EntityManager.ts` (core ECS implementation with spatial indexing)

**packages/client/src/ecs/components/:**
- Purpose: Component type definitions (data containers)
- Contains: Position, Movement, Renderable, Identity, Stats, Combat
- Pattern: Each component has an interface and createX() factory function

**packages/client/src/ecs/systems/:**
- Purpose: Logic that updates entities based on components
- Contains: MovementSystem (update movement progress), RenderSystem (Babylon.js meshes), AnimationSystem (skeletal animation), InterpolationSystem (smooth position changes), CombatSystem (client-side combat preview)
- Key files: `RenderSystem.ts` (Babylon.js integration)

**packages/client/src/engine/:**
- Purpose: Core game runtime and rendering pipeline
- Contains: Game (orchestrator and entry point), SceneManager (Babylon.js scene), IsometricCamera (45° orthographic view), InputManager (keyboard/mouse), Loop (separates tick 20Hz from render 60Hz), AssetCache (model/material caching)
- Key files: `Game.ts` (main orchestrator)

**packages/client/src/net/:**
- Purpose: WebRTC connectivity and protocol handling
- Contains: NetworkManager (WebRTC peer and DataChannels), StateSync (message interpretation), Protocol (binary/JSON codecs)
- Key files: `NetworkManager.ts` (RTCPeerConnection setup), `Protocol.ts` (opcode enum and pack/unpack)

**packages/client/src/state/:**
- Purpose: Global client state
- Contains: SessionState (auth token, user info), PlayerState (character data), GameState (world state wrapper)
- Key files: `SessionState.ts` (source of truth for auth)

**packages/client/src/ui/:**
- Purpose: Screen management and UI components
- Contains: Router (navigation state machine), UIManager (DOM management), Screen implementations, UI components (ActionBar, ChatBox, MiniMap)
- Key files: `Router.ts` (screen navigation), `screens/GameHUD.ts` (in-game UI)

**packages/client/src/ui/screens/:**
- Purpose: Full-screen views (login, character select, game, etc.)
- Contains: LoginScreen, OnboardingScreen, CharacterCreateScreen, CharacterSelectScreen, GameHUD, LoadingScreen
- Pattern: Each screen is a class that builds and returns a DOM element

**packages/client/src/world/:**
- Purpose: Chunk-based world representation
- Contains: ChunkManager (track loaded/unloaded chunks), Chunk (tile data), TileRegistry (tile type definitions), WorldConstants (chunk size, load radius)
- Key files: `ChunkManager.ts` (chunk lifecycle)

**packages/client/src/dev/:**
- Purpose: Development utilities
- Contains: PlaywrightAPI (test automation hooks)
- Key files: `PlaywrightAPI.ts` (exposes window.__game for E2E testing)

**packages/server/src/auth/:**
- Purpose: OAuth2 and JWT authentication
- Contains: oauth.ts (ATProto OAuth flow), jwt.ts (token generation/verification), middleware.ts (route protection)
- Key files: `middleware.ts` (requireAuth decorator)

**packages/server/src/db/:**
- Purpose: Database connections and schema
- Contains: postgres.ts (Drizzle ORM client), redis.ts (ioredis client), schema.ts (Drizzle table definitions)
- Key files: `schema.ts` (table definitions for characters, accounts, etc.)

**packages/server/src/game/:**
- Purpose: Game simulation logic (authoritative state)
- Contains: world.ts (20Hz game loop), combat.ts (combat state machine), entities.ts (entity registry), npcs.ts (NPC spawning), spawn-points.ts (NPC spawn data), protocol.ts (message packing), linger.ts (disconnect recovery), zones.ts (safe zone checks)
- Key files: `world.ts` (main tick loop), `combat.ts` (combat resolution)

**packages/server/src/routes/:**
- Purpose: HTTP API endpoints
- Contains: rtc.ts (WebRTC signaling), auth.ts (login endpoint), characters.ts (character CRUD), world.ts (world metadata)
- Key files: `rtc.ts` (POST /offer, /answer for DataChannel setup)

**packages/server/src/ws/:**
- Purpose: WebRTC connection management
- Contains: connections.ts (ConnectionManager, tracks active players)
- Key files: `connections.ts` (singleton that routes messages to clients)

**packages/shared/:**
- Purpose: Constants and protocol definitions shared between client and server
- Contains: constants.json (CHUNK_SIZE, TICK_RATE, ENTITY_LOAD_RADIUS), protocol.json (opcode definitions, binary format)
- Pattern: Single source of truth for both client and server

## Key File Locations

**Entry Points:**
- `packages/client/src/main.ts`: Browser app initialization, boot flow
- `packages/server/src/index.ts`: Server startup, connect services, start game loop
- `packages/server/src/app.ts`: Fastify app builder

**Configuration:**
- `packages/server/src/config.ts`: Environment variables for server
- `packages/shared/constants.json`: Chunk size, load radius, tick rates
- `packages/shared/protocol.json`: Opcode and binary format definitions
- `vite.config.ts` (client): Bundler config
- `drizzle.config.ts` (server): Database migration config

**Core Logic:**
- `packages/client/src/engine/Game.ts`: Main game orchestrator
- `packages/client/src/ecs/EntityManager.ts`: Entity and component registry with spatial grid
- `packages/server/src/game/world.ts`: 20Hz server tick loop
- `packages/server/src/game/combat.ts`: Authoritative combat simulation
- `packages/server/src/routes/rtc.ts`: WebRTC peer setup and DataChannel initialization

**Networking:**
- `packages/client/src/net/NetworkManager.ts`: WebRTC peer connection, DataChannel management
- `packages/client/src/net/StateSync.ts`: Decode messages and update local entity state
- `packages/client/src/net/Protocol.ts`: Binary and JSON message codecs
- `packages/server/src/ws/connections.ts`: Route messages to connected players

**Testing:**
- `packages/client/src/dev/PlaywrightAPI.ts`: Test hooks exposed via window.__game
- No test files detected (not implemented yet)

## Naming Conventions

**Files:**
- Classes: PascalCase filename matching class name (GameHUD.ts contains class GameHUD)
- Utilities: camelCase or snake_case (protocol.ts, websocket.ts)
- Index files: index.ts or named entry point (EntityManager.ts not index.ts)
- Directories: kebab-case for grouped features (ecs, character-select)

**Directories:**
- Functional: Named by feature (auth, db, game, ui)
- Architectural: Named by pattern (ecs, systems, components, state)
- Plural for collections: systems, components, routes, screens

**Components (ECS):**
- Interface: [Name]Component (PositionComponent, MovementComponent)
- Factory: create[Name]() (createPosition(), createMovement())
- Type field: "position", "movement", "renderable" (lowercase, discriminant)

**Functions and Variables:**
- Classes: PascalCase
- Methods/functions: camelCase
- Constants: UPPER_SNAKE_CASE (PLAYER_SPEED, CHUNK_SIZE, TICK_INTERVAL)
- Private members: prefixed with # or _

**Routes:**
- Pattern: `POST /api/{feature}/{action}`
- Examples: POST /api/auth/login, POST /api/rtc/offer, POST /api/characters/create

## Where to Add New Code

**New Feature (e.g., trading system):**
- Primary code: `packages/server/src/game/{feature}.ts` (trading.ts with tick/resolve logic)
- Server route: `packages/server/src/routes/{feature}.ts` (rtc.ts already handles game commands via reliable channel; create new route only for REST endpoints)
- Client listener: `packages/client/src/net/StateSync.ts` (add case in switch for new opcode)
- UI: `packages/client/src/ui/screens/` or `packages/client/src/ui/components/`
- Protocol: Update `packages/shared/protocol.json` with new opcodes

**New Component Type (e.g., InventoryComponent):**
- Definition: `packages/client/src/ecs/components/Inventory.ts` (interface + factory)
- Update: `packages/client/src/ecs/EntityManager.ts` (add to Component union type)
- System: `packages/client/src/ecs/systems/InventorySystem.ts` (if logic needed)
- Register: `packages/client/src/engine/Game.ts` constructor (add system to loop)

**New System (e.g., LootSystem for drops):**
- Implementation: `packages/client/src/ecs/systems/LootSystem.ts`
- Register: `packages/client/src/engine/Game.ts` → add to loop.onRender()
- Depends on: EntityManager, specific components (e.g., ItemComponent, PositionComponent)

**New UI Screen:**
- Implementation: `packages/client/src/ui/screens/[ScreenName].ts`
- Class extends or returns DOM: See LoginScreen, GameHUD patterns
- Register: `packages/client/src/ui/Router.ts` → add case in navigateTo()
- Add type: Extend ScreenName union type in Router.ts

**Utilities/Helpers:**
- Shared across packages: `packages/shared/` (constants, types)
- Client-only: `packages/client/src/utils/` (new directory if needed)
- Server-only: `packages/server/src/utils/` (new directory if needed)
- Pattern: Export named functions or classes from utility files

## Special Directories

**packages/client/dist/:**
- Purpose: Vite build output
- Generated: Yes (run `bun run build`)
- Committed: No (in .gitignore)
- Contains: index.html, JS bundles, asset references

**packages/client/public/assets/:**
- Purpose: Game assets (3D models, textures, UI sprites)
- Generated: No (manually added)
- Committed: Yes (tracked in git)
- Formats: .glb (models), .png (textures), .svg (UI)

**packages/server/node_modules/:**
- Purpose: Dependencies
- Generated: Yes (bun install)
- Committed: No (.gitignore)

**drizzle/:**
- Purpose: Database migrations (if present)
- Generated: Yes (drizzle-kit generate)
- Committed: Yes (version control for schema)
- Location: At monorepo root or server/ (check drizzle.config.ts)

**packages/client/.vite/:**
- Purpose: Vite cache
- Generated: Yes
- Committed: No (.gitignore)

## Monorepo Structure

**Root package.json:**
- Contains: workspaces directive pointing to packages/*
- Dependencies: None (each package is independent)
- Scripts: None (packages have their own scripts)

**Package Scripts (from respective package.json):**
- Client: `vite` (dev), `build` (production)
- Server: `tsx src/index.ts` (via node --watch --import)

**Shared Package:**
- Contains: constants.json, protocol.json
- No build output (consumed directly)
- Both client and server import from this directory

**Lockfile:**
- `bun.lock`: Single lockfile for entire monorepo
- Location: Root directory
- Managed by: bun install/update
