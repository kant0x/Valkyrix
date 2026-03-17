// src/screens/EscMenuOverlay.ts
// ESC key overlay that does NOT pause the game loop.
// Mounted by the game screen alongside HudOverlay — not a ScreenModule.
// The game loop (requestAnimationFrame) runs continuously regardless of overlay state.

import type { ScreenManager } from './ScreenManager';

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
        <h2 class="vk-esc-title">Menu</h2>
        <label class="vk-esc-music">
          <input type="checkbox" id="vk-music-toggle" checked />
          Music
        </label>
        <button id="btn-exit-menu" class="vk-esc-btn">Exit to Menu</button>
        <div id="vk-exit-confirm" class="vk-exit-confirm" style="display:none">
          <p>Progress will be lost. Exit?</p>
          <div class="vk-confirm-buttons">
            <button id="btn-confirm-exit" class="vk-esc-btn vk-btn-danger">Exit</button>
            <button id="btn-cancel-exit" class="vk-esc-btn">Stay</button>
          </div>
        </div>
        <p class="vk-esc-hint">Press ESC to close</p>
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
    const exitBtn = el.querySelector<HTMLButtonElement>('#btn-exit-menu');
    const confirmEl = el.querySelector<HTMLElement>('#vk-exit-confirm');
    const confirmExitBtn = el.querySelector<HTMLButtonElement>('#btn-confirm-exit');
    const cancelExitBtn = el.querySelector<HTMLButtonElement>('#btn-cancel-exit');

    musicToggle?.addEventListener('change', () => {
      this.musicEnabled = musicToggle.checked;
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
      if (confirmEl) confirmEl.style.display = 'none';
      if (exitBtn) exitBtn.style.display = 'block';
    });
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #vk-esc-overlay {
        position: fixed; inset: 0;
        background: rgba(7,17,29,0.85);
        align-items: center; justify-content: center;
        z-index: 100;
      }
      .vk-esc-panel {
        background: #0b1220; border: 1px solid rgba(151,194,235,0.25);
        border-radius: 8px; padding: 32px 40px;
        display: flex; flex-direction: column; gap: 20px; align-items: center;
        min-width: 280px;
      }
      .vk-esc-title { color: #c8d8e8; font-family: sans-serif; font-size: 1.4rem; }
      .vk-esc-music { color: #8aa8c8; font-family: sans-serif; display: flex; gap: 8px; align-items: center; cursor: pointer; }
      .vk-esc-btn {
        background: rgba(151,194,235,0.18); color: #c8d8e8;
        border: 1px solid rgba(151,194,235,0.35); border-radius: 6px;
        padding: 10px 28px; font-size: 0.95rem; cursor: pointer;
        font-family: sans-serif; width: 100%;
        transition: background 0.15s;
      }
      .vk-esc-btn:hover { background: rgba(151,194,235,0.28); }
      .vk-btn-danger { border-color: rgba(220,80,80,0.5); color: #e07070; }
      .vk-btn-danger:hover { background: rgba(220,80,80,0.2); }
      .vk-exit-confirm { display: flex; flex-direction: column; gap: 12px; align-items: center; width: 100%; }
      .vk-exit-confirm p { color: #c8d8e8; font-family: sans-serif; font-size: 0.9rem; }
      .vk-confirm-buttons { display: flex; gap: 10px; width: 100%; }
      .vk-esc-hint { color: #4a6a8a; font-size: 0.75rem; font-family: sans-serif; }
    `;
    document.head.appendChild(style);
  }
}
