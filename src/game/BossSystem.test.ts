import { describe, it, expect, beforeEach } from 'vitest';
import { BossSystem, NEGOTIATION_RESOURCE_REWARD, NEGOTIATION_HP_REWARD, NEGOTIATION_WAVE_TIMER_FLOOR, HORDE_POWER_SCALE } from './BossSystem';
import type { GameState, Unit, UnitDef } from './game.types';

// Minimal factory helpers — no DOM, no real path needed
function makeBossDef(enraged = false): UnitDef {
  return {
    role: 'boss',
    hp: 260,
    speed: 22,
    damage: 18,
    attackRate: 0.75,
    sprite: 'boits',
    faction: 'enemy',
    enraged,
  };
}

function makeBossUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 99,
    def: makeBossDef(),
    faction: 'enemy',
    hp: 260,
    pathIndex: 2,
    pathT: 0.5,
    wx: 100,
    wy: 100,
    state: 'moving',
    fightingWith: null,
    attackCooldown: 0,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    waveNumber: 5,
    waveTimer: 5,
    spawnQueue: [],
    spawnTimer: 0,
    units: [],
    buildings: [],
    projectiles: [],
    impactMarks: [],
    corpses: [],
    citadelHp: 1000,
    citadelMaxHp: 2000,
    playerBaseHp: 300,
    playerBaseMaxHp: 300,
    resources: 50,
    crystals: 0,
    nextId: 1,
    pathNodes: [],
    allyPathNodes: [],
    enemyLaneOffsets: [0],
    ...overrides,
  };
}

