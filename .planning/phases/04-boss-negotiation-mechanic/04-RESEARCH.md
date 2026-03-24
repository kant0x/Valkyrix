# Phase 4: Boss — Negotiation Mechanic — Research (REPLANNED)

**Researched:** 2026-03-24
**Domain:** Game state machine, Gemini AI API, DOM overlay, TypeScript
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Босс появляется ровно через **5 минут (300 секунд)** от старта игры (`state.elapsed >= 300`), НЕ через волны — отдельный таймер в GameState
- При появлении: phase → 'negotiation', все юниты замирают (UnitSystem guard)
- Большой робот: высокий HP (~500), поддержка союзников, лечение, высокий урон; роль 'boss', faction 'enemy'
- **Шкала успеха**: 0 → 12; **Старт**: 3 попытки
- **Хороший ответ** (Gemini: good): +4 к шкале
- **Нейтральный ответ** (Gemini: neutral): +2 к шкале, +2 бонусных попытки
- **Плохой ответ** (Gemini: bad): +0 к шкале, попытка сгорает
- Шкала ≥ 12 → успех; попытки = 0 и шкала < 12 → провал
- Модель: `gemini-2.0-flash`; ключ: `import.meta.env.VITE_GEMINI_KEY`
- Системный промпт: Пожиратель Миров, древний босс-робот, величественный, угрожающий
- Нарратив: игрок убеждает босса не забирать Священный Грааль
- Gemini возвращает: ответ босса (1-2 предложения) + JSON `{"outcome":"good"|"neutral"|"bad"}`
- **Успех**: босс уходит, начисляются очки (Phase 5 blockchain), game → 'playing'
- **Провал**: огромная орда сильных врагов (heavy + ranged, НЕ light), boss остаётся enraged
- Полноэкранный overlay поверх body, тёмная тема, стиль как у существующих оверлеев

### Claude's Discretion

- Точный внешний вид шкалы (цвет, анимация заполнения)
- Точный состав орды провала
- Анимация появления/исчезновения оверлея
- Точный системный промпт для Gemini

### Deferred Ideas (OUT OF SCOPE)

- Blockchain транзакция при успехе — Phase 5
- Настоящий спрайт босса-робота — можно добавить позже
- Звуковые эффекты переговоров
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOSS-01 | Босс появляется на карте по триггеру (событие волны или условие) | Timer-based trigger: `state.elapsed >= 300` in BossSystem.update(); `elapsed` field added to GameState; boss unit spawned by BossSystem itself |
| BOSS-02 | Игроку показывается диалог-переговоры с вариантами ответа | NegotiationOverlay rewrite: text input + scale bar (0-12) + attempts counter + boss reply; Gemini API call with 3-outcome JSON |
| BOSS-03 | Успешные переговоры: босс уходит, игрок получает баффы | handleSuccess() in BossSystem: remove boss unit, reward resources/HP, onSuccess callback for Phase 5 hook |
| BOSS-04 | Провал переговоров: босс злой, призывает орду, боёвка усиливается | handleFailure() in BossSystem: enrage boss, enqueueHorde() with heavy+ranged only (NOT light) |
</phase_requirements>

---

## Summary

Phase 4 is a **full rewrite** of three existing components. Plans 04-01, 04-02, and 04-03 were completed against an earlier design (unit-detection trigger, binary Gemini outcome, no scale/attempts system). The **replanning from scratch** means these implementations are being replaced with the CONTEXT.md design. The existing test files (`BossSystem.test.ts`, `NegotiationOverlay.test.ts`) test the old design and must also be rewritten.

