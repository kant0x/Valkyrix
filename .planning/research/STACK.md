# Stack Research

**Analysis Date:** 2026-03-17
**Milestone Context:** Subsequent milestone on top of an existing editor + runtime codebase

## Recommended v1 Stack

### Core Runtime

- **TypeScript 5.x** for runtime logic and shared math
- **Vite 6.x** for dev server, static asset handling, and production builds
- **HTML5 Canvas 2D** for the current map runtime, camera, and isometric drawing
- **JSON map contract** as the runtime boundary between editor and game

### Editor / Runtime Relationship

- Keep the **editor** as the authoring tool
- Keep the **game runtime** as a separate consumer of exported map data
- Keep **shared camera/math utilities** in shared modules so editor and runtime use the same formulas

### Asset Handling

- Serve tile and map assets as static files under `public/assets/`
- Keep `active-map.json` as the current runtime entry point
- Prefer explicit runtime-safe asset references over editor-only metadata

## Why This Stack Fits

- The current codebase already uses `TypeScript`, `Vite`, and static assets successfully
- The project's immediate value is map correctness, not engine migration
- A custom runtime keeps the contract transparent while the layer model is still being defined
- The browser stack is lightweight enough for fast iteration on editor/runtime parity

## What Not To Add Yet

- **Do not migrate to a full game engine yet** just to render the map. Phaser and Pixi can help later, but early migration would slow down contract stabilization.
- **Do not add a second runtime map format**. The editor export should remain the single contract.
- **Do not make the runtime depend on editor internals** beyond shared math/helpers intentionally extracted for both sides.

## When To Reconsider The Stack

Re-evaluate the rendering layer when one of these becomes true:

- Large maps or many entities cause visible frame drops
- You need batching/culling beyond what the current Canvas 2D path handles cleanly
- Runtime needs richer scene graph behavior than the current custom renderer can support

At that point, evaluate:

- **PixiJS 8** for render performance and culling in large scrollable scenes
- **Phaser 3 tilemaps** if the project evolves toward a fuller scene/gameplay framework

## Current Project Anchors

- `package.json` uses `vite` and `typescript`
- `src/main.ts` contains the current game runtime
- `src/shared/CameraMath.ts` holds shared camera math
- `editor/main.js` remains the map authoring surface
- `public/assets/maps/active-map.json` is the runtime map entry

## Official Reference Signals

- Tiled JSON map format documents a tile-layer-first JSON model for map data: https://doc.mapeditor.org/en/stable/reference/json-map-format/
- Tiled layer docs reinforce that layers can carry both graphical and non-graphical information: https://doc.mapeditor.org/en/stable/manual/layers/
- Phaser documents isometric Tiled JSON support and tilemap-layer separation: https://docs.phaser.io/phaser-editor/scene-editor/game-objects/tilemap-object
- Phaser camera docs emphasize bounds and scroll constraints as camera behavior, not gameplay logic: https://docs.phaser.io/phaser/concepts/cameras
- PixiJS documents culling as a follow-on optimization for large scrollable scenes: https://pixijs.com/8.x/guides/components/application/culler-plugin
- Vite remains a strong fit for static-asset-heavy browser apps: https://vite.dev/

## Recommendation

For v1 planning, **stay on the existing TypeScript + Vite + Canvas 2D + JSON contract stack** and spend roadmap effort on layer semantics, runtime correctness, entity integration, and map-driven gameplay behavior.

---
*Stack research completed: 2026-03-17*
