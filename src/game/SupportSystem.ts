import type { BlockchainService } from '../blockchain/BlockchainService';
import { t } from '../i18n/localization';
import { getCurrentState } from '../wallet/WalletService';
import { registerKill } from './ResourceSystem';
import type { GameState, SupportAbilityKey, Unit } from './game.types';

const OVERDRIVE_DURATION = 12;
const OVERDRIVE_STRIKE_RADIUS = 78;
const OVERDRIVE_STRIKE_DAMAGE = 26;
const OVERDRIVE_STRIKE_INTERVAL = 0.75;
const OVERDRIVE_MARK_TTL = 1.35;
const SALVAGE_MODE_MIN_DRAIN = 15;
const SALVAGE_MODE_MAX_DRAIN = 25;
const SALVAGE_MODE_ATTACK_MULTIPLIER = 1.22;
const SALVAGE_MODE_DEFENSE_MULTIPLIER = 0.84;
const ORBITAL_DROP_RADIUS = 110;
const MISSILE_GRID_RADIUS = 78;
const MISSILE_GRID_DAMAGE = 52;
const SIEGE_LANCE_RADIUS = 44;
const SIEGE_LANCE_DAMAGE = 240;
const SUPPORT_COOLDOWNS_MS: Record<SupportAbilityKey, number> = {
  overdrive: 18_000,
  'orbital-drop': 24_000,
  'missile-grid': 16_000,
  'siege-lance': 20_000,
};

export const SUPPORT_SCHEMATIC_COSTS: Record<SupportAbilityKey, number> = {
  overdrive: 2,
  'orbital-drop': 6,
  'missile-grid': 4,
  'siege-lance': 5,
};

export type SupportActivationResult = {
  ok: boolean;
  message: string;
};

export type SupportTargetPoint = {
  wx: number;
  wy: number;
};

// Delay (seconds) from mark creation to actual damage — synced to the
// impact-flash peak in drawOrbitalSupportStrike (age ≈ 0.46 × 2.4 s ≈ 1.1 s).
const ORBITAL_IMPACT_DELAY = 1.1;

export function updateSupport(dt: number, state: GameState, blockchainService?: BlockchainService): void {
  for (const unit of state.units) {
    if (unit.faction !== 'ally') continue;
    unit.speedBuff = undefined;
    unit.attackBuff = undefined;
    unit.defenseBuff = undefined;
    unit.buffAura = undefined;
  }

  if (state.salvageModeActive) {
    const salvageTargets = state.units.filter((unit) =>
      unit.faction === 'ally' && unit.hp > 0 && unit.def.damage > 0,
    );
    const drainIntensity = Math.min(1, salvageTargets.length / 5);
    const drainPerSecond = SALVAGE_MODE_MIN_DRAIN + (SALVAGE_MODE_MAX_DRAIN - SALVAGE_MODE_MIN_DRAIN) * drainIntensity;
    const spent = Math.min(Math.max(0, state.resources), drainPerSecond * dt);
    state.resources = Math.max(0, state.resources - spent);

    if (state.resources <= 0) {
      state.salvageModeActive = false;
    } else {
      for (const unit of salvageTargets) {
        unit.attackBuff = Math.max(unit.attackBuff ?? 1, SALVAGE_MODE_ATTACK_MULTIPLIER);
        unit.defenseBuff = Math.min(unit.defenseBuff ?? 1, SALVAGE_MODE_DEFENSE_MULTIPLIER);
        unit.buffAura = unit.buffAura === 'overdrive' ? 'overdrive' : 'tower';
      }
    }
  }

  if ((state.supportOverdriveTimer ?? 0) > 0) {
    state.supportOverdriveTimer = Math.max(0, (state.supportOverdriveTimer ?? 0) - dt);
    state.supportOverdrivePulseTimer = Math.max(0, (state.supportOverdrivePulseTimer ?? 0) - dt);

    if ((state.supportOverdrivePulseTimer ?? 0) <= 0) {
      triggerOverdriveStrikes(state, blockchainService);
      state.supportOverdrivePulseTimer = OVERDRIVE_STRIKE_INTERVAL;
    }
  }

  if (!state.pendingOrbitalStrikes?.length) return;
  const remaining = [];
  for (const strike of state.pendingOrbitalStrikes) {
    strike.delay -= dt;
    if (strike.delay > 0) {
      remaining.push(strike);
      continue;
    }
    // Impact — apply lethal damage to everything in blast radius
    for (const unit of state.units) {
      if (unit.hp <= 0) continue;
      if (Math.hypot(unit.wx - strike.wx, unit.wy - strike.wy) > strike.radius) continue;
      applySupportDamage(unit, unit.hp + 999, state, blockchainService);
    }
  }
  state.pendingOrbitalStrikes = remaining;
}

export function isSupportReady(key: SupportAbilityKey, state: GameState): boolean {
  return getSupportCooldownRemaining(key, state) <= 0;
}

