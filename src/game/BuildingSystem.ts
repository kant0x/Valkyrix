import { GAME_VIEW_H, GAME_W } from '../shared/RuntimeViewport';
import { getAttackTowerOrbDescriptor, getCitadelOrbDescriptors } from '../rendering/BuildingEffects';
import type { Building, GameState } from './game.types';
import type { BlockchainService } from '../blockchain/BlockchainService';
import { getCurrentState } from '../wallet/WalletService';

// Renderer constants — must match main.ts
const ISO_LAYER_X = 1152;

// Building balance (locked in 03-03-PLAN.md)
const ATTACK_COST = 50;
const BUFF_COST = 40;
const SELL_RETURN_FRACTION = 0.6;

const ATTACK_STATS = {
  damage: 30,
  attackRate: 1.0,
  radius: 160,
  resourceRate: 5,
  buffValue: 0,
};

const BUFF_STATS = {
  damage: 0,
  attackRate: 0,
  radius: 128,
  resourceRate: 3,
  buffValue: 0.25,
};
const BUFF_ATTACK_MULTIPLIER = 1.22;
const BUFF_DEFENSE_MULTIPLIER = 0.8;

// Projectile speed in world units/second
const PROJECTILE_SPEED = 300;
const PROJECTILE_SIZE = 18;
const ATTACK_TOWER_ORB_WIDTH = 64;
const ATTACK_TOWER_ORB_HEIGHT = 96;
const CITADEL_RANGE = 240;
const CITADEL_ATTACK_INTERVAL = 0.5;
const CITADEL_FIRE_BRIGHTNESS_THRESHOLD = 0.87;
const CITADEL_PROJECTILE_SPEED = 180;
const CITADEL_PROJECTILE_SIZE = 16;
const CITADEL_PROJECTILE_DAMAGE = 22;
const CITADEL_ORB_WORLD_WIDTH = 192;
const CITADEL_ORB_WORLD_HEIGHT = 192;

/**
 * Convert a canvas click pixel position to an isometric tile (col, row).
 * Used by the Plan 06 click handler in main.ts.
 *
 * @param clickX - click X in canvas client pixels
 * @param clickY - click Y in canvas client pixels
 * @param canvasEl - the HTMLCanvasElement
 * @param cameraCenter - current camera center in world coords
 * @param zoom - current camera zoom
 * @param tileWidth - tile width in world units (64)
 * @param tileHeight - tile height in world units (32)
 */
export function canvasPointToWorld(
  clickX: number,
  clickY: number,
  canvasEl: HTMLCanvasElement,
  cameraCenter: { x: number; y: number },
  zoom: number,
): { wx: number; wy: number } {
  const scaleX = GAME_W / canvasEl.clientWidth;
  const scaleY = GAME_VIEW_H / canvasEl.clientHeight;
  const gameX = clickX * scaleX;
  const gameY = clickY * scaleY;

  return {
    wx: cameraCenter.x + (gameX - GAME_W / 2) / zoom,
    wy: cameraCenter.y + (gameY - GAME_VIEW_H / 2) / zoom,
  };
}

export function isWorldPointInsideTile(
  wx: number,
  wy: number,
  col: number,
  row: number,
  tileWidth: number,
  tileHeight: number,
): boolean {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  const tile = tileToWorld(col, row, tileWidth, tileHeight);
  const dx = wx - tile.wx;
  const dy = wy - tile.wy;
  return Math.abs(dx) / Math.max(halfW, 0.001) + Math.abs(dy) / Math.max(halfH, 0.001) <= 1.0001;
}

