# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Client-authoritative network architecture with separate concerns for rendering, state synchronization, and network transport.

**Key Characteristics:**
- WebRTC DataChannels for real-time position updates (unreliable) and game events (reliable)
- Server-authoritative game loop (20Hz) for combat, NPC behavior, and entity state
- Client-side ECS (Entity Component System) for local simulation and rendering
- Isometric orthographic 3D rendering via Babylon.js
- Chunk-based world with spatial grid indexing for efficient entity queries
- Binary protocol for position updates, JSON for reliable game events

## Layers

**Presentation Layer:**
- Purpose: UI rendering and screen management
- Location: `packages/client/src/ui/`
- Contains: Screen components (LoginScreen, GameHUD, CharacterSelectScreen), Router, UIManager
- Depends on: SessionState, AuthManager, Game instance
- Used by: Main application boot flow

**Game Engine Layer:**
- Purpose: Core game loop, rendering pipeline, input handling, asset management
- Location: `packages/client/src/engine/`
- Contains: Game (orchestrator), SceneManager (Babylon.js scene), IsometricCamera, InputManager, Loop (tick/render separation), AssetCache
- Depends on: ECS (EntityManager, Systems), ChunkManager, NetworkManager, StateSync
- Used by: UI Router, main.ts entry point

**Entity Component System (ECS):**
- Purpose: Data-driven entity management and behavior systems
- Location: `packages/client/src/ecs/`
- Components: `packages/client/src/ecs/components/` (Position, Movement, Renderable, Identity, Stats, Combat)
- Systems: `packages/client/src/ecs/systems/` (MovementSystem, RenderSystem, AnimationSystem, InterpolationSystem, CombatSystem)
- EntityManager: Maintains entities, components, spatial grid for efficient radius queries
- Used by: Game, StateSync

**Network Layer:**
- Purpose: WebRTC connectivity and message routing
- Location: `packages/client/src/net/`
- Contains: NetworkManager (WebRTC peer connection, dual DataChannels), StateSync (message interpretation and entity updates), Protocol (binary/JSON codecs)
- Depends on: ECS, external werift library
- Used by: Game

**World/Chunk Management:**
- Purpose: Spatial data structure and asset streaming
- Location: `packages/client/src/world/`
- Contains: ChunkManager (track loaded chunks), Chunk (individual chunk data), WorldConstants, TileRegistry
- Depends on: SceneManager
- Used by: Game

**Authentication & State:**
- Purpose: User session management and auth flow
- Location: `packages/client/src/auth/`, `packages/client/src/state/`
- Contains: AuthManager (OAuth2 PKCE flow, dev login), SessionState (token storage, session validation)
- Depends on: TokenStore
- Used by: Router, main.ts

**Server Game Loop:**
- Purpose: Authoritative game state, combat resolution, NPC logic
- Location: `packages/server/src/game/`
- Contains: world.ts (20Hz game tick), combat.ts (combat state machine), entities.ts (entity store), npcs.ts (NPC spawn/wander), protocol.ts (message packing)
- Depends on: ConnectionManager, EntityStore
- Used by: Game loop timer

**Server Routing & RTC Signaling:**
- Purpose: HTTP API endpoints, WebRTC offer/answer signaling
- Location: `packages/server/src/routes/`, `packages/server/src/ws/`
- Contains: rtc.ts (WebRTC negotiation, DataChannel setup), auth.ts, characters.ts, world.ts, ConnectionManager (maintains active player connections)
- Depends on: Fastify, werift, auth middleware, game state
- Used by: Client network handshake

## Data Flow

**Login Flow:**

1. User visits application → main.ts boot()
2. Router checks SessionState.isAuthenticated()
3. If not authenticated, navigate to LoginScreen
4. User clicks "Login with OAuth" → AuthManager.startLogin() initiates PKCE flow to id.dx.deepgram.com
5. Auth callback with code → Router.handleAuthCallback() exchanges code for JWT token
6. Token stored in SessionState → navigate to character-select

**Game Connection Flow:**

