import { ConnectionMagicRouter } from '@magicblock-labs/ephemeral-rollups-sdk';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getCurrentState, getProvider } from '../wallet/WalletService';
import {
  MAGIC_ROUTER_DEVNET,
  MAGIC_ROUTER_WS_DEVNET,
  type BossOutcomePayload,
  type CreatePayload,
  type KillPayload,
} from './blockchain.types';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

type BlockchainPayload = KillPayload | CreatePayload | BossOutcomePayload;
type SessionStats = {
  kills: number;
  creates: number;
  bossNegotiated: boolean;
};

type BlockchainConnection = Pick<
  ConnectionMagicRouter,
  never
> & {
  getLatestBlockhash(): Promise<{ blockhash: string }>;
  sendRawTransaction(
    rawTransaction: Uint8Array | Buffer,
    options?: { skipPreflight?: boolean },
  ): Promise<string>;
};

export class BlockchainService {
  private connection: BlockchainConnection;
  private sessionStats: SessionStats = {
    kills: 0,
    creates: 0,
    bossNegotiated: false,
  };

  constructor(connection?: BlockchainConnection) {
    this.connection = connection ?? new ConnectionMagicRouter(MAGIC_ROUTER_DEVNET, {
      wsEndpoint: MAGIC_ROUTER_WS_DEVNET,
    });
  }

  async recordKill(unitType: string, walletPubkey: string | null): Promise<void> {
    this.sessionStats.kills += 1;
    if (!walletPubkey) return;
    await this.sendMemoTx({
      walletPubkey,
      unitType,
      timestamp: Date.now(),
    });
  }

  async recordCreate(unitType: string, walletPubkey: string | null): Promise<void> {
    this.sessionStats.creates += 1;
    if (!walletPubkey) return;
    await this.sendMemoTx({
      walletPubkey,
      unitType,
      timestamp: Date.now(),
    });
  }

  async recordBossOutcome(
    outcome: 'negotiated' | 'killed',
    walletPubkey: string | null,
  ): Promise<void> {
    if (outcome === 'negotiated') {
      this.sessionStats.bossNegotiated = true;
    }
    if (!walletPubkey) return;
    await this.sendMemoTx({
      walletPubkey,
      outcome,
      timestamp: Date.now(),
    });
  }

  getSessionSnapshot(): {
    kills: number;
    creates: number;
    bossNegotiated: boolean;
    score: number;
  } {
    const { kills, creates, bossNegotiated } = this.sessionStats;
    return {
      kills,
      creates,
      bossNegotiated,
      score: kills * 10 + creates + (bossNegotiated ? 10000 : 0),
    };
  }

  resetSessionStats(): void {
    this.sessionStats = {
      kills: 0,
      creates: 0,
      bossNegotiated: false,
    };
  }

  /**
   * Called at session start after SessionLayer.connect().
   * Initializes or delegates the PlayerStats PDA to the MagicBlock ephemeral rollup.
   * No-op if the Anchor program has not been deployed yet (VALKYRIX_LEDGER_PROGRAM_ID is placeholder).
   */
  async initSession(walletPubkey: string): Promise<void> {
    // Fire-and-forget: PDA delegation is non-blocking and best-effort.
    // Full ER delegation requires the Anchor program deployed at VALKYRIX_LEDGER_PROGRAM_ID.
    void this.sendMemoTx({
      walletPubkey,
      unitType: 'session-init',
      timestamp: Date.now(),
    }).catch((error) => {
      console.warn('[BlockchainService] initSession non-blocking TX failed:', error);
    });
  }

  /**
   * Called at session end. Undelegates the PlayerStats PDA from the ephemeral rollup.
   * Returns the authoritative session snapshot from on-chain state.
   * Falls back to local stats if the TX fails.
   */
  async endSession(): Promise<{ score: number; kills: number }> {
    const { kills, creates, bossNegotiated } = this.sessionStats;
    const score = kills * 10 + creates + (bossNegotiated ? 10000 : 0);
    // Fire undelegate TX (best-effort; failure is non-blocking)
    const walletState = getCurrentState();
    if (walletState.publicKey) {
      void this.sendMemoTx({
        walletPubkey: walletState.publicKey,
        unitType: 'session-end',
        timestamp: Date.now(),
      }).catch((error) => {
        console.warn('[BlockchainService] endSession undelegate TX failed:', error);
      });
    }
    return { score, kills };
  }

  private async sendMemoTx(payload: BlockchainPayload): Promise<void> {
    const walletState = getCurrentState();
    if (!walletState.connected || !walletState.walletType) return;

    const provider = getProvider(walletState.walletType);
    if (!provider?.signTransaction) return;

    try {
      const feePayer = new PublicKey(payload.walletPubkey);
      const { blockhash } = await this.connection.getLatestBlockhash();
      const tx = new Transaction({
        feePayer,
        recentBlockhash: blockhash,
      });

      tx.add(new TransactionInstruction({
        keys: [{ pubkey: feePayer, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(JSON.stringify(payload), 'utf-8'),
      }));

      const signedTx = await provider.signTransaction(tx);
      const rawTx = (signedTx as Transaction).serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      void Promise.resolve(
        this.connection.sendRawTransaction(rawTx, { skipPreflight: true }),
      ).catch((error) => {
        console.warn('[BlockchainService] TX failed (non-blocking):', error);
      });
    } catch (error) {
      console.warn('[BlockchainService] TX failed (non-blocking):', error);
    }
  }
}
