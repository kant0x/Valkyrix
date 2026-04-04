import { UNIT_DEFS, type GameState, type Unit } from '../game/game.types';

// TEMPORARY DEBUG HOOK.
// Purpose: spawn a dense pack of enemies around the citadel so we can quickly
// verify citadel orbs, projectile origins, portal/citadel combat visuals, and
// general battlefield readability.
//
// Delete this file and the import/call site in main.ts after testing.

const TEMP_CITADEL_STRESS_COUNT = 20;
const TEMP_CITADEL_RING_RADIUS = 88;

export function applyTempCitadelStress(state: GameState): void {
  const citadel = state.pathNodes[state.pathNodes.length - 1];
  if (!citadel) return;

  const def = UNIT_DEFS['light-enemy'];
  if (!def) return;

  for (let i = 0; i < TEMP_CITADEL_STRESS_COUNT; i += 1) {
    const angle = (i / TEMP_CITADEL_STRESS_COUNT) * Math.PI * 2;
    const ringRadius = TEMP_CITADEL_RING_RADIUS + (i % 4) * 10;
    const wobble = ((i % 3) - 1) * 6;

    const unit: Unit = {
      id: state.nextId++,
      def,
      faction: def.faction,
      hp: def.hp,
      pathIndex: Math.max(0, state.pathNodes.length - 1),
      pathT: 0,
      wx: citadel.wx + Math.cos(angle) * ringRadius,
      wy: citadel.wy + Math.sin(angle) * (ringRadius * 0.65) + wobble,
      state: 'attacking-base',
      fightingWith: null,
      attackCooldown: 0.2 + (i % 5) * 0.08,
      laneOffset: 0,
    };

    state.units.push(unit);
  }
}
