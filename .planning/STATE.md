---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 03-06-PLAN.md (awaiting human verification checkpoint)
last_updated: "2026-03-17T19:00:42.552Z"
last_activity: 2026-03-17 - Phase 2 Plan 1 complete (vitest harness + test scaffolds)
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 12
  completed_plans: 12
  percent: 33
---

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

Progress: [███░░░░░░░] 33%

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
| Phase 02-menu-network-architecture P02 | 3 | 2 tasks | 4 files |
| Phase 02-menu-network-architecture P04 | 5 | 2 tasks | 2 files |
| Phase 02-menu-network-architecture P03 | 8 | 2 tasks | 3 files |
| Phase 02-menu-network-architecture P05 | 2min | 2 tasks | 2 files |
| Phase 02-menu-network-architecture P06 | 25min | 2 tasks | 1 files |
| Phase 03-units-buildings-combat P01 | 4min | 2 tasks | 3 files |
| Phase 03-units-buildings-combat P02 | 3min | 2 tasks | 5 files |
| Phase 03-units-buildings-combat P03 | 3min | 2 tasks | 7 files |
| Phase 03-units-buildings-combat P04 | 3min | 1 tasks | 2 files |
| Phase 03-units-buildings-combat P05 | 4min | 2 tasks | 2 files |
| Phase 03-units-buildings-combat P06 | 3min | 1 tasks | 1 files |

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
- [Phase 02-menu-network-architecture]: Screen router uses plain TS class with Record<Screen, ScreenModule> — no framework, matching project's vanilla TS + Vite pattern
- [Phase 02-menu-network-architecture]: SolanaProvider interface models Phantom/Backpack browser extension API exactly — optional isPhantom/isBackpack flags for runtime provider detection
- [Phase 02-menu-network-architecture]: Dynamic import of @solana/web3.js inside connect() defers ~400KB bundle until Play pressed
- [Phase 02-menu-network-architecture]: Leaderboard button navigates to game as Phase 5 placeholder (real leaderboard reads blockchain data)
- [Phase 02-menu-network-architecture]: window.phantom?.solana?.isPhantom detection (not window.solana) for Phantom provider to avoid conflicts
- [Phase 02-menu-network-architecture]: Install links shown (not disabled buttons) when extension absent — matches Phantom/Backpack UX convention
- [Phase 02-menu-network-architecture]: connectWallet() JSDoc annotates user-gesture requirement — browsers block wallet popups from programmatic calls
- [Phase 02-menu-network-architecture]: EscMenuOverlay is not a ScreenModule — mounted alongside canvas by game screen, not managed by ScreenManager
- [Phase 02-menu-network-architecture]: HudOverlay exposes typed partial-update HudState interface for Phase 3 combat data binding
- [Phase 02-menu-network-architecture]: Two-step circular-reference pattern for ScreenManager init: construct screens with proxy nav object, then wire real manager
- [Phase 02-menu-network-architecture]: animating guard at module scope in GameScreen prevents duplicate requestAnimationFrame loops on remount
- [Phase 03-units-buildings-combat]: Greedy nearest-neighbor path sort seeded from portal world coords avoids U-turn artifacts on authored linear paths
- [Phase 03-units-buildings-combat]: PathNode stores world coords (not tile col/row) so unit lerp math works directly in world space
- [Phase 03-units-buildings-combat]: UnitFaction stored as string union 'enemy'|'ally' for readability and future extensibility
- [Phase 03-units-buildings-combat]: Ally path cached as reversed copy in UnitSystem — avoids re-reversing every tick, same lerp code path for both factions
- [Phase 03-units-buildings-combat]: spawnQueue delay decremented in UnitSystem.update — single system owns unit lifecycle from queue to active
- [Phase 03-units-buildings-combat]: Attack tower cooldown only decrements when >0 — prevents negative drift when idle and no target in range
- [Phase 03-units-buildings-combat]: speedBuff optional Unit field set by buff tower each frame; UnitSystem reads as multiplier (unit.speedBuff ?? 1.0)
- [Phase 03-units-buildings-combat]: registerKill() as standalone export from ResourceSystem — CombatSystem imports without ResourceSystem instance
- [Phase 03-units-buildings-combat]: dt-remainder cooldown reset (+=) rather than hard reset (=) to consume overrun time and prevent timing drift
- [Phase 03-units-buildings-combat]: Two-pass tickFighting: opponent-alive check separated from damage tick — avoids iterating dead units in damage pass
- [Phase 03-units-buildings-combat]: CombatSystem defKey constructed as role+'-enemy' at kill time — matches ResourceSystem KILL_DROPS keys without lookup table in CombatSystem
- [Phase 03-units-buildings-combat]: GameRenderer uses private static worldToScreen — avoids circular import with main.ts until Plan 06 exports it
- [Phase 03-units-buildings-combat]: Phase 3 uses colored rect placeholders for units/buildings — sprites deferred to avoid scope creep
- [Phase 03-units-buildings-combat]: showWinLossOverlay calls window.location.reload() for Play Again — ScreenManager integration is Phase 4
- [Phase 03-units-buildings-combat]: gameScreenHudRef module-level var gives update() access to HUD without passing instance through call chain
- [Phase 03-units-buildings-combat]: Systems initialized in loadMap() callback so gameState has valid pathNodes from parsed map JSON

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-17T19:00:42.549Z
Stopped at: Completed 03-06-PLAN.md (awaiting human verification checkpoint)
Resume file: None
