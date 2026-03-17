import type { GameState } from './game.types';

// Kill drop values (locked in 03-03-PLAN.md)
const KILL_DROPS: Record<string, number> = {
  'light-enemy': 5,
  'heavy-enemy': 15,
  'ranged-enemy': 10,
};

export class ResourceSystem {
  /**
   * Accumulate passive electrolatov income from all buildings each frame.
   * Each building contributes building.resourceRate * dt electrolatov.
   */
  update(dt: number, state: GameState): void {
    for (const building of state.buildings) {
      state.resources += building.resourceRate * dt;
    }
  }
}

/**
 * Register a unit kill and award the corresponding electrolatov drop.
 * Called by CombatSystem (Plan 04) when a unit's hp drops to 0.
 *
 * @param defKey - unit definition key (e.g. 'light-enemy', 'heavy-enemy', 'ranged-enemy')
 * @param state - mutable GameState to credit resources to
 */
export function registerKill(defKey: string, state: GameState): void {
  const drop = KILL_DROPS[defKey] ?? 0;
  state.resources += drop;
}
