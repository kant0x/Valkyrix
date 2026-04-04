// src/game/GameRenderer.ts
// Visual layer: renders units, buildings, citadel, portal and projectiles with real sprites.

import { GAME_VIEW_H, GAME_W } from '../shared/RuntimeViewport';
import { getAttackTowerOrbDescriptor, getCitadelOrbDescriptors } from '../rendering/BuildingEffects';
import type { Corpse, GameState, ImpactMark, Projectile, Unit } from './game.types';
import { RANGED_FIRING_FLASH_DURATION } from './CombatSystem';

// ---------------------------------------------------------------------------
// Sprite manifests
// ---------------------------------------------------------------------------

const range = (n: number, start = 1) =>
  Array.from({ length: n }, (_, i) => String(i + start).padStart(2, '0'));
const frameRange = (n: number, pad = 3, start = 0) =>
  Array.from({ length: n }, (_, i) => String(i + start).padStart(pad, '0'));

const BOITS_WALK    = range(4).map(n => `/assets/pers/boits/split/boits_walk_${n}.png`);
const BOITS_ATTACK  = range(6).map(n => `/assets/pers/boits/split/boits_attack_${n}.png`);
const LASERS_WALK   = '/assets/pers/lasers/walk.png';
const LASERS_ATTACK = '/assets/pers/lasers/attack.png';
const LASERS_BEAM   = '/assets/pers/lasers/lasers.png';
const LASERS_KILL   = '/assets/pers/lasers/kill.png';
const VIKING_WALK = {
  south: frameRange(8).map(n => `/assets/pers/viking/animations/scary-walk/south/frame_${n}.png`),
  east: frameRange(8).map(n => `/assets/pers/viking/animations/scary-walk/east/frame_${n}.png`),
  west: frameRange(8).map(n => `/assets/pers/viking/animations/scary-walk/west/frame_${n}.png`),
  north: frameRange(8).map(n => `/assets/pers/viking/animations/scary-walk/north/frame_${n}.png`),
} as const;
const VIKING_ATTACK = {
  south: frameRange(4).map(n => `/assets/pers/viking/animations/custom-axe-blow/south/frame_${n}.png`),
} as const;

const COLLECTOR_DIRS: Record<string, string> = {
  east:      '/assets/pers/collector/direction/east-facing.png',
  north:     '/assets/pers/collector/direction/north.png',
  northeast: '/assets/pers/collector/direction/northeast.png',
  northwest: '/assets/pers/collector/direction/northwest.png',
  south:     '/assets/pers/collector/direction/south.png',
  west:      '/assets/pers/collector/direction/west.png',
};
const COLLECTOR_COLLECT = range(6).map(n => `/assets/pers/collector/resource-collection/split/collect_${n}.png`);
const CYBERNETIC_RUN = '/assets/pers/cybernetic/running/running.png';
const CYBERNETIC_ATTACK = '/assets/pers/cybernetic/attack/attack.png';
const CAPSULE_SPRITE = '/assets/capsula/capsullo.png';
const ATTACK_TOWER_SPRITE = '/assets/build/tower/tower_attack.png';
const ATTACK_TOWER_SPRITE_TRIM = {
  sx: 126,
  sy: 78,
  sw: 772,
  sh: 852,
} as const;
const ATTACK_TOWER_RENDER_TUNING = {
  // Anchor the tile center to the real base-center inside the imported sprite.
  anchorX: 386,
  anchorY: 628,
  // The edited sprite should now sit on the tile without extra positional nudges.
  drawWidthScale: 1,
  tileOffsetX: 0,
  tileOffsetY: 0,
  drawHeight: 72,
  shadowOffsetY: -1.5,
  shadowRadiusX: 13,
  shadowRadiusY: 4.5,
  shadowAlpha: 0.24,
  orbAnchorOffsetY: 1,
} as const;
const BALL_SPRITES = {
  directly: '/assets/ball/ball_directly.png',
  left: '/assets/ball/ball_left.png',
  right: '/assets/ball/ball_right.png',
  south: '/assets/ball/ball_south.png',
} as const;
const CITADEL_ORB_RENDER_COUNT = 4;
const CITADEL_ORB_WORLD_WIDTH = 192;
const CITADEL_ORB_WORLD_HEIGHT = 192;

function unitScale(zoom: number): number {
  return Math.max(0.74, Math.min(0.9, zoom * 0.46));
}


function buildingScale(zoom: number): number {
  return Math.max(1.1, Math.min(1.35, zoom * 0.65));
}

function attackTowerScale(zoom: number): number {
  return Math.max(0.1, zoom);
}

// ---------------------------------------------------------------------------
// Image cache
// ---------------------------------------------------------------------------

const _cache = new Map<string, HTMLImageElement>();
const _sheetFrameCache = new Map<string, HTMLCanvasElement[]>();

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

function sheetFrames(src: string, frameCount: number): HTMLCanvasElement[] | null {
  const cached = _sheetFrameCache.get(src);
  if (cached) return cached;

  const sheet = img(src);
  if (!ready(sheet)) return null;

  const frameWidth = Math.floor((sheet.naturalWidth || sheet.width) / frameCount);
  const frameHeight = sheet.naturalHeight || sheet.height || 1;
  const frames: HTMLCanvasElement[] = [];

  for (let index = 0; index < frameCount; index += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.drawImage(
      sheet,
      index * frameWidth,
      0,
      frameWidth,
      frameHeight,
      0,
      0,
      frameWidth,
      frameHeight,
    );

    const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      // Stronger near-white cleanup for hand-cut sprite sheets:
      // fully remove paper-white background and aggressively suppress the
      // semi-transparent white fringe left around the silhouette.
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (lum >= 200) {
        data[i + 3] = 0;
        continue;
      }
      if (lum > 160) {
        const fringe = Math.min(1, (lum - 160) / 40);
        const fadedAlpha = Math.round(alpha * (1 - fringe) * (1 - fringe));
        data[i + 3] = fadedAlpha <= 40 ? 0 : fadedAlpha;
        const darken = 1 - fringe * 0.80;
        data[i] = Math.round(r * darken);
        data[i + 1] = Math.round(g * darken);
        data[i + 2] = Math.round(b * darken);
      }
    }
    ctx.putImageData(imageData, 0, 0);
    frames.push(canvas);
  }

  _sheetFrameCache.set(src, frames);
  return frames;
}

// Pick frame from a pre-split frameset by elapsed seconds + fps
/** Linear interpolation of beam radius at fractional position along the cone */
function rAtFrac(rTop: number, rBot: number, frac: number): number {
  return rTop + (rBot - rTop) * frac;
}

function frame(frames: string[], fps: number, elapsed: number): HTMLImageElement {
  const idx = Math.floor(elapsed * fps) % frames.length;
  return img(frames[idx]);
}

function frameAtProgress(frames: string[], progress: number): HTMLImageElement {
  const clamped = Math.max(0, Math.min(0.999, progress));
  const idx = Math.min(frames.length - 1, Math.floor(clamped * frames.length));
  return img(frames[idx]);
}

function stripFrame(src: string, fps: number, elapsed: number) {
  const el = img(src);
  const frameSize = Math.max(1, el.naturalHeight || el.height || 1);
  const frameCount = Math.max(1, Math.floor((el.naturalWidth || el.width || frameSize) / frameSize));
  const idx = Math.floor(elapsed * fps) % frameCount;
  return { el, sx: idx * frameSize, sy: 0, sw: frameSize, sh: frameSize };
}

