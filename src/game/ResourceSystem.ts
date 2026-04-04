import type { GameState } from './game.types';

// Kill drop values (locked in 03-03-PLAN.md)
const KILL_DROPS: Record<string, number> = {
  'light-enemy': 5,
  'heavy-enemy': 15,
  'ranged-enemy': 10,
  'boss-enemy': 80,
};
const LATFA_DROPS: Record<string, number> = {
  'light-enemy': 1,
  'heavy-enemy': 2,
  'ranged-enemy': 2,
  'boss-enemy': 8,
};
const SCHEMATIC_DROPS: Partial<Record<string, { chance: number; value: number }>> = {
  'light-enemy': { chance: 0.12, value: 1 },
  'heavy-enemy': { chance: 0.45, value: 1 },
  'ranged-enemy': { chance: 0.38, value: 1 },
  'boss-enemy': { chance: 1, value: 3 },
};
const COLLECTOR_PROCESS_RATE = 12;
const CITADEL_BASE_ENERGY_RATE = 20;

export class ResourceSystem {
  /**
   * Accumulate passive electrolatov income from all buildings each frame.
   * Each building contributes building.resourceRate * dt electrolatov.
   */
  update(dt: number, state: GameState): void {
    state.resources += CITADEL_BASE_ENERGY_RATE * dt;

    for (const building of state.buildings) {
      state.resources += building.resourceRate * dt;
    }

    const collectorCount = state.units.filter(
      (unit) => unit.faction === 'ally' && unit.def.role === 'collector' && unit.hp > 0,
    ).length;
    const storedCrystals = state.crystals ?? 0;
    if (collectorCount <= 0 || storedCrystals <= 0) return;

    const processed = Math.min(storedCrystals, collectorCount * COLLECTOR_PROCESS_RATE * dt);
    state.crystals = storedCrystals - processed;
    state.resources += processed;
  }
}

/**
 * Register a unit kill and award the corresponding salvage drop.
 * Called by CombatSystem (Plan 04) when a unit's hp drops to 0.
 *
 * @param defKey - unit definition key (e.g. 'light-enemy', 'heavy-enemy', 'ranged-enemy')
 * @param state - mutable GameState to credit crystals to
 */
export function registerKill(
  defKey: string,
  state: GameState,
  dropPosition?: { wx: number; wy: number },
): void {
  const drop = KILL_DROPS[defKey] ?? 0;
  state.crystals = (state.crystals ?? 0) + drop;

  const latfaDrop = LATFA_DROPS[defKey] ?? 0;
  if (latfaDrop > 0 && dropPosition) {
    state.latfaDrops ??= [];
    state.latfaDrops.push({
      id: state.nextId++,
      wx: dropPosition.wx,
      wy: dropPosition.wy,
      value: latfaDrop,
      kind: 'latfa',
    });
  }

  const schematicDrop = resolveSchematicDrop(defKey, state, dropPosition);
  if (schematicDrop > 0 && dropPosition) {
    state.latfaDrops ??= [];
    state.latfaDrops.push({
      id: state.nextId++,
      wx: dropPosition.wx + 10,
      wy: dropPosition.wy - 10,
      value: schematicDrop,
      kind: 'schematic',
    });
  }
}

function resolveSchematicDrop(
  defKey: string,
  state: GameState,
  dropPosition?: { wx: number; wy: number },
): number {
  const rule = SCHEMATIC_DROPS[defKey];
  if (!rule || !dropPosition) return 0;
  if (rule.chance >= 1) return rule.value;

  const seed = Math.abs(
    Math.sin(
      dropPosition.wx * 0.013
      + dropPosition.wy * 0.017
      + state.waveNumber * 0.61
      + state.nextId * 0.19,
    ),
  );
  return seed <= rule.chance ? rule.value : 0;
}
