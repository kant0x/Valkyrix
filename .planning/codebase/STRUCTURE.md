# Codebase Structure

**Analysis Date:** 2026-03-17

## Directory Layout
```
[project-root]/
├── .agent/             # Agent tooling (ignored by runtime)
├── .claude/
├── .codex/
├── .planning/          # Planner docs
│   └── codebase/
├── dist/                # `vite build` -> production assets
├── editor/              # Map editor UI and dev plugin
│   ├── index.html
│   ├── styles.css
│   ├── main.js
│   └── vite/
│       └── editorAssetsPlugin.mjs
├── node_modules/        # Dependencies installed via npm
├── public/              # Static assets exposed at runtime
│   └── assets/
│       ├── build/
│       ├── editor-tiles/
│       ├── maps/
│       ├── pers/
│       ├── projectiles/
│       └── tilesets/
├── src/
│   ├── main.ts
│   └── shared/
│       └── CameraMath.ts
├── vite/
│   ├── config.dev.mjs
│   └── config.prod.mjs
├── index.html
├── package.json
└── tsconfig.json
```

## Directory Purposes

**`.planning/codebase/`:**
- Purpose: Store orientation artifacts (ARCHITECTURE.md, STRUCTURE.md) that planners and executors read before implementation.
- Contains: Focused documents for each `gsd-map-codebase` focus area.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

**`editor/` & `editor/vite/`:**
- Purpose: Deliver the in-browser map editor UI and the Vite plugin that enumerates assets plus exposes `/__` endpoints.
- Contains: `editor/index.html`, editor styles (`styles.css`), compiled logic (`main.js`), and `editorAssetsPlugin.mjs`.
- Key files: `editor/main.js`, `editor/vite/editorAssetsPlugin.mjs`.

**`public/assets/`:**
- Purpose: Hold the tile textures, buildings, objects, and map JSONs consumed by both the runtime and the editor.
- Contains: `build`, `editor-tiles`, `maps`, `pers`, `projectiles`, `tilesets` subfolders with PNG/JSON packs.
- Key files: `public/assets/maps/active-map.json`, `public/assets/maps/valkyrix-map.json`, assorted tile PNGs referenced by `primeTileImages`.

**`public/assets/maps/`:**
- Purpose: Store every map file, including `active-map.json` that the runtime reads and the editor writes.
- Contains: `active-map.json`, `.gitkeep`, specific map exports (e.g., `valkyrix-map.json`).
- Key files: `public/assets/maps/active-map.json`.

**`src/`:**
- Purpose: Contain the runtime logic for the canvas game.
- Contains: `main.ts` entry, `vite-env.d.ts`, and helper directories such as `shared/`.
- Key files: `src/main.ts`.

**`src/shared/`:**
- Purpose: House utilities that can be referenced across runtime/editor, especially camera math.
- Contains: `CameraMath.ts`.
- Key files: `src/shared/CameraMath.ts`.

**`vite/`:**
- Purpose: Configure development and production bundling.
- Contains: `config.dev.mjs` (registers `editorAssetsPlugin` and dev server settings) and `config.prod.mjs` (production build output).
- Key files: `vite/config.dev.mjs`, `vite/config.prod.mjs`.

**`dist/`:**
- Purpose: Generated build output when running `npm run build`.
- Contains: Bundled assets mirroring `public/assets`, plus compiled `main`/`editor` JS and HTML.
- Key files: `dist/index.html`, `dist/editor/index.html`, `dist/assets/maps/active-map.json`.

## Key File Locations

**Entry Points:**
- `index.html`: Root HTML that mounts `<div id="game-container">` and loads `/src/main.ts`.
- `editor/index.html`: Editor HTML that pulls in `./styles.css` and starts `./main.js`.

**Configuration:**
- `package.json`: Lists `npm run dev/build/preview`, `type: module`, and devDependencies (`vite`, `terser`, `typescript`).
- `tsconfig.json`: Targets `ES2020`/`ESNext`, resolves modules via bundler, and outputs to `dist`.
- `vite/config.dev.mjs` & `vite/config.prod.mjs`: Define dual inputs `main`/`editor` and register the `editorAssetsPlugin` in dev.

**Core Logic:**
- `src/main.ts`: Canvas runtime, map loading, rendering loop, input binding, and HUD updates.
- `src/shared/CameraMath.ts`: Viewport/iso math helpers used by both runtime and editor.
- `editor/main.js`: Editor UI, asset loaders, layer state, and save/activate workflows.
- `editor/vite/editorAssetsPlugin.mjs`: Asset enumeration virtual module plus `/__active_map`, `/__editor_assets`, `/__save_map`, `/__set_active_map` endpoints.

**Testing:**
- Not detected (no test directories or configs in the repository yet).

## Naming Conventions

**Files:**
- Helper modules use PascalCase when they describe a concept (`src/shared/CameraMath.ts`), while entry points are lowercased (`src/main.ts`, `editor/main.js`, `index.html`).
- Runtime constants and functions inside `src/main.ts` follow camelCase (`bindInput`, `loadMap`, `drawTiles`).

**Directories:**
- Resource folders live under `public/assets/<category>` (`tilesets`, `maps`, `objects`, etc.), grouping assets by their runtime/editor role.
- Build/tooling directories (`vite/`, `.planning/codebase/`, `editor/vite/`) describe their purpose directly.

## Where to Add New Code

**New Feature:**
- Primary code: `src/` (extend `src/main.ts` or add new helpers under `src/` and import them at the entry point).
- Tests: Not detected (no existing test harness; add a new `tests/` or `vitest` setup if introducing automated verification).

**New Component/Module:**
- Implementation: `editor/main.js` or supplemental files under `editor/`/`editor/vite/` when the feature targets the editor workflow or plugin endpoints.

**Utilities:**
- Shared helpers (math, asset parsing) belong under `src/shared/`, and any editor-specific tooling (asset enumeration, save middleware) stays in `editor/vite/editorAssetsPlugin.mjs`.

## Special Directories

**`dist/`:**
- Purpose: Production bundle output created by `npm run build`.
- Generated: Yes.
- Committed: No (treat as build artifact; rerun `npm run build` instead of manual edits).

**`node_modules/`:**
- Purpose: Dependency tree installed via `npm install`.
- Generated: Yes.
- Committed: No.

**`public/assets/maps/`:**
- Purpose: Authoritative map storage and the `active-map.json` file consumed by the runtime.
- Generated: Partially (editor writes JSON files here; base maps are committed too).
- Committed: Yes (map JSONs are tracked).

**`.planning/codebase/`:**
- Purpose: Holds orientation documents consumed by other GSD commands.
- Generated: Yes (updated whenever a new focus is mapped).
- Committed: Yes.

---
*Structure analysis: 2026-03-17*
