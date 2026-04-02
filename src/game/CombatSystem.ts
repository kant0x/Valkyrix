import { registerKill } from './ResourceSystem';
import { getSupportDamageMultiplier } from './SupportSystem';
import type { GameState } from './game.types';
import { getCurrentState } from '../wallet/WalletService';
import type { BlockchainService } from '../blockchain/BlockchainService';
import { getIncomingDamageMultiplier } from './UnitDefense';

const COLLISION_RADIUS = 32; // world units — half of tileWidth=64
const NEAREST_MELEE_PULL_RADIUS = 60;
const MELEE_CONTACT_DISTANCE = 16;
const MAX_WAVES = 5;
const CYBERNETIC_DODGE_INTERVAL = 1.1;
const MELEE_SWING_FRACTION = 0.42;
const MELEE_SWING_MIN = 0.22;
const MELEE_SWING_MAX = 0.5;
const MELEE_HIT_PROGRESS = 0.58;
export const RANGED_FIRING_FLASH_DURATION = 0.5;

export class CombatSystem {
  private blockchainService?: BlockchainService;

  setBlockchainService(service: BlockchainService): void {
    this.blockchainService = service;
  }

  /**
   * Main update — call order in game loop: last, after all other systems.
   * Early-returns if phase is not 'playing'.
   */
  update(dt: number, state: GameState): void {
    if (state.phase !== 'playing') return;

    for (const unit of state.units) {
      if ((unit.dodgeCooldown ?? 0) > 0) {
        unit.dodgeCooldown = Math.max(0, (unit.dodgeCooldown ?? 0) - dt);
      }
      if ((unit.spawnShield ?? 0) > 0) {
        unit.spawnShield = Math.max(0, (unit.spawnShield ?? 0) - dt);
      }
      if ((unit.collectorShield ?? 0) > 0) {
        unit.collectorShield = Math.max(0, (unit.collectorShield ?? 0) - dt);
      }
    }

    this.resolveCollisions(state);
    this.tickFighting(dt, state);
    this.tickBaseAttacks(dt, state);
    this.tickRangedEnemies(dt, state);
    this.checkWinLoss(state);
  }

  // ─── Collision detection ────────────────────────────────────────────────

  /**
   * O(n²) scan of enemy/ally pairs.
   * Unit counts are small (max ~60 units per frame — see PLAN notes).
   * Pairs already fighting are skipped (opponent-alive check handled in tickFighting).
   */
  private resolveCollisions(state: GameState): void {
    const meleeEnemies = state.units.filter(
      // Ranged enemies never enter melee — they shoot via tickRangedEnemies
      (u) => u.faction === 'enemy' && u.state === 'moving' && u.hp > 0 && u.def.damage > 0 && u.def.attackRate > 0 && !u.def.attackRange,
    );
    const allyTargetableEnemies = state.units.filter(
      (u) =>
        u.faction === 'enemy' &&
        u.hp > 0 &&
        u.def.damage > 0 &&
        u.def.attackRate > 0 &&
        (u.state === 'moving' || u.state === 'fighting'),
    );
    const allies = state.units.filter(
      (u) => u.faction === 'ally' && u.state === 'moving' && u.hp > 0 && u.def.damage > 0 && u.def.attackRate > 0,
    );

    // Each free enemy engages its closest ally within range.
    // The target may already be busy with another opponent — focus fire is allowed.
    for (const enemy of meleeEnemies) {
      if (enemy.state !== 'moving') continue;
      let closestAlly: typeof allies[number] | null = null;
      let closestDist = NEAREST_MELEE_PULL_RADIUS;
      for (const ally of allies) {
        const d = Math.hypot(enemy.wx - ally.wx, enemy.wy - ally.wy);
        if (d < closestDist) { closestDist = d; closestAlly = ally; }
      }
      if (closestAlly) this.engageUnits(enemy, closestAlly);
    }

    // Each free ally also initiates against the closest enemy within range.
    // Multiple allies may collapse onto the same enemy instead of being forced into 1v1 pairs.
    for (const ally of allies) {
      if (ally.state !== 'moving') continue;
      let closestEnemy: typeof allyTargetableEnemies[number] | null = null;
      let closestDist = NEAREST_MELEE_PULL_RADIUS;
      for (const enemy of allyTargetableEnemies) {
        const targetableNow = enemy.state === 'moving' || enemy.state === 'fighting';
        if (!targetableNow) continue;
        const d = Math.hypot(ally.wx - enemy.wx, ally.wy - enemy.wy);
        if (d < closestDist) { closestDist = d; closestEnemy = enemy; }
      }
      if (closestEnemy) this.engageUnits(closestEnemy, ally);
    }

    // Melee enemies that walk into a building engage it (negative fightingWith = building id)
    for (const enemy of meleeEnemies) {
      if (enemy.state !== 'moving') continue;
      for (const bldg of state.buildings) {
        if (bldg.hp <= 0) continue;
        if (Math.hypot(enemy.wx - bldg.wx, enemy.wy - bldg.wy) < COLLISION_RADIUS) {
          enemy.state = 'fighting';
          enemy.fightingWith = -bldg.id;
          break;
        }
      }
    }
  }

