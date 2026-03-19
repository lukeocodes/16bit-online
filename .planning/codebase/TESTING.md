# Testing Patterns

**Analysis Date:** 2026-03-19

## Test Framework

**Status:** Manual/Integration Testing Only

- No unit test framework (Jest, Vitest, Mocha) configured
- No test files (*.test.ts, *.spec.ts) in codebase
- Testing approach is integration-based via Playwright automation
- See `AGENTS-TESTING.md` for testing strategy

**Run Commands:**
```bash
# No automated test suite available
# Testing done manually via Playwright through MCP tools
# Start servers and use browser_* actions with PlaywrightAPI
```

## Integration Testing via Playwright

**Framework:** Playwright (browser automation)

**Dev Mode Exposure:**
- Test harness exposed as `window.__game` in dev mode only
- Implementation: `packages/client/src/dev/PlaywrightAPI.ts`
- Gated by `import.meta.env.DEV` check

**API Interface:**

Query methods:
```typescript
getPlayerPosition(): { x: number; y: number; z: number } | null
getEntityList(): Array<{ id: string; name: string; type: string; x: number; z: number; hp?: number; maxHp?: number }>
getEntityById(id: string): any | null
getPlayerStats(): { hp: number; maxHp: number; mana: number; maxMana: number } | null
getPlayerCombat(): { inCombat: boolean; autoAttacking: boolean; targetId: string | null } | null
isConnected(): boolean
```

Action methods:
```typescript
move(direction: "w" | "a" | "s" | "d"): void
moveTo(tileX: number, tileZ: number): void
selectTarget(entityId: string): void
clearTarget(): void
toggleAutoAttack(entityId?: string): void
cancelAutoAttack(): void
```

Async wait helpers:
```typescript
waitForEntity(entityId: string, timeoutMs?: number): Promise<boolean>
waitForCombatState(inCombat: boolean, timeoutMs?: number): Promise<boolean>
waitForHp(entityId: string, hp: number, comparison: "lt" | "gt" | "eq", timeoutMs?: number): Promise<boolean>
```

## Test Structure

**Environment:**
- Dev servers must be running: server on 8000, client on 5173
- Use regular Chrome/Chromium (not ungoogled-chromium; blocks WebRTC)
- Safari acceptable for testing (has WebRTC support)

**Login Flow Pattern:**
```
1. browser_navigate → http://localhost:5173
2. browser_fill_form → username field
3. browser_click → "Sign In" button
4. browser_click → "Continue" (×3 for onboarding screens)
5. browser_click → "Create Character" or "Play"
6. Verify window.__game is available and connected
```

**Test Pattern - Single Player Combat:**
```javascript
async () => {
  const api = window.__game;

  // Helper: Move toward target
  const moveToward = async (tx, tz) => {
    const pos = api.getPlayerPosition();
    const dx = tx - Math.round(pos.x), dz = tz - Math.round(pos.z);
    if (dx === 0 && dz === 0) return;
    api.move(Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "d" : "a") : (dz > 0 ? "w" : "s"));
    await new Promise(r => setTimeout(r, 400)); // Wait for move to complete
  };

  // Find closest live NPC
  const npcs = api.getEntityList().filter(e => e.type === "npc" && (e.hp ?? 0) > 0);
  const pos = api.getPlayerPosition();
  const target = npcs.sort((a, b) =>
    (Math.abs(a.x - pos.x) + Math.abs(a.z - pos.z)) -
    (Math.abs(b.x - pos.x) + Math.abs(b.z - pos.z))
  )[0];

  // Attack sequence
  api.selectTarget(target.id);
  api.toggleAutoAttack(target.id);

  // Move into melee range (1 tile)
  for (let i = 0; i < 25; i++) {
    const p = api.getPlayerPosition();
    const dist = Math.max(Math.abs(p.x - target.x), Math.abs(p.z - target.z));
    if (dist <= 1) break;
    await moveToward(target.x, target.z);
  }

  // Wait for NPC death + despawn
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (!api.getEntityById(target.id)) break;
  }

  // Verify state
  const stats = api.getPlayerStats();
  return { playerHp: stats.hp, alive: stats.hp > 0 };
}
```

**Test Pattern - Multi-Player Visibility:**
```javascript
// Use browser_tabs action "select" to switch between tabs
// Each tab is independent player with own WebRTC connection

// Tab 0:
const tab0Player = window.__game.getPlayerPosition();
const tab0Sees = window.__game.getEntityList().filter(e => e.type === "player");

// Tab 1:
const tab1Player = window.__game.getPlayerPosition();
const tab1Sees = window.__game.getEntityList().filter(e => e.type === "player");

// Verify cross-visibility and position sync
```

## What Gets Tested

**Integration Tests:**
1. Connection established: `api.isConnected()` returns true
2. Entity spawning: NPCs present at startup
3. Position sync: Player movement updates in real-time
4. Combat flow:
   - Target selection: `selectTarget()` updates `getPlayerCombat().targetId`
   - Auto-attack toggle: `toggleAutoAttack()` sets combat state
   - Damage dealt: NPC `hp` decreases, dies, despawns
5. NPC respawn: Dead NPC reappears after 5-8 seconds
6. Health regeneration: Player HP recovers out-of-combat
7. Multi-player visibility: Both clients see each other's positions and actions

## What is NOT Tested

**No Unit Tests:**
- Individual game system functions (combat tick, interpolation, pathfinding)
- Utility functions (PKCE generation, JWT encoding, protocol packing)
- Component lifecycle (add, remove, update)
- Database operations (character creation, position saving)

**No UI Tests:**
- Screen rendering (onboarding, character select, HUD)
- Form validation (character creation name checks)
- Button interactions besides game actions
- Chat/messaging functionality

**Known Testing Constraints:**
- Ungoogled Chromium: WebRTC blocked (zero ICE candidates) — use regular Chrome
- Keyboard simulation: `keyboard.press()` sends instant keydown+keyup; use `api.move()` instead
- Scene picking: Requires `@babylonjs/core/Culling/ray` import (side effect in Babylon.js)
- Entity ID mapping: String IDs use hash mapping; check `numericIdMap` if positions don't update

## Testing Strategy Going Forward

**Integration Tests via Playwright MCP:**
- Cron loop testing: `/loop 5m <prompt>` schedules recurring test rounds
- Cancel with: `CronDelete <id>`
- Proven stable: 50+ combat rounds without server crash
- Use for regression testing during major features

**Manual Testing Checklist (Each Round):**
1. ✓ Connection alive: `api.isConnected()`
2. ✓ NPCs spawned: `api.getEntityList()` has 4+ NPCs
3. ✓ Kill one NPC: HP → 0, despawns
4. ✓ Respawn check: NPC reappears in 5-8s at new position
5. ✓ Health regen: `api.getPlayerStats().hp` ≥ 47 (started at 50)
6. ✓ Multi-player: Both tabs see each other's updated positions

**Server-Side Untested Code:**
- Database transactions (Drizzle ORM queries)
- Auth middleware JWT validation
- Game loop physics (position updates at 20Hz)
- NPC behavior spawning and templates
- WebRTC connection lifecycle

These would require unit/integration test suites to cover properly.

---

*Testing analysis: 2026-03-19*
