# Coding Conventions

**Analysis Date:** 2026-03-19

## Naming Patterns

**Files:**
- PascalCase for classes and types: `EntityManager.ts`, `IsometricCamera.ts`, `AuthManager.ts`
- camelCase for utilities and modules: `config.ts`, `jwt.ts`, `protocol.ts`
- Descriptive names with domain context: `PKCEUtils.ts`, `PlaywrightAPI.ts`

**Functions:**
- camelCase: `createGameJwt()`, `getPlayerPosition()`, `registerEntity()`
- Helper/private functions use underscore prefix or private method modifier: `cellKey()` (private in EntityManager)
- Async functions: use standard camelCase: `fetchConfig()`, `handleCallback()`

**Variables:**
- camelCase for all local and module-level variables: `entityId`, `combatTimer`, `autoAttacking`
- Constants use UPPERCASE: `COMBAT_DECAY`, `REGEN_INTERVAL`, `SPATIAL_CELL_SIZE`, `RING_COLOR_TARGET`
- Const objects use camelCase when instance-like: `config`, `connectionManager`
- Map/Set variables describe contents: `states`, `entities`, `flashTimers`, `spawnPointMeshes`

**Types:**
- PascalCase interfaces: `PositionComponent`, `CombatState`, `AuthConfig`
- Discriminated union: `type ComponentType = Component["type"]` (string literal from component.type field)
- Type abbreviations acceptable: `T` for generics, `dt` for delta time

**Database/Schema:**
- snake_case for database columns: `oauth_sub`, `created_at`, `max_hp`
- PascalCase for table names in code: `accounts`, `characters` (lowercase in ORM)
- Abbreviations used in DB: `intStat` for "int" (reserved keyword), `str`, `dex`

## Code Style

**Formatting:**
- TypeScript 5.7 with strict mode enabled
- Target ES2022, module ESNext
- 2-space indentation (typical for Node/Web projects)
- No explicit formatter config found (Prettier not in use; tsconfig.json is source of truth)

**Linting:**
- ESLint not configured in workspace
- TypeScript compiler (strict: true) enforces type safety
- No explicit code style rules defined; convention is to follow codebase style

## Import Organization

**Order:**
1. External packages/frameworks: `import { FastifyInstance } from "fastify"`
2. Project internal (relative): `import { config } from "../config.js"`
3. Type imports separated: `import type { RTCPeerConnection } from "werift"`
4. Named imports grouped by source

**Path Aliases:**
- `@shared/*` maps to `../shared/*` (defined in both client and server tsconfig.json)
- Used for cross-package imports: `import { Opcode } from "@shared/protocol"`
- Relative imports still common within same package

**File extensions:**
- `.js` extensions required in imports (ES modules): `import { config } from "./config.js"`
- Used consistently across server and client code

## Error Handling

**Patterns:**
- Try-catch with silent error handling in some cases:
  ```typescript
  try { tokens = await exchangeCode(...); }
  catch { return reply.status(400).send({ detail: "Token exchange failed" }); }
  ```
- Fastify reply handlers return error responses: `reply.status(401).send({ detail: "..." })`
- Error messages are user-facing strings in detail field
- Null-checking before operations: `if (!entity) continue;`
- No Error subclasses; plain Error thrown with descriptive messages

**Validation:**
- Input validation at route handlers: `if (!username?.trim()) return reply.status(400).send(...)`
- Database queries validate existence: `if (!account) return reply.status(401).send(...)`
- Type casting with `as any` used when Fastify augments request object: `const account = (request as any).account`

## Logging

**Framework:** console (no logging library)

**Patterns:**
- `console.error()` for startup failures: `console.error("Failed to start server:", err)`
- Error logs with context: `console.error(\`[DB] Failed to save position for ${entityId}:\`, err)`
- Brackets denote context `[DB]`, `[Network]`
- No verbose logging throughout codebase; minimal noise

## Comments

**When to Comment:**
- Protocol specifications: `// Binary position update: 24 bytes...` with detailed format
- Dev-only feature notices: `/** Dev-only API exposed on window.__game for Playwright testing. */`
- Complex game logic explained: `// Skip sleeping NPCs (no players nearby)` in combat tick
- TODO comments rare in codebase

**JSDoc/TSDoc:**
- Minimal JSDoc usage
- Type annotations used instead of JSDoc types
- Dev mode API has extensive JSDoc for test harness

## Function Design

**Size:**
- Most functions 5-40 lines (utilities) to 20-100 lines (game systems)
- RenderSystem methods stay focused on single responsibility
- Combat tick loop ~50 lines with clear branching logic

**Parameters:**
- Destructuring used in route handlers: `const { username } = request.body`
- Optional parameters with defaults: `createPosition(x = 0, y = 0, z = 0, rotation = 0, mapId = 1)`
- Type parameters for generics: `getComponent<T extends Component>(entityId: string, type: ComponentType): T | undefined`

**Return Values:**
- Null for missing entities/components: `getEntity(id: string): Entity | undefined`
- Objects for data returns: `{ x, y, z, rotation, ...}`
- Promise<void> for async side-effect functions: `async function main()`
- Map/Set returns for collections: `getEntitiesInRadius(...): Entity[]`

## Module Design

**Exports:**
- Named exports for all public functions and types
- Single export per file when possible: `export const connectionManager = new ConnectionManager()`
- Module pattern for stateful singletons: `const states = new Map<...>(); export function getCombatState(...)`

**Barrel Files:**
- Not used; direct imports from module files
- Full paths required: `import { EntityManager } from "../EntityManager"`

**Classes vs. Functions:**
- Classes for stateful managers: `EntityManager`, `RenderSystem`, `AuthManager`, `SessionState`
- Procedural pattern for protocol/utilities: `jwt.ts`, `protocol.ts`, `combat.ts`
- Preference for module functions with private data structures over class-based approaches in game systems

## Component Pattern (ECS)

**Component Definition:**
- Interface with `type` discriminant field: `interface PositionComponent { type: "position"; x: number; ... }`
- Factory function for creation: `export function createPosition(...): PositionComponent`
- Strict typing with union types: `type Component = PositionComponent | MovementComponent | ...`

**Component System Methods:**
- Add: `addComponent(entityId, component)`
- Get: `getComponent<T>(entityId, type)`
- Query: `getEntitiesWithComponents(...types)`, `getEntitiesInRadius(x, z, radius)`

---

*Convention analysis: 2026-03-19*
