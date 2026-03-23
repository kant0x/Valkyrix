# Phase 4: Boss — Negotiation Mechanic - Research

**Researched:** 2026-03-23
**Domain:** Game state machine extension, modal dialog UI, TypeScript class patterns
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOSS-01 | Босс появляется на карте по триггеру (событие волны или условие) | WaveController already spawns `boss-enemy` via `boss` table entry on wave 5+; trigger hook exists in `enqueueWave`. Need: detection of boss unit entering field to fire negotiation event. |
| BOSS-02 | Игроку показывается диалог-переговоры с вариантами ответа | Existing overlay pattern in HudOverlay (`showWinLossOverlay`) shows the idiom: createElement, append to `document.body`, cleanup on destroy. A `NegotiationOverlay` class following that exact pattern is the right approach. |
| BOSS-03 | Успешные переговоры: босс уходит, игрок получает баффы | GameState carries `resources`, `citadelHp`, and can store active buffs. Boss unit removal = filter from `state.units`. Buff application = mutate relevant fields. |
| BOSS-04 | Провал переговоров: босс злой, призывает орду, боёвка усиливается | WaveController's `spawnQueue` mechanism already handles deferred enemy spawning. An enraged boss calling a horde = push entries into `state.spawnQueue`. The boss itself stays on-field with a powerScale bump. |
</phase_requirements>

---

## Summary

Phase 4 builds the Boss — Negotiation Mechanic entirely within the existing systems. No new runtime library is needed. The boss unit type (`boss-enemy`, role `'boss'`) is already defined in `UNIT_DEFS` with hp=260, speed=22, damage=18 and the `WaveController` already enqueues one on wave 5+ via the `boss` table key. What is missing is: (1) a detection layer that notices when a living boss unit reaches the field and fires a `negotiation` event, (2) a `NegotiationOverlay` DOM component that follows the HudOverlay/EscMenuOverlay class pattern, (3) a `BossSystem` that can pause the combat loop (via `state.phase = 'negotiation'`), broker the two outcome paths, and resume or escalate combat accordingly.

The key architectural decision is where the game loop pauses. The existing `CombatSystem.update` and `WaveController.update` both early-return when `state.phase !== 'playing'`. Adding `'negotiation'` to the `GameState.phase` union is sufficient to freeze enemy AI and wave spawning while the dialog is open. `UnitSystem.update` has no phase guard and will need one added (or the boss-movement sub-path guarded) so the boss holds its position during negotiation.

