import { ConnectionMagicRouter } from '@magicblock-labs/ephemeral-rollups-sdk';
import { Keypair, PublicKey, SystemProgram, Transaction, type TransactionInstruction } from '@solana/web3.js';
import { getCurrentState, getProvider } from '../wallet/WalletService';
import { setBattleSessionSigner } from './BattleSessionState';
import { MAGIC_ROUTER_DEVNET, MAGIC_ROUTER_WS_DEVNET } from './blockchain.types';
import { emitBlockchainTx } from './blockchainEvents';
import type {
  PlayerLedgerSnapshot,
  ValkyrixBossOutcome,
  ValkyrixGameOutcome,
  ValkyrixGameplayEntity,
} from './ValkyrixLedgerClient';
import { ValkyrixLedgerClient } from './ValkyrixLedgerClient';

type SessionStats = {
  kills: number;
  creates: number;
  bossNegotiated: boolean;
};

type AccountInfoLike = {
  data: Uint8Array;
} | null;

type BlockchainConnection = Pick<
  ConnectionMagicRouter,
  never
> & {
  getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight?: number }>;
  prepareTransaction?(transaction: Transaction): Promise<Transaction>;
  getAccountInfo(pubkey: PublicKey): Promise<AccountInfoLike>;
  sendRawTransaction(
    rawTransaction: Uint8Array,
    options?: { skipPreflight?: boolean },
  ): Promise<string>;
  confirmTransaction?(
    strategy: {
      signature: string;
      blockhash: string;
      lastValidBlockHeight: number;
    },
    commitment?: 'processed' | 'confirmed' | 'finalized',
  ): Promise<unknown>;
};

type LedgerClientLike = Pick<
  ValkyrixLedgerClient,
  | 'deriveGameConfigPda'
  | 'derivePlayerLedgerPda'
  | 'buildInitializeGameInstruction'
  | 'buildInitializePlayerInstruction'
  | 'buildStartSessionInstruction'
  | 'buildRecordKillInstruction'
  | 'buildRecordCreateInstruction'
  | 'buildRecordBossOutcomeInstruction'
  | 'buildRecordWaveStartInstruction'
  | 'buildRecordGameOutcomeInstruction'
  | 'buildFinalizeSessionInstruction'
  | 'decodePlayerLedgerAccount'
>;

const GAMEPLAY_ENTITY_MAP: Record<string, ValkyrixGameplayEntity> = {
  'attack-tower': 'attack-tower',
  'buff-tower': 'buff-tower',
  'light-ally': 'light-ally',
  'heavy-ally': 'heavy-ally',
  collector: 'collector',
  cybernetic: 'berserker',
  berserker: 'berserker',
  guardian: 'guardian',
  'light-enemy': 'light-enemy',
  'heavy-enemy': 'heavy-enemy',
  'ranged-enemy': 'ranged-enemy',
  'boss-enemy': 'boss-enemy',
};

const SESSION_DURATION_SECONDS = 60 * 30;
const SESSION_SIGNER_LAMPORTS = 2_000_000;
const SCORE_PER_KILL = 10;
const SCORE_PER_CREATE = 1;
const SCORE_BOSS_OUTCOME = 1_000;

export class BlockchainService {
  private connection: BlockchainConnection;
  private ledgerClient: LedgerClientLike;
  private sessionStats: SessionStats = {
    kills: 0,
    creates: 0,
    bossNegotiated: false,
  };
  private sessionActive = false;
  private sessionWallet: string | null = null;
  private sessionSigner: Keypair | null = null;
  private sessionExpiresAt = 0;
  private sessionEventIndex = 0n;
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(connection?: BlockchainConnection, ledgerClient?: LedgerClientLike) {
    this.connection = connection ?? new ConnectionMagicRouter(MAGIC_ROUTER_DEVNET, {
      wsEndpoint: MAGIC_ROUTER_WS_DEVNET,
    });
    this.ledgerClient = ledgerClient ?? new ValkyrixLedgerClient();
  }

