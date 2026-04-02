import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockchainService } from './BlockchainService';
import type { PlayerLedgerSnapshot } from './ValkyrixLedgerClient';
import { getCurrentState, getProvider } from '../wallet/WalletService';

vi.mock('../wallet/WalletService', () => ({
  getCurrentState: vi.fn(() => ({
    connected: true,
    publicKey: '11111111111111111111111111111111',
    walletType: 'phantom',
  })),
  getProvider: vi.fn(() => ({
    publicKey: { toString: () => '11111111111111111111111111111111' },
    isConnected: true,
    connect: vi.fn(async () => ({
      publicKey: { toString: () => '11111111111111111111111111111111' },
    })),
    disconnect: vi.fn(async () => undefined),
    signTransaction: vi.fn(async () => ({
      serialize: () => new Uint8Array([1, 2, 3]),
    })),
    signAndSendTransaction: vi.fn(async () => ({ signature: 'sig' })),
  })),
}));

const TEST_WALLET = '11111111111111111111111111111111';

function makePublicKey(seed: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes.fill(seed);
  return new PublicKey(bytes);
}

function makeInstruction(label: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: SystemProgram.programId,
    data: Buffer.from(label, 'utf-8'),
  });
}

function makeLedgerSnapshot(): PlayerLedgerSnapshot {
  return {
    player: TEST_WALLET,
    game: makePublicKey(7).toBase58(),
    bestScore: 99,
    lastSessionScore: 77,
    gamesPlayed: 2,
    totalKills: 12,
    totalCreates: 9,
    bossKills: 1,
    bossNegotiations: 1,
    currentSessionNonce: 42n,
    currentSessionAuthority: makePublicKey(8).toBase58(),
    currentSessionExpiresAt: 999n,
    currentSessionScore: 77,
    currentSessionKills: 5,
    currentSessionCreates: 2,
    currentSessionActive: false,
    bossOutcomeRecorded: true,
    currentSessionEventIndex: 3n,
    gamesWon: 0,
    wavesStarted: 0,
    bump: 254,
  };
}

function makeMockLedgerClient() {
  const gameConfigPda = makePublicKey(5);
  const playerLedgerPda = makePublicKey(6);
  return {
    gameConfigPda,
    playerLedgerPda,
    client: {
      deriveGameConfigPda: vi.fn(() => gameConfigPda),
      derivePlayerLedgerPda: vi.fn(() => playerLedgerPda),
      buildInitializeGameInstruction: vi.fn(() => makeInstruction('initialize_game')),
      buildInitializePlayerInstruction: vi.fn(() => makeInstruction('initialize_player')),
      buildStartSessionInstruction: vi.fn(() => makeInstruction('start_session')),
      buildRecordKillInstruction: vi.fn(() => makeInstruction('record_kill')),
      buildRecordCreateInstruction: vi.fn(() => makeInstruction('record_create')),
      buildRecordBossOutcomeInstruction: vi.fn(() => makeInstruction('record_boss_outcome')),
      buildFinalizeSessionInstruction: vi.fn(() => makeInstruction('finalize_session')),
      decodePlayerLedgerAccount: vi.fn(() => makeLedgerSnapshot()),
    },
  };
}

function makeMockConnection() {
  const accounts = new Map<string, { data: Uint8Array }>();
  return {
    accounts,
    getLatestBlockhash: vi.fn(async () => ({
      blockhash: TEST_WALLET,
      lastValidBlockHeight: 1,
    })),
    getAccountInfo: vi.fn(async (pubkey: PublicKey) => accounts.get(pubkey.toBase58()) ?? null),
    sendRawTransaction: vi.fn(async () => 'mockSignature'),
    confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
  };
}

