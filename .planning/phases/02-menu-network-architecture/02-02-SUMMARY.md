---
phase: 02-menu-network-architecture
plan: 02
subsystem: ui
tags: [typescript, vitest, screen-router, wallet, solana, phantom, backpack]

# Dependency graph
requires:
  - phase: 02-menu-network-architecture
    provides: "Plan 01 vitest config and test scaffolds (ScreenManager.test.ts)"

provides:
  - "WalletType, SolanaProvider, WalletState type contracts in src/wallet/wallet.types.ts"
  - "Screen type, ScreenModule interface, ScreenManager class in src/screens/ScreenManager.ts"
  - "State machine screen router with navigateTo() — no page reload"

affects: [02-03-wallet-splash-screen, 02-04-main-menu-screen, 02-05-session-layer, 02-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TypeScript-only type files with no runtime code for shared contracts"
    - "State machine screen routing: current screen tracked as nullable Screen value"
    - "ScreenModule interface: mount(container)/unmount() contract for all screens"

key-files:
  created:
    - src/wallet/wallet.types.ts
    - src/wallet/wallet.types.test.ts
    - src/screens/ScreenManager.ts
  modified:
    - src/screens/ScreenManager.test.ts

key-decisions:
  - "Screen router uses plain class with Record<Screen, ScreenModule> — no framework, no third-party router"
  - "navigateTo() always unmounts current before mounting next — prevents DOM accumulation"
  - "SolanaProvider interface models Phantom/Backpack browser extension API shape exactly"

patterns-established:
  - "ScreenModule pattern: every screen must implement mount(container: HTMLElement) and unmount()"
  - "WalletState as plain data type: no classes, no reactivity, just {connected, publicKey, walletType}"

requirements-completed: [UI-02]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 02 Plan 02: Type Contracts and ScreenManager Summary

**WalletType/SolanaProvider/WalletState type contracts and a state-machine ScreenManager class enabling no-reload screen transitions across 'wallet', 'menu', and 'game' screens**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T12:10:33Z
- **Completed:** 2026-03-17T12:13:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Delivered typed wallet provider contracts matching Phantom and Backpack browser extension APIs
- Implemented ScreenManager state machine with navigateTo() that unmounts previous screen before mounting new one
- All 8 tests pass (5 wallet type contract tests, 3 ScreenManager behavior tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create wallet type contracts** - `82581a1` (feat)
2. **Task 2: Implement ScreenManager state machine** - `a3383d5` (feat)

_Note: TDD tasks had test files written first (RED), then implementation (GREEN), committed together per task._

## Files Created/Modified
- `src/wallet/wallet.types.ts` - WalletType union, SolanaProvider interface, WalletState type
- `src/wallet/wallet.types.test.ts` - TDD tests for all wallet type contracts (5 tests)
- `src/screens/ScreenManager.ts` - Screen type, ScreenModule interface, ScreenManager class
- `src/screens/ScreenManager.test.ts` - Fixed jsdom limitation for window.location.reload spy

## Decisions Made
- Screen router uses a plain TypeScript class with `Record<Screen, ScreenModule>` passed in constructor — no framework, no third-party router, matching the project's vanilla TS + Vite pattern
- SolanaProvider interface includes optional `isPhantom?` and `isBackpack?` flags to distinguish provider types at runtime, matching the Phantom docs source

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed jsdom incompatibility in ScreenManager.test.ts**
- **Found during:** Task 2 (Implement ScreenManager state machine)
- **Issue:** Plan 01's test scaffold used `vi.spyOn(window.location, 'reload')` which throws "Cannot redefine property: reload" in jsdom because the property is non-configurable
- **Fix:** Replaced spyOn with `Object.defineProperty(window, 'location', { value: {..., reload: vi.fn()}, writable: true, configurable: true })` — tests the same behavior without jsdom restriction
- **Files modified:** src/screens/ScreenManager.test.ts
- **Verification:** All 3 ScreenManager tests pass including the "does not reload" test
- **Committed in:** a3383d5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in inherited test scaffold)
**Impact on plan:** Fix was necessary for test to run at all. No scope creep. ScreenManager behavior is unchanged.

## Issues Encountered
- jsdom does not allow spying on `window.location.reload` via `vi.spyOn` because the property is non-configurable. Standard vitest/jsdom workaround applied via `Object.defineProperty`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 2 plans (03, 04, 05) can now import `ScreenModule` from `src/screens/ScreenManager.ts` and `WalletState`/`SolanaProvider` from `src/wallet/wallet.types.ts` directly
- The "scavenger hunt" anti-pattern is eliminated — type contracts are explicit and exported
- WalletSplashScreen (Plan 03), MainMenuScreen (Plan 04), and SessionLayer (Plan 05) can implement their ScreenModule interfaces against these contracts

## Self-Check: PASSED

- `src/wallet/wallet.types.ts` - FOUND
- `src/screens/ScreenManager.ts` - FOUND
- `.planning/phases/02-menu-network-architecture/02-02-SUMMARY.md` - FOUND
- Commit `82581a1` (Task 1) - FOUND
- Commit `a3383d5` (Task 2) - FOUND
- Commit `5b82f7f` (metadata) - FOUND

---
*Phase: 02-menu-network-architecture*
*Completed: 2026-03-17*
