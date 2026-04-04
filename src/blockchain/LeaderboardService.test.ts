import { describe, expect, it, vi } from 'vitest';
import { LeaderboardService } from './LeaderboardService';

vi.mock('../wallet/WalletService', () => ({
  getCurrentState: vi.fn(() => ({
    connected: true,
    publicKey: 'PlayerWallet111',
    walletType: 'phantom',
  })),
  getProvider: vi.fn(() => ({
    publicKey: { toString: () => 'PlayerWallet111' },
    isConnected: true,
    connect: vi.fn(async () => ({ publicKey: { toString: () => 'PlayerWallet111' } })),
    disconnect: vi.fn(async () => undefined),
    signTransaction: vi.fn(async (tx: unknown) => tx),
    signAllTransactions: vi.fn(async (txs: unknown[]) => txs),
    signAndSendTransaction: vi.fn(async () => ({ signature: 'sig' })),
  })),
}));

function makeMockSoar() {
  const submitScoreToLeaderBoard = vi.fn(async () => ({ transaction: {} }));
  const sendAndConfirmTransaction = vi.fn(async () => 'sig');
  const fetchAllMock = vi.fn(async () => [
    { account: { player: { toString: () => 'WalletABC' }, score: 50050 } },
    { account: { player: { toString: () => 'WalletXYZ' }, score: 120120 } },
    { account: { player: { toString: () => 'WalletDEF' }, score: 30030 } },
    { account: { player: { toString: () => 'WalletOUTSIDE' }, score: 10010 } },
  ]);

  return {
    mockSoar: {
      submitScoreToLeaderBoard,
      sendAndConfirmTransaction,
      fetchAllLeaderboardAccounts: fetchAllMock,
    },
  };
}

describe('LeaderboardService', () => {
  it('fetchLeaderboard returns entries sorted by score with rank and kills', async () => {
    const { mockSoar } = makeMockSoar();
    const service = new LeaderboardService(mockSoar);

    const entries = await service.fetchLeaderboard();

    expect(entries[0]).toEqual({
      player: 'WalletXYZ',
      score: 12,
      kills: 120,
      rank: 1,
    });
    expect(entries[1].score).toBe(5);
    expect(entries[2].kills).toBe(30);
  });

  it('appends the current player if they are outside the top list', async () => {
    const { mockSoar } = makeMockSoar();
    const service = new LeaderboardService(mockSoar);

    const entries = await service.fetchLeaderboard('WalletOUTSIDE');

    expect(entries.find((entry) => entry.player === 'WalletOUTSIDE')?.rank).toBe(4);
  });

  it('returns an empty list when SOAR throws', async () => {
    const { mockSoar } = makeMockSoar();
    const service = new LeaderboardService({
      submitScoreToLeaderBoard: mockSoar.submitScoreToLeaderBoard,
      sendAndConfirmTransaction: mockSoar.sendAndConfirmTransaction,
      fetchAllLeaderboardAccounts: vi.fn(async () => {
        throw new Error('RPC down');
      }),
    });

    await expect(service.fetchLeaderboard()).resolves.toEqual([]);
  });

  it('submitScore is a no-op when SOAR_LEADERBOARD_PDA is null', async () => {
    const { mockSoar } = makeMockSoar();
    const service = new LeaderboardService(mockSoar);

    await expect(service.submitScore('PlayerWallet111', 42, 4)).resolves.toBeUndefined();
    expect(mockSoar.submitScoreToLeaderBoard).not.toHaveBeenCalled();
  });
});
