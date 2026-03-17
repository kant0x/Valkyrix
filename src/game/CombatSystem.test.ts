import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from './CombatSystem';
import type { GameState, Unit, UnitDef } from './game.types';

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

  // Test 2: Units beyond 32 units do NOT enter fighting state
  it('does NOT set fighting when enemy and ally are more than 32 units apart', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 50, 0); // 50 units — beyond 32
    const state = makeState({ units: [enemy, ally] });

    combat.update(0.016, state);

    expect(state.units[0].state).toBe('moving');
    expect(state.units[1].state).toBe('moving');
  });

  // Test 3: Fighting units deal damage to each other on cooldown expiry
  it('deals damage from ally to enemy (and vice versa) when attackCooldown reaches 0', () => {
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

    // Enemy attacked ally (damage=8), ally attacked enemy (damage=10)
    expect(state.units[0].hp).toBe(enemyHpBefore - LIGHT_ALLY_DEF.damage);
    expect(state.units[1].hp).toBe(allyHpBefore - LIGHT_ENEMY_DEF.damage);
  });

  // Test 4: attackCooldown resets after attack
  it('resets attackCooldown to 1/attackRate after dealing damage', () => {
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

    // After attack: cooldown = 1/attackRate - dt (decremented once this frame)
    const expectedEnemyCooldown = 1 / LIGHT_ENEMY_DEF.attackRate - 0.016;
    const expectedAllyCooldown = 1 / LIGHT_ALLY_DEF.attackRate - 0.016;
    expect(state.units[0].attackCooldown).toBeCloseTo(expectedEnemyCooldown, 5);
    expect(state.units[1].attackCooldown).toBeCloseTo(expectedAllyCooldown, 5);
  });

  // Test 5: Kill awards resources via registerKill
  it('awards resources when enemy unit hp reaches 0 (registerKill called)', () => {
    const enemy = makeUnit(1, LIGHT_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, LIGHT_ALLY_DEF, 10, 0);
    enemy.state = 'fighting';
    enemy.fightingWith = 2;
    enemy.attackCooldown = 0;
    enemy.hp = 1; // one hit from ally (damage=10) kills it
    ally.state = 'fighting';
    ally.fightingWith = 1;
    ally.attackCooldown = 0;

    const state = makeState({ units: [enemy, ally], resources: 0 });

    combat.update(0.016, state);

    // light-enemy kill drop = 5 electrolatov
    expect(state.resources).toBe(5);
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

  // Test 12: Heavy enemy kill awards correct drop (15 electrolatov)
  it('awards 15 electrolatov when heavy-enemy is killed', () => {
    const heavy = makeUnit(1, HEAVY_ENEMY_DEF, 0, 0);
    const ally = makeUnit(2, { ...LIGHT_ALLY_DEF, damage: 200 }, 10, 0); // big damage to kill in one hit
    heavy.state = 'fighting';
    heavy.fightingWith = 2;
    heavy.attackCooldown = 99;
    heavy.hp = 1;
    ally.state = 'fighting';
    ally.fightingWith = 1;
    ally.attackCooldown = 0;

    const state = makeState({ units: [heavy, ally], resources: 0 });

    combat.update(0.016, state);

    expect(state.resources).toBe(15);
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

    const state = makeState({ units: [ranged, ally], resources: 0 });

    combat.update(0.016, state);

    // ranged-enemy kill drop = 10 electrolatov
    expect(state.resources).toBe(10);
  });
});
