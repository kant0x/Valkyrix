// src/game/GameRenderer.ts
// Visual layer: renders units, buildings, citadel, portal and projectiles with real sprites.

import { GAME_VIEW_H, GAME_W } from '../shared/RuntimeViewport';
import type { GameState, Projectile, Unit } from './game.types';

// ---------------------------------------------------------------------------
// Sprite manifests
// ---------------------------------------------------------------------------

const range = (n: number, start = 1) =>
  Array.from({ length: n }, (_, i) => String(i + start).padStart(2, '0'));

const BOITS_WALK    = range(4).map(n => `/assets/pers/boits/split/boits_walk_${n}.png`);
const BOITS_ATTACK  = range(6).map(n => `/assets/pers/boits/split/boits_attack_${n}.png`);

const VIKING_DIRS: Record<string, string> = {
  south:      '/assets/pers/viking/rotations/south.png',
  'south-east': '/assets/pers/viking/rotations/south-east.png',
  east:       '/assets/pers/viking/rotations/east.png',
  'north-east': '/assets/pers/viking/rotations/north-east.png',
  north:      '/assets/pers/viking/rotations/north.png',
  'north-west': '/assets/pers/viking/rotations/north-west.png',
  west:       '/assets/pers/viking/rotations/west.png',
  'south-west': '/assets/pers/viking/rotations/south-west.png',
};

const COLLECTOR_DIRS: Record<string, string> = {
  east:      '/assets/pers/collector/direction/East.png',
  north:     '/assets/pers/collector/direction/north.png',
  northeast: '/assets/pers/collector/direction/northeast.png',
  northwest: '/assets/pers/collector/direction/northwest.png',
  south:     '/assets/pers/collector/direction/south.png',
  west:      '/assets/pers/collector/direction/west.png',
};
const COLLECTOR_COLLECT = range(6).map(n => `/assets/pers/collector/resource collection/split/collect_${n}.png`);
const BALL_SPRITES = {
  directly: '/assets/ball/ball_directly.png',
  left: '/assets/ball/ball_left.png',
  right: '/assets/ball/ball_right.png',
  south: '/assets/ball/ball_south.png',
} as const;

function unitScale(zoom: number): number {
  return Math.max(0.74, Math.min(0.9, zoom * 0.46));
}

function buildingScale(zoom: number): number {
  return Math.max(1.1, Math.min(1.35, zoom * 0.65));
}

// ---------------------------------------------------------------------------
// Image cache
// ---------------------------------------------------------------------------

const _cache = new Map<string, HTMLImageElement>();

function img(src: string): HTMLImageElement {
  let el = _cache.get(src);
  if (!el) {
    el = new Image();
    el.src = src;
    _cache.set(src, el);
  }
  return el;
}

function preload(paths: string[]): void {
  for (const p of paths) img(p);
}

function ready(el: HTMLImageElement): boolean {
  return el.complete && el.naturalWidth > 0;
}

// Pick frame from a pre-split frameset by elapsed seconds + fps
function frame(frames: string[], fps: number, elapsed: number): HTMLImageElement {
  const idx = Math.floor(elapsed * fps) % frames.length;
  return img(frames[idx]);
}

function stripFrame(src: string, fps: number, elapsed: number) {
  const el = img(src);
  const frameSize = Math.max(1, el.naturalHeight || el.height || 1);
  const frameCount = Math.max(1, Math.floor((el.naturalWidth || el.width || frameSize) / frameSize));
  const idx = Math.floor(elapsed * fps) % frameCount;
  return { el, sx: idx * frameSize, sy: 0, sw: frameSize, sh: frameSize };
}

// ---------------------------------------------------------------------------
// Direction helper
// ---------------------------------------------------------------------------

function directionKey(dx: number, dy: number): string {
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle > -22.5 && angle <= 22.5)   return 'east';
  if (angle > 22.5  && angle <= 67.5)   return 'south-east';
  if (angle > 67.5  && angle <= 112.5)  return 'south';
  if (angle > 112.5 && angle <= 157.5)  return 'south-west';
  if (angle > 157.5 || angle <= -157.5) return 'west';
  if (angle > -157.5 && angle <= -112.5) return 'north-west';
  if (angle > -112.5 && angle <= -67.5)  return 'north';
  return 'north-east';
}

// ---------------------------------------------------------------------------
// GameRenderer
// ---------------------------------------------------------------------------

export class GameRenderer {
  /** Start time for animation clock */
  private readonly startMs = Date.now();

