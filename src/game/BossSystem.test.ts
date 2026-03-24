import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BossSystem } from './BossSystem';
import type { GameState } from './game.types';

vi.mock('../screens/NegotiationOverlay', () => ({
  NegotiationOverlay: vi.fn().mockImplementation(() => ({
    mount: vi.fn(),
    unmount: vi.fn(),
  })),
}));

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    elapsed: 0,
    units: [],
    spawnQueue: [],
    bossNegotiation: undefined,
    resources: 50,
    citadelHp: 2000,
    citadelMaxHp: 2000,
    waveTimer: 5,
    nextId: 1,
    pathNodes: [{ wx: 100, wy: 100 }],
    // required fields
    waveNumber: 1,
    spawnTimer: 0,
    buildings: [],
    projectiles: [],
    citadelMaxHp: 2000,
    playerBaseHp: 300,
    playerBaseMaxHp: 300,
    ...overrides,
  } as GameState;
}

describe('BossSystem', () => {
  let system: BossSystem;
  let state: GameState;

  beforeEach(() => {
    system = new BossSystem();
    state = makeState();
  });

  // -------------------------------------------------------------------------
  // 1. timer trigger
  // -------------------------------------------------------------------------
  describe('timer trigger', () => {
    it('does not trigger when elapsed < 300', () => {
      state.elapsed = 0;
      system.update(299, state, null);
      expect(state.phase).toBe('playing');
      expect(state.bossNegotiation).toBeUndefined();
    });

    it('does not trigger at exactly 299.9s', () => {
      state.elapsed = 0;
      system.update(299.9, state, null);
      expect(state.phase).toBe('playing');
    });

    it('triggers negotiation when elapsed reaches 300s', () => {
      state.elapsed = 0;
      system.update(300, state, null);
      expect(state.phase).toBe('negotiation');
      expect(state.bossNegotiation?.active).toBe(true);
      expect(state.bossNegotiation?.triggered).toBe(true);
    });

    it('triggers when elapsed exceeds 300s (multi-tick accumulation)', () => {
      state.elapsed = 299;
      system.update(2, state, null); // 299 + 2 = 301
      expect(state.phase).toBe('negotiation');
    });

    it('does not re-trigger when bossNegotiation.triggered is already true', () => {
      state.elapsed = 290;
      state.bossNegotiation = { active: false, triggered: true };
      system.update(20, state, null);
      expect(state.units.length).toBe(0);
      expect(state.phase).toBe('playing');
    });

    it('accumulates elapsed on state', () => {
      state.elapsed = 10;
      system.update(5, state, null);
      expect(state.elapsed).toBe(15);
    });
  });

  // -------------------------------------------------------------------------
  // 2. boss spawn
  // -------------------------------------------------------------------------
  describe('boss spawn', () => {
    beforeEach(() => {
      state.elapsed = 0;
      state.nextId = 42;
    });

    it('pushes boss unit to state.units on trigger', () => {
      system.update(300, state, null);
      expect(state.units.length).toBe(1);
    });

    it('boss unit has def.role === boss', () => {
      system.update(300, state, null);
      expect(state.units[0].def.role).toBe('boss');
    });

    it('boss unit has def.hp === 500', () => {
      system.update(300, state, null);
      expect(state.units[0].def.hp).toBe(500);
    });

    it('boss unit has faction === enemy', () => {
      system.update(300, state, null);
      expect(state.units[0].faction).toBe('enemy');
    });

    it('boss unit def is a spread copy — not a reference to UNIT_DEFS', () => {
      const { UNIT_DEFS } = require('./game.types');
      system.update(300, state, null);
      expect(state.units[0].def).not.toBe(UNIT_DEFS['boss-enemy']);
    });

    it('boss unit id comes from state.nextId', () => {
      system.update(300, state, null);
      expect(state.units[0].id).toBe(42);
      expect(state.nextId).toBe(43);
    });

    it('boss unit positioned at pathNodes[0]', () => {
      system.update(300, state, null);
      expect(state.units[0].wx).toBe(100);
      expect(state.units[0].wy).toBe(100);
    });

    it('second update at elapsed >= 300 does NOT spawn second boss', () => {
      system.update(300, state, null);
      expect(state.units.length).toBe(1);
      system.update(1, state, null);
      expect(state.units.length).toBe(1);
    });

    it('bossNegotiation after trigger has scale=0 and attemptsLeft=3', () => {
      system.update(300, state, null);
      expect(state.bossNegotiation?.scale).toBe(0);
      expect(state.bossNegotiation?.attemptsLeft).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // 3. handleSuccess
  // -------------------------------------------------------------------------
  describe('handleSuccess', () => {
    beforeEach(() => {
      // Trigger boss first
      state.elapsed = 0;
      system.update(300, state, null);
      // Now in negotiation
    });

    it('removes boss from state.units', () => {
      system.handleSuccess(state);
      const boss = state.units.find(u => u.def.role === 'boss' && u.faction === 'enemy');
      expect(boss).toBeUndefined();
    });

    it('adds 120 to resources', () => {
      const before = state.resources;
      system.handleSuccess(state);
      expect(state.resources).toBe(before + 120);
    });

    it('heals citadel by 400', () => {
      state.citadelHp = 1000;
      state.citadelMaxHp = 2000;
      system.handleSuccess(state);
      expect(state.citadelHp).toBe(1400);
    });

    it('caps citadel heal at citadelMaxHp', () => {
      state.citadelHp = 1800;
      state.citadelMaxHp = 2000;
      system.handleSuccess(state);
      expect(state.citadelHp).toBe(2000);
    });

    it('sets phase back to playing', () => {
      system.handleSuccess(state);
      expect(state.phase).toBe('playing');
    });

    it('sets bossNegotiation.outcome to success', () => {
      system.handleSuccess(state);
      expect(state.bossNegotiation?.outcome).toBe('success');
    });

    it('sets waveTimer to at least 20 when it was lower', () => {
      state.waveTimer = 5;
      system.handleSuccess(state);
      expect(state.waveTimer).toBeGreaterThanOrEqual(20);
    });
  });

  // -------------------------------------------------------------------------
  // 4. handleFailure
  // -------------------------------------------------------------------------
  describe('handleFailure', () => {
    beforeEach(() => {
      state.elapsed = 0;
      system.update(300, state, null);
    });

    it('enrages the boss unit (def.enraged = true)', () => {
      system.handleFailure(state);
      const boss = state.units.find(u => u.def.role === 'boss' && u.faction === 'enemy');
      expect(boss?.def.enraged).toBe(true);
    });

    it('multiplies boss damage by 1.5', () => {
      const originalDamage = state.units.find(u => u.def.role === 'boss')!.def.damage;
      system.handleFailure(state);
      const boss = state.units.find(u => u.def.role === 'boss')!;
      expect(boss.def.damage).toBe(Math.round(originalDamage * 1.5));
    });

    it('enqueues heavy-enemy x8 in spawnQueue', () => {
      system.handleFailure(state);
      const heavyCount = state.spawnQueue.filter(e => e.defKey === 'heavy-enemy').length;
      expect(heavyCount).toBe(8);
    });

    it('enqueues ranged-enemy x6 in spawnQueue', () => {
      system.handleFailure(state);
      const rangedCount = state.spawnQueue.filter(e => e.defKey === 'ranged-enemy').length;
      expect(rangedCount).toBe(6);
    });

    it('does NOT enqueue any light-enemy', () => {
      system.handleFailure(state);
      const lightCount = state.spawnQueue.filter(e => e.defKey === 'light-enemy').length;
      expect(lightCount).toBe(0);
    });

    it('total horde is 14 entries (8 heavy + 6 ranged)', () => {
      system.handleFailure(state);
      expect(state.spawnQueue.length).toBe(14);
    });

    it('horde delays start at 1.0s', () => {
      system.handleFailure(state);
      expect(state.spawnQueue[0].delay).toBeCloseTo(1.0);
    });

    it('horde delays increase by 0.4s each step', () => {
      system.handleFailure(state);
      expect(state.spawnQueue[1].delay).toBeCloseTo(1.4);
      expect(state.spawnQueue[2].delay).toBeCloseTo(1.8);
    });

    it('sets phase back to playing', () => {
      system.handleFailure(state);
      expect(state.phase).toBe('playing');
    });

    it('sets bossNegotiation.outcome to failure', () => {
      system.handleFailure(state);
      expect(state.bossNegotiation?.outcome).toBe('failure');
    });

    it('boss stays in state.units after failure (not removed)', () => {
      system.handleFailure(state);
      const boss = state.units.find(u => u.def.role === 'boss' && u.faction === 'enemy');
      expect(boss).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 5. forceReset
  // -------------------------------------------------------------------------
  describe('forceReset', () => {
    it('does not throw when no overlay was mounted', () => {
      expect(() => system.forceReset(state)).not.toThrow();
    });

    it('sets bossNegotiation.active to false', () => {
      state.bossNegotiation = { active: true, triggered: true };
      system.forceReset(state);
      expect(state.bossNegotiation?.active).toBe(false);
    });

    it('sets bossNegotiation.triggered to false', () => {
      state.bossNegotiation = { active: true, triggered: true };
      system.forceReset(state);
      expect(state.bossNegotiation?.triggered).toBe(false);
    });

    it('resets elapsed to 0', () => {
      state.elapsed = 350;
      system.forceReset(state);
      expect(state.elapsed).toBe(0);
    });

    it('works when bossNegotiation is undefined', () => {
      state.bossNegotiation = undefined;
      expect(() => system.forceReset(state)).not.toThrow();
    });

    it('unmounts overlay when forceReset called after trigger', () => {
      state.elapsed = 0;
      const container = { appendChild: vi.fn() } as unknown as HTMLElement;
      system.update(300, state, container);
      expect(() => system.forceReset(state)).not.toThrow();
    });
  });
});
