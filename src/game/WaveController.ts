import type { GameState } from './game.types';
import type { BlockchainService } from '../blockchain/BlockchainService';
import { getCurrentState } from '../wallet/WalletService';

/**
 * Wave escalation table.
 * Index 0 = wave 1 config, index 4+ = wave 5+ (last entry repeated).
 */
const WAVE_TABLE: Array<{
  enemies: Record<string, number>;
  reinforcements?: Record<string, number>;
  boss?: Record<string, number>;
}> = [
  { enemies: { 'light-enemy': 12, 'ranged-enemy': 2 } },                                                                                              // wave 1
  { enemies: { 'light-enemy': 14, 'ranged-enemy': 4 }, reinforcements: { 'heavy-ally': 1 } },                                                        // wave 2
  { enemies: { 'light-enemy': 12, 'heavy-enemy': 4, 'ranged-enemy': 4 }, reinforcements: { 'heavy-ally': 1, 'light-ally': 1 } },                     // wave 3
  { enemies: { 'light-enemy': 12, 'heavy-enemy': 6, 'ranged-enemy': 5 }, reinforcements: { 'heavy-ally': 2 } },                                      // wave 4
  { enemies: { 'light-enemy': 10, 'heavy-enemy': 7, 'ranged-enemy': 6 }, reinforcements: { 'heavy-ally': 2 }, boss: { 'boss-enemy': 1 } },           // wave 5+
];

/** Seconds between waves per wave number (post-launch). */
const WAVE_INTERVALS: Record<number, number> = {
  1: 15,
  2: 13,
  3: 12,
  4: 11,
};

const DEFAULT_INTERVAL = 10;
const ENEMY_SPAWN_STEP = 0.5;
const ALLY_SPAWN_STEP = 0.35;
const RANGED_ENEMY_SPAWN_STEP = 1.35;

function enemyPowerScale(waveNumber: number, defKey: string): number {
  if (defKey === 'boss-enemy') {
    return 1.55 + Math.max(0, waveNumber - 5) * 0.08;
  }
  return 1 + Math.max(0, waveNumber - 1) * 0.1;
}

function allyPowerScale(waveNumber: number): number {
  return 1 + Math.max(0, waveNumber - 1) * 0.06;
}

export class WaveController {
  private blockchainService?: BlockchainService;

  setBlockchainService(service: BlockchainService): void {
    this.blockchainService = service;
  }

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
    const { publicKey } = getCurrentState();
    this.blockchainService?.recordWaveStart(state.waveNumber, publicKey).catch(() => {});
  }

  private enqueueWave(state: GameState): void {
    // Pick the wave config (wave 5+ reuse last entry)
    const tableIndex = Math.min(state.waveNumber - 1, WAVE_TABLE.length - 1);
    const config = WAVE_TABLE[tableIndex];

    let delayAcc = 0;
    for (const [defKey, count] of Object.entries(config.reinforcements ?? {})) {
      for (let i = 0; i < count; i++) {
        state.spawnQueue.push({
          defKey,
          delay: delayAcc,
          powerScale: allyPowerScale(state.waveNumber),
        });
        delayAcc += ALLY_SPAWN_STEP;
      }
    }

    if (delayAcc > 0) {
      delayAcc += 0.8;
    }

    const rangedEnemyCount = config.enemies['ranged-enemy'] ?? 0;
    const frontlinerEntries = Object.entries(config.enemies).filter(([defKey]) => defKey !== 'ranged-enemy');
    const frontlinerCount = frontlinerEntries.reduce((sum, [, count]) => sum + count, 0);
    const enemyWaveStartDelay = delayAcc;

    for (const [defKey, count] of frontlinerEntries) {
      for (let i = 0; i < count; i++) {
        state.spawnQueue.push({
          defKey,
          delay: delayAcc,
          powerScale: enemyPowerScale(state.waveNumber, defKey),
        });
        delayAcc += ENEMY_SPAWN_STEP;
      }
    }

    if (rangedEnemyCount > 0) {
      const meleeSpan = Math.max(ENEMY_SPAWN_STEP, frontlinerCount * ENEMY_SPAWN_STEP);
      const rangedStep = Math.max(
        RANGED_ENEMY_SPAWN_STEP,
        meleeSpan / Math.max(1, rangedEnemyCount - 1),
      );
      for (let i = 0; i < rangedEnemyCount; i++) {
        state.spawnQueue.push({
          defKey: 'ranged-enemy',
          delay: enemyWaveStartDelay + i * rangedStep + 0.35,
          powerScale: enemyPowerScale(state.waveNumber, 'ranged-enemy'),
        });
      }
      delayAcc = Math.max(delayAcc, enemyWaveStartDelay + (rangedEnemyCount - 1) * rangedStep + ENEMY_SPAWN_STEP);
    }

    for (const [defKey, count] of Object.entries(config.boss ?? {})) {
      for (let i = 0; i < count; i++) {
        state.spawnQueue.push({
          defKey,
          delay: delayAcc + i * 0.75,
          powerScale: enemyPowerScale(state.waveNumber, defKey),
        });
      }
    }
  }

  private nextInterval(waveNumber: number): number {
    return WAVE_INTERVALS[waveNumber] ?? DEFAULT_INTERVAL;
  }
}
