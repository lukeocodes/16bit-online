# Testing — index

Integration testing uses Playwright MCP + the dev-only `window.__game` / `window.__builder` APIs. Unit tests use Vitest in `packages/server`.

## Supplemental docs

- [`docs/testing-playwright.md`](docs/testing-playwright.md) — setup, login flow, combat test loop (proven stable 50+ rounds), multi-player testing, cron loop, what to verify each round, known constraints.

## At-a-glance

- Login: `lukeocodes` / blank password.
- `api.move("w")` NOT `keyboard.press("w")` — the input buffer misses keydown+keyup pairs.
- Use regular Chrome, not ungoogled Chromium (WebRTC blocked there).
- Builder has its own entry at `/builder.html` with `window.__builder`.
