# Codebase Concerns

**Analysis Date:** 2026-03-19

## Tech Debt

**Monolithic UI Components:**
- Issue: Several UI screens are large single-file components without proper decomposition
- Files: `packages/client/src/ui/screens/CharacterCreateScreen.ts` (464 lines), `packages/client/src/engine/Game.ts` (279 lines), `packages/client/src/ui/screens/GameHUD.ts` (212 lines)
- Impact: Difficult to test, maintain, and reuse individual UI elements. Hard to refactor appearance logic.
- Fix approach: Extract sub-components (form fields, stat allocators, preview canvas) into separate classes. Create helper functions for repeated DOM patterns (fieldGroup, buttonStyle, etc.).

**Hardcoded Magic Numbers:**
- Issue: Position send interval, entity load radius, chunk size, and timing values scattered throughout code
- Files: `packages/client/src/engine/Game.ts` (line 32), `packages/server/src/game/world.ts` (lines 72, 114), `packages/server/src/routes/rtc.ts` (line 202)
- Impact: Difficult to tune gameplay parameters without searching through codebase. Inconsistent values in client and server.
- Fix approach: Create config objects per module (`client/config.ts`, `server/config/gameplay.ts`) with named constants. Document reasoning for each value.

**NPC Templates as Static Data:**
- Issue: 302-line hardcoded NPC template registry with no dynamic loading mechanism
- Files: `packages/server/src/game/npc-templates.ts` (entire file)
- Impact: Adding new NPCs requires code changes. No ability to hot-reload or modify during runtime. Template builder pattern is applied inconsistently (SKELETON_GROUP/INTERACTIVE_BASE mix).
- Fix approach: Move templates to JSON/database. Create template loader service. Consider data-driven inheritance system instead of code-based.

**Type Safety Issues with `any`:**
- Issue: Frequent use of `any` type in request/response handling circumvents type safety
- Files: `packages/server/src/routes/rtc.ts` (lines 89, 90, 114), `packages/server/src/routes/auth.ts` (lines 48, 55, 79), `packages/client/src/net/StateSync.ts` (lines 123, 132, 138)
- Impact: Runtime errors possible when protocol changes. No IDE autocomplete for entity/combat data. Hard to refactor.
- Fix approach: Create strict interfaces for all message types. Use Protocol Buffer or msgpack validation. Replace `any` with discriminated unions for message handling.

**Unhandled Promise Rejections:**
- Issue: Several async operations lack error handling or propagate errors silently
- Files: `packages/server/src/routes/rtc.ts` (line 162: .catch logs only), `packages/server/src/routes/auth.ts` (lines 49-50, 56-57: catch blocks swallow errors)
- Impact: Failed database operations or network calls leave system in inconsistent state. Silent failures make debugging hard.
- Fix approach: Implement structured error handling with explicit error types. Use error boundaries in async flows. Log with full context (userId, operation, error trace).

**Hash Collision Risk:**
- Issue: Simple string hash function used for entity ID mapping could collide
- Files: `packages/server/src/game/world.ts` (line 126), `packages/client/src/net/StateSync.ts` (line 33)
- Impact: Same hash value could map two different entity IDs to same numeric ID, causing position sync issues
- Fix approach: Use crypto.hashSync or UUID-based mapping instead. Add collision detection tests.

## Known Bugs

**World Ready Timeout Race:**
- Symptoms: "World ready" message sometimes not received, client stuck waiting for spawn data
- Files: `packages/client/src/net/NetworkManager.ts` (lines 134-144)
- Trigger: Reliable channel delays or drops initial WORLD_READY message before worldReadyResolve callback set
- Workaround: Timeout eventually fires after 5 seconds, allowing connection attempt to proceed (but with missing spawn data)
- Root cause: worldReadyResolve callback is set after reliable channel may have already sent WORLD_READY

