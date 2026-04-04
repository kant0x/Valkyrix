# Phase 3: Units, Buildings & Combat — Research

**Researched:** 2026-03-17
**Domain:** Vanilla TypeScript game loop — entity systems, path traversal, sprite rendering, wave management on Canvas 2D
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Движение юнитов по path**
- Один общий path в map JSON; враги идут справа налево, наши юниты слева направо по тем же узлам
- Движение плавное (lerp между узлами), направление определяет ряд анимации из спрайт-атласа
- Несколько юнитов одновременно на пути — у каждого свой прогресс по path
- Дошёл до конца своего маршрута → атакует базу/цитадель противника постоянно до уничтожения

**Встреча на пути**
- Наш юнит встречает врага на path → оба останавливаются, дерутся, победитель идёт дальше
- Смерть юнита: мгновенное исчезновение (без анимации смерти)

**Волны врагов**
- Запуск автоматический по таймеру (каждые 10–15 сек)
- 15–30 юнитов на волну, спавн из портала с фиксированной задержкой между юнитами (~0.5с)
- Первые волны: большие орды слабых юнитов
- Усложнение от волны к волне: больше юнитов + появляются новые типы
- Проигрыш: HP цитадели = 0

**Здания**
- Два типа: **атакующая башня** (стреляет по врагам в радиусе) и **башня-баф** (усиливает наших юнитов поблизости)
- Размещение: выбрать из меню → кликнуть на допустимую zone на карте
- Можно снести башню во время игры (возврат части ресурсов — на усмотрение Claude)
- Атакующая башня: цель — ближайший враг в радиусе, визуально — проектиль летит к цели (assets в `public/assets/projectiles`)

**Ресурсы (электролаты)**
- Два источника: башни производят пассивно + убитые враги дропают
- Электролаты тратятся на постройку башен

### Claude's Discretion
- Точные числа (HP юнитов, урон башен, радиус атаки, стоимость башен) — Claude балансирует
- Механика возврата ресурсов при сносе башни
- Конкретный баф башни-бафа (скорость, урон, или регенерация)
- Формат хранения состояния юнитов в runtime

### Deferred Ideas (OUT OF SCOPE)
- Мультиплеер (у каждого игрока своя сторона) — Phase 5
- Блокчейн-транзакция за каждого убитого юнита — Phase 5
- Переговоры с боссом — Phase 4
- Апгрейд башен — можно добавить в backlog
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UNIT-01 | Каждый тип юнита имеет здоровье, скорость, роль (задокументировано) | UnitDef interface in src/game/unit.types.ts; four types identified from assets |
| UNIT-02 | Юниты спавнятся на `spawn`, движутся по `paths`, атакуют цитадель | Path extraction from map JSON layers, tileToWorld formula already in main.ts, lerp movement pattern |
| BLDG-01 | Здания размещаются в `zones`, каждое имеет механику баффа или атаки | Zone tiles known (81 non-zero tiles), click-to-place UI on canvas, BldgDef interface |
| BLDG-02 | Волны врагов запускаются по таймеру/триггеру | WaveController with setInterval-style dt accumulator inside rAF loop |
| GAME-01 | Игрок может проиграть (цитадель захвачена) или выиграть раунд | CitadelState + win/loss check in update(); modal/overlay via HTML |
| GAME-02 | In-game HUD показывает состояние игры (волны, здоровье, ресурсы) | HudOverlay.update() already accepts {wave, health, resources} — just wire real data |
| RUN-02 | Runtime exposes spawn, citadel, path, and camera information from map data (not hardcoded) | Extract at map-load time into GameState; spawn=scene.portals[0], citadel=scene.citadel, path built from paths layer |
| RUN-03 | Runtime renders or represents exported entities preserving gameplay meaning | Units and buildings drawn on same `vk-canvas` using existing worldToScreen() + ctx.drawImage() |
</phase_requirements>

---

## Summary

Phase 3 adds the full game-play loop on top of a working isometric renderer (Phase 1) and screen architecture (Phase 2). The project stack is pure vanilla TypeScript + Vite + Canvas 2D — no external game engine. All coordinate math (`tileToWorld`, `worldToScreen`) is already implemented in `src/main.ts` and can be copied/extracted directly. The rendering loop (`requestAnimationFrame` → `update(dt)` → `render()`) is already running; Phase 3 extends it with entity state and draw calls.

