import { describe, it, expect, beforeEach } from 'vitest';
import { UnitSystem } from './UnitSystemRuntime';
import type { GameState, Unit, PathNode, UnitDef } from './game.types';

// ---- helpers ----

const LIGHT_DEF: UnitDef = {
  role: 'light',
  hp: 40,
  speed: 80,  // world units per second
  damage: 8,
  attackRate: 1.0,
  sprite: '',
  faction: 'enemy',
};

const ALLY_DEF: UnitDef = {
  role: 'light',
  hp: 50,
  speed: 70,
  damage: 10,
  attackRate: 1.0,
  sprite: '',
  faction: 'ally',
};

function makePathNodes(count: number): PathNode[] {
  // Horizontal path: each node 100 world units apart
  return Array.from({ length: count }, (_, i) => ({ wx: i * 100, wy: 0 }));
}

function makeUnit(overrides: Partial<Unit> & { faction?: 'enemy' | 'ally' }): Unit {
  const def = overrides.faction === 'ally' ? ALLY_DEF : LIGHT_DEF;
  return {
    id: 1,
    def,
    faction: def.faction,
    hp: def.hp,
    pathIndex: 0,
    pathT: 0,
    wx: 0,
    wy: 0,
    state: 'moving',
    fightingWith: null,
    attackCooldown: 0,
    ...overrides,
  };
}

function makeState(units: Unit[], pathNodes: PathNode[]): GameState {
  return {
    phase: 'playing',
    waveNumber: 0,
    waveTimer: 15,
    spawnQueue: [],
    spawnTimer: 0,
    units,
    buildings: [],
    projectiles: [],
    citadelHp: 500,
    citadelMaxHp: 500,
    playerBaseHp: 300,
    playerBaseMaxHp: 300,
    resources: 100,
    crystals: 0,
    nextId: 2,
    pathNodes,
    allyPathNodes: [...pathNodes].reverse(),
    enemyLaneOffsets: [0],
  };
}

// ---- tests ----

