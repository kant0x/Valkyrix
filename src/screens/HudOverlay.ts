// src/screens/HudOverlay.ts
// Persistent in-game HUD bar. Mounted by the game screen, not ScreenManager.
// Phase 2: structural placeholder with stub values.
// Phase 3: call update({ wave, health, citadelMaxHp, resources }) with real game data.
//          showWinLossOverlay('won'|'lost') renders a full-screen result overlay.

const STYLE_ID = 'vk-hud-style';
const OVERLAY_ID = 'vk-win-loss-overlay';
const HP_BAR_WIDTH = 120; // pixels for the full citadel HP bar

export interface HudState {
  wave?: number | string;
  health?: number | string;
  /** Maximum citadel HP — used to compute progress bar width. */
  citadelMaxHp?: number;
  resources?: number | string;
  /** When true, shows VICTORY! overlay text. */
  won?: boolean;
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
        <span class="vk-hud-bar-track" id="vk-hud-bar-track" style="display:none">
          <span class="vk-hud-bar-fill" id="vk-hud-bar-fill"></span>
        </span>
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
    // Also remove any lingering win/loss overlay
    document.getElementById(OVERLAY_ID)?.remove();
  }

  update(state: HudState): void {
    if (!this.el) return;

    // Wave number
    if (state.wave !== undefined) {
      const el = this.el.querySelector('#vk-hud-wave');
      if (el) el.textContent = `Wave ${state.wave}`;
    }

    // Citadel HP — numeric + optional progress bar
    if (state.health !== undefined) {
      const hp = Number(state.health);
      const numEl = this.el.querySelector('#vk-hud-health');
      if (numEl) numEl.textContent = String(state.health);

      const track = this.el.querySelector<HTMLElement>('#vk-hud-bar-track');
      const fill  = this.el.querySelector<HTMLElement>('#vk-hud-bar-fill');

      if (track && fill && state.citadelMaxHp !== undefined && state.citadelMaxHp > 0) {
        track.style.display = 'inline-block';
        const ratio = Math.max(0, Math.min(1, hp / state.citadelMaxHp));
        fill.style.width = `${Math.round(ratio * HP_BAR_WIDTH)}px`;
      }

      // DEFEAT overlay on death (hp <= 0)
      if (hp <= 0) {
        this.showWinLossOverlay('lost');
      }
    }

    // Resources — shown as "E: NNN" (electrolatov; emoji not universally supported in HUD fonts)
    if (state.resources !== undefined) {
      const el = this.el.querySelector('#vk-hud-resources');
      if (el) el.textContent = `E: ${Math.floor(Number(state.resources))}`;
    }

    // Explicit win flag
    if (state.won === true) {
      this.showWinLossOverlay('won');
    }
  }

  /**
   * Renders a full-screen HTML overlay with a VICTORY! or DEFEAT message and a
   * "Play Again" button that reloads the page.
   *
   * Safe to call multiple times — existing overlay is replaced, not duplicated.
   */
  showWinLossOverlay(result: 'won' | 'lost'): void {
    // Remove any existing overlay first
    document.getElementById(OVERLAY_ID)?.remove();

    const isVictory = result === 'won';
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    const titleText  = isVictory ? 'VICTORY!' : 'DEFEAT';
    const titleColor = isVictory ? '#f1c40f' : '#e74c3c';

    overlay.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'background:rgba(0,0,0,0.75)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'z-index:100',
      'font-family:sans-serif',
    ].join(';');

    overlay.innerHTML = `
      <div style="font-size:4rem;font-weight:bold;color:${titleColor};letter-spacing:0.1em;text-shadow:0 0 24px ${titleColor}88;">${titleText}</div>
      <button id="vk-play-again"
        style="margin-top:2rem;padding:0.75rem 2.5rem;font-size:1.1rem;background:${titleColor};color:#07111d;border:none;border-radius:6px;cursor:pointer;font-weight:bold;letter-spacing:0.05em;">
        Play Again
      </button>
    `;

    document.body.appendChild(overlay);

    const btn = overlay.querySelector<HTMLButtonElement>('#vk-play-again');
    if (btn) {
      btn.addEventListener('click', () => {
        window.location.reload();
      });
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
      .vk-hud-bar-track {
        display: inline-block; width: ${HP_BAR_WIDTH}px; height: 8px;
        background: rgba(255,255,255,0.12); border-radius: 4px; overflow: hidden;
        vertical-align: middle;
      }
      .vk-hud-bar-fill {
        display: block; height: 100%;
        background: #e74c3c; border-radius: 4px;
        transition: width 0.1s linear;
      }
    `;
    document.head.appendChild(style);
  }
}
