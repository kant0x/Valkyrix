import type { GameState } from './game.types';

// Distance threshold for a projectile to count as "hit"
const HIT_THRESHOLD = 8; // world units

export class ProjectileSystem {
  /**
   * Update all projectiles each frame:
   * - Move each projectile toward its target's current world position.
   * - Remove if target is gone (dead/removed).
   * - On hit (distance < HIT_THRESHOLD): deal damage, remove projectile.
   */
  update(dt: number, state: GameState): void {
    const toRemove = new Set<number>();

    for (const proj of state.projectiles) {
      // Find target unit
      const target = state.units.find((u) => u.id === proj.targetUnitId);

      // Target gone — remove projectile
      if (!target) {
        toRemove.add(proj.id);
        continue;
      }

      // Vector toward target's current position
      const dx = target.wx - proj.wx;
      const dy = target.wy - proj.wy;
      const dist = Math.hypot(dx, dy);

      // Hit check first (before moving — handles very close targets)
      if (dist < HIT_THRESHOLD) {
        target.hp -= proj.damage;
        toRemove.add(proj.id);
        continue;
      }

      // Move projectile along direction vector
      const move = proj.speed * dt;
      const ratio = move / dist;
      proj.wx += dx * ratio;
      proj.wy += dy * ratio;

      // Hit check after moving
      const newDx = target.wx - proj.wx;
      const newDy = target.wy - proj.wy;
      const newDist = Math.hypot(newDx, newDy);
      if (newDist < HIT_THRESHOLD) {
        target.hp -= proj.damage;
        toRemove.add(proj.id);
      }
    }

    // Filter removed projectiles
    state.projectiles = state.projectiles.filter((p) => !toRemove.has(p.id));
  }
}
