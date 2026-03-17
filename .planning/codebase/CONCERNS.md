# Codebase Concerns

**Analysis Date:** 2026-03-17

## Tech Debt

**`src/main.ts` bundles markup, input, rendering, HUD, and camera math in one module**
- Issue: The entire runtime (DOM injection, CSS, canvas configuration, keyboard/pointer bindings, animation loop, tile drawing, camera bounds and HUD diagnostics) lives inside a single 1,200+ line file with no sub-modules.
- Files: `src/main.ts`
- Impact: Any change risks introducing regressions in unrelated areas, making it hard to reason about, test, or reuse camera/math helpers outside this file.
- Fix approach: Break the runtime into focused modules (e.g., `renderer/tiles.ts`, `camera/bounds.ts`, `state/runtime.ts`) so the UI shell, rendering loop, and camera math evolve independently and gain per-module unit tests.

**`editor/main.js` is an enormous compiled bundle without source**
- Issue: The editor UI logic is shipped as a 127k-line compiled JavaScript blob with no TypeScript or modular sources in the repo.
- Files: `editor/main.js`
- Impact: Even tiny repairs require editing large minified code, which is error-prone and prohibits IDE refactors or static checking on the editor logic.
- Fix approach: Rebuild the editor from readable sources, split the logic into reusable modules, and check the generated bundle into `dist` instead of hand-editing `main.js`.

## Known Bugs

**Movement keys remain pressed after focus loss**
- Issue: `bindInput` only listens to `keydown`/`keyup` (lines around 200) and never clears `runtime.keys` when the window blurs or becomes hidden.
- Files: `src/main.ts`
- Symptoms: Holding WASD/arrows, switching tabs, and releasing the key elsewhere leaves the `runtime.keys` `Set` populated, so the camera keeps drifting once focus returns.
- Trigger: Press movement key, change focus before keyup fires.
- Workaround: Reload the page or press an opposite direction so the `Set` is corrected manually.

## Security Considerations

**Dev middleware rewrites `active-map.json` without auth**
- Risk: The Vite plugin (`editor/vite/editorAssetsPlugin.mjs`) exposes `/__save_map` and `/__set_active_map`, accepts arbitrary JSON, and writes it directly into `public/assets/maps` (and `dist/assets/maps`). Any attacker who can reach the dev server can overwrite `active-map.json` (the only map the game loads) with malicious or malformed data.
- Files: `editor/vite/editorAssetsPlugin.mjs`
- Current mitigation: None-the endpoints are unauthenticated and implicitly trusted because the dev server is usually local.
- Recommendations: Restrict these endpoints to localhost, add a shared secret or token, and write to a temp file/backup before replacing `active-map.json`.

## Performance Bottlenecks

**Rendering loops touch every tile/mask every frame**
- Problem: `drawTiles` (around line 320) loops `row < map.height` and `col < map.width`, converts each diamond to screen space, draws the ground/decor tile, and, when debug masks are enabled, reprocesses five mask layers for every cell every frame.
- Files: `src/main.ts`
- Cause: No viewport culling and no reuse of precomputed quad positions, so per-frame work grows with `width * height`.
- Improvement path: Limit rendering to tiles intersecting the viewport, cache screen coordinates for static tiles, and batch mask drawing or skip it entirely when debug masks are off.

**Tile images are prefetched for every map cell**
- Problem: `primeTileImages` (around line 440) iterates every index in `layer` arrays for `TILE_LAYERS` and instantiates an `Image` for each referenced GID before the first frame. `runtime.images` then keeps every entry alive.
- Files: `src/main.ts`
- Cause: No throttling, deduplication beyond the `Map`, and no lazy loading based on visibility.
- Improvement path: Prefetch only tiles that appear close to the viewport, drop `ImageEntry`s when their tiles go out of scope, or load directly inside `drawDiamondTile` when needed.

## Fragile Areas

**There is only one writable map file and no validation/backup**
- Files: `editor/vite/editorAssetsPlugin.mjs`, `public/assets/maps/active-map.json`, `src/main.ts`
- Why fragile: The runtime reads only `active-map.json`, and the editor backend overwrites that same file with every "Activate" call. A malformed save (or a crash during `fs.writeFileSync`) corrupts that single source, leaving the game unable to start until a human restores the JSON manually.
- Safe modification: Write saves to a temporary file or suffix (e.g., `active-map.json.tmp`), validate the schema before replacing `active-map.json`, and keep timestamped backups so the last working map can be restored automatically.
- Test coverage: Not covered by automated tests or schematized validation, so regressions are easy to miss.

## Scaling Limits

**Runtime hits quadratic costs well before the editor's upper bounds**
- Current capacity: The default runtime map is `70x30`, but the editor UI inputs (`editor/index.html` width/height controls) allow creating maps up to `500` columns by `300` rows.
- Files: `src/main.ts`, `editor/index.html`
- Limit: Rendering (`drawTiles`), viewport bounds (`computeLayerWorldBounds`, `computeIsoBoundsFromLayer`), and tile prefetch (`primeTileImages`) each iterate over every tile on every frame or load, so a 500x300 map would require millions of iterations and thousands of image downloads, which will drop FPS and exhaust memory.
- Scaling path: Introduce viewport-aware iteration, cap the default map size, and profile/batch the bounds calculations so they don't re-scan the entire grid every frame.

## Dependencies at Risk

**Build toolchain is unmonitored**
- Risk: `package.json` only lists `vite@^6.3.1`, `typescript@~5.7.2`, and `terser@^5.39.0` as dev dependencies, but there are no audit scripts or scheduled updates. Any vuln in those tools could go unnoticed for long periods even though the editor bundle is rebuilt with them.
- Files: `package.json`
- Impact: A compromised dev dependency can inject code into every build (especially the large `editor/main.js`), and stale versions can silently break asset handling.
- Migration plan: Add `npm audit`, `npm outdated`, or similar gating; pin exact versions; consider migrating to a more actively maintained release train that publishes security announcements.

## Missing Critical Features

**No staging/preview for activating a map**
- Problem: The only way to move a map into production is the editor's "Activate" button, which immediately overwrites `active-map.json` and `dist/assets/maps/active-map.json`. There is no staging copy, diff, or preview of the resulting runtime bounds before the game loads it.
- Files: `editor/vite/editorAssetsPlugin.mjs`, `public/assets/maps/active-map.json`
- Blocks: Accidental activations can crash the runtime and must be fixed offline, causing downtime for anyone trying to play/test the game.

## Test Coverage Gaps

**No automated tests exist**
- What's not tested: None of the rendering math, camera bounds, map loading, or editor activation flows have automated coverage; there are zero `*.test.*`/`*.spec.*` files and no test script.
- Files: `package.json`, `src/main.ts`
- Risk: Core runtime behaviors and the editor pipeline regress without warning because every change is verified only manually in the browser.
- Priority: High - these areas are mission-critical and currently unverified.

---

*Concerns audit: 2026-03-17*
