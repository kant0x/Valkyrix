---
phase: 03-units-buildings-combat
plan: 04
subsystem: game
tags: [typescript, canvas2d, tower-defense, combat, tdd, vitest]

# Dependency graph
requires:
  - phase: 03-units-buildings-combat
    plan: 02
    provides: UnitSystem, WaveController, Unit interface, GameState
  - phase: 03-units-buildings-combat
    plan: 03
    provides: registerKill() from ResourceSystem

provides:
  - CombatSystem class — update(dt, state) with unit-vs-unit collision, damage tick,
    base attacks, win/loss phase transitions

affects:
  - 03-05 (game loop integrates CombatSystem.update as last system in call order)
  - 03-06 (win/loss phase gates HUD updates and ESC menu state)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dt-remainder cooldown reset: attackCooldown += 1/attackRate (not = 1/attackRate) to consume overrun time"
    - "Two-pass tickFighting: pass 1 checks opponent alive (resume moving), pass 2 decrements + attacks"
    - "CombatSystem last in game loop call order — sees projectile damage in same frame before win/loss check"
    - "No splice in CombatSystem — sets hp=0 only; UnitSystem.filter(hp>0) removes dead next frame"

key-files:
  created:
    - src/game/CombatSystem.ts
    - src/game/CombatSystem.test.ts
  modified: []

key-decisions:
  - "dt-remainder pattern for cooldown reset (+=) rather than hard reset (=) — prevents units from gaining free cooldown when dt slightly overruns"
  - "Two-pass structure in tickFighting: opponent-alive check separated from damage tick — avoids iterating dead units in damage pass"
  - "defKey constructed as role+'-enemy' string at kill time — matches ResourceSystem KILL_DROPS keys exactly"

# Metrics
duration: ~3min
completed: 2026-03-17
---

# Phase 3 Plan 04: Combat System Summary

**CombatSystem with full unit-vs-unit collision, damage ticks using dt-remainder cooldown, enemy base attacks draining citadelHp, and win/loss phase transitions — closes the core gameplay loop**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T18:49:40Z
- **Completed:** 2026-03-17T18:52:32Z
- **Tasks:** 1 (with TDD RED + GREEN commits)
- **Files modified:** 2 created

## Accomplishments

- CombatSystem implements O(n²) collision detection: enemy/ally pairs within 32 world units both enter 'fighting' state with `fightingWith` set to opponent id
- Damage tick uses dt-remainder pattern: `attackCooldown += 1/attackRate` after attack so overrun time is consumed and future attacks maintain correct timing
- Two-pass tickFighting: first pass resumes moving for units whose opponent is gone, second pass decrements cooldowns and deals damage
- Enemy 'attacking-base' units drain `state.citadelHp` via same cooldown pattern; ally 'attacking-base' units are idle (Phase 5 concern)
- `checkWinLoss`: sets `phase='lost'` when `citadelHp<=0`; sets `phase='won'` when `waveNumber>=5`, `spawnQueue.length===0`, and no living enemies remain
- `registerKill(role+'-enemy', state)` called immediately when enemy hp drops to 0 — awards +5/+15/+10 electrolatov for light/heavy/ranged
- 13 tests all passing; `tsc --noEmit` clean

## Task Commits

1. **Task 1 RED: Failing CombatSystem tests** — `7809f92` (test)
2. **Task 1 GREEN: CombatSystem implementation** — `d9ee60c` (feat)

## Files Created/Modified

- `src/game/CombatSystem.ts` — CombatSystem class: resolveCollisions(), tickFighting() two-pass, tickBaseAttacks(), checkWinLoss()
- `src/game/CombatSystem.test.ts` — 13 vitest tests: collision detection, no-fight beyond range, damage tick, cooldown reset, kill resource award, survivor resume, citadel drain, loss trigger, win trigger, phase guard, ally base no-damage, heavy kill, ranged kill

## Decisions Made

- **dt-remainder cooldown reset:** `attackCooldown += 1/attackRate` (not `= 1/attackRate`) so the negative overrun from the current frame is carried into the new period. This ensures a unit that attacks exactly on time doesn't get a "bonus tick" before their next attack.
- **Two-pass tickFighting:** Separating opponent-alive check from the damage pass prevents iterating units that were just marked dead in the same pass, avoiding double-damage or incorrect kill counts.
- **defKey construction:** `${opponent.def.role}-enemy` at kill time matches the `KILL_DROPS` keys in ResourceSystem without any lookup table in CombatSystem.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectation mismatch on cooldown reset**
- **Found during:** Task 1 (GREEN phase — first test run)
- **Issue:** Initial implementation used `attackCooldown = 1/attackRate` (hard reset). Test expected `1/attackRate - dt` (dt-remainder pattern). The hard reset gave 1.0 instead of 0.984 for the test case.
- **Fix:** Changed to `attackCooldown += 1/attackRate` so the negative overrun from decrementing is preserved. This is also the correct game design: overrun time counts toward the next period.
- **Files modified:** `src/game/CombatSystem.ts`
- **Verification:** All 13 tests pass including "resets attackCooldown to 1/attackRate after dealing damage"
- **Committed in:** `d9ee60c` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Correctness fix for cooldown timing — the dt-remainder pattern is standard practice for game timers to prevent timing drift.

## Issues Encountered

None beyond the cooldown reset pattern documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CombatSystem exports `CombatSystem` class with `update(dt, state)` — ready for game loop integration (Plan 05)
- `state.phase` transitions are owned exclusively by `checkWinLoss()` — HUD and menu systems can read `state.phase` safely
- `registerKill()` integration verified: correct electrolatov drops for all three enemy types
- No blockers

## Self-Check

- `src/game/CombatSystem.ts` — FOUND
- `src/game/CombatSystem.test.ts` — FOUND
- Commits: 7809f92 (RED), d9ee60c (GREEN) — verified in git log

## Self-Check: PASSED

---
*Phase: 03-units-buildings-combat*
*Completed: 2026-03-17*
