import { describe, it, expect } from 'vitest';
import { ProjectileSystem } from './ProjectileSystem';
import type { GameState, Unit, Projectile } from './game.types';

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

const system = new ProjectileSystem();

describe('ProjectileSystem.update', () => {
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
  });

  it('removes projectile if target unit no longer exists', () => {
    const state = makeState();
    // No units in state — target is gone
    const proj = makeProjectile({ wx: 100, wy: 100, targetUnitId: 99, speed: 400 });
    state.projectiles.push(proj);

    system.update(0.016, state);

    expect(state.projectiles).toHaveLength(0);
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
});
