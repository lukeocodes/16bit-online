---
phase: 3
slug: server-side-chunk-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (client), vitest (server) |
| **Config file** | packages/client/vitest.config.ts, packages/server/vitest.config.ts |
| **Quick run command** | `bunx vitest run --reporter=verbose` |
| **Full suite command** | `bunx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run --reporter=verbose`
- **After every plan wave:** Run `bunx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | TECH-06 | unit | `bunx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | TECH-03 | unit | `bunx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | TECH-05 | integration | `bunx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | TECH-03 | e2e | Playwright | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Server terrain noise test stubs for deterministic output verification
- [ ] Redis cache integration test stubs for chunk storage/retrieval
- [ ] Client chunk request/response protocol test stubs
- [ ] Playwright test for world data delivery during signaling

*Existing vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Terrain visual quality (rolling hills, mountain ridges) | CONTEXT decision | Subjective visual | Load game, walk across biomes, screenshot terrain variation |
| Chunk streaming performance under movement | TECH-03 | Timing-dependent | Walk rapidly across chunk boundaries, check for pop-in or stalls |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
