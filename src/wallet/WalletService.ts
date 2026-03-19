// src/wallet/WalletService.ts
import type { WalletType, SolanaProvider, WalletState } from './wallet.types';

let _state: WalletState = { connected: false, publicKey: null, walletType: null };
let _provider: SolanaProvider | null = null;
let _listeningProvider: SolanaProvider | null = null;

function resetState(): void {
  _state = { connected: false, publicKey: null, walletType: null };
  _provider = null;
}

function attachProviderListeners(provider: SolanaProvider): void {
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
    const p = (window as unknown as { phantom?: { solana?: SolanaProvider } }).phantom?.solana;
    return p?.isPhantom ? p : null;
  }
  if (type === 'backpack') {
    const p = (window as unknown as { backpack?: SolanaProvider }).backpack;
    return p ?? null;
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

  const { publicKey } = await provider.connect();
  const key = publicKey.toString();

  _provider = provider;
  _state = { connected: true, publicKey: key, walletType: type };

  // Listen for account changes — update state if user switches accounts
  provider.on('accountChanged', (newKey) => {
    if (!newKey) {
      _state = { connected: false, publicKey: null, walletType: null };
      _provider = null;
    } else {
      _state = { ..._state, publicKey: String((newKey as { toString(): string }).toString()) };
    }
  });

  return key;
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
