---
phase: 04-boss-negotiation-mechanic
plan: "01"
subsystem: game
tags: [typescript, game-types, boss, negotiation]

# Dependency graph
requires: []
provides:
  - BossNegotiationState with scale? and attemptsLeft? fields
  - GameState.elapsed?: number for timer accumulation
  - createGameState() initializes elapsed: 0
  - boss-enemy hp set to 500
affects:
  - 04-02-BossSystem (reads state.elapsed and bossNegotiation.scale/attemptsLeft)
  - 04-03-NegotiationOverlay (reads bossNegotiation.scale/attemptsLeft)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optional fields added to interfaces for backward compatibility with existing tests

key-files:
  created: []
  modified:
    - src/game/game.types.ts
    - src/game/GameState.ts

key-decisions:
  - "elapsed added as optional (elapsed?: number) to GameState interface so existing test fixtures remain valid without modification"
  - "scale and attemptsLeft added as optional to BossNegotiationState for same backward-compat reason"
  - "boss-enemy hp raised from 260 to 500 per CONTEXT.md spec for meaningful negotiation window"

patterns-established:
  - "Additive-only interface changes: new fields are optional so downstream tests do not break"

requirements-completed: [BOSS-01, BOSS-02, BOSS-03, BOSS-04]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Phase 04 Plan 01: Type Contracts for Boss Negotiation Redesign Summary

**Extended BossNegotiationState with scale/attemptsLeft, GameState with elapsed timer, and boss-enemy hp raised to 500 — all backward-compatible optional additions.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T15:08:00Z
- **Completed:** 2026-03-24T15:10:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- BossNegotiationState gains `scale?: number` (0-12) and `attemptsLeft?: number` (starts at 3)
- GameState interface gains `elapsed?: number` for accumulation by BossSystem during playing phase
- createGameState() explicitly initializes `elapsed: 0` so runtime always has a defined numeric value
- boss-enemy hp updated from 260 to 500 per CONTEXT.md spec to support meaningful negotiation window

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend BossNegotiationState, add elapsed to GameState, update boss hp** - `ba8d54a` (feat)

**Plan metadata:** (see final docs commit)

## Files Created/Modified
- `src/game/game.types.ts` - Added scale?, attemptsLeft? to BossNegotiationState; elapsed? to GameState; boss-enemy hp 260->500
- `src/game/GameState.ts` - Added elapsed: 0 to createGameState() return object

## Decisions Made
- Used optional fields (?) for all new additions to preserve backward compatibility with existing test fixtures that construct minimal GameState/BossNegotiationState objects without the new fields
- boss-enemy hp raised to 500 as specified in CONTEXT.md to give BossSystem enough time window for negotiation trigger at ~120s elapsed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
Pre-existing TypeScript errors in BuildingSystem.test.ts, ProjectileSystem.test.ts, ResourceSystem.test.ts, and GameRenderer.ts were present before this plan's changes. They are out of scope and logged as deferred items.

## Next Phase Readiness
- All type contracts are in place for 04-02 BossSystem rewrite
- BossSystem can now read `state.elapsed` and write `bossNegotiation.scale`/`attemptsLeft`
- NegotiationOverlay can read `bossNegotiation.scale`/`attemptsLeft` for display

---
*Phase: 04-boss-negotiation-mechanic*
*Completed: 2026-03-24*
