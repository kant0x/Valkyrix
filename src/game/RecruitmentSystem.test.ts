import { afterEach, describe, expect, it, vi } from 'vitest';
import { canRecruitUnit, recruitUnit } from './RecruitmentSystem';
import type { GameState } from './game.types';
import type { BlockchainService } from '../blockchain/BlockchainService';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    waveNumber: 1,
    waveTimer: 10,
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
    lastVikingRecruitAtMs: 0,
    nextId: 1,
    pathNodes: [],
    ...overrides,
  };
}

describe('RecruitmentSystem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queues a viking from the citadel and spends 30 energy', () => {
    const state = makeState({ resources: 50 });

    const result = recruitUnit('light-ally', state);

    expect(result.ok).toBe(true);
    expect(state.resources).toBe(20);
    expect(state.spawnQueue).toEqual([{ defKey: 'light-ally', delay: 0 }]);
  });

  it('queues a collector and spends 20 energy', () => {
    const state = makeState({ resources: 40 });

    const result = recruitUnit('collector', state);

    expect(result.ok).toBe(true);
    expect(state.resources).toBe(20);
    expect(state.spawnQueue).toEqual([{ defKey: 'collector', delay: 0 }]);
  });

  it('refuses recruitment when battle is not in playing state', () => {
    const state = makeState({ phase: 'paused' });

    const result = recruitUnit('light-ally', state);

    expect(result.ok).toBe(false);
    expect(state.spawnQueue).toHaveLength(0);
  });

  it('reports affordability for viking and collector costs', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    expect(canRecruitUnit('light-ally', makeState({ resources: 30 }))).toBe(true);
    expect(canRecruitUnit('light-ally', makeState({ resources: 29 }))).toBe(false);
    expect(canRecruitUnit('light-ally', makeState({ resources: 30, lastVikingRecruitAtMs: 9_000 }))).toBe(false);
    expect(canRecruitUnit('collector', makeState({ resources: 20 }))).toBe(true);
    expect(canRecruitUnit('collector', makeState({ resources: 19 }))).toBe(false);
  });

  it('calls recordCreate when a unit is recruited', () => {
    const recordCreate = vi.fn(async () => undefined);
    const state = makeState({ resources: 50 });

    const result = recruitUnit('light-ally', state, { recordCreate } as unknown as BlockchainService);

    expect(result.ok).toBe(true);
    expect(recordCreate).toHaveBeenCalledWith('light-ally', null);
  });

  it('summons a cybernetic drop pod when enough latfa is available', () => {
    const state = makeState({
      latfa: 12,
      allyPathNodes: [
        { wx: 220, wy: -40 },
        { wx: 180, wy: -10 },
        { wx: 120, wy: 10 },
        { wx: 80, wy: 12 },
        { wx: 30, wy: 16 },
        { wx: -20, wy: 18 },
      ],
    });

    const result = recruitUnit('cybernetic', state);

    expect(result.ok).toBe(true);
    expect(state.latfa).toBe(0);
    expect(state.dropPods).toHaveLength(1);
    expect(state.dropPods?.[0].spawnCount).toBe(3);
    // Pod lands near the anchor (within 50px), offset perpendicular to path
    const pod = state.dropPods![0];
    expect(Math.hypot(pod.wx - pod.anchorWx, pod.wy - (pod.anchorWy - 24))).toBeLessThan(50);
    expect(pod.anchorWx).toBe(-20);
    expect(pod.anchorWy).toBe(18);
  });

  it('blocks viking recruitment until 1.2 seconds have passed', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const state = makeState({ resources: 100, lastVikingRecruitAtMs: 8_900 });

    const result = recruitUnit('light-ally', state);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('1.2 seconds');
    expect(state.spawnQueue).toHaveLength(0);
  });

  it('allows viking recruitment again after 1.2 seconds and stamps cooldown', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const state = makeState({ resources: 100, lastVikingRecruitAtMs: 8_800 });

    const result = recruitUnit('light-ally', state);

    expect(result.ok).toBe(true);
    expect(state.lastVikingRecruitAtMs).toBe(10_000);
    expect(state.spawnQueue).toEqual([{ defKey: 'light-ally', delay: 0 }]);
  });

  it('blocks cybernetic summons after three calls within one minute', () => {
    const now = Date.now();
    const state = makeState({
      latfa: 40,
      cyberneticCallTimestamps: [now - 1000, now - 2000, now - 3000],
    });

    const result = recruitUnit('cybernetic', state);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('45 seconds');
  });
});
