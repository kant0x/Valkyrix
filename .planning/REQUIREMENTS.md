# Requirements: Valkyrix

**Defined:** 2026-03-17
**Core Value:** An edited map must load in the game and behave exactly as designed: same isometric structure, same layer meaning, same movement logic, and the same camera behavior after every save.

## v1 Requirements

### Map Contract

- [ ] **MAP-01**: User can save a map from the editor to a stable JSON structure used by the runtime
- [ ] **MAP-02**: User can activate a saved map so the game runtime loads it through `active-map.json`
- [ ] **MAP-03**: Runtime can load an exported map without requiring the editor to be present on the server
- [ ] **MAP-04**: Re-saving a map in the editor updates runtime behavior without manual code edits

### Isometric Runtime

- [ ] **ISO-01**: Runtime renders the map in the same isometric orientation used in the editor
- [ ] **ISO-02**: Runtime uses exported map width, height, tile width, and tile height as the source of truth
- [ ] **ISO-03**: Runtime preserves correct world positioning for tiles and gameplay anchors on the isometric grid

### Layers

- [ ] **LAYR-01**: `ground` acts as the base visual and structural map layer in runtime
- [ ] **LAYR-02**: `paths` defines gameplay movement routes and route-related map meaning
- [ ] **LAYR-03**: `cam` defines camera-rail behavior when present, with stable fallback rules when absent
- [ ] **LAYR-04**: `spawn` defines enemy or unit entry points in the runtime map
- [ ] **LAYR-05**: `citadel` defines the main base/goal location in the runtime map
- [ ] **LAYR-06**: `zones` defines gameplay zones such as restricted, buildable, or trigger areas
- [ ] **LAYR-07**: `decor` remains visual-only and does not silently affect gameplay logic

### Camera

- [ ] **CAM-01**: Runtime applies exported camera zoom, start position, road offset, and movement mode
- [ ] **CAM-02**: Runtime applies exported camera bounds and camera rail behavior exactly as saved by the editor
- [ ] **CAM-03**: Editor game-mode preview matches runtime camera behavior closely enough for map tuning to be trustworthy

### Runtime Interpretation

- [ ] **RUN-01**: Runtime interprets gameplay-relevant layers consistently from one map load to the next
- [ ] **RUN-02**: Runtime exposes spawn, citadel, path, and camera information from map data instead of hardcoded values
- [ ] **RUN-03**: Runtime renders or represents exported entities in a way that preserves their gameplay meaning

## v2 Requirements

### Gameplay Expansion

- **GAME-01**: Units can traverse the map using the final path and zone rules
- **GAME-02**: Combat, waves, or tower-defense systems react to map-defined anchors and areas
- **GAME-03**: Runtime supports richer asset-backed entities beyond placeholder markers

### Tooling

- **TOOL-01**: Editor validates layer misuse before save
- **TOOL-02**: Runtime exposes richer map-debug visualization for designers

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full combat and progression systems in v1 | The current project focus is the map runtime and layer behavior foundation |
| Server-hosted editor runtime dependency | The game must depend on exported map data, not editor presence |
| A second runtime-only map format | A single map contract is required to keep editor/runtime parity trustworthy |
| Premature migration to a heavier game engine | Current priority is stabilizing map semantics and runtime behavior |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MAP-01 | Phase 1 | Pending |
| MAP-02 | Phase 1 | Pending |
| MAP-03 | Phase 1 | Pending |
| MAP-04 | Phase 1 | Pending |
| ISO-01 | Phase 2 | Pending |
| ISO-02 | Phase 2 | Pending |
| ISO-03 | Phase 2 | Pending |
| LAYR-01 | Phase 2 | Pending |
| LAYR-02 | Phase 4 | Pending |
| LAYR-03 | Phase 3 | Pending |
| LAYR-04 | Phase 4 | Pending |
| LAYR-05 | Phase 4 | Pending |
| LAYR-06 | Phase 4 | Pending |
| LAYR-07 | Phase 2 | Pending |
| CAM-01 | Phase 3 | Pending |
| CAM-02 | Phase 3 | Pending |
| CAM-03 | Phase 3 | Pending |
| RUN-01 | Phase 1 | Pending |
| RUN-02 | Phase 4 | Pending |
| RUN-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap traceability mapping*