1. Player selects character on CharacterSelectScreen
2. Router calls Game.connectToServer(token, characterId)
3. NetworkManager.connect():
   - POST `/api/rtc/offer` with characterId and Bearer token
   - Server (rtc.ts /offer endpoint) creates RTCPeerConnection, initializes two DataChannels (position, reliable)
   - Server creates offer SDP and returns it
   - Client creates RTCPeerConnection, sets remote description, creates answer
   - POST `/api/rtc/answer` with answer SDP
   - Both sides wait for DataChannel "open" events
4. NetworkManager.waitForWorldReady() waits for WORLD_READY message (opcode 100)
5. Game.start(characterId) spawns local player entity and starts game loop
6. Router navigates to GameHUD screen

**Position Update Flow (15Hz from client):**

1. Game.tick() reads InputManager state
2. Updates local player movement component
3. Game.sendPositionUpdate() encodes position to binary (24 bytes: opcode, flags, sequence, entityId, x, y, z, rotation)
4. NetworkManager.sendPosition() sends via unreliable DataChannel
5. Server receives on positionChannel, updates entityStore entity position
6. Every 500ms, server broadcastPositions() batches all nearby entities and sends to all clients
7. StateSync.handlePositionMessage() decodes batched positions (count + N × 20 bytes)
8. Updates remote target position on Position components
9. InterpolationSystem interpolates from current to remote target over frame time

**Reliable Message Flow (combat, stats, events):**

1. Client sends via Game.sendAutoAttackToggle() → packReliable(Opcode.AUTO_ATTACK_TOGGLE, { targetId })
2. NetworkManager.sendReliable() sends JSON string via ordered reliable DataChannel
3. Server receives on reliableChannel, processes message in rtc.ts message handler
4. Server publishes events: packDamageEvent(), packEntityDeath(), packEntityState()
5. ConnectionManager.broadcastReliable() sends to all connected players
6. StateSync.handleReliableMessage() decodes and dispatches to callbacks (onDamage, onDeath, onCombatState)
7. Game updates entity state, triggers visual effects via RenderSystem

**Combat Tick (20Hz on server):**

1. Server game loop calls combatTick(dt)
2. For each entity in combat: decrement windUpTimer, when ready resolve attack
3. Calculate damage against target, generate DamageEvent
4. Broadcast damage event to all players via reliable channel
5. Client receives, RenderSystem.flashEntity() and showAttackLine()
6. When HP reaches 0, generate DeathEvent
7. Server removes entity, client removes mesh and entity

**State Broadcast (every 500ms on server):**

1. Server iterates all connected players
2. For self: sends own combat state (inCombat, autoAttacking, targetId) and entity state (hp, maxHp)
3. For nearby entities (within 32 tile radius): sends entity state if combat state exists
4. Client receives via reliableChannel, StateSync updates Stats components

**State Management:**

- **Client Side:** SessionState holds auth token and user info. EntityManager holds all local entities with their components. Game orchestrates systems.
- **Server Side:** EntityStore holds all active entities (players and NPCs). ConnectionManager tracks active player connections. CombatState map (separate) holds combat data for entities. Linger system (linger.ts) keeps entities alive for 30 seconds after disconnect to support reconnect.

## Key Abstractions

**Entity:**
- Purpose: Container for components representing any game object (player, NPC, mob)
- Examples: `packages/client/src/ecs/EntityManager.ts`, `packages/server/src/game/entities.ts`
- Pattern: ECS architecture. Entities are IDs with a Map of components keyed by component type

**Component:**
- Purpose: Data container for a specific aspect of an entity (position, movement, rendering, combat)
- Examples: `packages/client/src/ecs/components/Position.ts`, `packages/client/src/ecs/components/Combat.ts`
- Pattern: Discriminated union via component.type field. Each component type has a factory function (createPosition, createMovement, etc.)

**System:**
- Purpose: Logic that operates on entities with specific components
- Examples: `packages/client/src/ecs/systems/MovementSystem.ts`, `packages/client/src/ecs/systems/RenderSystem.ts`
- Pattern: Systems are called explicitly from Game.start() render loop, not auto-discovered. Each system has an update(dt) method

**ConnectionManager:**
- Purpose: Manage active WebRTC connections and broadcast messages to players
- Examples: `packages/server/src/ws/connections.ts`
- Pattern: Singleton instance. Methods: add(), get(), remove(), sendReliable(), sendPosition(), broadcastReliable()

