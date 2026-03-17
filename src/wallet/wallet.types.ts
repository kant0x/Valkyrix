// src/wallet/wallet.types.ts
// Wallet provider types for Phantom and Backpack browser extensions.
// Both wallets inject a provider object into window with this interface shape.
// Source: https://docs.phantom.com/solana/detecting-the-provider

export type WalletType = 'phantom' | 'backpack';

export interface SolanaProvider {
  isPhantom?: boolean;
  isBackpack?: boolean;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  on(event: 'connect' | 'disconnect' | 'accountChanged', handler: (arg?: unknown) => void): void;
  signAndSendTransaction(tx: unknown): Promise<{ signature: string }>;
}

export type WalletState = {
  connected: boolean;
  publicKey: string | null;
  walletType: WalletType | null;
};
