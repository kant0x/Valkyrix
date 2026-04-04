import { describe, it, expect } from 'vitest';
import { ResourceSystem, registerKill } from './ResourceSystem';
import { UNIT_DEFS, type GameState } from './game.types';

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
    lastVikingRecruitAtMs: 0,
    nextId: 1,
    pathNodes: [],
    ...overrides,
  };
}

const system = new ResourceSystem();

describe('ResourceSystem.update — passive income', () => {
  it('accumulates passive income from all buildings each frame', () => {
    const state = makeState({ resources: 0 });
    state.buildings.push({
      id: 1, type: 'attack', wx: 0, wy: 0, tileCol: 0, tileRow: 0,
      radius: 160, damage: 30, attackRate: 1.0, attackCooldown: 0,
      buffValue: 0, resourceRate: 5, hp: 100, maxHp: 100, // 5/s
    });
    state.buildings.push({
      id: 2, type: 'buff', wx: 0, wy: 0, tileCol: 1, tileRow: 0,
      radius: 128, damage: 0, attackRate: 0, attackCooldown: 0,
      buffValue: 0.25, resourceRate: 3, hp: 100, maxHp: 100, // 3/s
    });

    system.update(1.0, state); // 1 full second → 5 + 3 = 8

    expect(state.resources).toBeCloseTo(28);
  });

  it('accumulates fractional income correctly over sub-second dt', () => {
    const state = makeState({ resources: 10 });
    state.buildings.push({
      id: 1, type: 'attack', wx: 0, wy: 0, tileCol: 0, tileRow: 0,
      radius: 160, damage: 30, attackRate: 1.0, attackCooldown: 0,
      buffValue: 0, resourceRate: 5, hp: 100, maxHp: 100,
    });

    system.update(0.016, state); // 16ms → 5 * 0.016 = 0.08 added

    expect(state.resources).toBeCloseTo(10.4);
  });
});

describe('registerKill', () => {
  it('adds +5 crystals for light-enemy kill', () => {
    const state = makeState({ resources: 50, crystals: 0 });
    registerKill('light-enemy', state, { wx: 10, wy: 20 });
    expect(state.resources).toBe(50);
    expect(state.crystals).toBe(5);
    expect(state.latfaDrops).toHaveLength(1);
  });

  it('adds +15 crystals for heavy-enemy kill', () => {
    const state = makeState({ resources: 50, crystals: 0 });
    registerKill('heavy-enemy', state, { wx: 10, wy: 20 });
    expect(state.resources).toBe(50);
    expect(state.crystals).toBe(15);
  });

  it('adds +10 crystals for ranged-enemy kill', () => {
    const state = makeState({ resources: 50, crystals: 0 });
    registerKill('ranged-enemy', state, { wx: 10, wy: 20 });
    expect(state.resources).toBe(50);
    expect(state.crystals).toBe(10);
  });

  it('adds +80 crystals for boss-enemy kill', () => {
    const state = makeState({ resources: 50, crystals: 0 });
    registerKill('boss-enemy', state, { wx: 10, wy: 20 });
    expect(state.resources).toBe(50);
    expect(state.crystals).toBe(80);
    expect(state.latfaDrops?.some((drop) => drop.kind === 'schematic' && drop.value === 3)).toBe(true);
  });
});

describe('ResourceSystem.update — collector processing', () => {
  it('converts stored crystals into energy while a collector is alive', () => {
    const state = makeState({
      resources: 0,
      crystals: 12,
      units: [{
        id: 1,
        def: UNIT_DEFS.collector,
        faction: 'ally',
        hp: UNIT_DEFS.collector.hp,
        pathIndex: 0,
        pathT: 0,
        wx: 0,
        wy: 0,
        state: 'moving',
        fightingWith: null,
        attackCooldown: 0,
      }],
    });

    system.update(1, state);

    expect(state.resources).toBeCloseTo(12);
    expect(state.crystals).toBeCloseTo(0);
  });
});
