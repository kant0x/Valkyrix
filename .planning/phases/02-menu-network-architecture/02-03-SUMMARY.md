---
phase: 02-menu-network-architecture
plan: 03
subsystem: ui
tags: [solana, phantom, backpack, wallet, typescript, jsdom, vitest]

# Dependency graph
requires:
  - phase: 02-menu-network-architecture plan 01
    provides: vitest + jsdom test harness, WalletSplashScreen scaffold test
  - phase: 02-menu-network-architecture plan 02
    provides: wallet.types.ts (WalletType, SolanaProvider, WalletState), ScreenManager with navigateTo()
provides:
  - WalletService with Phantom + Backpack provider detection and connect/disconnect logic
  - WalletSplashScreen full-screen wallet gate UI implementing ScreenModule interface
  - 14 unit tests covering getProvider, connectWallet, disconnectWallet, accountChanged, mount/unmount
affects:
  - 02-menu-network-architecture plan 04 (MainMenuScreen uses ScreenManager navigateTo, same patterns)
  - 02-menu-network-architecture plan 05 (game screen receives public key from connected wallet state)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - window.phantom?.solana?.isPhantom detection (not window.solana)
    - window.backpack direct injection detection
    - accountChanged event listener to track wallet account switches
    - ensureStyle() CSS injection via <style> tag (reuse of existing pattern from src/main.ts)
    - connect() only in click handlers, never on mount

key-files:
  created:
    - src/wallet/WalletService.ts
    - src/wallet/WalletService.test.ts
    - src/screens/WalletSplashScreen.ts
  modified: []

key-decisions:
  - "window.phantom?.solana?.isPhantom checked (not window.solana) to avoid conflicts with other wallets"
  - "connect() only called inside click handlers — JSDoc annotates user-gesture requirement"
  - "Install links shown (not disabled buttons) when extension not detected, matching Phantom/Backpack UX convention"
  - "accountChanged handler sets connected=false for null key (user disconnects wallet externally)"

patterns-established:
  - "ScreenModule pattern: mount(container) / unmount() implemented as class with private el reference"
  - "WalletService uses module-level state (_state, _provider) — single instance per page load"
  - "Error display: inline <p> hidden by default, shown on catch with textContent set to err.message"

requirements-completed: [UI-01]

# Metrics
duration: 8min
completed: 2026-03-17
---

# Phase 2 Plan 3: WalletService and WalletSplashScreen Summary

**Phantom and Backpack wallet detection + full-screen connection gate with install links, error handling, and automatic menu transition on connect**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-17T15:17:00Z
- **Completed:** 2026-03-17T15:19:10Z
- **Tasks:** 2
- **Files modified:** 3 created

## Accomplishments
- WalletService with provider detection (window.phantom?.solana?.isPhantom and window.backpack), connect/disconnect/accountChanged handling
- WalletSplashScreen full-screen gate: Connect/Install buttons per wallet, inline error recovery, navigateTo('menu') on success
- 14 unit tests all passing (10 WalletService + 4 WalletSplashScreen)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement WalletService** - `b898fd7` (feat)
2. **Task 2: Implement WalletSplashScreen** - `6dedef1` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks had two phases: failing test first, then implementation to GREEN_

## Files Created/Modified
- `src/wallet/WalletService.ts` - Phantom/Backpack provider detection, connectWallet (user-gesture only), disconnectWallet, getCurrentState, accountChanged listener
- `src/wallet/WalletService.test.ts` - 10 unit tests: getProvider with/without extensions, connectWallet success/failure, state tracking, accountChanged event
- `src/screens/WalletSplashScreen.ts` - Full-screen wallet gate implementing ScreenModule; shows Connect or Install buttons based on extension presence; handles errors inline

## Decisions Made
- Install links (not disabled buttons) when extension absent — matches Phantom/Backpack UX convention and plan requirement
- JSDoc documents user-gesture requirement on connectWallet() — runtime enforcement not needed (browsers handle it)
- accountChanged listener registered once on connect; null newKey resets state to disconnected

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript reported errors in pre-existing scaffold test files (MainMenuScreen.test.ts, WalletSplashScreen.test.ts) referencing modules not yet created. These are expected pre-existing scaffold errors from plan 02-01; WalletSplashScreen.ts created in this plan resolves the WalletSplashScreen scaffold error.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WalletService and WalletSplashScreen complete; ScreenManager can integrate both
- MainMenuScreen (plan 04) can use the same ScreenModule pattern
- getCurrentState() available for game screen to read connected wallet public key

## Self-Check: PASSED

- FOUND: src/wallet/WalletService.ts
- FOUND: src/screens/WalletSplashScreen.ts
- FOUND: src/wallet/WalletService.test.ts
- FOUND: .planning/phases/02-menu-network-architecture/02-03-SUMMARY.md
- FOUND commit b898fd7: feat(02-03): implement WalletService
- FOUND commit 6dedef1: feat(02-03): implement WalletSplashScreen
- FOUND commit d3db9a1: docs(02-03): complete plan metadata

---
*Phase: 02-menu-network-architecture*
*Completed: 2026-03-17*
