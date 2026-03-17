import { describe, it, expect } from 'vitest';
import { WaveController } from './WaveController';
import type { GameState } from './game.types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    waveNumber: 0,
    waveTimer: 15,
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

describe('WaveController', () => {
  it('decrements waveTimer by dt each call', () => {
    const ctrl = new WaveController();
    const state = makeState({ waveTimer: 15 });

    ctrl.update(3, state);

    expect(state.waveTimer).toBeCloseTo(12);
    expect(state.waveNumber).toBe(0);
    expect(state.spawnQueue.length).toBe(0);
  });

  it('enqueues wave 1 (20 light-enemy with staggered 0.5s delays) when waveTimer hits 0', () => {
    const ctrl = new WaveController();
    const state = makeState({ waveTimer: 5 });

    // dt=5 → waveTimer goes to 0 → triggers wave 1
    ctrl.update(5, state);

    expect(state.waveNumber).toBe(1);
    expect(state.spawnQueue.length).toBe(20);
    // All light-enemy
    expect(state.spawnQueue.every(e => e.defKey === 'light-enemy')).toBe(true);
    // Delays: 0, 0.5, 1.0, ... 9.5
    expect(state.spawnQueue[0].delay).toBeCloseTo(0);
    expect(state.spawnQueue[1].delay).toBeCloseTo(0.5);
    expect(state.spawnQueue[19].delay).toBeCloseTo(9.5);
  });

  it('resets waveTimer per escalation table after triggering wave', () => {
    const ctrl = new WaveController();
    // Wave 1 → next interval should be 15s (wave 1 uses 15s interval)
    // But waveTimer is reset AFTER incrementing waveNumber (waveNumber becomes 1)
    // nextInterval(1) = 15s
    const state = makeState({ waveTimer: 5 });
    ctrl.update(5, state);
    // waveTimer reset to 15 (next interval for wave 1 done, now wait for wave 2)
    // nextInterval uses the NEW waveNumber after increment
    // waveNumber=1 → nextInterval(1) = 15s
    expect(state.waveTimer).toBeCloseTo(15);

    // Trigger wave 2: waveTimer=15, dt=15 → waveNumber=2 → nextInterval(2)=13s
    const state2 = makeState({ waveTimer: 15 });
    ctrl.update(15, state2);
    expect(state2.waveNumber).toBe(1);
    expect(state2.waveTimer).toBeCloseTo(15);
  });

  it('wave 3 enqueues light-enemy AND heavy-enemy batches', () => {
    const ctrl = new WaveController();
    // Jump to just before wave 3: waveNumber=2, waveTimer=0
    const state = makeState({ waveNumber: 2, waveTimer: 1 });

    ctrl.update(1, state);  // triggers wave 3

    expect(state.waveNumber).toBe(3);
    const lightCount = state.spawnQueue.filter(e => e.defKey === 'light-enemy').length;
    const heavyCount = state.spawnQueue.filter(e => e.defKey === 'heavy-enemy').length;
    expect(lightCount).toBe(20);
    expect(heavyCount).toBe(5);
    expect(state.spawnQueue.length).toBe(25);
  });

  it('does nothing if phase is not playing', () => {
    const ctrl = new WaveController();
    const state = makeState({ phase: 'paused', waveTimer: 5 });

    ctrl.update(5, state);

    expect(state.waveTimer).toBe(5);
    expect(state.waveNumber).toBe(0);
    expect(state.spawnQueue.length).toBe(0);

    const stateWon = makeState({ phase: 'won', waveTimer: 5 });
    ctrl.update(5, stateWon);
    expect(stateWon.waveTimer).toBe(5);

    const stateLost = makeState({ phase: 'lost', waveTimer: 5 });
    ctrl.update(5, stateLost);
    expect(stateLost.waveTimer).toBe(5);
  });
});
