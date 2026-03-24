---
phase: 04-boss-negotiation-mechanic
plan: "03"
subsystem: negotiation-overlay
tags: [overlay, gemini, tdd, jsdom, ui]
dependency_graph:
  requires: [04-01]
  provides: [NegotiationOverlay, NegotiationMountOptions]
  affects: [BossSystem, GameScreen]
tech_stack:
  added: []
  patterns: [tdd-red-green, vi-fake-timers, vi-stub-global-fetch, style-injection-guard]
key_files:
  created: []
  modified:
    - src/screens/NegotiationOverlay.ts
    - src/screens/NegotiationOverlay.test.ts
decisions:
  - "Overlay appends to container (document.body) — always consistent with BossSystem usage"
  - "flushPromises() helper (3x await Promise.resolve) needed to drain nested .json() promise chain in jsdom"
  - "vi.fn() cast to () => void to satisfy NegotiationMountOptions strict typing"
  - "Pending guard checks this.pending at start of sendMessage, not input.disabled state"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-24"
  tasks_completed: 2
  files_modified: 2
---

# Phase 04 Plan 03: NegotiationOverlay Rewrite Summary

Full rewrite of NegotiationOverlay with scale bar (0-12), attempts counter, three-outcome Gemini integration (good/neutral/bad), pending guard, and complete jsdom test coverage (8 tests GREEN).

## What Was Built

### NegotiationOverlay.ts

Complete replacement of the old binary success/failure overlay with a multi-attempt, scale-based negotiation system:

- **Scale bar** (`vk-neg-scale-fill`, `vk-neg-scale-label`) showing current/max (N / 12) with CSS gradient fill
- **Attempts counter** (`vk-neg-attempts`) displaying `Попыток: N`
- **3-outcome Gemini integration**: regex `/\{"outcome"\s*:\s*"(good|neutral|bad)"\}/` against raw API response
  - `good`: `scale = Math.min(12, scale + 4)`
  - `neutral`: `scale = Math.min(12, scale + 2)`, `attemptsLeft += 2`
  - `bad`: `attemptsLeft -= 1`
- **Terminal conditions** checked after 2800ms setTimeout: `scale >= 12` calls `onSuccess`; `attemptsLeft <= 0` calls `onFailure`
- **Pending guard**: `private pending = false` set on entry, cleared on re-enable or error
- **JSON stripping**: `raw.replace(/\{[^}]*\}/, '').trim()` before displaying boss reply
- **STYLE_ID guard** prevents duplicate style injection on remount
- **`NegotiationMountOptions`** exported (imported by BossSystem in plan 04-02)

### NegotiationOverlay.test.ts

Complete rewrite of test suite (8 tests, all GREEN):

1. Mount renders scale bar and attempts counter
2. Good outcome: scale increases by 4
3. Neutral outcome: scale increases by 2, attemptsLeft increases by 2
4. Bad outcome: attemptsLeft decreases by 1, scale unchanged
5. Success terminal: scale >= 12 calls onSuccess after 2800ms
6. Failure terminal: attemptsLeft = 0 calls onFailure after 2800ms
7. Pending guard prevents double-submit
8. Unmount removes overlay from DOM

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (RED) | 6c523a7 | test(04-03): add failing tests for scale/attempts/3-outcome |
| Task 2 (GREEN) | 46eeff1 | feat(04-03): rewrite NegotiationOverlay with scale bar, attempts, 3-outcome Gemini |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Promise flushing in async tests**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** `vi.runAllTicks()` does not drain the nested `.json()` promise chain — fetch mock resolves via two microtask levels (`Promise.resolve` wrapping `Promise.resolve`)
- **Fix:** Added `flushPromises()` helper (3x `await Promise.resolve()`) and replaced `vi.runAllTicks()` calls in all async test cases
- **Files modified:** `src/screens/NegotiationOverlay.test.ts`
- **Commit:** 46eeff1

**2. [Rule 1 - Bug] Fixed vi.fn() type assignment**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** `vi.fn()` return type `Mock<Procedure | Constructable>` is not assignable to `() => void` in strict TypeScript
- **Fix:** Declared `onSuccess`/`onFailure` as `() => void`, cast `vi.fn() as () => void` on assignment
- **Files modified:** `src/screens/NegotiationOverlay.test.ts`
- **Commit:** 46eeff1

## Self-Check: PASSED

- [x] `src/screens/NegotiationOverlay.ts` exists and exported `NegotiationOverlay` class + `NegotiationMountOptions` type
- [x] `src/screens/NegotiationOverlay.test.ts` exists with 8 tests
- [x] All 8 tests pass: `npx vitest run src/screens/NegotiationOverlay.test.ts` — 8 passed
- [x] No NegotiationOverlay TypeScript errors: `npx tsc --noEmit` produces no errors for these files
- [x] Commits 6c523a7 and 46eeff1 exist in git log
