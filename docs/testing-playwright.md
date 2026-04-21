# Playwright automated testing

Playwright MCP tools drive autonomous integration testing. `window.__game` (in the game client) and `window.__builder` (in the builder) expose the engine internals so tests can move the player, select targets, read entity state, etc. without pixel-clicking on canvas elements.

## Setup

1. Both servers must be running — PostgreSQL on 5433 + Redis + server on 8000 + Vite on 5173.
2. Use **regular Chrome** (or whatever Playwright MCP launches). Ungoogled Chromium blocks WebRTC, so DataChannels never come up.
3. The dev API is only available when `import.meta.env.DEV` is true (default with `vite`).

## Login flow

Credentials:
- **Username:** `lukeocodes`
- **Password:** *(leave blank)*

```
browser_navigate → http://localhost:5173
browser_fill_form → username: lukeocodes, password: (empty)
browser_click → "Sign In"
browser_click → "Continue" (×3 for onboarding; skip if returning user)
browser_click → "Create Character" or "Play"
```

## Combat test loop (proven stable for 50+ rounds)

```javascript
async () => {
  const api = window.__game;
  const moveToward = async (tx, tz) => {
    const pos = api.getPlayerPosition();
    const dx = tx - Math.round(pos.x), dz = tz - Math.round(pos.z);
    if (dx === 0 && dz === 0) return;
    api.move(Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "d" : "a") : (dz > 0 ? "w" : "s"));
    await new Promise(r => setTimeout(r, 400));
  };

  // Find and attack closest NPC
  const npcs = api.getEntityList().filter(e => e.type === "npc" && (e.hp ?? 0) > 0);
  const pos = api.getPlayerPosition();
  const target = npcs.sort((a, b) =>
    (Math.abs(a.x - pos.x) + Math.abs(a.z - pos.z)) -
    (Math.abs(b.x - pos.x) + Math.abs(b.z - pos.z))
  )[0];

  api.selectTarget(target.id);
  api.toggleAutoAttack(target.id);

  // Walk into melee range
  for (let i = 0; i < 25; i++) {
    const p = api.getPlayerPosition();
    if (Math.max(Math.abs(p.x - target.x), Math.abs(p.z - target.z)) <= 1) break;
    await moveToward(target.x, target.z);
  }

  // Wait for kill
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (!api.getEntityById(target.id)) break; // Dead + despawned
  }

  return api.getPlayerStats(); // Verify HP, check combat state
}
```

## Multi-player testing

- Use `browser_tabs` action "select" to switch between tabs (index 0 and 1).
- Each tab is a separate player with its own WebRTC connection.
- Verify cross-client visibility: `api.getEntityList().filter(e => e.type === "player")`.
- Both players should see each other's updated positions.

## Cron loop

Use `/loop 5m <prompt>` to schedule recurring Playwright test rounds. Cancel with `CronDelete <id>`.

## What to verify each round

1. `api.isConnected()` — WebRTC still alive.
2. `api.getEntityList()` — NPCs present (should be 4).
3. Kill an NPC — HP drops to 0, entity despawns.
4. Wait 5–8s — NPC respawns at random position.
5. `api.getPlayerStats()` — HP stable (47+ after regen).
6. Both tabs see each other's positions.

## Known constraints

- **Ungoogled Chromium**: WebRTC blocked, zero ICE candidates → DataChannel never opens.
- **`keyboard.press('w')`** sends instant keydown+keyup which the input buffer misses. Use `api.move("w")` instead.
- **Entity IDs** use u32 hash mapping — if positions aren't updating, check `numericIdMap` in `StateSync` for hash-collision / missing-entity issues.
- **Sandbox flag**: see `docs/dev-environment.md` (if present) or `.config/opencode/playwright-mcp.json` — the MCP server is configured with `chromiumSandbox: true` to avoid the `--no-sandbox` perf penalty.

## Builder testing

The builder has its own dev hook: `window.__builder = { game, net, scene, tiles }`. Use the same Playwright patterns — navigate to `http://localhost:5173/builder.html` instead of the root URL.
