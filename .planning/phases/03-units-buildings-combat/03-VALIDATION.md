---
phase: 03
slug: units-buildings-combat
status: partial
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-21
---

# Phase 03 - Validation Strategy

> Retroactive validation map for Phase 3 after subsystem fixes and Phase 3 HUD salvage wiring.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + `tsc --noEmit` |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/game/BuildingSystem.test.ts src/game/CombatSystem.test.ts src/game/UnitSystemRuntime.test.ts src/screens/HudOverlay.test.ts` |
| **Full suite command** | `npx vitest run src/game/BuildingSystem.test.ts src/game/CombatSystem.test.ts src/game/GameState.test.ts src/game/ProjectileSystem.test.ts src/game/RecruitmentSystem.test.ts src/game/ResourceSystem.test.ts src/game/UnitSystem.test.ts src/game/UnitSystemRuntime.test.ts src/game/WaveController.test.ts src/screens/HudOverlay.test.ts` + `npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command plus `npx tsc --noEmit`
- **After every plan wave:** Run the full suite command
- **Before `$gsd-verify-work`:** Full suite must be green and browser smoke test must be completed
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | UNIT-01, RUN-02 | static + unit | `npx vitest run src/game/PathExtractor.test.ts src/game/GameState.test.ts` + `npx tsc --noEmit` | ✅ | ✅ green |
| 03-02-01 | 02 | 2 | UNIT-02, BLDG-02 | unit | `npx vitest run src/game/UnitSystem.test.ts src/game/UnitSystemRuntime.test.ts src/game/WaveController.test.ts` | ✅ | ✅ green |
| 03-03-01 | 03 | 2 | BLDG-01 | unit | `npx vitest run src/game/BuildingSystem.test.ts src/game/ProjectileSystem.test.ts src/game/ResourceSystem.test.ts` | ✅ | ✅ green |
| 03-04-01 | 04 | 3 | GAME-01 | unit | `npx vitest run src/game/CombatSystem.test.ts` | ✅ | ✅ green |
| 03-05-01 | 05 | 3 | GAME-02, RUN-03 | component + render support | `npx vitest run src/screens/HudOverlay.test.ts` + `npx tsc --noEmit` | ✅ | ✅ green |
| 03-06-01 | 06 | 4 | GAME-01, GAME-02, UNIT-01, UNIT-02, BLDG-01, BLDG-02 | integration | `manual browser smoke` | ✅ | ⚠️ partial |

*Status: pending / green / red / flaky / partial*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full `main.ts` game loop wiring stays coherent in a real match | GAME-01, GAME-02, UNIT-02, BLDG-01, BLDG-02 | Current tests validate systems in isolation, but do not exercise the actual browser session entry, pointer input, and rAF loop together | Start a battle, wait for waves, place both tower types, recruit Viking and Collector, salvage one tower, confirm HUD values update and combat continues |
| Canvas click geometry for real tower placement and salvage | BLDG-01 | jsdom tests do not reproduce real canvas pointer coordinates or actual rendered map interaction | In browser: arm Attack Tower, place on highlighted tile, arm Salvage, click the same tower, confirm resource refund and removal |
| Win/loss overlay through live battle flow | GAME-01, GAME-02 | Overlay rendering is tested indirectly, but phase acceptance still depends on the real gameplay transition | In browser: force or play to defeat and victory, verify overlay appears once and battle HUD is consistent |

---

## Validation Sign-Off

- [x] All subsystem tasks have automated verification
- [x] Sampling continuity exists across the phase
- [x] Wave 0 coverage is not needed
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending manual gameplay sign-off
