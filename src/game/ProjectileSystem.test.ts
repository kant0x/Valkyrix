import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectileSystem } from './ProjectileSystem';
import type { GameState, Unit, Projectile } from './game.types';
import type { BlockchainService } from '../blockchain/BlockchainService';

vi.mock('../wallet/WalletService', () => ({
  getCurrentState: vi.fn(() => ({
    connected: true,
    publicKey: '11111111111111111111111111111111',
    walletType: 'phantom',
  })),
}));

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
    nextId: 1,
    pathNodes: [],
    ...overrides,
  };
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 1,
    def: { role: 'light', hp: 40, speed: 80, damage: 8, attackRate: 1.0, sprite: '', faction: 'enemy' },
    faction: 'enemy',
    hp: 40,
    pathIndex: 0,
    pathT: 0,
    wx: 200,
    wy: 100,
    state: 'moving',
    fightingWith: null,
    attackCooldown: 0,
    ...overrides,
  };
}

function makeProjectile(overrides: Partial<Projectile> = {}): Projectile {
  return {
    id: 10,
    wx: 0,
    wy: 0,
    targetUnitId: 1,
    speed: 400,
    damage: 30,
    ...overrides,
  };
}

describe('ProjectileSystem.update', () => {
  let system: ProjectileSystem;

  beforeEach(() => {
    system = new ProjectileSystem();
  });

  it('moves projectile toward target each frame', () => {
    const state = makeState();
    const target = makeUnit({ id: 1, wx: 100, wy: 0 });
    state.units.push(target);
    const proj = makeProjectile({ wx: 0, wy: 0, targetUnitId: 1, speed: 400 });
    state.projectiles.push(proj);

    system.update(0.1, state); // dt=0.1s → moves 40 world units toward target at (100,0)

    // Projectile should have moved toward (100, 0) by 40 units
    // direction: (100-0, 0-0) normalized = (1, 0)
    expect(state.projectiles.length).toBe(1);
    expect(state.projectiles[0].wx).toBeCloseTo(40);
    expect(state.projectiles[0].wy).toBeCloseTo(0);
  });

  it('removes projectile and deals damage on hit (dist < 8)', () => {
    const state = makeState();
    const target = makeUnit({ id: 1, wx: 5, wy: 0, hp: 40 });
    state.units.push(target);
    // Projectile is 5 units away — within hit threshold of 8
    const proj = makeProjectile({ wx: 0, wy: 0, targetUnitId: 1, damage: 30, speed: 400 });
    state.projectiles.push(proj);

    system.update(0.016, state);

    expect(state.projectiles).toHaveLength(0);
    expect(state.units[0].hp).toBe(10); // 40 - 30
    expect(state.impactMarks).toHaveLength(1);
  });

  it('drops crystals when a projectile kills an enemy unit', () => {
    const state = makeState({ resources: 0, crystals: 0 });
    const target = makeUnit({ id: 1, wx: 5, wy: 0, hp: 20 });
    state.units.push(target);
    state.projectiles.push(makeProjectile({ wx: 0, wy: 0, targetUnitId: 1, damage: 30, speed: 400 }));

    system.update(0.016, state);

    expect(state.projectiles).toHaveLength(0);
    expect(state.units[0].hp).toBe(0);
    expect(state.resources).toBe(0);
    expect(state.crystals).toBe(5);
  });

  it('removes projectile if target unit no longer exists and it has no saved aim point', () => {
    const state = makeState();
    // No units in state - target is gone
    const proj = makeProjectile({ wx: 100, wy: 100, targetUnitId: 99, speed: 400 });
    state.projectiles.push(proj);

    system.update(0.016, state);

    expect(state.projectiles).toHaveLength(0);
  });

  it('keeps a projectile flying to its saved aim point even after the target is gone', () => {
    const state = makeState();
    state.projectiles.push(makeProjectile({
      wx: 0,
      wy: 0,
      targetUnitId: 99,
      speed: 200,
      aimWx: 100,
      aimWy: 0,
    }));

    system.update(0.1, state);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].wx).toBeCloseTo(20);
    expect(state.projectiles[0].wy).toBeCloseTo(0);

    system.update(0.5, state);

    expect(state.projectiles).toHaveLength(0);
    expect(state.impactMarks).toHaveLength(1);
  });

  it('keeps a ranged-unit shot flying to its snapshotted aim point after the ally dies', () => {
    const state = makeState();
    state.units.push(makeUnit({
      id: 1,
      faction: 'ally',
      def: { role: 'light', hp: 40, speed: 70, damage: 10, attackRate: 1, sprite: 'ally', faction: 'ally' },
      hp: 0,
      wx: 100,
      wy: 0,
    }));
    state.projectiles.push(makeProjectile({
      wx: 0,
      wy: 0,
      targetUnitId: 1,
      speed: 200,
      source: 'ranged-unit',
      aimWx: 100,
      aimWy: 0,
    }));

    system.update(0.1, state);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].wx).toBeCloseTo(20);
    expect(state.projectiles[0].wy).toBeCloseTo(0);

    system.update(0.5, state);

    expect(state.projectiles).toHaveLength(0);
    expect(state.impactMarks).toHaveLength(1);
    expect(state.units[0].hp).toBe(0);
  });

  it('does not curve a ranged-unit shot toward a moving target after the aim is snapshotted', () => {
    const state = makeState();
    state.units.push(makeUnit({
      id: 1,
      faction: 'ally',
      def: { role: 'light', hp: 40, speed: 70, damage: 10, attackRate: 1, sprite: 'ally', faction: 'ally' },
      hp: 40,
      wx: 100,
      wy: 0,
    }));
    state.projectiles.push(makeProjectile({
      wx: 0,
      wy: 0,
      targetUnitId: 1,
      speed: 200,
      source: 'ranged-unit',
      aimWx: 100,
      aimWy: 0,
      turnRate: 10,
    }));

    state.units[0].wx = 100;
    state.units[0].wy = 80;
    system.update(0.1, state);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].aimWx).toBeCloseTo(100);
    expect(state.projectiles[0].aimWy).toBeCloseTo(0);
    expect(state.projectiles[0].wx).toBeCloseTo(20);
    expect(state.projectiles[0].wy).toBeCloseTo(0);
  });

  it('fades impact marks over time', () => {
    const state = makeState();
    const target = makeUnit({ id: 1, wx: 5, wy: 0, hp: 40 });
    state.units.push(target);
    state.projectiles.push(makeProjectile({ wx: 0, wy: 0, targetUnitId: 1, damage: 30, speed: 400 }));

    system.update(0.016, state);
    expect(state.impactMarks).toHaveLength(1);

    system.update(3, state);
    expect(state.impactMarks).toHaveLength(0);
  });

  it('spawns a larger citadel strike mark when a citadel orb lands', () => {
    const state = makeState();
    const target = makeUnit({ id: 1, wx: 5, wy: 0, hp: 40 });
    state.units.push(target);
    state.projectiles.push(makeProjectile({
      wx: 0,
      wy: 0,
      targetUnitId: 1,
      damage: 30,
      speed: 400,
      source: 'citadel',
    }));

    system.update(0.016, state);

    expect(state.impactMarks).toHaveLength(1);
    expect(state.impactMarks?.[0].source).toBe('citadel');
    expect(state.impactMarks?.[0].radius).toBe(18);
  });

  it('does not remove projectile if target exists and not yet in range', () => {
    const state = makeState();
    const target = makeUnit({ id: 1, wx: 500, wy: 0, hp: 40 });
    state.units.push(target);
    const proj = makeProjectile({ wx: 0, wy: 0, targetUnitId: 1, speed: 400 });
    state.projectiles.push(proj);

    system.update(0.016, state); // moves 6.4 units — not yet at 500 away

    expect(state.projectiles).toHaveLength(1);
    expect(state.units[0].hp).toBe(40); // no damage yet
  });

  it('keeps a beam active and applies damage over time', () => {
    const state = makeState({
      buildings: [{
        id: 7,
        type: 'attack',
        wx: 0,
        wy: 0,
        tileCol: 0,
        tileRow: 0,
        radius: 200,
        damage: 30,
        attackRate: 1,
        attackCooldown: 0,
        buffValue: 0,
        resourceRate: 5,
        hp: 100,
        maxHp: 100,
      }],
    });
    state.units.push(makeUnit({ id: 1, wx: 100, wy: 0, hp: 40 }));
    state.projectiles.push(makeProjectile({
      kind: 'beam',
      ownerBuildingId: 7,
      targetUnitId: 1,
      wx: 0,
      wy: 0,
      speed: 0,
      damage: 30,
      aimWx: 0,
      aimWy: 0,
      turnRate: 8,
    }));

    system.update(0.5, state);

    expect(state.projectiles).toHaveLength(1);
    expect(state.units[0].hp).toBeCloseTo(25);
  });

  it('moves the beam aim point smoothly instead of snapping to the next target position', () => {
    const state = makeState({
      buildings: [{
        id: 7,
        type: 'attack',
        wx: 0,
        wy: 0,
        tileCol: 0,
        tileRow: 0,
        radius: 200,
        damage: 30,
        attackRate: 1,
        attackCooldown: 0,
        buffValue: 0,
        resourceRate: 5,
        hp: 100,
        maxHp: 100,
      }],
    });
    state.units.push(makeUnit({ id: 1, wx: 100, wy: 80, hp: 40 }));
    state.projectiles.push(makeProjectile({
      kind: 'beam',
      ownerBuildingId: 7,
      targetUnitId: 1,
      wx: 0,
      wy: 0,
      speed: 0,
      damage: 30,
      aimWx: 0,
      aimWy: 0,
      turnRate: 6,
    }));

    system.update(0.1, state);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].aimWx).toBeGreaterThan(0);
    expect(state.projectiles[0].aimWx).toBeLessThan(100);
    expect(state.projectiles[0].aimWy).toBeGreaterThan(0);
    expect(state.projectiles[0].aimWy).toBeLessThan(80);
  });

  it('calls recordKill on blockchainService when a projectile kills an enemy', () => {
    const recordKill = vi.fn(async () => undefined);
    system.setBlockchainService({ recordKill } as unknown as BlockchainService);

    const state = makeState({ resources: 0, crystals: 0 });
    const target = makeUnit({ id: 1, wx: 5, wy: 0, hp: 20 });
    state.units.push(target);
    state.projectiles.push(makeProjectile({ wx: 0, wy: 0, targetUnitId: 1, damage: 30, speed: 400 }));

    system.update(0.016, state);

    expect(recordKill).toHaveBeenCalledWith(
      'light-enemy',
      '11111111111111111111111111111111',
    );
  });

  it('reduces projectile damage against fresh cybernetics after a capsule drop', () => {
    const state = makeState();
    state.units.push(makeUnit({
      id: 1,
      faction: 'ally',
      def: { role: 'heavy', hp: 128, speed: 52, damage: 24, attackRate: 1.3, sprite: 'cybernetic', faction: 'ally' },
      hp: 128,
      wx: 5,
      wy: 0,
      spawnShield: 1.2,
    }));
    state.projectiles.push(makeProjectile({ wx: 0, wy: 0, targetUnitId: 1, damage: 30, speed: 400 }));

    system.update(0.016, state);

    expect(state.units[0].hp).toBeCloseTo(117.5);
  });

  it('reduces projectile damage against collectors while the guard field is active', () => {
    const state = makeState();
    state.units.push(makeUnit({
      id: 2,
      faction: 'ally',
      def: { role: 'collector', hp: 30, speed: 120, damage: 0, attackRate: 0, sprite: 'collector', faction: 'ally' },
      hp: 30,
      wx: 5,
      wy: 0,
      collectorShield: 12,
    }));
    state.projectiles.push(makeProjectile({ wx: 0, wy: 0, targetUnitId: 2, damage: 30, speed: 400 }));

    system.update(0.016, state);

    expect(state.units[0].hp).toBeCloseTo(23.4, 1);
  });
});


