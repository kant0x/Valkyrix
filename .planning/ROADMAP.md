# Roadmap: Valkyrix

## Overview

Valkyrix v1 is organized around one outcome: an authored map must survive save, activation, load, and gameplay use without drifting from what the editor defined. The roadmap therefore moves from a trusted map contract, into isometric runtime fidelity, then camera parity, and finally full map-driven gameplay semantics for paths, anchors, zones, and exported entities.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Trusted Map Pipeline** - Stabilize save, activation, and repeated runtime loading around one exported map contract.
- [ ] **Phase 2: Isometric World Fidelity** - Make runtime geometry and base-layer rendering match the authored isometric map.
- [ ] **Phase 3: Camera-Authored Runtime View** - Reproduce saved camera behavior in runtime with trustworthy editor preview parity.
- [ ] **Phase 4: Map-Driven Gameplay Semantics** - Make gameplay systems consume authored paths, anchors, zones, and entity meaning from map data.

## Phase Details

### Phase 1: Trusted Map Pipeline
**Goal**: Saved maps become a stable runtime contract that can be activated and reloaded without manual intervention.
**Depends on**: Nothing (first phase)
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, RUN-01
**Success Criteria** (what must be TRUE):
  1. Designer can save a map from the editor and the runtime accepts the exported JSON structure on every load.
  2. Activating a map through `active-map.json` changes which map the game loads without requiring the editor to exist on the server.
  3. Re-saving a map in the editor changes runtime behavior on the next load without manual code edits.
  4. Loading the same exported map repeatedly preserves the same gameplay-relevant layer interpretation from one run to the next.
**Plans**: TBD

### Phase 2: Isometric World Fidelity
**Goal**: Runtime reproduces the authored map's isometric layout and base visual semantics from exported dimensions and layers.
**Depends on**: Phase 1
**Requirements**: ISO-01, ISO-02, ISO-03, LAYR-01, LAYR-07
**Success Criteria** (what must be TRUE):
  1. Player sees the map in the same isometric orientation used in the editor.
  2. Changing exported map width, height, tile width, or tile height changes runtime layout correctly without hardcoded overrides.
  3. Tiles and gameplay anchors appear at the correct world positions on the isometric grid.
  4. `ground` acts as the base runtime layer, while `decor` remains visual-only and does not silently affect gameplay logic.
**Plans**: TBD

### Phase 3: Camera-Authored Runtime View
**Goal**: Saved camera settings and camera-layer behavior match the editor's game-mode preview closely enough for map tuning to be trustworthy.
**Depends on**: Phase 2
**Requirements**: LAYR-03, CAM-01, CAM-02, CAM-03
**Success Criteria** (what must be TRUE):
  1. Runtime applies exported camera zoom, start position, road offset, and movement mode from map data.
  2. Maps with `cam` data enforce the saved camera rails and bounds, and maps without `cam` data fall back in a stable, predictable way.
  3. A designer can tune camera behavior in the editor preview and observe closely matching runtime behavior after export.
  4. Camera behavior remains authored map data rather than hidden runtime constants.
**Plans**: TBD

### Phase 4: Map-Driven Gameplay Semantics
**Goal**: Gameplay systems consume authored paths, anchors, zones, and exported entity meaning directly from the map instead of hardcoded values.
**Depends on**: Phase 3
**Requirements**: LAYR-02, LAYR-04, LAYR-05, LAYR-06, RUN-02, RUN-03
**Success Criteria** (what must be TRUE):
  1. Runtime uses exported `paths` data as the source of truth for movement routes and route-related map meaning.
  2. Runtime exposes spawn, citadel, path, and camera data from the map instead of hardcoded values.
  3. Authored `zones` preserve their gameplay meaning in runtime, including restricted, buildable, or trigger-style areas.
  4. Exported entities appear in runtime in a form that preserves their gameplay role on the map.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Trusted Map Pipeline | 0/TBD | Not started | - |
| 2. Isometric World Fidelity | 0/TBD | Not started | - |
| 3. Camera-Authored Runtime View | 0/TBD | Not started | - |
| 4. Map-Driven Gameplay Semantics | 0/TBD | Not started | - |