  constructor(private arrowImg: HTMLImageElement) {
    // Preload everything up front so images are ready by first wave
    preload(BOITS_WALK);
    preload(BOITS_ATTACK);
    preload(Object.values(VIKING_DIRS));
    preload(Object.values(COLLECTOR_DIRS));
    preload(COLLECTOR_COLLECT);
    preload(Object.values(BALL_SPRITES));
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cameraCenter: { x: number; y: number },
    zoom: number,
  ): void {
    const elapsed = (Date.now() - this.startMs) / 1000;
    this.drawBuildings(ctx, state, cameraCenter, zoom);
    this.drawUnits(ctx, state, cameraCenter, zoom, elapsed);
    this.drawProjectiles(ctx, state, cameraCenter, zoom);
  }

  renderDebugPath(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cameraCenter: { x: number; y: number },
    zoom: number,
  ): void {
    ctx.save();
    ctx.fillStyle = '#00ffff';
    for (const node of state.pathNodes) {
      const { sx, sy } = GameRenderer.wts(node.wx, node.wy, cameraCenter, zoom);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // Portal & Citadel (animated, map-level objects)
  // -------------------------------------------------------------------

  // -------------------------------------------------------------------
  // Buildings (towers — keep colored rects, sprites come in Phase 4)
  // -------------------------------------------------------------------

  private drawBuildings(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
  ): void {
    for (const b of state.buildings) {
      const scale = buildingScale(zoom);
      const bodyW = 34 * scale;
      const bodyH = 54 * scale;
      const baseW = 54 * scale;
      const baseH = 16 * scale;
      const roofH = 18 * scale;
      const { sx, sy } = GameRenderer.wts(b.wx, b.wy, cam, zoom);
      const fill = b.type === 'attack' ? '#d94c3b' : '#2d89d3';
      const accent = b.type === 'attack' ? '#ffd8cf' : '#d6ecff';
      ctx.save();
      ctx.fillStyle = 'rgba(6, 12, 22, 0.42)';
      ctx.beginPath();
      ctx.ellipse(sx, sy - 3 * scale, baseW / 2, baseH / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - baseH * 0.75);
      ctx.lineTo(sx + baseW / 2, sy);
      ctx.lineTo(sx, sy + baseH * 0.45);
      ctx.lineTo(sx - baseW / 2, sy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = fill;
      ctx.fillRect(sx - bodyW / 2, sy - bodyH, bodyW, bodyH);

      ctx.beginPath();
      ctx.moveTo(sx - bodyW * 0.65, sy - bodyH + roofH * 0.45);
      ctx.lineTo(sx, sy - bodyH - roofH);
      ctx.lineTo(sx + bodyW * 0.65, sy - bodyH + roofH * 0.45);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = accent;
      ctx.fillRect(sx - bodyW * 0.12, sy - bodyH * 0.72, bodyW * 0.24, bodyH * 0.34);

      ctx.strokeStyle = '#f6fbff';
      ctx.lineWidth = Math.max(1, scale);
      ctx.stroke();

      ctx.restore();
    }
  }

  // -------------------------------------------------------------------
  // Units
  // -------------------------------------------------------------------

  private drawUnits(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    for (const unit of state.units) {
      this.drawUnit(ctx, unit, state, cam, zoom, elapsed);
    }
  }

  private drawUnit(
    ctx: CanvasRenderingContext2D,
    unit: Unit,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    const spriteKey = unit.def.sprite;   // 'boits' | 'viking' | 'collector'
    const scale = unitScale(zoom);

    // --- boits (fast enemy units) ---
    if (spriteKey === 'boits') {
      const inAttackState = unit.state === 'fighting' || unit.state === 'attacking-base';
      const frames = inAttackState ? BOITS_ATTACK : BOITS_WALK;
      const fps    = inAttackState ? 12 : 8;
      const el = frame(frames, fps, elapsed);
      this.drawSprite(ctx, el, unit.wx, unit.wy, 30 * scale, 38 * scale, cam, zoom);
      return;
    }

    // --- viking (ally defenders) ---
    if (spriteKey === 'viking') {
      // Pick direction from movement delta
      let dir = 'south-east';
      const next = this.getNextWaypoint(unit, state.pathNodes);
      if (next) {
        dir = directionKey(next.wx - unit.wx, next.wy - unit.wy);
      }
      // Viking rotations only have 8 canonical keys; fall back to closest
      const dirImg = img(VIKING_DIRS[dir] ?? VIKING_DIRS['south-east']);
      this.drawSprite(ctx, dirImg, unit.wx, unit.wy, 34 * scale, 46 * scale, cam, zoom);
      return;
    }

    // --- collector (flying loot drone) ---
    if (spriteKey === 'collector') {
      let cdir = 'east';
      const next = this.getNextWaypoint(unit, state.pathNodes);
      if (next) {
        cdir = directionKey(next.wx - unit.wx, next.wy - unit.wy);
        // Collector only has 6 directions — map to nearest
        if (cdir === 'north-east') cdir = 'northeast';
        if (cdir === 'north-west') cdir = 'northwest';
        if (cdir === 'south-east' || cdir === 'south-west') cdir = 'south';
      }
      const cImg = img(COLLECTOR_DIRS[cdir] ?? COLLECTOR_DIRS['east']);
      this.drawSprite(ctx, cImg, unit.wx, unit.wy, 28 * scale, 28 * scale, cam, zoom);
      return;
    }

    // --- fallback rectangle ---
    const { sx, sy } = GameRenderer.wts(unit.wx, unit.wy, cam, zoom);
    ctx.fillStyle = unit.faction === 'enemy' ? '#e67e22' : '#2ecc71';
    ctx.fillRect(sx - 6 * scale, sy - 10 * scale, 12 * scale, 20 * scale);
  }

  // -------------------------------------------------------------------
  // Projectiles
  // -------------------------------------------------------------------

  private drawProjectiles(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
  ): void {
    const elapsed = (Date.now() - this.startMs) / 1000;
    for (const proj of state.projectiles) {
      const target = state.units.find(u => u.id === proj.targetUnitId);
      if (!target) continue;
      const { sx, sy } = GameRenderer.wts(proj.wx, proj.wy, cam, zoom);
      const angle = Math.atan2(target.wy - proj.wy, target.wx - proj.wx);
      const projectileSize = proj.size ?? 32;
      const ballSprite = this.resolveProjectileSprite(proj, angle);

      if (ballSprite) {
        const frameDef = stripFrame(ballSprite, 12, elapsed);
        if (ready(frameDef.el)) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.drawImage(
            frameDef.el,
            frameDef.sx,
            frameDef.sy,
            frameDef.sw,
            frameDef.sh,
            -projectileSize / 2,
            -projectileSize / 2,
            projectileSize,
            projectileSize,
          );
          ctx.restore();
          continue;
        }
      }

      if (ready(this.arrowImg)) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.drawImage(this.arrowImg, -16, -8, 32, 16);
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /** Draw a sprite centered-bottom at world position */
  private drawSprite(
    ctx: CanvasRenderingContext2D,
    el: HTMLImageElement,
    wx: number,
    wy: number,
    w: number,
    h: number,
    cam: { x: number; y: number },
    zoom: number,
  ): void {
    const { sx, sy } = GameRenderer.wts(wx, wy, cam, zoom);
    if (ready(el)) {
      ctx.drawImage(el, sx - w / 2, sy - h, w, h);
    } else {
      // Placeholder while loading
      ctx.fillStyle = 'rgba(100,140,200,0.4)';
      ctx.fillRect(sx - w / 2, sy - h, w, h);
    }
  }

  private resolveProjectileSprite(proj: Projectile, angle: number): string | null {
    if (proj.source === 'citadel') {
      return BALL_SPRITES.right;
    }

    const deg = angle * (180 / Math.PI);
    if (deg > -45 && deg <= 45) return BALL_SPRITES.right;
    if (deg > 45 && deg <= 135) return BALL_SPRITES.south;
    if (deg > 135 || deg <= -135) return BALL_SPRITES.left;
    return BALL_SPRITES.directly;
  }

  private static wts(
    wx: number,
    wy: number,
    cam: { x: number; y: number },
    zoom: number,
  ): { sx: number; sy: number } {
    return {
      sx: GAME_W / 2 + (wx - cam.x) * zoom,
      sy: GAME_VIEW_H / 2 + (wy - cam.y) * zoom,
    };
  }

  private getNextWaypoint(
    unit: Unit,
    nodes: Array<{ wx: number; wy: number }>,
  ): { wx: number; wy: number } | null {
    if (nodes.length < 2) return null;

    if (unit.faction === 'enemy') {
      return nodes[Math.min(unit.pathIndex + 1, nodes.length - 1)] ?? null;
    }

    const nextIndex = Math.max(0, nodes.length - unit.pathIndex - 2);
    return nodes[nextIndex] ?? null;
  }
}