function stripFrameAtProgress(src: string, progress: number) {
  const el = img(src);
  const frameSize = Math.max(1, el.naturalHeight || el.height || 1);
  const frameCount = Math.max(1, Math.floor((el.naturalWidth || el.width || frameSize) / frameSize));
  const clamped = Math.max(0, Math.min(0.999, progress));
  const idx = Math.min(frameCount - 1, Math.floor(clamped * frameCount));
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
    preload(Object.values(VIKING_WALK).flat());
    preload(Object.values(VIKING_ATTACK).flat());
    preload(Object.values(COLLECTOR_DIRS));
    preload(COLLECTOR_COLLECT);
    preload([CYBERNETIC_RUN, CYBERNETIC_ATTACK, CAPSULE_SPRITE]);
    preload([ATTACK_TOWER_SPRITE]);
    preload([LASERS_WALK, LASERS_ATTACK, LASERS_BEAM, LASERS_KILL]);
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
    this.drawGroundImpactMarks(ctx, state, cameraCenter, zoom);
    this.drawSalvageDrops(ctx, state, cameraCenter, zoom, elapsed);
    this.drawBuildings(ctx, state, cameraCenter, zoom);
    this.drawCorpses(ctx, state, cameraCenter, zoom);
    // Draw capsule bodies before units so soldiers appear in front
    this.drawDropPodBodies(ctx, state, cameraCenter, zoom, elapsed);
    this.drawUnits(ctx, state, cameraCenter, zoom, elapsed);
    this.drawProjectiles(ctx, state, cameraCenter, zoom);
    this.drawSupportStrikeEffects(ctx, state, cameraCenter, zoom, elapsed);
  }

  renderDropPodOverlay(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cameraCenter: { x: number; y: number },
    zoom: number,
  ): void {
    const elapsed = (Date.now() - this.startMs) / 1000;
    this.drawDropPods(ctx, state, cameraCenter, zoom, elapsed);
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
    const nowMs = Date.now();
    for (const b of state.buildings) {
      if (b.type === 'attack') {
        this.drawAttackTower(ctx, b.wx, b.wy, cam, zoom, nowMs);
        continue;
      }

      const scale = buildingScale(zoom);
      const bodyW = 34 * scale;
      const bodyH = 54 * scale;
      const baseW = 54 * scale;
      const baseH = 16 * scale;
      const roofH = 18 * scale;
      const { sx, sy } = GameRenderer.wts(b.wx, b.wy, cam, zoom);
      const fill = '#2d89d3';
      const accent = '#d6ecff';
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

  private drawGroundImpactMarks(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
  ): void {
    for (const mark of state.impactMarks ?? []) {
      const fade = Math.max(0, Math.min(1, mark.ttl / Math.max(mark.maxTtl, 0.001)));
      const { sx, sy } = GameRenderer.wts(mark.wx, mark.wy, cam, zoom);
      const radius = mark.radius * Math.max(0.8, zoom * 0.9);
      ctx.save();
      ctx.translate(sx, sy + radius * 0.2);
      ctx.rotate(-0.18);
      ctx.globalAlpha = 0.72 * fade;
      ctx.fillStyle = 'rgba(48, 28, 18, 0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.45, radius * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.42 * fade;
      ctx.fillStyle = 'rgba(48, 28, 18, 0.28)';
      ctx.beginPath();
      ctx.ellipse(radius * 0.08, -radius * 0.04, radius * 0.9, radius * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();

      if (mark.source === 'citadel') {
        ctx.globalAlpha = 0.34 * fade;
        ctx.strokeStyle = 'rgba(118, 230, 255, 0.9)';
        ctx.lineWidth = Math.max(1.5, radius * 0.12);
        ctx.beginPath();
        ctx.ellipse(0, -radius * 0.02, radius * 1.08, radius * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.18 * fade;
        ctx.fillStyle = 'rgba(64, 220, 255, 0.75)';
        ctx.beginPath();
        ctx.ellipse(0, -radius * 0.06, radius * 0.62, radius * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawCitadelSkyStrike(
    ctx: CanvasRenderingContext2D,
    mark: ImpactMark,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    const fade = Math.max(0, Math.min(1, mark.ttl / Math.max(mark.maxTtl, 0.001)));
    const age = 1 - fade;
    const strikeWindow = Math.max(0, 1 - age / 0.42);
    const residual = Math.max(0, 1 - age / 0.78);
    if (strikeWindow <= 0 && residual <= 0) return;

    const { sx, sy } = GameRenderer.wts(mark.wx, mark.wy, cam, zoom);
    const radius = mark.radius * Math.max(0.86, zoom);
    const seed = ((mark.id * 37) % 100) / 100;
    const skew = (-24 + seed * 48) * zoom;
    const topX = sx + skew;
    const topY = sy - (260 + seed * 70) * Math.max(0.8, zoom);
    const impactX = sx;
    const impactY = sy - radius * 0.34;
    const pulse = 0.82 + Math.sin(elapsed * 19 + mark.id * 0.73) * 0.12;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';

    ctx.strokeStyle = `rgba(94, 214, 255, ${0.14 * strikeWindow})`;
    ctx.lineWidth = Math.max(18, 36 * zoom * pulse);
    ctx.shadowColor = 'rgba(112, 230, 255, 0.5)';
    ctx.shadowBlur = 28 * Math.max(0.85, zoom);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(impactX, impactY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(158, 242, 255, ${0.24 * strikeWindow})`;
    ctx.lineWidth = Math.max(10, 21 * zoom * pulse);
    ctx.shadowBlur = 16 * Math.max(0.85, zoom);
    ctx.beginPath();
    ctx.moveTo(topX + 5 * zoom, topY);
    ctx.lineTo(impactX, impactY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(240, 252, 255, ${0.88 * strikeWindow})`;
    ctx.lineWidth = Math.max(2.5, 6.5 * zoom);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(impactX, impactY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(220, 252, 255, ${0.48 * strikeWindow})`;
    ctx.lineWidth = Math.max(1, 2.2 * zoom);
    for (let i = 0; i < 3; i += 1) {
      const innerOffset = (i - 1) * 5 * zoom;
      ctx.beginPath();
      ctx.moveTo(topX + innerOffset, topY + 6 * zoom);
      ctx.lineTo(impactX + innerOffset * 0.22, impactY - 2 * zoom);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(132, 234, 255, ${0.36 * strikeWindow})`;
    ctx.lineWidth = Math.max(1, 1.7 * zoom);
    for (let i = 0; i < 4; i += 1) {
      const branchStart = 0.18 + i * 0.14;
      const branchEnd = branchStart + 0.12 + (i % 2) * 0.05;
      const fromX = topX + (impactX - topX) * branchStart;
      const fromY = topY + (impactY - topY) * branchStart;
      const toX = topX + (impactX - topX) * branchEnd + ((i % 2 === 0 ? -1 : 1) * (14 + i * 4) * zoom);
      const toY = topY + (impactY - topY) * branchEnd + (8 + i * 3) * zoom;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo((fromX + toX) * 0.5, (fromY + toY) * 0.5 - 6 * zoom);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }

    const bloom = ctx.createRadialGradient(
      impactX,
      impactY,
      radius * 0.2,
      impactX,
      impactY,
      radius * 2.5,
    );
    bloom.addColorStop(0, `rgba(255, 255, 255, ${0.92 * strikeWindow})`);
    bloom.addColorStop(0.24, `rgba(160, 244, 255, ${0.78 * strikeWindow})`);
    bloom.addColorStop(0.68, `rgba(72, 178, 255, ${0.26 * residual})`);
    bloom.addColorStop(1, 'rgba(32, 92, 192, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(impactX, impactY, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    const pillar = ctx.createLinearGradient(
      impactX,
      impactY - radius * 2.6,
      impactX,
      impactY + radius * 0.8,
    );
    pillar.addColorStop(0, `rgba(100, 214, 255, 0)`);
    pillar.addColorStop(0.35, `rgba(128, 232, 255, ${0.18 * strikeWindow})`);
    pillar.addColorStop(0.7, `rgba(160, 242, 255, ${0.28 * strikeWindow})`);
    pillar.addColorStop(1, `rgba(210, 250, 255, 0)`);
    ctx.fillStyle = pillar;
    ctx.beginPath();
    ctx.ellipse(impactX, impactY - radius * 1.05, radius * 0.46, radius * 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(180, 248, 255, ${0.7 * residual})`;
    ctx.lineWidth = Math.max(1.5, 2.4 * zoom);
    ctx.beginPath();
    ctx.ellipse(impactX, impactY + radius * 0.12, radius * 1.3, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();

    const rayCount = 6;
    ctx.strokeStyle = `rgba(132, 238, 255, ${0.52 * residual})`;
    ctx.lineWidth = Math.max(1, 1.6 * zoom);
    for (let i = 0; i < rayCount; i += 1) {
      const angle = elapsed * 13 + mark.id * 0.19 + i * ((Math.PI * 2) / rayCount);
      const spread = (10 + (i % 3) * 5) * zoom * (0.65 + strikeWindow * 0.55);
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle) * 0.62 - 0.18;
      ctx.beginPath();
      ctx.moveTo(impactX, impactY);
      ctx.lineTo(impactX + dirX * spread, impactY + dirY * spread);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawAttackTower(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    cam: { x: number; y: number },
    zoom: number,
    nowMs: number,
  ): void {
    const scale = attackTowerScale(zoom);
    const sprite = img(ATTACK_TOWER_SPRITE);
    const { sx, sy } = GameRenderer.wts(wx, wy, cam, zoom);
    const baseX = sx + ATTACK_TOWER_RENDER_TUNING.tileOffsetX * scale;
    const baseY = sy + ATTACK_TOWER_RENDER_TUNING.tileOffsetY * scale;
    const spriteH = ATTACK_TOWER_RENDER_TUNING.drawHeight * scale;
    const spriteW =
      spriteH *
      (ATTACK_TOWER_SPRITE_TRIM.sw / ATTACK_TOWER_SPRITE_TRIM.sh) *
      ATTACK_TOWER_RENDER_TUNING.drawWidthScale;
    const anchorX = (ATTACK_TOWER_RENDER_TUNING.anchorX / ATTACK_TOWER_SPRITE_TRIM.sw) * spriteW;
    const anchorY = (ATTACK_TOWER_RENDER_TUNING.anchorY / ATTACK_TOWER_SPRITE_TRIM.sh) * spriteH;
    const drawX = baseX - anchorX;
    const drawY = baseY - anchorY;

    this.drawAttackTowerGroundContact(ctx, baseX, baseY, scale);

    if (ready(sprite)) {
      ctx.drawImage(
        sprite,
        ATTACK_TOWER_SPRITE_TRIM.sx,
        ATTACK_TOWER_SPRITE_TRIM.sy,
        ATTACK_TOWER_SPRITE_TRIM.sw,
        ATTACK_TOWER_SPRITE_TRIM.sh,
        drawX,
        drawY,
        spriteW,
        spriteH,
      );
    } else {
      ctx.save();
      ctx.fillStyle = 'rgba(122, 148, 188, 0.55)';
      ctx.fillRect(drawX, drawY, spriteW, spriteH);
      ctx.restore();
    }

    this.drawAttackTowerBaseOcclusion(ctx, baseX, baseY, spriteW, spriteH, scale);

    this.drawAttackTowerOrb(
      ctx,
      baseX,
      baseY + ATTACK_TOWER_RENDER_TUNING.orbAnchorOffsetY * scale,
      zoom,
      nowMs,
    );
  }

  private drawAttackTowerGroundContact(
    ctx: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    scale: number,
  ): void {
    const shadowY = baseY - 0.8 * scale;
    const baseRx = ATTACK_TOWER_RENDER_TUNING.shadowRadiusX * scale;
    const baseRy = ATTACK_TOWER_RENDER_TUNING.shadowRadiusY * scale;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';

    const stain = ctx.createRadialGradient(
      baseX,
      shadowY,
      baseRx * 0.15,
      baseX,
      shadowY,
      baseRx * 1.35,
    );
    stain.addColorStop(0, 'rgba(10, 14, 20, 0.24)');
    stain.addColorStop(0.65, 'rgba(10, 14, 20, 0.14)');
    stain.addColorStop(1, 'rgba(10, 14, 20, 0)');
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.ellipse(baseX, shadowY, baseRx * 0.98, baseRy * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(6, 12, 22, ${ATTACK_TOWER_RENDER_TUNING.shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(baseX, shadowY - 0.3 * scale, baseRx * 0.82, baseRy * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(8, 12, 18, 0.2)';
    ctx.beginPath();
    ctx.ellipse(baseX, shadowY - 0.55 * scale, baseRx * 0.58, baseRy * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawAttackTowerBaseOcclusion(
    ctx: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    spriteW: number,
    spriteH: number,
    scale: number,
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.beginPath();
    ctx.rect(baseX - spriteW * 0.22, baseY - spriteH * 0.11, spriteW * 0.44, spriteH * 0.13);
    ctx.clip();

    const shade = ctx.createRadialGradient(
      baseX,
      baseY - 1.3 * scale,
      spriteW * 0.03,
      baseX,
      baseY - 1.2 * scale,
      spriteW * 0.15,
    );
    shade.addColorStop(0, 'rgba(6, 10, 16, 0.24)');
    shade.addColorStop(0.58, 'rgba(6, 10, 16, 0.14)');
    shade.addColorStop(1, 'rgba(6, 10, 16, 0)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(baseX, baseY - 1.4 * scale, spriteW * 0.13, spriteH * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawAttackTowerOrb(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    zoom: number,
    nowMs: number,
  ): void {
    const orb = getAttackTowerOrbDescriptor(nowMs);
    const x = sx + orb.offsetX * zoom;
    const y = sy + orb.offsetY * zoom;
    const radius = Math.max(4.5, 6.2 * zoom * orb.scale);

    ctx.save();
    ctx.shadowColor = 'rgba(120, 226, 255, 0.8)';
    ctx.shadowBlur = 14;
    const grad = ctx.createRadialGradient(
      x - radius * 0.28,
      y - radius * 0.28,
      radius * 0.12,
      x,
      y,
      radius * 1.3,
    );
    grad.addColorStop(0, 'rgba(246, 254, 255, 0.98)');
    grad.addColorStop(0.42, 'rgba(144, 234, 255, 0.95)');
    grad.addColorStop(1, 'rgba(44, 126, 220, 0.22)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(214, 250, 255, 0.75)';
    ctx.lineWidth = Math.max(1, radius * 0.2);
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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
    for (const unit of state.units) {
      this.drawUnitHealthBar(ctx, unit, state, cam, zoom, elapsed);
    }
  }

  private drawCorpses(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
  ): void {
    for (const corpse of state.corpses ?? []) {
      this.drawCorpse(ctx, corpse, cam, zoom);
    }
  }

  private drawCorpse(
    ctx: CanvasRenderingContext2D,
    corpse: Corpse,
    cam: { x: number; y: number },
    zoom: number,
  ): void {
    const KILL_FRAMES = 5;
    const KILL_FPS = 8;
    const sheet = img(LASERS_KILL);
    if (!ready(sheet)) return;
    const sinceDeathSec = (Date.now() - corpse.diedAtMs) / 1000;
    const frameIdx = Math.min(Math.floor(sinceDeathSec * KILL_FPS), KILL_FRAMES - 1);
    const FRAME_SIZE = 56;
    const scale = unitScale(zoom);
    const w = 30 * scale;
    const h = 38 * scale;
    const { sx, sy } = GameRenderer.wts(corpse.wx, corpse.wy, cam, zoom);
    ctx.drawImage(sheet, frameIdx * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE, sx - w / 2, sy - h, w, h);
  }

  private drawUnit(
    ctx: CanvasRenderingContext2D,
    unit: Unit,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    const spriteKey = unit.def.sprite;   // 'boits' | 'viking' | 'collector' | 'lasers'
    const scale = unitScale(zoom);

    // --- boits (fast enemy units) ---
    if (spriteKey === 'boits') {
      const inAttackState = unit.state === 'fighting' || unit.state === 'attacking-base';
      const attackProgress = this.getAttackAnimationProgress(unit);
      const el = inAttackState
        ? (attackProgress === null ? frame(BOITS_ATTACK, 12, elapsed) : frameAtProgress(BOITS_ATTACK, attackProgress))
        : frame(BOITS_WALK, 8, elapsed);
      // ~15% of light boits are slightly bigger (seeded by unit id, stable per unit)
      const isBigVariant = unit.def.role === 'light' && (unit.id * 2654435761) % 100 < 15;
      const variantScale = isBigVariant ? 1.18 : 1;
      const roleScale = unit.def.role === 'boss' ? 1.85 : unit.def.role === 'heavy' ? 1.2 : variantScale;
      this.drawSprite(ctx, el, unit.wx, unit.wy, 30 * scale * roleScale, 38 * scale * roleScale, cam, zoom);
      return;
    }

    // --- viking (ally defenders) ---
      if (spriteKey === 'viking') {
        const look = this.getUnitLookVector(unit, state);
        const dir = look ? directionKey(look.dx, look.dy) : 'south';
        const inAttackState = this.isVikingAttackVisualActive(unit, state);
        this.drawCombatAura(ctx, unit, cam, zoom, elapsed);

        if (inAttackState) {
        const attackProgress = this.getAttackAnimationProgress(unit);
        const attackFrame = attackProgress === null
          ? frame(VIKING_ATTACK.south, 10, elapsed)
          : frameAtProgress(VIKING_ATTACK.south, attackProgress);
        const facingWest = dir === 'west' || dir === 'north-west' || dir === 'south-west';
        const allyAttackScale = unit.def.role === 'heavy' ? 1.66 : 1.4;
        this.drawSprite(ctx, attackFrame, unit.wx, unit.wy, 42 * scale * allyAttackScale, 54 * scale * allyAttackScale, cam, zoom, {
          flipX: facingWest,
        });
        return;
      }

      const walkDir = this.resolveVikingWalkDirection(look);
      const walkFrame = frame(VIKING_WALK[walkDir], 10, elapsed);
      const allyScale = unit.def.role === 'heavy' ? 1.66 : 1.4;
      this.drawSprite(ctx, walkFrame, unit.wx, unit.wy, 40 * scale * allyScale, 52 * scale * allyScale, cam, zoom);
      return;
    }

    // --- collector (flying loot drone) ---
    if (spriteKey === 'collector') {
      const look = this.getUnitLookVector(unit, state);
      const facing = this.resolveCollectorDirection(look);
      const processingSalvage = (state.crystals ?? 0) > 0;
      const bobY = Math.sin(elapsed * 2.8 + unit.id * 0.45) * 0.7 * Math.max(0.85, zoom);
      this.drawCollectorShadow(ctx, unit.wx, unit.wy, cam, zoom, bobY, processingSalvage);
      this.drawCollectorShieldField(ctx, unit, cam, zoom, bobY, elapsed);
      if (processingSalvage) {
        const collectFrame = frame(COLLECTOR_COLLECT, 12, elapsed);
        this.drawSprite(ctx, collectFrame, unit.wx, unit.wy, 72 * scale, 72 * scale, cam, zoom, {
          bobY: -18 * scale + bobY,
        });
        return;
      }
      const cImg = img(COLLECTOR_DIRS[facing] ?? COLLECTOR_DIRS.east);
      this.drawSprite(ctx, cImg, unit.wx, unit.wy, 68 * scale, 68 * scale, cam, zoom, {
        bobY: -16 * scale + bobY,
      });
      return;
    }

    // --- cybernetic (drop-pod shock trooper) ---
      if (spriteKey === 'cybernetic') {
        const inAttackState = this.isCyberneticAttackVisualActive(unit, state);
        const attackProgress = this.getAttackAnimationProgress(unit);
        const frameDef = inAttackState
          ? (attackProgress === null ? stripFrame(CYBERNETIC_ATTACK, 12, elapsed) : stripFrameAtProgress(CYBERNETIC_ATTACK, attackProgress))
          : stripFrame(CYBERNETIC_RUN, 10, elapsed);
        const bobY = (unit.dodgeCooldown ?? 0) > 1.55 ? -5 * scale : 0;
        const { sx, sy } = GameRenderer.wts(unit.wx, unit.wy, cam, zoom);
        this.drawCombatAura(ctx, unit, cam, zoom, elapsed);
        if ((unit.spawnShield ?? 0) > 0) {
        const shieldPulse = 0.7 + Math.sin(elapsed * 14 + unit.id * 0.3) * 0.16;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(104, 232, 255, ${0.16 * shieldPulse})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy - 28 * scale, 24 * scale, 34 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(188, 247, 255, ${0.6 * shieldPulse})`;
        ctx.lineWidth = Math.max(1.2, 1.8 * scale);
        ctx.beginPath();
        ctx.ellipse(sx, sy - 28 * scale, 21 * scale, 30 * scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (!ready(frameDef.el)) {
        ctx.fillStyle = 'rgba(149, 208, 255, 0.45)';
        ctx.fillRect(sx - 21 * scale, sy - 54 * scale + bobY, 42 * scale, 54 * scale);
        return;
      }
      ctx.drawImage(
        frameDef.el,
        frameDef.sx,
        frameDef.sy,
        frameDef.sw,
        frameDef.sh,
        sx - (42 * scale) / 2,
        sy - 54 * scale + bobY,
        42 * scale,
        54 * scale,
      );
      return;
    }

    // --- lasers (ranged enemy) — sprite sheet, 56px frames ---
    if (spriteKey === 'lasers') {
      const isFiring = (unit.firingFlash ?? 0) > 0;
      const w = 30 * scale;
      const h = 38 * scale;
      const { sx, sy } = GameRenderer.wts(unit.wx, unit.wy, cam, zoom);
      const frameDef = isFiring
        ? stripFrameAtProgress(
            LASERS_ATTACK,
            1 - Math.max(0, Math.min(1, (unit.firingFlash ?? 0) / RANGED_FIRING_FLASH_DURATION)),
          )
        : stripFrame(LASERS_WALK, 8, elapsed + unit.id * 0.07);
      if (ready(frameDef.el)) {
        ctx.drawImage(
          frameDef.el,
          frameDef.sx,
          frameDef.sy,
          frameDef.sw,
          frameDef.sh,
          sx - w / 2,
          sy - h,
          w,
          h,
        );
      } else {
        ctx.fillStyle = '#cc44ff';
        ctx.fillRect(sx - w / 2, sy - h, w, h);
      }
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
      if (proj.kind === 'beam') {
        this.drawBeam(ctx, proj, state, cam, zoom, elapsed);
        continue;
      }

      const target = state.units.find((u) => u.id === proj.targetUnitId && u.hp > 0);
      const aimWx = proj.aimWx ?? target?.wx;
      const aimWy = proj.aimWy ?? target?.wy;
      if (aimWx === undefined || aimWy === undefined) continue;

      const { sx, sy } = this.getProjectileSourceScreenPoint(proj, cam, zoom);
      const { sx: aimSx, sy: aimSy } = this.getProjectileTargetScreenPoint(target, aimWx, aimWy, cam, zoom);
      const angle = Math.atan2(aimSy - sy, aimSx - sx); // screen-space angle
      const projectileSize = proj.size ?? 32;

      if (proj.source === 'citadel') {
        this.drawCitadelOrbProjectile(ctx, sx, sy, projectileSize, zoom, elapsed, angle, state, proj, cam);
        continue;
      }

      if (proj.source === 'ranged-unit') {
        const beamFd = stripFrame(LASERS_BEAM, 18, elapsed + proj.id * 0.031);
        if (ready(beamFd.el)) {
          const screenDist = Math.hypot(aimSx - sx, aimSy - sy);
          const renderLength = Math.max(18, Math.min(34, screenDist * 0.16));
          const renderHeight = Math.max(2.4, 3.2 * Math.max(0.9, zoom));
          const pulse = 0.84 + Math.sin(elapsed * 28 + proj.id * 0.17) * 0.08;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(angle);
          ctx.globalCompositeOperation = 'screen';
          ctx.shadowColor = 'rgba(255, 86, 86, 0.9)';
          ctx.shadowBlur = 7 * Math.max(0.9, zoom);
          ctx.strokeStyle = `rgba(255, 92, 92, ${0.34 * pulse})`;
          ctx.lineWidth = Math.max(1.15, 1.8 * zoom);
          ctx.beginPath();
          ctx.moveTo(-renderLength * 0.5, 0);
          ctx.lineTo(renderLength * 0.26, 0);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `rgba(255, 236, 236, ${0.92 * pulse})`;
          ctx.lineWidth = Math.max(0.7, 0.95 * zoom);
          ctx.beginPath();
          ctx.moveTo(-renderLength * 0.36, 0);
          ctx.lineTo(renderLength * 0.2, 0);
          ctx.stroke();
          ctx.drawImage(
            beamFd.el,
            beamFd.sx,
            beamFd.sy,
            beamFd.sw,
            beamFd.sh,
            -renderLength * 0.56,
            -renderHeight / 2,
            renderLength,
            renderHeight,
          );
          ctx.restore();
        }
        continue;
      }

      const ballSprite = this.resolveProjectileSprite(angle);

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

  private drawCitadelOrbProjectile(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    projectileSize: number,
    zoom: number,
    elapsed: number,
    angle: number,
    state: GameState,
    proj: Projectile,
    cam: { x: number; y: number },
  ): void {
    const radius = Math.max(5, projectileSize * 0.22 * Math.max(0.9, zoom));
    const pulse = 0.84 + Math.sin(elapsed * 18) * 0.08;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = 'screen';

    ctx.strokeStyle = `rgba(98, 224, 255, ${0.2 * pulse})`;
    ctx.lineWidth = Math.max(2, radius * 0.55);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.65, radius * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowColor = 'rgba(96, 228, 255, 0.9)';
    ctx.shadowBlur = 18;
    const grad = ctx.createRadialGradient(
      -radius * 0.28,
      -radius * 0.32,
      radius * 0.12,
      0,
      0,
      radius * 1.6,
    );
    grad.addColorStop(0, `rgba(244, 254, 255, ${0.98 * pulse})`);
    grad.addColorStop(0.3, `rgba(156, 240, 255, ${0.92 * pulse})`);
    grad.addColorStop(0.68, `rgba(76, 184, 255, ${0.72 * pulse})`);
    grad.addColorStop(1, `rgba(14, 86, 192, ${0.2 * pulse})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(228, 252, 255, ${0.48 * pulse})`;
    ctx.beginPath();
    ctx.arc(radius * 0.14, -radius * 0.12, radius * 0.24, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(212, 250, 255, ${0.86 * pulse})`;
    ctx.lineWidth = Math.max(1, radius * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.76, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(136, 235, 255, ${0.46 * pulse})`;
    ctx.lineWidth = Math.max(1, radius * 0.12);
    for (let i = 0; i < 3; i += 1) {
      const ringScale = 1 + i * 0.22;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.54 * ringScale, radius * 0.22 * ringScale, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

  }

  private drawBeam(
    ctx: CanvasRenderingContext2D,
    proj: Projectile,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    const target = state.units.find((unit) => unit.id === proj.targetUnitId && unit.hp > 0);
    const endWx = proj.aimWx ?? target?.wx;
    const endWy = proj.aimWy ?? target?.wy;
    if (endWx === undefined || endWy === undefined) return;

    const start = this.getProjectileSourceScreenPoint(proj, cam, zoom);
    const end = this.getProjectileTargetScreenPoint(target, endWx, endWy, cam, zoom);
    const pulse = 0.75 + Math.sin(elapsed * 12) * 0.08;
    const origin = this.getBeamOrigin(start.sx, start.sy, proj, zoom);
    const dx = end.sx - origin.x;
    const dy = end.sy - origin.y;
    const len = Math.hypot(dx, dy) || 1;
    const normX = dx / len;
    const normY = dy / len;
    const glitch = Math.sin(elapsed * 28 + proj.id * 0.7) * 1.5 * zoom;
    const endX = end.sx + -normY * glitch;
    const endY = end.sy + normX * glitch;

    ctx.save();
    ctx.lineCap = 'round';

    ctx.strokeStyle = `rgba(88, 220, 255, ${0.24 * pulse})`;
    ctx.lineWidth = Math.max(8, 14 * zoom * pulse);
    ctx.shadowColor = 'rgba(110, 235, 255, 0.55)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(195, 251, 255, ${0.8 * pulse})`;
    ctx.lineWidth = Math.max(2, 4.25 * zoom);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    this.drawBeamTerminalFx(ctx, endX, endY, normX, normY, zoom, elapsed, pulse);
    ctx.restore();
  }

  private getProjectileSourceScreenPoint(
    proj: Projectile,
    cam: { x: number; y: number },
    zoom: number,
  ): { sx: number; sy: number } {
    const p = GameRenderer.wts(proj.wx, proj.wy, cam, zoom);
    return {
      sx: p.sx,
      sy: p.sy - this.getProjectileSourceOffsetY(proj, zoom),
    };
  }

  private getProjectileTargetScreenPoint(
    target: Unit | undefined,
    wx: number,
    wy: number,
    cam: { x: number; y: number },
    zoom: number,
  ): { sx: number; sy: number } {
    const p = GameRenderer.wts(wx, wy, cam, zoom);
    if (!target) return p;
    return {
      sx: p.sx,
      sy: p.sy - this.getUnitAimOffsetY(target, zoom),
    };
  }

  private getProjectileSourceOffsetY(proj: Projectile, zoom: number): number {
    switch (proj.source) {
      case 'tower':
        return 72 * buildingScale(zoom);
      case 'citadel':
        return 54 * Math.max(0.95, zoom);
      case 'ranged-unit':
        return 24 * unitScale(zoom);
      default:
        return 0;
    }
  }

  private getUnitAimOffsetY(unit: Unit, zoom: number): number {
    const scale = unitScale(zoom);
    switch (unit.def.sprite) {
      case 'viking':
        return (unit.def.role === 'heavy' ? 36 : 30) * scale;
      case 'cybernetic':
        return 32 * scale;
      case 'collector':
        return 26 * scale;
      case 'lasers':
        return 24 * scale;
      case 'boits':
        if (unit.def.role === 'boss') return 46 * scale;
        if (unit.def.role === 'heavy') return 30 * scale;
        return 22 * scale;
      default:
        return 22 * scale;
    }
  }

  private getBeamOrigin(
    sx: number,
    sy: number,
    proj: Projectile,
    zoom: number,
  ): { x: number; y: number } {
    if (proj.source === 'tower') {
      const scale = buildingScale(zoom);
      return {
        x: sx,
        y: sy - 74 * scale,
      };
    }

    return {
      x: sx,
      y: sy - 62 * Math.max(1, zoom),
    };
  }

  private drawBeamTerminalFx(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    normX: number,
    normY: number,
    zoom: number,
    elapsed: number,
    pulse: number,
  ): void {
    const perpX = -normY;
    const perpY = normX;
    const coreRadius = Math.max(4, 6 * zoom);

    ctx.fillStyle = `rgba(210, 252, 255, ${0.8 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(130, 240, 255, ${0.7 * pulse})`;
    ctx.lineWidth = Math.max(1.5, 2.5 * zoom);
    for (let i = 0; i < 3; i += 1) {
      const phase = elapsed * 30 + i * 2.1;
      const forward = 5 * zoom + Math.sin(phase) * 3 * zoom;
      const spread = (i - 1) * 5 * zoom;
      ctx.beginPath();
      ctx.moveTo(x + perpX * spread * 0.35, y + perpY * spread * 0.35);
      ctx.lineTo(
        x + normX * forward + perpX * spread,
        y + normY * forward + perpY * spread,
      );
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(255, 140, 80, ${0.55 * pulse})`;
    ctx.lineWidth = Math.max(1, 1.5 * zoom);
    for (let i = 0; i < 5; i += 1) {
      const angle = elapsed * 18 + i * ((Math.PI * 2) / 5);
      const sparkLen = (6 + (i % 3) * 3) * zoom;
      const dirX = Math.cos(angle) * 0.65 + normX * 0.35;
      const dirY = Math.sin(angle) * 0.65 + normY * 0.35;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dirX * sparkLen, y + dirY * sparkLen);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(170, 255, 255, ${0.4 * pulse})`;
    ctx.lineWidth = Math.max(1, 1.25 * zoom);
    for (let i = 0; i < 3; i += 1) {
      const offset = (Math.sin(elapsed * 24 + i * 1.7) * 4 + (i - 1) * 3) * zoom;
      ctx.beginPath();
      ctx.moveTo(x + perpX * offset, y + perpY * offset);
      ctx.lineTo(x + perpX * offset + normX * 10 * zoom, y + perpY * offset + normY * 10 * zoom);
      ctx.stroke();
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
    options?: { flipX?: boolean; bobY?: number },
  ): void {
    const { sx, sy } = GameRenderer.wts(wx, wy, cam, zoom);
    const bobY = options?.bobY ?? 0;
    if (ready(el)) {
      if (options?.flipX) {
        ctx.save();
        ctx.translate(sx, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(el, -w / 2, sy - h + bobY, w, h);
        ctx.restore();
        return;
      }

      ctx.drawImage(el, sx - w / 2, sy - h + bobY, w, h);
    } else {
      // Placeholder while loading
      ctx.fillStyle = 'rgba(100,140,200,0.4)';
      ctx.fillRect(sx - w / 2, sy - h + bobY, w, h);
    }
  }

  private drawUnitHealthBar(
    ctx: CanvasRenderingContext2D,
    unit: Unit,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    if (unit.hp <= 0 || unit.def.hp <= 0) return;

    const { sx, sy } = GameRenderer.wts(unit.wx, unit.wy, cam, zoom);
    const scale = Math.max(0.9, zoom);
    const width = this.getUnitHealthBarWidth(unit, scale);
    const height = Math.max(2, 2.8 * scale);
    const ratio = Math.max(0, Math.min(1, unit.hp / unit.def.hp));
    const y = this.getUnitHealthBarY(unit, state, sy, zoom, elapsed);
    const x = sx - width / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(7, 11, 18, 0.88)';
    ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    ctx.fillStyle = 'rgba(26, 36, 48, 0.92)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = unit.faction === 'ally' ? '#72f0b1' : '#ff5b5b';
    ctx.fillRect(x, y, width * ratio, height);
    ctx.strokeStyle = 'rgba(220, 242, 255, 0.36)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
    ctx.restore();
  }

  private drawSupportStrikeEffects(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    for (const mark of state.impactMarks ?? []) {
      if (mark.source !== 'support') continue;
      if (mark.radius >= 100) {
        this.drawOrbitalSupportStrike(ctx, mark, cam, zoom, elapsed);
        continue;
      }
      if (mark.radius >= 70) {
        this.drawMissileSupportBurst(ctx, mark, cam, zoom, elapsed);
        continue;
      }
      this.drawLanceSupportBurst(ctx, mark, cam, zoom, elapsed);
    }
  }

  private drawOrbitalSupportStrike(
    ctx: CanvasRenderingContext2D,
    mark: ImpactMark,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    const fade = Math.max(0, Math.min(1, mark.ttl / Math.max(mark.maxTtl, 0.001)));
    const age  = 1 - fade;

    // ── TIMING (age fractions of 2.4 s clip) ─────────────────────────
    const telegraph  = Math.max(0, 1 - age / 0.20);
    const laserAge   = Math.max(0, age - 0.08);
    const laserW     = Math.max(0, 1 - laserAge / 0.38);
    const impRaw     = (age - 0.38) / 0.16;
    const impFlash   = impRaw >= 0 && impRaw <= 1 ? Math.sin(impRaw * Math.PI) : 0;
    const shockAge   = Math.max(0, age - 0.40);
    const shockFade  = Math.max(0, 1 - shockAge / 0.20);
    const fireAge    = Math.max(0, age - 0.42);
    const fireFade   = Math.max(0, 1 - fireAge / 0.58);
    const smokeAge   = Math.max(0, age - 0.46);

    if (telegraph <= 0 && laserW <= 0 && impFlash <= 0 && fireFade <= 0 && shockFade <= 0) return;

    const { sx, sy } = GameRenderer.wts(mark.wx, mark.wy, cam, zoom);
    const R          = mark.radius * Math.max(0.86, zoom);
    const haloSpin   = elapsed * 2.2 + mark.id * 0.13;

    ctx.save();
    ctx.lineCap = 'round';

    // ══════════════════════════════════════════
    // GROUND SCORCH — drawn first, darkens terrain
    // ══════════════════════════════════════════
    if (fireAge > 0) {
      ctx.globalCompositeOperation = 'source-over';
      const scExpand = Math.min(1, fireAge * 4.0);
      const scAlpha  = Math.min(0.78, fireAge * 2.2) * (0.25 + fireFade * 0.55);
      const scRx = R * 0.68 * scExpand;
      const scRy = scRx * 0.36;
      const scG  = ctx.createRadialGradient(sx, sy, 0, sx, sy, scRx);
      scG.addColorStop(0,   `rgba(2,1,0,${scAlpha})`);
      scG.addColorStop(0.5, `rgba(8,3,0,${scAlpha * 0.6})`);
      scG.addColorStop(1,   `rgba(0,0,0,0)`);
      ctx.fillStyle = scG;
      ctx.beginPath();
      ctx.ellipse(sx, sy + scRy * 0.1, scRx, scRy, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glowing magma rim on scorch
      ctx.strokeStyle = `rgba(255,${Math.round(90 + fireFade * 130)},4,${0.62 * fireFade})`;
      ctx.lineWidth   = Math.max(1.5, 2.8 * zoom);
      ctx.beginPath();
      ctx.ellipse(sx, sy + scRy * 0.1, scRx * 0.88, scRy * 0.88, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'screen';

    // ══════════════════════════════════════════
    // TARGETING TELEGRAPH
    // ══════════════════════════════════════════
    if (telegraph > 0 || laserW > 0) {
      const tA = telegraph * 0.18 + laserW * 0.44;
      const gG = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 1.8);
      gG.addColorStop(0,   `rgba(200,242,255,${tA})`);
      gG.addColorStop(0.3, `rgba(80,180,255,${tA * 0.5})`);
      gG.addColorStop(1,   `rgba(20,60,180,0)`);
      ctx.fillStyle = gG;
      ctx.beginPath();
      ctx.ellipse(sx, sy, R * 1.5, R * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (telegraph > 0) {
      const lockIn = 1 - telegraph;
      const bR  = R * (1.42 - lockIn * 0.54);
      const bRy = bR * 0.42;
      const gap = Math.PI * 0.36;
      ctx.strokeStyle = `rgba(255,55,35,${0.72 * telegraph})`;
      ctx.lineWidth   = Math.max(1.4, 2.4 * zoom);
      for (let q = 0; q < 4; q++) {
        const base = (q * Math.PI) / 2 + haloSpin * 0.22;
        ctx.beginPath();
        ctx.ellipse(sx, sy, bR, bRy, 0, base + gap, base + Math.PI / 2 - gap);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(255,130,60,${0.52 * telegraph})`;
      ctx.lineWidth   = Math.max(0.8, 1.3 * zoom);
      ctx.beginPath();
      ctx.ellipse(sx, sy, bR * 0.5, bRy * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,70,35,${0.65 * telegraph})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy, R * 0.06, R * 0.022, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(0.7, 1.0 * zoom);
      for (let i = 0; i < 6; i++) {
        const a = haloSpin + i * (Math.PI / 3);
        ctx.strokeStyle = `rgba(160,224,255,${0.17 * telegraph})`;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * R * 0.58, sy + Math.sin(a) * R * 0.22);
        ctx.lineTo(sx + Math.cos(a) * R * 0.98, sy + Math.sin(a) * R * 0.36);
        ctx.stroke();
      }
    }

    // ══════════════════════════════════════════
    // LASER BEAM
    // ══════════════════════════════════════════
    if (laserW > 0) {
      const topY        = sy - 480 * Math.max(0.8, zoom);
      const beamBot     = sy - R * 0.04;
      const beamCurBot  = topY + (beamBot - topY) * (1 - laserW * 0.9);
      if (beamCurBot - topY > 2) {
        const atmG = ctx.createLinearGradient(sx, topY, sx, beamCurBot);
        atmG.addColorStop(0,    `rgba(60,140,255,0)`);
        atmG.addColorStop(0.35, `rgba(80,200,255,${0.05 * laserW})`);
        atmG.addColorStop(0.75, `rgba(140,230,255,${0.08 * laserW})`);
        atmG.addColorStop(1,    `rgba(200,248,255,0)`);
        ctx.fillStyle = atmG;
        ctx.beginPath();
        ctx.moveTo(sx - 3 * zoom,    topY);
        ctx.lineTo(sx - R * 0.2,     beamCurBot);
        ctx.lineTo(sx + R * 0.2,     beamCurBot);
        ctx.lineTo(sx + 3 * zoom,    topY);
        ctx.closePath();
        ctx.fill();
        ctx.shadowColor = 'rgba(160,225,255,0.7)';
        ctx.shadowBlur  = 56 * Math.max(0.85, zoom);
        ctx.strokeStyle = `rgba(90,195,255,${0.13 * laserW})`;
        ctx.lineWidth   = Math.max(22, 46 * zoom);
        ctx.beginPath(); ctx.moveTo(sx, topY); ctx.lineTo(sx, beamCurBot); ctx.stroke();
        ctx.shadowBlur  = 18 * Math.max(0.8, zoom);
        ctx.strokeStyle = `rgba(200,242,255,${0.52 * laserW})`;
        ctx.lineWidth   = Math.max(6, 13 * zoom);
        ctx.beginPath(); ctx.moveTo(sx, topY); ctx.lineTo(sx, beamCurBot); ctx.stroke();
        ctx.shadowColor = 'rgba(255,255,255,1.0)';
        ctx.shadowBlur  = 5 * Math.max(0.8, zoom);
        ctx.strokeStyle = `rgba(255,255,255,${laserW})`;
        ctx.lineWidth   = Math.max(1.5, 3 * zoom);
        ctx.beginPath(); ctx.moveTo(sx, topY); ctx.lineTo(sx, beamCurBot); ctx.stroke();
        ctx.shadowBlur  = 0;
        const tipP = 0.78 + Math.sin(elapsed * 28 + mark.id * 0.4) * 0.22;
        ctx.strokeStyle = `rgba(210,248,255,${0.72 * laserW})`;
        ctx.lineWidth   = Math.max(1, 1.8 * zoom);
        ctx.beginPath();
        ctx.ellipse(sx, beamCurBot, R * 0.24 * tipP, R * 0.09 * tipP, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ══════════════════════════════════════════
    // IMPACT FLASH
    // ══════════════════════════════════════════
    if (impFlash > 0) {
      const fG = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 2.6);
      fG.addColorStop(0,    `rgba(255,255,255,${impFlash})`);
      fG.addColorStop(0.09, `rgba(255,255,210,${0.94 * impFlash})`);
      fG.addColorStop(0.24, `rgba(255,200,70,${0.68 * impFlash})`);
      fG.addColorStop(0.52, `rgba(255,70,10,${0.3 * impFlash})`);
      fG.addColorStop(1,    `rgba(160,14,0,0)`);
      ctx.fillStyle = fG;
      ctx.beginPath();
      ctx.arc(sx, sy, R * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // ══════════════════════════════════════════
    // GROUND SHOCKWAVE — fast ring rolling outward
    // ══════════════════════════════════════════
    if (shockFade > 0) {
      const swR  = R * (0.2 + shockAge * 6.5);
      const swRy = swR * 0.33;
      // Dust cloud behind the leading edge
      ctx.strokeStyle = `rgba(190,110,35,${0.32 * shockFade})`;
      ctx.lineWidth   = Math.max(8, 20 * zoom * shockFade);
      ctx.beginPath();
      ctx.ellipse(sx, sy + swRy * 0.12, swR * 0.90, swRy * 0.90, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Orange ring
      ctx.strokeStyle = `rgba(255,190,60,${0.68 * shockFade})`;
      ctx.lineWidth   = Math.max(2.5, 5.5 * zoom * shockFade);
      ctx.beginPath();
      ctx.ellipse(sx, sy + swRy * 0.12, swR, swRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Bright white leading edge
      ctx.strokeStyle = `rgba(255,255,220,${shockFade * 0.88})`;
      ctx.lineWidth   = Math.max(1, 2.2 * zoom * shockFade);
      ctx.beginPath();
      ctx.ellipse(sx, sy + swRy * 0.12, swR * 1.035, swRy * 1.035, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ══════════════════════════════════════════
    // VOLUMETRIC FIRE
    // ══════════════════════════════════════════
    if (fireFade > 0) {
      const expand = 1 - fireFade; // 0 = fresh, 1 = fully expanded/fading

      // ── SPHERE-SHADED FIRE BLOBS (back→front for depth) ──────────────
      // Each blob: highlight offset to upper-left, dark terminator ring gives 3-D volume.
      // Layer 0 = back (smaller, lower, darker) → Layer 2 = front (largest, highest, brightest)
      type LayerDef = { ox: number; oy: number; rx: number; ry: number; g: number; alpha: number };
      const blobLayers: LayerDef[] = [
        { // back
          ox: R * 0.14, oy: R * (0.26 + expand * 0.12),
          rx: R * (0.58 + expand * 0.20), ry: R * (0.30 + expand * 0.10),
          g: 60, alpha: 0.60 * fireFade,
        },
        { // mid
          ox: -R * 0.06, oy: R * (0.40 + expand * 0.18),
          rx: R * (0.76 + expand * 0.28), ry: R * (0.42 + expand * 0.14),
          g: 110, alpha: 0.76 * fireFade,
        },
        { // front
          ox: 0, oy: R * (0.54 + expand * 0.26),
          rx: R * (0.92 + expand * 0.36), ry: R * (0.54 + expand * 0.20),
          g: 200, alpha: 0.90 * fireFade,
        },
      ];
      for (const L of blobLayers) {
        const cx  = sx + L.ox;
        const cy  = sy - L.oy;
        // Highlight is offset to upper-left of blob center
        const hlx = cx - L.rx * 0.30;
        const hly = cy - L.ry * 0.26;
        const bG  = ctx.createRadialGradient(hlx, hly, 0, cx, cy, L.rx);
        bG.addColorStop(0,    `rgba(255,255,220,${L.alpha})`);
        bG.addColorStop(0.14, `rgba(255,${L.g + 140},30,${L.alpha * 0.95})`);
        bG.addColorStop(0.38, `rgba(255,${L.g + 20},6,${L.alpha * 0.72})`);
        bG.addColorStop(0.64, `rgba(${Math.round(180 - L.g * 0.3)},${Math.round(L.g * 0.18)},0,${L.alpha * 0.40})`);
        bG.addColorStop(0.83, `rgba(10,3,0,${L.alpha * 0.22})`); // terminator — gives sphere feel
        bG.addColorStop(1,    `rgba(0,0,0,0)`);
        ctx.fillStyle = bG;
        ctx.beginPath();
        ctx.ellipse(cx, cy, L.rx, L.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── FIRE TONGUES — sinusoidal fingers of hot gas ──────────────────
      const tongueCount = 8;
      for (let t = 0; t < tongueCount; t++) {
        const s1    = ((t * 61 + mark.id * 23) % 100) / 100;
        const s2    = ((t * 79 + mark.id * 37) % 100) / 100;
        const tAge  = Math.max(0, fireAge - s1 * 0.07);
        const tFade = Math.max(0, 1 - tAge / (0.30 + s2 * 0.22));
        if (tFade <= 0) continue;
        const baseA  = (t / tongueCount) * Math.PI * 2 + mark.id * 0.38;
        const spreadR = R * (0.22 + s2 * 0.44);
        const tx0    = sx + Math.cos(baseA) * spreadR * 0.5;
        const ty0    = sy - R * 0.04 - Math.sin(baseA) * spreadR * 0.15;
        const lift   = R * (0.65 + s1 * 1.05 + tAge * 1.6);
        // Lateral sway driven by time — gives turbulent look
        const sway   = Math.sin(elapsed * (7 + s1 * 5) + t * 1.8) * R * 0.22;
        const cp1x   = tx0 + sway * 0.4;
        const cp1y   = ty0 - lift * 0.38;
        const cp2x   = tx0 + sway;
        const cp2y   = ty0 - lift * 0.72;
        const tipx   = tx0 + sway * 0.55;
        const tipy   = ty0 - lift;
        const tW     = Math.max(1, R * (0.10 + s2 * 0.13) * (1 - tAge * 2.0) * tFade);
        if (tW < 0.5) continue;
        const lum    = Math.round(120 + s1 * 90);
        // Gradient from hot base to cool tip
        const tG     = ctx.createLinearGradient(tx0, ty0, tipx, tipy);
        tG.addColorStop(0,    `rgba(255,${lum + 30},18,${0.88 * tFade})`);
        tG.addColorStop(0.35, `rgba(255,${lum},8,${0.68 * tFade})`);
        tG.addColorStop(0.72, `rgba(200,28,0,${0.32 * tFade})`);
        tG.addColorStop(1,    `rgba(60,6,0,0)`);
        ctx.strokeStyle = tG;
        ctx.lineWidth   = tW;
        ctx.beginPath();
        ctx.moveTo(tx0, ty0);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tipx, tipy);
        ctx.stroke();
      }

      // ── HOT GAS STEM — superheated column at ground contact ──────────
      const stemFade = Math.max(0, 1 - fireAge / 0.22);
      if (stemFade > 0) {
        const stH = R * (0.60 + expand * 0.18);
        const stW = R * 0.30 * stemFade;
        const stG = ctx.createLinearGradient(sx, sy, sx, sy - stH);
        stG.addColorStop(0,   `rgba(255,255,210,${0.92 * stemFade})`);
        stG.addColorStop(0.3, `rgba(255,180,18,${0.70 * stemFade})`);
        stG.addColorStop(0.7, `rgba(255,70,6,${0.34 * stemFade})`);
        stG.addColorStop(1,   `rgba(180,14,0,0)`);
        ctx.fillStyle = stG;
        ctx.beginPath();
        ctx.ellipse(sx, sy - stH * 0.46, stW, stH * 0.58, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── EMBER DEBRIS — glowing chunks on ballistic arcs ──────────────
      for (let e = 0; e < 30; e++) {
        const s1   = ((e * 53 + mark.id * 13) % 100) / 100;
        const s2   = ((e * 71 + mark.id * 41) % 100) / 100;
        const s3   = ((e * 97 + mark.id * 7)  % 100) / 100;
        const eAge = Math.max(0, fireAge - s3 * 0.06);
        const eFade = Math.max(0, 1 - eAge / (0.32 + s1 * 0.44));
        if (eFade <= 0) continue;
        const angle = e * (Math.PI * 2 / 30) + mark.id * 0.17 + s2 * 0.9;
        const hSpd  = R * (0.7 + s1 * 1.7);
        const vSpd  = R * (1.2 + s1 * 2.0);        // initial upward speed
        const grav  = R * 4.2 * zoom;
        const ex    = sx + Math.cos(angle) * hSpd * eAge;
        const ey    = sy - (vSpd * eAge - 0.5 * grav * eAge * eAge);
        const eRad  = Math.max(0.8, (1.4 + s2 * 2.2) * zoom * eFade);
        const lum   = Math.round(110 + s1 * 140);
        // Glow
        ctx.shadowColor = `rgba(255,${lum},30,${eFade * 0.7})`;
        ctx.shadowBlur  = eRad * 3.5;
        ctx.fillStyle   = `rgba(255,${lum},20,${eFade})`;
        ctx.beginPath();
        ctx.arc(ex, ey, eRad, 0, Math.PI * 2);
        ctx.fill();
        // Velocity tail (direction = opposite of current velocity vector)
        const curVy = -(vSpd - grav * eAge);
        const curVx = Math.cos(angle) * hSpd;
        const spd   = Math.sqrt(curVx * curVx + curVy * curVy) + 0.001;
        const tailL = eRad * (3.5 + s2 * 4);
        ctx.strokeStyle = `rgba(255,${Math.round(lum * 0.55)},6,${eFade * 0.45})`;
        ctx.lineWidth   = eRad * 0.55;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - (curVx / spd) * tailL, ey - (curVy / spd) * tailL);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // ── EXPANDING GROUND FIRE RINGS ───────────────────────────────────
      for (let r = 0; r < 3; r++) {
        const rAge  = Math.max(0, fireAge - r * 0.035);
        const rFade = Math.max(0, 1 - rAge / (0.38 + r * 0.07));
        if (rFade <= 0) continue;
        const rR  = R * (0.55 + r * 0.28 + rAge * 1.2);
        const rRy = rR * 0.36;
        const heat = Math.max(0, 1 - rAge * 2.4);
        ctx.strokeStyle = `rgba(255,${Math.round(70 + heat * 160)},8,${0.62 * rFade})`;
        ctx.lineWidth   = Math.max(1.2, (5 - r * 1.2) * zoom * rFade);
        ctx.beginPath();
        ctx.ellipse(sx, sy + rRy * 0.14, rR, rRy, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── SMOKE COLUMN — rises, billows, cools from orange→grey ─────────
      ctx.globalCompositeOperation = 'source-over';
      for (let s = 0; s < 18; s++) {
        const s1    = ((s * 47 + mark.id * 19) % 100) / 100;
        const s2    = ((s * 83 + mark.id * 31) % 100) / 100;
        const sAge  = Math.max(0, smokeAge - s1 * 0.11);
        if (sAge <= 0) continue;
        const sFade = Math.max(0, 1 - sAge / (0.44 + s1 * 0.38));
        if (sFade <= 0) continue;
        const rise  = sAge * (0.48 + s1 * 0.88) * 220 * Math.max(0.8, zoom);
        const drift = (s2 - 0.5) * R * 0.65 * (0.3 + sAge);
        const px    = sx + drift;
        const py    = sy - R * 0.06 - rise;
        const pR    = R * (0.13 + s1 * 0.25 + sAge * 0.52 * zoom);
        // Colour: orange-hot near ground, dark smoky grey above
        const heat  = Math.max(0, 1 - sAge * 2.5);
        const rr    = Math.round(18 + heat * 200);
        const gg    = Math.round(12 + heat * 78);
        const bb    = Math.round(10 + heat * 20);
        const pG    = ctx.createRadialGradient(px - pR * 0.14, py - pR * 0.10, 0, px, py, pR);
        pG.addColorStop(0,   `rgba(${rr},${gg},${bb},${0.58 * sFade})`);
        pG.addColorStop(0.5, `rgba(${Math.round(rr * 0.5)},${Math.round(gg * 0.45)},${Math.round(bb * 0.55)},${0.30 * sFade})`);
        pG.addColorStop(1,   `rgba(4,4,4,0)`);
        ctx.fillStyle = pG;
        ctx.beginPath();
        ctx.arc(px, py, pR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'screen';
    }

    ctx.restore();
  }

  private drawMissileSupportBurst(
    ctx: CanvasRenderingContext2D,
    mark: ImpactMark,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    const fade = Math.max(0, Math.min(1, mark.ttl / Math.max(mark.maxTtl, 0.001)));
    if (fade <= 0) return;
    const { sx, sy } = GameRenderer.wts(mark.wx, mark.wy, cam, zoom);
    const radius = mark.radius * Math.max(0.84, zoom);
    const pulse = 0.84 + Math.sin(elapsed * 20 + mark.id * 0.41) * 0.08;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(255, 182, 118, ${0.38 * fade})`;
    ctx.lineWidth = Math.max(2, 3.2 * zoom);
    ctx.beginPath();
    ctx.ellipse(sx, sy, radius * pulse, radius * 0.46 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawLanceSupportBurst(
    ctx: CanvasRenderingContext2D,
    mark: ImpactMark,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    const fade = Math.max(0, Math.min(1, mark.ttl / Math.max(mark.maxTtl, 0.001)));
    if (fade <= 0) return;
    const { sx, sy } = GameRenderer.wts(mark.wx, mark.wy, cam, zoom);
    const radius = mark.radius * Math.max(0.84, zoom);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(255, 166, 128, ${0.5 * fade})`;
    ctx.lineWidth = Math.max(1.6, 2.2 * zoom);
    ctx.beginPath();
    ctx.moveTo(sx, sy - radius * 1.9);
    ctx.lineTo(sx, sy + radius * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  private getUnitHealthBarWidth(unit: Unit, scale: number): number {
    switch (unit.def.sprite) {
      case 'viking':
        return (unit.def.role === 'heavy' ? 26 : 20) * scale;
      case 'cybernetic':
        return 22 * scale;
      case 'collector':
        return 18 * scale;
      case 'lasers':
        return 16 * scale;
      case 'boits':
        if (unit.def.role === 'boss') return 34 * scale;
        if (unit.def.role === 'heavy') return 22 * scale;
        return 16 * scale;
      default:
        return 16 * scale;
    }
  }

  private getUnitHealthBarY(
    unit: Unit,
    state: GameState,
    baseSy: number,
    zoom: number,
    elapsed: number,
  ): number {
    const scale = unitScale(zoom);
    const barScale = Math.max(0.9, zoom);
    const gap = Math.max(3, 4 * barScale);
    const bobY = this.getUnitHealthBarBobY(unit, state, elapsed, scale, zoom);
    const spriteHeight = this.getUnitHealthBarSpriteHeight(unit, state, scale);
    return baseSy - spriteHeight + bobY - gap;
  }

  private getUnitHealthBarSpriteHeight(unit: Unit, state: GameState, scale: number): number {
    switch (unit.def.sprite) {
      case 'viking':
        return this.isVikingAttackingAtContact(unit, state)
          ? (unit.def.role === 'heavy' ? 54 * 1.66 : 54 * 1.4) * scale
          : (unit.def.role === 'heavy' ? 52 * 1.66 : 52 * 1.4) * scale;
      case 'cybernetic':
        return 54 * scale;
      case 'collector':
        return ((state.crystals ?? 0) > 0 ? 72 : 68) * scale;
      case 'lasers':
        return 38 * scale;
      case 'boits':
        return 38 * scale * this.getBoitsRoleScale(unit);
      default:
        return 20 * scale;
    }
  }

  private getUnitHealthBarBobY(
    unit: Unit,
    state: GameState,
    elapsed: number,
    scale: number,
    zoom: number,
  ): number {
    switch (unit.def.sprite) {
      case 'collector':
        return ((state.crystals ?? 0) > 0 ? -18 : -16) * scale
          + Math.sin(elapsed * 2.8 + unit.id * 0.45) * 0.7 * Math.max(0.85, zoom);
      case 'cybernetic':
        return (unit.dodgeCooldown ?? 0) > 1.55 ? -5 * scale : 0;
      default:
        return 0;
    }
  }

  private getBoitsRoleScale(unit: Unit): number {
    const isBigVariant = unit.def.role === 'light' && (unit.id * 2654435761) % 100 < 15;
    const variantScale = isBigVariant ? 1.18 : 1;
    if (unit.def.role === 'boss') return 1.85;
    if (unit.def.role === 'heavy') return 1.2;
    return variantScale;
  }

  private isVikingAttackingAtContact(unit: Unit, state: GameState): boolean {
    return this.isVikingAttackVisualActive(unit, state);
  }

  private isVikingAttackVisualActive(unit: Unit, state: GameState): boolean {
    return this.isMeleeAttackVisualActive(unit, state, 26);
  }

  private isCyberneticAttackVisualActive(unit: Unit, state: GameState): boolean {
    return this.isMeleeAttackVisualActive(unit, state, 26);
  }

  private isMeleeAttackVisualActive(unit: Unit, state: GameState, maxDistance: number): boolean {
    if (unit.state === 'attacking-base') return true;
    if (unit.attackWindup !== undefined) return true;
    if (unit.state !== 'fighting' || unit.fightingWith === null) return false;
    if (unit.fightingWith < 0) return true;
    const opponent = state.units.find(u => u.id === unit.fightingWith && u.hp > 0);
    if (!opponent) return false;
    return Math.hypot(unit.wx - opponent.wx, unit.wy - opponent.wy) <= maxDistance;
  }

  private drawCollectorShadow(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    cam: { x: number; y: number },
    zoom: number,
    _bobY: number,
    processingSalvage: boolean,
  ): void {
    const scale = Math.max(0.85, zoom);
    const { sx, sy } = GameRenderer.wts(wx, wy, cam, zoom);
    const radiusX = (processingSalvage ? 24 : 22) * scale;
    const radiusY = (processingSalvage ? 8 : 7) * scale;
    const alpha = processingSalvage ? 0.28 : 0.22;

    ctx.save();
    ctx.fillStyle = `rgba(8, 14, 20, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(8, 14, 20, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, radiusX * 0.66, radiusY * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCollectorShieldField(
    ctx: CanvasRenderingContext2D,
    unit: Unit,
    cam: { x: number; y: number },
    zoom: number,
    bobY: number,
    elapsed: number,
  ): void {
    const shield = unit.collectorShield ?? 0;
    if (shield <= 0) return;

    const { sx, sy } = GameRenderer.wts(unit.wx, unit.wy, cam, zoom);
    const scale = Math.max(0.85, zoom);
    const lifePulse = Math.min(1, shield / 15);
    const shimmer = 0.74 + Math.sin(elapsed * 5.5 + unit.id * 0.31) * 0.12;
    const shellRx = 28 * scale;
    const shellRy = 38 * scale;
    const centerY = sy - 28 * scale + bobY;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const core = ctx.createRadialGradient(
      sx,
      centerY - 8 * scale,
      2 * scale,
      sx,
      centerY,
      shellRy,
    );
    core.addColorStop(0, `rgba(214, 248, 255, ${0.22 * shimmer})`);
    core.addColorStop(0.35, `rgba(98, 221, 255, ${0.18 * shimmer})`);
    core.addColorStop(0.7, `rgba(48, 126, 255, ${0.08 * shimmer})`);
    core.addColorStop(1, 'rgba(12, 24, 46, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(sx, centerY, shellRx * 1.08, shellRy, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(188, 245, 255, ${0.56 + lifePulse * 0.18})`;
    ctx.lineWidth = Math.max(1.1, 1.6 * scale);
    ctx.beginPath();
    ctx.ellipse(sx, centerY, shellRx, shellRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(104, 222, 255, ${0.34 + lifePulse * 0.16})`;
    ctx.lineWidth = Math.max(0.9, 1.2 * scale);
    ctx.beginPath();
    ctx.ellipse(sx, centerY + 1.5 * scale, shellRx * 0.76, shellRy * 0.82, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(224, 253, 255, ${0.42 * shimmer})`;
    ctx.lineWidth = Math.max(0.8, scale);
    ctx.beginPath();
    ctx.ellipse(sx, centerY - 3 * scale, shellRx * 0.34, shellRy * 0.98, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(sx, centerY - 3 * scale, shellRx * 0.9, shellRy * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();

    const ringY = centerY + shellRy * 0.9;
    ctx.strokeStyle = `rgba(120, 228, 255, ${0.38 + lifePulse * 0.12})`;
    ctx.lineWidth = Math.max(1.3, 1.7 * scale);
    ctx.beginPath();
    ctx.ellipse(sx, ringY, shellRx * 0.96, shellRy * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 3; i += 1) {
      const phase = elapsed * 2.4 + unit.id * 0.3 + i * 1.9;
      const arcY = centerY - shellRy * 0.3 + Math.sin(phase) * 8 * scale;
      const arcRx = shellRx * (0.38 + i * 0.16);
      const arcRy = shellRy * (0.12 + i * 0.05);
      ctx.strokeStyle = `rgba(196, 248, 255, ${0.22 + i * 0.08})`;
      ctx.lineWidth = Math.max(0.8, 1.1 * scale);
      ctx.beginPath();
      ctx.ellipse(sx, arcY, arcRx, arcRy, 0, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawCombatAura(
    ctx: CanvasRenderingContext2D,
    unit: Unit,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    if (!unit.buffAura) return;

    const { sx, sy } = GameRenderer.wts(unit.wx, unit.wy, cam, zoom);
    const scale = Math.max(0.85, zoom);
    const pulse = 0.82 + Math.sin(elapsed * 4.8 + unit.id * 0.37) * 0.12;
    const rx = (unit.buffAura === 'overdrive' ? 28 : 24) * scale * pulse;
    const ry = (unit.buffAura === 'overdrive' ? 11 : 9) * scale * pulse;
    const lift = unit.buffAura === 'overdrive' ? 2.5 : 1.2;
    const glowTop = sy - 4 * scale;
    const ringColor = unit.buffAura === 'overdrive'
      ? 'rgba(255, 168, 90, 0.78)'
      : 'rgba(104, 232, 255, 0.72)';
    const fillInner = unit.buffAura === 'overdrive'
      ? `rgba(255, 196, 124, ${0.18 * pulse})`
      : `rgba(120, 242, 255, ${0.14 * pulse})`;
    const fillOuter = unit.buffAura === 'overdrive'
      ? 'rgba(255, 112, 52, 0)'
      : 'rgba(60, 150, 255, 0)';

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const disc = ctx.createRadialGradient(sx, sy + lift, rx * 0.15, sx, sy + lift, rx * 1.2);
    disc.addColorStop(0, fillInner);
    disc.addColorStop(0.45, unit.buffAura === 'overdrive' ? `rgba(255, 120, 64, ${0.18 * pulse})` : `rgba(88, 196, 255, ${0.16 * pulse})`);
    disc.addColorStop(1, fillOuter);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.ellipse(sx, sy + lift, rx * 1.2, ry * 1.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = Math.max(1.1, 1.6 * scale);
    ctx.beginPath();
    ctx.ellipse(sx, sy + lift, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = unit.buffAura === 'overdrive'
      ? `rgba(255, 230, 180, ${0.52 * pulse})`
      : `rgba(210, 250, 255, ${0.48 * pulse})`;
    ctx.lineWidth = Math.max(0.8, 1.1 * scale);
    ctx.beginPath();
    ctx.ellipse(sx, sy + lift - 1.2 * scale, rx * 0.62, ry * 0.58, 0, 0, Math.PI * 2);
    ctx.stroke();

    const pillar = ctx.createLinearGradient(sx, glowTop - 18 * scale, sx, sy + 8 * scale);
    pillar.addColorStop(0, 'rgba(255,255,255,0)');
    pillar.addColorStop(0.4, unit.buffAura === 'overdrive' ? `rgba(255, 180, 96, ${0.11 * pulse})` : `rgba(132, 224, 255, ${0.1 * pulse})`);
    pillar.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = pillar;
    ctx.beginPath();
    ctx.ellipse(sx, glowTop, rx * 0.48, 18 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawSalvageDrops(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    for (const drop of state.latfaDrops ?? []) {
      const { sx, sy } = GameRenderer.wts(drop.wx, drop.wy, cam, zoom);
      const pulse = 0.82 + Math.sin(elapsed * 5 + drop.id * 0.23) * 0.18;
      const radius = Math.max(4, 6 * zoom * pulse);
      const isSchematic = drop.kind === 'schematic';
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = isSchematic ? 'rgba(12, 22, 38, 0.4)' : 'rgba(34, 18, 12, 0.35)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + radius * 0.9, radius * 1.6, radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isSchematic ? `rgba(111, 210, 255, ${0.92 * pulse})` : `rgba(255, 214, 110, ${0.92 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy - radius);
      ctx.lineTo(sx + radius * 0.7, sy);
      ctx.lineTo(sx, sy + radius);
      ctx.lineTo(sx - radius * 0.7, sy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = isSchematic ? `rgba(222, 247, 255, ${0.58 * pulse})` : `rgba(255, 248, 201, ${0.55 * pulse})`;
      ctx.lineWidth = Math.max(1, zoom);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawDropPods(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    this.drawDropPodEffects(ctx, state, cam, zoom, elapsed);
  }

  // Capsule sprites — drawn before units so soldiers render in front
  private drawDropPodBodies(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    _elapsed: number,
  ): void {
    const CAPSULE_FRAME_COUNT = 2;
    const CAPSULE_OPEN_FPS = 6;
    const frames = sheetFrames(CAPSULE_SPRITE, CAPSULE_FRAME_COUNT);
    if (!frames || frames.length < 1) return;
    const landingTime = 0.95;
    const openTime = 2.15;

    for (const pod of state.dropPods ?? []) {
      const dropProgress = Math.max(0, Math.min(1, pod.elapsed / landingTime));
      const descentCurve = 1 - dropProgress;
      const worldY = pod.wy - descentCurve * descentCurve * 720;
      const { sx, sy } = GameRenderer.wts(pod.wx, worldY, cam, zoom);
      const drawSize = 56 * zoom;
      const frameIndex = pod.elapsed < openTime
        ? 0
        : Math.min(frames.length - 1, Math.floor((pod.elapsed - openTime) * CAPSULE_OPEN_FPS));
      const impactPulse = pod.elapsed >= landingTime && pod.elapsed < openTime
        ? 1 - Math.min(1, (pod.elapsed - landingTime) / (openTime - landingTime))
        : 0;

      ctx.save();
      ctx.globalAlpha = pod.elapsed < landingTime ? 0.94 : 1;
      ctx.drawImage(
        frames[frameIndex],
        sx - drawSize / 2,
        sy - drawSize * (0.88 - impactPulse * 0.04),
        drawSize,
        drawSize * (1 - impactPulse * 0.06),
      );
      ctx.restore();
    }
  }

  // Fire, smoke and rings — drawn after units as overlay
  private drawDropPodEffects(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cam: { x: number; y: number },
    zoom: number,
    elapsed: number,
  ): void {
    const landingTime = 0.95;
    const openTime = 2.15;

    for (const pod of state.dropPods ?? []) {
      const dropProgress = Math.max(0, Math.min(1, pod.elapsed / landingTime));
      const descentCurve = 1 - dropProgress;
      const worldY = pod.wy - descentCurve * descentCurve * 720;
      const { sx, sy } = GameRenderer.wts(pod.wx, worldY, cam, zoom);
      const { sx: lsx, sy: lsy } = GameRenderer.wts(pod.wx, pod.wy, cam, zoom);
      const drawSize = 56 * zoom;

      if (pod.elapsed < landingTime) {
        // Descent fire aimed at landing tile
        this.drawDescentFire(ctx, sx, sy, drawSize, dropProgress, elapsed + pod.id * 0.17, zoom, lsx, lsy);
      } else {
        // Impact ring — brief pulse right after landing
        const impactPhase = Math.min(1, (pod.elapsed - landingTime) / (openTime - landingTime));
        if (impactPhase < 0.4) {
          this.drawImpactRing(ctx, lsx, lsy, impactPhase * 0.625, zoom);
        }

        // Dust: max on landing (smokePhase=0), gentle fade until door opens,
        // then faster fade as dust flies away
        const smokePhase = pod.elapsed < openTime
          ? Math.min(0.4, (pod.elapsed - landingTime) / (openTime - landingTime) * 0.4)
          : Math.min(1, 0.4 + (pod.elapsed - openTime) / 1.8 * 0.6);
        this.drawDropPodSmoke(ctx, pod.wx, pod.wy, cam, zoom, smokePhase, elapsed + pod.id * 0.31);
      }
    }
  }

  private drawDescentFire(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    drawSize: number,
    dropProgress: number,
    elapsed: number,
    zoom: number,
    lsx: number,   // screen X of landing tile
    lsy: number,   // screen Y of landing tile
  ): void {
    const nozzleX = sx;
    const nozzleY = sy + drawSize * 0.15;
    const intensity = 0.4 + (1 - dropProgress) * 0.6;

    // Direction from nozzle to landing spot
    const dx = lsx - nozzleX;
    const dy = lsy - nozzleY;
    const beamLen = Math.sqrt(dx * dx + dy * dy);
    if (beamLen < 2) return;
    const angle = Math.atan2(dy, dx) - Math.PI / 2; // rotate so "down" aligns with beam

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // === FIRE CONE — rotated to aim at landing tile ===
    ctx.translate(nozzleX, nozzleY);
    ctx.rotate(angle);

    // Outer heat glow — wide orange cloud around the whole cone
    const outerGlow = ctx.createLinearGradient(0, 0, 0, beamLen);
    outerGlow.addColorStop(0,    `rgba(255, 140,  20, ${intensity * 0.10})`);
    outerGlow.addColorStop(0.3,  `rgba(255,  80,   0, ${intensity * 0.28})`);
    outerGlow.addColorStop(0.7,  `rgba(200,  40,   0, ${intensity * 0.22})`);
    outerGlow.addColorStop(1,    `rgba(120,  10,   0, 0)`);
    const outerW = 52 * zoom;
    ctx.beginPath();
    ctx.moveTo(-3 * zoom, 0);
    ctx.lineTo(-outerW, beamLen);
    ctx.lineTo( outerW, beamLen);
    ctx.lineTo( 3 * zoom, 0);
    ctx.closePath();
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Mid fire layers — orange to yellow
    const fireLayers = [
      { wT:  1, wB: 34, col: [255,  60,   0], a: intensity * 0.45 },
      { wT:  1, wB: 22, col: [255, 120,   0], a: intensity * 0.55 },
      { wT:  1, wB: 13, col: [255, 200,  10], a: intensity * 0.65 },
      { wT:  1, wB:  6, col: [255, 240, 100], a: intensity * 0.80 },
      { wT:  1, wB:  2, col: [255, 255, 220], a: intensity * 0.95 }, // white hot core
    ];
    for (const L of fireLayers) {
      const wT = L.wT * zoom;
      const wB = L.wB * zoom;
      const [r, g, b] = L.col;
      ctx.beginPath();
      ctx.moveTo(-wT / 2, 0);
      ctx.lineTo(-wB / 2, beamLen);
      ctx.lineTo( wB / 2, beamLen);
      ctx.lineTo( wT / 2, 0);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, beamLen);
      grad.addColorStop(0,    `rgba(${r},${g},${b},${L.a * 0.8})`);
      grad.addColorStop(0.25, `rgba(${r},${g},${b},${L.a})`);
      grad.addColorStop(0.65, `rgba(${r},${g},${b},${L.a * 0.9})`);
      grad.addColorStop(1,    `rgba(${r},${g},${b},${L.a * 0.5})`);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Turbulent flame tongues along the cone
    for (let i = 0; i < 9; i++) {
      const t = elapsed * 5.0 + i * 0.95;
      const frac = 0.05 + i * 0.10;
      const localY = beamLen * frac;
      const halfW = (1 + 33 * frac) / 2 * zoom * 0.75;
      const ox = Math.sin(t + i * 0.7) * halfW;
      const wr = (3.5 + Math.abs(Math.sin(t * 2.1)) * 4.0) * zoom * intensity;
      // Colour shifts from white-yellow near nozzle → deep orange at tail
      const heat = 1 - frac;
      const fr = 255;
      const fg = Math.round(200 * heat + 40 * (1 - heat));
      const fb = Math.round(80 * heat);
      const wGrad = ctx.createRadialGradient(ox, localY, 0, ox, localY, wr);
      wGrad.addColorStop(0,   `rgba(${fr},${fg},${fb},${intensity * 0.85})`);
      wGrad.addColorStop(0.5, `rgba(255, 80, 0, ${intensity * 0.40})`);
      wGrad.addColorStop(1,   `rgba(180, 20, 0, 0)`);
      ctx.fillStyle = wGrad;
      ctx.beginPath();
      ctx.arc(ox, localY, wr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // === Impact fire pool at landing tile (not rotated) ===
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const impR = (24 + (1 - dropProgress) * 20) * zoom;
    const impGrad = ctx.createRadialGradient(lsx, lsy, 0, lsx, lsy, impR);
    impGrad.addColorStop(0,   `rgba(255, 240, 160, ${intensity * 0.90})`);
    impGrad.addColorStop(0.3, `rgba(255, 120,   0, ${intensity * 0.65})`);
    impGrad.addColorStop(0.65,`rgba(200,  30,   0, ${intensity * 0.35})`);
    impGrad.addColorStop(1,   `rgba(100,   0,   0, 0)`);
    ctx.fillStyle = impGrad;
    ctx.beginPath();
    ctx.ellipse(lsx, lsy, impR, impR * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  private drawImpactRing(
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    smokePhase: number,   // 0 = just landed, 1 = faded
    zoom: number,
  ): void {
    const fade = 1 - smokePhase;

    // ── 1. DARK SUNKEN PIT ─────────────────────────────
    // Shows as if the tile surface caved in — visible in isometric perspective
    {
      const pitRx = (18 + smokePhase * 8) * zoom;
      const pitRy = pitRx * 0.36;
      const pitFade = Math.max(0, 1 - smokePhase / 0.6);

      // Pit bottom (darkest — deepest point)
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(10, 6, 2, ${0.72 * pitFade})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy + pitRy * 0.5, pitRx * 0.58, pitRy * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pit rim — visible edge of broken tile surface
      ctx.fillStyle = `rgba(25, 14, 5, ${0.58 * pitFade})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy, pitRx, pitRy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Front wall of pit — isometric depth strip
      // The "far" half stays at sy, the "near" half appears below
      ctx.fillStyle = `rgba(35, 18, 6, ${0.65 * pitFade})`;
      ctx.beginPath();
      ctx.moveTo(sx - pitRx, sy);
      ctx.lineTo(sx + pitRx, sy);
      ctx.lineTo(sx + pitRx * 0.82, sy + pitRy * 1.4);
      ctx.lineTo(sx - pitRx * 0.82, sy + pitRy * 1.4);
      ctx.closePath();
      ctx.fill();

      // Glowing rim — heat at the edge of impact
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `rgba(255, 160, 30, ${0.6 * pitFade})`;
      ctx.lineWidth = Math.max(1.2, 2.2 * zoom);
      ctx.beginPath();
      ctx.ellipse(sx, sy, pitRx, pitRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── 2. RADIAL TILE CRACKS ──────────────────────────
    // Spiderweb crack lines spreading across the ground surface
    {
      const crackFade = Math.max(0, 1 - smokePhase / 0.7);
      if (crackFade > 0) {
        const crackGrow = Math.min(1, smokePhase / 0.18); // cracks spread quickly
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        const crackCount = 8;
        for (let i = 0; i < crackCount; i++) {
          const angle = (i / crackCount) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.2);
          const len = (28 + (i % 3) * 16) * zoom * crackGrow;
          // Main crack
          ctx.strokeStyle = `rgba(22, 12, 4, ${0.62 * crackFade})`;
          ctx.lineWidth = Math.max(0.7, (1.4 - i * 0.08) * zoom);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.38);
          ctx.stroke();
          // Branch crack at ~60% of the main crack
          if (i % 2 === 0) {
            const bAngle = angle + 0.45;
            const bLen = len * 0.38;
            const bx0 = sx + Math.cos(angle) * len * 0.58;
            const by0 = sy + Math.sin(angle) * len * 0.58 * 0.38;
            ctx.lineWidth = Math.max(0.5, 0.8 * zoom);
            ctx.beginPath();
            ctx.moveTo(bx0, by0);
            ctx.lineTo(bx0 + Math.cos(bAngle) * bLen, by0 + Math.sin(bAngle) * bLen * 0.38);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // ── 3. TILE SHARD FRAGMENTS ────────────────────────
    // Small isometric box-fragments flying outward — look like pieces of tile
    {
      const shardFade = Math.max(0, 1 - smokePhase / 0.55);
      if (shardFade > 0) {
        const shardCount = 10;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        for (let f = 0; f < shardCount; f++) {
          const s1 = ((f * 41 + 7) % 100) / 100;   // pseudo-random seed
          const s2 = ((f * 67 + 13) % 100) / 100;
          const angle = (f / shardCount) * Math.PI * 2 + s1 * 0.6;
          const dist = smokePhase * (32 + s1 * 28) * zoom;
          const fx = sx + Math.cos(angle) * dist;
          const fy = sy + Math.sin(angle) * dist * 0.36;
          const tileW = (5 + s2 * 5) * zoom;
          const tileH = tileW * 0.52;
          const depth = tileW * 0.28;   // isometric depth (side face height)
          const tilt = angle + smokePhase * (s1 > 0.5 ? 1.2 : -0.9);

          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(tilt);

          // Top face of shard (light — lit surface)
          ctx.fillStyle = `rgba(185, 165, 130, ${shardFade * (0.55 + s2 * 0.3)})`;
          ctx.beginPath();
          ctx.moveTo(-tileW / 2, -tileH / 2);
          ctx.lineTo( tileW / 2, -tileH / 2);
          ctx.lineTo( tileW / 2,  tileH / 2);
          ctx.lineTo(-tileW / 2,  tileH / 2);
          ctx.closePath();
          ctx.fill();

          // Front face of shard (darker — shaded side, gives 3D box)
          ctx.fillStyle = `rgba(80, 62, 40, ${shardFade * (0.65 + s2 * 0.2)})`;
          ctx.beginPath();
          ctx.moveTo(-tileW / 2,  tileH / 2);
          ctx.lineTo( tileW / 2,  tileH / 2);
          ctx.lineTo( tileW / 2,  tileH / 2 + depth);
          ctx.lineTo(-tileW / 2,  tileH / 2 + depth);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
        ctx.restore();
      }
    }

    // ── 4. EXPANDING DUST RING ─────────────────────────
    {
      const ringR = smokePhase * 80 * zoom;
      const ringAlpha = Math.max(0, (1 - smokePhase / 0.25) * 0.45);
      const grad = ctx.createRadialGradient(sx, sy, ringR * 0.62, sx, sy, ringR);
      grad.addColorStop(0,   `rgba(190, 175, 145, 0)`);
      grad.addColorStop(0.5, `rgba(190, 175, 145, ${ringAlpha})`);
      grad.addColorStop(1,   `rgba(160, 140, 110, 0)`);
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(sx, sy, ringR, ringR * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    void fade;
  }

  private drawDropPodSmoke(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    cam: { x: number; y: number },
    zoom: number,
    smokePhase: number,
    elapsed: number,
  ): void {
    const { sx, sy } = GameRenderer.wts(wx, wy, cam, zoom);
    const alpha = Math.max(0, 1 - smokePhase * 0.9);
    if (alpha <= 0) return;

    // Volumetric smoke puffs — each rises and expands independently
    const puffs: Array<{ ox: number; oy: number; size: number; speed: number; seed: number }> = [
      { ox: -0.30, oy: -0.5, size: 1.3, speed: 0.65, seed: 0.0 },
      { ox:  0.25, oy: -0.7, size: 1.1, speed: 0.90, seed: 1.1 },
      { ox: -0.55, oy: -0.3, size: 1.0, speed: 0.55, seed: 2.3 },
      { ox:  0.50, oy: -0.4, size: 1.2, speed: 0.80, seed: 3.7 },
      { ox:  0.00, oy: -0.9, size: 0.9, speed: 1.00, seed: 4.2 },
      { ox: -0.20, oy: -0.6, size: 1.4, speed: 0.70, seed: 5.5 },
      { ox:  0.40, oy: -0.8, size: 0.8, speed: 0.85, seed: 6.8 },
      { ox: -0.10, oy: -0.2, size: 1.5, speed: 0.50, seed: 7.1 },
    ];

    ctx.save();
    for (const puff of puffs) {
      const rise = smokePhase * puff.speed * 55;
      const spread = smokePhase * puff.speed * 28;
      // Slight wobble per puff using its seed
      const wobble = Math.sin(elapsed * 1.1 + puff.seed) * 4;
      const px = sx + (puff.ox * spread + wobble) * zoom;
      const py = sy + puff.oy * 36 * zoom - rise * zoom;
      const radius = puff.size * (14 + smokePhase * 38) * zoom;

      const grad = ctx.createRadialGradient(px, py - radius * 0.2, radius * 0.05, px, py, radius);
      grad.addColorStop(0,   `rgba(210, 198, 175, ${alpha * 0.75})`);
      grad.addColorStop(0.35, `rgba(185, 168, 140, ${alpha * 0.50})`);
      grad.addColorStop(0.7,  `rgba(155, 138, 110, ${alpha * 0.22})`);
      grad.addColorStop(1,   `rgba(120, 105,  80, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private resolveProjectileSprite(angle: number): string | null {
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

  private getUnitLookVector(
    unit: Unit,
    state: GameState,
  ): { dx: number; dy: number } | null {
    if (unit.def.role === 'collector' && unit.lastWx !== undefined && unit.lastWy !== undefined) {
      const dx = unit.wx - unit.lastWx;
      const dy = unit.wy - unit.lastWy;
      if (Math.hypot(dx, dy) > 0.25) {
        return { dx, dy };
      }
    }

    if (unit.state === 'fighting' && unit.fightingWith !== null) {
      const opponent = state.units.find((candidate) => candidate.id === unit.fightingWith && candidate.hp > 0);
      if (opponent) {
        return {
          dx: opponent.wx - unit.wx,
          dy: opponent.wy - unit.wy,
        };
      }
    }

    const path = unit.faction === 'ally'
      ? (state.allyPathNodes && state.allyPathNodes.length >= 2
          ? state.allyPathNodes
          : [...state.pathNodes].reverse())
      : state.pathNodes;
    if (path.length < 2) return null;

    const currentIndex = Math.min(unit.pathIndex, path.length - 1);
    const currentNode = path[currentIndex] ?? path[path.length - 1];
    const nextNode = path[Math.min(currentIndex + 1, path.length - 1)] ?? currentNode;
    if (currentIndex >= path.length - 1) {
      const prevNode = path[Math.max(0, path.length - 2)] ?? currentNode;
      return {
        dx: currentNode.wx - prevNode.wx,
        dy: currentNode.wy - prevNode.wy,
      };
    }

    return {
      dx: nextNode.wx - currentNode.wx,
      dy: nextNode.wy - currentNode.wy,
    };
  }

  private getAttackAnimationProgress(unit: Unit): number | null {
    if (unit.attackWindup === undefined || unit.attackWindupTotal === undefined || unit.attackWindupTotal <= 0) {
      return null;
    }
    return Math.max(0, Math.min(0.999, 1 - unit.attackWindup / unit.attackWindupTotal));
  }

  private resolveVikingWalkDirection(
    look: { dx: number; dy: number } | null,
  ): keyof typeof VIKING_WALK {
    if (!look) return 'south';
    if (Math.abs(look.dx) > Math.abs(look.dy) * 1.1) {
      return look.dx >= 0 ? 'east' : 'west';
    }
    return look.dy >= 0 ? 'south' : 'north';
  }

  private resolveCollectorDirection(
    look: { dx: number; dy: number } | null,
  ): keyof typeof COLLECTOR_DIRS {
    if (!look) return 'east';
    const len = Math.hypot(look.dx, look.dy) || 1;
    const nx = look.dx / len;
    const ny = look.dy / len;
    const dirs: Array<{ key: keyof typeof COLLECTOR_DIRS; x: number; y: number }> = [
      { key: 'east', x: 1, y: 0 },
      { key: 'northeast', x: Math.SQRT1_2, y: -Math.SQRT1_2 },
      { key: 'north', x: 0, y: -1 },
      { key: 'northwest', x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
      { key: 'west', x: -1, y: 0 },
      { key: 'south', x: 0, y: 1 },
    ];

    let best = dirs[0];
    let bestDot = Number.NEGATIVE_INFINITY;
    for (const dir of dirs) {
      const dot = nx * dir.x + ny * dir.y;
      if (dot > bestDot) {
        best = dir;
        bestDot = dot;
      }
    }

    return best.key;
  }
}

