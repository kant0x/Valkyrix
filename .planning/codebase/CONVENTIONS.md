# Coding Conventions

**Analysis Date:** 2026-03-17

## Naming Patterns

**Files:**
- Entry logic lives in `src/main.ts` (lower-case root) while shared helpers under `src/shared` follow PascalCase (`src/shared/CameraMath.ts`), so new utilities should mirror the PascalCase helper naming inside `src/shared` and keep top-level entries descriptive.

**Functions:**
- camelCase verb phrases are used for helpers (`bindInput`, `loadMap`, `configureCanvas`, `clampCameraCenter`, `drawTiles`, etc.) in `src/main.ts`.

**Variables:**
- camelCase for stateful locals and DOM refs (`runtime`, `mapLabelEl`, `modeChipEl`, `statusEl`, `canvas`, `rawCtx`) and UPPER_SNAKE for immutable layout constants such as `GAME_W`, `MOVE_SPEED`, and `STYLE_ID` in `src/main.ts`.

**Types:**
- PascalCase type aliases (`MapCamera`, `RuntimeMap`, `RuntimeState`, `ScenePoint`, `CameraPoint`, `MapScene`, `WorldItem`) are declared at the top of `src/main.ts` and describe the domain model.

## Code Style

**Formatting:**
- Four-space indentation, single quotes, mandatory semicolons, and blank lines between `function` declarations (see `src/main.ts` for examples). Multi-line object literals align keys with spaces after the colon, and template literals for CSS maintain consistent spacing inside `ensureRuntimeStyle`.
- The root `tsconfig.json` defines `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `moduleResolution: bundler`, `target: ES2020`, and `outDir: ./dist`, so rely on the TypeScript compiler to keep unused identifiers and mismatched types from creeping in.

**Linting:**
- No `.eslintrc*`, `.prettierrc*`, `eslint.config.*`, or `biome.json` files exist, so the compiler is the only stylistic gate (`tsconfig.json`).

## Import Organization

**Order:**
1. External packages (none currently imported).
2. Internal shared helpers (only `./shared/CameraMath` is imported in `src/main.ts`).
3. Side-effect imports (not present today).

**Path Aliases:**
- Not used; the only import in `src/main.ts` is a relative path to `./shared/CameraMath`.

## Error Handling

**Patterns:**
- `loadMap` wraps the fetch/parse workflow in a `try/catch`, stores failures in `runtime.error`, and updates `runtime.status` so the UI can react without crashing (`src/main.ts`).
- DOM initialization guards (`if (!root) throw new Error('Missing #game-container')` and `if (!rawCtx) throw new Error('2D canvas context is unavailable')`) enforce the app’s preconditions before proceeding.

## Logging

**Framework:** No logging library; runtime status is surfaced by writing to elements such as `statusEl`, `mapStatsEl`, and `cameraStatsEl` in `src/main.ts`.

**Patterns:**
- Instead of `console`, update the HUD text nodes (see `syncHud` for the pattern) and rely on the overlay statuses to show runtime information.

## Comments

**When to Comment:**
- Comments are absent in `src/main.ts` and `src/shared/CameraMath.ts`; rely on descriptive names instead of inline commentary.

**JSDoc/TSDoc:**
- Not used; the codebase depends on TypeScript types declared next to the consuming code.

## Function Design

**Size:** Each helper targets a single responsibility (e.g., `bindInput` wires events, `drawTiles` renders tile layers, `clampCameraCenter` keeps the camera valid), while small utilities such as `getRequiredElement` and `clampNumber` stay under a dozen lines (`src/main.ts`).

**Parameters:** All functions declare precise parameter types; optional values use `?` or default arguments (e.g., `centerOffsetY = 0` in `scrollToCenter` and `centerToScroll` inside `src/shared/CameraMath.ts`).

**Return Values:** Helpers return strongly typed objects (`CameraPoint`, `CameraViewSize`, `CameraScrollBounds`, etc.), and side-effect helpers explicitly return `void` once DOM state is updated.

## Module Design

**Exports:** `src/main.ts` is the single entry point and does not export anything, while `src/shared/CameraMath.ts` exposes named `export type` and `export function` declarations without defaults.

**Barrel Files:** Not used today; every consumer imports directly from the helper path (`src/main.ts` imports `./shared/CameraMath`).

---

*Convention analysis: 2026-03-17*