**Current state of source files (verified 2026-03-24):**
- `BossSystem.ts`: Uses unit-detection trigger (checks for existing boss unit on field). Does NOT have elapsed timer. Does NOT spawn boss. Does NOT track scale/attempts. Must be fully rewritten.
- `NegotiationOverlay.ts`: Has text input and Gemini fetch. Uses old 2-outcome JSON `{"outcome":"success"|"failure"}`. No scale bar. No attempts counter. Must be fully rewritten.
- `game.types.ts`: Has `BossNegotiationState` with `active/triggered/outcome` fields. Missing `scale` and `attemptsLeft`. Needs targeted extension.
- `GameState.ts`: Missing `elapsed` field in `createGameState()`. Needs one-line addition.
- `main.ts`: Integration point at line 915 (`bossSystem.update(dt, gameState, document.body)`) is correct and does NOT change. Cleanup at line 607 also stays as-is. **The guard at line 908 (`if (gameState && gameState.phase === 'playing')`) wraps all system updates including bossSystem — BossSystem.update() is only called in 'playing' phase, so elapsed timer must be accumulated inside BossSystem itself rather than assuming it always ticks.**

The Gemini fetch pattern is already proven in the existing overlay — endpoint URL, key injection via `(import.meta as any).env?.VITE_GEMINI_KEY`, request body shape, and JSON extraction all work. Only the system prompt and regex pattern change.

**Primary recommendation:** Follow dependency order — extend types first (game.types.ts), add elapsed to GameState, rewrite BossSystem.ts with timer trigger + boss spawn + scale/attempts state machine, rewrite NegotiationOverlay.ts with scale bar + attempts + 3-outcome Gemini, rewrite both test files.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | project tsconfig | Type-safe game state extensions | Already the project language |
| Gemini REST API | gemini-2.0-flash | Boss AI responses | Locked decision; key already configured |
| Vite env | VITE_GEMINI_KEY | API key injection | Already set in .env.local |
| Vitest + jsdom | detected in vitest.config.ts | Unit testing with DOM | Already the project test stack |

### No new dependencies required

All implementation uses native `fetch`, DOM APIs, and existing project types. No npm installs needed.

**Installation:** None required.

---

## Architecture Patterns

### Files to Modify (ordered by dependency)

```
src/game/game.types.ts          — extend BossNegotiationState (add scale, attemptsLeft)
                                   + add elapsed?: number to GameState interface
src/game/GameState.ts           — add elapsed: 0 to createGameState() return object
src/game/BossSystem.ts          — full rewrite (timer trigger, boss spawn, scale/attempts logic)
src/screens/NegotiationOverlay.ts — full rewrite (scale bar, attempts, 3-outcome Gemini)
src/game/BossSystem.test.ts     — full rewrite (new timer/spawn/scale/horde tests)
src/screens/NegotiationOverlay.test.ts — full rewrite (new scale DOM, attempts, mock Gemini)
```

### Critical Constraint: elapsed Timer Scope

The rAF loop in `main.ts` guards all game system updates inside `if (gameState && gameState.phase === 'playing')` (line 908). This means `bossSystem.update()` is NOT called during 'negotiation', 'paused', 'won', or 'lost' phases. Therefore:

- `elapsed` only increments during 'playing' phase — naturally correct by the existing guard
- No additional phase check needed inside BossSystem for elapsed increment
- After negotiation resolves (success or failure), phase returns to 'playing' — elapsed resumes

```typescript
// BossSystem.update() signature stays the same:
update(dt: number, state: GameState, container: HTMLElement | null): void {
  // Called only when state.phase === 'playing' (main.ts guard)
  state.elapsed = (state.elapsed ?? 0) + dt;
  if ((state.elapsed ?? 0) < 300) return;
  if (state.bossNegotiation?.triggered) return;
  // → spawn boss, enter negotiation
}
```

### Pattern 1: Elapsed Timer Trigger + Boss Spawn

**What:** BossSystem.update() accumulates elapsed time and spawns the boss unit itself when the timer fires. Unlike the old design, there is no pre-existing boss unit to detect.

