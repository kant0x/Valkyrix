# Pitfalls Research

**Analysis Date:** 2026-03-17
**Milestone Context:** Subsequent milestone on an existing isometric editor + runtime codebase

## 1. Editor / Runtime Drift

- **Warning signs:** saved maps look correct in editor game mode but behave differently in runtime
- **Impact:** map tuning becomes untrustworthy; every save/load cycle creates fear
- **Prevention:** keep camera math and behavior rules shared; use exported map fields directly in runtime
- **Phase mapping:** must be addressed in the earliest runtime and contract phases

## 2. Ambiguous Layer Semantics

- **Warning signs:** the same layer is used for both visuals and gameplay, or different code paths interpret layers differently
- **Impact:** impossible to reason about what the map actually means
- **Prevention:** define each layer's runtime meaning once and document it in requirements
- **Phase mapping:** layer-definition phase

## 3. Two Sources of Truth

- **Warning signs:** runtime hardcodes movement, camera, or anchors that are also present in the saved map
- **Impact:** editor changes stop affecting the live game predictably
- **Prevention:** map JSON remains the contract; runtime consumes it, editor produces it
- **Phase mapping:** contract and runtime phases

## 4. Visual Layers Mixed With Logic Layers

- **Warning signs:** `decor`, `ground`, `zones`, `spawn`, and `paths` are handled interchangeably
- **Impact:** accidental gameplay bugs when artists or designers touch visual layers
- **Prevention:** separate visual-only, navigation, camera, and gameplay-logic responsibilities clearly
- **Phase mapping:** requirements and runtime interpretation phases

## 5. Missing Runtime-Safe Entity Asset Paths

- **Warning signs:** entities can be placed in the editor but runtime only receives partial metadata
- **Impact:** runtime falls back to placeholders or loses object meaning
- **Prevention:** export runtime-safe asset references explicitly for buildings, obstacles, and graphics
- **Phase mapping:** entity export/import phase

## 6. Premature Engine Migration

- **Warning signs:** team starts discussing Phaser/Pixi migration before layer semantics and map contract are stable
- **Impact:** roadmap time goes to infrastructure churn instead of product value
- **Prevention:** keep current stack until performance or scene complexity clearly justifies migration
- **Phase mapping:** defer unless profiling proves need

## 7. Large Map Performance Surprises

- **Warning signs:** map size grows, entity count grows, redraw cost spikes, camera stutters
- **Impact:** runtime feels broken even if logic is correct
- **Prevention:** profile redraw cost, track entity rendering load, and isolate possible batching/culling upgrades
- **Phase mapping:** performance hardening phase, not core contract phase

## 8. Save Format Churn

- **Warning signs:** fields are renamed, moved, or repurposed without compatibility handling
- **Impact:** old maps break, active iteration becomes fragile
- **Prevention:** treat map JSON as a versioned contract and change it intentionally
- **Phase mapping:** contract governance and migration support

## Recommendation

The biggest failure mode is not "missing gameplay." It is **losing trust in the map contract**. Every roadmap phase should protect that trust first.

---
*Pitfalls research completed: 2026-03-17*