The two outcome paths are straightforward state mutations: success removes the boss unit from `state.units` and applies resource/buff rewards; failure re-flags the boss unit as enraged (a flag on `Unit`), pushes a horde batch into `state.spawnQueue`, and resumes `state.phase = 'playing'`. The UI overlay is a plain DOM class (no framework, matching the project's existing pattern).

**Primary recommendation:** Add `'negotiation'` to the `GameState.phase` union, create `BossSystem` that detects boss-on-field and manages the state machine, create `NegotiationOverlay` DOM class, wire both into the `GameScreen`/`main.ts` rAF loop exactly as the existing systems are wired.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.7.2 (project) | Type-safe game state extensions | Already in use; all existing systems are `.ts` |
| Vitest | ^4.1.0 (project) | Unit tests for BossSystem logic | Already in use; all existing systems have `.test.ts` companions |
| jsdom | ^29.0.0 (project) | DOM environment for overlay tests | Already in vitest.config.ts `environment: 'jsdom'` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | Phase 4 adds zero new npm dependencies |

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── game/
│   ├── BossSystem.ts          # new — boss detection + negotiation state machine
│   ├── BossSystem.test.ts     # new — unit tests
│   ├── game.types.ts          # extend: phase union, BossNegotiationState, enraged flag
│   └── WaveController.ts      # no change required (boss already enqueued)
└── screens/
    ├── NegotiationOverlay.ts  # new — modal dialog DOM class
    ├── NegotiationOverlay.test.ts  # new — jsdom tests
    ├── GameScreen.ts          # extend: wire BossSystem + NegotiationOverlay
    └── HudOverlay.ts          # minor: handle 'negotiation' phase in update guard
```

### Pattern 1: Phase-Gated Game Loop (existing idiom)
**What:** Systems early-return when `state.phase` is not `'playing'`. Adding `'negotiation'` to the phase union pauses all combat logic without touching the rAF loop.
**When to use:** Any time a modal interruption must freeze game logic while keeping the canvas rendering alive.
**Example:**
```typescript
// Matches existing pattern in CombatSystem.ts and WaveController.ts
update(dt: number, state: GameState): void {
  if (state.phase !== 'playing') return;
  // ... rest of logic
}
```

### Pattern 2: BossSystem State Machine
**What:** `BossSystem` is a stateful class (like `BuildingSystem`, `CombatSystem`) with an `update(dt, state)` method called in the rAF loop. It owns the negotiation event lifecycle.
**When to use:** Any game-event that spans multiple frames and requires cleanup.
**Example:**
```typescript
// Source: derived from existing CombatSystem.ts and BuildingSystem.ts structure
export class BossSystem {
  private negotiationActive = false;
  private overlay: NegotiationOverlay | null = null;

  update(dt: number, state: GameState, overlayContainer: HTMLElement): void {
    if (this.negotiationActive) return;
    if (state.phase !== 'playing') return;

    const boss = state.units.find(u => u.def.role === 'boss' && u.faction === 'enemy' && u.hp > 0);
    if (!boss || boss.def.enraged) return;

    // Boss has entered the field — trigger negotiation
    state.phase = 'negotiation';
    this.negotiationActive = true;
    this.overlay = new NegotiationOverlay();
    this.overlay.mount(overlayContainer, {
      onSuccess: () => this.handleSuccess(state),
      onFailure: () => this.handleFailure(state, boss),
    });
  }

  private handleSuccess(state: GameState): void {
    state.units = state.units.filter(u => u.def.role !== 'boss' || u.faction !== 'enemy');
    state.resources += NEGOTIATION_RESOURCE_REWARD;
    // Apply buff: e.g. boost citadel HP
    state.citadelHp = Math.min(state.citadelMaxHp, state.citadelHp + NEGOTIATION_HP_REWARD);
    state.phase = 'playing';
    this.cleanup();
  }

  private handleFailure(state: GameState, boss: Unit): void {
    boss.def = { ...boss.def, enraged: true, damage: Math.round(boss.def.damage * 1.5) };
    this.enqueueHorde(state);
    state.phase = 'playing';
    this.cleanup();
  }
}
```

### Pattern 3: NegotiationOverlay DOM Class (HudOverlay idiom)
**What:** Plain DOM class with `mount(container, callbacks)` and `unmount()`. Renders into `document.body` with `position:fixed` overlay, exactly like `showWinLossOverlay` in HudOverlay.
**When to use:** All modal overlays in this codebase.
**Example:**
```typescript
// Source: derived from HudOverlay.ts showWinLossOverlay pattern
const OVERLAY_ID = 'vk-negotiation-overlay';

export type NegotiationCallbacks = {
  onSuccess: () => void;
  onFailure: () => void;
};

export class NegotiationOverlay {
  private el: HTMLElement | null = null;

  mount(container: HTMLElement, cbs: NegotiationCallbacks): void {
    if (document.getElementById(OVERLAY_ID)) return;
    this.el = document.createElement('div');
    this.el.id = OVERLAY_ID;
    this.el.innerHTML = `
      <div class="vk-neg-panel">
        <div class="vk-neg-title">Devourer of Worlds</div>
        <p class="vk-neg-body">A dark intellect stands before the Citadel. It speaks:</p>
        <div class="vk-neg-choices">
          <button id="vk-neg-offer" type="button">Offer tribute</button>
          <button id="vk-neg-defy" type="button">Defy it</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.el);
    this.el.querySelector('#vk-neg-offer')?.addEventListener('click', () => {
      this.unmount();
      cbs.onSuccess();
    });
    this.el.querySelector('#vk-neg-defy')?.addEventListener('click', () => {
      this.unmount();
      cbs.onFailure();
    });
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
    document.getElementById(OVERLAY_ID)?.remove();
  }
}
```

### Anti-Patterns to Avoid
- **Polling for boss in rAF without a guard flag:** `BossSystem.update` will re-trigger every frame after boss is spawned unless `negotiationActive` flag or boss enrage flag is checked. Must gate on both.
- **Mutating `boss.def` directly in `UNIT_DEFS`:** `boss.def` on a `Unit` is a reference. Mutating `UNIT_DEFS['boss-enemy']` would affect all future spawns. Always spread: `boss.def = { ...boss.def, damage: newVal }`.
- **Forgetting `UnitSystem` has no phase guard:** Unlike `CombatSystem` and `WaveController`, `UnitSystem.update` has no `if (state.phase !== 'playing') return`. During `'negotiation'` phase, boss will continue to move unless `UnitSystem` is patched or boss unit is put in `'fighting'` state temporarily.
- **Appending overlay to `hudSlotEl` instead of `document.body`:** The negotiation overlay must cover the full viewport. HudOverlay's win/loss overlay appends to `document.body` — follow that same convention.
- **Missing `unmount` cleanup:** Overlay event listeners are attached to DOM nodes. Always call `unmount()` in both outcome handlers and in GameScreen's `unmount()` path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Game loop pause | Custom pause/resume mechanism | Set `state.phase = 'negotiation'`; existing guards cover it | CombatSystem and WaveController already return early on non-'playing' phase |
| Deferred unit spawning | Custom horde queue | Push into `state.spawnQueue` with `delay` values | UnitSystem already drains `spawnQueue` each tick |
| Overlay backdrop/focus trap | Custom DOM scaffolding | Follow HudOverlay `showWinLossOverlay` idiom (createElement, fixed position, body append) | Consistent with codebase; already tested pattern |
| Boss power scaling | Custom formula | `buildSpawnDef(def, powerScale)` in UnitSystem already scales hp/damage/speed | The formula is locked in UnitSystem internals |

**Key insight:** Every mechanism Phase 4 needs (pause, spawn queue, DOM overlay, power scaling) already exists in the codebase. Phase 4 is wiring these together, not building new primitives.

---

## Common Pitfalls

### Pitfall 1: UnitSystem Has No Phase Guard
**What goes wrong:** During `'negotiation'` phase, the boss unit keeps marching toward the citadel. If it reaches `'attacking-base'` state before the negotiation dialog appears, the citadel takes damage while the player is in a frozen dialog.
**Why it happens:** `UnitSystem.update` has no `if (state.phase !== 'playing') return` — by design, since ally collectors need to keep orbiting during pauses. Only `CombatSystem` and `WaveController` guard on phase.
**How to avoid:** In `BossSystem.handleNegotiationTrigger`, set `boss.state = 'fighting'` and `boss.fightingWith = null` before setting `state.phase = 'negotiation'`. This prevents UnitSystem from advancing the boss. Restore `boss.state = 'moving'` on failure outcome only.
**Warning signs:** Citadel HP drops during negotiation dialog.

### Pitfall 2: Re-triggering Negotiation on Enraged Boss
**What goes wrong:** After failure outcome the boss is still alive on the field. Next frame, `BossSystem.update` detects it again and re-opens the dialog.
**Why it happens:** The detection check `unit.def.role === 'boss'` is still true after failure.
**How to avoid:** After failure, set an `enraged` flag on the unit (`boss.def = { ...boss.def, enraged: true }`) and in `BossSystem.update` skip units where `boss.def.enraged === true`. Add `enraged?: boolean` to `UnitDef` type.
**Warning signs:** Dialog opens again immediately after clicking "Defy".

### Pitfall 3: `state.phase` Left as `'negotiation'` on GameScreen Unmount
**What goes wrong:** Player hits ESC → navigates away → re-enters GameScreen. `state.phase` is still `'negotiation'`, so no waves start and game appears frozen.
**Why it happens:** `resetRuntimeState()` in `GameScreen.mount` resets state, but only if the overlay's `unmount()` doesn't reset the phase before the screen teardown.
**How to avoid:** Call `bossSystem.forceReset()` in `GameScreen.unmount()` / `onBeforeUnmount`. `forceReset` sets `negotiationActive = false`, calls `overlay?.unmount()`, sets `state.phase = 'playing'` (only if currently `'negotiation'`).
**Warning signs:** Entering GameScreen a second time results in no waves spawning.

### Pitfall 4: Win/Loss Condition Races With Negotiation Phase
**What goes wrong:** `CombatSystem.checkWinLoss` fires while boss is still alive but negotiation is open. Since `state.phase !== 'playing'`, the early return guards prevent this — but only if `CombatSystem` guards correctly. Confirm that the early return is at the top of `update`, not inside `checkWinLoss` specifically.
**Why it happens:** `CombatSystem.update` guards on `state.phase !== 'playing'` and returns early — negotiation phase is safe. No change needed.
**Warning signs:** Game transitions to 'won' while negotiation dialog is still visible.

### Pitfall 5: Boss Wave 5 Overlap — Boss Spawns With Normal Enemies
**What goes wrong:** Wave 5 in `WaveController` enqueues 15 light-enemy + 10 heavy-enemy + 9 ranged-enemy AND 1 boss-enemy at the end. The boss appears after a large normal wave. The negotiation should trigger only when the boss unit is live on the map, not immediately on wave 5 announcement.
**Why it happens:** The boss is queued with a `delay` offset after all regular enemies. By the time the boss spawns, there are still many normal enemies alive. This is actually correct behavior — boss arrives mid-battle.
**How to avoid:** `BossSystem` must detect a living boss unit in `state.units`, not a wave number. The trigger condition is `state.units.find(u => u.def.role === 'boss' && u.hp > 0)`, not wave number. During negotiation, normal combat continues (enemies still move and fight) but wave spawning pauses. This is the intended experience. Document this clearly in the plan.
**Warning signs:** Dialog fires before any normal enemies of the wave have appeared.

---

## Code Examples

### Extending GameState.phase Union
```typescript
// Source: game.types.ts — add 'negotiation' to the existing union
export interface GameState {
  phase: 'playing' | 'paused' | 'won' | 'lost' | 'negotiation'; // ADD 'negotiation'
  // ... rest unchanged
}
```

### Extending UnitDef for Enraged Flag
```typescript
// Source: game.types.ts — add optional field to UnitDef
export interface UnitDef {
  // ... existing fields ...
  enraged?: boolean;  // set true after failed negotiation; prevents re-trigger
}
```

### New BossNegotiationState in GameState (optional — or keep in BossSystem class)
```typescript
// Option A: put negotiation metadata in GameState for test visibility
export interface BossNegotiationState {
  active: boolean;
  triggered: boolean;   // true = negotiation has fired this game (prevent re-fire)
  outcome?: 'success' | 'failure';
}

// Add to GameState:
bossNegotiation?: BossNegotiationState;
```

### Horde Spawn on Failure
```typescript
// Source: derived from WaveController.enqueueWave pattern
private enqueueHorde(state: GameState): void {
  const HORDE: Record<string, number> = {
    'light-enemy': 12,
    'heavy-enemy': 6,
    'ranged-enemy': 4,
  };
  let delay = 1.0; // give player 1s to react before horde arrives
  for (const [defKey, count] of Object.entries(HORDE)) {
    for (let i = 0; i < count; i++) {
      state.spawnQueue.push({
        defKey,
        delay,
        powerScale: 1.4,  // horde is harder than wave 5 normal enemies
      });
      delay += 0.4;
    }
  }
}
```

### Success Buff Application
```typescript
// Source: ResourceSystem.ts pattern — direct mutation on GameState
private applySuccessBuffs(state: GameState): void {
  const RESOURCE_REWARD = 120;
  const CITADEL_HEAL = 400;
  state.resources += RESOURCE_REWARD;
  state.citadelHp = Math.min(state.citadelMaxHp, state.citadelHp + CITADEL_HEAL);
  // Optional: grant a temporary wave skip (extend waveTimer)
  state.waveTimer = Math.max(state.waveTimer, 20); // guarantee 20s before next wave
}
```

### Wiring BossSystem into Main rAF Loop
```typescript
// Source: derived from GameScreen.ts + main.ts wiring in Phase 3
// In main.ts / game loop, alongside existing system.update calls:
bossSystem.update(dt, state, container);  // container = layout.hudSlotEl or document.body
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No boss detection | Boss spawned via WaveController `boss` table key; detection = `state.units.find(role === 'boss')` | Phase 4 | Negotiation trigger is a runtime detection, not a scheduled event |
| phase = 'playing' \| 'paused' \| 'won' \| 'lost' | Add 'negotiation' | Phase 4 | All existing phase guards work for free; UnitSystem needs one guard added |
| HudOverlay owns win/loss overlay | NegotiationOverlay is its own class, not embedded in HudOverlay | Phase 4 | Clean separation of concerns; each modal is its own file |

**Deprecated/outdated:**
- Nothing from Phase 3 is removed. Phase 4 is strictly additive.

---

## Open Questions

1. **Should negotiation pause ALL unit movement or only block new spawns?**
   - What we know: `CombatSystem` and `WaveController` both guard on `'playing'`. `UnitSystem` does not.
   - What's unclear: Design intent — does normal combat pause entirely (cinematic) or only wave spawning (boss waits while fight continues)?
   - Recommendation: Set `boss.state = 'fighting'` to freeze the boss. Leave all other units moving (normal combat continues). This avoids patching `UnitSystem` and feels more natural — the boss "stops to parley" while the battle rages around it. Planner should document this choice explicitly.

2. **How many and what dialog options are presented?**
   - What we know: Phase description says "два варианта ответа" (two choices: negotiate or fight).
   - What's unclear: Whether there is a skill check, resource cost, or random element to success.
   - Recommendation: Start with two buttons (offer tribute / defy). No randomness — player choice determines outcome. Defer probability mechanics to a future phase.

3. **What specific buffs does the player receive on success?**
   - What we know: BOSS-03 says "игрок получает баффы" — no specific values defined yet.
   - What's unclear: Whether buffs are resources, HP, unit quality boost, or temporary speed multiplier.
   - Recommendation: Planner should decide concrete values: +120 resources + 400 citadel HP heal + 20s wave timer extension. These can be tuned in constants, not hardcoded.

4. **Is there a horde size and power scale for the failure path?**
   - What we know: BOSS-04 says "призывает орду юнитов, боёвка усиливается" — no numbers.
   - What's unclear: Exact horde composition and powerScale.
   - Recommendation: Use `{ 'light-enemy': 12, 'heavy-enemy': 6, 'ranged-enemy': 4 }` at `powerScale: 1.4` — harder than a normal wave 5 but not impossible. Put in constants for tuning.

5. **Does the boss respawn if it is killed during/after negotiation failure?**
   - What we know: WaveController repeats wave 5 config for wave 6+, which includes a boss.
   - What's unclear: Is each wave 5+ spawn a new negotiation attempt or only the first?
   - Recommendation: Negotiation fires only once per session (`triggered: true` persists in `bossNegotiation` state). Subsequent boss spawns on waves 6+ are just normal combat units with no dialog.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npx vitest run src/game/BossSystem.test.ts src/screens/NegotiationOverlay.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOSS-01 | BossSystem detects boss unit in state.units and triggers negotiation phase | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-01 | BossSystem does NOT re-trigger if boss is enraged or negotiation already triggered | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-02 | NegotiationOverlay mounts and unmounts correctly in jsdom | unit | `npx vitest run src/screens/NegotiationOverlay.test.ts` | ❌ Wave 0 |
| BOSS-02 | NegotiationOverlay renders two choice buttons | unit | `npx vitest run src/screens/NegotiationOverlay.test.ts` | ❌ Wave 0 |
| BOSS-03 | handleSuccess removes boss from state.units | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-03 | handleSuccess credits resources and heals citadel HP | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-03 | handleSuccess restores state.phase to 'playing' | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-04 | handleFailure marks boss as enraged and increases damage | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-04 | handleFailure pushes horde entries into state.spawnQueue | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-04 | handleFailure restores state.phase to 'playing' | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-01–04 | Full negotiation flow visible in running game (boss appears, dialog shows, both outcomes work) | manual | human verification checkpoint | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run src/game/BossSystem.test.ts src/screens/NegotiationOverlay.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/game/BossSystem.ts` — BossSystem class (does not exist yet)
- [ ] `src/game/BossSystem.test.ts` — covers BOSS-01, BOSS-03, BOSS-04
- [ ] `src/screens/NegotiationOverlay.ts` — NegotiationOverlay class (does not exist yet)
- [ ] `src/screens/NegotiationOverlay.test.ts` — covers BOSS-02

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/game/game.types.ts` — existing `UnitDef`, `Unit`, `GameState` interfaces, `UNIT_DEFS['boss-enemy']`
- Direct code inspection: `src/game/WaveController.ts` — `WAVE_TABLE[4]` shows `boss: { 'boss-enemy': 1 }` on wave 5
- Direct code inspection: `src/game/CombatSystem.ts` — `if (state.phase !== 'playing') return` phase guard pattern
- Direct code inspection: `src/screens/HudOverlay.ts` — `showWinLossOverlay` method as overlay DOM idiom
- Direct code inspection: `src/game/UnitSystemRuntime.ts` — confirmed NO phase guard at top of `update`
- Direct code inspection: `vitest.config.ts` — `environment: 'jsdom'`, `include: ['src/**/*.test.ts']`
- Direct code inspection: `package.json` — `vitest: ^4.1.0`, `jsdom: ^29.0.0`

### Secondary (MEDIUM confidence)
- `.planning/research/GDD-VALKYRIX.md` — "Mini-Boss: Devourer of Worlds" section describes boss role and tone
- `.planning/REQUIREMENTS.md` — BOSS-01 through BOSS-04 exact requirement text

### Tertiary (LOW confidence)
- None — all findings are from direct code inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; confirmed from package.json
- Architecture patterns: HIGH — derived directly from existing code idioms in UnitSystem, CombatSystem, HudOverlay
- Pitfalls: HIGH — identified by tracing actual control flow through UnitSystem (no phase guard), WaveController (boss re-spawn on wave 6+), BossSystem re-trigger vector
- Open questions: MEDIUM — design values (buff amounts, horde size) are unspecified in requirements; recommendations given as defaults, not locked decisions

**Research date:** 2026-03-23
**Valid until:** 2026-04-22 (stable codebase; no fast-moving external dependencies)
