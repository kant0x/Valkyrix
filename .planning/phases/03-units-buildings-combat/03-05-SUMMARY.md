---
phase: 03-units-buildings-combat
plan: 05
subsystem: ui
tags: [canvas, rendering, hud, isometric, game-state]

# Dependency graph
requires:
  - phase: 03-units-buildings-combat
    provides: GameState, Unit, Building, Projectile, PathNode types from game.types.ts
  - phase: 02-menu-network-architecture
    provides: HudOverlay DOM component with update() interface

provides:
  - GameRenderer class — canvas drawing of units, buildings, projectiles using isometric worldToScreen
  - Extended HudOverlay — citadel HP bar, wave display, electrolatov balance, win/loss full-screen overlay
  - showWinLossOverlay('won'|'lost') — full-screen result overlay with Play Again button

affects:
  - 03-06-PLAN.md (main.ts integration — calls renderer.render and hud.update each frame)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - worldToScreen as private static method in GameRenderer (avoids circular import with main.ts until Plan 06 refactors it)
    - colored rectangle placeholders for all entities (sprites deferred; keeps Phase 3 scope tight)
    - ctx.save/rotate/drawImage pattern for sprite rotation toward target

key-files:
  created:
    - src/game/GameRenderer.ts
  modified:
    - src/screens/HudOverlay.ts

key-decisions:
  - "GameRenderer uses private static worldToScreen — copy of main.ts formula avoids circular import until Plan 06 exports it"
  - "Phase 3 uses colored rect placeholders for units and buildings — sprite atlas deferred to avoid +20% complexity"
  - "showWinLossOverlay calls window.location.reload() for Play Again — ScreenManager integration is Phase 4 concern"
  - "HUD resources formatted as 'E: NNN' prefix — emoji rendering unreliable in fixed-height HUD fonts"
  - "citadelMaxHp added to HudState as optional — bar only shown when value provided, numeric fallback maintained"

patterns-established:
  - "GameRenderer.render(ctx, state, cameraCenter, zoom) — canonical call signature for Plan 06 integration"
  - "renderDebugPath(ctx, state, cameraCenter, zoom) — optional debug helper, not wired by default"
  - "showWinLossOverlay replaces existing overlay (not duplicates) — idempotent, safe to call multiple times per frame"

requirements-completed: [GAME-02, RUN-03]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 03 Plan 05: Visual Layer Summary

**Canvas renderer drawing units/buildings/projectiles as isometric colored rects, with HUD extended to show live citadel HP bar, wave number, and electrolatov balance — plus a full-screen win/loss overlay**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-17T21:49:00Z
- **Completed:** 2026-03-17T21:53:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- GameRenderer draws all three entity types (units, buildings, projectiles) on canvas using isometric world coordinates
- Arrow01.png rendered with ctx rotation toward target; yellow dot fallback while image loads
- HudOverlay extended with citadel HP progress bar, "Wave N" display, "E: NNN" resources format
- showWinLossOverlay provides VICTORY/DEFEAT overlay with Play Again button; no page reload until user clicks
- All 81 vitest tests pass (13 test files); no regressions from Phase 2 HudOverlay tests

## Task Commits

1. **Task 1: GameRenderer — draw units, buildings, projectiles on canvas** - `7ff450a` (feat)
2. **Task 2: Extend HudOverlay with citadel HP bar, electrolatov display, win/loss overlay** - `b4bceb1` (feat)

## Files Created/Modified

- `src/game/GameRenderer.ts` - Canvas drawing class for all entity types; worldToScreen formula, drawBuildings/drawUnits/drawProjectiles, renderDebugPath helper
- `src/screens/HudOverlay.ts` - Extended with citadelMaxHp field, HP progress bar, electrolatov display, showWinLossOverlay method

## Decisions Made

- worldToScreen kept as a private static method inside GameRenderer — importing from main.ts not possible until Plan 06 refactors it into a module export
- Colored rectangle placeholders chosen for all entity types (sprites deferred) — plan explicitly allowed this if sprites add >20% complexity
- "E:" prefix for electrolatov — emoji symbol unreliable in fixed-pixel HUD font rendering in jsdom/browser contexts
- showWinLossOverlay idempotent — removes any existing overlay element before creating new one to prevent duplicates

## Deviations from Plan

None - plan executed exactly as written. CombatSystem.ts was already present from a previous session (plan 03-04 committed in git as `d9ee60c`). The initial tsc error resolved once GameRenderer.ts was added alongside the already-existing CombatSystem.ts.

## Issues Encountered

None — tsc clean and all 81 vitest tests passed on first run after each task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GameRenderer.render(ctx, state, cameraCenter, zoom) ready for Plan 06 integration into the rAF render loop
- HudOverlay.update({wave, health, citadelMaxHp, resources}) ready for Plan 06 binding with real GameState values
- showWinLossOverlay ready to be triggered from the game loop when state.phase changes to 'won' or 'lost'
- Arrow01.png path 'public/assets/projectiles/Arrow01.png' — Plan 06 must preload with new Image()

---
*Phase: 03-units-buildings-combat*
*Completed: 2026-03-17*
