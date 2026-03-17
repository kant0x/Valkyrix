# Research Summary

**Analysis Date:** 2026-03-17

## Stack

The current project should stay on its existing browser stack for v1:

- TypeScript
- Vite
- HTML5 Canvas 2D runtime
- JSON map contract
- shared editor/runtime camera math

This stack already fits the real problem: stabilizing map behavior, not migrating to a heavier engine.

## Table Stakes

The product needs to guarantee:

- stable map save/load contract
- stable meaning for each gameplay layer
- stable isometric presentation
- stable camera parity between editor preview and runtime
- map-driven spawn, citadel, path, and camera behavior

## Architecture Direction

The project should be treated as a map-first pipeline:

1. editor authoring
2. export contract
3. runtime ingestion
4. layer interpretation
5. gameplay systems on top

The runtime must consume exported map data directly, not reconstruct behavior from editor-only state.

## Biggest Risks

- editor/runtime drift
- ambiguous layer semantics
- dual sources of truth
- incomplete runtime export for entities
- premature engine migration
- silent save-format churn

## Planning Implication

Roadmap phases should prioritize:

1. map contract and layer semantics
2. runtime interpretation of map data
3. entity/runtime export completeness
4. gameplay systems that depend on the map

## Recommendation

Plan the project around this principle:

**The game map is the core runtime system, not just the background.**

---
*Research summary completed: 2026-03-17*
