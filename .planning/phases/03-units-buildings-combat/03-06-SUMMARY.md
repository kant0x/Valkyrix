---
phase: 03-units-buildings-combat
plan: "06"
subsystem: game-integration
tags: [integration, game-loop, systems, main.ts, Phase3]
dependency_graph:
  requires: [03-04-PLAN.md, 03-05-PLAN.md]
  provides: [playable-game-loop, system-integration]
  affects: [src/main.ts]
tech_stack:
  added: []
  patterns:
    - Module-scope system refs cleared on unmount for GC safety
    - Named canvas click handler stored for removeEventListener on unmount
    - gameScreenHudRef pattern for HUD access from update() loop
    - winLossShown guard prevents duplicate overlay calls
key_files:
  created: []
  modified:
    - src/main.ts
decisions:
  - "gameScreenHudRef module-level var gives update() access to HUD without passing instance through call chain"
  - "Systems initialized in loadMap() callback (after map JSON loads) rather than mount() so gameState has valid pathNodes"
  - "update() restructured from early-return-on-no-movement to conditional-block so game systems tick every frame"
metrics:
  duration: "~3min"
  completed: "2026-03-17"
  tasks_completed: 1
  files_modified: 1
---

# Phase 3 Plan 06: System Integration into main.ts Summary

Wire all Phase 3 systems into GameScreen and the rAF loop — single-file integration that makes the game fully playable.

## What Was Built

All Phase 3 game systems (WaveController, UnitSystem, BuildingSystem, ProjectileSystem, CombatSystem, GameRenderer) wired into `src/main.ts` with correct call order, HUD live data binding, win/loss detection, and tower placement UI.

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Wire all Phase 3 systems into GameScreen and rAF loop | Complete | 27cfadb |
| 2 | Human verification checkpoint | Awaiting | — |

## Key Integration Points

**Import additions** (top of main.ts):
- `createGameState`, `WaveController`, `UnitSystem`, `BuildingSystem`, `canvasClickToTile`, `ProjectileSystem`, `CombatSystem`, `GameRenderer`, `GameState`

**Module-scope system refs** (cleared on unmount):
- `gameState`, `waveController`, `unitSystem`, `buildingSystem`, `projectileSystem`, `combatSystem`, `gameRenderer`, `gameScreenHudRef`, `winLossShown`, `selectedTowerType`, `towerClickHandler`

**loadMap() hook**: After `runtime.map = parsed`, creates `gameState = createGameState(parsed)` and instantiates all five systems + `GameRenderer(arrowImg)`.

**update(dt) additions**:
```
if (gameState.phase === 'playing'):
  waveController.update → unitSystem.update → buildingSystem.update
  → projectileSystem.update → combatSystem.update
gameScreenHudRef.update({ wave, health, citadelMaxHp, resources })
win/loss overlay check (once per phase transition)
```

**render() addition**: `gameRenderer.render(ctx, gameState, cameraCenter, zoom)` called after all tile map draws.

**Tower buttons**: Two `<button>` elements appended to container with toggle selection state. Canvas click handler routes to `buildingSystem.placeBuilding()` with zone layer validation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] update() had early-return on no-movement blocking system updates**
- **Found during:** Task 1
- **Issue:** Original `update()` had `if (moveX === 0 && moveY === 0) return;` which would prevent game systems from ticking when player was not pressing movement keys
- **Fix:** Wrapped camera movement in `if (moveX !== 0 || moveY !== 0)` block; systems run unconditionally after
- **Files modified:** src/main.ts
- **Commit:** 27cfadb

None beyond the above.

## Verification

- `npx tsc --noEmit`: clean (exit 0)
- `npx vitest run`: 81/81 tests pass (13 test files)
- `npx vite build --mode development`: succeeded, 98 modules, 51.67 kB bundle
- Human verification: **Awaiting** (checkpoint:human-verify)

## Self-Check: PASSED

- src/main.ts exists and was modified: confirmed
- Commit 27cfadb exists: confirmed
- All system imports present in main.ts: confirmed via tsc
