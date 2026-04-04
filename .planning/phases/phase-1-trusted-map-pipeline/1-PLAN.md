# Phase 1 Plan: Map & Runtime Foundation

**Phase:** 1
**Name:** Map & Runtime Foundation
**Goal:** A complete, working isometric map system — editor that exports a stable JSON contract, runtime that loads and renders it with full camera and layer semantics.
**Requirements:** MAP-01, MAP-02, MAP-03, MAP-04, ISO-01, ISO-02, ISO-03, LAYR-01, LAYR-02, LAYR-03, LAYR-04, LAYR-05, LAYR-06, LAYR-07, CAM-01, CAM-02, CAM-03, RUN-01

---

## Objective

Build the entire map layer of the project: an isometric map editor with full layer and camera support, a stable JSON export format, an `active-map.json` activation pointer, and a runtime renderer that reads all map data from the exported contract with no hardcoded overrides.

---

## Tasks

### Task 1: Map export format
- Design stable JSON schema: version, width, height, tileWidth, tileHeight, camera, scene, layers
- Camera block: zoom, startX/Y, moveMode, roadDirection, roadViewOffsetY, boundsSource, bounds, isoClamp, rail scroll bounds
- Scene block: citadel, railAnchor, primaryDirection, portals, cameraRail path
- Named tile layers: ground, paths, cam, zones, decor, citadel, spawn

### Task 2: active-map.json activation
- `active-map.json` as runtime activation pointer
- Changing this file changes the active game map without redeployment

### Task 3: Isometric coordinate system
- `tileToWorld(map, col, row)` — tile grid to world space
- `worldToScreen(x, y)` — world to canvas screen coords using camera center + zoom
- `mapDiamondPoints(map)` — compute diamond corners from map dimensions
- ISO_LAYER_X/Y offset for isometric layout

### Task 4: Tile rendering
- `drawTiles(map)` — renders ground layer + decor layer per tile
- `drawDiamondTile(map, gid, ...)` — diamond-shaped tile fill with fallback color
- Tileset image loading with per-tile GID lookup
- Debug mask overlays for paths, cam, zones, citadel, spawn layers (color-coded)

### Task 5: Camera system
- Read zoom + startX/Y from map camera block
- `clampCameraCenter(map, zoom, proposed)` — bounds clamping with 3 strategies:
  - Road mode: project to cameraRail, clamp to rail scroll bounds
  - Scroll bounds: AABB from layer or map extents
  - Iso diamond clamp: `clampScrollToIsoDiamond`
- WASD / arrow key movement + mouse drag
- `F` = reset to map start, `R` = reload map, `V` = toggle debug masks

### Task 6: Scene markers
- `drawSceneRail(map)` — render cameraRail path
- `drawSceneMarkers(map)` — citadel anchor, portals
- `drawWorldItems(items, color)` — buildings, obstacles, graphics

### Task 7: Map editor (`editor/main.js`)
- Full isometric tile editor: paint/erase, brush size, all 7 layers
- Layer visibility toggles, mask color overlays
- Camera config panel: zoom, start position, move mode, road direction, bounds source, iso clamp
- Game camera preview mode (simulates runtime camera behavior)
- Game View Mode (G-key): interactive viewport rect dragging for start position
- Export to `public/assets/maps/{name}.json`
- Load active map, activate map to `active-map.json`
- Asset catalog: tiles, buildings, objects, graphics
- i18n (ru/en)

### Task 8: Shared CameraMath module
- `centerToScroll` / `scrollToCenter`
- `clampCenterToScrollBounds`
- `clampScrollToIsoDiamond`
- `computeRoadViewOffset`
- `computeViewSize`
- Used by both editor and runtime

---

## Success Criteria

1. Designer can save a map from the editor and the runtime accepts the exported JSON on every load.
2. Activating a map through `active-map.json` changes which map the game loads without requiring the editor.
3. Runtime renders the map in the correct isometric orientation using dimensions from map data.
4. Camera reads zoom, start position, move mode, road offset, and bounds from exported map data.
5. All 7 layers interpreted consistently on every load.

---

## Files

- `editor/main.js` — isometric map editor
- `editor/CameraMath.ts` — camera math (editor copy)
- `src/main.ts` — runtime renderer + camera + map loader
- `src/shared/CameraMath.ts` — shared camera math
- `public/assets/maps/valkyrix-map.json` — exported map contract
- `public/assets/maps/active-map.json` — runtime activation pointer
