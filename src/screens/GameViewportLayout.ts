import { GAME_H, GAME_W, HUD_HEIGHT } from '../shared/RuntimeViewport';
import { t } from '../i18n/localization';

const STYLE_ID = 'valkyrix-runtime-style';

export type GameViewportLayoutRefs = {
  mapLabelEl: HTMLHeadingElement;
  modeChipEl: HTMLDivElement;
  statusEl: HTMLDivElement;
  mapStatsEl: HTMLPreElement;
  cameraStatsEl: HTMLPreElement;
  canvas: HTMLCanvasElement;
  hudSlotEl: HTMLElement;
  sideKillsEl: HTMLElement | null;
  sideActiveEl: HTMLElement | null;
  sideWaveEl: HTMLElement | null;
  sideTxListEl: HTMLElement | null;
};

export function mountGameViewportLayout(container: HTMLElement): GameViewportLayoutRefs {
  ensureRuntimeStyle();
  container.innerHTML = `
    <div class="vk-app">
      <div class="vk-runtime-layout">
        <section class="vk-shell">
          <div class="vk-viewport-frame">
            <div class="vk-viewport-corners">
              <div class="vk-vh-corner tl"></div><div class="vk-vh-corner tr"></div>
              <div class="vk-vh-corner bl"></div><div class="vk-vh-corner br"></div>
            </div>
            <canvas id="vk-canvas"></canvas>
            <div class="vk-overlay">
              <div class="vk-overlay-topline">
                <div class="vk-overlay-line" id="vk-status">${t('game.loadingMap')}</div>
                <div class="vk-chip" id="vk-mode-chip">camera</div>
              </div>
              <div class="vk-runtime-hidden" aria-hidden="true">
                <h1 id="vk-map-label">${t('game.activeMapLabel')}</h1>
                <pre id="vk-map-stats">booting...</pre>
                <pre id="vk-camera-stats">booting...</pre>
              </div>
            </div>
          </div>
          <footer id="vk-runtime-hud-slot" class="vk-runtime-hud-slot"></footer>
        </section>
        <aside id="vk-side-panel-slot" class="vk-side-slot" aria-label="Right Data Panel">
          <section class="vk-side-block">
            <div class="vk-side-title">${t('game.battleData')}</div>
            <div class="vk-side-row"><span>${t('game.wave')}</span><strong id="vk-side-wave">${t('game.waveShort', { value: 0 })}</strong></div>
            <div class="vk-side-row"><span>${t('game.activeEnemies')}</span><strong id="vk-side-active">0</strong></div>
            <div class="vk-side-row"><span>${t('game.enemiesKilled')}</span><strong id="vk-side-kills">0</strong></div>
          </section>
          <section class="vk-side-block vk-side-transactions">
            <div class="vk-side-title">${t('game.magicTx')}</div>
            <ul id="vk-side-transactions-list" class="vk-side-tx-list"></ul>
          </section>
        </aside>
      </div>
    </div>
  `;

  return {
    mapLabelEl: getRequiredElement<HTMLHeadingElement>('vk-map-label'),
    modeChipEl: getRequiredElement<HTMLDivElement>('vk-mode-chip'),
    statusEl: getRequiredElement<HTMLDivElement>('vk-status'),
    mapStatsEl: getRequiredElement<HTMLPreElement>('vk-map-stats'),
    cameraStatsEl: getRequiredElement<HTMLPreElement>('vk-camera-stats'),
    canvas: getRequiredElement<HTMLCanvasElement>('vk-canvas'),
    hudSlotEl: getRequiredElement<HTMLElement>('vk-runtime-hud-slot'),
    sideKillsEl: document.getElementById('vk-side-kills'),
    sideActiveEl: document.getElementById('vk-side-active'),
    sideWaveEl: document.getElementById('vk-side-wave'),
    sideTxListEl: document.getElementById('vk-side-transactions-list'),
  };
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element #${id}`);
  return el as T;
}

function ensureRuntimeStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      color-scheme: dark;
      font-family: "Trebuchet MS", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top, rgba(94, 149, 189, 0.18), transparent 34%),
        linear-gradient(180deg, #07111d 0%, #05070d 58%, #030406 100%);
    }
    * { box-sizing: border-box; }
    html, body, #game-container { width: 100%; height: 100%; }
    body {
      margin: 0;
      overflow: hidden;
      color: #d7e4f4;
      background-color: #03060a;
      background-image: linear-gradient(rgba(8, 14, 22, 0.94), rgba(4, 7, 12, 0.98));
    }
    .vk-app {
      min-height: 100%;
      display: grid;
      place-items: center start;
      padding: 18px;
      background-image:
        linear-gradient(to right, rgba(58, 108, 154, 0.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(58, 108, 154, 0.05) 1px, transparent 1px);
      background-size: 48px 48px;
      position: relative;
    }
    .vk-app::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(80, 160, 220, 0.1) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    .vk-runtime-layout {
      --vk-side-panel-w: 258px;
      position: relative;
      z-index: 1;
      display: flex;
      align-items: stretch;
      gap: 12px;
    }
    .vk-shell {
      width: min(calc(100vw - 36px - var(--vk-side-panel-w) - 12px), calc((100vh - 36px) * ${GAME_W} / ${GAME_H}));
      aspect-ratio: ${GAME_W} / ${GAME_H};
      position: relative;
      isolation: isolate;
      display: grid;
      grid-template-rows: 1fr ${HUD_HEIGHT}px;
      border: 1px solid rgba(151, 194, 235, 0.22);
      border-radius: 20px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(16, 26, 40, 0.97), rgba(7, 12, 20, 0.985)),
        linear-gradient(135deg, rgba(58, 108, 154, 0.14), transparent 44%),
        linear-gradient(225deg, rgba(94, 188, 255, 0.06), transparent 38%);
      box-shadow:
        0 32px 80px rgba(0, 0, 0, 0.6),
        0 0 0 16px rgba(10, 20, 32, 0.35),
        inset 0 0 0 1px rgba(255, 255, 255, 0.04);
    }
    .vk-chip {
      padding: 7px 12px;
      border-radius: 999px;
      border: 1px solid rgba(126, 190, 240, 0.24);
      background: rgba(10, 20, 32, 0.74);
      color: #cde7ff;
      font-size: 11px;
      white-space: nowrap;
      backdrop-filter: blur(6px);
    }
    .vk-viewport-frame {
      position: relative;
      background:
        radial-gradient(circle at top, rgba(36, 61, 89, 0.3), transparent 42%),
        linear-gradient(180deg, #08101b 0%, #04070d 100%);
      box-shadow: inset 0 -4px 16px rgba(0,0,0,0.5);
      border-bottom: 2px solid rgba(130, 182, 228, 0.2);
    }
    .vk-viewport-corners { position: absolute; inset: 4px; pointer-events: none; z-index: 10; }
    .vk-vh-corner {
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: rgba(110, 212, 255, 0.3);
      border-style: solid;
    }
    .vk-vh-corner.tl { top: 0; left: 0; border-width: 2px 0 0 2px; border-top-left-radius: 12px; }
    .vk-vh-corner.tr { top: 0; right: 0; border-width: 2px 2px 0 0; border-top-right-radius: 12px; }
    .vk-vh-corner.bl { bottom: 0; left: 0; border-width: 0 0 2px 2px; border-bottom-left-radius: 12px; }
    .vk-vh-corner.br { bottom: 0; right: 0; border-width: 0 2px 2px 0; border-bottom-right-radius: 12px; }
    #vk-canvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;
    }
    #vk-canvas:active {
      cursor: grabbing;
    }
    .vk-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding: 12px 14px;
    }
    .vk-overlay-topline {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .vk-overlay-line {
      align-self: flex-start;
      max-width: min(100%, 480px);
      padding: 7px 10px;
      border-radius: 12px;
      background: rgba(5, 9, 15, 0.68);
      border: 1px solid rgba(139, 194, 235, 0.14);
      color: #d7e8fa;
      font-size: 12px;
      line-height: 1.4;
      backdrop-filter: blur(6px);
    }
    .vk-runtime-hidden {
      display: none;
    }
    .vk-runtime-hud-slot {
      position: relative;
      z-index: 2;
      padding: 0;
      width: 100%;
      background: transparent;
      overflow: hidden;
    }
    .vk-side-slot {
      width: var(--vk-side-panel-w);
      flex: 0 0 var(--vk-side-panel-w);
      border-radius: 18px;
      border: 1px solid rgba(123, 178, 225, 0.2);
      background:
        linear-gradient(180deg, rgba(8, 16, 26, 0.98), rgba(4, 9, 15, 0.99)),
        linear-gradient(135deg, rgba(58, 118, 176, 0.1), transparent 56%);
      box-shadow:
        0 16px 34px rgba(0, 0, 0, 0.34),
        inset 0 1px 0 rgba(224, 242, 255, 0.05);
      backdrop-filter: blur(8px);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: auto;
      overflow: hidden;
    }
    .vk-side-block {
      border: 1px solid rgba(107, 163, 209, 0.18);
      border-radius: 12px;
      background: rgba(4, 11, 18, 0.6);
      padding: 10px;
    }
    .vk-side-title {
      color: #89b4d8;
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      margin-bottom: 8px;
      font-family: "Copperplate Gothic Bold", "Bahnschrift", sans-serif;
    }
    .vk-side-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: #96b7d3;
      font-size: 12px;
      padding: 4px 0;
    }
    .vk-side-row strong {
      color: #ebf6ff;
      font-size: 15px;
      letter-spacing: 0.04em;
    }
    .vk-side-transactions {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 0 0 360px;
      max-height: 360px;
    }
    .vk-side-tx-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 2px;
        scrollbar-gutter: stable;
    }
    .vk-side-tx-list li {
        display: block;
        width: 100%;
        box-sizing: border-box;
        padding: 8px 9px;
        border-radius: 10px;
        border: 1px solid rgba(95, 150, 194, 0.16);
        background: rgba(8, 16, 24, 0.66);
        color: #c9ddf2;
        font-size: 11px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
    @media (max-width: 960px) {
      .vk-app { padding: 10px; }
      .vk-runtime-layout {
        --vk-side-panel-w: 0px;
        width: 100%;
      }
      .vk-shell {
        width: min(calc(100vw - 20px), calc((100vh - 20px) * ${GAME_W} / ${GAME_H}));
        border-radius: 18px;
      }
      .vk-overlay-topline {
        flex-direction: column;
        align-items: flex-start;
      }
      .vk-runtime-hud-slot {
        padding: 0;
        width: 100%;
      }
      .vk-side-transactions {
        flex-basis: 280px;
        max-height: 280px;
      }
      .vk-side-slot { display: none; }
    }
  `;
  document.head.appendChild(style);
}
