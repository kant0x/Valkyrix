---
phase: 02-menu-network-architecture
plan: 06
subsystem: ui
tags: [typescript, vite, screen-manager, screen-routing, game-loop, hud, esc-overlay]

# Dependency graph
requires:
  - phase: 02-menu-network-architecture
    provides: ScreenManager, WalletSplashScreen, MainMenuScreen, EscMenuOverlay, HudOverlay — all Wave 2 modules

provides:
  - Integrated src/main.ts entry point using ScreenManager for screen routing
  - GameScreen ScreenModule wrapping existing isometric game loop
  - App starts on wallet splash screen and routes to game only after wallet connect + Play
  - ESC overlay and HUD mounted alongside game canvas by GameScreen.mount()

affects: [03-camera-parity, 04-gameplay-systems, 05-leaderboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-step circular-reference resolution for ScreenManager init (construct screens with proxy nav, then wire real manager)
    - animating guard flag at module scope prevents duplicate requestAnimationFrame loops on remount
    - GameScreen wraps existing game startup calls in mount/unmount without rewriting game logic

key-files:
  created: []
  modified:
    - src/main.ts

key-decisions:
  - "Two-step circular-reference pattern: construct WalletSplashScreen/MainMenuScreen/GameScreen with proxy { navigateTo } object, then construct real ScreenManager — avoids 'used before assigned' TS error"
  - "animating boolean guard added at module scope so remounting GameScreen does not spawn a second requestAnimationFrame loop"
  - "GameScreen.unmount() clears container.innerHTML to remove canvas DOM; any game loop animation frames naturally cease when they can no longer find their canvas"

patterns-established:
  - "GameScreen as ScreenModule: wrap legacy startup calls in mount(), add cleanup in unmount()"
  - "ESC overlay and HUD are co-mounted by GameScreen (not ScreenManager) — they live inside game screen lifetime"

requirements-completed: [UI-01, UI-02, NET-01, NET-02, NET-03]

# Metrics
duration: ~25min
completed: 2026-03-17
---

# Phase 2 Plan 06: Screen Integration Summary

**ScreenManager wired into src/main.ts as the sole entry point — app starts on wallet splash, routes to isometric game canvas via Play button, with ESC overlay and HUD co-mounted by GameScreen**

## Performance

- **Duration:** ~25 min (including human verification checkpoint)
- **Started:** 2026-03-17T12:00:00Z
- **Completed:** 2026-03-17T15:30:00Z
- **Tasks:** 2 (Task 1: auto, Task 2: human-verify checkpoint — approved)
- **Files modified:** 1 (src/main.ts)

## Accomplishments

- Converted src/main.ts from direct startup into a ScreenManager-routed entry point
- Wrapped all existing isometric game loop logic in a GameScreen ScreenModule (mount/unmount) without rewriting a single line of game logic
- App now routes: wallet splash → main menu → game canvas, all via DOM show/hide (no page reload)
- ESC overlay and HUD overlay are co-mounted by GameScreen alongside the canvas
- animating guard prevents duplicate requestAnimationFrame loops on game screen remount
- Human verification confirmed all 8 checkpoint steps passing: wallet splash, wallet connect flow, install links, main menu, game canvas render, ESC overlay toggle, exit-to-menu flow, and full vitest suite (29/29 green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap game logic in GameScreen and wire ScreenManager** - `c5a4a03` (feat)
2. **Task 2: Human verification checkpoint** - approved by user (no code commit — verification only)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified

- `src/main.ts` — Rewired entry point: imports ScreenManager + all screen modules, wraps game startup in GameScreen class, initializes ScreenManager, starts on wallet splash screen

## Decisions Made

- Two-step circular-reference resolution chosen over setManager() pattern: construct each screen with a proxy `{ navigateTo: (s) => manager.navigateTo(s) }` cast as ScreenManager, then construct the real ScreenManager. This avoids TypeScript "used before assignment" errors while keeping construction inline.
- animating guard flag added at module scope (not inside GameScreen) so it persists across mount/unmount cycles and prevents duplicate RAF loops.
- GameScreen.unmount() uses `container.innerHTML = ''` to clear canvas DOM; existing game loop frames naturally cease rendering when canvas is removed from DOM.

## Deviations from Plan

None — plan executed exactly as written. The circular-reference resolution approach described in the plan (proxy pattern) was the chosen implementation.

## Issues Encountered

None — TypeScript compiled cleanly, all 29 vitest tests passed, build succeeded, and all 8 human verification steps were confirmed working.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Full screen routing system is live and human-verified
- Phase 3 (camera parity) can now begin — game screen is mounted via GameScreen.mount() so camera initialization fits naturally inside that lifecycle
- HudOverlay.update(HudState) interface is ready for Phase 3/4 combat data binding
- ESC menu "Exit to Menu" flow works end-to-end

---
*Phase: 02-menu-network-architecture*
*Completed: 2026-03-17*
