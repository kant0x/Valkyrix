---
phase: 03-units-buildings-combat
plan: 02
subsystem: game
tags: [typescript, unit-system, wave-controller, path-traversal, lerp, tdd, vitest]

# Dependency graph
requires:
  - phase: 03-units-buildings-combat
    plan: 01
    provides: PathNode[], Unit, UnitDef, GameState, UNIT_DEFS from game.types.ts + extractOrderedPath from PathExtractor.ts

provides:
  - createGameState() factory reading map JSON, calling extractOrderedPath, returning initialized GameState
  - UnitSystem class with update(dt, state) — lerp path traversal, faction-aware direction, dead-unit filter, spawn queue processing
  - WaveController class with update(dt, state) — dt-accumulator timer, escalation table, staggered spawn queue entries
  - 12 vitest tests (7 UnitSystem + 5 WaveController) all green

affects:
  - 03-03 (BuildingSystem needs state.units to find targets in range)
  - 03-04 (CombatSystem sets unit.state to 'fighting', which UnitSystem skips)
  - 03-05 (GameLoop integrates UnitSystem + WaveController update calls)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lerp path traversal: advance = speed * dt, tAdvance = advance / segmentLength, handle segment crossing with leftover dt"
    - "Ally units use [...pathNodes].reverse() cached in UnitSystem — same lerp logic, opposite direction"
    - "WaveController uses dt accumulator (no setTimeout/setInterval) — state.waveTimer decremented each tick"
    - "Spawn queue with staggered delays: spawnQueue[i].delay -= dt in UnitSystem.update, spawn when <= 0"

key-files:
  created:
    - src/game/GameState.ts
    - src/game/UnitSystem.ts
    - src/game/UnitSystem.test.ts
    - src/game/WaveController.ts
    - src/game/WaveController.test.ts
  modified: []

key-decisions:
  - "Ally path cached as reversed copy in UnitSystem constructor — avoids re-reversing every tick while keeping the same lerp code path"
  - "spawnQueue delay decremented in UnitSystem.update (not WaveController) — single system owns unit lifecycle from queue to active"
  - "nextInterval() keyed on waveNumber after increment — clean lookup table with fallback to 10s for wave 5+"
  - "WAVE_TABLE uses Object.entries iteration order — light-enemy always enqueued before heavy/ranged, giving natural spawn ordering"

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 3 Plan 02: Unit Spawning, Path Traversal & Wave Scheduling Summary

**Lerp-based path traversal for enemy/ally units plus dt-accumulator WaveController with 5-wave escalation table — the game's primary enemy AI loop**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T18:43:11Z
- **Completed:** 2026-03-17T18:46:18Z
- **Tasks:** 2 (each with TDD RED + GREEN commits)
- **Files modified:** 5 created

## Accomplishments

- Implemented `createGameState()` factory: reads portal position from map JSON, delegates to `extractOrderedPath`, returns fully initialized `GameState` with all fields set (citadelHp=500, playerBaseHp=300, resources=100)
- `UnitSystem.update(dt, state)` advances moving units via lerp between `PathNode` world coords — handles segment boundary crossing with leftover dt, skips fighting/attacking-base units, filters dead units at end of tick
- Enemy units traverse `pathNodes[0..last]`, ally units traverse reversed path (cached) — same lerp code path for both factions
- `WaveController.update(dt, state)` accumulates dt against `state.waveTimer`, triggers wave on expiry: enqueues unit spawns with 0.5s stagger, escalates unit mix per 5-wave table
- 12 tests total, all green: 7 UnitSystem (lerp math, pathIndex wrap, attacking-base transition, faction direction, dead filter) + 5 WaveController (timer decrement, wave-1 queue, timer reset, wave-3 mixed, phase guard)

## Task Commits

Each task committed atomically:

1. **Task 1 RED: Failing UnitSystem tests** — `870364f` (test)
2. **Task 1 GREEN: GameState factory + UnitSystem** — `d602baf` (feat)
3. **Task 2 RED: Failing WaveController tests** — `d0760e3` (test)
4. **Task 2 GREEN: WaveController implementation** — `9d62238` (feat)

## Files Created/Modified

- `src/game/GameState.ts` — `createGameState(mapJson)` factory; reads portal coords from scene.portals[0], calls extractOrderedPath
- `src/game/UnitSystem.ts` — `UnitSystem` class; lerp traversal with segment-crossing logic, reversed ally path, spawnQueue processing, dead-unit filter
- `src/game/UnitSystem.test.ts` — 7 vitest tests covering path advancement, segment wrap, attacking-base transition, faction direction, dead filter, lerp coords
- `src/game/WaveController.ts` — `WaveController` class; dt-accumulator timer, WAVE_TABLE const, staggered spawn queue, nextInterval() lookup
- `src/game/WaveController.test.ts` — 5 vitest tests covering timer decrement, wave-1 spawn queue structure, timer reset, wave-3 unit mix, phase guard

## Decisions Made

- Ally reversed path cached in `UnitSystem` as `this.reversedPath` — avoids re-reversing on every frame; lazily invalidated when pathNodes length changes
- `spawnQueue` delay decremented inside `UnitSystem.update` — UnitSystem owns full unit lifecycle from queue to active (single responsibility; WaveController only enqueues)
- `nextInterval(waveNumber)` uses a simple `Record<number, number>` lookup table with default fallback — no branching conditionals
- `Object.entries(config.count)` preserves insertion order for light-enemy before heavy/ranged — gives natural enemy variety ramp-up during a wave

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing `tsc --noEmit` error for `BuildingSystem.test.ts` (RED commit from Plan 03 scaffolding already in repo) — out of scope, logged as deferred

## Self-Check: PASSED

- `src/game/GameState.ts` — FOUND
- `src/game/UnitSystem.ts` — FOUND
- `src/game/UnitSystem.test.ts` — FOUND
- `src/game/WaveController.ts` — FOUND
- `src/game/WaveController.test.ts` — FOUND
- Commits: 870364f, d602baf, d0760e3, 9d62238 — all verified in git log

## Next Phase Readiness

- `UnitSystem` and `WaveController` are ready for integration into the game loop (Plan 05)
- `BuildingSystem` (Plan 03) can read `state.units` to find targets in attack radius
- `CombatSystem` (Plan 04) can set `unit.state = 'fighting'` — `UnitSystem` already skips those units
- No blockers

---
*Phase: 03-units-buildings-combat*
*Completed: 2026-03-17*
