---
phase: 02-menu-network-architecture
plan: 01
subsystem: testing
tags: [vitest, jsdom, solana, magicblock, tdd, typescript]

# Dependency graph
requires:
  - phase: 01-trusted-map-pipeline
    provides: project structure with Vite + TypeScript baseline
provides:
  - vitest test harness configured with jsdom environment
  - failing test scaffolds for ScreenManager, WalletSplashScreen, MainMenuScreen, SessionLayer
  - @solana/web3.js and @magicblock-labs/ephemeral-rollups-sdk installed
affects: [02-02, 02-03, 02-04, 02-05]

# Tech tracking
tech-stack:
  added: [vitest@4.1.0, jsdom, "@vitest/ui", "@solana/web3.js@1.98.4", "@magicblock-labs/ephemeral-rollups-sdk@0.8.8"]
  patterns: [TDD RED state — test files exist before implementations, jsdom environment for DOM-heavy screen tests]

key-files:
  created:
    - vitest.config.ts
    - src/screens/ScreenManager.test.ts
    - src/screens/WalletSplashScreen.test.ts
    - src/screens/MainMenuScreen.test.ts
    - src/session/SessionLayer.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Use @solana/web3.js@1.x (not 2.x kit) — MagicBlock SDK requires 1.x as peer dependency"
  - "vitest environment set to jsdom to support DOM manipulation tests for screen modules"
  - "Test scaffolds import implementations dynamically (await import) so missing modules produce clear failure messages in RED state"

patterns-established:
  - "TDD RED state: all Wave 2 plans run `npx vitest run src/screens/` as verification command against these scaffolds"
  - "Screen tests use document.createElement div containers — no global DOM pollution between tests"
  - "Dynamic imports in tests allow clean TDD cycle: tests exist before implementation files"

requirements-completed: [UI-01, UI-02, NET-02, NET-03]

# Metrics
duration: 7min
completed: 2026-03-17
---

# Phase 2 Plan 01: Test Harness & Dependency Setup Summary

**vitest@4.1.0 configured with jsdom, @solana/web3.js + MagicBlock SDK installed, and 4 failing TDD scaffold files defining contracts for all Wave 2 screen and session modules**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-17T12:09:42Z
- **Completed:** 2026-03-17T12:16:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed @solana/web3.js@1.98.4 and @magicblock-labs/ephemeral-rollups-sdk@0.8.8 as runtime dependencies
- Installed vitest@4.1.0, jsdom, @vitest/ui as devDependencies
- Created vitest.config.ts with jsdom environment and src/**/*.test.ts include glob
- Created 4 failing test scaffold files that define the module contracts Wave 2 plans must satisfy

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and configure vitest** - `e41461e` (chore)
2. **Task 2: Create failing test scaffolds for all modules** - `9627b95` (test)

## Files Created/Modified
- `vitest.config.ts` - vitest configuration with jsdom environment and src/**/*.test.ts include glob
- `package.json` - added @solana/web3.js, @magicblock-labs/ephemeral-rollups-sdk, vitest, jsdom, @vitest/ui
- `package-lock.json` - lockfile for 178 packages
- `src/screens/ScreenManager.test.ts` - 3 tests defining screen transition contract (UI-02)
- `src/screens/WalletSplashScreen.test.ts` - 4 tests defining wallet splash contract (UI-01)
- `src/screens/MainMenuScreen.test.ts` - 4 tests defining main menu contract (UI-01)
- `src/session/SessionLayer.test.ts` - 3 tests defining SessionLayer interface contract (NET-03)

## Decisions Made
- Used @solana/web3.js@1.98.4 (not 2.x @solana/kit) because MagicBlock SDK requires 1.x as peer dependency
- jsdom environment chosen over node environment because screen tests manipulate real DOM via document.createElement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — both npm installs succeeded cleanly, vitest found all 4 test files and reported expected failures (missing module imports for unimplemented classes).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 2 plans (02-02 through 02-05) can now use `npx vitest run src/screens/` and `npx vitest run src/session/` as their verification commands
- All test contracts are defined: ScreenManager, WalletSplashScreen, MainMenuScreen, SessionLayer
- Implementations must export the exact class names and method signatures the tests import

---
*Phase: 02-menu-network-architecture*
*Completed: 2026-03-17*
