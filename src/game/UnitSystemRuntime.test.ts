import { describe, expect, it } from 'vitest';
import { UnitSystem } from './UnitSystemRuntime';
import type { GameState, Unit } from './game.types';
import { UNIT_DEFS } from './game.types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    waveNumber: 1,
    waveTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    units: [],
    buildings: [],
    projectiles: [],
    citadelHp: 500,
    citadelMaxHp: 500,
    playerBaseHp: 300,
    playerBaseMaxHp: 300,
    resources: 100,
    crystals: 0,
    latfa: 0,
    latfaDrops: [],
    dropPods: [],
    cyberneticCallTimestamps: [],
    nextId: 1,
    pathNodes: [
      { wx: 0, wy: 0 },
      { wx: 100, wy: 0 },
      { wx: 200, wy: 0 },
    ],
    allyPathNodes: [
      { wx: 220, wy: -40 },
      { wx: 200, wy: 0 },
      { wx: 100, wy: 0 },
      { wx: 0, wy: 0 },
    ],
    ...overrides,
  };
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    def: UNIT_DEFS['light-ally'],
    faction: 'ally',
    hp: UNIT_DEFS['light-ally'].hp,
    pathIndex: 0,
    pathT: 0,
    wx: 220,
    wy: -40,
    state: 'moving',
    fightingWith: null,
    attackCooldown: 0,
    ...overrides,
  };
}

