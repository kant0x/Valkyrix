# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** An edited map must load in the game and behave exactly as designed: same isometric structure, same layer meaning, same movement logic, and the same camera behavior after every save.
**Current focus:** Phase 2 - Menu & Network Architecture

## Current Position

Phase: 2 of 4 (Menu & Network Architecture)
Plan: 1 of TBD in current phase
Status: In progress
Last activity: 2026-03-17 - Phase 2 Plan 1 complete (vitest harness + test scaffolds)

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Trusted Map Pipeline | 1 | — | — |
| 2. Menu & Network Architecture | 1 | ~7min | ~7min |

**Recent Trend:**
- Last 5 plans: Phase 1 Plan 1 (complete), Phase 2 Plan 1 (complete)
- Trend: Stable

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1 keeps exported JSON plus `active-map.json` as the single runtime contract.
- Phase 2 treats isometric geometry, `ground`, and `decor` semantics as one fidelity boundary.
- Phase 3 isolates camera parity before broader gameplay systems depend on map-authored camera data.
- Phase 4 makes gameplay systems consume paths, anchors, zones, and entity meaning from exported map data.
- (02-01) Use @solana/web3.js@1.x not 2.x — MagicBlock SDK requires 1.x as peer dependency.
- (02-01) vitest jsdom environment for all screen module tests; dynamic imports in scaffolds preserve clear TDD RED failure messages.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-17
Stopped at: Completed 02-menu-network-architecture/02-01-PLAN.md (vitest harness + test scaffolds)
Resume file: .planning/phases/02-menu-network-architecture/02-02-PLAN.md (next plan)
