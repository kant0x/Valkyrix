# Architecture Research

**Analysis Date:** 2026-03-17
**Milestone Context:** Subsequent milestone extending an existing map editor and game runtime

## Recommended Architecture Shape

The project should stay organized around a **map-first pipeline**:

1. **Editor authoring layer**
2. **Export contract layer**
3. **Runtime map ingestion layer**
4. **Runtime systems that interpret map layers**
5. **Gameplay systems built on top of interpreted map state**

## Core Components

### 1. Authoring

- Purpose: create and tune the map visually
- Current home: `editor/main.js`
- Responsibilities:
  - map editing
  - layer painting
  - camera/game-mode preview
  - save/activate flow

### 2. Export Contract

- Purpose: provide one runtime-safe JSON representation
- Current home:
  - `editor/main.js`
  - `editor/vite/editorAssetsPlugin.mjs`
  - `public/assets/maps/*.json`
- Responsibilities:
  - serialize map layers
  - serialize camera state
  - serialize runtime scene anchors such as rail, citadel, spawn

### 3. Shared Math / Shared Rules

- Purpose: prevent editor/runtime drift
- Current home: `src/shared/CameraMath.ts`
- Responsibilities:
  - view sizing
  - camera scroll/center transforms
  - bounds clamping
  - road-view offsets

### 4. Runtime Map Layer

- Purpose: load map JSON and expose stable runtime structures
- Current home: `src/main.ts`
- Responsibilities:
  - fetch `active-map.json`
  - normalize map state
  - expose layer lookups
  - expose bounds and camera constraints

### 5. Runtime Gameplay Interpretation

- Purpose: convert raw layer data into gameplay meaning
- Near-term responsibilities:
  - `paths` => route/navigation meaning
  - `cam` => camera rail meaning
  - `spawn` => spawn anchors
  - `citadel` => base/goal anchor
  - `zones` => gameplay-restricted or buildable areas
  - `decor` => visual-only layer

## Data Flow

### Primary Flow

1. User edits map in editor
2. Editor saves stable JSON map data
3. Runtime loads `active-map.json`
4. Runtime applies shared camera rules and layer interpretation
5. Gameplay systems consume interpreted map meaning

### Key Design Rule

The runtime should **consume the map contract**, not reconstruct meaning from editor-specific UI state.

## Build Order Implications

Recommended roadmap order:

1. Stabilize map contract and layer meaning
2. Finish entity export/import contract
3. Build movement/spawn/base systems on top of map semantics
4. Add validation/debug tooling around the map contract
5. Expand full gameplay systems after the map core is trusted

## Boundaries To Preserve

- Editor-specific UI logic should stay out of runtime code
- Runtime should not depend on the editor running on the server
- Shared math should be extracted intentionally, not copied ad hoc
- Layer interpretation should be explicit and documented

## Official Reference Signals

- Tiled layer docs support the idea of layer-specific behavior and organization: https://doc.mapeditor.org/en/stable/manual/layers/
- Tiled JSON docs reinforce map-as-data architecture with structured tile layers and objects: https://doc.mapeditor.org/en/stable/reference/json-map-format/
- Phaser camera bounds docs show the value of keeping camera behavior explicit and bounded: https://docs.phaser.io/phaser/concepts/cameras

## Recommendation

Architect the rest of the project around this principle:

**The map is not just level art. It is the runtime authority for movement, camera, anchors, and world semantics.**

---
*Architecture research completed: 2026-03-17*