The dominant architectural challenge is **path extraction and ordered traversal**. The map's `paths` layer holds 410 non-zero tiles scattered in a 2D array; these must be sorted into a contiguous ordered sequence (enemy spawn portal at world (2816, 1216) → citadel at world (1056, 304)). Once the ordered node sequence is built at map-load time, unit movement is simple lerp between adjacent nodes parameterised by a `t` (0–1) progress value per unit.

Combat is intentionally minimal: units that collide on the path stop and deal periodic damage until one dies (instant removal). Towers query a radius around their world position each frame and fire projectiles (existing sprites in `public/assets/projectiles/Arrow01.png`). The HUD wiring is already done in Phase 2 — `HudOverlay.update({wave, health, resources})` just needs real game data passed to it each frame.

**Primary recommendation:** Extract path nodes once at map-load, store ordered `PathNode[]` in `GameState`, then implement `UnitSystem`, `BuildingSystem`, `WaveController`, and `CombatSystem` as plain TypeScript classes that all receive the same `GameState` in their `update(dt)` call, matching the project's existing vanilla-TS pattern.

---

## Standard Stack

### Core (already installed — no new deps required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.7.2 | Static typing for entity/state interfaces | Project standard |
| Vite | ^6.3.1 | Dev server, HMR, production build | Project standard |
| Canvas 2D API | browser built-in | Rendering units, buildings, projectiles | Already used for all tile rendering |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.0 | Unit tests for pure logic (path ordering, combat math) | Test UnitDef data, WaveController timing, damage calculations |
| jsdom | ^29.0.0 | Test environment | Already configured in vitest.config.ts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain TS classes | ECS library (bitecs, miniplex) | ECS has better cache locality at scale but adds a dep and breaks project's zero-dep philosophy |
| Canvas 2D drawImage | WebGL / PixiJS | Far more powerful but would require rewriting the entire renderer |
| Manual path sort | Pathfinding library (pathfinding.js) | The path is authored/linear, not a grid search — library is overkill |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── game/
│   ├── game.types.ts          # UnitDef, BldgDef, GameState, PathNode interfaces
│   ├── GameState.ts           # Runtime mutable state object (units[], buildings[], etc.)
│   ├── PathExtractor.ts       # Converts map layers.paths → ordered PathNode[] at load time
│   ├── UnitSystem.ts          # Spawning, movement along path, collision detection
│   ├── BuildingSystem.ts      # Tower placement, attack tower range, buff tower aura
│   ├── ProjectileSystem.ts    # Projectile creation, movement, hit detection
│   ├── WaveController.ts      # Timer-based wave spawning, escalation table
│   ├── CombatSystem.ts        # Unit-vs-unit and tower-vs-unit damage resolution
│   ├── ResourceSystem.ts      # Electrolatov tracking, drop on kill, passive tower income
│   └── GameRenderer.ts        # drawUnits(), drawBuildings(), drawProjectiles() using existing worldToScreen()
├── screens/
│   └── ... (existing Phase 2 files)
└── main.ts                    # Extend RuntimeState → add GameState; wire systems into update()/render()
```

### Pattern 1: GameState as single mutable object

**What:** All game systems share one `GameState` object containing arrays of units, buildings, projectiles, and scalar game metrics. Systems mutate it; renderer reads it.

**When to use:** Always — this matches the existing `RuntimeState` pattern in `main.ts`.

```typescript
// src/game/game.types.ts
export interface PathNode {
  wx: number; // world X (already in isometric world space)
  wy: number; // world Y
}

export type UnitRole = 'light' | 'heavy' | 'ranged' | 'collector';
export type UnitFaction = 'enemy' | 'ally';

export interface UnitDef {
  role: UnitRole;
  hp: number;
  speed: number;       // world units per second along path
  damage: number;      // per attack tick
  attackRate: number;  // attacks per second
  sprite: string;      // asset path
}

