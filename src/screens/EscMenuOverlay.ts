// src/screens/EscMenuOverlay.ts
// ESC key overlay that does NOT pause the game loop.
// Mounted by the game screen alongside HudOverlay — not a ScreenModule.
// The game loop (requestAnimationFrame) runs continuously regardless of overlay state.

import type { ScreenManager } from './ScreenManager';
import { t } from '../i18n/localization';

const STYLE_ID = 'vk-esc-overlay-style';

export class EscMenuOverlay {
  private el: HTMLElement | null = null;
  private visible = false;
  private musicEnabled = true;
  private readonly manager: ScreenManager;

  constructor(manager: ScreenManager) {
    this.manager = manager;
  }

  mount(container: HTMLElement): void {
    this.ensureStyle();

    const el = document.createElement('div');
    el.id = 'vk-esc-overlay';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="vk-esc-panel">
        <div class="vk-esc-head">
          <p class="vk-esc-kicker">${t('esc.kicker')}</p>
          <h2 class="vk-esc-title">${t('esc.title')}</h2>
        </div>
        <button id="btn-resume-battle" class="vk-esc-btn vk-esc-btn-primary">${t('esc.resume')}</button>
        <label class="vk-esc-music">
          <input type="checkbox" id="vk-music-toggle" checked />
          ${t('esc.music')}
        </label>
        <button id="btn-exit-menu" class="vk-esc-btn">${t('esc.exit')}</button>
        <div id="vk-exit-confirm" class="vk-exit-confirm" style="display:none">
          <p>${t('esc.confirm')}</p>
          <div class="vk-confirm-buttons">
            <button id="btn-confirm-exit" class="vk-esc-btn vk-btn-danger">${t('esc.confirmExit')}</button>
            <button id="btn-cancel-exit" class="vk-esc-btn">${t('esc.stay')}</button>
          </div>
        </div>
        <p class="vk-esc-hint">${t('esc.hint')}</p>
      </div>
    `;
    container.appendChild(el);
    this.el = el;

    this.bindEvents(el);
    document.addEventListener('keydown', this.onKey);
  }

  unmount(): void {
    document.removeEventListener('keydown', this.onKey);
    this.el?.remove();
    this.el = null;
    this.visible = false;
  }

  toggle(): void {
    this.visible = !this.visible;
    if (!this.visible) {
      this.resetExitPrompt();
    }
    this.syncVisibility();
  }

  private close(): void {
    this.visible = false;
    this.resetExitPrompt();
    this.syncVisibility();
  }

  private syncVisibility(): void {
    if (this.el) {
      this.el.style.display = this.visible ? 'flex' : 'none';
    }
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.toggle();
    }
  };

  private bindEvents(el: HTMLElement): void {
    const musicToggle = el.querySelector<HTMLInputElement>('#vk-music-toggle');
    const resumeBtn = el.querySelector<HTMLButtonElement>('#btn-resume-battle');
    const exitBtn = el.querySelector<HTMLButtonElement>('#btn-exit-menu');
    const confirmEl = el.querySelector<HTMLElement>('#vk-exit-confirm');
    const confirmExitBtn = el.querySelector<HTMLButtonElement>('#btn-confirm-exit');
    const cancelExitBtn = el.querySelector<HTMLButtonElement>('#btn-cancel-exit');

    musicToggle?.addEventListener('change', () => {
      this.musicEnabled = musicToggle.checked;
    });

    resumeBtn?.addEventListener('click', () => {
      this.close();
    });

    exitBtn?.addEventListener('click', () => {
      if (confirmEl) confirmEl.style.display = 'block';
      if (exitBtn) exitBtn.style.display = 'none';
    });

    confirmExitBtn?.addEventListener('click', () => {
      this.unmount();
      this.manager.navigateTo('menu');
    });

    cancelExitBtn?.addEventListener('click', () => {
      this.resetExitPrompt();
    });
  }

  private resetExitPrompt(): void {
    const confirmEl = this.el?.querySelector<HTMLElement>('#vk-exit-confirm');
    const exitBtn = this.el?.querySelector<HTMLButtonElement>('#btn-exit-menu');
    if (confirmEl) confirmEl.style.display = 'none';
    if (exitBtn) exitBtn.style.display = 'block';
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #vk-esc-overlay {
        position: fixed; inset: 0;
        background:
          radial-gradient(circle at top, rgba(62, 126, 186, 0.12), transparent 42%),
          rgba(7,17,29,0.88);
        align-items: center; justify-content: center;
        z-index: 100;
        backdrop-filter: blur(12px);
      }
      .vk-esc-panel {
        width: min(92vw, 420px);
        background:
          linear-gradient(180deg, rgba(13, 21, 31, 0.98), rgba(6, 11, 18, 0.98)),
          linear-gradient(135deg, rgba(58, 118, 176, 0.16), transparent 55%);
        border: 1px solid rgba(151,194,235,0.22);
        border-radius: 24px;
        padding: 30px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        align-items: stretch;
        box-shadow:
          0 36px 72px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(233, 244, 255, 0.04),
          inset 0 0 0 1px rgba(36, 64, 96, 0.2);
      }
      .vk-esc-head {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(129, 178, 220, 0.12);
      }
      .vk-esc-kicker {
        margin: 0;
        color: #7bb9e8;
        font-size: 0.72rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-family: "Bahnschrift", "Trebuchet MS", sans-serif;
      }
      .vk-esc-title {
        margin: 0;
        color: #e0f1ff;
        font-family: "Copperplate Gothic Bold", "Bahnschrift", sans-serif;
        font-size: 1.95rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .vk-esc-music {
        color: #9dc0de;
        font-family: "Bahnschrift", "Trebuchet MS", sans-serif;
        display: flex;
        gap: 8px;
        align-items: center;
        cursor: pointer;
        justify-content: center;
      }
      .vk-esc-btn {
        background:
          linear-gradient(180deg, rgba(27,47,71,0.92), rgba(14,25,38,0.98)),
          linear-gradient(135deg, rgba(84, 198, 255, 0.08), transparent 52%);
        color: #d9ecff;
        border: 1px solid rgba(151,194,235,0.28);
        border-radius: 16px;
        padding: 13px 18px;
        font-size: 0.95rem;
        cursor: pointer;
        font-family: "Bahnschrift", "Trebuchet MS", sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        width: 100%;
        transition: transform 0.15s, border-color 0.15s, background 0.15s;
      }
      .vk-esc-btn:hover {
        transform: translateY(-1px);
        background: linear-gradient(180deg, rgba(34,58,86,0.96), rgba(15,28,44,1));
        border-color: rgba(174,213,247,0.4);
      }
      .vk-esc-btn-primary {
        box-shadow: 0 0 0 1px rgba(105, 203, 255, 0.12), 0 0 24px rgba(76, 192, 255, 0.14);
      }
      .vk-btn-danger {
        border-color: rgba(240,106,106,0.45);
        color: #ffb0b0;
      }
      .vk-btn-danger:hover {
        background: linear-gradient(180deg, rgba(88,30,30,0.96), rgba(52,16,16,1));
      }
      .vk-exit-confirm {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
        width: 100%;
        padding: 14px;
        border-radius: 16px;
        background: rgba(9, 15, 24, 0.86);
        border: 1px solid rgba(240,106,106,0.18);
      }
      .vk-exit-confirm p {
        margin: 0;
        color: #d9ecff;
        font-family: "Bahnschrift", "Trebuchet MS", sans-serif;
        font-size: 0.92rem;
        line-height: 1.45;
        text-align: center;
      }
      .vk-confirm-buttons { display: flex; gap: 10px; width: 100%; }
      .vk-esc-hint {
        margin: 0;
        color: #6f8faa;
        font-size: 0.75rem;
        font-family: "Bahnschrift", "Trebuchet MS", sans-serif;
        text-align: center;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    `;
    document.head.appendChild(style);
  }
}