**Lingering Character State Inconsistency:**
- Symptoms: Reconnected player may have different HP/position on client vs server if combat occurred while lingering
- Files: `packages/server/src/routes/rtc.ts` (lines 60-74), `packages/server/src/game/linger.ts` (not examined)
- Trigger: Disconnect during combat → reconnect within 2-minute window
- Current mitigation: Combat system tracks state, but client receives stale entity state on reconnect
- Fix: Send full combat state on reconnect, not just position

**Drag-and-Drop Prevention:**
- Symptoms: Text and images can be selected and dragged from game client, disrupting UX
- Files: `packages/client/src/ui/screens/CharacterCreateScreen.ts` (no drag prevention CSS)
- Trigger: User drags on character preview canvas or form elements
- Workaround: User must dismiss drag overlay
- Fix: Add `user-select: none` and `pointer-events: none` to all UI elements

## Security Considerations

**CORS Hardcoded to localhost:**
- Risk: Production build will fail or default to unsafe CORS
- Files: `packages/server/src/app.ts` (line 11)
- Current mitigation: Logging only, no actual restriction
- Recommendations:
  - Move CORS origin to environment variable
  - Reject if origin not whitelisted in config
  - Add CSRF token validation for state-changing operations

**OAuth Token Exposure in DevTools:**
- Risk: Game JWT token visible in network tab, localStorage, or sessionStorage
- Files: `packages/client/src/auth/AuthManager.ts` (stores in session object)
- Current mitigation: None observed
- Recommendations:
  - Use httpOnly cookies for JWT storage (requires server support)
  - Implement token rotation on refresh
  - Add CSP headers to prevent XSS from exfiltrating tokens
  - Audit all token logging/debugging code

**No Rate Limiting:**
- Risk: Clients can spam position updates, combat actions, or character creation
- Files: `packages/server/src/routes/` (all handlers)
- Current mitigation: None
- Recommendations:
  - Implement per-client rate limiting on RTC endpoints
  - Add exponential backoff for failed operations
  - Track position send rate client-side before sending

**SQL Injection via Drizzle:**
- Risk: Low if using Drizzle ORM correctly, but dynamic queries possible
- Files: `packages/server/src/routes/auth.ts`, `packages/server/src/routes/characters.ts`, `packages/server/src/routes/rtc.ts`
- Current mitigation: Using parameterized queries with eq() helpers
- Recommendations:
  - Add input validation layer before queries
  - Audit all direct query construction
  - Keep Drizzle ORM updated

**No Input Validation:**
- Risk: Character names, stats, skills not validated before storage
- Files: `packages/client/src/ui/screens/CharacterCreateScreen.ts` (minimal validation), `packages/server/src/routes/characters.ts` (not examined)
- Current mitigation: Client-side name length check (3-20 chars), stat range check
- Recommendations:
  - Add server-side validation for all character creation inputs
  - Sanitize strings before database/display
  - Validate stat distributions cannot exceed totals via replay attack

## Performance Bottlenecks

**Inefficient Entity Sync:**
- Problem: Server iterates all entities twice per tick (once for positions, once for state)
- Files: `packages/server/src/game/world.ts` (lines 62, 98)
- Cause: Separate broadcastPositions() and broadcastState() functions, each loop over all entities
- Improvement path: Combine into single loop, pack positions + state into one message per entity

**No Spatial Partitioning:**
- Problem: Every entity-to-entity distance check is O(n²) per tick
- Files: `packages/server/src/game/world.ts` (lines 69-77, 112-115), `packages/server/src/game/combat.ts` (lines 86-91)
- Cause: Linear search through all entities for each client's nearby entities
- Improvement path: Implement quadtree or grid-based spatial index. Update on movement. Pre-calculate in nearby() helper.

**Large UI Render on Every Stat Change:**
- Problem: CharacterCreateScreen re-renders entire stat allocator UI on slider change
- Files: `packages/client/src/ui/screens/CharacterCreateScreen.ts` (lines 195-212)
- Cause: Updating value display and bar width separately, then recalculating remaining points
- Improvement path: Use data binding or component state. Only update changed elements.

