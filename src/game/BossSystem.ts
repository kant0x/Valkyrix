import type { GameState, Unit } from './game.types';
import { UNIT_DEFS } from './game.types';
import { NegotiationOverlay } from '../screens/NegotiationOverlay';

const BOSS_TRIGGER_SECONDS = 300;
export const NEGOTIATION_RESOURCE_REWARD = 120;
export const NEGOTIATION_HP_REWARD = 400;
export const NEGOTIATION_WAVE_TIMER_FLOOR = 20;

/** Horde spawned on negotiation failure — NO light-enemy. */
const HORDE_COMPOSITION: Record<string, number> = {
  'heavy-enemy': 8,
  'ranged-enemy': 6,
};

const HORDE_FIRST_DELAY = 1.0;
const HORDE_DELAY_STEP = 0.4;

/**
 * BossSystem — owns the timer-based boss negotiation lifecycle.
 *
 * Usage in the rAF loop (phase === 'playing'):
 *   bossSystem.update(dt, state, overlayContainer);
 *
 * On screen unmount:
 *   bossSystem.forceReset(state)
 */
export class BossSystem {
  private overlay: NegotiationOverlay | null = null;

  /**
   * Called each game tick while phase === 'playing'.
   * Accumulates state.elapsed; triggers boss negotiation at >= 300 s.
   */
  update(dt: number, state: GameState, container: HTMLElement | null): void {
    // Accumulate elapsed time
    state.elapsed = (state.elapsed ?? 0) + dt;

    // Only trigger once per session
    if (state.bossNegotiation?.triggered) return;

    // Not time yet
    if (state.elapsed < BOSS_TRIGGER_SECONDS) return;

    // Spawn boss unit from UNIT_DEFS (spread — never mutate the constant)
    const bossDef = { ...UNIT_DEFS['boss-enemy'] };
    const bossUnit: Unit = {
      id: state.nextId++,
      def: bossDef,
      faction: 'enemy',
      hp: bossDef.hp,
      pathIndex: 0,
      pathT: 0,
      wx: state.pathNodes[0]?.wx ?? 0,
      wy: state.pathNodes[0]?.wy ?? 0,
      state: 'moving',
      fightingWith: null,
      attackCooldown: 0,
    };
    state.units.push(bossUnit);

    // Set negotiation state synchronously BEFORE overlay.mount() to prevent race
    state.phase = 'negotiation';
    state.bossNegotiation = {
      active: true,
      triggered: true,
      scale: 0,
      attemptsLeft: 3,
    };

    if (container) {
      this.overlay = new NegotiationOverlay();
      this.overlay.mount(container, {
        onSuccess: () => this.handleSuccess(state),
        onFailure: () => this.handleFailure(state),
        initialScale: state.bossNegotiation.scale,
        initialAttempts: state.bossNegotiation.attemptsLeft,
      });
    }
  }

  /**
   * Success path (BOSS-03):
   * - Removes boss from units
   * - Credits resources and heals citadel
   * - Ensures wave timer >= NEGOTIATION_WAVE_TIMER_FLOOR
   * - Restores game phase to 'playing'
   */
  handleSuccess(state: GameState): void {
    state.units = state.units.filter(
      u => !(u.def.role === 'boss' && u.faction === 'enemy'),
    );

    state.resources += NEGOTIATION_RESOURCE_REWARD;
    state.citadelHp = Math.min(state.citadelMaxHp, state.citadelHp + NEGOTIATION_HP_REWARD);
    state.waveTimer = Math.max(state.waveTimer, NEGOTIATION_WAVE_TIMER_FLOOR);

    state.phase = 'playing';
    if (state.bossNegotiation) {
      state.bossNegotiation = { ...state.bossNegotiation, active: false, outcome: 'success' };
    }

    this.cleanup();
  }

  /**
   * Failure path (BOSS-04):
   * - Enrages the boss (1.5x damage, spread-replace def)
   * - Pushes heavy/ranged horde into spawnQueue
   * - Restores game phase to 'playing'
   * - Boss stays on the field
   */
  handleFailure(state: GameState): void {
    const boss = state.units.find(u => u.def.role === 'boss' && u.faction === 'enemy');
    if (boss) {
      // Spread-replace def to avoid mutating any shared reference
      boss.def = {
        ...boss.def,
        enraged: true,
        damage: Math.round(boss.def.damage * 1.5),
      };
    }

    this.enqueueHorde(state);

    state.phase = 'playing';
    if (state.bossNegotiation) {
      state.bossNegotiation = { ...state.bossNegotiation, active: false, outcome: 'failure' };
    }

    this.cleanup();
  }

  /**
   * Safe cleanup on screen unmount — prevents dangling overlay or frozen phase.
   */
  forceReset(state: GameState): void {
    this.cleanup();
    if (state.bossNegotiation) {
      state.bossNegotiation = { active: false, triggered: false };
    }
    state.elapsed = 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private enqueueHorde(state: GameState): void {
    let delayAcc = HORDE_FIRST_DELAY;
    for (const [defKey, count] of Object.entries(HORDE_COMPOSITION)) {
      for (let i = 0; i < count; i += 1) {
        state.spawnQueue.push({
          defKey,
          delay: delayAcc,
        });
        delayAcc += HORDE_DELAY_STEP;
      }
    }
  }

  private cleanup(): void {
    this.overlay?.unmount();
    this.overlay = null;
  }
}
