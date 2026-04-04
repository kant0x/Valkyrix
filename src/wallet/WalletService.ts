// src/wallet/WalletService.ts
import type { WalletType, SolanaProvider, WalletState } from './wallet.types';

let _state: WalletState = { connected: false, publicKey: null, walletType: null };
let _provider: SolanaProvider | null = null;
let _listeningProvider: SolanaProvider | null = null;

function isSolanaProviderLike(value: unknown): value is SolanaProvider {
  if (!value || typeof value !== 'object') return false;
  return 'connect' in value && typeof (value as { connect?: unknown }).connect === 'function';
}

function extractProviderKey(
  provider: SolanaProvider,
  result?: unknown,
): string | null {
  const resultKey = result as
    | { publicKey?: { toString?: () => string } | string | null }
    | string
    | null
    | undefined;

  if (typeof resultKey === 'string' && resultKey) {
    return resultKey;
  }

  const nestedKey = typeof resultKey === 'object' && resultKey && 'publicKey' in resultKey
    ? resultKey.publicKey
    : null;

  if (typeof nestedKey === 'string' && nestedKey) {
    return nestedKey;
  }

  if (nestedKey && typeof nestedKey.toString === 'function') {
    return nestedKey.toString();
  }

  if (provider.publicKey && typeof provider.publicKey.toString === 'function') {
    return provider.publicKey.toString();
  }

  return null;
}

function normalizeWalletError(error: unknown, type: WalletType): string {
  if (error instanceof Error && error.message) {
    if (error.message === 'Unexpected error') {
      return `${type} returned "Unexpected error". Open the wallet extension, unlock it, and approve the site connection, then try again.`;
    }
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      message?: unknown;
      errorMessage?: unknown;
      code?: unknown;
    };
    const rawMessage = typeof candidate.message === 'string'
      ? candidate.message
      : typeof candidate.errorMessage === 'string'
      ? candidate.errorMessage
      : '';
    const code = typeof candidate.code === 'number' || typeof candidate.code === 'string'
      ? String(candidate.code)
      : '';

    if (rawMessage === 'Unexpected error' || code === '-32603') {
      return `${type} returned an internal error (-32603). Unlock ${type}, confirm the connection popup, and reload the page if the extension stays stuck.`;
    }
    if (rawMessage) return rawMessage;
  }

  return `${type} connection failed. Check that the extension is unlocked and allowed for this site.`;
}

function resetState(): void {
  _state = { connected: false, publicKey: null, walletType: null };
  _provider = null;
  _listeningProvider = null;
}

function attachProviderListeners(provider: SolanaProvider): void {
  if (typeof provider.on !== 'function') return;
  if (_listeningProvider === provider) return;
  _listeningProvider = provider;

  provider.on('disconnect', () => {
    resetState();
  });

  provider.on('accountChanged', (newKey) => {
    if (!newKey) {
      resetState();
      return;
    }

    _state = {
      ..._state,
      connected: true,
      publicKey: String((newKey as { toString(): string }).toString()),
    };
  });
}

function setConnectedState(type: WalletType, provider: SolanaProvider, key: string): void {
  _provider = provider;
  _state = { connected: true, publicKey: key, walletType: type };
  attachProviderListeners(provider);
}

export function getProvider(type: WalletType): SolanaProvider | null {
  if (type === 'phantom') {
    const scope = window as unknown as {
      phantom?: { solana?: SolanaProvider };
      solana?: SolanaProvider;
    };
    const direct = scope.phantom?.solana;
    if (direct?.isPhantom) return direct;
    const fallback = scope.solana;
    return fallback?.isPhantom ? fallback : null;
  }
  if (type === 'backpack') {
    const scope = window as unknown as {
      backpack?: SolanaProvider | { solana?: SolanaProvider };
      xnft?: { solana?: SolanaProvider };
    };
    const direct = scope.backpack;
    if (direct && 'solana' in direct && direct.solana) {
      return direct.solana;
    }
    if (isSolanaProviderLike(direct)) {
      return direct;
    }
    return scope.xnft?.solana ?? null;
  }
  return null;
}

/**
 * Connect to the specified wallet provider.
 * MUST be called inside a user gesture (click handler) — browsers block wallet popups otherwise.
 */
export async function connectWallet(type: WalletType): Promise<string> {
  const provider = getProvider(type);
  if (!provider) throw new Error(`${type} extension not installed`);

  if (provider.isConnected && provider.publicKey) {
    const restoredKey = provider.publicKey.toString();
    setConnectedState(type, provider, restoredKey);
    return restoredKey;
  }

  try {
    let result: unknown;
    try {
      result = await provider.connect({ onlyIfTrusted: false });
    } catch (firstError) {
      const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
      if (firstMessage !== 'Unexpected error') {
        throw firstError;
      }
      try {
        // Some Phantom injections fail on the options object but succeed on the plain connect call.
        result = await provider.connect();
      } catch (secondError) {
        const secondMessage = secondError instanceof Error ? secondError.message : String(secondError);
        if (secondMessage !== 'Unexpected error') {
          throw secondError;
        }

        try {
          await provider.disconnect();
        } catch {
          // Best-effort stale-session reset before the final retry path.
        }

        if (typeof provider.request === 'function') {
          result = await provider.request({ method: 'connect' });
        } else {
          throw secondError;
        }
      }
    }
    const nextKey = extractProviderKey(provider, result);
    if (!nextKey) {
      throw new Error(`${type} connected without a public key`);
    }
    setConnectedState(type, provider, nextKey);
    return nextKey;
  } catch (error) {
    throw new Error(normalizeWalletError(error, type));
  }
}

export async function disconnectWallet(): Promise<void> {
  if (_provider) {
    await _provider.disconnect();
  }
  resetState();
}

export function restoreWalletSession(): WalletState {
  if (_state.connected && _state.publicKey && _provider) {
    return getCurrentState();
  }

  const candidates: Array<[WalletType, SolanaProvider | null]> = [
    ['phantom', getProvider('phantom')],
    ['backpack', getProvider('backpack')],
  ];

  for (const [type, provider] of candidates) {
    if (provider?.isConnected && provider.publicKey) {
      setConnectedState(type, provider, provider.publicKey.toString());
      break;
    }
  }

  return getCurrentState();
}

export function getCurrentState(): WalletState {
  return { ..._state };
}

/**
 * Silently reconnect if wallet was previously approved for this site.
 * Uses onlyIfTrusted so no popup is shown. Safe to call on page load.
 */
export async function tryAutoConnect(): Promise<WalletState> {
  if (_state.connected && _state.publicKey && _provider) {
    return getCurrentState();
  }

  const candidates: Array<[WalletType, SolanaProvider | null]> = [
    ['phantom', getProvider('phantom')],
    ['backpack', getProvider('backpack')],
  ];

  for (const [type, provider] of candidates) {
    if (!provider) continue;

    if (provider.isConnected && provider.publicKey) {
      setConnectedState(type, provider, provider.publicKey.toString());
      return getCurrentState();
    }

    try {
      const result = await provider.connect({ onlyIfTrusted: true });
      const key = extractProviderKey(provider, result);
      if (key) {
        setConnectedState(type, provider, key);
        return getCurrentState();
      }
    } catch {
      // Not trusted / not available — continue to next
    }
  }

  return getCurrentState();
}
