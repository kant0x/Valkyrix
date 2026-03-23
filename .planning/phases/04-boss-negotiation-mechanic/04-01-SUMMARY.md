---
phase: 04-boss-negotiation-mechanic
plan: "01"
subsystem: game-types-unit-system
tags: [types, boss, negotiation, unit-system]
dependency_graph:
  requires: []
  provides: [BossNegotiationState, GameState.phase.negotiation, UnitSystem.boss-freeze]
  affects: [src/game/game.types.ts, src/game/UnitSystemRuntime.ts]
tech_stack:
  added: []
  patterns: [tdd, additive-type-extension, per-unit-phase-guard]
key_files:
  created: []
  modified:
    - src/game/game.types.ts
    - src/game/UnitSystemRuntime.ts
    - src/game/GameState.test.ts
    - src/game/UnitSystemRuntime.test.ts
decisions:
  - "Per-unit guard (not top-level) so collectors continue orbiting during negotiation phase"
  - "BossNegotiationState.triggered prevents re-fire within a session"
metrics:
  duration_seconds: 171
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 4
---

# Phase 4 Plan 01: Type Contracts + UnitSystem Boss-Freeze Guard Summary

**One-liner:** Additive type extensions add negotiation phase, BossNegotiationState, and UnitDef.enraged to game.types.ts; UnitSystemRuntime gains a per-unit guard that freezes boss movement during negotiation.

## What Was Built

### Task 1: Extend game.types.ts with negotiation phase and boss metadata (commit: 661878a)

- Extended `GameState.phase` union from `'playing' | 'paused' | 'won' | 'lost'` to include `'negotiation'`
- Added `enraged?: boolean` to `UnitDef` (used by BossSystem when boss enters enraged mode)
- Added `BossNegotiationState` interface: `{ active: boolean; triggered: boolean; outcome?: 'success' | 'failure' }`
- Added `bossNegotiation?: BossNegotiationState` optional field to `GameState`
- Added two new assertions to `GameState.test.ts` verifying phase initialization and negotiation acceptance

### Task 2: Add boss-freeze guard to UnitSystem.update (commit: 9eb8b87)

- Added per-unit guard in the movement loop: boss units with `def.role === 'boss'` and `faction === 'enemy'` skip movement when `state.phase === 'negotiation'`
- Guard placement is inside the per-unit loop, after the collector branch — collectors keep orbiting during negotiation
- Added three new tests to `UnitSystemRuntime.test.ts`:
  - Boss pathT stays frozen during negotiation
  - Regular enemy advances normally during negotiation
  - Boss advances normally during playing phase

## Decisions Made

- **Per-unit guard placement:** The guard is placed after the collector check inside the per-unit loop, not at the top of `update()`. This allows collector units to keep orbiting the citadel and harvesting crystals during a negotiation pause, which is the intended behavior.
- **BossNegotiationState.triggered field:** Prevents the negotiation from re-triggering within a session if the player dismisses and re-enters a scenario where the boss HP threshold is crossed again.

## Deviations from Plan

None — plan executed exactly as written.

## Pre-Existing Issues (Out of Scope)

The following were present before this plan and are not caused by these changes:

- `BuildingSystem.test.ts`: Several test fixtures missing `hp`/`maxHp` on Building objects (TS2345/TS2739)
- `GameRenderer.ts`: Several unused variable declarations (TS6133)
- `UnitSystemRuntime.test.ts`: "spawns ally units from authored ally path" pre-existing failure
- `HudOverlay.test.ts`: Multiple pre-existing failures

These are logged for deferred resolution.

## Self-Check: PASSED

Files confirmed present:
- src/game/game.types.ts — contains `negotiation` in phase union and `BossNegotiationState` interface
- src/game/UnitSystemRuntime.ts — contains negotiation guard at line 49

Commits confirmed:
- 661878a — feat(04-01): extend game.types.ts with negotiation phase and boss metadata
- 9eb8b87 — feat(04-01): add boss-freeze guard to UnitSystem per-unit loop
