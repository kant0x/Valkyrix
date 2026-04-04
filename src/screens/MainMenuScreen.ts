// src/screens/MainMenuScreen.ts
import type { ScreenModule, ScreenManager } from './ScreenManager';
import { requestBattleSessionMode } from '../blockchain/BattleSessionState';
import { getCurrentState } from '../wallet/WalletService';
import { t } from '../i18n/localization';

const STYLE_ID = 'vk-main-menu-style';
type SessionConnectLike = { connect(): Promise<void> };

export class MainMenuScreen implements ScreenModule {
  private el: HTMLElement | null = null;
  private readonly manager: ScreenManager;
  private readonly session: SessionConnectLike | null;

  constructor(manager: ScreenManager, session?: SessionConnectLike) {
    this.manager = manager;
    this.session = session ?? null;
  }

  mount(container: HTMLElement): void {
    this.ensureStyle();

    const el = document.createElement('div');
    el.id = 'vk-main-menu';
    el.innerHTML = `
      <div class="vk-menu-inner">
        <h1 class="vk-menu-title">VALKYRIX</h1>
        <div class="vk-menu-buttons">
          <button id="btn-play" class="vk-menu-btn">${t('menu.play')}</button>
          <button id="btn-leaderboard" class="vk-menu-btn">${t('menu.leaderboard')}</button>
        </div>
        <p id="vk-menu-status" class="vk-menu-status" style="display:none"></p>
      </div>
    `;
    container.appendChild(el);
    this.el = el;
    this.bindButtons(el);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }

  private bindButtons(el: HTMLElement): void {
    const playBtn = el.querySelector<HTMLButtonElement>('#btn-play');
    const leaderboardBtn = el.querySelector<HTMLButtonElement>('#btn-leaderboard');
    const statusEl = el.querySelector<HTMLElement>('#vk-menu-status');

    playBtn?.addEventListener('click', async () => {
      if (!playBtn) return;
      playBtn.disabled = true;
      playBtn.textContent = t('wallet.connecting');
      if (statusEl) {
        statusEl.textContent = t('menu.statusConnect');
        statusEl.style.display = 'block';
      }
      try {
        const wallet = getCurrentState();
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error(t('game.connectWalletFirst'));
        }
        const mode = requestBattleSessionMode();
        if (mode === 'cheap-tx') {
          if (this.session) {
            await this.session.connect();
          } else {
            const { SessionLayer } = await import('../session/SessionLayer');
            await new SessionLayer().connect();
          }
        }
        this.manager.navigateTo('game');
      } catch (err) {
        playBtn.disabled = false;
        playBtn.textContent = t('menu.play');
        if (statusEl) {
          statusEl.textContent = err instanceof Error && err.name === 'ChainUnavailableError'
            ? err.message
            : err instanceof Error
            ? err.message
            : t('menu.statusConnectFailed');
        }
      }
    });

    leaderboardBtn?.addEventListener('click', () => {
      void (async () => {
        if (!leaderboardBtn) return;
        leaderboardBtn.disabled = true;
        leaderboardBtn.textContent = t('common.loading');
        if (statusEl) {
          statusEl.textContent = t('menu.statusLeaderboard');
          statusEl.style.display = 'block';
        }

        try {
          const { publicKey } = getCurrentState();
          const [{ LeaderboardService }, { LeaderboardOverlay }] = await Promise.all([
            import('../blockchain/LeaderboardService'),
            import('./LeaderboardOverlay'),
          ]);
          const overlay = new LeaderboardOverlay();
          overlay.setCurrentWallet(publicKey);
          const entries = publicKey
            ? await new LeaderboardService().fetchLeaderboard(publicKey)
            : [];
          overlay.show(entries);
          if (statusEl) statusEl.style.display = 'none';
        } catch (err) {
          if (statusEl) {
            statusEl.textContent = err instanceof Error ? err.message : t('menu.statusLeaderboardFailed');
            statusEl.style.display = 'block';
          }
        } finally {
          leaderboardBtn.disabled = false;
          leaderboardBtn.textContent = t('menu.leaderboard');
        }
      })();
    });
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #vk-main-menu {
        position: fixed; inset: 0;
        background: #0b1220;
        display: flex; align-items: center; justify-content: center;
        z-index: 10;
      }
      .vk-menu-inner { display: flex; flex-direction: column; align-items: center; gap: 32px; }
      .vk-menu-title { color: #c8d8e8; font-size: 3rem; letter-spacing: 0.2em; font-family: sans-serif; }
      .vk-menu-buttons { display: flex; gap: 16px; }
      .vk-menu-btn {
        background: rgba(151,194,235,0.18); color: #c8d8e8;
        border: 1px solid rgba(151,194,235,0.35); border-radius: 6px;
        padding: 14px 40px; font-size: 1.1rem; cursor: pointer;
        font-family: sans-serif; min-width: 160px;
        transition: background 0.15s;
      }
      .vk-menu-btn:hover { background: rgba(151,194,235,0.28); }
      .vk-menu-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .vk-menu-status { color: #8aa8c8; font-size: 0.85rem; font-family: sans-serif; }
    `;
    document.head.appendChild(style);
  }
}
