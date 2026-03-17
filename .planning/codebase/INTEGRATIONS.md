# External Integrations

**Analysis Date:** 2026-03-17

## APIs & External Services

**Local map/editor APIs:**
- The custom middleware in `editor/vite/editorAssetsPlugin.mjs` exposes `/__active_map`, `/__editor_assets`, `/__save_map`, and `/__set_active_map` so the editor UI and runtime can refresh asset lists and persist `public/assets/maps/*.json`. `editor/main.js` (see the `fetch` calls near lines 1793 and 2271) posts map data and polls the middleware, while `src/main.ts` loads `/assets/maps/active-map.json`.
  - SDK/Client: Browser `fetch` API within `editor/main.js` and `src/main.ts`.
  - Auth: None (the local middleware is open-access during development).

## Data Storage

**Databases:**
- Not detected.

**File Storage:**
- `public/assets/maps/active-map.json` (alongside `valkyrix-map.json` and other map drafts) is the canonical map file that `src/main.ts` reads inside `loadMap` (`fetch('assets/maps/active-map.json?v=...')`). The editor writes to and activates files in this directory via `/__save_map` and `/__set_active_map`.
  - Connection: Served over Vite's static `/assets/maps` endpoint.
  - Client: Browser `fetch` in `src/main.ts` and `editor/main.js`.
- Tile/structure/object/graphics assets under `public/assets/tiles*`, `structures`, `build`, `objects`, and `graphics` are enumerated by `editorAssetsPlugin` and exposed through `/__editor_assets`.
  - `editor/vite/editorAssetsPlugin.mjs` watches those directories with Node `fs` + `server.watcher` so new files trigger a hot reload of the editor's virtual asset module.
  - When a `dist/` directory already exists, the plugin also copies map JSON into `dist/assets/maps`, keeping the production bundle aligned with the active map.

**Caching:**
- None; `src/main.ts` requests `assets/maps/active-map.json` with `cache: 'no-store'`, and `/__active_map` middleware returns `Cache-Control: no-store` responses.

## Authentication & Identity

**Auth Provider:**
- None; both runtime and editor rely on open static files and local dev middleware.

## Monitoring & Observability

**Error Tracking:**
- None.

**Logs:**
- Not instrumented.

## CI/CD & Deployment

**Hosting:**
- Static hosting for `dist/` after running `npm run build` (`package.json` and `vite/config.prod.mjs`); `editorAssetsPlugin` also mirrors map JSON into `dist/assets/maps`.

**CI Pipeline:**
- None defined in the repository.

## Environment Configuration

**Required env vars:**
- None.

**Secrets location:**
- Not applicable.

## Webhooks & Callbacks

**Incoming:**
- The dev middleware in `editor/vite/editorAssetsPlugin.mjs` provides `/__save_map`, `/__set_active_map`, `/__editor_assets`, and `/__active_map`, all consumed by `editor/main.js` to update asset lists and persist/activate map data in `public/assets/maps`.

**Outgoing:**
- `editor/main.js` posts map data to `/__save_map`/`/__set_active_map` and polls `/__editor_assets`/`/__active_map`; `src/main.ts` fetches `/assets/maps/active-map.json` (with a timestamp query to bust caches) as its only external request.