describe('BlockchainService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes missing game and player PDAs before starting session', async () => {
    const mockConn = makeMockConnection();
    const mockLedger = makeMockLedgerClient();
    const service = new BlockchainService(
      mockConn as never,
      mockLedger.client as never,
    );

    await service.initSession(TEST_WALLET);

    expect(mockLedger.client.buildInitializeGameInstruction).toHaveBeenCalledTimes(1);
    expect(mockLedger.client.buildInitializePlayerInstruction).toHaveBeenCalledTimes(1);
    expect(mockLedger.client.buildStartSessionInstruction).toHaveBeenCalledTimes(1);
    expect(mockConn.sendRawTransaction).toHaveBeenCalledTimes(1);
    expect(mockConn.sendRawTransaction).toHaveBeenNthCalledWith(
      1,
      expect.any(Uint8Array),
      { skipPreflight: true },
    );
  });

  it('skips initialization txs when PDAs already exist', async () => {
    const mockConn = makeMockConnection();
    const mockLedger = makeMockLedgerClient();
    mockConn.accounts.set(mockLedger.gameConfigPda.toBase58(), { data: new Uint8Array([1]) });
    mockConn.accounts.set(mockLedger.playerLedgerPda.toBase58(), { data: new Uint8Array([2]) });
    const service = new BlockchainService(
      mockConn as never,
      mockLedger.client as never,
    );

    await service.initSession(TEST_WALLET);

    expect(mockLedger.client.buildInitializeGameInstruction).not.toHaveBeenCalled();
    expect(mockLedger.client.buildInitializePlayerInstruction).not.toHaveBeenCalled();
    expect(mockLedger.client.buildStartSessionInstruction).toHaveBeenCalledTimes(1);
    expect(mockConn.sendRawTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not emit gameplay txs before session start', async () => {
    const mockConn = makeMockConnection();
    const mockLedger = makeMockLedgerClient();
    const service = new BlockchainService(
      mockConn as never,
      mockLedger.client as never,
    );

    await service.recordCreate('collector', TEST_WALLET);
    await service.recordKill('heavy-enemy', TEST_WALLET);

    expect(mockConn.sendRawTransaction).not.toHaveBeenCalled();
    expect(mockLedger.client.buildRecordCreateInstruction).not.toHaveBeenCalled();
    expect(mockLedger.client.buildRecordKillInstruction).not.toHaveBeenCalled();
  });

  it('records create, kill and boss outcome once session is active', async () => {
    const mockConn = makeMockConnection();
    const mockLedger = makeMockLedgerClient();
    mockConn.accounts.set(mockLedger.gameConfigPda.toBase58(), { data: new Uint8Array([1]) });
    mockConn.accounts.set(mockLedger.playerLedgerPda.toBase58(), { data: new Uint8Array([2]) });
    const service = new BlockchainService(
      mockConn as never,
      mockLedger.client as never,
    );

    await service.initSession(TEST_WALLET);
    await service.recordCreate('collector', TEST_WALLET);
    await service.recordKill('heavy-enemy', TEST_WALLET);
    await service.recordBossOutcome('negotiated', TEST_WALLET);

    expect(mockLedger.client.buildRecordCreateInstruction).toHaveBeenCalledTimes(1);
    expect(mockLedger.client.buildRecordCreateInstruction).toHaveBeenCalledWith(
      TEST_WALLET,
      expect.any(PublicKey),
      'collector',
      1n,
    );
    expect(mockLedger.client.buildRecordKillInstruction).toHaveBeenCalledTimes(1);
    expect(mockLedger.client.buildRecordKillInstruction).toHaveBeenCalledWith(
      TEST_WALLET,
      expect.any(PublicKey),
      'heavy-enemy',
      2n,
    );
    expect(mockLedger.client.buildRecordBossOutcomeInstruction).toHaveBeenCalledTimes(1);
    expect(mockLedger.client.buildRecordBossOutcomeInstruction).toHaveBeenCalledWith(
      TEST_WALLET,
      expect.any(PublicKey),
      'negotiated',
      3n,
    );
    expect(mockConn.sendRawTransaction).toHaveBeenCalledTimes(4);
  });

  it('endSession finalizes and returns on-chain snapshot when available', async () => {
    const mockConn = makeMockConnection();
    const mockLedger = makeMockLedgerClient();
    mockConn.accounts.set(mockLedger.gameConfigPda.toBase58(), { data: new Uint8Array([1]) });
    mockConn.accounts.set(mockLedger.playerLedgerPda.toBase58(), { data: new Uint8Array([9, 9, 9]) });
    const service = new BlockchainService(
      mockConn as never,
      mockLedger.client as never,
    );

    await service.initSession(TEST_WALLET);
    const result = await service.endSession();

    expect(mockLedger.client.buildFinalizeSessionInstruction).toHaveBeenCalledTimes(1);
    expect(mockLedger.client.buildFinalizeSessionInstruction).toHaveBeenCalledWith(
      TEST_WALLET,
      expect.any(PublicKey),
    );
    expect(mockLedger.client.decodePlayerLedgerAccount).toHaveBeenCalledWith(new Uint8Array([9, 9, 9]));
    expect(result).toEqual({ score: 77, kills: 5 });
  });

  it('throws when wallet cannot sign initSession transactions', async () => {
    vi.mocked(getProvider).mockReturnValueOnce({
      publicKey: { toString: () => TEST_WALLET },
      isConnected: true,
      connect: vi.fn(async () => ({
        publicKey: { toString: () => TEST_WALLET },
      })),
      disconnect: vi.fn(async () => undefined),
      signAndSendTransaction: vi.fn(async () => ({ signature: 'sig' })),
    });
    const mockConn = makeMockConnection();
    const mockLedger = makeMockLedgerClient();
    const service = new BlockchainService(
      mockConn as never,
      mockLedger.client as never,
    );

    await expect(service.initSession(TEST_WALLET)).rejects.toThrow('signTransaction');
    expect(mockConn.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('does nothing for recordKill when wallet pubkey is null', async () => {
    const mockConn = makeMockConnection();
    const mockLedger = makeMockLedgerClient();
    const service = new BlockchainService(
      mockConn as never,
      mockLedger.client as never,
    );

    await service.recordKill('heavy-enemy', null);

    expect(mockConn.sendRawTransaction).not.toHaveBeenCalled();
    expect(mockLedger.client.buildRecordKillInstruction).not.toHaveBeenCalled();
  });

  it('keeps sending gameplay txs after wallet disconnect once session signer is active', async () => {
    vi.mocked(getCurrentState).mockReturnValueOnce({
      connected: true,
      publicKey: TEST_WALLET,
      walletType: 'phantom',
    });
    const mockConn = makeMockConnection();
    const mockLedger = makeMockLedgerClient();
    mockConn.accounts.set(mockLedger.gameConfigPda.toBase58(), { data: new Uint8Array([1]) });
    mockConn.accounts.set(mockLedger.playerLedgerPda.toBase58(), { data: new Uint8Array([2]) });
    const service = new BlockchainService(
      mockConn as never,
      mockLedger.client as never,
    );

    await service.initSession(TEST_WALLET);
    vi.mocked(getCurrentState).mockReturnValue({
      connected: false,
      publicKey: null,
      walletType: null,
    });

    await expect(service.recordCreate('collector', TEST_WALLET)).resolves.toBeUndefined();
  });

  it('serializes gameplay writes so event indexes remain ordered', async () => {
    const mockConn = makeMockConnection();
    const mockLedger = makeMockLedgerClient();
    mockConn.accounts.set(mockLedger.gameConfigPda.toBase58(), { data: new Uint8Array([1]) });
    mockConn.accounts.set(mockLedger.playerLedgerPda.toBase58(), { data: new Uint8Array([2]) });
    const service = new BlockchainService(
      mockConn as never,
      mockLedger.client as never,
    );

    await service.initSession(TEST_WALLET);
    await Promise.all([
      service.recordCreate('collector', TEST_WALLET),
      service.recordKill('heavy-enemy', TEST_WALLET),
      service.recordBossOutcome('killed', TEST_WALLET),
    ]);

    expect(mockLedger.client.buildRecordCreateInstruction).toHaveBeenCalledWith(
      TEST_WALLET,
      expect.any(PublicKey),
      'collector',
      1n,
    );
    expect(mockLedger.client.buildRecordKillInstruction).toHaveBeenCalledWith(
      TEST_WALLET,
      expect.any(PublicKey),
      'heavy-enemy',
      2n,
    );
    expect(mockLedger.client.buildRecordBossOutcomeInstruction).toHaveBeenCalledWith(
      TEST_WALLET,
      expect.any(PublicKey),
      'killed',
      3n,
    );
  });
});