  async recordKill(unitType: string, walletPubkey: string | null): Promise<void> {
    this.sessionStats.kills += 1;
    const entity = this.resolveGameplayEntity(unitType, 'record_kill');
    if (!entity) return;
    if (!this.canWriteEvent(walletPubkey, 'record_kill')) return;
    await this.queueWrite(async () => {
      const eventIndex = this.sessionEventIndex + 1n;
      await this.sendSessionInstruction(
        this.ledgerClient.buildRecordKillInstruction(
          walletPubkey,
          this.sessionSigner!.publicKey,
          entity,
          eventIndex,
        ),
        'record_kill',
        { entity },
      );
      this.sessionEventIndex = eventIndex;
    });
  }

  async recordCreate(unitType: string, walletPubkey: string | null): Promise<void> {
    this.sessionStats.creates += 1;
    const entity = this.resolveGameplayEntity(unitType, 'record_create');
    if (!entity) return;
    if (!this.canWriteEvent(walletPubkey, 'record_create')) return;
    await this.queueWrite(async () => {
      const eventIndex = this.sessionEventIndex + 1n;
      await this.sendSessionInstruction(
        this.ledgerClient.buildRecordCreateInstruction(
          walletPubkey,
          this.sessionSigner!.publicKey,
          entity,
          eventIndex,
        ),
        'record_create',
        { entity },
      );
      this.sessionEventIndex = eventIndex;
    });
  }

  async recordBossOutcome(
    outcome: ValkyrixBossOutcome,
    walletPubkey: string | null,
  ): Promise<void> {
    if (outcome === 'negotiated') {
      this.sessionStats.bossNegotiated = true;
    }
    if (!this.canWriteEvent(walletPubkey, 'record_boss_outcome')) return;
    await this.queueWrite(async () => {
      const eventIndex = this.sessionEventIndex + 1n;
      await this.sendSessionInstruction(
        this.ledgerClient.buildRecordBossOutcomeInstruction(
          walletPubkey,
          this.sessionSigner!.publicKey,
          outcome,
          eventIndex,
        ),
        'record_boss_outcome',
        { outcome },
      );
      this.sessionEventIndex = eventIndex;
    });
  }

  async recordWaveStart(waveNumber: number, walletPubkey: string | null): Promise<void> {
    if (!this.canWriteEvent(walletPubkey, 'record_wave_start')) return;
    await this.queueWrite(async () => {
      const eventIndex = this.sessionEventIndex + 1n;
      await this.sendSessionInstruction(
        this.ledgerClient.buildRecordWaveStartInstruction(
          walletPubkey,
          this.sessionSigner!.publicKey,
          waveNumber,
          eventIndex,
        ),
        'record_wave_start',
        {},
      );
      this.sessionEventIndex = eventIndex;
    });
  }

