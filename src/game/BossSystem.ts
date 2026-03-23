import type { GameState, Unit } from './game.types';
import { NegotiationOverlay } from '../screens/NegotiationOverlay';

export const NEGOTIATION_RESOURCE_REWARD = 120;
export const NEGOTIATION_HP_REWARD = 400;
export const NEGOTIATION_WAVE_TIMER_FLOOR = 20;
export const HORDE_POWER_SCALE = 1.4;

/** Counts of each unit type spawned in the failure horde. */
const HORDE_COMPOSITION: Record<string, number> = {
  'light-enemy': 12,
  'heavy-enemy': 6,
  'ranged-enemy': 4,
};

const HORDE_FIRST_DELAY = 1.0;
const HORDE_DELAY_STEP = 0.4;

/**
 * BossSystem — owns the entire negotiation lifecycle.
 *
 * Usage in the rAF loop:
 *   bossSystem.update(dt, state, overlayContainer);
 *
 * Callbacks from NegotiationOverlay call:
 *   bossSystem.handleSuccess(state) — success path
 *   bossSystem.handleFailure(state, boss) — failure path
 *
 * On screen unmount:
 *   bossSystem.forceReset(state)
 */
export class BossSystem {
  private overlay: NegotiationOverlay | null = null;
  private negotiationActive = false;

  /**
   * Called each game tick.
   * Detects a living unenraged boss and, if not yet triggered, freezes the
   * game phase to 'negotiation' and mounts the NegotiationOverlay.
   */
  update(dt: number, state: GameState, container: HTMLElement | null): void {
    // Only act when the game is actively playing
    if (state.phase !== 'playing') return;
    // Never re-trigger if negotiation has already fired this session
    if (state.bossNegotiation?.triggered) return;

    const boss = state.units.find(
      u => u.def.role === 'boss'
        && u.faction === 'enemy'
        && u.hp > 0
        && !u.def.enraged,
    );
    if (!boss) return;

    // Freeze boss in place before mounting overlay
    boss.state = 'fighting';
    boss.fightingWith = null;

    state.phase = 'negotiation';
    state.bossNegotiation = { active: true, triggered: true };
    this.negotiationActive = true;

    if (container) {
      this.overlay = new NegotiationOverlay();
      this.overlay.mount(container, {
        onSuccess: () => this.handleSuccess(state),
        onFailure: () => this.handleFailure(state, boss),
      });
    }
  }

  /**
   * Success path (BOSS-03):
   * - Removes boss from units
   * - Credits resources and heals citadel
   * - Ensures wave timer has at least NEGOTIATION_WAVE_TIMER_FLOOR seconds left
   * - Restores game phase to 'playing'
   */
  handleSuccess(state: GameState): void {
    // Remove boss unit
    state.units = state.units.filter(
      u => !(u.def.role === 'boss' && u.faction === 'enemy'),
    );

    // Reward player
    state.resources += NEGOTIATION_RESOURCE_REWARD;
    state.citadelHp = Math.min(state.citadelMaxHp, state.citadelHp + NEGOTIATION_HP_REWARD);
    state.waveTimer = Math.max(state.waveTimer, NEGOTIATION_WAVE_TIMER_FLOOR);

    state.phase = 'playing';
    state.bossNegotiation = { active: false, triggered: true, outcome: 'success' };

    this.cleanup();
  }

  /**
   * Failure path (BOSS-04):
   * - Enrages the boss (1.5x damage)
   * - Pushes a punishment horde into spawnQueue
   * - Restores game phase to 'playing'
   */
  handleFailure(state: GameState, boss: Unit): void {
    // Enrage boss — mutate def in place (def is a plain object reference)
    boss.def = {
      ...boss.def,
      enraged: true,
      damage: Math.round(boss.def.damage * 1.5),
    };

    this.enqueueHorde(state);

    state.phase = 'playing';
    state.bossNegotiation = { active: false, triggered: true, outcome: 'failure' };

    this.cleanup();
  }

  /**
   * Safe cleanup on screen unmount — prevents dangling overlay or frozen phase.
   */
  forceReset(state: GameState): void {
    this.cleanup();
    if (state.phase === 'negotiation') {
      state.phase = 'playing';
    }
    if (state.bossNegotiation?.active) {
      state.bossNegotiation = { ...state.bossNegotiation, active: false };
    }
    this.negotiationActive = false;
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
          powerScale: HORDE_POWER_SCALE,
        });
        delayAcc += HORDE_DELAY_STEP;
      }
    }
  }

  private cleanup(): void {
    this.overlay?.unmount();
    this.overlay = null;
    this.negotiationActive = false;
  }
}