  // ─── Combat tick ────────────────────────────────────────────────────────

  /**
   * Decrement cooldowns for all fighting units and deal damage when ready.
   * Sets hp = 0 on killed units — UnitSystem removes them next frame.
   * Calls registerKill for slain enemies.
   * Resumes winner to 'moving' when opponent is gone.
   */
  private tickFighting(dt: number, state: GameState): void {
    // Ranged units manage their own state in tickRangedEnemies
    const isMelee = (u: GameState['units'][number]) => !u.def.attackRange;
    const fighting = state.units.filter(u => u.state === 'fighting' && u.hp > 0 && isMelee(u));

    // Pass 1: check opponent/building alive / resume moving
    for (const unit of fighting) {
      const fw = unit.fightingWith;
      if (fw === null) { unit.state = 'moving'; continue; }

      if (fw < 0) {
        // Fighting a building — check it still lives
        if (!state.buildings.some(b => b.id === -fw && b.hp > 0)) {
          unit.state = 'moving';
          unit.fightingWith = null;
          this.clearMeleeSwing(unit);
        }
        continue;
      }

      // Fighting a unit
      const opponent = state.units.find(u => u.id === fw);
      if (!opponent || opponent.hp <= 0) {
        unit.state = 'moving';
        unit.fightingWith = null;
        this.clearMeleeSwing(unit);
      }
    }

    // Pass 3: approach opponent and deal damage
    const stillFighting = state.units.filter(u => u.state === 'fighting' && u.hp > 0 && isMelee(u));
    for (const unit of stillFighting) {
      if (this.tickMeleeSwing(unit, dt, state)) continue;

      // If fighting a unit (not a building), check contact distance first
      if ((unit.fightingWith ?? 0) > 0) {
        const opp = state.units.find(u2 => u2.id === unit.fightingWith);
        if (opp && opp.hp > 0) {
          const dist = Math.hypot(unit.wx - opp.wx, unit.wy - opp.wy);
          if (dist > MELEE_CONTACT_DISTANCE) {
            // UnitSystemRuntime already handles approach movement using the unit's real walk speed.
            // Here we only block the strike until the model is actually in contact.
            continue;
          }
        }
      }

      unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
      if (unit.attackCooldown > 0) continue;

      this.startMeleeSwing(unit);
    }

    // Purge destroyed buildings; release enemies that were fighting them
    state.buildings = state.buildings.filter(b => b.hp > 0);
    for (const unit of state.units) {
      if (unit.state === 'fighting' && (unit.fightingWith ?? 0) < 0) {
        if (!state.buildings.some(b => b.id === -(unit.fightingWith!))) {
          unit.state = 'moving';
          unit.fightingWith = null;
        }
      }
    }
  }

  // ─── Base attack tick ───────────────────────────────────────────────────

  /**
   * Enemies in 'attacking-base' state drain citadelHp.
   * Ally 'attacking-base' units are idle — Phase 5 concern.
   */
  private tickBaseAttacks(dt: number, state: GameState): void {
    const attackers = state.units.filter(
      u => u.state === 'attacking-base' && u.faction === 'enemy' && u.hp > 0,
    );

    for (const attacker of attackers) {
      if (this.tickBaseSwing(attacker, dt, state)) continue;

      attacker.attackCooldown = Math.max(0, attacker.attackCooldown - dt);
      if (attacker.attackCooldown > 0) continue;

      this.startMeleeSwing(attacker);
    }
  }

  // ─── Win / loss checks ──────────────────────────────────────────────────

