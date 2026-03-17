import { describe, it, expect } from 'vitest';
import { ResourceSystem, registerKill } from './ResourceSystem';
import type { GameState } from './game.types';

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
      buffValue: 0, resourceRate: 5, // 5/s
    });
    state.buildings.push({
      id: 2, type: 'buff', wx: 0, wy: 0, tileCol: 1, tileRow: 0,
      radius: 128, damage: 0, attackRate: 0, attackCooldown: 0,
      buffValue: 0.25, resourceRate: 3, // 3/s
    });

    system.update(1.0, state); // 1 full second → 5 + 3 = 8

    expect(state.resources).toBeCloseTo(8);
  });

  it('accumulates fractional income correctly over sub-second dt', () => {
    const state = makeState({ resources: 10 });
    state.buildings.push({
      id: 1, type: 'attack', wx: 0, wy: 0, tileCol: 0, tileRow: 0,
      radius: 160, damage: 30, attackRate: 1.0, attackCooldown: 0,
      buffValue: 0, resourceRate: 5,
    });

    system.update(0.016, state); // 16ms → 5 * 0.016 = 0.08 added

    expect(state.resources).toBeCloseTo(10.08);
  });
});

describe('registerKill', () => {
  it('adds +5 for light-enemy kill', () => {
    const state = makeState({ resources: 50 });
    registerKill('light-enemy', state);
    expect(state.resources).toBe(55);
  });

  it('adds +15 for heavy-enemy kill', () => {
    const state = makeState({ resources: 50 });
    registerKill('heavy-enemy', state);
    expect(state.resources).toBe(65);
  });

  it('adds +10 for ranged-enemy kill', () => {
    const state = makeState({ resources: 50 });
    registerKill('ranged-enemy', state);
    expect(state.resources).toBe(60);
  });
});
