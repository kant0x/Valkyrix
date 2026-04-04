import type { Unit } from './game.types';

export const CYBERNETIC_DROP_DAMAGE_FACTOR = 0.35;
export const COLLECTOR_GUARD_DURATION = 15;
export const COLLECTOR_GUARD_TRIGGER_RADIUS = 72;
export const COLLECTOR_GUARD_DAMAGE_FACTOR = 0.22;

export function getIncomingDamageMultiplier(target: Pick<Unit, 'faction' | 'def' | 'spawnShield' | 'collectorShield' | 'defenseBuff'>): number {
  const combatBuff = target.faction === 'ally' ? (target.defenseBuff ?? 1) : 1;
  if (target.faction !== 'ally') return 1;
  if (target.def.sprite === 'cybernetic' && (target.spawnShield ?? 0) > 0) {
    return CYBERNETIC_DROP_DAMAGE_FACTOR * combatBuff;
  }
  if (target.def.sprite === 'collector' && (target.collectorShield ?? 0) > 0) {
    return COLLECTOR_GUARD_DAMAGE_FACTOR * combatBuff;
  }
  return combatBuff;
}
