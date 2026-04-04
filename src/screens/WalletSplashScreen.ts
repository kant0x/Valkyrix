// src/screens/WalletSplashScreen.ts
import type { ScreenModule } from './ScreenManager';
import type { ScreenManager } from './ScreenManager';
import { connectWallet } from '../wallet/WalletService';
import { t } from '../i18n/localization';

const STYLE_ID = 'vk-wallet-splash-style';

export class WalletSplashScreen implements ScreenModule {
  private el: HTMLElement | null = null;
  private readonly manager: ScreenManager;

  constructor(manager: ScreenManager) {
    this.manager = manager;
  }

  mount(container: HTMLElement): void {
    this.ensureStyle();

    const el = document.createElement('div');
    el.id = 'vk-wallet-splash';
    el.innerHTML = this.buildHTML();
    container.appendChild(el);
    this.el = el;

    this.bindButtons(el);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }

  private buildHTML(): string {
    return `
      <div class="vk-splash-inner">
        <h1 class="vk-splash-title">VALKYRIX</h1>
        <p class="vk-splash-subtitle">${t('wallet.connectTitle')}</p>
        <div class="vk-wallet-buttons">
          <button id="btn-phantom" class="vk-wallet-btn">${t('wallet.connectPhantom')}</button>
          <button id="btn-backpack" class="vk-wallet-btn">${t('wallet.connectBackpack')}</button>
        </div>
        <p class="vk-gas-notice">Each kill records a Solana transaction — you pay gas from your wallet.</p>
        <p id="vk-wallet-error" class="vk-wallet-error" style="display:none"></p>
      </div>
    `;
  }

  private bindButtons(el: HTMLElement): void {
    const phantomBtn = el.querySelector<HTMLButtonElement>('#btn-phantom');
    const backpackBtn = el.querySelector<HTMLButtonElement>('#btn-backpack');
    const errorEl = el.querySelector<HTMLElement>('#vk-wallet-error');

    const handleConnect = async (type: 'phantom' | 'backpack', btn: HTMLButtonElement) => {
      btn.disabled = true;
      btn.textContent = t('wallet.connecting');
      try {
        await connectWallet(type);
        this.manager.navigateTo('menu');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = type === 'phantom' ? t('wallet.connectPhantom') : t('wallet.connectBackpack');
        if (errorEl) {
          errorEl.textContent = err instanceof Error ? err.message : t('wallet.connectFailed');
          errorEl.style.display = 'block';
        }
      }
    };

    phantomBtn?.addEventListener('click', () => handleConnect('phantom', phantomBtn));
    backpackBtn?.addEventListener('click', () => handleConnect('backpack', backpackBtn));
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #vk-wallet-splash {
        position: fixed; inset: 0;
        background: #07111d;
        display: flex; align-items: center; justify-content: center;
        z-index: 10;
      }
      .vk-splash-inner { display: flex; flex-direction: column; align-items: center; gap: 24px; }
      .vk-splash-title { color: #c8d8e8; font-size: 3rem; letter-spacing: 0.2em; font-family: sans-serif; }
      .vk-splash-subtitle { color: #8aa8c8; font-family: sans-serif; font-size: 1rem; }
      .vk-wallet-buttons { display: flex; gap: 16px; }
      .vk-wallet-btn {
        background: rgba(151,194,235,0.18); color: #c8d8e8;
        border: 1px solid rgba(151,194,235,0.35); border-radius: 6px;
        padding: 12px 28px; font-size: 1rem; cursor: pointer;
        font-family: sans-serif; text-decoration: none;
        transition: background 0.15s;
      }
      .vk-wallet-btn:hover { background: rgba(151,194,235,0.28); }
      .vk-wallet-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .vk-wallet-install { opacity: 0.7; }
      .vk-gas-notice { color: #6a8ab8; font-size: 0.8rem; font-family: sans-serif; max-width: 360px; text-align: center; }
      .vk-wallet-error { color: #e87070; font-size: 0.85rem; font-family: sans-serif; }
    `;
    document.head.appendChild(style);
  }
}
