---
phase: 04-boss-negotiation-mechanic
plan: "03"
subsystem: negotiation-overlay
tags: [tdd, dom, overlay, boss, negotiation]
dependency_graph:
  requires: [04-01]
  provides: [NegotiationOverlay, NegotiationCallbacks]
  affects: [src/screens/NegotiationOverlay.ts, src/screens/NegotiationOverlay.test.ts]
tech_stack:
  added: []
  patterns: [tdd, dom-component, idempotent-mount, inline-style-guard]
key_files:
  created:
    - src/screens/NegotiationOverlay.ts
    - src/screens/NegotiationOverlay.test.ts
  modified: []
decisions:
  - "Overlay appended to document.body (not container param) matching HudOverlay.showWinLossOverlay idiom"
  - "Inline style injected to document.head with STYLE_ID guard to avoid duplicate injection"
  - "unmount() clears both this.el ref and removes by id as safety fallback (same pattern as HudOverlay)"
metrics:
  duration_seconds: 92
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_modified: 2
---

# Phase 4 Plan 03: NegotiationOverlay DOM Modal Summary

**One-liner:** Self-contained DOM overlay presenting boss negotiation choices (Offer tribute / Defy it) with jsdom-tested callbacks and idempotent mount following the HudOverlay pattern.

## What Was Built

### Task 1 (TDD RED): Failing test suite for NegotiationOverlay (commit: 4b4ca51)

- Created `src/screens/NegotiationOverlay.test.ts` with 8 jsdom tests covering all BOSS-02 behaviors
- Tests verified to fail before implementation existed
- Coverage: mount creates body element, two buttons present with correct text, offer fires onSuccess, defy fires onFailure, both buttons unmount the overlay, unmount() removes element, double-mount idempotent

### Task 2 (TDD GREEN): NegotiationOverlay implementation (commit: 15a6382)

- Created `src/screens/NegotiationOverlay.ts` exporting `NegotiationCallbacks` type and `NegotiationOverlay` class
- `mount(container, cbs)`: idempotent guard via `document.getElementById(OVERLAY_ID)`, appends to `document.body`
- `unmount()`: removes element and clears internal ref, id-based fallback removal
- `ensureStyle()`: injects `<style id="vk-neg-style">` once into `document.head`
- Styling: position:fixed, full viewport inset:0, z-index:120, dark semi-transparent backdrop, amber/gold border panel matching vk- design language
- Boss name "Devourer of Worlds", parley rune label, flavor text, two action buttons with ids `vk-neg-offer` and `vk-neg-defy`
- All 8 tests pass; full suite 150 passed (6 pre-existing failures unrelated to this plan)

## Decisions Made

- **Overlay appends to document.body:** Follows the `HudOverlay.showWinLossOverlay` idiom exactly. The `container` parameter is accepted for API consistency but the overlay always mounts to body for full-viewport coverage.
- **Inline style with STYLE_ID guard:** `ensureStyle()` checks for `vk-neg-style` before injecting, preventing duplicate `<style>` tags on repeated mount/unmount cycles.
- **unmount() double-clear:** `this.el?.remove()` handles the normal case; `document.getElementById(OVERLAY_ID)?.remove()` is the safety fallback matching HudOverlay.unmount() behavior.

## Deviations from Plan

None — plan executed exactly as written.

## Pre-Existing Test Failures (Out of Scope)

The following failures were present before this plan and are not caused by these changes:

- `HudOverlay.test.ts`: "writes citadel health values into the lower panel" and "renders crystal values in the lower deck" (pre-existing)
- `UnitSystemRuntime.test.ts`: "spawns ally units from authored ally path" (pre-existing)

These were documented in 04-01-SUMMARY.md and remain deferred.

## Self-Check: PASSED

Files confirmed present:
- src/screens/NegotiationOverlay.ts — exports NegotiationOverlay and NegotiationCallbacks
- src/screens/NegotiationOverlay.test.ts — 8 passing tests in describe('NegotiationOverlay')

Commits confirmed:
- 4b4ca51 — test(04-03): add failing tests for NegotiationOverlay
- 15a6382 — feat(04-03): implement NegotiationOverlay DOM modal