```typescript
// In BossSystem.update() — new design:
update(dt: number, state: GameState, container: HTMLElement | null): void {
  state.elapsed = (state.elapsed ?? 0) + dt;
  if ((state.elapsed ?? 0) < 300) return;
  if (state.bossNegotiation?.triggered) return;

  // Spawn boss at path start
  const bossUnit: Unit = {
    id: state.nextId++,
    def: { ...UNIT_DEFS['boss-enemy'] },
    faction: 'enemy',
    hp: UNIT_DEFS['boss-enemy'].hp,
    pathIndex: 0,
    pathT: 0,
    wx: state.pathNodes[0]?.wx ?? 0,
    wy: state.pathNodes[0]?.wy ?? 0,
    state: 'moving',
    fightingWith: null,
    attackCooldown: 0,
  };
  state.units.push(bossUnit);

  state.phase = 'negotiation';
  state.bossNegotiation = { active: true, triggered: true, scale: 0, attemptsLeft: 3 };
  this.negotiationActive = true;

  if (container) {
    this.overlay = new NegotiationOverlay();
    this.overlay.mount(container, {
      onSuccess: () => this.handleSuccess(state),
      onFailure: () => this.handleFailure(state, bossUnit),
    }, 0, 3);
  }
}
```

**Note:** `boss-enemy` in UNIT_DEFS currently has `hp: 260`. Context requires `hp: ~500`. Update to `hp: 500` in game.types.ts.

### Pattern 2: BossNegotiationState Extension

**What:** Add `scale` and `attemptsLeft` to the existing interface. These are optional for backward compatibility with existing tests and the `createGameState` call.

```typescript
// game.types.ts — extend existing interface
export interface BossNegotiationState {
  active: boolean;
  triggered: boolean;
  outcome?: 'success' | 'failure';
  scale?: number;        // 0–12, persisted for overlay remount
  attemptsLeft?: number; // starts at 3
}

// GameState interface — add:
elapsed?: number;  // seconds since game start, accumulated by BossSystem

// createGameState() — add to return object:
// elapsed is omitted (undefined = 0) OR explicitly: elapsed: 0
```

### Pattern 3: NegotiationOverlay — Scale + Attempts + 3-Outcome Gemini

**What:** Full rewrite. Local state tracks `scale` and `attemptsLeft`. Gemini returns `good/neutral/bad`. Terminal conditions checked after each response. Input re-enabled for non-terminal outcomes.

```typescript
export type NegotiationMountOptions = {
  onSuccess: () => void;
  onFailure: () => void;
  initialScale?: number;    // default 0
  initialAttempts?: number; // default 3
};

export class NegotiationOverlay {
  private el: HTMLElement | null = null;
  private scale = 0;
  private attemptsLeft = 3;
  private pending = false;  // guard against double-submit

  mount(container: HTMLElement, opts: NegotiationMountOptions): void {
    if (document.getElementById(OVERLAY_ID)) return;
    this.scale = opts.initialScale ?? 0;
    this.attemptsLeft = opts.initialAttempts ?? 3;
    // ... render HTML with scale bar and attempts counter
  }

  private async sendMessage(input, sendBtn, opts): Promise<void> {
    if (this.pending) return;
    this.pending = true;
    // ... Gemini call ...
    // Apply outcome:
    if (outcome === 'good') {
      this.scale = Math.min(12, this.scale + 4);
    } else if (outcome === 'neutral') {
      this.scale = Math.min(12, this.scale + 2);
      this.attemptsLeft += 2;
    } else {
      this.attemptsLeft -= 1;
    }
    this.updateUI(); // update scale bar + attempts display
    this.pending = false;

    // Check terminal conditions after a display delay
    setTimeout(() => {
      if (this.scale >= 12) {
        this.unmount();
        opts.onSuccess();
      } else if (this.attemptsLeft <= 0) {
        this.unmount();
        opts.onFailure();
      } else {
        input.disabled = false;
        sendBtn.disabled = false;
        input.value = '';
        input.focus();
      }
    }, 2800);
  }
}
```

