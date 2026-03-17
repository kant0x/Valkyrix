import type { Building, GameState } from './game.types';

// Renderer constants — must match main.ts
const ISO_LAYER_X = 1152;
const GAME_W = 1280;
const GAME_VIEW_H = 506;

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

// Projectile speed in world units/second
const PROJECTILE_SPEED = 400;

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
export function canvasClickToTile(
  clickX: number,
  clickY: number,
  canvasEl: HTMLCanvasElement,
  cameraCenter: { x: number; y: number },
  zoom: number,
  tileWidth: number,
  tileHeight: number,
): { col: number; row: number } {
  const scaleX = GAME_W / canvasEl.clientWidth;
  const scaleY = GAME_VIEW_H / canvasEl.clientHeight;
  const gameX = clickX * scaleX;
  const gameY = clickY * scaleY;

  // Invert worldToScreen to get world coords
  const wx = cameraCenter.x + (gameX - GAME_W / 2) / zoom;
  const wy = cameraCenter.y + (gameY - GAME_VIEW_H / 2) / zoom;

  // Invert tileToWorld:
  //   wx = (col - row) * halfW + halfW + ISO_LAYER_X
  //   wy = (col + row) * halfH + halfH
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  const adjX = wx - ISO_LAYER_X - halfW;
  const adjY = wy - halfH;

  const col = Math.round((adjX / halfW + adjY / halfH) / 2);
  const row = Math.round((adjY / halfH - adjX / halfW) / 2);
  return { col, row };
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

    // 2. Occupation check
    const isOccupied = state.buildings.some(
      (b) => b.tileCol === tileCol && b.tileRow === tileRow,
    );
    if (isOccupied) return false;

    // 3. Resource check
    const cost = type === 'attack' ? ATTACK_COST : BUFF_COST;
    if (state.resources < cost) return false;

    // 4. Compute world position
    const { wx, wy } = tileToWorld(tileCol, tileRow, tileWidth, tileHeight);

    // 5. Build the Building object
    const stats = type === 'attack' ? ATTACK_STATS : BUFF_STATS;
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
    };

    state.resources -= cost;
    state.buildings.push(building);
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
    state.resources += refund;
    return true;
  }

  /**
   * Update all buildings each frame.
   * - Attack towers: decrement cooldown; fire at nearest enemy in radius when ready.
   * - Buff towers: set speedBuff=1.25 on ally units within radius each frame.
   */
  update(dt: number, state: GameState): void {
    for (const bldg of state.buildings) {
      if (bldg.type === 'attack') {
        this._updateAttackTower(bldg, state, dt);
      } else if (bldg.type === 'buff') {
        this._updateBuffTower(bldg, state);
      }
    }
  }

  private _updateAttackTower(bldg: Building, state: GameState, dt: number): void {
    if (bldg.attackCooldown > 0) {
      bldg.attackCooldown -= dt;
      return;
    }

    // Find nearest enemy in radius (Pattern 4 from RESEARCH.md)
    let nearest = null as import('./game.types').Unit | null;
    let nearestDist = Infinity;
    for (const unit of state.units) {
      if (unit.faction !== 'enemy') continue;
      const dx = unit.wx - bldg.wx;
      const dy = unit.wy - bldg.wy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= bldg.radius && d < nearestDist) {
        nearest = unit;
        nearestDist = d;
      }
    }
    if (!nearest) return;

    // Spawn projectile
    state.projectiles.push({
      id: state.nextId++,
      wx: bldg.wx,
      wy: bldg.wy,
      targetUnitId: nearest.id,
      speed: PROJECTILE_SPEED,
      damage: bldg.damage,
    });
    bldg.attackCooldown = 1 / bldg.attackRate;
  }

  private _updateBuffTower(bldg: Building, state: GameState): void {
    for (const unit of state.units) {
      if (unit.faction !== 'ally') continue;
      const dx = unit.wx - bldg.wx;
      const dy = unit.wy - bldg.wy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= bldg.radius) {
        unit.speedBuff = 1 + bldg.buffValue; // 1.25
      }
    }
  }
}
