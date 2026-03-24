---
phase: 04-boss-negotiation-mechanic
plan: "02"
subsystem: game
tags: [boss, negotiation, timer, spawn, horde, BossSystem, vitest, tdd]

requires:
  - phase: 04-01
    provides: "BossNegotiationState type with scale/attemptsLeft, elapsed? on GameState, boss-enemy hp=500 in UNIT_DEFS"

provides:
  - "BossSystem with elapsed-timer trigger (>= 300s) instead of unit-detection"
  - "Boss unit spawned as spread copy of UNIT_DEFS['boss-enemy'] at pathNodes[0]"
  - "handleSuccess: boss removed, resources +120, citadel healed +400 capped, phase playing"
  - "handleFailure: boss enraged (1.5x damage, spread-replace), horde heavy x8 + ranged x6 (NO light)"
  - "forceReset: clears bossNegotiation {active:false, triggered:false}, resets elapsed to 0"
  - "NegotiationCallbacks extended with optional initialScale/initialAttempts"
  - "39 BossSystem tests — GREEN"

affects:
  - 04-03-NegotiationOverlay
  - 04-04-wiring
  - game-loop integration

tech-stack:
  added: []
  patterns:
    - "Elapsed accumulation on GameState.elapsed by BossSystem each tick"
    - "State written synchronously before overlay.mount() to prevent double-trigger race"
    - "spread-replace on boss def for enrage: boss.def = {...boss.def, enraged:true, ...}"
    - "HORDE_COMPOSITION object drives flat-delay spawn queue: 1.0s + 0.4s * index"

key-files:
  created: []
  modified:
    - src/game/BossSystem.ts
    - src/game/BossSystem.test.ts
    - src/screens/NegotiationOverlay.ts

key-decisions:
  - "Timer trigger (elapsed >= 300s) replaces old unit-detection trigger — aligns with CONTEXT.md design"
  - "HORDE_COMPOSITION: heavy-enemy x8 + ranged-enemy x6 only — no light-enemy (was 12 light + 6 heavy + 4 ranged)"
  - "handleFailure takes no boss parameter — finds boss by role+faction in state.units (boss was spawned by update)"
  - "negotiationActive private field removed — triggered flag on BossNegotiationState is the authoritative gate"
  - "NegotiationCallbacks extended with optional initialScale/initialAttempts for overlay state persistence"

requirements-completed: [BOSS-01, BOSS-03, BOSS-04]

duration: 15min
completed: 2026-03-24
---

# Phase 04 Plan 02: BossSystem Timer-Trigger Rewrite Summary

**BossSystem fully rewritten with elapsed-timer trigger at 300s, boss spawn from UNIT_DEFS spread, and failure horde of heavy x8 + ranged x6 (no light); 39 tests GREEN.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-24T15:12:00Z
- **Completed:** 2026-03-24T15:15:40Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Rewrote BossSystem.ts replacing unit-detection trigger with elapsed-timer (accumulates state.elapsed, fires at >= 300s)
- New test suite (39 tests) covering timer trigger, boss spawn integrity, success/failure paths, and forceReset
- HORDE_COMPOSITION corrected to heavy-enemy x8 + ranged-enemy x6 — no light-enemy entries
- handleFailure refactored to find boss internally (no parameter) using role+faction filter on state.units
- NegotiationOverlay.NegotiationCallbacks extended with optional initialScale/initialAttempts

## Task Commits

1. **Task 1: Rewrite BossSystem.test.ts (RED)** - `398c4d7` (test)
2. **Task 2: Rewrite BossSystem.ts (GREEN)** - `6cf71b3` (feat)

## Files Created/Modified

- `src/game/BossSystem.ts` - Full rewrite: timer trigger, boss spawn, success/failure handlers, forceReset
- `src/game/BossSystem.test.ts` - Full rewrite: 39 tests covering all behaviors (TDD)
- `src/screens/NegotiationOverlay.ts` - NegotiationCallbacks extended with optional initialScale/initialAttempts

## Decisions Made

- **Timer trigger replaces unit-detection:** Old BossSystem detected a living unenraged boss unit on field; new design accumulates state.elapsed and fires at BOSS_TRIGGER_SECONDS (300). Aligns with CONTEXT.md design spec.
- **HORDE_COMPOSITION changed:** Old composition was `{ 'light-enemy': 12, 'heavy-enemy': 6, 'ranged-enemy': 4 }`. New is `{ 'heavy-enemy': 8, 'ranged-enemy': 6 }` — no light-enemy per plan must_haves.
- **handleFailure signature changed:** Old took `boss: Unit` as second param. New finds boss via `state.units.find(u => u.def.role === 'boss' && u.faction === 'enemy')` — natural since BossSystem is responsible for spawning it.
- **negotiationActive removed:** The field was set but never read for gate logic; `BossNegotiationState.triggered` is the authoritative guard. Removing the dead field eliminates TS6133 warning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended NegotiationOverlay.NegotiationCallbacks with initialScale/initialAttempts**
- **Found during:** Task 2 (BossSystem implementation)
- **Issue:** BossSystem.ts calls `overlay.mount(container, { onSuccess, onFailure, initialScale, initialAttempts })` but NegotiationCallbacks type didn't include those optional fields — TypeScript would reject the call
- **Fix:** Added `initialScale?: number; initialAttempts?: number;` to NegotiationCallbacks in NegotiationOverlay.ts; prefixed unused `container` param with `_` to suppress TS6133
- **Files modified:** src/screens/NegotiationOverlay.ts
- **Verification:** `npx tsc --noEmit` shows no errors in modified files
- **Committed in:** 6cf71b3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking TypeScript type gap)
**Impact on plan:** Required for BossSystem to compile cleanly when passing initialScale/initialAttempts to overlay.

## Issues Encountered

- `vi.mock` hoisting caused `vi.fn().mockImplementation(() => ({...}))` to fail as constructor — resolved by using a class-based mock (`class MockNegotiationOverlay { mount = vi.fn(); unmount = vi.fn(); }`) inside the factory.
- `require()` in ESM test context failed — replaced with `await import('./game.types')` in an async test.

## Next Phase Readiness

- BossSystem is complete and wire-ready: `bossSystem.update(dt, state, container)` and `bossSystem.forceReset(state)` are the integration points
- NegotiationOverlay mount signature accepts initialScale/initialAttempts for future scale/attempts persistence
- Phase 04-04 wiring into the rAF loop should be straightforward

---
*Phase: 04-boss-negotiation-mechanic*
*Completed: 2026-03-24*