describe('BossSystem', () => {
  let system: BossSystem;
  let state: GameState;

  beforeEach(() => {
    system = new BossSystem();
    state = makeState();
  });

  // -----------------------------------------------------------------------
  // Exported constants
  // -----------------------------------------------------------------------
  describe('exported constants', () => {
    it('NEGOTIATION_RESOURCE_REWARD is 120', () => {
      expect(NEGOTIATION_RESOURCE_REWARD).toBe(120);
    });
    it('NEGOTIATION_HP_REWARD is 400', () => {
      expect(NEGOTIATION_HP_REWARD).toBe(400);
    });
    it('NEGOTIATION_WAVE_TIMER_FLOOR is 20', () => {
      expect(NEGOTIATION_WAVE_TIMER_FLOOR).toBe(20);
    });
    it('HORDE_POWER_SCALE is 1.4', () => {
      expect(HORDE_POWER_SCALE).toBe(1.4);
    });
  });

  // -----------------------------------------------------------------------
  // Detection — BOSS-01
  // -----------------------------------------------------------------------
  describe('update() — detection', () => {
    it('does nothing when no boss unit is present', () => {
      state.units = [];
      system.update(1, state, null);
      expect(state.phase).toBe('playing');
      expect(state.bossNegotiation).toBeUndefined();
    });

    it('triggers negotiation when a living unenraged boss is present', () => {
      const boss = makeBossUnit();
      state.units = [boss];
      system.update(1, state, null);
      expect(state.phase).toBe('negotiation');
      expect(state.bossNegotiation).toEqual({ active: true, triggered: true });
    });

    it('does not re-trigger when bossNegotiation.triggered is already true', () => {
      const boss = makeBossUnit();
      state.units = [boss];
      state.bossNegotiation = { active: false, triggered: true };
      state.phase = 'playing';
      system.update(1, state, null);
      expect(state.phase).toBe('playing');
      expect(state.bossNegotiation?.active).toBe(false);
    });

    it('skips an enraged boss — does not trigger negotiation', () => {
      const boss = makeBossUnit({ def: makeBossDef(true) });
      state.units = [boss];
      system.update(1, state, null);
      expect(state.phase).toBe('playing');
      expect(state.bossNegotiation).toBeUndefined();
    });

    it('skips when phase is not playing (e.g. already negotiation)', () => {
      const boss = makeBossUnit();
      state.units = [boss];
      state.phase = 'negotiation';
      state.bossNegotiation = { active: true, triggered: true };
      system.update(1, state, null);
      // must stay in negotiation, not double-trigger
      expect(state.phase).toBe('negotiation');
    });

    it('skips a dead boss (hp <= 0)', () => {
      const boss = makeBossUnit({ hp: 0 });
      state.units = [boss];
      system.update(1, state, null);
      expect(state.phase).toBe('playing');
    });

    it('sets boss unit state to fighting and clears fightingWith on trigger', () => {
      const boss = makeBossUnit({ fightingWith: 42 });
      state.units = [boss];
      system.update(1, state, null);
      expect(boss.state).toBe('fighting');
      expect(boss.fightingWith).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Success path — BOSS-03
  // -----------------------------------------------------------------------
  describe('handleSuccess()', () => {
    beforeEach(() => {
      const boss = makeBossUnit();
      state.units = [boss];
      state.phase = 'negotiation';
      state.bossNegotiation = { active: true, triggered: true };
    });

    it('removes boss from state.units', () => {
      const boss = state.units[0];
      system.handleSuccess(state);
      expect(state.units.find(u => u.id === boss.id)).toBeUndefined();
    });

    it('credits NEGOTIATION_RESOURCE_REWARD to resources', () => {
      const before = state.resources;
      system.handleSuccess(state);
      expect(state.resources).toBe(before + NEGOTIATION_RESOURCE_REWARD);
    });

    it('heals citadel by NEGOTIATION_HP_REWARD capped at citadelMaxHp', () => {
      state.citadelHp = 1000;
      state.citadelMaxHp = 2000;
      system.handleSuccess(state);
      expect(state.citadelHp).toBe(1400);
    });

    it('does not heal citadel above citadelMaxHp', () => {
      state.citadelHp = 1900;
      state.citadelMaxHp = 2000;
      system.handleSuccess(state);
      expect(state.citadelHp).toBe(2000);
    });

    it('ensures waveTimer is at least NEGOTIATION_WAVE_TIMER_FLOOR', () => {
      state.waveTimer = 5;
      system.handleSuccess(state);
      expect(state.waveTimer).toBe(NEGOTIATION_WAVE_TIMER_FLOOR);
    });

    it('preserves a waveTimer already above the floor', () => {
      state.waveTimer = 30;
      system.handleSuccess(state);
      expect(state.waveTimer).toBe(30);
    });

    it('restores phase to playing', () => {
      system.handleSuccess(state);
      expect(state.phase).toBe('playing');
    });

    it('sets bossNegotiation to { active: false, triggered: true, outcome: success }', () => {
      system.handleSuccess(state);
      expect(state.bossNegotiation).toEqual({ active: false, triggered: true, outcome: 'success' });
    });
  });

  // -----------------------------------------------------------------------
  // Failure path — BOSS-04
  // -----------------------------------------------------------------------
  describe('handleFailure()', () => {
    let boss: Unit;

    beforeEach(() => {
      boss = makeBossUnit();
      state.units = [boss];
      state.phase = 'negotiation';
      state.bossNegotiation = { active: true, triggered: true };
    });

    it('marks boss as enraged', () => {
      system.handleFailure(state, boss);
      expect(boss.def.enraged).toBe(true);
    });

    it('scales boss damage by 1.5 (rounded)', () => {
      boss.def.damage = 18;
      system.handleFailure(state, boss);
      expect(boss.def.damage).toBe(Math.round(18 * 1.5)); // 27
    });

    it('enqueues horde: 12 light-enemy, 6 heavy-enemy, 4 ranged-enemy', () => {
      system.handleFailure(state, boss);
      const lightCount = state.spawnQueue.filter(e => e.defKey === 'light-enemy').length;
      const heavyCount = state.spawnQueue.filter(e => e.defKey === 'heavy-enemy').length;
      const rangedCount = state.spawnQueue.filter(e => e.defKey === 'ranged-enemy').length;
      expect(lightCount).toBe(12);
      expect(heavyCount).toBe(6);
      expect(rangedCount).toBe(4);
    });

    it('horde entries use HORDE_POWER_SCALE', () => {
      system.handleFailure(state, boss);
      const allHorde = state.spawnQueue;
      expect(allHorde.every(e => e.powerScale === HORDE_POWER_SCALE)).toBe(true);
    });

    it('horde entries have increasing delays starting at 1.0s in 0.4s steps', () => {
      system.handleFailure(state, boss);
      // First entry delay should be 1.0
      expect(state.spawnQueue[0].delay).toBeCloseTo(1.0);
      // Second entry delay should be 1.4
      expect(state.spawnQueue[1].delay).toBeCloseTo(1.4);
    });

    it('total horde size is 22 entries', () => {
      system.handleFailure(state, boss);
      expect(state.spawnQueue.length).toBe(22);
    });

    it('restores phase to playing', () => {
      system.handleFailure(state, boss);
      expect(state.phase).toBe('playing');
    });

    it('sets bossNegotiation to { active: false, triggered: true, outcome: failure }', () => {
      system.handleFailure(state, boss);
      expect(state.bossNegotiation).toEqual({ active: false, triggered: true, outcome: 'failure' });
    });
  });

  // -----------------------------------------------------------------------
  // forceReset — cleanup on unmount
  // -----------------------------------------------------------------------
  describe('forceReset()', () => {
    it('restores phase from negotiation to playing', () => {
      state.phase = 'negotiation';
      state.bossNegotiation = { active: true, triggered: true };
      system.forceReset(state);
      expect(state.phase).toBe('playing');
    });

    it('does not change phase if not in negotiation', () => {
      state.phase = 'playing';
      system.forceReset(state);
      expect(state.phase).toBe('playing');
    });

    it('can be called safely when no overlay was ever mounted', () => {
      expect(() => system.forceReset(state)).not.toThrow();
    });

    it('marks bossNegotiation.active as false after forceReset', () => {
      state.phase = 'negotiation';
      state.bossNegotiation = { active: true, triggered: true };
      system.forceReset(state);
      expect(state.bossNegotiation?.active).toBe(false);
    });
  });
});