export function getSupportCooldownRemaining(key: SupportAbilityKey, state: GameState): number {
  const readyAt = state.supportCooldowns?.[key] ?? 0;
  return Math.max(0, readyAt - Date.now()) / 1000;
}

export function canActivateSupport(key: SupportAbilityKey, state: GameState): boolean {
  if (state.phase !== 'playing') return false;
  if ((state.schematics ?? 0) < SUPPORT_SCHEMATIC_COSTS[key]) return false;
  if (!isSupportReady(key, state)) return false;

  if (key === 'overdrive') {
    return state.units.some((unit) => unit.faction === 'enemy' && unit.hp > 0);
  }
  return true;
}

export function getSupportDamageMultiplier(state: GameState, unit: Unit): number {
  void state;
  return unit.attackBuff ?? 1;
}

export function activateSupport(
  key: SupportAbilityKey,
  state: GameState,
  blockchainService?: BlockchainService,
  targetPoint?: SupportTargetPoint,
): SupportActivationResult {
  if (state.phase !== 'playing') {
    return { ok: false, message: t('support.errors.phase') };
  }
  if ((state.schematics ?? 0) < SUPPORT_SCHEMATIC_COSTS[key]) {
    return { ok: false, message: t('support.errors.schematics') };
  }
  if (!isSupportReady(key, state)) {
    return {
      ok: false,
      message: t('support.errors.cooldown', { seconds: Math.ceil(getSupportCooldownRemaining(key, state)) }),
    };
  }

  const applied = executeSupport(key, state, blockchainService, targetPoint);
  if (!applied.ok) return applied;

  state.schematics = Math.max(0, (state.schematics ?? 0) - SUPPORT_SCHEMATIC_COSTS[key]);
  state.supportCooldowns ??= {
    overdrive: 0,
    'orbital-drop': 0,
    'missile-grid': 0,
    'siege-lance': 0,
  };
  state.supportCooldowns[key] = Date.now() + SUPPORT_COOLDOWNS_MS[key];
  return applied;
}

function executeSupport(
  key: SupportAbilityKey,
  state: GameState,
  blockchainService?: BlockchainService,
  targetPoint?: SupportTargetPoint,
): SupportActivationResult {
  if (key === 'overdrive') {
    state.supportOverdriveTimer = OVERDRIVE_DURATION;
    state.supportOverdrivePulseTimer = 0;
    return { ok: true, message: t('support.activation.overdrive') };
  }

  if (key === 'orbital-drop') {
    const center = targetPoint ?? findDensestEnemyCenter(state, ORBITAL_DROP_RADIUS * 0.92);
    if (!center) return { ok: false, message: t('support.errors.noTarget') };
    // Visual mark starts immediately — telegraph reticle shows the blast zone
    state.impactMarks ??= [];
    state.impactMarks.push({
      id: state.nextId++,
      wx: center.wx,
      wy: center.wy,
      radius: ORBITAL_DROP_RADIUS,
      ttl: 2.4,
      maxTtl: 2.4,
      source: 'support',
    });
    // Damage fires after the laser reaches the ground (~1.1 s into the animation)
    state.pendingOrbitalStrikes ??= [];
    state.pendingOrbitalStrikes.push({
      wx: center.wx,
      wy: center.wy,
      radius: ORBITAL_DROP_RADIUS,
      delay: ORBITAL_IMPACT_DELAY,
    });
    return { ok: true, message: t('support.activation.orbitalDrop') };
  }

  if (key === 'missile-grid') {
    const centers = targetPoint ? buildMissileCentersAroundPoint(targetPoint) : findMissileCenters(state, 3);
    if (centers.length === 0) return { ok: false, message: t('support.errors.noTarget') };
    state.impactMarks ??= [];
    for (const center of centers) {
      state.impactMarks.push({
        id: state.nextId++,
        wx: center.wx,
        wy: center.wy,
        radius: MISSILE_GRID_RADIUS,
        ttl: 2.1,
        maxTtl: 2.1,
        source: 'support',
      });
      for (const unit of state.units) {
        if (unit.faction !== 'enemy' || unit.hp <= 0) continue;
        if (Math.hypot(unit.wx - center.wx, unit.wy - center.wy) > MISSILE_GRID_RADIUS) continue;
        applySupportDamage(unit, MISSILE_GRID_DAMAGE, state, blockchainService);
      }
    }
    return { ok: true, message: t('support.activation.missileGrid') };
  }

  const target = targetPoint ?? findPriorityEnemy(state);
  if (!target) return { ok: false, message: t('support.errors.noTarget') };
  state.impactMarks ??= [];
  state.impactMarks.push({
    id: state.nextId++,
    wx: target.wx,
    wy: target.wy,
    radius: SIEGE_LANCE_RADIUS,
    ttl: 1.8,
    maxTtl: 1.8,
    source: 'support',
  });
  for (const unit of state.units) {
    if (unit.faction !== 'enemy' || unit.hp <= 0) continue;
    const distance = Math.hypot(unit.wx - target.wx, unit.wy - target.wy);
    if (distance > SIEGE_LANCE_RADIUS) continue;
    const falloff = unit.id === target.id ? 1 : Math.max(0.35, 1 - distance / SIEGE_LANCE_RADIUS);
    applySupportDamage(unit, SIEGE_LANCE_DAMAGE * falloff, state, blockchainService);
  }
  return { ok: true, message: t('support.activation.siegeLance') };
}