### Pattern 4: Gemini API — Updated System Prompt and Regex

**What:** System prompt must instruct Gemini to return `{"outcome":"good"|"neutral"|"bad"}`. The fetch pattern, URL construction, and response extraction are identical to the existing overlay — only the prompt content and regex change.

```typescript
const SYSTEM_PROMPT = `Ты — Пожиратель Миров, древний робот-завоеватель, явившийся забрать Священный Грааль.
Игрок пытается убедить тебя уйти. Отвечай 1–2 предложениями от лица босса: угрожающе, величественно, загадочно.
После ответа добавь JSON на новой строке (только текст, без markdown): {"outcome":"good"} или {"outcome":"neutral"} или {"outcome":"bad"}.
- good: игрок льстит, предлагает ценную сделку, уважает твою силу, убедителен
- neutral: ответ частично интересный, не плохой, но не полностью убедительный
- bad: грубость, угрозы, бессмыслица, пустой текст или полное неуважение`;

// Regex — updated to match 3 outcomes:
const jsonMatch = raw.match(/\{"outcome"\s*:\s*"(good|neutral|bad)"\}/);
const outcome = (jsonMatch?.[1] ?? 'bad') as 'good' | 'neutral' | 'bad';
```

### Pattern 5: handleFailure — Horde Composition

**What:** Context specifies heavy + ranged only, NOT light. Current `HORDE_COMPOSITION` in BossSystem includes `'light-enemy': 12` — this is wrong and must be replaced.

```typescript
// New HORDE_COMPOSITION — heavy + ranged only:
const HORDE_COMPOSITION: Record<string, number> = {
  'heavy-enemy': 8,
  'ranged-enemy': 6,
};
// Total: 14 entries (smaller count than before but heavier units = more punishing)
```

### Pattern 6: Scale Bar HTML/CSS

```typescript
// HTML (inside vk-neg-panel):
`<div class="vk-neg-scale-wrap">
  <div class="vk-neg-scale-track">
    <div class="vk-neg-scale-fill" id="vk-neg-scale-fill"></div>
  </div>
  <div class="vk-neg-scale-label" id="vk-neg-scale-label">0 / 12</div>
