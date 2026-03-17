---
phase: 03-units-buildings-combat
plan: 01
subsystem: game
tags: [typescript, canvas2d, pathfinding, unit-types, game-state, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-menu-network-architecture
    provides: HudOverlay.update() interface and HudState type consumed by GameState wiring in later plans

provides:
  - UnitDef, Unit, Building, Projectile, GameState, PathNode, UnitRole, UnitFaction interfaces (game.types.ts)
  - UNIT_DEFS constant with 4 unit types and balance values
  - extractOrderedPath() function converting flat paths layer to ordered world-coord PathNode[]
  - Vitest tests proving path extraction correctness (5 tests, all green)

affects:
  - 03-02 (UnitSystem imports Unit, UnitDef, GameState, PathNode)
  - 03-03 (BuildingSystem imports Building, GameState)
  - 03-04 (CombatSystem imports Unit, Projectile, GameState)
  - all Phase 3 plans import from game.types.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Greedy nearest-neighbor sort for authored isometric path from portal seed"
    - "Pure type + data constant module (game.types.ts) — no logic, no side effects"
    - "TDD RED/GREEN cycle for pure logic modules (PathExtractor)"

key-files:
  created:
    - src/game/game.types.ts
    - src/game/PathExtractor.ts
    - src/game/PathExtractor.test.ts
  modified: []

key-decisions:
  - "Greedy nearest-neighbor sort seeded from portal world coords — not from arbitrary tile — prevents U-turn artifacts on authored linear paths"
  - "PathNode stores world coords (not tile col/row) so unit lerp math works directly in world space"
  - "Faction stored as UnitFaction string union ('enemy'|'ally') not boolean for readability and future extensibility"
  - "ISO_LAYER_X=1152 hardcoded in PathExtractor as a renderer constant (not map data) — matches main.ts"
  - "UNIT_DEFS uses Record<string, UnitDef> with string keys for safe dynamic lookup at wave spawn time"

patterns-established:
  - "Pattern: all game systems import types from src/game/game.types.ts — single source of truth"
  - "Pattern: extractOrderedPath called once at map load, result stored in GameState.pathNodes"
  - "Pattern: spawn/citadel positions from scene.portals[0] and scene.citadel — never from tile layers"

requirements-completed: [UNIT-01, RUN-02]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 3 Plan 01: Type Contracts & Path Extraction Summary

**Shared type contracts (UnitDef/Unit/Building/GameState/PathNode) + greedy path extractor that converts 410-tile isometric path layer to ordered world-coord PathNode[] from portal to citadel**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-17T18:38:20Z
- **Completed:** 2026-03-17T18:42:00Z
- **Tasks:** 2 (+ TDD RED commit)
- **Files modified:** 3 created

## Accomplishments

- Defined all shared type contracts that every Phase 3 system depends on (game.types.ts) — pure types plus UNIT_DEFS data constant
- Implemented PathExtractor using greedy nearest-neighbor sort seeded from portal world coords — ensures correct portal-to-citadel ordering on the 410-tile authored path
- 5 vitest tests covering edge cases (empty layer, single tile, length invariant, nearest-portal-first, L-shape ordering) — all pass
- TypeScript strict-mode clean throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: Define game.types.ts** - `a035b6d` (feat)
2. **Task 2 RED: Failing PathExtractor tests** - `9dc584b` (test)
3. **Task 2 GREEN: Implement PathExtractor** - `2986af9` (feat)

## Files Created/Modified

- `src/game/game.types.ts` - All shared interfaces (PathNode, UnitRole, UnitFaction, UnitDef, Unit, Building, Projectile, GameState) + UNIT_DEFS constant with 4 unit types
- `src/game/PathExtractor.ts` - extractOrderedPath() using greedy nearest-neighbor sort, ISO_LAYER_X=1152
- `src/game/PathExtractor.test.ts` - 5 vitest tests proving extraction correctness

## Decisions Made

- Greedy nearest-neighbor seeded from portal world coords (not from tile nearest to portal in tile-space) — avoids U-turn artifacts on authored paths
- PathNode stores world coords (wx, wy) directly — unit movement lerp math works in world space, no repeat conversion
- Faction as `'enemy' | 'ally'` string union — readable, extensible for future factions (Phase 4 boss, Phase 5 multiplayer)
- ISO_LAYER_X=1152 hardcoded as renderer constant matching main.ts — not treated as map data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All shared types are exported and tsc-clean — Plan 02 (UnitSystem) can import immediately
- PathNode[] ordered from portal to citadel — ready for unit lerp movement in Plan 02
- UNIT_DEFS['light-enemy'], ['light-ally'], ['heavy-enemy'], ['ranged-enemy'] all available for WaveController
- No blockers

---
*Phase: 03-units-buildings-combat*
*Completed: 2026-03-17*
