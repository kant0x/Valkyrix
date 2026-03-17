import type { GameState } from './game.types';

/**
 * Wave escalation table.
 * Index 0 = wave 1 config, index 4+ = wave 5+ (last entry repeated).
 */
const WAVE_TABLE: Array<{ count: Record<string, number> }> = [
  { count: { 'light-enemy': 20 } },                                                   // wave 1
  { count: { 'light-enemy': 25 } },                                                   // wave 2
  { count: { 'light-enemy': 20, 'heavy-enemy': 5 } },                                 // wave 3
  { count: { 'light-enemy': 20, 'heavy-enemy': 8 } },                                 // wave 4
  { count: { 'light-enemy': 15, 'heavy-enemy': 10, 'ranged-enemy': 8 } },             // wave 5+
];

/** Seconds between waves per wave number (post-launch). */
const WAVE_INTERVALS: Record<number, number> = {
  1: 15,
  2: 13,
  3: 12,
  4: 11,
};

const DEFAULT_INTERVAL = 10;

export class WaveController {
  /**
   * Called each game tick. Decrements waveTimer; when it expires, enqueues
   * the next wave into state.spawnQueue and resets the timer.
   * Does nothing if state.phase !== 'playing'.
   */
  update(dt: number, state: GameState): void {
    if (state.phase !== 'playing') return;

    state.waveTimer -= dt;
    if (state.waveTimer > 0) return;

    state.waveNumber++;
    this.enqueueWave(state);
    state.waveTimer = this.nextInterval(state.waveNumber);
  }

  private enqueueWave(state: GameState): void {
    // Pick the wave config (wave 5+ reuse last entry)
    const tableIndex = Math.min(state.waveNumber - 1, WAVE_TABLE.length - 1);
    const config = WAVE_TABLE[tableIndex];

    let delayAcc = 0;
    for (const [defKey, count] of Object.entries(config.count)) {
      for (let i = 0; i < count; i++) {
        state.spawnQueue.push({ defKey, delay: delayAcc });
        delayAcc += 0.5;
      }
    }
  }

  private nextInterval(waveNumber: number): number {
    return WAVE_INTERVALS[waveNumber] ?? DEFAULT_INTERVAL;
  }
}
