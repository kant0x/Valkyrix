export type BattleSessionMode = 'cheap-tx' | 'offline';

const STORAGE_KEY = 'vk-battle-session-mode';

let cachedMode: BattleSessionMode | null = null;
let currentSessionSigner: string | null = null;

export function getBattleSessionMode(): BattleSessionMode {
  if (cachedMode) return cachedMode;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'cheap-tx' || stored === 'offline') {
      cachedMode = stored;
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  cachedMode = 'cheap-tx';
  return cachedMode;
}

export function setBattleSessionMode(mode: BattleSessionMode): BattleSessionMode {
  cachedMode = mode;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
  return mode;
}

export function clearBattleSessionMode(): void {
  setBattleSessionMode('cheap-tx');
}

export function isBattleSessionEnabled(): boolean {
  return getBattleSessionMode() === 'cheap-tx';
}

export function requestBattleSessionMode(): BattleSessionMode {
  return setBattleSessionMode('cheap-tx');
}

export function getBattleSessionSigner(): string | null {
  return currentSessionSigner;
}

export function setBattleSessionSigner(signer: string | null): string | null {
  currentSessionSigner = signer;
  return currentSessionSigner;
}
