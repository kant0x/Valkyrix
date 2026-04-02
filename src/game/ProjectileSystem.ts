import { registerKill } from './ResourceSystem';
import type { GameState } from './game.types';
import { getCurrentState } from '../wallet/WalletService';
import type { BlockchainService } from '../blockchain/BlockchainService';
import { getIncomingDamageMultiplier } from './UnitDefense';

// Distance threshold for a projectile to count as "hit"
const HIT_THRESHOLD = 8; // world units
const IMPACT_MARK_TTL = 2.6;
const CYBERNETIC_DODGE_INTERVAL = 1.1;

export class ProjectileSystem {
  private blockchainService?: BlockchainService;

  setBlockchainService(service: BlockchainService): void {
    this.blockchainService = service;
  }

  /**
   * Update all projectiles each frame:
   * - Move each projectile toward its tracked aim point.
   * - Bolt projectiles keep flying to their last known aim even if the target dies.
   * - On hit (distance < HIT_THRESHOLD): deal damage, remove projectile.
   */
  update(dt: number, state: GameState): void {
    this.tickImpactMarks(dt, state);
    const toRemove = new Set<number>();

    for (const proj of state.projectiles) {
      if (proj.kind === 'beam') {
        this.updateBeam(proj, dt, state, toRemove);
        continue;
      }

      const isFireAndForget = proj.source === 'ranged-unit';
      // Ranged-unit bolts snapshot their aim at fire time and then keep a straight
      // trajectory. They should not curve in flight.
      const target = state.units.find((u) => u.id === proj.targetUnitId && u.hp > 0);
      if (target && !isFireAndForget) {
        proj.aimWx = target.wx;
        proj.aimWy = target.wy;
      }

      if (isFireAndForget && target && (proj.aimWx === undefined || proj.aimWy === undefined)) {
        proj.aimWx = target.wx;
        proj.aimWy = target.wy;
      }

      if (proj.aimWx === undefined || proj.aimWy === undefined) {
        toRemove.add(proj.id);
        continue;
      }

      const dx = proj.aimWx - proj.wx;
      const dy = proj.aimWy - proj.wy;
      const dist = Math.hypot(dx, dy);

      const hitThreshold = proj.source === 'ranged-unit' ? 3 : HIT_THRESHOLD;

      if (dist < hitThreshold) {
        if (target) {
          this.applyProjectileDamage(target, proj.damage, state);
        }
        this.spawnImpactMark(proj.aimWx, proj.aimWy, proj.source, state);
        toRemove.add(proj.id);
        continue;
      }

      const move = Math.min(proj.speed * dt, dist);
      const ratio = move / dist;
      proj.wx += dx * ratio;
      proj.wy += dy * ratio;

      const newDx = proj.aimWx - proj.wx;
      const newDy = proj.aimWy - proj.wy;
      const newDist = Math.hypot(newDx, newDy);
      if (newDist < hitThreshold) {
        if (target) {
          this.applyProjectileDamage(target, proj.damage, state);
        }
        this.spawnImpactMark(proj.aimWx, proj.aimWy, proj.source, state);
        toRemove.add(proj.id);
      }
    }

    state.projectiles = state.projectiles.filter((p) => !toRemove.has(p.id));
  }

  private tickImpactMarks(dt: number, state: GameState): void {
    state.impactMarks ??= [];
    for (const mark of state.impactMarks) {
      mark.ttl -= dt;
    }
    state.impactMarks = state.impactMarks.filter((mark) => mark.ttl > 0);
  }

  private updateBeam(
    proj: GameState['projectiles'][number],
    dt: number,
    state: GameState,
    toRemove: Set<number>,
  ): void {
    if (proj.ownerBuildingId) {
      const owner = state.buildings.find((bldg) => bldg.id === proj.ownerBuildingId);
      if (!owner) {
        toRemove.add(proj.id);
        return;
      }
      proj.wx = owner.wx;
      proj.wy = owner.wy;
    }

    const target = state.units.find((u) => u.id === proj.targetUnitId && u.hp > 0);
    if (!target) {
      toRemove.add(proj.id);
      return;
    }

    const follow = 1 - Math.exp(-(proj.turnRate ?? 8) * dt);
    proj.aimWx = proj.aimWx === undefined ? target.wx : proj.aimWx + (target.wx - proj.aimWx) * follow;
    proj.aimWy = proj.aimWy === undefined ? target.wy : proj.aimWy + (target.wy - proj.aimWy) * follow;
    this.applyProjectileDamage(target, proj.damage * dt, state);
  }

  private applyProjectileDamage(
    target: GameState['units'][number],
    amount: number,
    state: GameState,
  ): void {
    if (this.tryCyberneticDodge(target)) {
      return;
    }
    const hpBefore = target.hp;
    const finalDamage = amount * getIncomingDamageMultiplier(target);
    target.hp = Math.max(0, target.hp - finalDamage);
    if (target.faction === 'enemy' && hpBefore > 0 && target.hp <= 0) {
      const defKey = `${target.def.role}-enemy`;
      registerKill(defKey, state, { wx: target.wx, wy: target.wy });
      const { publicKey } = getCurrentState();
      this.blockchainService?.recordKill(defKey, publicKey).catch(() => {});
      if (target.def.role === 'boss' && state.bossNegotiation?.triggered && state.bossNegotiation?.outcome !== 'success') {
        this.blockchainService?.recordBossOutcome('killed', publicKey).catch(() => {});
      }
    }
  }

  private tryCyberneticDodge(target: GameState['units'][number]): boolean {
    if (target.faction !== 'ally' || target.def.sprite !== 'cybernetic') return false;
    if ((target.spawnShield ?? 0) > 0) return false;
    if ((target.dodgeCooldown ?? 0) > 0) return false;
    target.dodgeCooldown = CYBERNETIC_DODGE_INTERVAL;
    return true;
  }

  private spawnImpactMark(
    wx: number,
    wy: number,
    source: GameState['projectiles'][number]['source'],
    state: GameState,
  ): void {
    state.impactMarks ??= [];
    const isCitadel = source === 'citadel';
    state.impactMarks.push({
      id: state.nextId++,
      wx,
      wy,
      radius: isCitadel ? 18 : 10,
      ttl: IMPACT_MARK_TTL,
      maxTtl: IMPACT_MARK_TTL,
      source,
    });
  }
}
