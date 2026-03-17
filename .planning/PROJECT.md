# Valkyrix

## What This Is

Valkyrix is an isometric game-map runtime and authoring workflow built around a dedicated editor and a game client that consumes exported map data. The project's current focus is making the game map itself behave correctly in runtime: layers, isometric layout, movement paths, camera rails, bounds, and saved map state must work as one coherent system.

The editor remains the authoring tool, while the game runtime reads the exported map and reproduces the same gameplay-relevant behavior without depending on the editor UI being present on the server.

## Core Value

An edited map must load in the game and behave exactly as designed: same isometric structure, same layer meaning, same movement logic, and the same camera behavior after every save.

## Requirements

### Validated

- ✓ Isometric map editor exists and supports layered map authoring — existing
- ✓ Map data is saved as JSON and can be activated through `active-map.json` — existing
- ✓ Runtime loads exported map data and renders the map in the game client — existing
- ✓ Camera runtime reproduces saved game-mode behavior from map data — existing

### Active

- [ ] Define and stabilize the gameplay meaning of all runtime map layers
- [ ] Make the map the central runtime system for movement, spawn, citadel, and camera behavior
- [ ] Expand the runtime so game entities fully use exported layer and map data

### Out of Scope

- Full game progression beyond the map system — deferred until map runtime and layer semantics are stable
- Requiring the editor to run on the production server — rejected because the runtime must depend on exported data only
- Divergent editor and runtime camera logic — rejected because map behavior must stay identical after save/load cycles

## Context

The codebase already contains a brownfield foundation: a browser-based map editor, asset pipeline, map save/activate flow, and a rebuilt game runtime that now consumes `active-map.json`. The map is isometric and organized around gameplay-relevant layers including `ground`, `paths`, `cam`, `zones`, `decor`, `citadel`, and `spawn`.

The current project direction is not "build a generic game," but specifically "make the game map work correctly as the core runtime system." The essential behaviors are:

- The map is authored in the editor and exported as JSON.
- The editor is the source of truth for map content and runtime camera settings.
- The game reads exported map data and reproduces the same camera rails, bounds, movement constraints, and isometric presentation.
- Re-saving the map in the editor should update runtime behavior without manual code edits.

The current stack is a lightweight web client using Vite and TypeScript for the game runtime, with the editor and runtime sharing camera math. The repo already has a codebase map in `.planning/codebase/` describing stack, architecture, conventions, testing state, integrations, and concerns.

## Constraints

- **Runtime Contract**: The game must consume exported JSON map data — the editor cannot be a runtime dependency on the server
- **Behavior Parity**: Camera rails, bounds, offsets, and movement behavior must match editor game mode — otherwise saved maps become untrustworthy
- **Layer Semantics**: Layer meaning must stay stable across editor and runtime — changes ripple through map authoring and gameplay logic
- **Brownfield Codebase**: New planning must build on the existing editor/runtime foundation — not restart from a greenfield architecture
- **Static Assets**: Maps and assets are served as client-side resources — save/export flow must remain compatible with current asset layout

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep the editor as the source of truth for maps | Authoring and save/export logic already exist there | ✓ Good |
| Use exported map JSON as the runtime contract | This lets the game run independently from the editor UI/server presence | ✓ Good |
| Treat layer behavior as the center of the project | The user identified layer behavior as the essence of the game map work | — Pending |
| Share camera math between editor and runtime | Prevents drift between saved camera behavior and in-game camera behavior | ✓ Good |
| Build the game around map behavior first, wider gameplay second | The map system must be trustworthy before higher-level systems can safely depend on it | — Pending |

---
*Last updated: 2026-03-17 after initialization*