</div>
<div class="vk-neg-attempts" id="vk-neg-attempts">Попыток: 3</div>`

// CSS:
`.vk-neg-scale-track{width:100%;height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden}
 .vk-neg-scale-fill{height:100%;background:linear-gradient(90deg,#a87b4c,#f0c17b);width:0%;transition:width .4s ease}
 .vk-neg-scale-label{font-size:11px;color:#7a9ab8;text-align:right;margin-top:2px}
 .vk-neg-attempts{font-size:12px;color:#c8d8e8;letter-spacing:.06em}`

// Update after each Gemini response:
const fillEl = document.getElementById('vk-neg-scale-fill');
const labelEl = document.getElementById('vk-neg-scale-label');
const attemptsEl = document.getElementById('vk-neg-attempts');
if (fillEl) fillEl.style.width = `${(this.scale / 12) * 100}%`;
if (labelEl) labelEl.textContent = `${this.scale} / 12`;
if (attemptsEl) attemptsEl.textContent = `Попыток: ${this.attemptsLeft}`;
```

### Anti-Patterns to Avoid

- **Mutating UNIT_DEFS directly on spawn:** Always spread: `def: { ...UNIT_DEFS['boss-enemy'] }`. UNIT_DEFS is a shared module-level constant.
- **Calling BossSystem from outside the 'playing' guard:** The main.ts guard already handles this — do not add redundant phase checks inside BossSystem for elapsed increment.
- **Calling onSuccess/onFailure synchronously after Gemini response:** Always use a delay (existing 2800ms setTimeout pattern) so the boss reply is displayed before the overlay closes.
- **Including light-enemy in failure horde:** Context explicitly says "heavy + ranged, NOT light". This is a design requirement, not a balance choice.
- **Re-enabling input before checking terminal conditions:** Check `scale >= 12` and `attemptsLeft <= 0` before re-enabling input. Disable input immediately on send, re-enable only if non-terminal.
- **Double-submit race condition:** Use `private pending = false` guard. Set to `true` at start of sendMessage(), set to `false` only after terminal check (or on error path).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Natural language evaluation of player input | Custom keyword matching / sentiment analysis | Gemini API | NLP is solved; keyword matching feels mechanical |
| Scale progress animation | JS animation loop | CSS `transition: width .4s ease` on fill div | One element, no library needed |
| Retry / backoff for Gemini | Custom retry loop | Simple try/catch + re-enable input | Sufficient for game context; over-engineering hurts UX |

---

## Common Pitfalls

### Pitfall 1: Timer fires during paused/won/lost phase

**What goes wrong:** `elapsed` accumulates during non-playing phases, causing boss to trigger immediately when play resumes.
**Why it happens:** `update()` could be called with accumulated dt from a paused state.
**How to avoid:** The existing main.ts guard (`if (gameState && gameState.phase === 'playing')`) already prevents `bossSystem.update()` from running outside 'playing'. No additional guard needed inside BossSystem.
**Warning signs:** Boss triggers as soon as game starts (0 seconds elapsed shown).

### Pitfall 2: Boss spawns at wrong position

**What goes wrong:** Boss unit created with `wx/wy = 0, 0` if `state.pathNodes[0]` is undefined.
**Why it happens:** pathNodes may be empty if map loading fails or hasn't completed.
**How to avoid:** Use null-safe access: `wx: state.pathNodes[0]?.wx ?? 0`. This is a graceful fallback; map loading failure is a separate concern.
**Warning signs:** Boss appears at top-left corner of canvas.

### Pitfall 3: Double trigger within same session

**What goes wrong:** Negotiation fires twice in one session.
**Why it happens:** `triggered` flag not set synchronously before mount.
**How to avoid:** Set `state.bossNegotiation = { active: true, triggered: true, ... }` synchronously before calling `overlay.mount()`. The existing pattern already does this correctly — preserve it in the rewrite.

### Pitfall 4: Gemini returns JSON before prose text

**What goes wrong:** Speech bubble shows only `{"outcome":"good"}` or empty string.
**Why it happens:** Gemini sometimes leads with the JSON instead of putting it after the prose.
**How to avoid:** Strip all JSON from raw before displaying: `raw.replace(/\{[^}]*\}/, '').trim()`. The existing overlay already does this — preserve in rewrite.

### Pitfall 5: attemptsLeft going negative on rapid clicks

**What goes wrong:** Multiple Gemini calls fire before input.disabled takes effect.
**Why it happens:** Async gap between click handler and DOM mutation.
**How to avoid:** Use `private pending = false` guard. Return early if `this.pending === true`.

### Pitfall 6: Overlay remounts with stale scale=0/attempts=3

**What goes wrong:** If NegotiationOverlay is unmounted and remounted (e.g. on navigation), it resets progress.
**Why it happens:** Overlay holds local state; BossNegotiationState in GameState has the canonical state.
**How to avoid:** Pass `initialScale` and `initialAttempts` from `state.bossNegotiation` into `overlay.mount()`. BossSystem reads these values and passes them in. Mount signature: `mount(container, opts: NegotiationMountOptions)` where opts includes `initialScale?` and `initialAttempts?`.

### Pitfall 7: BossSystem.test.ts passes but tests wrong behavior

**What goes wrong:** Old tests test unit-detection trigger, not timer trigger. Tests are green but the design contract is wrong.
**Why it happens:** Tests were written for the old design (plans 04-01 through 04-03).
**How to avoid:** Fully rewrite BossSystem.test.ts. Do not add new tests on top of old ones — replace them entirely.

---

## Code Examples

### Gemini API call (verified pattern from existing NegotiationOverlay.ts)

```typescript
// Source: src/screens/NegotiationOverlay.ts (existing, verified working)
const GEMINI_KEY = (import.meta as any).env?.VITE_GEMINI_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

const response = await fetch(GEMINI_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: playerInput }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 200 },
  }),
});
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();
const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
```

### BossSystem integration point in main.ts (do not change)

```typescript
// Source: src/main.ts line 908-916 (verified)
if (gameState && gameState.phase === 'playing') {
    waveController?.update(dt, gameState);
    unitSystem?.update(dt, gameState);
    buildingSystem?.update(dt, gameState);
    projectileSystem?.update(dt, gameState);
    combatSystem?.update(dt, gameState);
    resourceSystem?.update(dt, gameState);
    bossSystem.update(dt, gameState, document.body);
}

