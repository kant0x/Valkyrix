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

  it('enqueues wave 1 (12 light-enemy + 2 ranged-enemy with staggered delays) when waveTimer hits 0', () => {
    const ctrl = new WaveController();
    const state = makeState({ waveTimer: 5 });

    // dt=5 → waveTimer goes to 0 → triggers wave 1
    ctrl.update(5, state);

    expect(state.waveNumber).toBe(1);
    expect(state.spawnQueue.length).toBe(14); // 12 light + 2 ranged
    const lightCount = state.spawnQueue.filter(e => e.defKey === 'light-enemy').length;
    const rangedCount = state.spawnQueue.filter(e => e.defKey === 'ranged-enemy').length;
    expect(lightCount).toBe(12);
    expect(rangedCount).toBe(2);
    expect(state.spawnQueue[0].delay).toBeCloseTo(0);
    expect(state.spawnQueue[1].delay).toBeCloseTo(0.5);
    expect(state.spawnQueue[0].powerScale).toBeCloseTo(1);
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

  it('wave 2 adds a heavy ally reinforcement before the enemy push', () => {
    const ctrl = new WaveController();
    const state = makeState({ waveNumber: 1, waveTimer: 1 });

    ctrl.update(1, state);  // triggers wave 2

    expect(state.waveNumber).toBe(2);
    expect(state.spawnQueue[0].defKey).toBe('heavy-ally');
    expect(state.spawnQueue[0].powerScale).toBeGreaterThan(1);
    expect(state.spawnQueue[1].defKey).toBe('light-enemy');
  });

  it('wave 3 enqueues reinforcements plus stronger light-enemy and heavy-enemy batches', () => {
    const ctrl = new WaveController();
    const state = makeState({ waveNumber: 2, waveTimer: 1 });

    ctrl.update(1, state);  // triggers wave 3

    expect(state.waveNumber).toBe(3);
    const lightCount = state.spawnQueue.filter(e => e.defKey === 'light-enemy').length;
    const heavyCount = state.spawnQueue.filter(e => e.defKey === 'heavy-enemy').length;
    const rangedCount = state.spawnQueue.filter(e => e.defKey === 'ranged-enemy').length;
    const allyHeavyCount = state.spawnQueue.filter(e => e.defKey === 'heavy-ally').length;
    const allyLightCount = state.spawnQueue.filter(e => e.defKey === 'light-ally').length;
    expect(lightCount).toBe(12);
    expect(heavyCount).toBe(4);
    expect(rangedCount).toBe(4);
    expect(allyHeavyCount).toBe(1);
    expect(allyLightCount).toBe(1);
    expect(state.spawnQueue.find(e => e.defKey === 'heavy-enemy')?.powerScale).toBeGreaterThan(1);
    expect(state.spawnQueue.length).toBe(22); // 12+4+4+1+1
  });

  it('wave 5 includes a boss-enemy after the regular enemy wave', () => {
    const ctrl = new WaveController();
    const state = makeState({ waveNumber: 4, waveTimer: 1 });

    ctrl.update(1, state);  // triggers wave 5

    expect(state.waveNumber).toBe(5);
    const bossEntries = state.spawnQueue.filter(e => e.defKey === 'boss-enemy');
    expect(bossEntries).toHaveLength(1);
    expect(bossEntries[0].powerScale).toBeGreaterThan(1.5);
    expect(state.spawnQueue[state.spawnQueue.length - 1].defKey).toBe('boss-enemy');
  });

  it('spreads ranged enemies across the wave instead of spawning them as one tight block', () => {
    const ctrl = new WaveController();
    const state = makeState({ waveNumber: 4, waveTimer: 1 });

    ctrl.update(1, state); // triggers wave 5

    const rangedDelays = state.spawnQueue
      .filter((entry) => entry.defKey === 'ranged-enemy')
      .map((entry) => entry.delay)
      .sort((a, b) => a - b);

    expect(rangedDelays).toHaveLength(6);
    expect(rangedDelays[0]).toBeGreaterThan(0);
    expect(rangedDelays[rangedDelays.length - 1] - rangedDelays[0]).toBeGreaterThan(8);
    expect(rangedDelays[1] - rangedDelays[0]).toBeGreaterThan(1);
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
