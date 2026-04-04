import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { canvasClickToTile, canvasPointToWorld, isWorldPointInsideTile, BuildingSystem } from './BuildingSystem';
import type { GameState, Unit } from './game.types';
import { GAME_VIEW_H, GAME_W } from '../shared/RuntimeViewport';
import type { BlockchainService } from '../blockchain/BlockchainService';

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

function makeZoneLayer(): number[] {
  const layer = new Array(9).fill(0);
  layer[4] = 1;
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

function makeCanvas(): HTMLCanvasElement {
  return {
    clientWidth: GAME_W,
    clientHeight: GAME_VIEW_H,
  } as HTMLCanvasElement;
}

function worldToClick(
  wx: number,
  wy: number,
  cameraCenter = { x: 0, y: 0 },
  zoom = 1,
): { x: number; y: number } {
  return {
    x: GAME_W / 2 + (wx - cameraCenter.x) * zoom,
    y: GAME_VIEW_H / 2 + (wy - cameraCenter.y) * zoom,
  };
}

describe('BuildingSystem.placeBuilding', () => {
  let system: BuildingSystem;
  let zoneLayer: number[];

  beforeEach(() => {
    system = new BuildingSystem();
    zoneLayer = makeZoneLayer();
  });

  it('returns false if zone tile is 0 (non-buildable)', () => {
    const state = makeState();
    const result = system.placeBuilding('attack', 0, 0, zoneLayer, MAP_WIDTH, state);
    expect(result).toBe(false);
    expect(state.buildings).toHaveLength(0);
  });

  it('returns false if another building already occupies the tile', () => {
    const state = makeState();
    system.placeBuilding('attack', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    const resourcesAfterFirst = state.resources;
    const result = system.placeBuilding('buff', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    expect(result).toBe(false);
    expect(state.buildings).toHaveLength(1);
    expect(state.resources).toBe(resourcesAfterFirst);
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
    expect(state.resources).toBe(50);
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
    expect(state.resources).toBe(60);
    expect(state.buildings).toHaveLength(1);
    const bldg = state.buildings[0];
    expect(bldg.type).toBe('buff');
    expect(bldg.buffValue).toBe(0.25);
    expect(bldg.radius).toBe(128);
    expect(bldg.resourceRate).toBe(3);
    expect(bldg.damage).toBe(0);
    expect(bldg.attackRate).toBe(0);
  });

  it('calls recordCreate on blockchainService when a tower is placed', () => {
    const recordCreate = vi.fn(async () => undefined);
    system.setBlockchainService({ recordCreate } as unknown as BlockchainService);
    const state = makeState({ resources: 100 });

    const result = system.placeBuilding('attack', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);

    expect(result).toBe(true);
    expect(recordCreate).toHaveBeenCalledWith('attack-tower', null);
  });
});

describe('canvasClickToTile', () => {
  const canvas = makeCanvas();
  const cameraCenter = { x: 1152 + 32, y: 16 };

  it('snaps clicks by diamond containment instead of drifting to a neighbor center', () => {
    const click = worldToClick(1152 + 32 - 20, 16 - 3, cameraCenter);
    const tile = canvasClickToTile(click.x, click.y, canvas, cameraCenter, 1, 64, 32);
    expect(tile).toEqual({ col: 0, row: 0 });
  });

  it('keeps the right-hand half of the same diamond on the same tile', () => {
    const click = worldToClick(1152 + 32 + 20, 16 + 3, cameraCenter);
    const tile = canvasClickToTile(click.x, click.y, canvas, cameraCenter, 1, 64, 32);
    expect(tile).toEqual({ col: 0, row: 0 });
  });

  it('treats the tile center as the same tile after round-tripping through canvas space', () => {
    const click = worldToClick(1152 + 32, 16, cameraCenter);
    const world = canvasPointToWorld(click.x, click.y, canvas, cameraCenter, 1);
    expect(world).toEqual({ wx: 1152 + 32, wy: 16 });
  });

  it('keeps hover on the same tile while the point stays inside the diamond edges', () => {
    expect(isWorldPointInsideTile(1152 + 32, 16 - 15, 0, 0, 64, 32)).toBe(true);
    expect(isWorldPointInsideTile(1152 + 32 + 31, 16, 0, 0, 64, 32)).toBe(true);
    expect(isWorldPointInsideTile(1152 + 32, 16 + 15, 0, 0, 64, 32)).toBe(true);
  });

  it('switches tile only after the pointer leaves the diamond boundary', () => {
    expect(isWorldPointInsideTile(1152 + 32, 16 - 17, 0, 0, 64, 32)).toBe(false);
    const click = worldToClick(1152 + 32, 16 - 17, cameraCenter);
    const tile = canvasClickToTile(click.x, click.y, canvas, cameraCenter, 1, 64, 32);
    expect(tile).toEqual({ col: -1, row: -1 });
  });
});

describe('BuildingSystem.update - citadel orb defense', () => {
  let system: BuildingSystem;
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    system = new BuildingSystem();
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('fires one citadel projectile from the front orbit instead of simultaneous volley', () => {
    const state = makeState({
      nextId: 20,
      pathNodes: [
        { wx: 80, wy: 80 },
        { wx: 100, wy: 100 },
      ],
    });
    state.units.push(makeUnit({ id: 5, wx: 120, wy: 110, faction: 'enemy' }));

    system.update(0.016, state);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].kind).toBe('bolt');
    expect(state.projectiles[0].source).toBe('citadel');
    expect(state.projectiles[0].speed).toBe(180);
    expect(state.projectiles[0].damage).toBe(22);
    expect(state.projectiles[0].size).toBe(16);
    expect(state.projectiles[0].aimWx).toBe(120);
    expect(state.projectiles[0].aimWy).toBe(110);
  });

  it('fires citadel orb shots every 0.5s (cooldown-gated sequential fire)', () => {
    const state = makeState({
      nextId: 20,
      pathNodes: [
        { wx: 80, wy: 80 },
        { wx: 100, wy: 100 },
      ],
    });
    state.units.push(makeUnit({ id: 5, wx: 120, wy: 110, faction: 'enemy' }));

    system.update(0.016, state); // first shot
    expect(state.projectiles).toHaveLength(1);

    system.update(0.2, state); // still on cooldown
    expect(state.projectiles).toHaveLength(1);

    system.update(0.29, state); // 0.49s total since previous
    expect(state.projectiles).toHaveLength(1);

    system.update(0.02, state); // 0.51s => next shot
    expect(state.projectiles).toHaveLength(2);
  });

  it('rotates citadel fire between orbit slots instead of always using the same orb', () => {
    const state = makeState({
      nextId: 20,
      pathNodes: [
        { wx: 80, wy: 80 },
        { wx: 100, wy: 100 },
      ],
    });
    state.units.push(makeUnit({ id: 5, wx: 120, wy: 110, faction: 'enemy' }));

    nowSpy.mockReturnValue(1000);
    system.update(0.016, state);

    nowSpy.mockReturnValue(2700);
    system.update(0.6, state);

    expect(state.projectiles).toHaveLength(2);
    expect(state.projectiles[0].orbSlot).not.toBeUndefined();
    expect(state.projectiles[1].orbSlot).not.toBeUndefined();
    expect(state.projectiles[0].orbSlot).not.toBe(state.projectiles[1].orbSlot);
  });

  it('waits for the front orb to become bright enough before allowing a citadel shot', () => {
    const state = makeState({
      nextId: 20,
      pathNodes: [
        { wx: 80, wy: 80 },
        { wx: 100, wy: 100 },
      ],
    });
    state.units.push(makeUnit({ id: 5, wx: 120, wy: 110, faction: 'enemy' }));

    nowSpy.mockReturnValue(873); // dimmer phase (no shot yet)
    system.update(0.016, state);
    expect(state.projectiles).toHaveLength(0);

    nowSpy.mockReturnValue(1000); // brighter phase (shot allowed)
    system.update(0.016, state);
    expect(state.projectiles).toHaveLength(1);
  });

  it('does not create citadel projectiles when no enemies remain in range', () => {
    const state = makeState({
      pathNodes: [
        { wx: 80, wy: 80 },
        { wx: 100, wy: 100 },
      ],
    });

    system.update(0.016, state);

    expect(state.projectiles.filter((proj) => proj.source === 'citadel')).toHaveLength(0);
  });
});

describe('BuildingSystem.sellBuilding', () => {
  let system: BuildingSystem;
  let zoneLayer: number[];

  beforeEach(() => {
    system = new BuildingSystem();
    zoneLayer = makeZoneLayer();
  });

  it('removes building and refunds 60% of cost (attack -> 30 electrolatov)', () => {
    const state = makeState({ resources: 100 });
    system.placeBuilding('attack', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    expect(state.buildings).toHaveLength(1);
    const bldgId = state.buildings[0].id;
    const resourcesBefore = state.resources;
    const result = system.sellBuilding(bldgId, state);
    expect(result).toBe(true);
    expect(state.buildings).toHaveLength(0);
    expect(state.resources).toBe(resourcesBefore + 30);
  });

  it('refunds 60% of cost for buff tower (-> 24 electrolatov)', () => {
    const state = makeState({ resources: 100 });
    system.placeBuilding('buff', BUILDABLE_COL, BUILDABLE_ROW, zoneLayer, MAP_WIDTH, state);
    const bldgId = state.buildings[0].id;
    const resourcesBefore = state.resources;
    system.sellBuilding(bldgId, state);
    expect(state.resources).toBe(resourcesBefore + 24);
  });

  it('returns false if building id not found', () => {
    const state = makeState();
    const result = system.sellBuilding(9999, state);
    expect(result).toBe(false);
  });
});

describe('BuildingSystem.update - attack tower', () => {
  let system: BuildingSystem;

  beforeEach(() => {
    system = new BuildingSystem();
  });

  it('fires a tower orb projectile at the nearest enemy in radius', () => {
    const state = makeState();
    state.buildings.push({
      id: 1, type: 'attack', wx: 0, wy: 0, tileCol: 0, tileRow: 0,
      radius: 200, damage: 30, attackRate: 1.0, attackCooldown: 0,
      buffValue: 0, resourceRate: 5, hp: 100, maxHp: 100,
    });
    state.units.push(makeUnit({ id: 5, wx: 120, wy: 0, faction: 'enemy' }));

    system.update(0.1, state);

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].kind).toBe('bolt');
    expect(state.projectiles[0].ownerBuildingId).toBe(1);
    expect(state.projectiles[0].targetUnitId).toBe(5);
    expect(state.projectiles[0].damage).toBe(30);
    expect(state.projectiles[0].source).toBe('tower');
    expect(state.projectiles[0].size).toBe(18);
    expect(state.buildings[0].attackCooldown).toBeCloseTo(1);
  });

  it('waits for cooldown before firing another tower orb projectile', () => {
    const state = makeState();
    state.buildings.push({
      id: 1, type: 'attack', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 220, damage: 30, attackRate: 1.0, attackCooldown: 0,
      buffValue: 0, resourceRate: 5, hp: 100, maxHp: 100,
    });
    state.units.push(makeUnit({ id: 6, wx: 180, wy: 110, faction: 'enemy' }));

    system.update(0.016, state);
    expect(state.projectiles).toHaveLength(1);

    system.update(0.2, state);
    expect(state.projectiles).toHaveLength(1);
  });

  it('does not fire when no enemy remains in radius', () => {
    const state = makeState();
    state.buildings.push({
      id: 1, type: 'attack', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 50, damage: 30, attackRate: 1.0, attackCooldown: 0,
      buffValue: 0, resourceRate: 5, hp: 100, maxHp: 100,
    });
    state.units.push(makeUnit({ id: 5, wx: 300, wy: 100, faction: 'enemy' }));

    system.update(0.016, state);

    expect(state.projectiles).toHaveLength(0);
    expect(state.buildings[0].attackCooldown).toBe(0);
  });
});

