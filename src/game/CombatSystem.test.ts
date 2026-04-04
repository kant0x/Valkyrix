import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatSystem } from './CombatSystem';
import type { Building, GameState, Unit, UnitDef } from './game.types';
import type { BlockchainService } from '../blockchain/BlockchainService';

vi.mock('../wallet/WalletService', () => ({
  getCurrentState: vi.fn(() => ({
    connected: true,
    publicKey: '11111111111111111111111111111111',
    walletType: 'phantom',
  })),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    resources: 0,
    crystals: 0,
    lastVikingRecruitAtMs: 0,
    nextId: 1,
    pathNodes: [
      { wx: 0, wy: 0 },
      { wx: 100, wy: 0 },
    ],
    ...overrides,
  };
}

const LIGHT_ENEMY_DEF: UnitDef = {
  role: 'light',
  hp: 40,
  speed: 80,
  damage: 8,
  attackRate: 1.0,
  sprite: 'enemy',
  faction: 'enemy',
};

const LIGHT_ALLY_DEF: UnitDef = {
  role: 'light',
  hp: 50,
  speed: 70,
  damage: 10,
  attackRate: 1.0,
  sprite: 'ally',
  faction: 'ally',
};

const HEAVY_ENEMY_DEF: UnitDef = {
  role: 'heavy',
  hp: 150,
  speed: 40,
  damage: 25,
  attackRate: 0.5,
  sprite: 'enemy',
  faction: 'enemy',
};

const RANGED_ENEMY_DEF: UnitDef = {
  role: 'ranged',
  hp: 60,
  speed: 55,
  damage: 15,
  attackRate: 0.8,
  sprite: 'enemy',
  faction: 'enemy',
  attackRange: 150,
};

function makeUnit(id: number, def: UnitDef, wx: number, wy: number): Unit {
  return {
    id,
    def,
    faction: def.faction,
    hp: def.hp,
    pathIndex: 0,
    pathT: 0,
    wx,
    wy,
    state: 'moving',
    fightingWith: null,
    attackCooldown: 0,
  };
}

function makeBuilding(id: number, wx: number, wy: number, hp = 60): Building {
  return {
    id,
    type: 'attack',
    wx,
    wy,
    tileCol: 0,
    tileRow: 0,
    radius: 160,
    damage: 30,
    attackRate: 1,
    attackCooldown: 0,
    buffValue: 0,
    resourceRate: 5,
    hp,
    maxHp: hp,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CombatSystem', () => {
  let combat: CombatSystem;

  beforeEach(() => {
    combat = new CombatSystem();
  });

  // Test 1: Collision triggers fighting state for both units
  it('sets both units to fighting when enemy and ally are within 32 world units', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 20, 0); // 20 units apart — within 32
    const state = makeState({ units: [enemy, ally] });

    combat.update(0.016, state);

    expect(state.units[0].state).toBe('fighting');
    expect(state.units[1].state).toBe('fighting');
    expect(state.units[0].fightingWith).toBe(2);
    expect(state.units[1].fightingWith).toBe(1);
  });

  // Test 2: Units beyond nearest-pull range do NOT enter fighting state
  it('does NOT set fighting when enemy and ally are well beyond melee pull range', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 72, 0); // beyond 60 pull radius
    const state = makeState({ units: [enemy, ally] });

    combat.update(0.016, state);

    expect(state.units[0].state).toBe('moving');
    expect(state.units[1].state).toBe('moving');
  });

  // Test 3: Fighting units wind up first, then land damage on the strike frame
  it('delays melee damage until the attack swing reaches the hit frame', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 10, 0);
    enemy.state = 'fighting';
    enemy.fightingWith = 2;
    enemy.attackCooldown = 0; // ready to attack
    ally.state = 'fighting';
    ally.fightingWith = 1;
    ally.attackCooldown = 0; // ready to attack

    const state = makeState({ units: [enemy, ally] });
    const enemyHpBefore = enemy.hp;
    const allyHpBefore = ally.hp;

    combat.update(0.016, state);

    expect(state.units[0].hp).toBe(enemyHpBefore);
    expect(state.units[1].hp).toBe(allyHpBefore);
    expect(state.units[0].attackWindup).toBeGreaterThan(0);
    expect(state.units[1].attackWindup).toBeGreaterThan(0);

    combat.update(0.25, state);

    // Enemy attacked ally (damage=8), ally attacked enemy (damage=10)
    expect(state.units[0].hp).toBe(enemyHpBefore - LIGHT_ALLY_DEF.damage);
    expect(state.units[1].hp).toBe(allyHpBefore - LIGHT_ENEMY_DEF.damage);
  });

  // Test 4: attackCooldown resets after the swing has fully completed
  it('resets attackCooldown after the attack animation finishes', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 10, 0);
    enemy.state = 'fighting';
    enemy.fightingWith = 2;
    enemy.attackCooldown = 0;
    ally.state = 'fighting';
    ally.fightingWith = 1;
    ally.attackCooldown = 0;

    const state = makeState({ units: [enemy, ally] });

    combat.update(0.016, state);
    combat.update(0.5, state);

    expect(state.units[0].attackCooldown).toBeCloseTo(1 / LIGHT_ENEMY_DEF.attackRate, 5);
    expect(state.units[1].attackCooldown).toBeCloseTo(1 / LIGHT_ALLY_DEF.attackRate, 5);
    expect(state.units[0].attackWindup).toBeUndefined();
    expect(state.units[1].attackWindup).toBeUndefined();
  });

  // Test 5: Kill awards crystals via registerKill
  it('awards crystals when enemy unit hp reaches 0 (registerKill called)', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 10, 0);
    enemy.state = 'fighting';
    enemy.fightingWith = 2;
    enemy.attackCooldown = 0;
    enemy.hp = 1; // one hit from ally (damage=10) kills it
    ally.state = 'fighting';
    ally.fightingWith = 1;
    ally.attackCooldown = 0;

    const state = makeState({ units: [enemy, ally], resources: 0, crystals: 0 });

    combat.update(0.016, state);
    combat.update(0.3, state);

    expect(state.resources).toBe(0);
    expect(state.crystals).toBe(5);
  });

  // Test 6: Winner resumes moving after opponent dies
  it('resumes moving state for the survivor when opponent hp reaches 0', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 10, 0);
    // Enemy is already dead (hp=0), ally is fighting it
    enemy.state = 'fighting';
    enemy.fightingWith = 2;
    enemy.hp = 0;
    ally.state = 'fighting';
    ally.fightingWith = 1;
    ally.attackCooldown = 99; // not ready to attack — test only survivor recovery

    const state = makeState({ units: [enemy, ally] });

    combat.update(0.016, state);

    // Ally should resume moving since enemy is dead
    const allyUnit = state.units.find(u => u.id === 2)!;
    expect(allyUnit.state).toBe('moving');
    expect(allyUnit.fightingWith).toBeNull();
  });

  // Test 7: Enemy 'attacking-base' drains citadelHp
  it('drains citadelHp when enemy unit is in attacking-base state', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    enemy.state = 'attacking-base';
    enemy.attackCooldown = 0; // ready to strike

    const state = makeState({ units: [enemy], citadelHp: 500 });

    combat.update(0.016, state);

    expect(state.citadelHp).toBe(500);

    combat.update(0.3, state);

    // enemy damage=8 applied to citadel
    expect(state.citadelHp).toBe(500 - LIGHT_ENEMY_DEF.damage);
  });

  // Test 8: Loss triggered when citadelHp reaches 0
  it('sets state.phase to lost when citadelHp reaches 0', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    enemy.state = 'attacking-base';
    enemy.attackCooldown = 0;

    const state = makeState({ units: [enemy], citadelHp: 1 }); // one hit kills

    combat.update(0.016, state);
    combat.update(0.3, state);

    expect(state.citadelHp).toBe(0);
    expect(state.phase).toBe('lost');
  });

  // Test 9: Win triggered when all waves done and no enemies remain
  it('sets state.phase to won when wave 5 is done and no enemy units remain', () => {
    const ally = makeUnit(1, LIGHT_ALLY_DEF, 10, 0);
    const state = makeState({
      units: [ally],
      waveNumber: 5,
      spawnQueue: [],
      phase: 'playing',
    });

    combat.update(0.016, state);

    expect(state.phase).toBe('won');
  });

  // Test 10: No updates when phase is not 'playing'
  it('does nothing when state.phase is not playing', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 10, 0);
    const state = makeState({ units: [enemy, ally], phase: 'paused' });

    combat.update(0.016, state);

    // No state changes — still moving, no fighting
    expect(state.units[0].state).toBe('moving');
    expect(state.units[1].state).toBe('moving');
  });

  // Test 11: Ally 'attacking-base' does NOT deal damage (Phase 5 concern)
  it('does NOT drain playerBaseHp when ally unit is in attacking-base state', () => {
    const ally = makeUnit(1, LIGHT_ALLY_DEF, 0, 0);
    ally.state = 'attacking-base';

    const state = makeState({ units: [ally], playerBaseHp: 300 });

    combat.update(0.016, state);

    expect(state.playerBaseHp).toBe(300); // untouched
  });

  // Test 12: Heavy enemy kill awards correct drop (15 crystals)
  it('awards 15 crystals when heavy-enemy is killed', () => {
    const heavy = makeUnit(1, HEAVY_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, { ...LIGHT_ALLY_DEF, damage: 200 }, 10, 0); // big damage to kill in one hit
    heavy.state = 'fighting';
    heavy.fightingWith = 2;
    heavy.attackCooldown = 99;
    heavy.hp = 1;
    ally.state = 'fighting';
    ally.fightingWith = 1;
    ally.attackCooldown = 0;

    const state = makeState({ units: [heavy, ally], resources: 0, crystals: 0 });

    combat.update(0.016, state);
    combat.update(0.3, state);

    expect(state.resources).toBe(0);
    expect(state.crystals).toBe(15);
  });

  // Test 13: registerKill defKey uses role + '-enemy' for enemy units
  it('calls registerKill with ranged-enemy for ranged enemy units', () => {
    const ranged = makeUnit(1, RANGED_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, { ...LIGHT_ALLY_DEF, damage: 200 }, 10, 0);
    ranged.state = 'fighting';
    ranged.fightingWith = 2;
    ranged.hp = 1;
    ranged.attackCooldown = 99;
    ally.state = 'fighting';
    ally.fightingWith = 1;
    ally.attackCooldown = 0;

    const state = makeState({ units: [ranged, ally], resources: 0, crystals: 0 });

    combat.update(0.016, state);
    combat.update(0.3, state);

    expect(state.resources).toBe(0);
    expect(state.crystals).toBe(10);
  });

  it('does not lock collectors into melee collisions', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const collector = makeUnit(2, {
      role: 'collector',
      hp: 30,
      speed: 120,
      damage: 0,
      attackRate: 0,
      sprite: 'collector',
      faction: 'ally',
    }, 10, 0);
    const state = makeState({ units: [enemy, collector] });

    combat.update(0.016, state);

    expect(state.units[0].state).toBe('moving');
    expect(state.units[1].state).toBe('moving');
  });

  it('lets collectors survive much longer while their guard field is active', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const collector = makeUnit(2, {
      role: 'collector',
      hp: 30,
      speed: 120,
      damage: 0,
      attackRate: 0,
      sprite: 'collector',
      faction: 'ally',
    }, 10, 0);
    enemy.state = 'fighting';
    enemy.fightingWith = 2;
    enemy.attackCooldown = 0;
    collector.state = 'moving';
    collector.collectorShield = 15;
    const state = makeState({ units: [enemy, collector] });

    combat.update(0.016, state);
    combat.update(0.3, state);

    expect(state.units[1].hp).toBeCloseTo(28.24, 2);
  });

  it('sets both units to fighting state without snapping positions', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 20, 12);
    const state = makeState({ units: [enemy, ally] });

    combat.update(0.016, state);

    expect(state.units[0].state).toBe('fighting');
    expect(state.units[1].state).toBe('fighting');
    // no snap/teleport — only a tiny approach step is allowed
    expect(state.units[0].wx).toBeLessThan(2);
    expect(state.units[1].wx).toBeGreaterThan(18);
  });

  it('still lets the nearest melee ally engage first across neighboring lanes', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const closeAlly = makeUnit(2, LIGHT_ALLY_DEF, 46, 18);
    const farAlly = makeUnit(3, LIGHT_ALLY_DEF, 59, 0);
    const state = makeState({ units: [enemy, closeAlly, farAlly] });

    combat.update(0.016, state);

    expect(enemy.state).toBe('fighting');
    expect([2, 3]).toContain(enemy.fightingWith);
    expect(closeAlly.state).toBe('fighting');
    expect(closeAlly.fightingWith).toBe(1);
    expect(Math.hypot(enemy.wx - closeAlly.wx, enemy.wy - closeAlly.wy)).toBeLessThan(60);
    expect(['moving', 'fighting']).toContain(farAlly.state);
  });

  it('allows multiple allies to focus the same nearby enemy', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const allyA = makeUnit(2, LIGHT_ALLY_DEF, 22, -4);
    const allyB = makeUnit(3, LIGHT_ALLY_DEF, 28, 9);
    const state = makeState({ units: [enemy, allyA, allyB] });

    combat.update(0.016, state);

    expect(enemy.state).toBe('fighting');
    expect([2, 3]).toContain(enemy.fightingWith);
    expect(allyA.state).toBe('fighting');
    expect(allyA.fightingWith).toBe(1);
    expect(allyB.state).toBe('fighting');
    expect(allyB.fightingWith).toBe(1);
  });

  it('allows multiple enemies to collapse onto the same ally', () => {
    const enemyA = makeUnit(1, LIGHT_ENEMY_DEF, -18, -4);
    const enemyB = makeUnit(2, LIGHT_ENEMY_DEF, -24, 11);
    const ally = makeUnit(3, LIGHT_ALLY_DEF, 0, 0);
    const state = makeState({ units: [enemyA, enemyB, ally] });

    combat.update(0.016, state);

    expect(ally.state).toBe('fighting');
    expect([1, 2]).toContain(ally.fightingWith);
    expect(enemyA.state).toBe('fighting');
    expect(enemyA.fightingWith).toBe(3);
    expect(enemyB.state).toBe('fighting');
    expect(enemyB.fightingWith).toBe(3);
  });

  it('lets melee enemies attack towers when they reach them', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 8, 0);
    const tower = makeBuilding(7, 0, 0, 20);
    const state = makeState({ units: [enemy], buildings: [tower] });

    combat.update(0.016, state);
    combat.update(0.3, state);

    expect(state.units[0].state).toBe('fighting');
    expect(state.units[0].fightingWith).toBe(-7);
    expect(state.buildings[0].hp).toBeLessThan(20);
  });

  it('calls recordKill on blockchainService when an enemy dies', () => {
    const recordKill = vi.fn(async () => undefined);
    const blockchainService = { recordKill } as unknown as BlockchainService;
    combat.setBlockchainService(blockchainService);

    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, { ...LIGHT_ALLY_DEF, damage: 200 }, 10, 0);
    enemy.state = 'fighting';
    enemy.fightingWith = 2;
    enemy.hp = 1;
    enemy.attackCooldown = 99;
    ally.state = 'fighting';
    ally.fightingWith = 1;
    ally.attackCooldown = 0;

    const state = makeState({ units: [enemy, ally] });

    combat.update(0.016, state);
    combat.update(0.3, state);

    expect(recordKill).toHaveBeenCalledWith(
      'light-enemy',
      '11111111111111111111111111111111',
    );
  });

  it('lets allies engage nearby lasers even after the ranged unit has started firing', () => {
    const ranged = makeUnit(1, RANGED_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 26, 6);
    ranged.state = 'fighting';
    ranged.fightingWith = 999;
    ranged.attackCooldown = 0.4;
    const state = makeState({ units: [ranged, ally] });

    combat.update(0.016, state);

    expect(ally.state).toBe('fighting');
    expect(ally.fightingWith).toBe(1);
    expect(ranged.state).toBe('fighting');
    expect(ranged.fightingWith).toBe(2);
  });

  it('does not throw when blockchainService is not set', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 10, 0);
    const state = makeState({ units: [enemy, ally] });

    expect(() => combat.update(0.016, state)).not.toThrow();
  });
});
