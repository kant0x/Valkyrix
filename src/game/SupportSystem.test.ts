import { describe, expect, it, vi } from 'vitest';
import { activateSupport, canActivateSupport, getSupportDamageMultiplier, updateSupport } from './SupportSystem';
import type { GameState } from './game.types';
import { UNIT_DEFS } from './game.types';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    waveNumber: 2,
    waveTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    units: [],
    buildings: [],
    projectiles: [],
    impactMarks: [],
    corpses: [],
    citadelHp: 2000,
    citadelMaxHp: 2000,
    playerBaseHp: 300,
    playerBaseMaxHp: 300,
    resources: 100,
    crystals: 0,
    latfa: 0,
    schematics: 10,
    latfaDrops: [],
    dropPods: [],
    cyberneticCallTimestamps: [],
    lastVikingRecruitAtMs: 0,
    supportCooldowns: {
      overdrive: 0,
      'orbital-drop': 0,
      'missile-grid': 0,
      'siege-lance': 0,
    },
    supportOverdriveTimer: 0,
    supportOverdrivePulseTimer: 0,
    nextId: 1,
    pathNodes: [],
    ...overrides,
  };
}

describe('SupportSystem', () => {
  it('activates overdrive when enemies are present and opens an orbital strike window', () => {
    const ally = {
      id: 1,
      def: UNIT_DEFS['light-ally'],
      faction: 'ally' as const,
      hp: UNIT_DEFS['light-ally'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 0,
      wy: 0,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const enemy = {
      id: 2,
      def: UNIT_DEFS['light-enemy'],
      faction: 'enemy' as const,
      hp: UNIT_DEFS['light-enemy'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 24,
      wy: 0,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const state = makeState({ units: [ally, enemy] });

    expect(canActivateSupport('overdrive', state)).toBe(true);
    const result = activateSupport('overdrive', state);

    expect(result.ok).toBe(true);
    expect(state.schematics).toBe(8);
    updateSupport(0.1, state);
    expect(state.units[0].attackBuff).toBeUndefined();
    expect(state.units[0].defenseBuff).toBeUndefined();
    expect(state.units[0].buffAura).toBeUndefined();
    expect(state.impactMarks?.length).toBeGreaterThan(0);
    expect(state.units[1].hp).toBeLessThan(UNIT_DEFS['light-enemy'].hp);
    expect(getSupportDamageMultiplier(state, state.units[0])).toBe(1);
  });

  it('overdrive damages enemy clusters as an orbital weapon', () => {
    const enemyA = {
      id: 2,
      def: UNIT_DEFS['light-enemy'],
      faction: 'enemy' as const,
      hp: UNIT_DEFS['light-enemy'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 24,
      wy: 0,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const enemyB = {
      id: 3,
      def: UNIT_DEFS['light-enemy'],
      faction: 'enemy' as const,
      hp: UNIT_DEFS['light-enemy'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 48,
      wy: 8,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const state = makeState({ units: [enemyA, enemyB] });

    const result = activateSupport('overdrive', state);

    expect(result.ok).toBe(true);
    updateSupport(0.1, state);
    expect(state.units[0].hp).toBeLessThan(UNIT_DEFS['light-enemy'].hp);
    expect(state.units[1].hp).toBeLessThan(UNIT_DEFS['light-enemy'].hp);
  });

  it('keeps salvage surge active while energy remains and drains 15 to 25 per second', () => {
    const allyA = {
      id: 1,
      def: UNIT_DEFS['light-ally'],
      faction: 'ally' as const,
      hp: UNIT_DEFS['light-ally'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 0,
      wy: 0,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const allyB = {
      id: 2,
      def: UNIT_DEFS['heavy-ally'],
      faction: 'ally' as const,
      hp: UNIT_DEFS['heavy-ally'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 32,
      wy: 0,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const state = makeState({ resources: 100, salvageModeActive: true, units: [allyA, allyB] });

    updateSupport(1, state);

    expect(state.resources).toBeCloseTo(81, 5);
    expect(state.salvageModeActive).toBe(true);
    expect(state.units[0].attackBuff).toBeGreaterThan(1);
    expect(state.units[0].defenseBuff).toBeLessThan(1);
    expect(state.units[0].buffAura).toBe('tower');
  });

  it('shuts salvage surge off automatically when energy is exhausted', () => {
    const ally = {
      id: 1,
      def: UNIT_DEFS['light-ally'],
      faction: 'ally' as const,
      hp: UNIT_DEFS['light-ally'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 0,
      wy: 0,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const state = makeState({ resources: 10, salvageModeActive: true, units: [ally] });

    updateSupport(1, state);

    expect(state.resources).toBe(0);
    expect(state.salvageModeActive).toBe(false);
    expect(state.units[0].attackBuff).toBeUndefined();
  });

  it('orbital purge creates impact mark immediately and kills enemies after the impact delay', async () => {
    const enemy = {
      id: 2,
      def: UNIT_DEFS['heavy-enemy'],
      faction: 'enemy' as const,
      hp: UNIT_DEFS['heavy-enemy'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 100,
      wy: 100,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const recordKill = vi.fn(async () => undefined);
    const state = makeState({ units: [enemy] });

    const result = activateSupport('orbital-drop', state, { recordKill } as never);

    expect(result.ok).toBe(true);
    // Visual mark appears immediately (telegraph phase)
    expect(state.impactMarks).toHaveLength(1);
    // Enemy still alive — damage hasn't fired yet
    expect(state.units[0].hp).toBeGreaterThan(0);
    expect(recordKill).not.toHaveBeenCalled();

    // Tick through impact delay (1.1 s) — laser hits the ground
    updateSupport(1.1, state, { recordKill } as never);

    expect(state.units[0].hp).toBe(0);
    expect(recordKill).toHaveBeenCalledTimes(1);
  });

  it('uses the manually selected support point instead of auto-targeting', () => {
    const enemy = {
      id: 3,
      def: UNIT_DEFS['light-enemy'],
      faction: 'enemy' as const,
      hp: UNIT_DEFS['light-enemy'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 400,
      wy: 400,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const closeEnemy = {
      id: 4,
      def: UNIT_DEFS['light-enemy'],
      faction: 'enemy' as const,
      hp: UNIT_DEFS['light-enemy'].hp,
      pathIndex: 0,
      pathT: 0,
      wx: 110,
      wy: 100,
      state: 'moving' as const,
      fightingWith: null,
      attackCooldown: 0,
    };
    const state = makeState({ units: [enemy, closeEnemy] });

    const result = activateSupport('siege-lance', state, undefined, { wx: 100, wy: 100 });

    expect(result.ok).toBe(true);
    expect(state.units[0].hp).toBe(UNIT_DEFS['light-enemy'].hp);
    expect(state.units[1].hp).toBe(0);
    expect(state.impactMarks?.[0]?.wx).toBe(100);
    expect(state.impactMarks?.[0]?.wy).toBe(100);
  });
});
