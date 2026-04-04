import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window globals before importing module
beforeEach(() => {
  // Reset window mocks
  Object.defineProperty(window, 'phantom', {
    value: undefined,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'backpack', {
    value: undefined,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'solana', {
    value: undefined,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'xnft', {
    value: undefined,
    writable: true,
    configurable: true,
  });
  // Reset module state by clearing module cache
  vi.resetModules();
});

describe('WalletService - getProvider', () => {
  it('returns null for phantom when window.phantom is undefined', async () => {
    (window as unknown as Record<string, unknown>).phantom = undefined;
    const { getProvider } = await import('./WalletService');
    expect(getProvider('phantom')).toBeNull();
  });

  it('returns null for phantom when isPhantom flag is falsy', async () => {
    (window as unknown as Record<string, unknown>).phantom = {
      solana: { isPhantom: false },
    };
    const { getProvider } = await import('./WalletService');
    expect(getProvider('phantom')).toBeNull();
  });

  it('returns provider for phantom when isPhantom is true', async () => {
    const mockProvider = { isPhantom: true, publicKey: null, isConnected: false };
    (window as unknown as Record<string, unknown>).phantom = {
      solana: mockProvider,
    };
    const { getProvider } = await import('./WalletService');
    expect(getProvider('phantom')).toBe(mockProvider);
  });

  it('falls back to window.solana for phantom detection', async () => {
    const mockProvider = { isPhantom: true, publicKey: null, isConnected: false };
    (window as unknown as Record<string, unknown>).phantom = undefined;
    (window as unknown as Record<string, unknown>).solana = mockProvider;
    const { getProvider } = await import('./WalletService');
    expect(getProvider('phantom')).toBe(mockProvider);
  });

  it('returns null for backpack when window.backpack is undefined', async () => {
    (window as unknown as Record<string, unknown>).backpack = undefined;
    const { getProvider } = await import('./WalletService');
    expect(getProvider('backpack')).toBeNull();
  });

  it('returns provider for backpack when window.backpack is defined', async () => {
    const mockProvider = {
      isBackpack: true,
      publicKey: null,
      isConnected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).backpack = mockProvider;
    const { getProvider } = await import('./WalletService');
    expect(getProvider('backpack')).toBe(mockProvider);
  });

  it('returns backpack provider when injected under window.backpack.solana', async () => {
    const mockProvider = { isBackpack: true, publicKey: null, isConnected: false };
    (window as unknown as Record<string, unknown>).backpack = { solana: mockProvider };
    const { getProvider } = await import('./WalletService');
    expect(getProvider('backpack')).toBe(mockProvider);
  });
});

describe('WalletService - connectWallet', () => {
  it('throws when provider is null (extension not installed)', async () => {
    (window as unknown as Record<string, unknown>).phantom = undefined;
    const { connectWallet } = await import('./WalletService');
    await expect(connectWallet('phantom')).rejects.toThrow('phantom extension not installed');
  });

  it('returns public key string on successful connect', async () => {
    const mockProvider = {
      isPhantom: true,
      publicKey: null,
      isConnected: false,
      connect: vi.fn().mockResolvedValue({ publicKey: { toString: () => 'abc123' } }),
      on: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { connectWallet } = await import('./WalletService');
    const key = await connectWallet('phantom');
    expect(key).toBe('abc123');
  });

  it('updates getCurrentState after successful connect', async () => {
    const mockProvider = {
      isPhantom: true,
      publicKey: null,
      isConnected: false,
      connect: vi.fn().mockResolvedValue({ publicKey: { toString: () => 'mykey' } }),
      on: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { connectWallet, getCurrentState } = await import('./WalletService');
    await connectWallet('phantom');
    const state = getCurrentState();
    expect(state.connected).toBe(true);
    expect(state.publicKey).toBe('mykey');
    expect(state.walletType).toBe('phantom');
  });

  it('still connects when provider does not expose on()', async () => {
    const mockProvider = {
      isPhantom: true,
      publicKey: null,
      isConnected: false,
      connect: vi.fn().mockResolvedValue({ publicKey: { toString: () => 'silent-key' } }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { connectWallet, getCurrentState } = await import('./WalletService');
    await expect(connectWallet('phantom')).resolves.toBe('silent-key');
    expect(getCurrentState().connected).toBe(true);
    expect(getCurrentState().publicKey).toBe('silent-key');
  });

  it('reuses an already connected provider without calling connect again', async () => {
    const mockProvider = {
      isPhantom: true,
      publicKey: { toString: () => 'existing-key' },
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { connectWallet } = await import('./WalletService');
    await expect(connectWallet('phantom')).resolves.toBe('existing-key');
    expect(mockProvider.connect).not.toHaveBeenCalled();
  });

  it('normalizes generic unexpected wallet errors into a readable message', async () => {
    const mockProvider = {
      isPhantom: true,
      publicKey: null,
      isConnected: false,
      connect: vi.fn().mockRejectedValue(new Error('Unexpected error')),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { connectWallet } = await import('./WalletService');
    await expect(connectWallet('phantom')).rejects.toThrow('unlock it');
  });

  it('retries phantom connect without args after an unexpected error from the options call', async () => {
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('Unexpected error'))
      .mockResolvedValueOnce({ publicKey: { toString: () => 'retry-key' } });
    const mockProvider = {
      isPhantom: true,
      publicKey: null,
      isConnected: false,
      connect,
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { connectWallet } = await import('./WalletService');

    await expect(connectWallet('phantom')).resolves.toBe('retry-key');
    expect(connect).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenNthCalledWith(1, { onlyIfTrusted: false });
    expect(connect).toHaveBeenNthCalledWith(2);
  });

  it('falls back to provider.request connect after repeated unexpected phantom errors', async () => {
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('Unexpected error'))
      .mockRejectedValueOnce(new Error('Unexpected error'));
    const request = vi.fn().mockResolvedValue({ publicKey: { toString: () => 'request-key' } });
    const mockProvider = {
      isPhantom: true,
      publicKey: null,
      isConnected: false,
      connect,
      request,
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { connectWallet } = await import('./WalletService');

    await expect(connectWallet('phantom')).resolves.toBe('request-key');
    expect(connect).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith({ method: 'connect' });
  });
});

describe('WalletService - disconnectWallet', () => {
  it('resets state after disconnect', async () => {
    const mockProvider = {
      isPhantom: true,
      publicKey: null,
      isConnected: false,
      connect: vi.fn().mockResolvedValue({ publicKey: { toString: () => 'mykey' } }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { connectWallet, disconnectWallet, getCurrentState } = await import('./WalletService');
    await connectWallet('phantom');
    await disconnectWallet();
    const state = getCurrentState();
    expect(state.connected).toBe(false);
    expect(state.publicKey).toBeNull();
    expect(state.walletType).toBeNull();
  });
});

describe('WalletService - accountChanged', () => {
  it('sets connected=false when accountChanged fires with null key', async () => {
    let accountChangedHandler: ((arg?: unknown) => void) | null = null;
    const mockProvider = {
      isPhantom: true,
      publicKey: null,
      isConnected: false,
      connect: vi.fn().mockResolvedValue({ publicKey: { toString: () => 'mykey' } }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockImplementation((event: string, handler: (arg?: unknown) => void) => {
        if (event === 'accountChanged') accountChangedHandler = handler;
      }),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { connectWallet, getCurrentState } = await import('./WalletService');
    await connectWallet('phantom');
    expect(getCurrentState().connected).toBe(true);
    // Simulate accountChanged with null
    accountChangedHandler!(null);
    expect(getCurrentState().connected).toBe(false);
    expect(getCurrentState().publicKey).toBeNull();
  });
});

describe('WalletService - restoreWalletSession', () => {
  it('restores a previously connected provider from injected wallet state', async () => {
    const mockProvider = {
      isPhantom: true,
      publicKey: { toString: () => 'restored-key' },
      isConnected: true,
      connect: vi.fn().mockResolvedValue({ publicKey: { toString: () => 'restored-key' } }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      signAndSendTransaction: vi.fn(),
    };
    (window as unknown as Record<string, unknown>).phantom = { solana: mockProvider };
    const { restoreWalletSession } = await import('./WalletService');
    const state = restoreWalletSession();
    expect(state.connected).toBe(true);
    expect(state.publicKey).toBe('restored-key');
    expect(state.walletType).toBe('phantom');
  });
});
