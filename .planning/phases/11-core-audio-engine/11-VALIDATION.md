---
phase: 11
slug: core-audio-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already in project) |
| **Config file** | packages/client/vitest.config.ts (if exists, else create) |
| **Quick run command** | `cd packages/client && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/client && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/client && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/client && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | AUDIO-01 | unit | `vitest run src/audio/__tests__/AudioEngine.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | AUDIO-01 | unit | `vitest run src/audio/__tests__/GainBus.test.ts` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | AUDIO-02 | unit | `vitest run src/audio/__tests__/MusicStateMachine.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | AUDIO-02 | unit | `vitest run src/audio/__tests__/CrossfadeManager.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | AUDIO-01 | unit | `vitest run src/audio/__tests__/MasterIntensity.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/client/src/audio/__tests__/AudioEngine.test.ts` — stubs for AudioContext lifecycle, bus creation
- [ ] `packages/client/src/audio/__tests__/GainBus.test.ts` — stubs for gain bus routing, volume control
- [ ] `packages/client/src/audio/__tests__/MusicStateMachine.test.ts` — stubs for state transitions, priority
- [ ] `packages/client/src/audio/__tests__/CrossfadeManager.test.ts` — stubs for beat-quantized crossfade
- [ ] `packages/client/src/audio/__tests__/MasterIntensity.test.ts` — stubs for intensity variable effects
- [ ] `standardized-audio-context-mock` — mock AudioContext for vitest (no real browser audio in tests)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AudioContext resumes on first click/keypress | AUDIO-01 | Browser autoplay policy requires real user gesture | Open game in browser, verify audio starts after first click |
| Tab focus ducking to 10% | AUDIO-01 | Requires real browser visibility API | Switch tabs, verify audio ducks; return, verify instant restore |
| Beat-quantized crossfade audibility | AUDIO-02 | Perceptual quality check | Trigger state change, verify crossfade sounds smooth on beat boundary |
| Test tone plays during state transitions | AUDIO-02 | Audio output verification | Trigger each state, verify test tone changes |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