export interface Unit {
  id: number;
  def: UnitDef;
  faction: UnitFaction;
  hp: number;
  pathIndex: number;   // current segment index into PathNode[]
  pathT: number;       // 0–1 progress within current segment
  wx: number;          // current world X (interpolated)
  wy: number;          // current world Y
  state: 'moving' | 'fighting' | 'attacking-base';
  fightingWith: number | null;  // id of opponent unit
  attackCooldown: number;       // seconds until next attack
}

export interface Building {
  id: number;
  type: 'attack' | 'buff';
  wx: number;
  wy: number;
  tileCol: number;
  tileRow: number;
  radius: number;          // world units
  damage: number;          // attack tower: damage per shot
  attackRate: number;      // shots per second
  attackCooldown: number;
  buffValue: number;       // buff tower: e.g. speed multiplier or damage bonus
  resourceRate: number;    // electrolatov per second (passive)
}

export interface Projectile {
  id: number;
  wx: number; wy: number;
  targetUnitId: number;
  speed: number;
  damage: number;
}

export interface GameState {
  phase: 'playing' | 'paused' | 'won' | 'lost';
  waveNumber: number;
  waveTimer: number;        // seconds until next wave
  spawnQueue: Array<{ defKey: string; delay: number }>;
  spawnTimer: number;
  units: Unit[];
  buildings: Building[];
  projectiles: Projectile[];
  citadelHp: number;
  citadelMaxHp: number;
  playerBaseHp: number;
  playerBaseMaxHp: number;
  resources: number;        // electrolatov
  nextId: number;           // auto-increment for unit/building IDs
  pathNodes: PathNode[];    // enemy direction: index 0 = portal, last = citadel
}
```

### Pattern 2: PathExtractor — build ordered path at load time

**What:** Convert the flat `layers.paths` tile array into an ordered sequence of world-coordinate nodes the moment the map loads. Sort order: nearest to portal (spawn) first.

**When to use:** Once, in `loadMap()` or `GameState` initialization.

```typescript
// src/game/PathExtractor.ts
// Source: tileToWorld formula extracted from src/main.ts lines 1180–1185

const ISO_LAYER_X = 1152; // must match main.ts constant

