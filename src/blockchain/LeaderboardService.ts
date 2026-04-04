import { AnchorProvider, BN } from '@coral-xyz/anchor';
import { ConnectionMagicRouter } from '@magicblock-labs/ephemeral-rollups-sdk';
import { SoarProgram } from '@magicblock-labs/soar-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { getCurrentState, getProvider } from '../wallet/WalletService';
import {
  MAGIC_ROUTER_DEVNET,
  MAGIC_ROUTER_WS_DEVNET,
  SOAR_LEADERBOARD_PDA,
  type LeaderboardEntry,
} from './blockchain.types';

type SoarAccount = {
  account: {
    player: { toString(): string };
    score: number;
  };
};

type SoarLike = {
  submitScoreToLeaderBoard(
    user: PublicKey | string,
    authority: PublicKey | string,
    leaderboard: PublicKey | string,
    score: BN,
  ): Promise<{ transaction: unknown }>;
  sendAndConfirmTransaction(transaction: unknown): Promise<string>;
  fetchAllLeaderboardAccounts(): Promise<SoarAccount[]>;
};

export class LeaderboardService {
  private soar: SoarLike;

  constructor(soarProgram?: SoarLike) {
    if (soarProgram) {
      this.soar = soarProgram;
      return;
    }

    const connection = new ConnectionMagicRouter(MAGIC_ROUTER_DEVNET, {
      wsEndpoint: MAGIC_ROUTER_WS_DEVNET,
    }) as unknown as Connection;

    const provider = LeaderboardService.buildProvider(connection);
    this.soar = (
      SoarProgram as unknown as {
        get(nextProvider: AnchorProvider): SoarLike;
      }
    ).get(provider);
  }

  async submitScore(walletPubkey: string, score: number, kills: number): Promise<void> {
    if (!SOAR_LEADERBOARD_PDA) return;

    try {
      const playerPubkey = new PublicKey(walletPubkey);
      const leaderboardPda = new PublicKey(SOAR_LEADERBOARD_PDA);
      const packedScore = score * 10000 + kills;
      const { transaction } = await this.soar.submitScoreToLeaderBoard(
        playerPubkey,
        playerPubkey,
        leaderboardPda,
        new BN(packedScore),
      );
      await this.soar.sendAndConfirmTransaction(transaction);
    } catch (error) {
      console.warn('[LeaderboardService] submitScore failed:', error);
      throw error;
    }
  }

  async fetchLeaderboard(walletPubkey?: string | null): Promise<LeaderboardEntry[]> {
    try {
      const accounts = await this.soar.fetchAllLeaderboardAccounts();
      const sorted = [...accounts].sort((a, b) => b.account.score - a.account.score);
      const allEntries = sorted.map((entry, index) => {
        const packedScore = entry.account.score;
        return {
          player: entry.account.player.toString(),
          score: Math.floor(packedScore / 10000),
          kills: packedScore % 10000,
          rank: index + 1,
        } satisfies LeaderboardEntry;
      });

      const top100 = allEntries.slice(0, 100);
      if (walletPubkey && !top100.some((entry) => entry.player === walletPubkey)) {
        const ownEntry = allEntries.find((entry) => entry.player === walletPubkey);
        if (ownEntry) top100.push(ownEntry);
      }
      return top100;
    } catch (error) {
      console.warn('[LeaderboardService] fetchLeaderboard failed:', error);
      return [];
    }
  }

  private static buildProvider(connection: Connection): AnchorProvider {
    const walletState = getCurrentState();
    if (!walletState.walletType || !walletState.publicKey) {
      throw new Error('[LeaderboardService] Wallet not connected');
    }

    const rawProvider = getProvider(walletState.walletType);
    if (!rawProvider?.signTransaction) {
      throw new Error('[LeaderboardService] Wallet provider cannot sign');
    }

    const anchorWallet = {
      publicKey: new PublicKey(walletState.publicKey),
      signTransaction: <T>(tx: T) => rawProvider.signTransaction!(tx),
      signAllTransactions: <T>(txs: T[]) => rawProvider.signAllTransactions
        ? rawProvider.signAllTransactions(txs)
        : Promise.resolve(txs),
    };

    return new AnchorProvider(connection, anchorWallet as never, { commitment: 'confirmed' });
  }
}
