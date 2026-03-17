# Architecture

**Analysis Date:** 2026-03-17

## Pattern Overview

**Overall:** Canvas-driven runtime with a companion editor served as separate Vite inputs, both orchestrated without a higher-level framework.

**Key Characteristics:**
- Direct DOM bootstrapping in `src/main.ts` builds the HUD/canvas UI, keeps a global `runtime` object, and drives the `requestAnimationFrame` loop that updates state and renders tiles.
- Map/asset data under `public/assets` (in particular `public/assets/maps/active-map.json`) are the sole source of truth for `loadMap`, `primeTileImages`, and the tile/obstacle rendering helpers.
- Editor UI launched from `editor/index.html` executes `editor/main.js`, which relies on `editor/vite/editorAssetsPlugin.mjs` for asset discovery and the `/__save_map`/`/__set_active_map` endpoints that synchronize `public/assets/maps`.

## Layers

**Runtime Canvas Layer:**
- Purpose: Host the playable map view, HUD text, overlays, and interactive camera controls.
- Location: `src/main.ts`.
- Contains: `RuntimeState`/`RuntimeMap` definitions, DOM wiring (`ensureRuntimeStyle`, template HTML), canvas configuration, `loadMap`, `bindInput`, `update`, and the `draw*` helpers.
- Depends on: `src/shared/CameraMath.ts` for view/scroll math and `public/assets` for map and tile images (via `normalizeAssetPath`/`toAssetUrl`).
- Used by: `index.html` (via `<script type="module" src="/src/main.ts">`), `vite/config.*` entries, and the contents of `dist/`.

**Shared Math Layer:**
- Purpose: Offer reusable camera/scroll conversions and clamps for both runtime and editor.
- Location: `src/shared/CameraMath.ts`.
- Contains: `computeViewSize`, `scrollToCenter`, `centerToScroll`, `clampCenterToScrollBounds`, `clampScrollToIsoDiamond`, and `computeRoadViewOffset`.
- Depends on: None (pure math helpers).
- Used by: `src/main.ts` and the duplicated `CameraMath.ts` that the editor bundles inside `editor/main.js`.

**Editor & Asset API Layer:**
- Purpose: Provide a design UI for painting maps, configuring camera bounds, and persisting assets back to the runtime asset directories.
- Location: `editor/main.js` plus `editor/vite/editorAssetsPlugin.mjs`.
- Contains: UI wiring (`btn-new`, `brush-size`, etc.), `loadAssets`, `loadActive`, `confirmSaveMap`, layer state (`layers`, `placedBuildings`, `cam*`), and the code that detects user input to paint/drill camera bounds.
- Depends on: `editorAssetsPlugin` for the virtual module `virtual:editor-assets` and middleware routes (`/__editor_assets`, `/__save_map`, `/__set_active_map`, `/__active_map`), `public/assets/*` for tiles/buildings/maps, and `localStorage` for autosaves.
- Used by: `editor/index.html`, the Vite dev server (`npm run dev` via `vite/config.dev.mjs`), and production builds that emit `dist/editor`.

**Bundler & Build Layer:**
- Purpose: Define how Vite compiles both the runtime and the editor, handling dev middleware and production outputs.
- Location: `vite/config.dev.mjs`, `vite/config.prod.mjs`, `package.json`, `tsconfig.json`.
- Contains: Vite inputs (`main`/`editor`), the registration of `editorAssetsPlugin` during dev, build settings (`terser`, `outDir`), npm scripts (`dev`, `build`, `preview`), and TypeScript compiler options.
- Depends on: `typescript`, `vite`, `terser` (devDependencies in `package.json`).
- Used by: Developers running `npm run dev`/`npm run build` to produce `dist/`, as well as the runtime/editor entry HTML files.

## Data Flow

**Game Rendering Flow:**
1. `index.html` loads `/src/main.ts`, which creates the HUD markup, obtains `#game-container`, configures the `<canvas>`, and initializes the `runtime` object.
2. `loadMap` fetches `public/assets/maps/active-map.json` with a cache buster, runs `validateMap`, updates `runtime.map`, infers `runtime.mapName`, and clears the image cache.
3. `primeTileImages` iterates `TILE_LAYERS`, calling `ensureTileImage` for every GID, which normalizes asset paths and loads `public/assets/tilesets`, `public/assets/tiles`, or any referenced URL into `runtime.images`.
4. `requestAnimationFrame(frame)` invokes `update` (which honors `bindInput` key/mouse state) and `render` (which draws tiles, world entities, camera bounds, and HUD overlays) while `runtime.status`/`mapStatsEl` surface progress.