export function canvasClickToTile(
  clickX: number,
  clickY: number,
  canvasEl: HTMLCanvasElement,
  cameraCenter: { x: number; y: number },
  zoom: number,
  tileWidth: number,
  tileHeight: number,
): { col: number; row: number } {
  const { wx, wy } = canvasPointToWorld(clickX, clickY, canvasEl, cameraCenter, zoom);

  // Invert tileToWorld:
  //   wx = (col - row) * halfW + halfW + ISO_LAYER_X
  //   wy = (col + row) * halfH + halfH
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  const adjX = wx - ISO_LAYER_X - halfW;
  const adjY = wy - halfH;

  const approxCol = (adjX / halfW + adjY / halfH) / 2;
  const approxRow = (adjY / halfH - adjX / halfW) / 2;
  const centerCol = Math.round(approxCol);
  const centerRow = Math.round(approxRow);

  let best = { col: centerCol, row: centerRow };
  let bestDist = Number.POSITIVE_INFINITY;

  for (let row = centerRow - 1; row <= centerRow + 1; row += 1) {
    for (let col = centerCol - 1; col <= centerCol + 1; col += 1) {
      const tile = tileToWorld(col, row, tileWidth, tileHeight);
      const dx = tile.wx - wx;
      const dy = tile.wy - wy;
      const insideDiamond = isWorldPointInsideTile(wx, wy, col, row, tileWidth, tileHeight);
      const dist = dx * dx + dy * dy;
      if (insideDiamond && dist < bestDist) {
        best = { col, row };
        bestDist = dist;
      }
    }
  }

  if (bestDist < Number.POSITIVE_INFINITY) {
    return best;
  }

  for (let row = centerRow - 1; row <= centerRow + 1; row += 1) {
    for (let col = centerCol - 1; col <= centerCol + 1; col += 1) {
      const tile = tileToWorld(col, row, tileWidth, tileHeight);
      const dx = tile.wx - wx;
      const dy = tile.wy - wy;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        best = { col, row };
        bestDist = dist;
      }
    }
  }

  return best;
}

/**
 * Convert a tile (col, row) to world (wx, wy).
 * Active map: tileWidth=64, tileHeight=32.
 */
function tileToWorld(
  col: number,
  row: number,
  tileWidth: number,
  tileHeight: number,
): { wx: number; wy: number } {
  return {
    wx: (col - row) * (tileWidth / 2) + tileWidth / 2 + ISO_LAYER_X,
    wy: (col + row) * (tileHeight / 2) + tileHeight / 2,
  };
}

export class BuildingSystem {
  private citadelAttackCooldown = 0;
  private nextCitadelOrbSlot = 0;
  private blockchainService?: BlockchainService;

  setBlockchainService(service: BlockchainService): void {
    this.blockchainService = service;
  }
  /**
   * Place a tower on the map.
   * @returns true if placement succeeded; false if invalid (non-zone, occupied, or insufficient resources).
   */
  placeBuilding(
    type: 'attack' | 'buff',
    tileCol: number,
    tileRow: number,
    zoneLayer: number[],
    mapWidth: number,
    state: GameState,
    tileWidth = 64,
    tileHeight = 32,
  ): boolean {
    // 1. Zone check
    const idx = tileRow * mapWidth + tileCol;
    if ((zoneLayer[idx] ?? 0) === 0) return false;

    // 2. Occupation + proximity check (min 2 tiles apart)
    const isTooClose = state.buildings.some(
      (b) => Math.abs(b.tileCol - tileCol) < 2 && Math.abs(b.tileRow - tileRow) < 2,
    );
    if (isTooClose) return false;

    // 3. Citadel proximity check — no building within 3 tiles of citadel
    const citadel = state.pathNodes[state.pathNodes.length - 1];
    if (citadel) {
      const { wx: twx, wy: twy } = tileToWorld(tileCol, tileRow, tileWidth, tileHeight);
      const citadelDist = Math.hypot(twx - citadel.wx, twy - citadel.wy);
      if (citadelDist < tileWidth * 3) return false;
    }

    // 4. Resource check
    const cost = type === 'attack' ? ATTACK_COST : BUFF_COST;
    if (state.resources < cost) return false;

    // 5. Compute world position
    const { wx, wy } = tileToWorld(tileCol, tileRow, tileWidth, tileHeight);

    // 5. Build the Building object
    const stats = type === 'attack' ? ATTACK_STATS : BUFF_STATS;
    const maxHp = type === 'attack' ? 150 : 100;
    const building: Building = {
      id: state.nextId++,
      type,
      wx,
      wy,
      tileCol,
      tileRow,
      radius: stats.radius,
      damage: stats.damage,
      attackRate: stats.attackRate,
      attackCooldown: 0,
      buffValue: stats.buffValue,
      resourceRate: stats.resourceRate,
      hp: maxHp,
      maxHp,
    };

    state.resources -= cost;
    state.buildings.push(building);
    const { publicKey } = getCurrentState();
    const buildKey = type === 'attack' ? 'attack-tower' : 'buff-tower';
    this.blockchainService?.recordCreate(buildKey, publicKey).catch(() => {});
    return true;
  }