describe('BuildingSystem.update - buff tower', () => {
  let system: BuildingSystem;

  beforeEach(() => {
    system = new BuildingSystem();
  });

  it('applies combat aura buffs on ally units within radius', () => {
    const state = makeState();
    state.buildings.push({
      id: 2, type: 'buff', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 128, damage: 0, attackRate: 0, attackCooldown: 0,
      buffValue: 0.25, resourceRate: 3, hp: 100, maxHp: 100,
    });
    const ally = makeUnit({ id: 1, faction: 'ally', wx: 130, wy: 100 });
    state.units.push(ally);
    system.update(0.016, state);
    expect((state.units[0] as Unit).attackBuff).toBeGreaterThan(1);
    expect((state.units[0] as Unit).defenseBuff).toBeLessThan(1);
    expect((state.units[0] as Unit).buffAura).toBe('tower');
  });

  it('does not buff ally units outside radius', () => {
    const state = makeState();
    state.buildings.push({
      id: 2, type: 'buff', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 50, damage: 0, attackRate: 0, attackCooldown: 0,
      buffValue: 0.25, resourceRate: 3, hp: 100, maxHp: 100,
    });
    const ally = makeUnit({ id: 1, faction: 'ally', wx: 300, wy: 100 });
    state.units.push(ally);
    system.update(0.016, state);
    expect((state.units[0] as Unit).attackBuff).toBeUndefined();
    expect((state.units[0] as Unit).defenseBuff).toBeUndefined();
  });

  it('drains energy while the buff tower is actively affecting allies', () => {
    const state = makeState({ resources: 20 });
    state.buildings.push({
      id: 2, type: 'buff', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 128, damage: 0, attackRate: 0, attackCooldown: 0,
      buffValue: 0.25, resourceRate: 3, hp: 100, maxHp: 100,
    });
    const ally = makeUnit({ id: 1, faction: 'ally', wx: 130, wy: 100 });
    state.units.push(ally);

    system.update(1, state);

    expect(state.resources).toBe(17);
    expect((state.units[0] as Unit).attackBuff).toBeGreaterThan(1);
  });

  it('does not drain energy when the buff tower has no allies in range', () => {
    const state = makeState({ resources: 20 });
    state.buildings.push({
      id: 2, type: 'buff', wx: 100, wy: 100, tileCol: 0, tileRow: 0,
      radius: 50, damage: 0, attackRate: 0, attackCooldown: 0,
      buffValue: 0.25, resourceRate: 3, hp: 100, maxHp: 100,
    });
    const ally = makeUnit({ id: 1, faction: 'ally', wx: 300, wy: 100 });
    state.units.push(ally);

    system.update(0.016, state);

    expect(state.resources).toBe(20);
    expect((state.units[0] as Unit).attackBuff).toBeUndefined();
  });
});
