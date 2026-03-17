import { registerKill } from './ResourceSystem';
import type { GameState } from './game.types';

const COLLISION_RADIUS = 32; // world units — half of tileWidth=64
const MAX_WAVES = 5;

export class CombatSystem {
  /**
   * Main update — call order in game loop: last, after all other systems.
   * Early-returns if phase is not 'playing'.
   */
  update(dt: number, state: GameState): void {
    if (state.phase !== 'playing') return;

    this.resolveCollisions(state);
    this.tickFighting(dt, state);
    this.tickBaseAttacks(dt, state);
    this.checkWinLoss(state);
  }

  // ─── Collision detection ────────────────────────────────────────────────

  /**
   * O(n²) scan of enemy/ally pairs.
   * Unit counts are small (max ~60 units per frame — see PLAN notes).
   * Pairs already fighting are skipped (opponent-alive check handled in tickFighting).
   */
  private resolveCollisions(state: GameState): void {
    const enemies = state.units.filter(u => u.faction === 'enemy' && u.state === 'moving' && u.hp > 0);
    const allies  = state.units.filter(u => u.faction === 'ally'  && u.state === 'moving' && u.hp > 0);

    for (const enemy of enemies) {
      for (const ally of allies) {
        const dx = enemy.wx - ally.wx;
        const dy = enemy.wy - ally.wy;
        if (Math.hypot(dx, dy) < COLLISION_RADIUS) {
          enemy.state = 'fighting';
          enemy.fightingWith = ally.id;
          ally.state = 'fighting';
          ally.fightingWith = enemy.id;
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
    const fighting = state.units.filter(u => u.state === 'fighting' && u.hp > 0);

    // Pass 1: check opponent alive / resume moving
    for (const unit of fighting) {
      const opponent = state.units.find(u => u.id === unit.fightingWith);

      // Opponent is gone (already killed this frame or removed) — resume moving
      if (!opponent || opponent.hp <= 0) {
        unit.state = 'moving';
        unit.fightingWith = null;
      }
    }

    // Pass 2: decrement cooldown, then deal damage for units still fighting
    const stillFighting = state.units.filter(u => u.state === 'fighting' && u.hp > 0);

    for (const unit of stillFighting) {
      // Decrement cooldown
      unit.attackCooldown -= dt;

      // Deal damage when cooldown expires
      if (unit.attackCooldown <= 0) {
        const opponent = state.units.find(u => u.id === unit.fightingWith)!;
        opponent.hp -= unit.def.damage;
        // Reset cooldown, consuming remaining negative time (dt remainder pattern)
        // Result: 1/attackRate + current (negative) attackCooldown = 1/rate - dt_remainder
        unit.attackCooldown += 1 / unit.def.attackRate;

        // Award resources immediately when enemy hp drops to 0
        if (opponent.hp <= 0 && opponent.faction === 'enemy') {
          const defKey = `${opponent.def.role}-enemy`;
          registerKill(defKey, state);
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
      attacker.attackCooldown -= dt;

      if (attacker.attackCooldown <= 0) {
        state.citadelHp = Math.max(0, state.citadelHp - attacker.def.damage);
        attacker.attackCooldown = 1 / attacker.def.attackRate;
      }
    }
  }

  // ─── Win / loss checks ──────────────────────────────────────────────────

  /**
   * Win: all waves exhausted, spawn queue empty, no living enemies.
   * Loss: citadel hp at 0.
   * Phase transitions are ONLY made here.
   */
  private checkWinLoss(state: GameState): void {
    if (state.citadelHp <= 0) {
      state.phase = 'lost';
      return;
    }

    const livingEnemies = state.units.filter(u => u.faction === 'enemy' && u.hp > 0);
    if (
      state.waveNumber >= MAX_WAVES &&
      state.spawnQueue.length === 0 &&
      livingEnemies.length === 0
    ) {
      state.phase = 'won';
    }
  }
}