**StateSync:**
- Purpose: Translate binary and JSON protocol messages into entity state updates
- Examples: `packages/client/src/net/StateSync.ts`
- Pattern: Observer callbacks (setOnDamage, setOnDeath, setOnCombatState). Maintains numeric ID → entity ID hash map for batched position data

**Protocol:**
- Purpose: Binary and JSON encoding/decoding for network messages
- Examples: `packages/client/src/net/Protocol.ts`, `packages/server/src/game/protocol.ts`
- Pattern: Opcode enum + pack/unpack functions. Position is binary (24 bytes), reliable messages are JSON strings

**Spatial Grid:**
- Purpose: Efficient entity queries by location
- Examples: `packages/client/src/ecs/EntityManager.ts` (lines 23-145)
- Pattern: 16-tile cells. Used by getEntitiesInRadius() for LOD queries and animation targets

## Entry Points

**Client Entry Point:**
- Location: `packages/client/src/main.ts`
- Triggers: Browser page load
- Responsibilities: Boot auth system, initialize UI Router, handle OAuth callback, navigate to first screen (login or character-select)

**Server Entry Point:**
- Location: `packages/server/src/index.ts`
- Triggers: `node --watch --import tsx src/index.ts`
- Responsibilities: Build Fastify app, connect to Redis, spawn initial NPCs, start 20Hz game loop, listen on configured port

**Game Start:**
- Location: `packages/client/src/engine/Game.ts` start() method
- Triggers: Router calls setOnEnterGame() callback after WebRTC connection established
- Responsibilities: Create local player entity, initialize ECS systems, start Loop (tick/render separation)

**RTC Offer Endpoint:**
- Location: `packages/server/src/routes/rtc.ts` POST /api/rtc/offer
- Triggers: NetworkManager.connect() on client
- Responsibilities: Validate JWT, load player character from DB, create RTCPeerConnection, setup DataChannels, spawn or reconnect entity, return SDP offer

**Game Loop Tick:**
- Location: `packages/server/src/game/world.ts` gameTick() function
- Triggers: setInterval(gameTick, 50ms) at server startup
- Responsibilities: NPC wandering, combat resolution, broadcast positions and state, handle NPC deaths

## Error Handling

**Strategy:** Multi-layered with fallback messaging and graceful degradation

**Patterns:**

- **WebRTC Failures:** NetworkManager detects connection state changes. If "failed", "closed", or "disconnected", calls onDisconnect callback. Client shows error dialog and returns to login screen. (Game.ts line 141-142, main.ts line 41-46)

- **Message Parsing:** StateSync wraps unpackReliable() in try/catch. If JSON parse fails, continues without updating state. (StateSync.ts, line 81-84)

- **Missing Entities:** Systems check for entity existence before accessing components. getComponent() returns undefined if not found, callers check with optional chaining. (MovementSystem, RenderSystem)

- **Disconnection Recovery:** Linger system (linger.ts) keeps entities alive for 30 seconds. If player reconnects, entity state is preserved. (rtc.ts line 32-44)

- **Position Timeout:** If DataChannel send fails (readyState !== "open"), message is silently dropped. Server receives positions at frame rate if connection is stable. (NetworkManager.ts line 146-147, connections.ts line 39-44)

## Cross-Cutting Concerns

**Logging:** Browser console.log() for client errors, Node console.log() for server. Key points: "[WebRTC]", "[Disconnect]", "[Dev]" prefixes. Server logs game loop start, entity despawn.

**Validation:** JWT validation via requireAuth middleware on all protected routes (auth.ts). Character ownership verified by comparing request.account.id with database account_id. Client validates token presence before sending game messages.

**Authentication:** OAuth2 PKCE flow via AuthManager for production login. Dev mode supports username/password. Server issues game JWT on successful auth. All subsequent game connections require Bearer token.

**Performance Optimization:**
- Spatial grid indexing (16-tile cells) for O(1) nearby entity queries instead of O(n)
- Batched position updates (multiple entities in one message) instead of individual messages
- 15Hz position send rate (slower than 20Hz tick) to reduce bandwidth
- NPC sleep system (tick only if player within 32 tiles) to reduce server CPU
- Chunk streaming (future) for client asset loading