**Editor Asset & Map Sync Flow:**
1. `editor/main.js` bootstraps by fetching `/__editor_assets` (served by `editor/vite/editorAssetsPlugin.mjs`) to populate `assetCatalog` arrays for tiles/buildings/objects/graphics/maps.
2. `loadActive` requests `/__active_map`, falls back to autosave/localStorage, and then calls `applyLoadedMap`/`syncCamForm` to load the `layers`, camera state, and UI controls.
3. Saving hits `/__save_map`, where the plugin sanitizes the filename, writes JSON to `public/assets/maps/<file>`, mirrors it into `dist/assets/maps/`, and optionally rewrites `active-map.json`.
4. `/__set_active_map` lets the editor flip the active map without editing content by reading an existing map JSON, stripping editor metadata, and rewriting `public/assets/maps/active-map.json` (and `dist`), keeping the runtime entry in sync.

**State Management:**
- The runtime keeps a single `runtime` object that records the `map`, `cameraCenter`, `zoom`, `keys`, `images`, `status`, and `error`; `loadMap`, `bindInput`, and `frame` mutate it while `render` reads it.
- The editor stores mutable globals (`layers`, `placedBuildings/Objects/Graphics`, `assetCatalog`, `currentCatalog`, `gameZoom`, `camBounds*`) and serializes them to `localStorage`/`public/assets/maps` as the user edits.

## Key Abstractions

**`RuntimeMap` / `RuntimeState` (`src/main.ts`):**
- Purpose: Describe map metadata (dimensions, camera, layers) plus live runtime flags that the renderer observes.
- Examples: `validateMap`, `getStartCenter`, `computeCameraScrollBounds`.
- Pattern: Plain objects mutated by helper functions before kicking off rendering.

**Camera Math helpers (`src/shared/CameraMath.ts`):**
- Purpose: Centralize viewport conversion, clamping, and road offset math for both runtime and editor code.
- Examples: `computeViewSize`, `clampCenterToScrollBounds`, `clampScrollToIsoDiamond`, `computeRoadViewOffset`.
- Pattern: Stateless utilities consumed by `src/main.ts` and copied into `editor/main.js`.

**Editor Map Model (`editor/main.js`):**
- Purpose: Keep per-layer grids (`layers`), placements (`placedBuildings`, etc.), asset selections (`selectedAsset`), and camera configs (`camBounds*`, `gameZoom`) in sync with the UI.
- Examples: `buildMap`, `applyLoadedMap`, `syncTop`, `draw`.
- Pattern: Mutable module scope with explicit sync helpers triggered by UI controls.

**Editor Asset Plugin (`editor/vite/editorAssetsPlugin.mjs`):**
- Purpose: Enumerate `/assets/*` directories, supply a virtual module (`virtual:editor-assets`), and add dev-server `/__*` endpoints for loading/saving maps.
- Examples: `buildLists`, `configureServer` hooks that register watchers and middleware for `/__active_map`, `/__editor_assets`, `/__save_map`, `/__set_active_map`.
- Pattern: Vite plugin exposing `resolveId`, `load`, and `configureServer`.

## Entry Points

**`index.html`:**
- Location: root.
- Triggers: Browser fetch loads `<script type="module" src="/src/main.ts">`.
- Responsibilities: Provide the `#game-container` div, inline base styles, and bootstrap the canvas runtime.

**`editor/index.html`:**
- Location: `editor/index.html`.
- Triggers: Vite dev server or `dist/editor/index.html`.
- Responsibilities: Build the editor UI (toolbar, canvas, panels), apply `styles.css`, and start `./main.js`.

**`vite/config.dev.mjs` & `vite/config.prod.mjs`:**
- Location: `vite/`.
- Triggers: `npm run dev`/`npm run build`.
- Responsibilities: Declare `input.main`/`input.editor`, register `editorAssetsPlugin` during dev, define `dist` output structure, and minify bundles with `terser`.

## Error Handling

**Strategy:** Display runtime health through `statusEl`, `mapStatsEl`, `cameraStatsEl`, and the overlay, while avoiding crashes by catching `loadMap` errors and falling back to informative text.

**Patterns:**
- `loadMap` wraps the fetch/JSON/validation block in `try/catch`, assigns `runtime.error`, and lets `render` call `drawError` when a map cannot be parsed.
- `validateMap` throws when required dimensions are `NaN`, ensuring the render pipeline shuts off before it draws invalid geometry.
- The editor wraps asset/map fetches (`loadAssets`, `loadActive`) in `try/catch` and reports failure via `setStatus`; plugin middleware returns HTTP 4xx/5xx plus JSON `{ ok: false }` when saving fails.

## Cross-Cutting Concerns

**Logging:** `statusEl`, `mapStatsEl`, and `cameraStatsEl` in `src/main.ts` plus `setStatus`/`statsEl` in `editor/main.js` provide textual feedback instead of console logs while keeping the UI responsive.

**Validation:** `validateMap` guards map dimensions, `computeCameraScrollBounds`/`clampCenterToScrollBounds` prevent runaway camera movement, and `editorAssetsPlugin` sanitizes filenames before creating `public/assets/maps` entries.

**Authentication:** None; both the runtime and editor serve static assets with no auth layer, and the custom Vite endpoints assume a local dev environment.

---
*Architecture analysis: 2026-03-17*