**String Hash Recalculation:**
- Problem: hashCode() called for every position broadcast, every entity, every client
- Files: `packages/server/src/game/world.ts` (line 74), `packages/client/src/net/StateSync.ts` (lines 129, 154)
- Cause: Hash computed on-the-fly instead of cached
- Improvement path: Cache entityId → hash mapping during entity creation. Update on despawn.

**No Mesh Pooling:**
- Problem: Creating/destroying entity meshes every spawn/despawn allocates memory
- Files: `packages/client/src/ecs/systems/RenderSystem.ts` (not examined, but implied)
- Impact: GC pauses during entity churn
- Fix: Implement object pool for mesh instances

## Fragile Areas

**WebRTC Connection Handshake:**
- Files: `packages/client/src/net/NetworkManager.ts`, `packages/server/src/routes/rtc.ts`
- Why fragile: Complex state machine with multiple Promise races and timeouts. ICE gathering, DataChannel readiness, and answer timing all interdependent. No transaction rollback if answer fails.
- Safe modification: Add comprehensive logging at each phase. Add timeout per phase (not global). Test with slow/lossy networks. Extract into state machine class.
- Test coverage: Limited; basic connection flow only

**Game Loop Tick Interval:**
- Files: `packages/server/src/game/world.ts` (lines 10-19), server entry point
- Why fragile: setInterval timer not resistant to long-running callbacks. No monitoring of tick overflow. Drift accumulates.
- Safe modification: Replace with proper scheduler using process.hrtime or worker threads. Add tick overflow detection and logging.
- Test coverage: No explicit timing tests

**Entity Lingering State:**
- Files: `packages/server/src/game/linger.ts` (not examined)
- Why fragile: Lingering characters can be attacked, lose HP, then reconnect with stale state. Race condition between combat tick and linger cleanup.
- Safe modification: Add state transition guards. Test reconnection during active combat. Consider atomic updates.
- Test coverage: Not assessed

**Combat Auto-Attack Toggle:**
- Files: `packages/server/src/game/combat.ts` (lines 42-50, 94-109), `packages/client/src/engine/Game.ts` (lines 234-237)
- Why fragile: Toggle packet can be lost. Double-click toggles can create desync. No acknowledgment of state change.
- Safe modification: Add sequence numbers to combat state updates. Send state not just toggle. Use idempotent operations.
- Test coverage: No explicit tests for toggle edge cases

## Scaling Limits

**Entity Count Scaling:**
- Current capacity: Server tested with ~50 entities (observation from spawn points)
- Limit: O(n²) combat distance checks + O(n*m) position broadcasts will hit CPU ceiling ~500 entities
- Scaling path:
  1. Implement spatial partitioning (quadtree)
  2. Add region-based entity visibility
  3. Split game loop across worker threads
  4. Consider entity sharding across multiple servers

**Network Bandwidth:**
- Current capacity: ~30 concurrent clients comfortable at 20Hz + 15Hz position updates
- Limit: Position broadcast is O(n*m) with 20-byte packets. ~500 nearby entities × 100 clients = 1MB/s
- Scaling path:
  1. Reduce position broadcast frequency to 10Hz
  2. Implement delta compression
  3. Use binary format for all messages
  4. Add compression layer (e.g., Snappy)

**Memory:**
- Current capacity: ~50-100MB for server with ~50 entities
- Limit: Entity store grows unbounded (no GC). Combat state map never purges dead entities.
- Scaling path:
  1. Add automatic dead entity cleanup in combat.ts
  2. Implement memory pooling
  3. Monitor heap size, warn at thresholds
  4. Consider memory-efficient data structures (buffer instead of object maps)

**Database Connections:**
- Current capacity: Single database connection pool (default size varies by driver)
- Limit: RTCRoutes causes position update storms during disconnects (line 159-162)
- Scaling path:
  1. Batch position updates (queue, flush every 500ms)
  2. Use connection pool with appropriate size
  3. Add query timeout
  4. Consider async update queue with worker process