  /**
   * Sell (remove) a tower, refunding 60% of its cost.
   * @returns true if found and removed; false if id not found.
   */
  sellBuilding(buildingId: number, state: GameState): boolean {
    const idx = state.buildings.findIndex((b) => b.id === buildingId);
    if (idx === -1) return false;

    const bldg = state.buildings[idx];
    const cost = bldg.type === 'attack' ? ATTACK_COST : BUFF_COST;
    const refund = Math.floor(cost * SELL_RETURN_FRACTION);

    state.buildings.splice(idx, 1);
    state.projectiles = state.projectiles.filter((proj) => proj.ownerBuildingId !== buildingId);
    state.resources += refund;
    return true;
  }

  /**
   * Update all buildings each frame.
   * - Attack towers: fire orb bolts at nearby enemies.
   * - Buff towers: sustain allied combat aura (damage + defense) while powered.
   */
  update(dt: number, state: GameState): void {
    for (const bldg of state.buildings) {
      if (bldg.type === 'attack') {
        this._updateAttackTower(bldg, state, dt);
      } else if (bldg.type === 'buff') {
        this._updateBuffTower(bldg, state, dt);
      }
    }
    this._updateCitadelDefense(state, dt);
  }

  private _updateAttackTower(bldg: Building, state: GameState, _dt: number): void {
    if (bldg.attackCooldown > 0) {
      bldg.attackCooldown -= _dt;
    }
    if (bldg.attackCooldown > 0) return;

    const target = this._findNearestEnemy(bldg.wx, bldg.wy, bldg.radius, state);
    if (!target) {
      bldg.attackCooldown = 0;
      return;
    }

    const orb = getAttackTowerOrbDescriptor(
      Date.now(),
      ATTACK_TOWER_ORB_WIDTH,
      ATTACK_TOWER_ORB_HEIGHT,
    );
    const originWx = bldg.wx + orb.offsetX;
    const originWy = bldg.wy + orb.offsetY;

    state.projectiles.push({
      id: state.nextId++,
      wx: originWx,
      wy: originWy,
      targetUnitId: target.id,
      speed: PROJECTILE_SPEED,
      damage: bldg.damage,
      kind: 'bolt',
      source: 'tower',
      size: PROJECTILE_SIZE,
      ownerBuildingId: bldg.id,
      aimWx: target.wx,
      aimWy: target.wy,
    });
    bldg.attackCooldown = 1 / Math.max(0.001, bldg.attackRate);
  }

