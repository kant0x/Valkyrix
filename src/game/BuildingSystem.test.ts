import { describe, it, expect, beforeEach } from 'vitest';
import { BuildingSystem } from './BuildingSystem';
import type { GameState, Unit } from './game.types';

// Helper: create a minimal GameState for testing
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
    resources: 200,
    nextId: 1,
    pathNodes: [],
    ...overrides,
  };
}

// Zone layer: 3x3 grid, only center tile (index 4) is buildable (non-zero)
// mapWidth = 3
// row=1, col=1 → index = 1*3+1 = 4 → buildable
// row=0, col=0 → index = 0 → NOT buildable
function makeZoneLayer(): number[] {
  const layer = new Array(9).fill(0);
  layer[4] = 1; // (row=1, col=1) is buildable
  return layer;
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 99,
    def: { role: 'light', hp: 40, speed: 80, damage: 8, attackRate: 1.0, sprite: '', faction: 'enemy' },
    faction: 'enemy',
    hp: 40,
    pathIndex: 0,
    pathT: 0,
    wx: 0,
    wy: 0,
    state: 'moving',
    fightingWith: null,
    attackCooldown: 0,
    ...overrides,
  };
}

const MAP_WIDTH = 3;
const BUILDABLE_COL = 1;
const BUILDABLE_ROW = 1;