export function getSupportPreviewRadius(key: SupportAbilityKey): number {
  switch (key) {
    case 'orbital-drop':
      return ORBITAL_DROP_RADIUS;
    case 'missile-grid':
      return MISSILE_GRID_RADIUS;
    case 'siege-lance':
      return SIEGE_LANCE_RADIUS;
    default:
      return 0;
  }
}

function applySupportDamage(
  unit: Unit,
  amount: number,
  state: GameState,
  blockchainService?: BlockchainService,
): void {
  const hpBefore = unit.hp;
  unit.hp = Math.max(0, unit.hp - amount);
  if (unit.faction !== 'enemy' || hpBefore <= 0 || unit.hp > 0) return;

  const defKey = `${unit.def.role}-enemy`;
  registerKill(defKey, state, { wx: unit.wx, wy: unit.wy });
  const { publicKey } = getCurrentState();
  blockchainService?.recordKill(defKey, publicKey).catch(() => {});
}

function triggerOverdriveStrikes(state: GameState, blockchainService?: BlockchainService): void {
  const enemies = state.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0);
  if (enemies.length === 0) return;

  const primary = findDensestEnemyCenter(state, OVERDRIVE_STRIKE_RADIUS * 0.9);
  const targets = primary ? [primary] : [enemies[0]!];

  if (enemies.length > 3) {
    const secondary = enemies
      .filter((enemy) => Math.hypot(enemy.wx - targets[0]!.wx, enemy.wy - targets[0]!.wy) > OVERDRIVE_STRIKE_RADIUS * 1.2)
      .sort((a, b) => b.hp - a.hp)[0];
    if (secondary) targets.push(secondary);
  }

  state.impactMarks ??= [];
  for (const target of targets) {
    state.impactMarks.push({
      id: state.nextId++,
      wx: target.wx,
      wy: target.wy,
      radius: OVERDRIVE_STRIKE_RADIUS,
      ttl: OVERDRIVE_MARK_TTL,
      maxTtl: OVERDRIVE_MARK_TTL,
      source: 'support',
    });
    for (const enemy of state.units) {
      if (enemy.faction !== 'enemy' || enemy.hp <= 0) continue;
      if (Math.hypot(enemy.wx - target.wx, enemy.wy - target.wy) > OVERDRIVE_STRIKE_RADIUS) continue;
      applySupportDamage(enemy, OVERDRIVE_STRIKE_DAMAGE, state, blockchainService);
    }
  }
}

function findPriorityEnemy(state: GameState): Unit | null {
  const enemies = state.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0);
  if (enemies.length === 0) return null;
  return enemies.reduce((best, current) => {
    if (current.def.role === 'boss' && best.def.role !== 'boss') return current;
    if (current.def.role !== 'boss' && best.def.role === 'boss') return best;
    if (current.hp > best.hp) return current;
    return best;
  });
}

function findDensestEnemyCenter(state: GameState, radius: number): Unit | null {
  const enemies = state.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0);
  if (enemies.length === 0) return null;

  let best = enemies[0] ?? null;
  let bestScore = -1;
  for (const candidate of enemies) {
    let score = 0;
    for (const enemy of enemies) {
      const distance = Math.hypot(enemy.wx - candidate.wx, enemy.wy - candidate.wy);
      if (distance <= radius) {
        score += enemy.def.role === 'boss' ? 6 : enemy.def.role === 'heavy' ? 3 : enemy.def.role === 'ranged' ? 2 : 1;
      }
    }
    if (score > bestScore || (score === bestScore && candidate.hp > (best?.hp ?? 0))) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function findMissileCenters(state: GameState, maxCount: number): Unit[] {
  const enemies = state.units.filter((unit) => unit.faction === 'enemy' && unit.hp > 0);
  const centers: Unit[] = [];
  const used = new Set<number>();
  while (centers.length < maxCount) {
    const center = findDensestEnemyCenter(
      {
        ...state,
        units: enemies.filter((enemy) => !used.has(enemy.id)),
      },
      MISSILE_GRID_RADIUS * 0.95,
    );
    if (!center) break;
    centers.push(center);
    for (const enemy of enemies) {
      if (Math.hypot(enemy.wx - center.wx, enemy.wy - center.wy) <= MISSILE_GRID_RADIUS * 0.7) {
        used.add(enemy.id);
      }
    }
  }
  return centers;
}

function buildMissileCentersAroundPoint(target: SupportTargetPoint): SupportTargetPoint[] {
  return [
    { wx: target.wx, wy: target.wy },
    { wx: target.wx - 32, wy: target.wy + 18 },
    { wx: target.wx + 32, wy: target.wy - 18 },
  ];
}