  private _updateBuffTower(bldg: Building, state: GameState, dt: number): void {
    const buffedUnits = state.units.filter((unit) => {
      if (unit.faction !== 'ally') return false;
      const dx = unit.wx - bldg.wx;
      const dy = unit.wy - bldg.wy;
      return Math.sqrt(dx * dx + dy * dy) <= bldg.radius;
    });

    if (buffedUnits.length === 0) return;
    if (state.resources <= 0) return;

    const upkeep = Math.min(state.resources, bldg.resourceRate * Math.max(0, dt));
    state.resources = Math.max(0, state.resources - upkeep);

    for (const unit of buffedUnits) {
      unit.attackBuff = Math.max(unit.attackBuff ?? 1, BUFF_ATTACK_MULTIPLIER);
      unit.defenseBuff = Math.min(unit.defenseBuff ?? 1, BUFF_DEFENSE_MULTIPLIER);
      if (unit.buffAura !== 'overdrive') {
        unit.buffAura = 'tower';
      }
    }
  }

  private _updateCitadelDefense(state: GameState, _dt: number): void {
    if (state.pathNodes.length < 2) return;

    if (this.citadelAttackCooldown > 0) {
      this.citadelAttackCooldown -= _dt;
    }
    if (this.citadelAttackCooldown > 0) return;

    const citadel = state.pathNodes[state.pathNodes.length - 1];
    const orbDescriptors = getCitadelOrbDescriptors(
      Date.now(),
      4,
      CITADEL_ORB_WORLD_WIDTH,
      CITADEL_ORB_WORLD_HEIGHT,
    );
    const muzzleCandidates = orbDescriptors.map((orb) => ({
      slot: orb.slot,
      brightness: orb.brightness,
      isFront: orb.isFront,
      wx: citadel.wx + orb.offsetX,
      wy: citadel.wy + orb.offsetY,
    }));

    const enemies = state.units
      .filter((unit) => unit.faction === 'enemy' && unit.hp > 0)
      .map((unit) => ({
        unit,
        dist: Math.hypot(unit.wx - citadel.wx, unit.wy - citadel.wy),
      }))
      .filter((entry) => entry.dist <= CITADEL_RANGE)
      .sort((a, b) => a.dist - b.dist)
      .map((entry) => entry.unit);

    if (enemies.length === 0) return;

    const muzzle = this._pickCitadelMuzzle(muzzleCandidates);
    if (!muzzle) return;
    const target = enemies[0];

    state.projectiles.push({
      id: state.nextId++,
      wx: muzzle.wx,
      wy: muzzle.wy,
      targetUnitId: target.id,
      speed: CITADEL_PROJECTILE_SPEED,
      damage: CITADEL_PROJECTILE_DAMAGE,
      kind: 'bolt',
      source: 'citadel',
      size: CITADEL_PROJECTILE_SIZE,
      orbSlot: muzzle.slot,
      aimWx: target.wx,
      aimWy: target.wy,
    });
    this.nextCitadelOrbSlot = (muzzle.slot + 1) % Math.max(1, muzzleCandidates.length);
    this.citadelAttackCooldown = CITADEL_ATTACK_INTERVAL;
  }

  private _pickCitadelMuzzle(
    muzzleCandidates: Array<{
      slot: number;
      brightness: number;
      isFront: boolean;
      wx: number;
      wy: number;
    }>,
  ) {
    const total = Math.max(1, muzzleCandidates.length);
    for (let offset = 0; offset < total; offset += 1) {
      const desiredSlot = (this.nextCitadelOrbSlot + offset) % total;
      const candidate = muzzleCandidates.find((muzzle) => muzzle.slot === desiredSlot);
      if (!candidate) continue;
      if (!candidate.isFront) continue;
      if (candidate.brightness < CITADEL_FIRE_BRIGHTNESS_THRESHOLD) continue;
      return candidate;
    }
    return null;
  }

  private _findNearestEnemy(wx: number, wy: number, radius: number, state: GameState) {
    let nearest = null as import('./game.types').Unit | null;
    let nearestDist = Infinity;
    for (const unit of state.units) {
      if (unit.faction !== 'enemy' || unit.hp <= 0) continue;
      const dx = unit.wx - wx;
      const dy = unit.wy - wy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= radius && d < nearestDist) {
        nearest = unit;
        nearestDist = d;
      }
    }
    return nearest;
  }

}
