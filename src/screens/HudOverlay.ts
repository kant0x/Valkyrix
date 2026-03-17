// src/screens/HudOverlay.ts
// Persistent in-game HUD bar. Mounted by the game screen, not ScreenManager.
// Phase 2: structural placeholder with stub values.
// Phase 3: call update({ wave, health, resources }) with real game data.

const STYLE_ID = 'vk-hud-style';

export interface HudState {
  wave?: number | string;
  health?: number | string;
  resources?: number | string;
}

export class HudOverlay {
  private el: HTMLElement | null = null;

  mount(container: HTMLElement): void {
    this.ensureStyle();

    const el = document.createElement('div');
    el.id = 'vk-hud';
    el.innerHTML = `
      <div class="vk-hud-block">
        <span class="vk-hud-label">Wave</span>
        <span id="vk-hud-wave" class="vk-hud-value">&#x2014;</span>
      </div>
      <div class="vk-hud-block">
        <span class="vk-hud-label">Citadel HP</span>
        <span id="vk-hud-health" class="vk-hud-value">&#x2014;</span>
      </div>
      <div class="vk-hud-block">
        <span class="vk-hud-label">Resources</span>
        <span id="vk-hud-resources" class="vk-hud-value">&#x2014;</span>
      </div>
    `;
    container.appendChild(el);
    this.el = el;
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }

  update(state: HudState): void {
    if (!this.el) return;
    if (state.wave !== undefined) {
      const el = this.el.querySelector('#vk-hud-wave');
      if (el) el.textContent = String(state.wave);
    }
    if (state.health !== undefined) {
      const el = this.el.querySelector('#vk-hud-health');
      if (el) el.textContent = String(state.health);
    }
    if (state.resources !== undefined) {
      const el = this.el.querySelector('#vk-hud-resources');
      if (el) el.textContent = String(state.resources);
    }
  }

  private ensureStyle(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #vk-hud {
        position: fixed; bottom: 0; left: 0; right: 0;
        height: 48px;
        background: rgba(7,17,29,0.9);
        border-top: 1px solid rgba(151,194,235,0.15);
        display: flex; align-items: center; justify-content: center;
        gap: 48px; z-index: 50;
      }
      .vk-hud-block { display: flex; align-items: center; gap: 8px; }
      .vk-hud-label { color: #4a6a8a; font-family: sans-serif; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
      .vk-hud-value { color: #c8d8e8; font-family: sans-serif; font-size: 0.95rem; min-width: 2ch; }
    `;
    document.head.appendChild(style);
  }
}