  async recordGameOutcome(outcome: ValkyrixGameOutcome, walletPubkey: string | null): Promise<void> {
    if (!this.canWriteEvent(walletPubkey, 'record_game_outcome')) return;
    await this.queueWrite(async () => {
      const eventIndex = this.sessionEventIndex + 1n;
      await this.sendSessionInstruction(
        this.ledgerClient.buildRecordGameOutcomeInstruction(
          walletPubkey,
          this.sessionSigner!.publicKey,
          outcome,
          eventIndex,
        ),
        'record_game_outcome',
        {},
      );
      this.sessionEventIndex = eventIndex;
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
      score: kills * SCORE_PER_KILL + creates * SCORE_PER_CREATE + (bossNegotiated ? SCORE_BOSS_OUTCOME : 0),
    };
  }

  resetSessionStats(): void {
    this.sessionStats = {
      kills: 0,
      creates: 0,
      bossNegotiated: false,
    };
    this.sessionActive = false;
    this.sessionWallet = null;
    this.sessionSigner = null;
    this.sessionExpiresAt = 0;
    this.sessionEventIndex = 0n;
    setBattleSessionSigner(null);
  }

  async initSession(walletPubkey: string): Promise<void> {
    await this.queueWrite(async () => {
      const walletKey = new PublicKey(walletPubkey);
      const gameConfigPda = this.ledgerClient.deriveGameConfigPda();
      const playerLedgerPda = this.ledgerClient.derivePlayerLedgerPda(walletKey);
      const sessionSigner = Keypair.generate();
      const sessionExpiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;

      try {
        const setupInstructions: TransactionInstruction[] = [];
        const gameConfigInfo = await this.connection.getAccountInfo(gameConfigPda);
        if (!gameConfigInfo) {
          setupInstructions.push(this.ledgerClient.buildInitializeGameInstruction(walletKey));
        }

        const playerLedgerInfo = await this.connection.getAccountInfo(playerLedgerPda);
        if (!playerLedgerInfo) {
          setupInstructions.push(this.ledgerClient.buildInitializePlayerInstruction(walletKey));
        }

        const sessionNonce = BigInt(Date.now());
        setupInstructions.push(
          SystemProgram.createAccount({
            fromPubkey: walletKey,
            newAccountPubkey: sessionSigner.publicKey,
            lamports: SESSION_SIGNER_LAMPORTS,
            space: 0,
            programId: SystemProgram.programId,
          }),
        );
        setupInstructions.push(
          this.ledgerClient.buildStartSessionInstruction(
            walletKey,
            sessionSigner.publicKey,
            sessionNonce,
            BigInt(sessionExpiresAt),
          ),
        );
        await this.sendWalletInstructions(
          setupInstructions,
          walletPubkey,
          ['initialize_game', 'initialize_player', 'session_signer_fund', 'start_session'],
          [sessionSigner],
        );

        this.sessionWallet = walletPubkey;
        this.sessionSigner = sessionSigner;
        this.sessionExpiresAt = sessionExpiresAt;
        this.sessionActive = true;
        this.sessionEventIndex = 0n;
        setBattleSessionSigner(sessionSigner.publicKey.toBase58());
      } catch (error) {
        this.sessionWallet = null;
        this.sessionSigner = null;
        this.sessionExpiresAt = 0;
        this.sessionActive = false;
        this.sessionEventIndex = 0n;
        setBattleSessionSigner(null);
        throw error;
      }
    });
  }

  async endSession(): Promise<{ score: number; kills: number }> {
    const fallback = this.getSessionSnapshot();
    if (!this.sessionActive || !this.sessionWallet || !this.sessionSigner) {
      return { score: fallback.score, kills: fallback.kills };
    }

    const walletPubkey = this.sessionWallet;
    return this.queueWrite(async () => {
      await this.sendSessionInstruction(
        this.ledgerClient.buildFinalizeSessionInstruction(walletPubkey, this.sessionSigner!.publicKey),
        'finalize_session',
        {},
      );

      const ledgerSnapshot = await this.readPlayerLedger(walletPubkey);
      this.sessionActive = false;
      this.sessionWallet = null;
      this.sessionSigner = null;
      this.sessionExpiresAt = 0;
      this.sessionEventIndex = 0n;
      setBattleSessionSigner(null);

      if (!ledgerSnapshot) {
        return { score: fallback.score, kills: fallback.kills };
      }

      return {
        score: ledgerSnapshot.currentSessionScore,
        kills: ledgerSnapshot.currentSessionKills,
      };
    });
  }

  private canWriteEvent(walletPubkey: string | null, label: string): walletPubkey is string {
    if (!walletPubkey) {
      emitBlockchainTx({ label, status: 'failed', error: 'wallet not connected' });
      return false;
    }
    if (!this.sessionActive || !this.sessionWallet || !this.sessionSigner) {
      emitBlockchainTx({ label, status: 'failed', error: 'battle session inactive' });
      return false;
    }
    if (walletPubkey !== this.sessionWallet) {
      emitBlockchainTx({ label, status: 'failed', error: 'wallet changed after session start' });
      return false;
    }
    if (this.sessionExpiresAt > 0 && Math.floor(Date.now() / 1000) > this.sessionExpiresAt) {
      emitBlockchainTx({ label, status: 'failed', error: 'session key expired' });
      return false;
    }
    return true;
  }

  private async readPlayerLedger(walletPubkey: string): Promise<PlayerLedgerSnapshot | null> {
    const playerLedgerPda = this.ledgerClient.derivePlayerLedgerPda(walletPubkey);
    const accountInfo = await this.connection.getAccountInfo(playerLedgerPda);
    if (!accountInfo?.data) return null;
    return this.ledgerClient.decodePlayerLedgerAccount(accountInfo.data);
  }

  private resolveGameplayEntity(
    unitType: string,
    label: string,
  ): ValkyrixGameplayEntity | null {
    const entity = GAMEPLAY_ENTITY_MAP[unitType];
    if (entity) return entity;
    emitBlockchainTx({
      label,
      status: 'failed',
      error: `unsupported gameplay entity: ${unitType}`,
    });
    return null;
  }

  private queueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(() => operation(), () => operation());
    this.writeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async sendWalletInstructions(
    instructions: TransactionInstruction[],
    walletPubkey: string,
    labels: string[],
    extraSigners: Keypair[] = [],
  ): Promise<string> {
    for (const label of labels) {
      emitBlockchainTx({ label, status: 'pending' });
    }
    try {
      const walletState = getCurrentState();
      if (!walletState.connected || !walletState.walletType || walletState.publicKey !== walletPubkey) {
        throw new Error(`[BlockchainService] ${labels[labels.length - 1] ?? 'wallet_tx'} requires an active connected wallet`);
      }

      const provider = getProvider(walletState.walletType);
      if (!provider?.signTransaction) {
        throw new Error(`[BlockchainService] ${labels[labels.length - 1] ?? 'wallet_tx'} requires signTransaction support`);
      }

      const feePayer = new PublicKey(walletPubkey);
      const tx = await this.prepareTransaction(feePayer, instructions);
      if (extraSigners.length > 0) {
        tx.partialSign(...extraSigners);
      }

      const signedTx = await provider.signTransaction(tx);
      return this.dispatchSignedTransaction(
        signedTx as Transaction,
        labels.map((label) => ({ label })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const label of labels) {
        emitBlockchainTx({ label, status: 'failed', error: message });
      }
      throw error;
    }
  }

  private async sendSessionInstruction(
    instruction: TransactionInstruction,
    label: string,
    detail: { entity?: string; outcome?: string } = {},
  ): Promise<string> {
    emitBlockchainTx({ label, status: 'pending', ...detail });
    try {
      if (!this.sessionSigner) {
        throw new Error(`[BlockchainService] ${label} requires an active session signer`);
      }
      const tx = await this.prepareTransaction(this.sessionSigner.publicKey, [instruction]);
      tx.partialSign(this.sessionSigner);
      return this.dispatchSignedTransaction(tx, [{ label, ...detail }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitBlockchainTx({ label, status: 'failed', error: message, ...detail });
      throw error;
    }
  }

  private async prepareTransaction(
    feePayer: PublicKey,
    instructions: TransactionInstruction[],
  ): Promise<Transaction> {
    const tx = new Transaction();
    tx.feePayer = feePayer;
    for (const instruction of instructions) {
      tx.add(instruction);
    }

    if (this.connection.prepareTransaction) {
      return this.connection.prepareTransaction(tx);
    }

    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    return tx;
  }

  private async dispatchSignedTransaction(
    signedTx: Transaction,
    labels: Array<{ label: string; entity?: string; outcome?: string }>,
  ): Promise<string> {
    const rawTx = signedTx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const signature = await this.connection.sendRawTransaction(rawTx, { skipPreflight: true });
    for (const entry of labels) {
      emitBlockchainTx({ ...entry, status: 'sent', signature });
    }
    return signature;
  }
}
