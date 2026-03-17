// src/session/SessionLayer.ts

/**
 * SessionLayer — MagicBlock / Solana devnet connection layer.
 *
 * Network Architecture (NET-01):
 * ─────────────────────────────────────────────────────────────────
 * Browser                 Solana Devnet              MagicBlock Devnet
 *   |                    api.devnet.solana.com        devnet.magicblock.app
 *   |                           |                           |
 *   |-- Wallet connect -------->|                           |
 *   |   (window.phantom/.backpack via WalletService)        |
 *   |                           |                           |
 *   |-- "Play" pressed ---------|-------------------------->|
 *   |   SessionLayer.connect()  |         getSlot()         |
 *   |                           |                           |
 *   |-- [Phase 3] Kill event -->|  <--- ER Transaction ---->|
 *   |   signAndSendTransaction  |   (via MagicBlock router) |
 * ─────────────────────────────────────────────────────────────────
 *
 * Protocol: HTTPS/WSS
 * Transport: JSON-RPC (Solana standard)
 * Mode: Client-to-server (not P2P)
 * Auth: Wallet signature (ed25519)
 * Multiplayer: Deferred to Phase 5
 *
 * connect() is called when the player presses "Play" (locked decision from CONTEXT.md).
 * Note: First call may take 3–10 s (MagicBlock devnet cold start — show loading UI).
 */

export const MAGICBLOCK_DEVNET_RPC = 'https://devnet.magicblock.app/';
export const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com';

// Use a type-only alias to avoid importing @solana/web3.js at module load time
// (bundle size: ~400 KB gzipped — only load when player presses Play)
type Connection = import('@solana/web3.js').Connection;

export class SessionLayer {
  private connection: Connection | null = null;

  /**
   * Establish connection to MagicBlock devnet.
   * Uses dynamic import to avoid loading @solana/web3.js on page start.
   * May take 3–10 seconds on first call (devnet cold start — caller should show loading state).
   */
  async connect(): Promise<void> {
    const { Connection } = await import('@solana/web3.js');
    this.connection = new Connection(MAGICBLOCK_DEVNET_RPC, 'confirmed');
    // Verify connectivity — throws if devnet is unreachable
    await this.connection.getSlot();
  }

  /**
   * Returns the active Connection instance.
   * @throws if connect() has not been called successfully.
   */
  getConnection(): Connection {
    if (!this.connection) {
      throw new Error('SessionLayer not connected — call connect() first');
    }
    return this.connection;
  }

  /**
   * Record a unit kill as an on-chain transaction.
   * NOT implemented in Phase 2 — the kill-recording program is a Phase 3 concern.
   * @throws always, until Phase 3 implements this.
   */
  async sendKill(_unitId: string): Promise<string> {
    throw new Error('sendKill: not implemented until Phase 3');
  }
}
