---
phase: 04-boss-negotiation-mechanic
plan: "02"
subsystem: boss-system
tags: [boss, negotiation, state-machine, tdd]
dependency_graph:
  requires: [BossNegotiationState, GameState.phase.negotiation, UnitDef.enraged, NegotiationOverlay]
  provides: [BossSystem, NEGOTIATION_RESOURCE_REWARD, NEGOTIATION_HP_REWARD, NEGOTIATION_WAVE_TIMER_FLOOR, HORDE_POWER_SCALE]
  affects: [src/game/BossSystem.ts, src/game/BossSystem.test.ts]
tech_stack:
  added: []
  patterns: [tdd, stateful-class, spawnQueue-pattern]
key_files:
  created:
    - src/game/BossSystem.ts
    - src/game/BossSystem.test.ts
  modified: []
decisions:
  - "Horde composition (12 light, 6 heavy, 4 ranged) pushes all entries in order with 0.4s delay step starting at 1.0s"
  - "boss.def spread-replaced on enrage so original UNIT_DEFS constant is never mutated"
  - "NegotiationOverlay already existed from prior work — no stub required"
metrics:
  duration_seconds: 119
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase 4 Plan 02: BossSystem Negotiation State Machine Summary

**One-liner:** BossSystem class implements full negotiation lifecycle — detection, phase freeze, success outcome (boss removed, player buffed), failure outcome (boss enraged, 22-unit horde queued), and safe unmount cleanup.

## What Was Built

### Task 1 (RED): Failing tests for BossSystem (commit: 99d2f6c)

- 31 tests covering all BOSS-01, BOSS-03, BOSS-04 behaviors
- Detection: trigger, no-retrigger on triggered=true, no-retrigger on enraged boss, dead boss skip, phase guard
- handleSuccess: boss removal, resource reward, HP heal cap at citadelMaxHp, waveTimer floor, phase restore, bossNegotiation state
- handleFailure: boss enraged flag, damage 1.5x rounded, horde queue composition (22 entries), powerScale, delay sequence, phase restore
- forceReset: phase recovery, safe on no-overlay, active flag cleared

### Task 2 (GREEN): BossSystem implementation (commit: 6ce180b)

- `update(dt, state, container)`: guards (phase !== 'playing', triggered), boss detection, freeze boss state, set phase='negotiation', mount overlay with success/failure callbacks
- `handleSuccess(state)`: filter boss from units, +120 resources, +400 citadel HP (capped), waveTimer floor 20s, phase='playing', bossNegotiation outcome
- `handleFailure(state, boss)`: spread-replace boss.def with enraged=true and damage*1.5 (rounded), enqueueHorde (22 entries at 1.4x power, 1.0s+0.4s delays), phase='playing'
- `forceReset(state)`: cleanup overlay, restore phase if stuck in 'negotiation', clear active flag
- Private `enqueueHorde()` and `cleanup()` helpers
- Exported constants: NEGOTIATION_RESOURCE_REWARD=120, NEGOTIATION_HP_REWARD=400, NEGOTIATION_WAVE_TIMER_FLOOR=20, HORDE_POWER_SCALE=1.4

## Decisions Made

- **Horde ordering:** Entries are pushed in HORDE_COMPOSITION key order (light → heavy → ranged) with a flat 0.4s step. This produces predictable delay values and keeps the queue easily auditable in tests.
- **boss.def spread-replace on enrage:** `boss.def = { ...boss.def, enraged: true, damage: ... }` ensures the global UNIT_DEFS entry is never mutated, preserving the original definition for future unit spawns.
- **NegotiationOverlay already existed:** The file `src/screens/NegotiationOverlay.ts` was present from prior work. No stub was needed — deviation not required.

## Deviations from Plan

None — plan executed exactly as written. NegotiationOverlay was already present so no stub creation was necessary.

## Pre-Existing Issues (Out of Scope)

The following test failures were present before this plan and are not caused by these changes:

- `UnitSystem.test.ts`: 3 citadel position coordinate tests (off-by-12)
- `UnitSystemRuntime.test.ts`: 1 "spawns ally units from authored ally path" coordinate test
- `HudOverlay.test.ts`: 2 rendering content tests

## Self-Check: PASSED

Files confirmed present:
- src/game/BossSystem.ts — contains BossSystem class with update(), handleSuccess(), handleFailure(), forceReset()
- src/game/BossSystem.test.ts — contains describe('BossSystem'), 31 tests

Commits confirmed:
- 99d2f6c — test(04-02): add failing tests for BossSystem negotiation state machine
- 6ce180b — feat(04-02): implement BossSystem negotiation state machine
