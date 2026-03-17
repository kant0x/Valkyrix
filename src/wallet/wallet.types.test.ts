import { describe, it, expect } from 'vitest';
import type { WalletType, WalletState, SolanaProvider } from './wallet.types';

describe('wallet.types', () => {
  it('WalletType accepts phantom', () => {
    const t: WalletType = 'phantom';
    expect(t).toBe('phantom');
  });

  it('WalletType accepts backpack', () => {
    const t: WalletType = 'backpack';
    expect(t).toBe('backpack');
  });

  it('WalletState has connected, publicKey, and walletType fields', () => {
    const state: WalletState = {
      connected: true,
      publicKey: 'abc123',
      walletType: 'phantom',
    };
    expect(state.connected).toBe(true);
    expect(state.publicKey).toBe('abc123');
    expect(state.walletType).toBe('phantom');
  });

  it('WalletState accepts null publicKey and null walletType', () => {
    const state: WalletState = {
      connected: false,
      publicKey: null,
      walletType: null,
    };
    expect(state.publicKey).toBeNull();
    expect(state.walletType).toBeNull();
  });

  it('SolanaProvider interface accepts conforming mock object', () => {
    const mockProvider: SolanaProvider = {
      publicKey: { toString: () => 'mock-key' },
      isConnected: true,
      connect: async () => ({ publicKey: { toString: () => 'mock-key' } }),
      disconnect: async () => {},
      on: () => {},
      signAndSendTransaction: async () => ({ signature: 'sig123' }),
    };
    expect(typeof mockProvider.connect).toBe('function');
    expect(typeof mockProvider.disconnect).toBe('function');
    expect(typeof mockProvider.on).toBe('function');
    expect(typeof mockProvider.signAndSendTransaction).toBe('function');
    expect(mockProvider.isConnected).toBe(true);
  });
});