export function extractOrderedPath(
  pathLayer: number[],
  mapWidth: number,
  tileWidth: number,
  tileHeight: number,
  portalWorldX: number,
  portalWorldY: number,
): PathNode[] {
  // 1. Collect all non-zero path tiles as world coords
  const nodes: PathNode[] = [];
  for (let i = 0; i < pathLayer.length; i++) {
    if (!pathLayer[i]) continue;
    const col = i % mapWidth;
    const row = Math.floor(i / mapWidth);
    nodes.push({
      wx: (col - row) * (tileWidth / 2) + tileWidth / 2 + ISO_LAYER_X,
      wy: (col + row) * (tileHeight / 2) + tileHeight / 2,
    });
  }

  // 2. Greedy nearest-neighbor sort starting from portal
  let sorted: PathNode[] = [];
  let remaining = [...nodes];
  let current = { wx: portalWorldX, wy: portalWorldY };
  while (remaining.length > 0) {
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dx = remaining[i].wx - current.wx;
      const dy = remaining[i].wy - current.wy;
      const d = dx * dx + dy * dy;
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    }
    current = remaining[nearest];
    sorted.push(current);
    remaining.splice(nearest, 1);
  }
  return sorted;
}
```

**Confidence:** HIGH — greedy nearest-neighbor is standard for authored linear paths in isometric games. The 410-node path is small enough that O(n²) sort is instant.

### Pattern 3: Unit movement with lerp

**What:** Each unit stores `pathIndex` (current segment) and `pathT` (0–1 progress in segment). Each frame, advance `pathT` by `speed * dt / segmentLength`, carry over when ≥ 1.

```typescript
// src/game/UnitSystem.ts
function advanceUnit(unit: Unit, path: PathNode[], dt: number): void {
  if (unit.state !== 'moving') return;
  const from = path[unit.pathIndex];
  const to = path[unit.pathIndex + 1];
  if (!to) {
    unit.state = 'attacking-base';
    return;
  }
  const segLen = Math.hypot(to.wx - from.wx, to.wy - from.wy);
  const tStep = segLen > 0 ? (unit.def.speed * dt) / segLen : 1;
  unit.pathT += tStep;
  if (unit.pathT >= 1) {
    unit.pathIndex++;
    unit.pathT -= 1;
    if (unit.pathIndex >= path.length - 1) {
      unit.state = 'attacking-base';
      unit.pathT = 0;
    }
  }
  const seg = path[unit.pathIndex];
  const next = path[Math.min(unit.pathIndex + 1, path.length - 1)];
  unit.wx = seg.wx + (next.wx - seg.wx) * unit.pathT;
  unit.wy = seg.wy + (next.wy - seg.wy) * unit.pathT;
}
```

Enemy units traverse path index 0 → last (portal to citadel).
Ally units traverse path last → 0 (reversed array or negative direction flag).

### Pattern 4: Tower attack — nearest enemy in radius

```typescript
// src/game/BuildingSystem.ts
function updateAttackTower(bldg: Building, state: GameState, dt: number): void {
  bldg.attackCooldown -= dt;
  if (bldg.attackCooldown > 0) return;

  // Find nearest enemy in radius
  let nearest: Unit | null = null;
  let nearestDist = Infinity;
  for (const unit of state.units) {
    if (unit.faction !== 'enemy') continue;
    const dx = unit.wx - bldg.wx;
    const dy = unit.wy - bldg.wy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= bldg.radius && d < nearestDist) {
      nearest = unit;
      nearestDist = d;
    }
  }
  if (!nearest) return;

  // Spawn projectile
  state.projectiles.push({
    id: state.nextId++,
    wx: bldg.wx, wy: bldg.wy,
    targetUnitId: nearest.id,
    speed: 400, // world units/sec
    damage: bldg.damage,
  });
  bldg.attackCooldown = 1 / bldg.attackRate;
}
```

### Pattern 5: Canvas click → zone tile hit-test

**What:** Convert canvas click pixel → world coords → tile col/row → check if zones layer has non-zero value.

```typescript
// Inverse of worldToScreen and tileToWorld (from main.ts)
function canvasClickToTile(
  clickX: number, clickY: number,
  canvasEl: HTMLCanvasElement,
  cameraCenter: { x: number; y: number },
  zoom: number,
  tileWidth: number,
  tileHeight: number,
): { col: number; row: number } {
  const scaleX = GAME_W / canvasEl.clientWidth;
  const scaleY = GAME_VIEW_H / canvasEl.clientHeight;
  const gameX = clickX * scaleX;
  const gameY = clickY * scaleY;
  // Invert worldToScreen
  const wx = cameraCenter.x + (gameX - GAME_W / 2) / zoom;
  const wy = cameraCenter.y + (gameY - GAME_VIEW_H / 2) / zoom;
  // Invert tileToWorld:
  // wx = (col - row) * halfW + halfW + ISO_LAYER_X
  // wy = (col + row) * halfH + halfH
  const adjX = wx - ISO_LAYER_X - tileWidth / 2;
  const adjY = wy - tileHeight / 2;
  const col = Math.round((adjX / (tileWidth / 2) + adjY / (tileHeight / 2)) / 2);
  const row = Math.round((adjY / (tileHeight / 2) - adjX / (tileWidth / 2)) / 2);
  return { col, row };
}
```

### Anti-Patterns to Avoid

- **Storing path nodes as tile col/row at runtime:** Always convert to world coords at load time. Unit lerp math works in world space, not tile space.
- **Calling `extractOrderedPath` every frame:** Call once at map load; store in `GameState.pathNodes`.
- **Adding units/buildings to DOM:** All game entities render on `<canvas id="vk-canvas">` — never create HTML elements for game entities.
- **Using `setTimeout` for wave timers:** Use dt accumulation inside the existing rAF loop to keep timers in sync with the game loop's dt capping.
- **Storing faction in unit as boolean:** Use `'enemy' | 'ally'` string union — makes code readable and avoids boolean logic inversion bugs when adding more factions in Phase 4.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sprite frame animation | Custom animation scheduler | Index into `metadata.json` frames array with accumulated time | Viking already ships `metadata.json` with frame paths by animation name and direction — just follow it |
| Path ordering algorithm | Complex graph traversal | Greedy nearest-neighbor sort (see Pattern 2) | The path is a single continuous authored line; BFS/A* is overkill for 410 pre-authored nodes |
| Projectile rendering | 3D trajectory math | Straight-line move toward target's current position each frame | Arrow01.png is a 2D sprite; no arc needed for this game feel |
| Resource UI | Custom React/Vue component | Extend existing `HudOverlay.update()` | Phase 2 already built the exact interface `{wave, health, resources}` — just call it |
| Building placement validation | Ray-casting polygon test | `zones` layer tile lookup O(1) | Zone tiles are already in a flat array indexed by `row * width + col` |

**Key insight:** The project deliberately avoids all external game-engine dependencies. Every system should be a plain TypeScript class with `update(dt: number, state: GameState)` and `render(ctx, state)` methods — same shape as the existing code in `main.ts`.

---

## Common Pitfalls

### Pitfall 1: Path ordering produces disconnected or reversed route

**What goes wrong:** Greedy nearest-neighbor can produce a U-turn if the portal tile and a far cluster happen to be equidistant. Enemy units appear to walk backwards.

**Why it happens:** The `paths` layer has 410 tiles — not every tile is a direct neighbor. Gaps appear at corners.

**How to avoid:** Seed the sort from the portal world position (`scene.portals[0]`), not from an arbitrary tile. Then visually verify by drawing the sorted path in debug mode before implementing movement.

**Warning signs:** First few units in the game walk to an unexpected tile cluster before reaching the citadel.

### Pitfall 2: Unit collision zone too tight or too loose on isometric grid

**What goes wrong:** Units on an isometric path that curves diagonally collide with units that are visually far apart because Euclidean distance in world space doesn't match visual tile proximity.

**Why it happens:** Isometric tiles are 64×32 — X distance and Y distance have a 2:1 ratio. A "collision radius" based on pixels looks wrong.

**How to avoid:** Express collision radius in tile-widths (e.g. 0.5 × tileWidth = 32 world units). Units fighting: compare `Math.hypot(dx, dy) < 32`. Test with two units spawned at the same path position.

**Warning signs:** Units visually overlapping but not triggering combat, or units colliding while visually separated.

### Pitfall 3: Multiple `requestAnimationFrame` loops running after screen remount

**What goes wrong:** Navigating to the game screen a second time starts a second rAF loop — all timers and spawns double-speed.

**Why it happens:** The existing `animating` guard at module scope already prevents this for the camera/map loop. But if `WaveController` or `UnitSystem` is instantiated on each mount without stopping the previous instance, they accumulate.

**How to avoid:** Follow the existing pattern — `animating` flag at module scope. The `GameScreen.unmount()` must stop all timers and clear `GameState`. Do not use closure-captured intervals; use dt accumulation so there's nothing to cancel.

**Warning signs:** Wave spawns arrive twice as fast after the player presses Esc and returns to game.

### Pitfall 4: `GameState` grows unbounded with dead units

**What goes wrong:** Units that die stay in the `units` array. With 30 units/wave × many waves, the array becomes large and every O(n) scan (tower range check, collision) slows down.

**Why it happens:** Splice in a loop causes index skipping if not done carefully.

**How to avoid:** Mark dead units with `hp <= 0`, filter the array once per frame at the end of `update()`:
```typescript
state.units = state.units.filter(u => u.hp > 0);
```
Do this at the very end of `CombatSystem.update()`, after all damage has been applied in the current frame.

### Pitfall 5: Building placement allows stacking on same zone tile

**What goes wrong:** Two buildings placed on the same tile — one is invisible under the other, zone tiles overlap.

**Why it happens:** Click handler runs twice (double-click) or zone validation doesn't exclude already-occupied tiles.

**How to avoid:** When validating a placement click, check not just `zones[row * width + col] > 0` but also that no existing building occupies `(tileCol, tileRow)`.

---

## Code Examples

Verified patterns from existing codebase:

### tileToWorld (exact formula from src/main.ts:1180-1185)
```typescript
function tileToWorld(col: number, row: number, tileWidth: number, tileHeight: number): { wx: number; wy: number } {
  return {
    wx: (col - row) * (tileWidth / 2) + tileWidth / 2 + 1152, // ISO_LAYER_X = 1152
    wy: (col + row) * (tileHeight / 2) + tileHeight / 2,
  };
}
// Active map: tileWidth=64, tileHeight=32
// Citadel scene point: {x:1056, y:304}
// Portal scene point:  {x:2816, y:1216}
```

### worldToScreen (exact formula from src/main.ts:1187-1192)
```typescript
function worldToScreen(wx: number, wy: number, cameraCenter: {x:number;y:number}, zoom: number): { sx: number; sy: number } {
  return {
    sx: 1280 / 2 + (wx - cameraCenter.x) * zoom,  // GAME_W = 1280
    sy: 506 / 2 + (wy - cameraCenter.y) * zoom,    // GAME_VIEW_H = GAME_H - TOP_BAR_HEIGHT - HUD_HEIGHT = 506
  };
}
```

### HudOverlay.update() — already wired (src/screens/HudOverlay.ts)
```typescript
// Just call with real game data each frame:
hud.update({
  wave: state.waveNumber,
  health: state.citadelHp,
  resources: state.resources,
});
```

### Map data access pattern (established)
```typescript
// Portals (spawn positions) — from scene not layers
const portal = map.scene?.portals?.[0]; // {x, y, direction}
// Citadel position
const citadel = map.scene?.citadel;     // {x, y}
// Path tiles
const pathLayer = map.layers?.paths ?? [];
// Zone tiles (buildable)
const zoneLayer = map.layers?.zones ?? [];
// Check if tile is buildable zone:
const idx = row * map.width + col;
const isBuildable = (zoneLayer[idx] ?? 0) > 0;
```

---

## Existing Assets — What's Available

### Unit Sprites (in `public/assets/pers/`)

| Character | Files | Animation Format | Directions |
|-----------|-------|-----------------|------------|
| `viking/` | `metadata.json` + per-frame PNGs | metadata.json lists frames by animation name + direction | 8 (N/NE/E/SE/S/SW/W/NW) in `rotations/`; animations: `scary-walk`, `custom-axe blow` |
| `soldier/` | Flat PNGs: Walk, Idle, Attack01-03, Hurt, Death | Sprite sheets (single file per action) | Not directional (flat spritesheet) |
| `boits/` | `boits.png`, `attack-boits.png` | Single sprite per state | N/A |
| `collector/` | PNGs in `direction/` subdirectory: East, north, northeast, northwest, south, west | Single frame per direction | 6 directions |

**Important:** Viking uses `metadata.json` with explicit frame paths — load and parse this file to get correct animation frames. Soldier uses traditional spritesheets — will need frame dimensions.

### Projectile Sprites
- `public/assets/projectiles/Arrow01.png` — single image, use `ctx.drawImage()` rotated toward target using `Math.atan2(dy, dx)`.

---

## Map Data — Confirmed Facts

From inspection of `public/assets/maps/active-map.json`:

| Property | Value |
|----------|-------|
| Map size | 70 × 30 tiles |
| Tile size | 64 × 32 px |
| Path tiles | 410 non-zero tiles |
| Zone tiles | 81 non-zero tiles (buildable) |
| Enemy portal (spawn) | world (2816, 1216), col 63, row 12, direction "east" |
| Citadel | world (1056, 304) |
| ISO_LAYER_X offset | 1152 (constant in main.ts) |
| `spawn` layer | 0 non-zero tiles — spawn point comes from `scene.portals`, NOT the `spawn` layer |
| `citadel` layer | 0 non-zero tiles — citadel position comes from `scene.citadel`, NOT the layer |

**Critical finding:** The `spawn` and `citadel` tile layers are currently empty in the active map. Spawn and citadel positions come from `scene.portals[0]` and `scene.citadel` respectively. The planner must use scene-level data, not layer-level data, for these anchors.

---

## Proposed Unit Balance (Claude's Discretion)

| Role | HP | Speed (w/s) | Damage | Attack Rate | Cost/Wave | Appears at Wave |
|------|-----|------------|--------|-------------|-----------|-----------------|
| Light (enemy) | 40 | 80 | 8 | 1.0/s | 20/wave | 1+ |
| Light (ally) | 50 | 70 | 10 | 1.0/s | 30 electrolatov | 1+ |
| Heavy (enemy) | 150 | 40 | 25 | 0.5/s | 5/wave | wave 3+ |
| Ranged (enemy) | 60 | 55 | 15 | 0.8/s | 8/wave | wave 5+ |

| Building | HP | Damage | Attack Rate | Radius | Buff | Cost | Resource Rate |
|----------|----|--------|-------------|--------|------|------|---------------|
| Attack Tower | — | 30 | 1.0/s | 160 world units | — | 50 | 5/s |
| Buff Tower | — | — | — | 128 world units | +25% speed to allies | 40 | 3/s |

| Resource | Value |
|----------|-------|
| Enemy killed (light) | +5 electrolatov |
| Enemy killed (heavy) | +15 electrolatov |
| Citadel HP | 500 |
| Tower sell return | 60% of cost |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global game loop with direct DOM manipulation | Module-scoped state + rAF loop, all entities on canvas | Phase 1 established | Units/buildings follow same pattern — no new global state philosophy needed |
| Hardcoded map anchors | All positions from `scene.portals`, `scene.citadel` | RUN-02 pending requirement | Phase 3 must also satisfy RUN-02 by reading these from map data |

---

## Open Questions

1. **Path continuity — is the 410-tile path a single connected line or multiple disconnected segments?**
   - What we know: Tiles range across col 6–53, row 7–17. Portal is at col 63, row 12 which is outside the detected range — suggesting the path layer may not reach all the way to the portal.
   - What's unclear: Whether greedy nearest-neighbor will produce a clean single route or require manual inspection.
   - Recommendation: Wave 0 task should render the sorted path as a debug overlay (colored dots in sequence) before implementing unit movement. If path is disconnected, the planner should add a task to author additional path tiles in the editor.

2. **Soldier spritesheet frame dimensions unknown**
   - What we know: `Soldier-Walk.png` exists as a flat PNG — not a metadata.json-described atlas.
   - What's unclear: Frame count and layout (horizontal strip vs. grid).
   - Recommendation: Inspect image dimensions at runtime; if sheet is W × H with known frame count, divide. Alternatively, use the Viking (which has full metadata.json) as the primary unit type for Phase 3 and defer soldier integration.

3. **`spawn` and `citadel` tile layers are empty — RUN-04 implications**
   - What we know: These layers exist in the JSON but have 0 non-zero tiles in the active map.
   - What's unclear: Whether the editor populates these in new maps or whether the design always uses scene-level data.
   - Recommendation: Use `scene.portals` and `scene.citadel` as the canonical source. Add a `validateGameMap()` guard that throws if either is absent.

---

## Sources

### Primary (HIGH confidence)
- `src/main.ts` — exact `tileToWorld`, `worldToScreen`, `RuntimeState`, rAF loop, `GameScreen` class patterns — read directly
- `src/screens/HudOverlay.ts` — `HudState` interface, `update()` method — read directly
- `public/assets/maps/active-map.json` — layer contents, scene anchors, portal and citadel positions — inspected with Node.js
- `public/assets/pers/viking/metadata.json` — animation frame format for Viking character — read directly
- `public/assets/pers/` directory listing — confirmed available characters and sprite formats

### Secondary (MEDIUM confidence)
- Phase 2 decisions in `STATE.md` — HudOverlay typed partial-update interface, animating guard pattern, GameScreen mount/unmount behavior

### Tertiary (LOW confidence — training data)
- Greedy nearest-neighbor path sort for linear authored paths is a common pattern in tower-defense games, but the specific correctness for this map's topology is unverified until rendered

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps confirmed from package.json, no new deps needed
- Architecture: HIGH — patterns derived directly from existing codebase code, not speculation
- Map data: HIGH — inspected actual JSON file
- Unit balance numbers: MEDIUM — Claude's discretion area, reasonable starting values
- Pitfalls: HIGH — derived from code inspection and established game-loop patterns
- Sprite animation details (soldier): LOW — frame layout not confirmed

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable vanilla TS project; no fast-moving external deps)
