# Features Research

**Analysis Date:** 2026-03-17
**Milestone Context:** Subsequent milestone focused on the game map as the core runtime system

## Table Stakes

These are the features users will expect if the map system is the product core.

### Map Contract

- Editor saves map data to a stable JSON structure
- Runtime loads the saved map without manual intervention
- Re-saving a map updates runtime behavior consistently

### Layer Semantics

- Each layer has one clear gameplay meaning
- Runtime knows which layers are visual, logical, or camera-related
- Layer behavior is stable between editor and game

### Isometric Runtime

- Runtime renders the map in the same isometric orientation used during editing
- Tile size, map size, and placement rules match exported data
- Camera movement respects the same world space and projection assumptions as the editor

### Camera Behavior

- Runtime honors saved zoom, start position, bounds, rails, and offsets
- Camera movement is constrained exactly as saved in map data
- Editor game-mode preview is trustworthy

### Gameplay Anchors In Map Data

- Spawn points are defined by the map
- Citadel/base location is defined by the map
- Paths and camera rails are map-driven, not hardcoded in runtime

## Differentiators

These would make the map system stronger than a basic level viewer.

- Layer-aware validation before save
- Runtime debug overlays showing how each layer affects behavior
- Direct parity between editor preview and live runtime behavior
- Rich asset-backed entities exported cleanly from editor to runtime
- Strong support for map-first gameplay iteration before full combat systems exist

## Anti-Features

These are attractive distractions that do not help the current core value.

- Rebuilding around a heavy engine before map semantics are stable
- Creating a second runtime-only map format
- Letting runtime logic drift away from editor camera behavior
- Treating decor, logic, navigation, and camera data as one undifferentiated layer
- Pushing full combat systems before the map contract is trusted

## Complexity Notes

- **Low to medium:** map loading, layer rendering, save/load parity
- **Medium:** stable layer semantics, spawn/citadel integration, asset-backed entities
- **High:** camera parity, movement/path rules, large-map performance, gameplay systems that consume layer logic

## Dependency Notes

- Layer semantics must be defined before gameplay systems can safely depend on them
- Camera parity must be reliable before map tuning becomes trustworthy
- Runtime-safe asset references for entities are needed before full entity rendering is done
- Requirements for waves, movement, or build zones depend on stable `paths`, `spawn`, `citadel`, and `zones`

## Official Reference Signals

- Tiled layer docs highlight layers as containers for both rendering and gameplay-relevant map information: https://doc.mapeditor.org/en/stable/manual/layers/
- Tiled JSON docs reinforce array-driven tile-layer contracts that serialize predictably: https://doc.mapeditor.org/en/stable/reference/json-map-format/
- Phaser tilemap docs show the common split between map data and rendered layers: https://docs.phaser.io/api-documentation/3.88.2/class/tilemaps-tilemap

## Recommendation

For v1, treat the product as a **trusted isometric map runtime** with clear layer behavior. Build around table stakes first:

1. Stable map JSON contract
2. Stable layer semantics
3. Stable editor/runtime camera parity
4. Stable gameplay anchors from map data

---
*Features research completed: 2026-03-17*
