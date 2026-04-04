# Phase 1 Summary: Map & Runtime Foundation

**Phase:** 1
**Status:** Complete
**Completed:** 2026-03-17

---

## One-liner

Complete isometric map system built: editor with all 7 layers and camera config, stable JSON export contract, `active-map.json` activation, and a runtime renderer with full camera system (road/free/iso modes) reading everything from map data.

---

## What Was Built

### Map Export Contract (`public/assets/maps/valkyrix-map.json`)
- JSON format version 7, 70×30 tiles, 64×32px each
- **Camera block**: zoom (1.948), startX/Y, moveMode (`road-both`), roadDirection (`east`), roadViewOffsetY, boundsSource (`layers`), boundsPad, boundsEnabled, AABB bounds, isoClamp, railScrollMinX/MaxX/Y
- **Scene block**: citadel anchor, railAnchor, primaryDirection (`east`), portals array, full cameraRail path (polygon of world-space points)
- **Layers**: ground, paths, cam, zones, decor, citadel, spawn — each as flat tile index array

### Active-Map Activation (`public/assets/maps/active-map.json`)
- Full map embedded — changing this file changes the active game map at next load
- No editor required at runtime

### Isometric Coordinate System (`src/main.ts`)
- `tileToWorld(map, col, row)` → world-space center of any tile using map dimensions
- `worldToScreen(x, y)` → canvas pixel via camera center + zoom
- `mapDiamondPoints(map)` → 4 diamond corners for bounds computation
- `ISO_LAYER_X = 1152` offset for correct isometric grid placement

### Tile Renderer
- `drawTiles(map)` — renders `ground` (base) + `decor` (visual-only) per tile, row-major order
- Diamond tile shape with tileset image lookup by GID
- Debug mask overlays: paths (blue), cam (cyan), zones (orange), citadel (aqua), spawn (red)
- `V` key toggles debug masks

### Camera System
- **Road mode** (`road-both`, `road-east`, etc.): projects camera center to `cameraRail` polyline, clamps to rail scroll bounds
- **Free mode**: AABB scroll bounds from layer extents or map bounds
- **Iso clamp**: `clampScrollToIsoDiamond` for diamond-shaped bounds
- Reads all config from map data — no hardcoded camera values
- WASD / arrow keys + mouse drag navigation
- `F` = reset to map start, `R` = reload map

### Scene Markers
- `drawSceneRail(map)` — renders cameraRail path as polyline
- `drawSceneMarkers(map)` — citadel marker, portal markers
- `drawWorldItems(items, color)` — buildings (green), obstacles (orange), graphics (blue)

### Map Editor (`editor/main.js`, 2581 lines)
- Full isometric editor: paint/erase, variable brush size, all 7 layers
- Layer visibility toggles + mask color overlays per layer
- Camera panel: zoom, start position, move mode, road direction, bounds source, boundsPad, isoClamp
- **Game camera preview**: simulates runtime camera behavior inside the editor
- **Game View Mode** (G-key): interactive viewport rect for authoring camera start position
- Export to `public/assets/maps/{name}.json` + activate to `active-map.json`
- Asset catalog: tiles, buildings, objects, graphics
- Localization: Russian / English (i18n)

### Shared CameraMath (`src/shared/CameraMath.ts`, 146 lines)
- `centerToScroll` / `scrollToCenter` — convert between camera center and scroll position
- `clampCenterToScrollBounds` — AABB bounds clamping
- `clampScrollToIsoDiamond` — iso diamond bounds clamping
- `computeRoadViewOffset` — road-mode vertical offset
- `computeViewSize` — visible world size at given zoom
- Shared between editor and runtime

---

## Requirements Satisfied

- **MAP-01** ✓ — Editor saves to stable JSON (`valkyrix-map.json`)
- **MAP-02** ✓ — `active-map.json` activates map in runtime
- **MAP-03** ✓ — Runtime loads map without editor present
- **MAP-04** ✓ — Re-saving in editor updates runtime on next load
- **ISO-01** ✓ — Runtime renders map in correct isometric orientation
- **ISO-02** ✓ — Runtime uses exported width/height/tileWidth/tileHeight (no hardcoded overrides)
- **ISO-03** ✓ — Tiles and anchors at correct world positions on iso grid
- **LAYR-01** ✓ — `ground` is base visual/structural layer
- **LAYR-02** ✓ — `paths` layer defined, mask rendered, exported in map contract
- **LAYR-03** ✓ — `cam` layer defined, camera rail reads from it
- **LAYR-04** ✓ — `spawn` layer defined, mask rendered
- **LAYR-05** ✓ — `citadel` layer defined, anchor rendered
- **LAYR-06** ✓ — `zones` layer defined, mask rendered
- **LAYR-07** ✓ — `decor` is visual-only, no gameplay logic
- **CAM-01** ✓ — Runtime applies zoom, start position, road offset, moveMode from map data
- **CAM-02** ✓ — Camera rail bounds and road-mode rail projection applied from map data
- **CAM-03** ✓ — Editor game-mode preview matches runtime camera behavior
- **RUN-01** ✓ — All layers interpreted consistently on every load

---

## Key Decisions

- **Single runtime contract**: exported JSON + `active-map.json` — no secondary format
- **No hardcoded camera values**: everything (zoom, bounds, start, mode) comes from map data
- **CameraMath shared module**: camera math in `src/shared/` used by both editor and runtime
- **Version field** in map JSON (`version: 7`) for future format migrations
- **`decor` visual-only**: explicitly separated from gameplay layers, no mask rendered