describe('BuildingSystem.placeBuilding', () => {
  let system: BuildingSystem;
  let zoneLayer: number[];

  beforeEach(() => {
    system = new BuildingSystem();
    zoneLayer = makeZoneLayer();
  });

  it('returns false if zone tile is 0 (non-buildable)', () => {
    const state = makeState();
    // col=0, row=0 → index 0 → zoneLayer[0] = 0
    const result = system.placeBuilding('attack', 0, 0, zoneLayer, MAP_WIDTH, state);
    expect(result).toBe(false);
    expect(state.buildings).toHaveLength(0);
  });

  it('returns false if another building already occupies the tile', () => {
    const state = makeState();
    // Place first building successfully
    system.placeBuilding('attack', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    const resourcesAfterFirst = state.resources;
    // Attempt to place second on same tile
    const result = system.placeBuilding('buff', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    expect(result).toBe(false);
    expect(state.buildings).toHaveLength(1);
    expect(state.resources).toBe(resourcesAfterFirst); // no cost deducted
  });

  it('returns false if insufficient resources (attack tower costs 50)', () => {
    const state = makeState({ resources: 49 });
    const result = system.placeBuilding('attack', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    expect(result).toBe(false);
    expect(state.buildings).toHaveLength(0);
    expect(state.resources).toBe(49);
  });

  it('places attack tower: deducts 50, correct stats, attackCooldown=0', () => {
    const state = makeState({ resources: 100, nextId: 5 });
    const result = system.placeBuilding('attack', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    expect(result).toBe(true);
    expect(state.resources).toBe(50); // 100 - 50
    expect(state.buildings).toHaveLength(1);
    const bldg = state.buildings[0];
    expect(bldg.type).toBe('attack');
    expect(bldg.damage).toBe(30);
    expect(bldg.attackRate).toBe(1.0);
    expect(bldg.radius).toBe(160);
    expect(bldg.resourceRate).toBe(5);
    expect(bldg.buffValue).toBe(0);
    expect(bldg.attackCooldown).toBe(0);
    expect(bldg.tileCol).toBe(BUILDABLE_COL);
    expect(bldg.tileRow).toBe(BUILDABLE_ROW);
    expect(bldg.id).toBe(5);
  });

  it('places buff tower: deducts 40, correct stats', () => {
    const state = makeState({ resources: 100, nextId: 1 });
    const result = system.placeBuilding('buff', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    expect(result).toBe(true);
    expect(state.resources).toBe(60); // 100 - 40
    expect(state.buildings).toHaveLength(1);
    const bldg = state.buildings[0];
    expect(bldg.type).toBe('buff');
    expect(bldg.buffValue).toBe(0.25);
    expect(bldg.radius).toBe(128);
    expect(bldg.resourceRate).toBe(3);
    expect(bldg.damage).toBe(0);
    expect(bldg.attackRate).toBe(0);
  });
});

describe('BuildingSystem.sellBuilding', () => {
  let system: BuildingSystem;
  let zoneLayer: number[];

  beforeEach(() => {
    system = new BuildingSystem();
    zoneLayer = makeZoneLayer();
  });

  it('removes building and refunds 60% of cost (attack→30 electrolatov)', () => {
    const state = makeState({ resources: 100 });
    system.placeBuilding('attack', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    expect(state.buildings).toHaveLength(1);
    const bldgId = state.buildings[0].id;
    const resourcesBefore = state.resources; // 50 after placement
    const result = system.sellBuilding(bldgId, state);
    expect(result).toBe(true);
    expect(state.buildings).toHaveLength(0);
    expect(state.resources).toBe(resourcesBefore + 30); // +30 (60% of 50)
  });

  it('refunds 60% of cost for buff tower (→24 electrolatov)', () => {
    const state = makeState({ resources: 100 });
    system.placeBuilding('buff', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    const bldgId = state.buildings[0].id;
    const resourcesBefore = state.resources;
    system.sellBuilding(bldgId, state);
    expect(state.resources).toBe(resourcesBefore + 24); // +24 (60% of 40)
  });

  it('returns false if building id not found', () => {
    const state = makeState();
    const result = system.sellBuilding(9999, state);
    expect(result).toBe(false);
  });
});

describe('BuildingSystem.update — attack tower', () => {
  let system: BuildingSystem;

  beforeEach(() => {
    system = new BuildingSystem();
  });

  it('decrements attackCooldown when > 0, does not spawn projectile', () => {
    const state = makeState();
    state.buildings.push({
      id: 1, type: 'attack', wx: 0, wy: 0, tileCol: 0, tileRow: 0,
      radius: 200, damage: 30, attackRate: 1.0, attackCooldown: 0.5,
      buffValue: 0, resourceRate: 5,
    });
    system.update(0.1, state);
    expect(state.buildings[0].attackCooldown).toBeCloseTo(0.4);
    expect(state.projectiles).toHaveLength(0);
  });

  it('fires projectile at nearest enemy in radius when cooldown <= 0', () => {
    const state = makeState({ nextId: 10 });
    state.buildings.push({
      id: 1, type: 'attack', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 200, damage: 30, attackRate: 1.0, attackCooldown: 0,
      buffValue: 0, resourceRate: 5,
    });
    // Enemy within radius
    state.units.push(makeUnit({ id: 5, wx: 150, wy: 100, faction: 'enemy' }));
    system.update(0.016, state);
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].targetUnitId).toBe(5);
    expect(state.projectiles[0].damage).toBe(30);
    // Cooldown reset to 1/attackRate = 1.0
    expect(state.buildings[0].attackCooldown).toBeGreaterThan(0.9);
  });

  it('does NOT fire if no enemy within radius', () => {
    const state = makeState({ nextId: 10 });
    state.buildings.push({
      id: 1, type: 'attack', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 50, damage: 30, attackRate: 1.0, attackCooldown: 0,
      buffValue: 0, resourceRate: 5,
    });
    // Enemy outside radius (distance = 200)
    state.units.push(makeUnit({ id: 5, wx: 300, wy: 100, faction: 'enemy' }));
    system.update(0.016, state);
    expect(state.projectiles).toHaveLength(0);
    expect(state.buildings[0].attackCooldown).toBe(0); // NOT reset
  });
});

describe('BuildingSystem.update — buff tower', () => {
  let system: BuildingSystem;

  beforeEach(() => {
    system = new BuildingSystem();
  });

  it('sets speedBuff=1.25 on ally units within radius', () => {
    const state = makeState();
    state.buildings.push({
      id: 2, type: 'buff', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 128, damage: 0, attackRate: 0, attackCooldown: 0,
      buffValue: 0.25, resourceRate: 3,
    });
    const ally = makeUnit({ id: 1, faction: 'ally', wx: 130, wy: 100 });
    state.units.push(ally);
    system.update(0.016, state);
    expect((state.units[0] as any).speedBuff).toBeCloseTo(1.25);
  });

  it('does not buff ally units outside radius', () => {
    const state = makeState();
    state.buildings.push({
      id: 2, type: 'buff', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 50, damage: 0, attackRate: 0, attackCooldown: 0,
      buffValue: 0.25, resourceRate: 3,
    });
    const ally = makeUnit({ id: 1, faction: 'ally', wx: 300, wy: 100 });
    state.units.push(ally);
    system.update(0.016, state);
    expect((state.units[0] as any).speedBuff).toBeUndefined();
  });
});
