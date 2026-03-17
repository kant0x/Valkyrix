---
phase: 02-menu-network-architecture
plan: 05
subsystem: ui
tags: [typescript, dom-overlay, hud, esc-menu, game-ui]

# Dependency graph
requires:
  - phase: 02-menu-network-architecture
    provides: ScreenManager.navigateTo() and Screen type used by EscMenuOverlay exit flow

provides:
  - EscMenuOverlay: ESC key DOM overlay with music toggle and exit-with-confirmation; does not pause game loop
  - HudOverlay: Persistent fixed-bottom HUD bar with Wave, Citadel HP, Resources slots; update() API for Phase 3

affects:
  - phase-03-combat-units (fills HudOverlay.update() with real game data)
  - game-screen-module (must mount both overlays alongside the canvas)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overlay-not-ScreenModule pattern: EscMenuOverlay and HudOverlay are standalone classes mounted by the game screen, not registered with ScreenManager"
    - "ensureStyle() pattern: inject CSS once via STYLE_ID guard, shared across re-mounts"
    - "Arrow function event handler stored as class field (onKey) for stable removeEventListener identity"

key-files:
  created:
    - src/screens/EscMenuOverlay.ts
    - src/screens/HudOverlay.ts
  modified: []

key-decisions:
  - "EscMenuOverlay is not a ScreenModule — it lives beside the game canvas, not in the screen slot, so it is never unmounted by ScreenManager navigation"
  - "ESC overlay does not close on outside-click to prevent accidental dismissal during real-time gameplay"
  - "HudOverlay uses HTML entity &#x2014; (em dash) for stub values instead of literal — to avoid encoding issues"

patterns-established:
  - "Overlay pattern: fixed-position DOM div toggled by display flex/none, no canvas interaction"
  - "HudState interface: typed partial update object — callers set only the fields that changed"

requirements-completed: [UI-01]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 02 Plan 05: EscMenuOverlay and HudOverlay Summary

**ESC key overlay (no game-loop pause) with music toggle and exit confirmation, plus a persistent bottom HUD bar with typed update() API for Phase 3 game data**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-17T12:16:47Z
- **Completed:** 2026-03-17T12:19:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- EscMenuOverlay: toggles on ESC key, shows music checkbox and "Exit to Menu" button with inline confirmation dialog ("Progress will be lost. Exit?"), navigates via `manager.navigateTo('menu')` on confirm
- EscMenuOverlay: keydown listener added on mount, removed on unmount (no leak); never touches canvas or requestAnimationFrame
- HudOverlay: fixed-position 48px bar at bottom of screen with Wave, Citadel HP, Resources labels; placeholder em-dash values replaced via `update(HudState)` in Phase 3

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement EscMenuOverlay** - `8b0caa9` (feat)
2. **Task 2: Implement HudOverlay** - `d95bf07` (feat)

## Files Created/Modified

- `src/screens/EscMenuOverlay.ts` - ESC overlay DOM class with keydown toggle, music setting, exit-with-confirmation flow
- `src/screens/HudOverlay.ts` - HUD bar class with HudState interface and update() method for Phase 3 data binding

## Decisions Made

- EscMenuOverlay is intentionally not a ScreenModule so it can coexist with the canvas without being subject to ScreenManager's unmount cycle during navigation events.
- Outside-click does not close the ESC overlay because the game runs in real-time; accidental dismissal would be disruptive.
- HudOverlay exposes a partial-update pattern (HudState with all-optional fields) so Phase 3 can update individual slots without needing full state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `.test.ts` scaffold files (for plans 02-03, 02-04, wallet, session — modules not yet implemented by those plans' commits) — these are expected TDD RED stubs, not caused by this plan's changes. The `npx tsc --noEmit` passes cleanly (exit code 0) when run directly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EscMenuOverlay and HudOverlay are ready for the game screen module to mount alongside its canvas
- Phase 3 (combat/units) can call `hudOverlay.update({ wave, health, resources })` to display live data
- `isMusicEnabled()` on EscMenuOverlay is available for audio system to check before playing music

---
*Phase: 02-menu-network-architecture*
*Completed: 2026-03-17*
