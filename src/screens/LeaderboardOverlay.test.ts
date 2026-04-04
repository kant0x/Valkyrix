import { beforeEach, describe, expect, it } from 'vitest';
import { LeaderboardOverlay } from './LeaderboardOverlay';
import type { LeaderboardEntry } from '../blockchain/blockchain.types';

const sampleEntries: LeaderboardEntry[] = [
  { player: 'WalletABCDEFGH1234', score: 120, kills: 12, rank: 1 },
  { player: 'WalletXYZPQRST5678', score: 50, kills: 5, rank: 2 },
];

describe('LeaderboardOverlay', () => {
  let overlay: LeaderboardOverlay;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    overlay = new LeaderboardOverlay();
  });

  it('show appends a leaderboard overlay to the body', () => {
    overlay.show(sampleEntries);
    expect(document.querySelector('.leaderboard-overlay')).not.toBeNull();
  });

  it('renders the correct number of rows', () => {
    overlay.show(sampleEntries);
    expect(document.querySelectorAll('.vk-leaderboard-row')).toHaveLength(2);
  });

  it('renders an empty state when there are no entries', () => {
    overlay.show([]);
    expect(document.body.textContent).toContain('Нет результатов');
  });

  it('hide removes the overlay', () => {
    overlay.show(sampleEntries);
    overlay.hide();
    expect(document.getElementById('vk-leaderboard-overlay')).toBeNull();
  });

  it('show is idempotent and does not duplicate overlays', () => {
    overlay.show(sampleEntries);
    overlay.show(sampleEntries);
    expect(document.querySelectorAll('.leaderboard-overlay')).toHaveLength(1);
  });

  it('renders rank, truncated wallet, score, and kills', () => {
    overlay.show(sampleEntries);
    const firstRow = document.querySelector('.vk-leaderboard-row');
    expect(firstRow?.textContent).toContain('#1');
    expect(firstRow?.textContent).toContain('Wall...1234');
    expect(firstRow?.textContent).toContain('120');
    expect(firstRow?.textContent).toContain('12');
  });

  it('renders Russian column headers', () => {
    overlay.show(sampleEntries);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Кошелёк');
    expect(text).toContain('Очки');
    expect(text).toContain('Убийства');
  });

  it('highlights the current wallet row', () => {
    overlay.setCurrentWallet('WalletABCDEFGH1234');
    overlay.show(sampleEntries);
    expect(document.querySelector('.own-entry')?.textContent).toContain('#1');
  });

  it('close button hides the overlay', () => {
    overlay.show(sampleEntries);
    const btn = document.querySelector('.vk-leaderboard-close') as HTMLButtonElement;
    btn.click();
    expect(document.getElementById('vk-leaderboard-overlay')).toBeNull();
  });
});