describe('UnitSystemRuntime', () => {
  it('spawns ally units from the authored ally path so they leave the citadel itself', () => {
    const state = makeState({
      spawnQueue: [{ defKey: 'light-ally', delay: 0 }],
    });
    const system = new UnitSystem();

    system.update(0.016, state);

    expect(state.units).toHaveLength(1);
    expect(state.units[0].faction).toBe('ally');
    expect(state.units[0].wx).toBeCloseTo(220);
    expect(state.units[0].wy).toBeCloseTo(-40);
  });

  it('moves ally units along the authored ally path instead of ground tiles below the citadel', () => {
    const state = makeState({
      units: [makeUnit({ wx: 220, wy: -40 })],
    });
    const system = new UnitSystem();

    system.update(1, state);

    expect(state.units[0].wx).toBeLessThan(220);
    expect(state.units[0].wy).toBeGreaterThan(-40);
  });

  it('resyncs a displaced melee unit to its current path progress instead of snapping back after combat', () => {
    const state = makeState({
      units: [
        makeUnit({
          id: 21,
          def: UNIT_DEFS['light-enemy'],
          faction: 'enemy',
          state: 'moving',
          pathIndex: 0,
          pathT: 0,
          wx: 120,
          wy: 0,
        }),
      ],
    });
    const system = new UnitSystem();

    system.update(0.1, state);

    expect(state.units[0].wx).toBeGreaterThan(120);
    expect(state.units[0].wx).toBeLessThan(130);
    expect(state.units[0].pathIndex).toBe(1);
  });

  it('applies spawnQueue power scaling to spawned units', () => {
    const state = makeState({
      spawnQueue: [{ defKey: 'heavy-enemy', delay: 0, powerScale: 1.5 }],
    });
    const system = new UnitSystem();

    system.update(0.016, state);

    expect(state.units).toHaveLength(1);
    expect(state.units[0].faction).toBe('enemy');
    expect(state.units[0].hp).toBeGreaterThan(UNIT_DEFS['heavy-enemy'].hp);
    expect(state.units[0].def.damage).toBeGreaterThan(UNIT_DEFS['heavy-enemy'].damage);
  });

  it('applies speedBuff to ally movement in the runtime system', () => {
    const state = makeState({
      units: [makeUnit({ speedBuff: 1.5 })],
    });
    const system = new UnitSystem();

    system.update(1, state);

    expect(state.units[0].wx).toBeCloseTo(181.72, 1);
    expect(state.units[0].wy).toBeCloseTo(0, 1);
  });

  it('freezes boss unit movement during negotiation phase', () => {
    const state = makeState({
      phase: 'negotiation',
      units: [makeUnit({
        id: 10,
        def: { ...UNIT_DEFS['light-enemy'], role: 'boss', hp: 260, damage: 18, speed: 22, attackRate: 0.75 },
        faction: 'enemy',
        pathIndex: 0,
        pathT: 0.2,
        wx: 20,
        wy: 0,
      })],
    });
    const beforePathT = state.units[0].pathT;
    const beforeWx = state.units[0].wx;
    const system = new UnitSystem();

    system.update(1, state);

    expect(state.units[0].pathT).toBe(beforePathT);
    expect(state.units[0].wx).toBe(beforeWx);
  });

  it('allows regular enemy unit to move during negotiation phase', () => {
    const state = makeState({
      phase: 'negotiation',
      units: [makeUnit({
        id: 11,
        def: UNIT_DEFS['light-enemy'],
        faction: 'enemy',
        pathIndex: 0,
        pathT: 0,
        wx: 0,
        wy: 0,
      })],
    });
    const system = new UnitSystem();

    system.update(1, state);

    expect(state.units[0].pathT).toBeGreaterThan(0);
  });

  it('allows boss unit to move normally during playing phase', () => {
    const state = makeState({
      phase: 'playing',
      units: [makeUnit({
        id: 12,
        def: { ...UNIT_DEFS['light-enemy'], role: 'boss', hp: 260, damage: 18, speed: 22, attackRate: 0.75 },
        faction: 'enemy',
        pathIndex: 0,
        pathT: 0,
        wx: 0,
        wy: 0,
      })],
    });
    const system = new UnitSystem();

    system.update(1, state);

    expect(state.units[0].pathT).toBeGreaterThan(0);
  });

  it('keeps collectors hovering back near the citadel when there are no crystals to gather', () => {
    const anchor = { wx: 220, wy: -40 };
    const state = makeState({
      crystals: 0,
      units: [makeUnit({
        def: UNIT_DEFS.collector,
        hp: UNIT_DEFS.collector.hp,
        wx: 340,
        wy: 110,
      })],
      allyPathNodes: [anchor, { wx: 200, wy: 0 }, { wx: 100, wy: 0 }],
    });
    const system = new UnitSystem();

    system.update(1, state);

    const before = Math.hypot(340 - anchor.wx, 110 - anchor.wy);
    const after = Math.hypot(state.units[0].wx - anchor.wx, state.units[0].wy - anchor.wy);
    expect(after).toBeLessThan(before);
    expect(after).toBeLessThan(170);
  });

  it('has collectors gather latfa drops from the field', () => {
    const state = makeState({
      crystals: 0,
      latfa: 0,
      latfaDrops: [{ id: 90, wx: 230, wy: -32, value: 2, kind: 'latfa' }],
      units: [makeUnit({
        def: UNIT_DEFS.collector,
        hp: UNIT_DEFS.collector.hp,
        wx: 225,
        wy: -35,
      })],
    });
    const system = new UnitSystem();

    system.update(0.2, state);

    expect(state.latfa).toBe(2);
    expect(state.latfaDrops).toHaveLength(0);
  });

  it('sends different collectors to different salvage drops when multiple drops exist', () => {
    const collectorA = makeUnit({
      id: 90,
      def: UNIT_DEFS.collector,
      hp: UNIT_DEFS.collector.hp,
      wx: 220,
      wy: -40,
    });
    const collectorB = makeUnit({
      id: 91,
      def: UNIT_DEFS.collector,
      hp: UNIT_DEFS.collector.hp,
      wx: 228,
      wy: -36,
    });
    const state = makeState({
      latfaDrops: [
        { id: 1, wx: 240, wy: -30, value: 2, kind: 'latfa' },
        { id: 2, wx: 320, wy: -10, value: 2, kind: 'latfa' },
      ],
      units: [collectorA, collectorB],
    });
    const system = new UnitSystem();

    system.update(0.5, state);

    const updatedA = state.units.find((unit) => unit.id === 90)!;
    const updatedB = state.units.find((unit) => unit.id === 91)!;
    expect(updatedA.wx).toBeLessThan(updatedB.wx);
    expect(updatedA.wx).toBeGreaterThan(220);
    expect(updatedB.wx).toBeGreaterThan(228);
  });

  it('activates the collector guard field for 15 seconds when enemies get too close', () => {
    const state = makeState({
      units: [
        makeUnit({
          id: 30,
          def: UNIT_DEFS.collector,
          hp: UNIT_DEFS.collector.hp,
          wx: 225,
          wy: -32,
        }),
        makeUnit({
          id: 31,
          def: UNIT_DEFS['light-enemy'],
          faction: 'enemy',
          hp: UNIT_DEFS['light-enemy'].hp,
          wx: 230,
          wy: -28,
        }),
      ],
    });
    const system = new UnitSystem();

    system.update(0.1, state);

    expect(state.units[0].collectorShield).toBeCloseTo(15);
  });

  it('deploys three cybernetics from a finished drop pod', () => {
    const state = makeState({
      dropPods: [{ id: 44, wx: 220, wy: -40, anchorWx: 220, anchorWy: -16, elapsed: 2.8, spawnCount: 3, releasedCount: 0 }],
    });
    const system = new UnitSystem();

    system.update(0.05, state);

    const cybernetics = state.units.filter((unit) => unit.def.sprite === 'cybernetic');
    expect(cybernetics).toHaveLength(3);
    expect(cybernetics.every((unit) => (unit.spawnShield ?? 0) > 0)).toBe(true);
    expect(state.dropPods?.[0].releasedCount).toBe(3);
  });

  it('keeps cybernetics on the capsule landing segment instead of snapping back to the citadel gate', () => {
    const state = makeState({
      allyPathNodes: [
        { wx: 220, wy: -40 },
        { wx: 160, wy: 0 },
        { wx: 100, wy: 0 },
        { wx: 40, wy: 0 },
      ],
      dropPods: [{ id: 45, wx: 98, wy: -4, anchorWx: 100, anchorWy: 0, elapsed: 2.8, spawnCount: 3, releasedCount: 0 }],
    });
    const system = new UnitSystem();

    system.update(0.05, state);

    const cybernetic = state.units.find((unit) => unit.def.sprite === 'cybernetic');
    expect(cybernetic).toBeTruthy();
    expect(cybernetic!.pathIndex).toBeGreaterThan(0);
    expect(cybernetic!.wx).toBeLessThan(130);
  });
});
