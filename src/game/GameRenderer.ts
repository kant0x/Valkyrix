// src/game/GameRenderer.ts
// Visual layer: draws units, buildings, and projectiles on the isometric canvas.
// Phase 3: uses colored rectangle placeholders for all entities (no sprite atlas).

import type { GameState, PathNode } from './game.types';

const GAME_W = 1280;
const GAME_VIEW_H = 506;

export class GameRenderer {
  constructor(private arrowImg: HTMLImageElement) {}

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------

  render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cameraCenter: { x: number; y: number },
    zoom: number,
  ): void {
    this.drawBuildings(ctx, state, cameraCenter, zoom);
    this.drawUnits(ctx, state, cameraCenter, zoom);
    this.drawProjectiles(ctx, state, cameraCenter, zoom);
  }

  /**
   * Optional debug helper — draws path nodes as small cyan dots.
   * Call from main.ts during integration testing to verify path ordering.
   * Not wired by default.
   */
  renderDebugPath(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cameraCenter: { x: number; y: number },
    zoom: number,
  ): void {
    const nodes: PathNode[] = state.pathNodes;
    if (nodes.length === 0) return;

    ctx.save();
    ctx.fillStyle = '#00ffff';
    for (const node of nodes) {
      const { sx, sy } = GameRenderer.worldToScreen(node.wx, node.wy, cameraCenter, zoom);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------

  /**
   * Converts world coords to canvas screen coords.
   * Formula copied verbatim from main.ts (Plan 06 refactors main.ts into a module;
   * until then we keep a private copy here to avoid a circular import).
   */
  private static worldToScreen(
    wx: number,
    wy: number,
    cameraCenter: { x: number; y: number },
    zoom: number,
  ): { sx: number; sy: number } {
    return {
      sx: GAME_W / 2 + (wx - cameraCenter.x) * zoom,
      sy: GAME_VIEW_H / 2 + (wy - cameraCenter.y) * zoom,
    };
  }

  private drawBuildings(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cameraCenter: { x: number; y: number },
    zoom: number,
  ): void {
    const W = 32;
    const H = 32;

    for (const building of state.buildings) {
      const { sx, sy } = GameRenderer.worldToScreen(building.wx, building.wy, cameraCenter, zoom);

      // Fill: red for attack towers, blue for buff towers
      ctx.fillStyle = building.type === 'attack' ? '#e74c3c' : '#3498db';
      ctx.fillRect(sx - W / 2, sy - H / 2, W, H);

      // 1 px white border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - W / 2, sy - H / 2, W, H);
    }
  }

  private drawUnits(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cameraCenter: { x: number; y: number },
    zoom: number,
  ): void {
    const W = 16;
    const H = 24;

    for (const unit of state.units) {
      const { sx, sy } = GameRenderer.worldToScreen(unit.wx, unit.wy, cameraCenter, zoom);

      // Fill: orange for enemies, green for allies
      ctx.fillStyle = unit.faction === 'enemy' ? '#e67e22' : '#2ecc71';
      ctx.fillRect(sx - W / 2, sy - H / 2, W, H);

      // Faction letter centered on rect
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unit.faction === 'enemy' ? 'E' : 'A', sx, sy);
    }

    // Reset text alignment to avoid bleeding into other draw calls
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private drawProjectiles(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    cameraCenter: { x: number; y: number },
    zoom: number,
  ): void {
    for (const proj of state.projectiles) {
      // Find the target unit — skip projectile if target no longer exists
      const target = state.units.find((u) => u.id === proj.targetUnitId);
      if (!target) continue;

      const { sx, sy } = GameRenderer.worldToScreen(proj.wx, proj.wy, cameraCenter, zoom);
      const angle = Math.atan2(target.wy - proj.wy, target.wx - proj.wx);

      if (this.arrowImg.complete && this.arrowImg.naturalWidth > 0) {
        // Arrow sprite: 32×16 px, centered on projectile position, rotated toward target
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.drawImage(this.arrowImg, -16, -8, 32, 16);
        ctx.restore();
      } else {
        // Fallback while image loads: small yellow circle
        ctx.save();
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}
