---
phase: 03-units-buildings-combat
plan: 03
subsystem: game
tags: [typescript, canvas2d, tower-defense, buildings, projectiles, resources, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-units-buildings-combat
    plan: 01
    provides: Building, Projectile, GameState interfaces; Unit interface (extended with speedBuff)

provides:
  - BuildingSystem class — placeBuilding(), sellBuilding(), update(dt, state) for attack + buff towers
  - ProjectileSystem class — update(dt, state) moves projectiles and applies hit damage
  - ResourceSystem class — update(dt, state) passive building income per frame
  - registerKill() standalone export — electrolatov kill drops (+5/+15/+10 by unit type)
  - canvasClickToTile() exported from BuildingSystem — canvas click → tile hit test for Plan 06 wiring

affects:
  - 03-04 (CombatSystem imports registerKill from ResourceSystem)
  - 03-06 (click handler uses canvasClickToTile from BuildingSystem)
  - all Phase 3 plans — GameState.buildings and projectiles now fully operable

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Attack tower cooldown: only decrements when positive (not when idle/no target) to avoid negative drift"
    - "Buff tower: sets unit.speedBuff each frame for units in radius; UnitSystem multiplies speed by speedBuff"
    - "Projectile hit check both before and after movement step to handle very close targets"
    - "registerKill() as standalone exported function (not class method) for clean import by CombatSystem"

key-files:
  created:
    - src/game/BuildingSystem.ts
    - src/game/BuildingSystem.test.ts
    - src/game/ProjectileSystem.ts
    - src/game/ProjectileSystem.test.ts
    - src/game/ResourceSystem.ts
    - src/game/ResourceSystem.test.ts
  modified:
    - src/game/game.types.ts

key-decisions:
  - "Attack tower cooldown only decrements when > 0 (returns early), so idle towers don't accumulate negative cooldown"
  - "speedBuff optional field added to Unit interface — buff tower sets it each frame, UnitSystem reads it as multiplier"
  - "canvasClickToTile exported from BuildingSystem.ts (not a separate util) — matches plan spec for Plan 06 wiring"
  - "registerKill standalone export (not class method) — CombatSystem imports it cleanly without instantiating ResourceSystem"
  - "PROJECTILE_SPEED=400 world units/s — fast enough to feel responsive, slow enough to be visible on canvas"

patterns-established:
  - "Pattern: building cost/refund constants at module scope — single source of truth for balance values"
  - "Pattern: projectile hit check both pre- and post-move step — prevents tunneling through very close targets"

requirements-completed: [BLDG-01]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 3 Plan 03: Building System, Projectile System, and Resource System Summary

**Tower-defense building layer: attack towers fire projectiles at nearest enemy via cooldown, buff towers apply +25% speed to allies in radius, projectiles fly to target and deal damage on arrival, buildings generate passive electrolatov income**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T18:43:12Z
- **Completed:** 2026-03-17T18:46:30Z
- **Tasks:** 2 (each with TDD RED + GREEN commits)
- **Files modified:** 7 created, 1 modified

## Accomplishments

- BuildingSystem implements zone/occupation/resource validation for tower placement, 60% sell refund, attack tower range + projectile spawn, buff tower aura applied each frame
- ProjectileSystem moves projectiles toward live target's current position at configurable speed, removes on target death or hit (dist < 8 world units), applies damage on contact
- ResourceSystem accumulates passive building income per frame; registerKill() awards +5/+15/+10 electrolatov for light/heavy/ranged kills
- 22 tests across 3 files — all passing; TypeScript strict clean throughout

## Task Commits

Each task was committed atomically with TDD RED/GREEN pattern:

1. **Task 1 RED: Failing BuildingSystem tests** - `25b0f69` (test)
2. **Task 1 GREEN: BuildingSystem implementation** - `627b11a` (feat)
3. **Task 2 RED: Failing ProjectileSystem + ResourceSystem tests** - `14ce0b7` (test)
4. **Task 2 GREEN: ProjectileSystem + ResourceSystem implementation** - `5154c20` (feat)

## Files Created/Modified

- `src/game/BuildingSystem.ts` — placeBuilding(), sellBuilding(), update(), canvasClickToTile() helper export
- `src/game/BuildingSystem.test.ts` — 13 tests: zone/occupation/resource validation, attack tower, buff tower, sell
- `src/game/ProjectileSystem.ts` — update() moves projectiles, hit detection, damage, orphan removal
- `src/game/ProjectileSystem.test.ts` — 4 tests: movement, hit+damage, target-gone removal, no-hit
- `src/game/ResourceSystem.ts` — update() passive income, registerKill() standalone export
- `src/game/ResourceSystem.test.ts` — 5 tests: passive income (two dt cases) + 3 kill drop amounts
- `src/game/game.types.ts` — Added `speedBuff?: number` to Unit interface

## Decisions Made

- **Attack tower idle cooldown:** Changed from "decrement always, return if still positive" to "return immediately if positive, only act when <= 0" — prevents cooldown going negative when no target is in range, which would cause an immediate shot after target enters range regardless of intended rate
- **speedBuff as optional Unit field:** Buff tower sets it to 1.25 each frame for units in radius; UnitSystem multiplies base speed by `(unit.speedBuff ?? 1.0)` — clean separation, no circular dependency
- **registerKill as standalone export:** CombatSystem needs to call it on unit death without holding a ResourceSystem instance; standalone function matches the project's functional style for pure operations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Attack tower cooldown sign error**
- **Found during:** Task 1 (GREEN phase — first test run)
- **Issue:** Initial implementation decremented cooldown before checking sign, causing idle towers to accumulate negative cooldown (-0.016 per frame). Test asserted cooldown stays 0 when no target in range.
- **Fix:** Restructured `_updateAttackTower` to early-return if `attackCooldown > 0` (decrementing first), so idle towers stay at exactly 0 instead of going negative.
- **Files modified:** `src/game/BuildingSystem.ts`
- **Verification:** All 13 BuildingSystem tests pass including "does NOT fire if no enemy within radius"
- **Committed in:** `627b11a` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential correctness fix — negative cooldown would cause incorrect firing behavior in the game loop. No scope creep.

## Issues Encountered

None beyond the cooldown bug documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BuildingSystem, ProjectileSystem, ResourceSystem all export clean TypeScript interfaces
- canvasClickToTile() ready for Plan 06 click handler integration in main.ts
- registerKill() ready for CombatSystem (Plan 04) to call on unit death
- GameState.buildings and GameState.projectiles fully operational — Plans 04 and 05 can extend immediately
- No blockers

---
*Phase: 03-units-buildings-combat*
*Completed: 2026-03-17*
