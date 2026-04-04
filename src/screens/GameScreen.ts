import { EscMenuOverlay } from './EscMenuOverlay';
import { mountGameViewportLayout, type GameViewportLayoutRefs } from './GameViewportLayout';
import { HudOverlay } from './HudOverlay';
import type { ScreenManager, ScreenModule } from './ScreenManager';
import { GameSidePanelController } from './GameSidePanel';

export type GameScreenDeps = {
  sidePanel: GameSidePanelController;
  onLayoutReady: (layout: GameViewportLayoutRefs) => void;
  configureCanvas: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void;
  resetRuntimeState: () => void;
  bindInput: () => void;
  syncCanvasCursor: () => void;
  loadMap: () => Promise<void>;
  ensureAnimationLoop: () => void;
  onHudMounted: (hud: HudOverlay) => void;
  configureHud: (hud: HudOverlay) => void;
  createTowerClickHandler: (hud: HudOverlay) => (event: MouseEvent) => void;
  onBeforeUnmount: () => void;
};

export class GameScreen implements ScreenModule {
  private escMenu: EscMenuOverlay | null = null;
  private hud: HudOverlay | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private towerClickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(
    private readonly manager: ScreenManager,
    private readonly deps: GameScreenDeps,
  ) {}

  mount(container: HTMLElement): void {
    const layout = mountGameViewportLayout(container);
    this.canvas = layout.canvas;
    this.deps.onLayoutReady(layout);
    this.deps.sidePanel.bind({
      killsEl: layout.sideKillsEl,
      activeEl: layout.sideActiveEl,
      waveEl: layout.sideWaveEl,
      txListEl: layout.sideTxListEl,
    });

    const rawCtx = layout.canvas.getContext('2d');
    if (!rawCtx) {
      throw new Error('2D canvas context is unavailable');
    }
    this.deps.configureCanvas(layout.canvas, rawCtx);
    this.deps.resetRuntimeState();
    this.deps.sidePanel.resetState();
    this.deps.sidePanel.startMagicBlockTxFeed();
    this.deps.bindInput();
    this.deps.syncCanvasCursor();
    void this.deps.loadMap();
    this.deps.ensureAnimationLoop();

    this.escMenu = new EscMenuOverlay(this.manager);
    this.escMenu.mount(container);

    this.hud = new HudOverlay();
    this.hud.mount(layout.hudSlotEl);
    this.deps.onHudMounted(this.hud);
    this.deps.configureHud(this.hud);

    this.towerClickHandler = this.deps.createTowerClickHandler(this.hud);
    this.canvas.addEventListener('click', this.towerClickHandler);
  }

  unmount(): void {
    this.escMenu?.unmount();
    this.hud?.unmount();
    this.escMenu = null;
    this.hud = null;

    if (this.canvas && this.towerClickHandler) {
      this.canvas.removeEventListener('click', this.towerClickHandler as EventListener);
      this.towerClickHandler = null;
    }
    this.canvas = null;

    this.deps.onBeforeUnmount();
    this.deps.sidePanel.clear();
    this.deps.syncCanvasCursor();

    const container = document.getElementById('game-container');
    if (container) container.innerHTML = '';
  }
}