  /**
   * Win: all waves exhausted, spawn queue empty, no living enemies.
   * Loss: citadel hp at 0.
   * Phase transitions are ONLY made here.
   */
  private checkWinLoss(state: GameState): void {
    if (state.citadelHp <= 0 && state.phase === 'playing') {
      state.phase = 'lost';
      const { publicKey } = getCurrentState();
      this.blockchainService?.recordGameOutcome('loss', publicKey).catch(() => {});
      return;
    }

    const livingEnemies = state.units.filter(u => u.faction === 'enemy' && u.hp > 0);
    if (
      state.phase === 'playing' &&
      state.waveNumber >= MAX_WAVES &&
      state.spawnQueue.length === 0 &&
      livingEnemies.length === 0
    ) {
      state.phase = 'won';
      const { publicKey } = getCurrentState();
      this.blockchainService?.recordGameOutcome('win', publicKey).catch(() => {});
    }
  }

  // ─── Ranged enemies ──────────────────────────────────────────────────────

  /**
   * Ranged enemies stop when an ally is in range, fire projectiles, resume moving when no target.
   */
  private tickRangedEnemies(dt: number, state: GameState): void {
    const ranged = state.units.filter(
      (u) => u.faction === 'enemy' && u.def.role === 'ranged' && u.hp > 0 && u.state !== 'attacking-base',
    );

    for (const unit of ranged) {
      if ((unit.firingFlash ?? 0) > 0) {
        unit.firingFlash = Math.max(0, unit.firingFlash! - dt);
      }
      unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);

      const range = unit.def.attackRange ?? 150;
      const allies = state.units.filter((a) => a.faction === 'ally' && a.hp > 0);
      let target: GameState['units'][number] | null = null;
      let closest = range;
      for (const ally of allies) {
        const d = Math.hypot(ally.wx - unit.wx, ally.wy - unit.wy);
        if (d < closest) {
          closest = d;
          target = ally;
        }
      }

      if (!target) {
        // No target in range — resume marching
        if (unit.state === 'fighting') {
          unit.state = 'moving';
          unit.fightingWith = null;
        }
        continue;
      }

      // Target found — stop and aim
      unit.state = 'fighting';
      unit.fightingWith = target.id;

      if (unit.attackCooldown > 0) continue;

      state.projectiles.push({
        id: state.nextId++,
        wx: unit.wx,
        wy: unit.wy,
        targetUnitId: target.id,
        aimWx: target.wx,
        aimWy: target.wy,
        speed: 280,
        damage: unit.def.damage,
        kind: 'bolt',
        source: 'ranged-unit',
        size: 4,
        turnRate: 10,
      });

      unit.attackCooldown = 1 / unit.def.attackRate;
      unit.firingFlash = RANGED_FIRING_FLASH_DURATION;
    }
  }

  private engageUnits(enemy: GameState['units'][number], ally: GameState['units'][number]): void {
    this.assignUnitTarget(enemy, ally);
    this.assignUnitTarget(ally, enemy);
  }

  private assignUnitTarget(
    attacker: GameState['units'][number],
    target: GameState['units'][number],
  ): void {
    attacker.state = 'fighting';
    attacker.fightingWith = target.id;

    if (target.state === 'moving') {
      target.state = 'fighting';
    }

    if (target.fightingWith === null || target.fightingWith === attacker.id) {
      target.fightingWith = attacker.id;
    }
  }

  private tightenMeleeSpacing(a: GameState['units'][number], b: GameState['units'][number]): void {
    // Ally holds position — only the enemy is pulled to contact distance.
    // This prevents allies from teleporting when engagement is triggered at range.
    if (a.faction !== b.faction) {
      const ally = a.faction === 'ally' ? a : b;
      const enemy = a.faction === 'enemy' ? a : b;
      let dx = enemy.wx - ally.wx;
      let dy = enemy.wy - ally.wy;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) { dx = 1; dy = 0; }
      else { dx /= len; dy /= len; }
      enemy.wx = ally.wx + dx * MELEE_CONTACT_DISTANCE;
      enemy.wy = ally.wy + dy * MELEE_CONTACT_DISTANCE;
      return;
    }

    let dx = a.wx - b.wx;
    let dy = a.wy - b.wy;
    let len = Math.hypot(dx, dy);
    if (len < 0.001) { dx = 1; dy = 0; len = 1; }
    const dirX = dx / len;
    const dirY = dy / len;
    const halfDistance = MELEE_CONTACT_DISTANCE / 2;
    const midX = (a.wx + b.wx) * 0.5;
    const midY = (a.wy + b.wy) * 0.5;
    a.wx = midX + dirX * halfDistance;
    a.wy = midY + dirY * halfDistance;
    b.wx = midX - dirX * halfDistance;
    b.wy = midY - dirY * halfDistance;
  }

  private tryCyberneticDodge(target: GameState['units'][number]): boolean {
    if (target.faction !== 'ally' || target.def.sprite !== 'cybernetic') return false;
    if ((target.spawnShield ?? 0) > 0) return false;
    if ((target.dodgeCooldown ?? 0) > 0) return false;
    target.dodgeCooldown = CYBERNETIC_DODGE_INTERVAL;
    return true;
  }

  private resolveIncomingDamage(target: GameState['units'][number], amount: number): number {
    return amount * getIncomingDamageMultiplier(target);
  }

  private resolveMeleeSwingDuration(unit: GameState['units'][number]): number {
    const cycle = 1 / Math.max(0.001, unit.def.attackRate);
    return Math.max(MELEE_SWING_MIN, Math.min(MELEE_SWING_MAX, cycle * MELEE_SWING_FRACTION));
  }

  private startMeleeSwing(unit: GameState['units'][number]): void {
    const duration = this.resolveMeleeSwingDuration(unit);
    unit.attackWindup = duration;
    unit.attackWindupTotal = duration;
    unit.attackStrikeApplied = false;
  }

  private clearMeleeSwing(unit: GameState['units'][number]): void {
    unit.attackWindup = undefined;
    unit.attackWindupTotal = undefined;
    unit.attackStrikeApplied = undefined;
  }

  private tickMeleeSwing(unit: GameState['units'][number], dt: number, state: GameState): boolean {
    if (unit.attackWindup === undefined || unit.attackWindupTotal === undefined) return false;

    const before = unit.attackWindup;
    const after = Math.max(0, before - dt);
    const hitThreshold = unit.attackWindupTotal * (1 - MELEE_HIT_PROGRESS);

    if (!unit.attackStrikeApplied && before > hitThreshold && after <= hitThreshold) {
      this.applyMeleeStrike(unit, state);
      unit.attackStrikeApplied = true;
    }

    unit.attackWindup = after;

    if (after <= 0) {
      this.clearMeleeSwing(unit);
      unit.attackCooldown += 1 / unit.def.attackRate;
    }

    return true;
  }

  private tickBaseSwing(attacker: GameState['units'][number], dt: number, state: GameState): boolean {
    if (attacker.attackWindup === undefined || attacker.attackWindupTotal === undefined) return false;

    const before = attacker.attackWindup;
    const after = Math.max(0, before - dt);
    const hitThreshold = attacker.attackWindupTotal * (1 - MELEE_HIT_PROGRESS);

    if (!attacker.attackStrikeApplied && before > hitThreshold && after <= hitThreshold) {
      state.citadelHp = Math.max(0, state.citadelHp - attacker.def.damage);
      attacker.attackStrikeApplied = true;
    }

    attacker.attackWindup = after;

    if (after <= 0) {
      this.clearMeleeSwing(attacker);
      attacker.attackCooldown = 1 / attacker.def.attackRate;
    }

    return true;
  }

  private applyMeleeStrike(unit: GameState['units'][number], state: GameState): void {
    const fw = unit.fightingWith;
    if (fw === null) return;

    if (fw < 0) {
      const bldg = state.buildings.find(b => b.id === -fw);
      if (bldg && bldg.hp > 0) {
        const damage = unit.def.damage * getSupportDamageMultiplier(state, unit);
        bldg.hp = Math.max(0, bldg.hp - damage);
      }
      return;
    }

    const opponent = state.units.find(u => u.id === fw);
    if (!opponent || opponent.hp <= 0) return;

    if (this.tryCyberneticDodge(opponent)) {
      return;
    }

    const damage = this.resolveIncomingDamage(opponent, unit.def.damage * getSupportDamageMultiplier(state, unit));
    opponent.hp -= damage;
    if (opponent.hp <= 0 && opponent.faction === 'enemy') {
      const defKey = `${opponent.def.role}-enemy`;
      registerKill(defKey, state, { wx: opponent.wx, wy: opponent.wy });
      const { publicKey } = getCurrentState();
      this.blockchainService?.recordKill(defKey, publicKey).catch(() => {});
      if (opponent.def.role === 'boss' && state.bossNegotiation?.triggered && state.bossNegotiation?.outcome !== 'success') {
        this.blockchainService?.recordBossOutcome('killed', publicKey).catch(() => {});
      }
    }
    if (opponent.hp <= 0 && opponent.faction === 'ally') {
      const allyDefKey = `${opponent.def.role}-ally`;
      const { publicKey } = getCurrentState();
      this.blockchainService?.recordKill(allyDefKey, publicKey).catch(() => {});
    }
  }
}