// Source: src/main.ts line 607 (cleanup on screen unmount)
if (gameState) bossSystem.forceReset(gameState);
```

### handleSuccess — keep reward logic, update types

```typescript
// handleSuccess in new BossSystem (same reward logic as existing):
handleSuccess(state: GameState): void {
  state.units = state.units.filter(
    u => !(u.def.role === 'boss' && u.faction === 'enemy'),
  );
  state.resources += NEGOTIATION_RESOURCE_REWARD;     // 120
  state.citadelHp = Math.min(state.citadelMaxHp, state.citadelHp + NEGOTIATION_HP_REWARD);  // +400
  state.waveTimer = Math.max(state.waveTimer, NEGOTIATION_WAVE_TIMER_FLOOR);  // >= 20s
  state.phase = 'playing';
  state.bossNegotiation = { active: false, triggered: true, outcome: 'success' };
  this.cleanup();
}
```

---

## State of the Art

| Old Approach (plans 04-01 to 04-03) | New Approach (replanned) | Reason |
|--------------------------------------|--------------------------|--------|
| Detect existing boss unit in update() | Spawn boss on elapsed timer trigger | Design change: timer-based, not wave-based |
| Binary outcome: success/failure | Three outcomes: good/neutral/bad | Richer multi-turn negotiation |
| No scale/attempts — single attempt | Scale 0→12 + attempt budget (3 start) | Allows multi-turn negotiation with stakes |
| Gemini JSON: `{"outcome":"success"\|"failure"}` | `{"outcome":"good"\|"neutral"\|"bad"}` | Matches new three-outcome design |
| Boss already on field before negotiation | Boss spawned by BossSystem at trigger | BossSystem owns full lifecycle |
| Horde: 12 light + 6 heavy + 4 ranged | Horde: 8 heavy + 6 ranged (NO light) | Context explicitly requires no light in failure horde |

---

## Open Questions

1. **Should `elapsed` be added as required or optional in GameState interface?**
   - What we know: `createGameState()` returns a fresh object; `elapsed` needs to be `0` initially.
   - Recommendation: Add as `elapsed?: number` (optional) on the interface so existing tests that construct minimal GameState objects don't break. In `createGameState()`, add `elapsed: 0` explicitly so runtime always has a defined value.

2. **Should forceReset also reset `elapsed`?**
   - What we know: `forceReset` is called on screen unmount (game session ends). If elapsed is not reset, a new game session would trigger the boss immediately.
   - Recommendation: Yes — `forceReset` should set `state.elapsed = 0` (or the calling code should reinitialize gameState entirely). Since `cleanupGameSession()` in main.ts sets `gameState = null` after `forceReset`, and `createGameState()` sets `elapsed: 0`, the state is fully reset for a new session. No action needed inside `forceReset` itself.

3. **How many units in the failure horde?**
   - What we know: Context says "heavy + ranged, NOT light". Claude's Discretion applies to exact counts.
   - Recommendation: `{ 'heavy-enemy': 8, 'ranged-enemy': 6 }` — 14 total. Heavier but smaller than the old 22-unit horde. Adjust if playtesting reveals it's too easy/hard.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest with jsdom environment |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/game/BossSystem.test.ts src/screens/NegotiationOverlay.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOSS-01 | `elapsed >= 300` triggers negotiation + boss spawn | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 — rewrite old file |
| BOSS-01 | elapsed < 300 does NOT trigger | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-01 | triggered=true prevents re-fire | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-01 | Boss unit pushed to state.units with correct def | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-02 | NegotiationOverlay renders scale bar and attempts counter | unit (jsdom) | `npx vitest run src/screens/NegotiationOverlay.test.ts` | ❌ Wave 0 — rewrite old file |
| BOSS-02 | good outcome: scale += 4, non-terminal re-enables input | unit (mock fetch) | `npx vitest run src/screens/NegotiationOverlay.test.ts` | ❌ Wave 0 |
| BOSS-02 | neutral outcome: scale += 2, attemptsLeft += 2 | unit (mock fetch) | `npx vitest run src/screens/NegotiationOverlay.test.ts` | ❌ Wave 0 |
| BOSS-02 | bad outcome: attemptsLeft -= 1 | unit (mock fetch) | `npx vitest run src/screens/NegotiationOverlay.test.ts` | ❌ Wave 0 |
| BOSS-03 | scale >= 12 calls onSuccess | unit (mock fetch) | `npx vitest run src/screens/NegotiationOverlay.test.ts` | ❌ Wave 0 |
| BOSS-03 | handleSuccess removes boss, credits resources, heals citadel | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-04 | attemptsLeft = 0 + scale < 12 calls onFailure | unit (mock fetch) | `npx vitest run src/screens/NegotiationOverlay.test.ts` | ❌ Wave 0 |
| BOSS-04 | Failure horde: heavy + ranged only, no light-enemy | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |
| BOSS-04 | handleFailure enrages boss (1.5x damage) | unit | `npx vitest run src/game/BossSystem.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/game/BossSystem.test.ts src/screens/NegotiationOverlay.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/game/BossSystem.test.ts` — rewrite entirely: old tests cover unit-detection design; new tests must cover timer trigger, boss spawn, scale/attempts passed through, horde composition (heavy+ranged only)
- [ ] `src/screens/NegotiationOverlay.test.ts` — rewrite entirely: old tests cover 2-button UI; new tests must cover scale bar DOM, attempts counter DOM, 3-outcome mock fetch responses, pending guard, terminal condition callbacks

*(Both files exist but test the old design — they must be replaced, not extended.)*

---

## Sources

### Primary (HIGH confidence)

- `src/game/BossSystem.ts` — read directly; current state confirmed (unit-detection trigger, no elapsed, no scale)
- `src/screens/NegotiationOverlay.ts` — read directly; Gemini fetch pattern confirmed working; old 2-outcome format confirmed
- `src/game/game.types.ts` — read directly; BossNegotiationState shape confirmed; missing scale/attemptsLeft
- `src/game/GameState.ts` — read directly; createGameState() confirmed; missing elapsed
- `src/main.ts` — read directly; line 908-916 update loop confirmed; line 607 forceReset confirmed; BossSystem singleton at line 198 confirmed
- `.planning/phases/04-boss-negotiation-mechanic/04-CONTEXT.md` — locked design decisions
- `vitest.config.ts` — read directly; jsdom environment + `src/**/*.test.ts` pattern confirmed

### Secondary (MEDIUM confidence)

- Gemini REST API: endpoint `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` — working in existing overlay (verified from source)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified directly in source files
- Architecture: HIGH — derived from direct source code reading; integration points verified
- Pitfalls: HIGH — derived from code analysis + existing test file patterns
- Gemini API format: HIGH — existing overlay confirms working endpoint and response extraction

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (Gemini API stable; 30-day window)
