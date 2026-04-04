// src/session/SessionLayer.ts
import { ConnectionMagicRouter } from '@magicblock-labs/ephemeral-rollups-sdk';
import { MAGIC_ROUTER_DEVNET, MAGIC_ROUTER_WS_DEVNET } from '../blockchain/blockchain.types';

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
const CHAIN_TIMEOUT_MS = 12000;

type SessionConnection = Pick<ConnectionMagicRouter, 'getSlot' | 'getLatestBlockhash'>;

export class ChainUnavailableError extends Error {
  constructor() {
    super('Помехи в сети. Соединение с блокчейном недоступно. Попробуйте позже.');
    this.name = 'ChainUnavailableError';
  }
}

async function createDefaultConnection(): Promise<SessionConnection> {
  return new ConnectionMagicRouter(MAGIC_ROUTER_DEVNET, {
    wsEndpoint: MAGIC_ROUTER_WS_DEVNET,
  });
}

async function probeConnection(connection: SessionConnection): Promise<void> {
  try {
    await connection.getSlot();
    return;
  } catch {
    await connection.getLatestBlockhash();
  }
}

export class SessionLayer {
  private connection: SessionConnection | null = null;

  constructor(
    private readonly createConnection: () => Promise<SessionConnection> = createDefaultConnection,
  ) {}

  get isConnected(): boolean {
    return this.connection !== null;
  }

  /**
   * Establish connection to MagicBlock devnet.
   * Uses dynamic import to avoid loading @solana/web3.js on page start.
   * May take 3–10 seconds on first call (devnet cold start — caller should show loading state).
   */
  async connect(): Promise<void> {
    this.connection = await this.createConnection();
    try {
      await Promise.race([
        probeConnection(this.connection),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new ChainUnavailableError()), CHAIN_TIMEOUT_MS);
        }),
      ]);
    } catch {
      this.connection = null;
      throw new ChainUnavailableError();
    }
  }

  disconnect(): void {
    this.connection = null;
  }

  /**
   * Returns the active Connection instance.
   * @throws if connect() has not been called successfully.
   */
  getConnection(): SessionConnection {
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