describe('UnitSystem', () => {
  let system: UnitSystem;

  beforeEach(() => {
    system = new UnitSystem();
  });

  it('advances pathT for a moving enemy unit (speed * dt / segmentLength)', () => {
    // 3-node path; segment length = 100 world units
    const path = makePathNodes(3);
    const unit = makeUnit({ pathT: 0, pathIndex: 0 });
    const state = makeState([unit], path);

    system.update(1, state);  // dt = 1s

    // pathT increase = speed * dt / segmentLength = 80 * 1 / 100 = 0.8
    expect(state.units[0].pathT).toBeCloseTo(0.8);
    expect(state.units[0].pathIndex).toBe(0);
  });

  it('increments pathIndex and wraps pathT when pathT >= 1', () => {
    const path = makePathNodes(3);
    // Start near end of segment: pathT=0.9, speed=80 → dt=0.5 → advance=80*0.5/100=0.4 → total=1.3 → wrap
    const unit = makeUnit({ pathT: 0.9, pathIndex: 0 });
    const state = makeState([unit], path);

    system.update(0.5, state);

    expect(state.units[0].pathIndex).toBe(1);
    expect(state.units[0].pathT).toBeCloseTo(0.3);
  });

  it('transitions to attacking-base when enemy reaches last pathIndex', () => {
    // 2-node path (1 segment). Enemy starts at pathIndex=0, pathT=0.9
    // speed=80, dt=1 → advance=0.8 → total=1.7 → wraps to pathIndex=1, no next segment → attacking-base
    const path = makePathNodes(2);
    const unit = makeUnit({ pathT: 0.9, pathIndex: 0 });
    const state = makeState([unit], path);

    system.update(1, state);

    expect(state.units[0].state).toBe('attacking-base');
    expect(state.units[0].wx).toBeCloseTo(58);
    expect(state.units[0].wy).toBeCloseTo(0);
  });

  it('compresses lane spread near the citadel so enemies do not attack from far off to the side', () => {
    const path = makePathNodes(2);
    const unit = makeUnit({ pathT: 0.9, pathIndex: 0, laneOffset: 30 });
    const state = makeState([unit], path);

    system.update(1, state);

    expect(state.units[0].state).toBe('attacking-base');
    expect(state.units[0].wx).toBeCloseTo(58);
    expect(Math.abs(state.units[0].wy)).toBeLessThan(2);
  });

  it('uses a meaningful approach vector when the final citadel segment is too short', () => {
    const path: PathNode[] = [
      { wx: 0, wy: 0 },
      { wx: 90, wy: 0 },
      { wx: 100, wy: 0 },
    ];
    const unit = makeUnit({ pathT: 0.95, pathIndex: 1, wx: 99, wy: 0 });
    const state = makeState([unit], path);

    system.update(1, state);

    expect(state.units[0].state).toBe('attacking-base');
    expect(state.units[0].wx).toBeCloseTo(58);
    expect(state.units[0].wy).toBeCloseTo(0);
  });

  it('does NOT advance units in fighting or attacking-base states', () => {
    const path = makePathNodes(3);
    const fighting = makeUnit({ id: 1, pathT: 0, pathIndex: 0, state: 'fighting' });
    const atBase = makeUnit({ id: 2, pathT: 0, pathIndex: 0, state: 'attacking-base' });
    const state = makeState([fighting, atBase], path);

    system.update(1, state);

    expect(state.units[0].pathT).toBe(0);
    expect(state.units[0].pathIndex).toBe(0);
    expect(state.units[1].pathT).toBe(0);
    expect(state.units[1].pathIndex).toBe(0);
  });

  it('filters dead units (hp <= 0) from state.units after update', () => {
    const path = makePathNodes(3);
    const alive = makeUnit({ id: 1, hp: 10 });
    const dead = makeUnit({ id: 2, hp: 0 });
    const state = makeState([alive, dead], path);

    system.update(0.1, state);

    expect(state.units.length).toBe(1);
    expect(state.units[0].id).toBe(1);
  });

  it('updates wx,wy by lerping between current and next PathNode', () => {
    // path: node0=(0,0), node1=(100,50)
    const path: PathNode[] = [{ wx: 0, wy: 0 }, { wx: 100, wy: 50 }];
    // After 1s: advance = 80*1/segLen; segLen = sqrt(100^2+50^2) = sqrt(12500) ≈ 111.80
    // pathT = 80 / 111.80 ≈ 0.7156
    // wx = 0 + 0.7156 * 100 = 71.56; wy = 0 + 0.7156 * 50 = 35.78
    const unit = makeUnit({ pathT: 0, pathIndex: 0, wx: 0, wy: 0 });
    const state = makeState([unit], path);

    system.update(1, state);

    const segLen = Math.sqrt(100 * 100 + 50 * 50);
    const expectedT = (80 * 1) / segLen;
    expect(state.units[0].wx).toBeCloseTo(expectedT * 100, 1);
    expect(state.units[0].wy).toBeCloseTo(expectedT * 50, 1);
  });

  it('ally unit traverses reversed path (last node → first)', () => {
    // 3-node path: [A, B, C]. Ally traverses C→B→A (reversed).
    // Reversed path: [C, B, A]. Segment C→B same length.
    const path: PathNode[] = [
      { wx: 0, wy: 0 },   // index 0 = portal (enemy start)
      { wx: 100, wy: 0 },
      { wx: 200, wy: 0 }, // index 2 = citadel (ally start)
    ];
    // Ally starts at pathIndex=0 in the reversed path, which is node C (wx=200)
    const unit = makeUnit({ faction: 'ally', pathT: 0, pathIndex: 0, wx: 200, wy: 0 });
    const state = makeState([unit], path);

    system.update(1, state);

    // Reversed segment C→B: segLen=100, advance=70*1/100=0.7
    // wx = lerp(200, 100, 0.7) = 200 - 70 = 130
    expect(state.units[0].wx).toBeCloseTo(130, 0);
  });
  it('spreads spawned enemies across configured lane offsets', () => {
    const path: PathNode[] = [
      { wx: 100, wy: 100 },
      { wx: 200, wy: 100 },
      { wx: 300, wy: 100 },
    ];
    const state = makeState([], path);
    state.enemyLaneOffsets = [-20, 0, 20];
    state.spawnQueue = [
      { defKey: 'light-enemy', delay: 0 },
      { defKey: 'light-enemy', delay: 0 },
      { defKey: 'light-enemy', delay: 0 },
    ];

    system.update(0.016, state);

    expect(state.units.map((u) => Math.round(u.wx))).toEqual([100, 100, 100]);
    expect(state.units.map((u) => Math.round(u.wy))).toEqual([100, 100, 100]);
  });

  it('fans enemies out across road width during the first segment after portal spawn', () => {
    const path: PathNode[] = [
      { wx: 100, wy: 100 },
      { wx: 200, wy: 100 },
      { wx: 300, wy: 100 },
    ];
    const state = makeState([], path);
    state.enemyLaneOffsets = [-20, 0, 20];
    state.spawnQueue = [
      { defKey: 'light-enemy', delay: 0 },
      { defKey: 'light-enemy', delay: 0 },
      { defKey: 'light-enemy', delay: 0 },
    ];

    system.update(0.016, state);
    system.update(0.5, state);

    const ys = state.units.map((u) => u.wy);
    const xs = state.units.map((u) => u.wx);

    // They still advance toward citadel along the segment...
    expect(xs.every((x) => x > 120)).toBe(true);
    expect(xs.every((x) => x < 170)).toBe(true);

    // ...but with a softer, not-perfectly-aligned lateral spread.
    expect(new Set(ys.map((y) => Math.round(y))).size).toBeGreaterThan(1);
    expect(ys.every((y) => y > 84 && y < 116)).toBe(true);
  });

  it('moves allies from allyPathNodes when the citadel sits above the road entry', () => {
    const path: PathNode[] = [
      { wx: 0, wy: 0 },
      { wx: 100, wy: 0 },
      { wx: 200, wy: 0 },
    ];
    const unit = makeUnit({ faction: 'ally', pathT: 0, pathIndex: 0, wx: 220, wy: -40 });
    const state = makeState([unit], path);
    state.allyPathNodes = [
      { wx: 220, wy: -40 },
      { wx: 200, wy: 0 },
      { wx: 100, wy: 0 },
      { wx: 0, wy: 0 },
    ];

    system.update(1, state);

    expect(state.units[0].wx).toBeLessThan(220);
    expect(state.units[0].wy).toBeGreaterThan(-40);
  });
});