## Dependencies at Risk

**werift WebRTC Library:**
- Risk: Small/niche library, may not track browser WebRTC API changes. TypeScript types may lag.
- Impact: Breaking changes in browser implementations require werift updates
- Migration plan: Monitor werift releases. Have fallback to standard RTCPeerConnection API. Consider switch to peerjs if werift becomes unmaintained.

**Babylon.js Version:**
- Risk: Large dependency, frequent updates may introduce breaking changes in rendering
- Impact: Client build may break on dependency update
- Migration plan: Pin major version in package.json. Test upgrade path before updating. Consider lighter 3D lib if rendering becomes bottleneck.

**Node Version Requirement:**
- Risk: Server needs Node for UDP stack (not Bun), but werift may require specific Node versions
- Impact: Deployment complexity, incompatibility with some hosting platforms
- Migration plan: Document exact Node/Bun version requirements. Consider moving entirely to Node.js or pure Bun if werift updates support it.

## Missing Critical Features

**No Persistent State for NPCs:**
- Problem: NPCs respawn at fixed spawns, no loot, no quest state. World feels static.
- Blocks: PvP economy, progression, reason to revisit zones
- Priority: Medium (affects long-term engagement)

**No Account Validation or Email Verification:**
- Problem: Anyone can claim any email address, no email verification
- Blocks: Account recovery, secure password reset, spam prevention
- Priority: High (security risk)

**No Character Deletion:**
- Problem: Characters accumulate, no cleanup mechanism
- Blocks: Player cleanup, alt management
- Priority: Medium (data growth concern)

**No Trading or Item Drops:**
- Problem: Combat produces no loot, no player-to-player transactions
- Blocks: Economy, social interaction beyond combat
- Priority: Medium (gameplay feature)

**No Skill Advancement:**
- Problem: Starting skills are static, no progression path
- Blocks: Differentiation between players, long-term goals
- Priority: High (gameplay progression)

## Test Coverage Gaps

**Character Creation Validation:**
- What's not tested: Name validation edge cases (special chars, unicode), stat overflow via replay attack, skill selection limits
- Files: `packages/client/src/ui/screens/CharacterCreateScreen.ts`, `packages/server/src/routes/characters.ts`
- Risk: Invalid characters created, server crashes on malformed data
- Priority: High

**WebRTC Connection Recovery:**
- What's not tested: Connection timeout scenarios, answer phase failures, partial DataChannel opens
- Files: `packages/client/src/net/NetworkManager.ts`, `packages/server/src/routes/rtc.ts`
- Risk: Silent failures, client stuck in connecting state
- Priority: High

**Combat Damage Calculation:**
- What's not tested: Weapon range boundaries, HP floor/ceiling, death event consistency
- Files: `packages/server/src/game/combat.ts`
- Risk: Negative HP, missed deaths, damage event storms
- Priority: High

**Entity Despawn Cleanup:**
- What's not tested: Combat state cleanup on entity removal, position cache cleanup
- Files: `packages/server/src/game/entities.ts`, `packages/server/src/game/combat.ts`
- Risk: Memory leaks, stale combat state causing ghost attacks
- Priority: Medium

**OAuth Flow Edge Cases:**
- What's not tested: Token refresh failure, userinfo endpoint timeout, missing userinfo fields
- Files: `packages/server/src/routes/auth.ts`, `packages/server/src/auth/oauth.ts`
- Risk: Auth flow breaks silently, users cannot log in
- Priority: High

**Chunk Loading Boundaries:**
- What's not tested: Entity visibility at chunk boundaries, rapid movement across boundaries
- Files: `packages/client/src/world/ChunkManager.ts`
- Risk: Entities pop in/out unpredictably, causing jarring visuals
- Priority: Medium

---

*Concerns audit: 2026-03-19*
