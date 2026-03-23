import {
    centerToScroll,
    clampCenterToScrollBounds,
    clampScrollToIsoDiamond,
    computeRoadViewOffset,
    computeViewSize,
    scrollToCenter,
    type CameraIsoBounds,
    type CameraPoint,
    type CameraScrollBounds,
} from './shared/CameraMath';
import { GAME_MODE_TOP_BAR_HEIGHT, GAME_VIEW_H, GAME_W } from './shared/RuntimeViewport';
import { ScreenManager } from './screens/ScreenManager';
import { GameScreen } from './screens/GameScreen';
import { GameSidePanelController } from './screens/GameSidePanel';
import type { GameViewportLayoutRefs } from './screens/GameViewportLayout';
import { ValkyrixWalletSplashScreen } from './screens/ValkyrixWalletSplashScreen';
import { ValkyrixMainMenuScreen } from './screens/ValkyrixMainMenuScreen';
import { HudOverlay } from './screens/HudOverlay';
import { tryAutoConnect } from './wallet/WalletService';
import { createGameState } from './game/GameState';
import { WaveController } from './game/WaveController';
import { UnitSystem } from './game/UnitSystemRuntime';
import { BuildingSystem, canvasClickToTile, canvasPointToWorld, isWorldPointInsideTile } from './game/BuildingSystem';
import { ProjectileSystem } from './game/ProjectileSystem';
import { CombatSystem } from './game/CombatSystem';
import { GameRenderer } from './game/GameRenderer';
import { ResourceSystem } from './game/ResourceSystem';
import { canRecruitUnit, recruitUnit } from './game/RecruitmentSystem';
import { drawCitadelAura, drawCitadelEnergyFlow, drawCitadelOrbitingSwarm } from './rendering/BuildingEffects';
import { UNIT_DEFS } from './game/game.types';
import type { GameState } from './game/game.types';
import { BossSystem } from './game/BossSystem';

type LayerName = 'ground' | 'paths' | 'cam' | 'zones' | 'decor' | 'citadel' | 'spawn';

type MapCamera = {
    zoom?: number;
    startX?: number;
    startY?: number;
    moveMode?: string;
    roadDirection?: string;
    roadViewOffsetY?: number;
    boundsSource?: 'map' | 'layers' | 'none';
    boundsPad?: number;
    boundsEnabled?: boolean;
    boundsMinA?: number;
    boundsMaxA?: number;
    boundsMinB?: number;
    boundsMaxB?: number;
    boundsMinX?: number;
    boundsMaxX?: number;
    boundsMinY?: number;
    boundsMaxY?: number;
    isoClamp?: boolean;
    railScrollMinX?: number;
    railScrollMaxX?: number;
    railScrollMinY?: number;
    railScrollMaxY?: number;
};

type ScenePoint = { x: number; y: number };

type ScenePortal = ScenePoint & {
    direction?: string;
    col?: number | null;
    row?: number | null;
};

type MapScene = {
    citadel?: ScenePoint;
    railAnchor?: ScenePoint;
    primaryDirection?: string;
    portals?: ScenePortal[];
    cameraRail?: ScenePoint[];
};

type WorldItem = {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    name?: string;
    template?: string;
    fileName?: string;
    asset?: string;
    ax?: number;
    ay?: number;
    rot?: number;
    tilesW?: number;
    tilesH?: number;
};

type WorldItemTemplate = {
    name?: string;
    fileName?: string;
    template?: string;
    asset?: string;
    w?: number;
    h?: number;
};

type RuntimeMap = {
    version?: number;
    rev?: number;
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    tiles?: string[];
    layers?: Partial<Record<LayerName, number[]>>;
    camera?: MapCamera;
    scene?: MapScene;
    buildingTemplates?: WorldItemTemplate[];
    buildings?: WorldItem[];
    obstacleTemplates?: WorldItemTemplate[];
    obstacles?: WorldItem[];
    graphicTemplates?: WorldItemTemplate[];
    graphics?: WorldItem[];
};

type ImageEntry = {
    img: HTMLImageElement;
    ready: boolean;
    failed: boolean;
};

type RuntimeState = {
    map: RuntimeMap | null;
    mapSource: string;
    mapName: string;
    cameraCenter: CameraPoint;
    zoom: number;
    status: string;
    error: string | null;
    showDebugMasks: boolean;
    lastFrameMs: number;
    dragging: boolean;
    dragX: number;
    dragY: number;
    hoverBuildTile: { col: number; row: number } | null;
    keys: Set<string>;
    images: Map<string, ImageEntry>;
};

const ISO_LAYER_X = 1152;
const ISO_LAYER_Y = 0;
const TILE_LAYERS: LayerName[] = ['ground', 'decor'];
const MASK_LAYER_COLORS: Record<Exclude<LayerName, 'ground' | 'decor'>, string> = {
    paths: 'rgba(105, 188, 255, 0.28)',
    cam: 'rgba(125, 236, 255, 0.26)',
    zones: 'rgba(255, 175, 70, 0.28)',
    citadel: 'rgba(0, 208, 255, 0.22)',
    spawn: 'rgba(255, 92, 92, 0.28)',
};
const MOVE_SPEED = 720;
// Module-level references — initialized by GameScreen.mount()
let mapLabelEl: HTMLHeadingElement;
let modeChipEl: HTMLDivElement;
let statusEl: HTMLDivElement;
let mapStatsEl: HTMLPreElement;
let cameraStatsEl: HTMLPreElement;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let animating = false;
let tickWorker: Worker | null = null;
const sidePanel = new GameSidePanelController();

// Runtime state — initialized by GameScreen.mount()
let runtime: RuntimeState = {
    map: null,
    mapSource: '',
    mapName: 'active-map.json',
    cameraCenter: { x: 0, y: 0 },
    zoom: 1,
    status: 'Loading map...',
    error: null,
    showDebugMasks: false,
    lastFrameMs: performance.now(),
    dragging: false,
    dragX: 0,
    dragY: 0,
    hoverBuildTile: null,
    keys: new Set<string>(),
    images: new Map<string, ImageEntry>(),
};

// Phase 3 game system references — set per GameScreen.mount(), cleared on unmount
let gameState: GameState | null = null;
let waveController: WaveController | null = null;
let unitSystem: UnitSystem | null = null;
let buildingSystem: BuildingSystem | null = null;
let projectileSystem: ProjectileSystem | null = null;
let combatSystem: CombatSystem | null = null;
let resourceSystem: ResourceSystem | null = null;
let gameRenderer: GameRenderer | null = null;
// Phase 4: BossSystem is a singleton that persists across game sessions
const bossSystem = new BossSystem();
let winLossShown = false;
let selectedTowerType: 'attack' | 'buff' | 'sell' | null = null;
// HUD reference for Phase 3 live data updates (set by GameScreen.mount, cleared on unmount)
let gameScreenHudRef: HudOverlay | null = null;
let inputBound = false;
let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
let keyupHandler: ((event: KeyboardEvent) => void) | null = null;
let pointerDownHandler: ((event: PointerEvent) => void) | null = null;
let pointerMoveHandler: ((event: PointerEvent) => void) | null = null;
let pointerUpHandler: ((event: PointerEvent) => void) | null = null;
let pointerCancelHandler: ((event: PointerEvent) => void) | null = null;
let pointerLeaveHandler: (() => void) | null = null;

function syncCanvasCursor(): void {
    if (!canvas) return;
    canvas.style.cursor = selectedTowerType ? 'crosshair' : runtime.dragging ? 'grabbing' : 'grab';
}

function updateBuildHoverTile(clientX: number, clientY: number): void {
    if (!selectedTowerType || selectedTowerType === 'sell' || !runtime.map) {
        runtime.hoverBuildTile = null;
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const { wx, wy } = canvasPointToWorld(localX, localY, canvas, runtime.cameraCenter, runtime.zoom);
    const hoveredTile = runtime.hoverBuildTile;
    if (
        hoveredTile
        && isWorldPointInsideTile(
            wx,
            wy,
            hoveredTile.col,
            hoveredTile.row,
            runtime.map.tileWidth,
            runtime.map.tileHeight,
        )
    ) {
        return;
    }
    runtime.hoverBuildTile = canvasClickToTile(
        localX,
        localY,
        canvas,
        runtime.cameraCenter,
        runtime.zoom,
        runtime.map.tileWidth,
        runtime.map.tileHeight,
    );
}

/* Legacy GameScreen moved to src/screens/GameScreen.ts
    private escMenu: EscMenuOverlay | null = null;
    private hud: HudOverlay | null = null;

    constructor(private readonly manager: ScreenManager) {}

    mount(container: HTMLElement): void {
        const layout = mountGameViewportLayout(container);
        mapLabelEl = layout.mapLabelEl;
        modeChipEl = layout.modeChipEl;
        statusEl = layout.statusEl;
        mapStatsEl = layout.mapStatsEl;
        cameraStatsEl = layout.cameraStatsEl;
        canvas = layout.canvas;
        sidePanel.bind({
            killsEl: layout.sideKillsEl,
            activeEl: layout.sideActiveEl,
            waveEl: layout.sideWaveEl,
            txListEl: layout.sideTxListEl,
        });

        const rawCtx = canvas.getContext('2d');
        if (!rawCtx) {
            throw new Error('2D canvas context is unavailable');
        }
        ctx = rawCtx;

        configureCanvas(canvas, ctx);

        // Reset runtime state for fresh game session
        runtime = {
            map: null,
            mapSource: '',
            mapName: 'active-map.json',
            cameraCenter: { x: 0, y: 0 },
            zoom: 1,
            status: 'Loading map...',
            error: null,
            showDebugMasks: false,
            lastFrameMs: performance.now(),
            dragging: false,
            dragX: 0,
            dragY: 0,
            hoverBuildTile: null,
            keys: new Set<string>(),
            images: new Map<string, ImageEntry>(),
        };
        sidePanel.resetState();
        sidePanel.startMagicBlockTxFeed();

        bindInput();
        syncCanvasCursor();
        void loadMap();
        if (!animating) {
            animating = true;
            requestAnimationFrame(frame);
        }

        // Mount overlays on top of game canvas
        this.escMenu = new EscMenuOverlay(this.manager);
        this.escMenu.mount(container);

        this.hud = new HudOverlay();
        this.hud.mount(layout.hudSlotEl);
        gameScreenHudRef = this.hud;

        selectedTowerType = null;
        this.hud.setBuildSelection(selectedTowerType);
        this.hud.setCommandCallbacks({
            attack: () => {
                selectedTowerType = selectedTowerType === 'attack' ? null : 'attack';
                runtime.hoverBuildTile = null;
                syncCanvasCursor();
                this.hud?.setBuildSelection(selectedTowerType);
                this.hud?.setCommandMessage(
                    selectedTowerType === 'attack'
                        ? 'Attack Tower selected. Now click a highlighted build tile on the map.'
                        : 'Attack Tower deselected.',
                );
            },
            buff: () => {
                selectedTowerType = selectedTowerType === 'buff' ? null : 'buff';
                runtime.hoverBuildTile = null;
                syncCanvasCursor();
                this.hud?.setBuildSelection(selectedTowerType);
                this.hud?.setCommandMessage(
                    selectedTowerType === 'buff'
                        ? 'Buff Tower selected. Now click a highlighted build tile on the map.'
                        : 'Buff Tower deselected.',
                );
            },
            stagedUnitA: () => {
                this.hud?.setCommandMessage('Viking is already present in combat data. This right-side slot is the future training hook.');
            },
            stagedUnitB: () => {
                this.hud?.setCommandMessage('Collector slot is prepared in the HUD, but training is not wired yet.');
            },
        });

        // Canvas click handler for tower placement
        towerClickHandler = (_e: MouseEvent) => {
            if (!selectedTowerType || !gameState || !runtime.map) return;
            const map = runtime.map;
            const zoneLayer = map.layers?.zones ?? [];
            const hoveredTile = runtime.hoverBuildTile;
            if (!hoveredTile) {
                this.hud?.setCommandMessage('Наведи курсор на подсвеченный тайл и ставь башню только в него.');
                return;
            }
            const { col, row } = hoveredTile;
            const placed = buildingSystem?.placeBuilding(
                selectedTowerType,
                col,
                row,
                zoneLayer as number[],
                map.width,
                gameState,
            ) ?? false;
            const placedType = selectedTowerType;
            runtime.status = placed
                ? `${placedType === 'attack' ? 'Attack' : 'Buff'} tower placed at ${col},${row}.`
                : `Cannot place ${placedType} tower at ${col},${row}.`;
            if (placed) {
                this.hud?.setCommandMessage(placedType === 'attack' ? 'Attack Tower placed. Choose another tower or keep defending.' : 'Support Tower placed. Choose another tower or keep defending.');
                selectedTowerType = null;
                runtime.hoverBuildTile = null;
                syncCanvasCursor();
                this.hud?.setBuildSelection(null);
            } else {
                this.hud?.setCommandMessage('Cannot build here. Click a valid highlighted tile and make sure you have enough energy.');
            }
        };
        canvas.addEventListener('click', towerClickHandler);
    }

    unmount(): void {
        this.escMenu?.unmount();
        this.hud?.unmount();
        this.escMenu = null;
        this.hud = null;

        // Remove canvas click listener
        if (towerClickHandler) {
            canvas?.removeEventListener('click', towerClickHandler);
            towerClickHandler = null;
        }

        // Clear Phase 3 game systems to allow GC
        gameState = null;
        waveController = null;
        unitSystem = null;
        buildingSystem = null;
        projectileSystem = null;
        combatSystem = null;
        gameRenderer = null;
        gameScreenHudRef = null;
        winLossShown = false;
        selectedTowerType = null;
        runtime.hoverBuildTile = null;
        sidePanel.clear();
        syncCanvasCursor();

        // Clear game DOM
        const container = document.getElementById('game-container');
        if (container) container.innerHTML = '';
    }
*/

function onGameLayoutReady(layout: GameViewportLayoutRefs): void {
    mapLabelEl = layout.mapLabelEl;
    modeChipEl = layout.modeChipEl;
    statusEl = layout.statusEl;
    mapStatsEl = layout.mapStatsEl;
    cameraStatsEl = layout.cameraStatsEl;
    canvas = layout.canvas;
}

function resetRuntimeState(): void {
    runtime = {
        map: null,
        mapSource: '',
        mapName: 'active-map.json',
        cameraCenter: { x: 0, y: 0 },
        zoom: 1,
        status: 'Loading map...',
        error: null,
        showDebugMasks: false,
        lastFrameMs: performance.now(),
        dragging: false,
        dragX: 0,
        dragY: 0,
        hoverBuildTile: null,
        keys: new Set<string>(),
        images: new Map<string, ImageEntry>(),
    };
}

function ensureAnimationLoop(): void {
    if (!animating) {
        animating = true;
        requestAnimationFrame(frame);
    }
    if (!tickWorker) {
        tickWorker = new Worker(new URL('./game-tick.worker.ts', import.meta.url), { type: 'module' });
        tickWorker.onmessage = () => {
            if (document.hidden) {
                const now = performance.now();
                const dt = Math.min(0.05, Math.max(0.001, (now - runtime.lastFrameMs) / 1000));
                runtime.lastFrameMs = now;
                update(dt);
            }
        };
        tickWorker.postMessage('start');
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                runtime.lastFrameMs = performance.now();
                if (!animating) { animating = true; requestAnimationFrame(frame); }
            }
        });
    }
}

function configureGameHud(hud: HudOverlay): void {
    selectedTowerType = null;
    hud.setBuildSelection(selectedTowerType);
    hud.setCommandCallbacks({
        attack: () => {
            selectedTowerType = selectedTowerType === 'attack' ? null : 'attack';
            runtime.hoverBuildTile = null;
            syncCanvasCursor();
            hud.setBuildSelection(selectedTowerType);
            hud.setCommandMessage(
                selectedTowerType === 'attack'
                    ? 'Attack Tower selected. Now click a highlighted build tile on the map.'
                    : 'Attack Tower deselected.',
            );
        },
        buff: () => {
            selectedTowerType = selectedTowerType === 'buff' ? null : 'buff';
            runtime.hoverBuildTile = null;
            syncCanvasCursor();
            hud.setBuildSelection(selectedTowerType);
            hud.setCommandMessage(
                selectedTowerType === 'buff'
                    ? 'Buff Tower selected. Now click a highlighted build tile on the map.'
                    : 'Buff Tower deselected.',
            );
        },
        sell: () => {
            selectedTowerType = selectedTowerType === 'sell' ? null : 'sell';
            runtime.hoverBuildTile = null;
            syncCanvasCursor();
            hud.setBuildSelection(selectedTowerType);
            hud.setCommandMessage(
                selectedTowerType === 'sell'
                    ? 'Salvage mode selected. Click a deployed tower to dismantle it and recover energy.'
                    : 'Salvage mode deselected.',
            );
        },
        stagedUnitA: () => {
            if (!gameState) {
                hud.setCommandMessage('Battle state is still loading.');
                return;
            }
            const result = recruitUnit('light-ally', gameState);
            hud.setCommandMessage(result.message);
        },
        stagedUnitB: () => {
            if (!gameState) {
                hud.setCommandMessage('Battle state is still loading.');
                return;
            }
            const result = recruitUnit('collector', gameState);
            hud.setCommandMessage(result.message);
        },
    });
}

function createTowerPlacementHandler(hud: HudOverlay): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
        if (!selectedTowerType || !gameState || !runtime.map) return;
        const map = runtime.map;
        const rect = canvas.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        if (selectedTowerType === 'sell') {
            const clickedTile = canvasClickToTile(
                localX,
                localY,
                canvas,
                runtime.cameraCenter,
                runtime.zoom,
                map.tileWidth,
                map.tileHeight,
            );
            const target = gameState.buildings.find((building) => (
                building.tileCol === clickedTile.col && building.tileRow === clickedTile.row
            ));
            if (!target) {
                hud.setCommandMessage('Click a deployed tower to salvage it and recover energy.');
                return;
            }

            const refunded = target.type === 'attack' ? 30 : 24;
            const sold = buildingSystem?.sellBuilding(target.id, gameState) ?? false;
            if (!sold) {
                hud.setCommandMessage('Tower salvage failed. Try again.');
                return;
            }

            runtime.status = `${target.type === 'attack' ? 'Attack' : 'Buff'} tower salvaged at ${clickedTile.col},${clickedTile.row}.`;
            hud.setCommandMessage(`${target.type === 'attack' ? 'Attack' : 'Support'} Tower salvaged. Recovered E ${refunded}.`);
            selectedTowerType = null;
            runtime.hoverBuildTile = null;
            syncCanvasCursor();
            hud.setBuildSelection(null);
            return;
        }

        const zoneLayer = map.layers?.zones ?? [];
        const hoveredTile = runtime.hoverBuildTile;
        if (!hoveredTile) {
            hud.setCommandMessage('Move the cursor over a highlighted tile before placing a tower.');
            return;
        }
        if (!hoveredTile) {
            hud.setCommandMessage('Наведи курсор на подсвеченный тайл и ставь башню только в него.');
            return;
        }
        const { col, row } = hoveredTile;
        const placed = buildingSystem?.placeBuilding(
            selectedTowerType,
            col,
            row,
            zoneLayer as number[],
            map.width,
            gameState,
        ) ?? false;
        const placedType = selectedTowerType;
        runtime.status = placed
            ? `${placedType === 'attack' ? 'Attack' : 'Buff'} tower placed at ${col},${row}.`
            : `Cannot place ${placedType} tower at ${col},${row}.`;
        if (placed) {
            hud.setCommandMessage(placedType === 'attack' ? 'Attack Tower placed. Choose another tower or keep defending.' : 'Support Tower placed. Choose another tower or keep defending.');
            selectedTowerType = null;
            runtime.hoverBuildTile = null;
            syncCanvasCursor();
            hud.setBuildSelection(null);
        } else {
            hud.setCommandMessage('Cannot build here. Click a valid highlighted tile and make sure you have enough energy.');
        }
    };
}

function cleanupGameSession(): void {
    unbindInput();
    if (gameState) bossSystem.forceReset(gameState);
    gameState = null;
    waveController = null;
    unitSystem = null;
    buildingSystem = null;
    projectileSystem = null;
    combatSystem = null;
    resourceSystem = null;
    gameRenderer = null;
    gameScreenHudRef = null;
    winLossShown = false;
    selectedTowerType = null;
    runtime.hoverBuildTile = null;
    runtime.keys.clear();
}

// ScreenManager initialization — two-step to resolve circular reference
const appContainer = document.getElementById('game-container');
if (!appContainer) {
    throw new Error('Missing #game-container');
}

let screenManager: ScreenManager;

const walletScreen = new ValkyrixWalletSplashScreen({ navigateTo: (s) => screenManager.navigateTo(s) } as ScreenManager);
const menuScreen = new ValkyrixMainMenuScreen({ navigateTo: (s) => screenManager.navigateTo(s) } as ScreenManager);
const gameScreen = new GameScreen(
    { navigateTo: (s) => screenManager.navigateTo(s) } as ScreenManager,
    {
        sidePanel,
        onLayoutReady: onGameLayoutReady,
        configureCanvas,
        resetRuntimeState,
        bindInput,
        syncCanvasCursor,
        loadMap: () => loadMap(),
        ensureAnimationLoop,
        onHudMounted: (hud) => {
            gameScreenHudRef = hud;
        },
        configureHud: configureGameHud,
        createTowerClickHandler: createTowerPlacementHandler,
        onBeforeUnmount: cleanupGameSession,
    },
);

screenManager = new ScreenManager(appContainer, {
    wallet: walletScreen,
    menu: menuScreen,
    game: gameScreen,
});

// Try silent reconnect (uses onlyIfTrusted — no popup).
// Wallet extensions may inject after DOMContentLoaded, so we await a tick first.
(async () => {
    await new Promise<void>(r => {
        if (document.readyState === 'complete') { r(); return; }
        window.addEventListener('load', () => r(), { once: true });
    });
    const walletState = await tryAutoConnect();
    screenManager.navigateTo(walletState.connected ? 'menu' : 'wallet');
})();

function configureCanvas(target: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D): void {
    canvas = target;
    ctx = targetCtx;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    target.width = Math.round(GAME_W * dpr);
    target.height = Math.round(GAME_VIEW_H * dpr);
    targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targetCtx.imageSmoothingEnabled = true;
}

function bindInput(): void {
    if (inputBound) return;
    inputBound = true;

    keydownHandler = (event: KeyboardEvent) => {
        if (event.repeat) return;
        const code = event.code;
        if (code === 'KeyR') {
            event.preventDefault();
            void loadMap(true);
            return;
        }
        if (code === 'KeyF') {
            event.preventDefault();
            resetCameraToMapStart();
            return;
        }
        if (code === 'KeyV') {
            event.preventDefault();
            runtime.showDebugMasks = !runtime.showDebugMasks;
            runtime.status = runtime.showDebugMasks ? 'Debug masks enabled.' : 'Debug masks hidden.';
            return;
        }
        if (isMoveKey(code)) {
            event.preventDefault();
            runtime.keys.add(code);
        }
    };

    keyupHandler = (event: KeyboardEvent) => {
        runtime.keys.delete(event.code);
    };

    pointerDownHandler = (event: PointerEvent) => {
        if (selectedTowerType) {
            syncCanvasCursor();
            return;
        }
        runtime.dragging = true;
        runtime.dragX = event.clientX;
        runtime.dragY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
        syncCanvasCursor();
    };

    pointerMoveHandler = (event: PointerEvent) => {
        if (selectedTowerType) {
            updateBuildHoverTile(event.clientX, event.clientY);
            return;
        }
        if (!runtime.dragging || !runtime.map) return;
        const scaleX = canvas.clientWidth > 0 ? GAME_W / canvas.clientWidth : 1;
        const scaleY = canvas.clientHeight > 0 ? GAME_VIEW_H / canvas.clientHeight : 1;
        const dx = (event.clientX - runtime.dragX) * scaleX;
        const dy = (event.clientY - runtime.dragY) * scaleY;
        runtime.dragX = event.clientX;
        runtime.dragY = event.clientY;
        runtime.cameraCenter = clampCameraCenter(runtime.map, runtime.zoom, {
            x: runtime.cameraCenter.x - dx / runtime.zoom,
            y: runtime.cameraCenter.y - dy / runtime.zoom,
        });
    };

    pointerUpHandler = (event: PointerEvent) => {
        if (selectedTowerType) {
            syncCanvasCursor();
            return;
        }
        if (runtime.dragging) {
            runtime.dragging = false;
            if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }
        }
        syncCanvasCursor();
    };
    pointerCancelHandler = pointerUpHandler;

    pointerLeaveHandler = () => {
        runtime.hoverBuildTile = null;
        if (!selectedTowerType) {
            syncCanvasCursor();
        }
    };

    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keyup', keyupHandler);
    canvas.addEventListener('pointerdown', pointerDownHandler);
    canvas.addEventListener('pointermove', pointerMoveHandler);
    canvas.addEventListener('pointerup', pointerUpHandler);
    canvas.addEventListener('pointercancel', pointerCancelHandler);
    canvas.addEventListener('pointerleave', pointerLeaveHandler);
}

function unbindInput(): void {
    if (!inputBound) return;
    inputBound = false;
    if (keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }
    if (keyupHandler) {
        window.removeEventListener('keyup', keyupHandler);
        keyupHandler = null;
    }
    if (pointerDownHandler) {
        canvas.removeEventListener('pointerdown', pointerDownHandler);
        pointerDownHandler = null;
    }
    if (pointerMoveHandler) {
        canvas.removeEventListener('pointermove', pointerMoveHandler);
        pointerMoveHandler = null;
    }
    if (pointerUpHandler) {
        canvas.removeEventListener('pointerup', pointerUpHandler);
        pointerUpHandler = null;
    }
    if (pointerCancelHandler) {
        canvas.removeEventListener('pointercancel', pointerCancelHandler);
        pointerCancelHandler = null;
    }
    if (pointerLeaveHandler) {
        canvas.removeEventListener('pointerleave', pointerLeaveHandler);
        pointerLeaveHandler = null;
    }
}

async function loadMap(showReloadStatus = false): Promise<void> {
    runtime.error = null;
    runtime.status = showReloadStatus ? 'Reloading active map...' : 'Loading active map...';
    sidePanel.resetState();
    try {
        const mapUrl = new URL(`assets/maps/active-map.json?v=${Date.now()}`, window.location.href);
        const response = await fetch(mapUrl.toString(), { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const parsed = await response.json() as RuntimeMap;
        validateMap(parsed);
        runtime.map = parsed;
        runtime.mapSource = mapUrl.pathname;
        runtime.mapName = inferMapName(parsed);
        runtime.zoom = Math.max(0.1, parsed.camera?.zoom ?? 1.6);
        runtime.cameraCenter = getStartCenter(parsed);
        runtime.images.clear();
        primeTileImages(parsed);
        primeWorldItemImages(parsed);
        runtime.status = showReloadStatus ? 'Map reloaded from active-map.json.' : 'Map loaded.';
        void sidePanel.refreshMagicBlockTransactions();

        // Initialize Phase 3 game systems after map is loaded
        gameState = createGameState(parsed);
        waveController = new WaveController();
        unitSystem = new UnitSystem();
        buildingSystem = new BuildingSystem();
        projectileSystem = new ProjectileSystem();
        combatSystem = new CombatSystem();
        resourceSystem = new ResourceSystem();
        const arrowImg = new Image();
        arrowImg.src = '/assets/projectiles/Arrow01.png';
        gameRenderer = new GameRenderer(arrowImg);
        winLossShown = false;
    } catch (error) {
        runtime.map = null;
        runtime.error = error instanceof Error ? error.message : String(error);
        runtime.status = 'Unable to load active map.';
    }
}

function validateMap(map: RuntimeMap): void {
    if (!Number.isFinite(map.width) || !Number.isFinite(map.height) || !Number.isFinite(map.tileWidth) || !Number.isFinite(map.tileHeight)) {
        throw new Error('Map dimensions are missing or invalid.');
    }
}

function inferMapName(map: RuntimeMap): string {
    const rev = Number.isFinite(map.rev) ? `rev ${map.rev}` : 'unsaved';
    return `active-map.json | ${Math.max(0, map.width)}x${Math.max(0, map.height)} | ${rev}`;
}

function getStartCenter(map: RuntimeMap): CameraPoint {
    const startX = map.camera?.startX;
    const startY = map.camera?.startY;
    if (Number.isFinite(startX) && Number.isFinite(startY)) {
        return clampCameraCenter(map, map.camera?.zoom ?? 1.6, { x: startX ?? 0, y: startY ?? 0 });
    }
    const diamond = mapDiamondPoints(map);
    if (diamond) {
        return {
            x: (diamond.left.x + diamond.right.x) / 2,
            y: (diamond.top.y + diamond.bottom.y) / 2,
        };
    }
    return { x: 0, y: 0 };
}

function resetCameraToMapStart(): void {
    if (!runtime.map) return;
    runtime.cameraCenter = getStartCenter(runtime.map);
    runtime.status = 'Camera reset to map start.';
}

function frame(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - runtime.lastFrameMs) / 1000));
    runtime.lastFrameMs = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
}

function update(dt: number): void {
    if (!runtime.map || runtime.error) return;
    let moveX = 0;
    let moveY = 0;
    if (runtime.keys.has('ArrowUp') || runtime.keys.has('KeyW')) moveY -= 1;
    if (runtime.keys.has('ArrowDown') || runtime.keys.has('KeyS')) moveY += 1;
    if (runtime.keys.has('ArrowLeft') || runtime.keys.has('KeyA')) moveX -= 1;
    if (runtime.keys.has('ArrowRight') || runtime.keys.has('KeyD')) moveX += 1;
    if (moveX !== 0 || moveY !== 0) {
        const len = Math.hypot(moveX, moveY) || 1;
        const nextCenter = {
            x: runtime.cameraCenter.x + (moveX / len) * MOVE_SPEED * dt,
            y: runtime.cameraCenter.y + (moveY / len) * MOVE_SPEED * dt,
        };
        runtime.cameraCenter = clampCameraCenter(runtime.map, runtime.zoom, nextCenter);
    }

    // Phase 3: update game systems each frame (only when game is active)
    if (gameState && gameState.phase === 'playing') {
        waveController?.update(dt, gameState);
        unitSystem?.update(dt, gameState);
        buildingSystem?.update(dt, gameState);
        projectileSystem?.update(dt, gameState);
        combatSystem?.update(dt, gameState);
        resourceSystem?.update(dt, gameState);
        bossSystem.update(dt, gameState, document.body);
    }

    // HUD update with live game data
    if (gameState) {
        const enemyUnits = gameState.units.filter((u) => u.faction === 'enemy');
        const queuedEnemyCount = gameState.spawnQueue.filter((entry) => UNIT_DEFS[entry.defKey]?.faction === 'enemy').length;
        const enemyKilledTotal = sidePanel.reconcileBattleState(gameState);
        gameScreenHudRef?.setActionAvailability({
            attack: gameState.resources >= 50,
            buff: gameState.resources >= 40,
            sell: gameState.buildings.length > 0,
        });
        gameScreenHudRef?.update({
            wave: gameState.waveNumber,
            health: gameState.citadelHp,
            citadelMaxHp: gameState.citadelMaxHp,
            resources: gameState.resources,
            crystals: gameState.crystals ?? 0,
            armedAction: selectedTowerType,
            waveTimer: gameState.waveTimer,
            enemiesAlive: enemyUnits.length,
            enemiesQueued: queuedEnemyCount,
            alliesAlive: gameState.units.filter(u => u.faction === 'ally').length,
            towerCount: gameState.buildings.length,
            enemiesKilled: enemyKilledTotal,
            canSalvage: gameState.buildings.length > 0,
            canAffordViking: canRecruitUnit('light-ally', gameState),
            canAffordCollector: canRecruitUnit('collector', gameState),
        });

        // Win/loss detection — show overlay once
        if (!winLossShown && gameState.phase === 'won') {
            gameScreenHudRef?.showWinLossOverlay('won');
            winLossShown = true;
        }
        if (!winLossShown && gameState.phase === 'lost') {
            gameScreenHudRef?.showWinLossOverlay('lost');
            winLossShown = true;
        }
    }
}

function render(): void {
    ctx.clearRect(0, 0, GAME_W, GAME_VIEW_H);

    if (runtime.error) {
        drawBackdrop();
        drawError(runtime.error);
        syncHud();
        return;
    }

    if (!runtime.map) {
        drawBackdrop();
        drawCenteredLabel('Loading active-map.json...');
        syncHud();
        return;
    }

    drawBackdrop();
    drawTiles(runtime.map);
    drawBuildPlacementPreview(runtime.map);
    if (runtime.showDebugMasks) {
        drawSceneRail(runtime.map);
        drawSceneMarkers(runtime.map);
    }
    drawWorldItems(runtime.map, 'background');
    drawCameraFocus(runtime.map);

    // Phase 3: render game entities (units, buildings, projectiles) on top of tile map
    if (gameState && gameRenderer) {
        gameRenderer.render(ctx, gameState, runtime.cameraCenter, runtime.zoom);
    }

    drawWorldItems(runtime.map, 'foreground');

    syncHud();
}

function drawBackdrop(): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_VIEW_H);
    gradient.addColorStop(0, '#102032');
    gradient.addColorStop(0.48, '#0b1220');
    gradient.addColorStop(1, '#05080f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_W, GAME_VIEW_H);

    ctx.fillStyle = 'rgba(130, 184, 232, 0.08)';
    for (let i = 0; i < 7; i += 1) {
        const radius = 120 + i * 72;
        ctx.beginPath();
        ctx.arc(GAME_W * 0.82, -40, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawError(message: string): void {
    drawCenteredLabel(`Failed to load map: ${message}`);
}

function drawCenteredLabel(text: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 9, 15, 0.8)';
    ctx.fillRect(180, GAME_VIEW_H / 2 - 42, GAME_W - 360, 84);
    ctx.strokeStyle = 'rgba(153, 200, 245, 0.22)';
    ctx.strokeRect(180, GAME_VIEW_H / 2 - 42, GAME_W - 360, 84);
    ctx.fillStyle = '#e7f2ff';
    ctx.font = '600 24px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, GAME_W / 2, GAME_VIEW_H / 2);
    ctx.restore();
}

function drawTiles(map: RuntimeMap): void {
    for (let row = 0; row < map.height; row += 1) {
        for (let col = 0; col < map.width; col += 1) {
            const world = tileToWorld(map, col, row);
            const screen = worldToScreen(world.x, world.y);
            const halfW = (map.tileWidth / 2) * runtime.zoom;
            const halfH = (map.tileHeight / 2) * runtime.zoom;

            const groundGid = getLayerCell(map.layers?.ground, map.width, col, row);
            drawDiamondTile(map, groundGid, screen.x, screen.y, halfW, halfH, '#182b45');

            const decorGid = getLayerCell(map.layers?.decor, map.width, col, row);
            if (decorGid > 0) {
                drawDiamondTile(map, decorGid, screen.x, screen.y, halfW, halfH, '#244a72');
            }

            if (runtime.showDebugMasks) {
                drawMaskLayer(map, 'paths', col, row, screen.x, screen.y, halfW, halfH);
                drawMaskLayer(map, 'cam', col, row, screen.x, screen.y, halfW, halfH);
                drawMaskLayer(map, 'zones', col, row, screen.x, screen.y, halfW, halfH);
                drawMaskLayer(map, 'citadel', col, row, screen.x, screen.y, halfW, halfH);
                drawMaskLayer(map, 'spawn', col, row, screen.x, screen.y, halfW, halfH);
            }
        }
    }
}

function drawDiamondTile(
    map: RuntimeMap,
    gid: number,
    x: number,
    y: number,
    halfW: number,
    halfH: number,
    fallback: string,
): void {
    diamondPath(x, y, halfW, halfH);
    ctx.save();
    ctx.clip();
    if (gid > 0) {
        const image = ensureTileImage(map, gid);
        if (image?.ready) {
            ctx.drawImage(image.img, x - halfW, y - halfH, halfW * 2, halfH * 2);
        } else {
            ctx.fillStyle = fallback;
            ctx.fillRect(x - halfW, y - halfH, halfW * 2, halfH * 2);
        }
    } else {
        ctx.fillStyle = fallback;
        ctx.fillRect(x - halfW, y - halfH, halfW * 2, halfH * 2);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(64, 112, 166, 0.38)';
    ctx.lineWidth = Math.max(0.8, runtime.zoom * 0.5);
    diamondPath(x, y, halfW, halfH);
    ctx.stroke();
}

function drawMaskLayer(
    map: RuntimeMap,
    layerName: Exclude<LayerName, 'ground' | 'decor'>,
    col: number,
    row: number,
    x: number,
    y: number,
    halfW: number,
    halfH: number,
): void {
    if (getLayerCell(map.layers?.[layerName], map.width, col, row) <= 0) return;
    ctx.fillStyle = MASK_LAYER_COLORS[layerName];
    diamondPath(x, y, halfW * 0.9, halfH * 0.9);
    ctx.fill();
    if (layerName === 'spawn' || layerName === 'citadel') {
        ctx.strokeStyle = layerName === 'spawn' ? 'rgba(255, 122, 92, 0.95)' : 'rgba(80, 220, 255, 0.95)';
        ctx.lineWidth = Math.max(1, runtime.zoom * 0.7);
        diamondPath(x, y, halfW * 0.68, halfH * 0.68);
        ctx.stroke();
    }
}

function drawSceneRail(map: RuntimeMap): void {
    const rail = map.scene?.cameraRail;
    if (!rail || rail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(129, 214, 255, 0.9)';
    ctx.shadowColor = 'rgba(91, 204, 255, 0.55)';
    ctx.shadowBlur = 12;
    ctx.lineWidth = Math.max(2, runtime.zoom * 1.4);
    ctx.beginPath();
    for (let i = 0; i < rail.length; i += 1) {
        const point = worldToScreen(rail[i].x, rail[i].y);
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
}

function drawSceneMarkers(map: RuntimeMap): void {
    const citadel = map.scene?.citadel;
    if (citadel) {
        const screen = worldToScreen(citadel.x, citadel.y);
        drawMarker(screen.x, screen.y, 16, '#63d9ff', 'Citadel');
    }

    const portals = map.scene?.portals ?? [];
    for (let i = 0; i < portals.length; i += 1) {
        const portal = portals[i];
        const screen = worldToScreen(portal.x, portal.y);
        drawMarker(screen.x, screen.y, 12, '#ff8d68', portal.direction ?? `Portal ${i + 1}`);
    }
}

function drawMarker(x: number, y: number, radius: number, color: string, label: string): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(5, 9, 15, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#eef7ff';
    ctx.font = '600 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - radius - 10);
    ctx.restore();
}

function drawWorldItems(map: RuntimeMap, layer: 'background' | 'foreground' = 'background'): void {
    const combined = [
        ...collectWorldItems(map.buildings, map.buildingTemplates, 'buildings', '#95f2af'),
        ...collectWorldItems(map.obstacles, map.obstacleTemplates, 'objects', '#ffb56d'),
        ...collectWorldItems(map.graphics, map.graphicTemplates, 'graphics', '#8ee8ff'),
    ].sort((a, b) => ((a.item.y ?? 0) - (b.item.y ?? 0)));

    if (combined.length === 0) return;

    for (const entry of combined) {
        const item = entry.item;
        if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
        const itemKind = getAnimatedWorldItemKind(entry.asset, item);
        const isForeground = itemKind === 'port';
        if (layer === 'background' && isForeground) continue;
        if (layer === 'foreground' && !isForeground) continue;

        const screen = worldToScreen(item.x ?? 0, item.y ?? 0);
        const size = getWorldItemDrawSize(map, item);
        const width = Math.max(1, size.width * runtime.zoom);
        const height = Math.max(1, size.height * runtime.zoom);
        const anchorX = typeof item.ax === 'number' ? item.ax : 0.5;
        const anchorY = typeof item.ay === 'number' ? item.ay : 1;
        const drawX = screen.x - width * anchorX;
        const drawY = screen.y - height * anchorY;
        const image = entry.asset ? ensureRuntimeImage(entry.asset) : null;
        const isCitadel = itemKind === 'citadel';
        const nowMs = performance.now();

        if (image?.ready) {
            const frame = getRuntimeImageFrame(image.img, entry.asset, item, entry.kind);

            ctx.save();
            
            // 2. Дыхание ауры под базой
            if (isCitadel) {
                drawCitadelAura(ctx, nowMs);
                drawCitadelOrbitingSwarm(ctx, drawX, drawY, width, height, nowMs, 'behind');
            }

            if (item.rot) {
                const pivotX = screen.x;
                const pivotY = screen.y;
                ctx.translate(pivotX, pivotY);
                ctx.rotate((item.rot * Math.PI) / 180);
                ctx.drawImage(
                    image.img,
                    frame.sx,
                    frame.sy,
                    frame.sw,
                    frame.sh,
                    -width * anchorX,
                    -height * anchorY,
                    width,
                    height,
                );
            } else {
                if (isCitadel) {
                    drawCitadelSpriteProfiled(image.img, frame, drawX, drawY, width, height);
                    drawCitadelBaseOcclusion(ctx, screen.x, screen.y, width, height);
                } else {
                    ctx.drawImage(image.img, frame.sx, frame.sy, frame.sw, frame.sh, drawX, drawY, width, height);
                }
                
                // 3. Энергия маны по каналам вверх
                if (isCitadel) {
                    drawCitadelEnergyFlow(ctx, drawX, drawY, width, height, nowMs);
                    drawCitadelTileBurial(map, item);
                    drawCitadelGroundSeam(ctx, screen.x, screen.y, width, height);
                }
            }
            ctx.restore();
            if (isCitadel) {
                drawCitadelOrbitingSwarm(ctx, drawX, drawY, width, height, nowMs, 'front');
            }
            continue;
        }

        ctx.save();
        ctx.fillStyle = entry.color;
        ctx.fillRect(drawX, drawY, width, height);
        ctx.strokeStyle = 'rgba(5, 9, 15, 0.8)';
        ctx.strokeRect(drawX, drawY, width, height);
        ctx.restore();
    }
}

function drawCitadelBaseOcclusion(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    baseY: number,
    width: number,
    height: number,
): void {
    const clipTop = baseY - height * 0.16;
    const clipHeight = height * 0.16;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.beginPath();
    ctx.rect(centerX - width * 0.28, clipTop, width * 0.56, clipHeight);
    ctx.clip();

    const shade = ctx.createRadialGradient(
        centerX,
        baseY - height * 0.045,
        width * 0.03,
        centerX,
        baseY - height * 0.04,
        width * 0.2,
    );
    shade.addColorStop(0, 'rgba(8, 12, 18, 0.28)');
    shade.addColorStop(0.55, 'rgba(8, 12, 18, 0.16)');
    shade.addColorStop(1, 'rgba(8, 12, 18, 0)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(centerX, baseY - height * 0.048, width * 0.18, height * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawCitadelTileBurial(map: RuntimeMap, item: WorldItem): void {
    const anchor = worldToNearestTile(map, item.x ?? 0, item.y ?? 0);
    if (!anchor) return;

    const halfW = (map.tileWidth / 2) * runtime.zoom;
    const halfH = (map.tileHeight / 2) * runtime.zoom;
    const caps = [
        { dx: -2, dy: 1, cover: 0.52 },
        { dx: -1, dy: 1, cover: 0.58 },
        { dx: 0, dy: 1, cover: 0.62 },
        { dx: 1, dy: 1, cover: 0.58 },
        { dx: 2, dy: 1, cover: 0.52 },
        { dx: -1, dy: 2, cover: 0.36 },
        { dx: 0, dy: 2, cover: 0.4 },
        { dx: 1, dy: 2, cover: 0.36 },
    ];

    for (const cap of caps) {
        const col = anchor.col + cap.dx;
        const row = anchor.row + cap.dy;
        if (col < 0 || row < 0 || col >= map.width || row >= map.height) continue;

        const world = tileToWorld(map, col, row);
        const screen = worldToScreen(world.x, world.y);
        const groundGid = getLayerCell(map.layers?.ground, map.width, col, row);
        const decorGid = getLayerCell(map.layers?.decor, map.width, col, row);
        const capHeight = halfH * cap.cover;

        ctx.save();
        diamondPath(screen.x, screen.y, halfW, halfH);
        ctx.clip();
        ctx.beginPath();
        ctx.rect(screen.x - halfW, screen.y - halfH, halfW * 2, capHeight);
        ctx.clip();

        drawDiamondTile(map, groundGid, screen.x, screen.y, halfW, halfH, '#182b45');
        if (decorGid > 0) {
            drawDiamondTile(map, decorGid, screen.x, screen.y, halfW, halfH, '#244a72');
        }

        ctx.restore();
    }
}

function drawCitadelGroundSeam(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    baseY: number,
    width: number,
    height: number,
): void {
    const seamY = baseY - height * 0.012;
    const outerRx = width * 0.286;
    const outerRy = Math.max(5, height * 0.034);
    const midRx = width * 0.272;
    const midRy = Math.max(3.2, height * 0.022);
    const innerRx = width * 0.255;
    const innerRy = Math.max(2, height * 0.013);

    ctx.save();
    ctx.beginPath();
    ctx.rect(centerX - outerRx - 4, seamY - outerRy * 1.2, (outerRx + 4) * 2, outerRy * 1.8);
    ctx.clip();

    const soil = ctx.createLinearGradient(centerX, seamY - outerRy, centerX, seamY + outerRy);
    soil.addColorStop(0, 'rgba(126, 136, 146, 0.08)');
    soil.addColorStop(0.26, 'rgba(92, 100, 112, 0.28)');
    soil.addColorStop(0.62, 'rgba(48, 54, 64, 0.64)');
    soil.addColorStop(1, 'rgba(20, 24, 32, 0.88)');
    ctx.fillStyle = soil;
    traceCitadelSeam(ctx, centerX, seamY, outerRx, outerRy, midRx, midRy);
    ctx.fill();

    ctx.fillStyle = 'rgba(10, 14, 20, 0.34)';
    traceCitadelSeam(ctx, centerX, seamY + outerRy * 0.04, midRx, midRy, innerRx, innerRy);
    ctx.fill();

    ctx.strokeStyle = 'rgba(158, 170, 182, 0.12)';
    ctx.lineWidth = Math.max(0.6, width * 0.004);
    ctx.beginPath();
    ctx.ellipse(centerX, seamY - outerRy * 0.36, outerRx * 0.86, outerRy * 0.34, 0, Math.PI * 0.16, Math.PI * 0.84, true);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(8, 12, 18, 0.26)';
    ctx.lineWidth = Math.max(0.9, width * 0.005);
    ctx.beginPath();
    ctx.ellipse(centerX, seamY + outerRy * 0.22, outerRx * 0.95, outerRy * 0.72, 0, Math.PI * 0.18, Math.PI * 0.82, false);
    ctx.stroke();
    ctx.restore();
}

function traceCitadelSeam(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerRx: number,
    outerRy: number,
    innerRx: number,
    innerRy: number,
): void {
    ctx.beginPath();
    ctx.ellipse(cx, cy, outerRx, outerRy, 0, Math.PI * 0.06, Math.PI * 0.94, false);
    ctx.ellipse(cx, cy, innerRx, innerRy, 0, Math.PI * 0.94, Math.PI * 0.06, true);
    ctx.closePath();
}

function worldToNearestTile(map: RuntimeMap, x: number, y: number): { col: number; row: number } | null {
    const origin = getIsoOrigin(map);
    const halfW = map.tileWidth / 2;
    const halfH = map.tileHeight / 2;
    if (!(halfW > 0) || !(halfH > 0)) return null;
    const iso = worldToIso(x, y, origin.x, origin.y, halfW, halfH);
    return {
        col: Math.round(iso.a / 2),
        row: Math.round(iso.b / 2),
    };
}

function drawCitadelSpriteProfiled(
    image: HTMLImageElement,
    frame: { sx: number; sy: number; sw: number; sh: number },
    drawX: number,
    drawY: number,
    width: number,
    height: number,
): void {
    const step = Math.max(1, Math.round(frame.sh / 96));

    for (let sy = 0; sy < frame.sh; sy += step) {
        const sliceH = Math.min(step, frame.sh - sy);
        const t = (sy + sliceH * 0.5) / Math.max(frame.sh, 1);
        const widthScale = getCitadelWidthProfile(t);
        const destY = drawY + (sy / frame.sh) * height;
        const destH = (sliceH / frame.sh) * height;
        const destW = width * widthScale;
        const destX = drawX + (width - destW) / 2;

        ctx.drawImage(
            image,
            frame.sx,
            frame.sy + sy,
            frame.sw,
            sliceH,
            destX,
            destY,
            destW,
            destH,
        );
    }
}

function getCitadelWidthProfile(t: number): number {
    if (t < 0.16) {
        return 0.76 + (t / 0.16) * 0.06;
    }
    if (t < 0.46) {
        return 0.82 + ((t - 0.16) / 0.3) * 0.16;
    }
    if (t < 0.76) {
        return 0.98 + ((t - 0.46) / 0.3) * 0.2;
    }
    if (t < 0.92) {
        return 1.18 + ((t - 0.76) / 0.16) * 0.08;
    }
    return 1.26;
}

function getWorldItemDrawSize(map: RuntimeMap, item: WorldItem): { width: number; height: number } {
    const tilesW = Number(item.tilesW) || 0;
    const tilesH = Number(item.tilesH) || 0;
    if (tilesW > 0 || tilesH > 0) {
        const base = Math.max(1, map.tileWidth || 64);
        return {
            width: Math.max(1, (tilesW || 1) * base),
            height: Math.max(1, (tilesH || 1) * base),
        };
    }
    return {
        width: Math.max(1, item.w ?? 64),
        height: Math.max(1, item.h ?? 64),
    };
}

function getRuntimeImageFrame(
    img: HTMLImageElement,
    asset = '',
    item?: WorldItem,
    kind?: 'buildings' | 'objects' | 'graphics',
): { sx: number; sy: number; sw: number; sh: number } {
    const atlas = getSquareAtlasLayout(img);
    if (atlas) {
        const animKind = getAnimatedWorldItemKind(asset, item);
        const shouldAnimate = !!animKind || kind === 'graphics';
        const fps = animKind === 'citadel' ? 8 : animKind === 'port' ? 10 : 8;
        const frameIndex = shouldAnimate ? Math.floor((Date.now() / 1000) * fps) % atlas.totalFrames : 0;
        return atlasFrameRect(atlas, frameIndex);
    }
    return { sx: 0, sy: 0, sw: img.width, sh: img.height };
}

function getSquareAtlasLayout(img: HTMLImageElement): { frameSize: number; cols: number; rows: number; totalFrames: number } | null {
    const width = Math.max(0, img.width || img.naturalWidth || 0);
    const height = Math.max(0, img.height || img.naturalHeight || 0);
    if (!width || !height) return null;

    const frameSize = gcd(width, height);
    if (!frameSize) return null;

    const cols = Math.floor(width / frameSize);
    const rows = Math.floor(height / frameSize);
    if (cols < 1 || rows < 1) return null;
    if (cols * frameSize !== width || rows * frameSize !== height) return null;

    const totalFrames = cols * rows;
    if (totalFrames <= 1) return null;

    return { frameSize, cols, rows, totalFrames };
}

function atlasFrameRect(
    atlas: { frameSize: number; cols: number; rows: number; totalFrames: number },
    frameIndex: number,
): { sx: number; sy: number; sw: number; sh: number } {
    const safeIndex = ((frameIndex % atlas.totalFrames) + atlas.totalFrames) % atlas.totalFrames;
    const col = safeIndex % atlas.cols;
    const row = Math.floor(safeIndex / atlas.cols);
    return {
        sx: col * atlas.frameSize,
        sy: row * atlas.frameSize,
        sw: atlas.frameSize,
        sh: atlas.frameSize,
    };
}

function gcd(a: number, b: number): number {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y) {
        const next = x % y;
        x = y;
        y = next;
    }
    return x;
}

function getAnimatedWorldItemKind(asset: string, item?: WorldItem): 'citadel' | 'port' | null {
    const ref = `${String(item?.template || '')} ${String(item?.fileName || '')} ${String(item?.name || '')} ${asset}`.toLowerCase();
    if (ref.includes('citadel')) return 'citadel';
    if (ref.includes('portal') || /\bport\b/.test(ref)) return 'port';
    return null;
}

function drawCameraFocus(map: RuntimeMap): void {
    const center = worldToScreen(runtime.cameraCenter.x, runtime.cameraCenter.y);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 245, 168, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x - 12, center.y);
    ctx.lineTo(center.x + 12, center.y);
    ctx.moveTo(center.x, center.y - 12);
    ctx.lineTo(center.x, center.y + 12);
    ctx.stroke();

    const view = getViewSize(runtime.zoom);
    const topLeft = worldToScreen(runtime.cameraCenter.x - view.viewW / 2, runtime.cameraCenter.y - view.viewH / 2);
    const bottomRight = worldToScreen(runtime.cameraCenter.x + view.viewW / 2, runtime.cameraCenter.y + view.viewH / 2);
    ctx.strokeStyle = 'rgba(255, 215, 108, 0.52)';
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    ctx.setLineDash([]);
    ctx.restore();

    if (!runtime.showDebugMasks) return;
    const limits = getRuntimeLimits(map, runtime.zoom);
    if (!limits) return;
    const leftTop = worldToScreen(limits.left, limits.top);
    const rightBottom = worldToScreen(limits.right, limits.bottom);
    ctx.save();
    ctx.strokeStyle = 'rgba(141, 214, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftTop.x, leftTop.y, rightBottom.x - leftTop.x, rightBottom.y - leftTop.y);
    ctx.restore();
}

function drawBuildPlacementPreview(map: RuntimeMap): void {
    if (selectedTowerType === 'sell') return;
    if (!selectedTowerType || !runtime.hoverBuildTile) return;

    const { col, row } = runtime.hoverBuildTile;
    if (col < 0 || row < 0 || col >= map.width || row >= map.height) return;

    const center = tileToWorld(map, col, row);
    const screen = worldToScreen(center.x, center.y);
    const halfW = (map.tileWidth / 2) * runtime.zoom;
    const halfH = (map.tileHeight / 2) * runtime.zoom;
    const zoneValue = getLayerCell(map.layers?.zones, map.width, col, row);
    const occupied = !!gameState?.buildings.some((b) => b.tileCol === col && b.tileRow === row);
    const cost = selectedTowerType === 'attack' ? 50 : 40;
    const affordable = (gameState?.resources ?? 0) >= cost;
    const valid = zoneValue !== 0 && !occupied && affordable;

    ctx.save();
    diamondPath(screen.x, screen.y, halfW, halfH);
    ctx.fillStyle = valid ? 'rgba(98, 224, 166, 0.18)' : 'rgba(255, 108, 108, 0.2)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, runtime.zoom * 1.8);
    ctx.strokeStyle = valid ? 'rgba(168, 255, 218, 0.95)' : 'rgba(255, 196, 196, 0.95)';
    ctx.stroke();
    ctx.restore();
}

function syncHud(): void {
    const map = runtime.map;
    mapLabelEl.textContent = runtime.error ? 'active-map.json unavailable' : runtime.mapName;
    statusEl.textContent = runtime.error ? `Load error: ${runtime.error}` : runtime.status;

    if (!map) {
        modeChipEl.textContent = runtime.error ? 'missing map' : 'loading';
        mapStatsEl.textContent = runtime.error ? `active-map.json\n${runtime.error}` : 'loading...';
        cameraStatsEl.textContent = 'waiting for runtime...';
        return;
    }

    const view = getViewSize(runtime.zoom);
    const scroll = centerToScroll(runtime.cameraCenter.x, runtime.cameraCenter.y, view.viewW, view.viewH);
    const worldBounds = computeMapWorldBounds(map);
    const limits = getRuntimeLimits(map, runtime.zoom);
    const rail = map.scene?.cameraRail ?? [];

    modeChipEl.textContent = `${map.camera?.moveMode ?? 'free'} • zoom ${runtime.zoom.toFixed(3)}`;
    mapStatsEl.textContent = [
        `version: ${map.version ?? 'n/a'}  rev: ${map.rev ?? 'n/a'}`,
        `map: ${map.width}x${map.height}  tile: ${map.tileWidth}x${map.tileHeight}`,
        `tiles in catalog: ${map.tiles?.length ?? 0}`,
        worldBounds
            ? `world bounds: L${Math.round(worldBounds.left)} R${Math.round(worldBounds.right)} T${Math.round(worldBounds.top)} B${Math.round(worldBounds.bottom)}`
            : 'world bounds: n/a',
        `rail points: ${rail.length}`,
        `portals: ${map.scene?.portals?.length ?? 0}`,
        `entities: buildings ${map.buildings?.length ?? 0}, obstacles ${map.obstacles?.length ?? 0}, graphics ${map.graphics?.length ?? 0}`,
    ].join('\n');

    cameraStatsEl.textContent = [
        `center: ${Math.round(runtime.cameraCenter.x)}, ${Math.round(runtime.cameraCenter.y)}`,
        `scroll: ${Math.round(scroll.x)}, ${Math.round(scroll.y)}`,
        `visible world: ${Math.round(view.viewW)} x ${Math.round(view.viewH)}`,
        `start: ${Math.round(map.camera?.startX ?? 0)}, ${Math.round(map.camera?.startY ?? 0)}`,
        `road offset y: ${Math.round(getRoadOffset(map, runtime.zoom))}`,
        `bounds source: ${map.camera?.boundsSource ?? 'layers'}  pad: ${Math.round(map.camera?.boundsPad ?? 0)}`,
        limits
            ? `limits: L${Math.round(limits.left)} R${Math.round(limits.right)} T${Math.round(limits.top)} B${Math.round(limits.bottom)}`
            : 'limits: n/a',
        runtime.showDebugMasks ? 'debug masks: on' : 'debug masks: off',
    ].join('\n');
}

function getViewSize(zoom: number): { viewW: number; viewH: number } {
    return computeViewSize(GAME_W, GAME_VIEW_H, zoom);
}

function getRoadOffset(map: RuntimeMap, zoom: number): number {
    return computeRoadViewOffset(
        zoom,
        GAME_MODE_TOP_BAR_HEIGHT,
        Number.isFinite(map.camera?.roadViewOffsetY) ? map.camera?.roadViewOffsetY ?? 0 : 0,
        (map.camera?.moveMode ?? 'free') === 'free',
        true,
    );
}

function clampCameraCenter(map: RuntimeMap, zoom: number, proposed: CameraPoint): CameraPoint {
    const moveMode = map.camera?.moveMode ?? 'free';
    const rail = map.scene?.cameraRail ?? [];
    const view = getViewSize(zoom);

    if (moveMode !== 'free' && rail.length >= 2) {
        const roadOffset = getRoadOffset(map, zoom);
        const projected = projectPointToRail(proposed.x, proposed.y - roadOffset, rail);
        const projectedCenter = { x: projected.x, y: projected.y + roadOffset };
        let scroll = centerToScroll(projectedCenter.x, projectedCenter.y, view.viewW, view.viewH);
        const railBounds = getRailScrollBounds(map);
        if (railBounds) {
            scroll = {
                x: clampNumber(scroll.x, railBounds.minX, railBounds.maxX),
                y: clampNumber(scroll.y, railBounds.minY, railBounds.maxY),
            };
        } else {
            const scrollBounds = computeCameraScrollBounds(map, zoom);
            if (scrollBounds) {
                scroll = {
                    x: clampNumber(scroll.x, scrollBounds.minX, scrollBounds.maxX),
                    y: clampNumber(scroll.y, scrollBounds.minY, scrollBounds.maxY),
                };
            }
        }
        return scrollToCenter(scroll.x, scroll.y, view.viewW, view.viewH);
    }

    let clampedCenter = proposed;
    const scrollBounds = computeCameraScrollBounds(map, zoom);
    if (scrollBounds) {
        clampedCenter = clampCenterToScrollBounds(clampedCenter.x, clampedCenter.y, view.viewW, view.viewH, scrollBounds);
    }

    const isoBounds = getActiveIsoBounds(map);
    if (isoBounds) {
        const scroll = centerToScroll(clampedCenter.x, clampedCenter.y, view.viewW, view.viewH);
        const isoScroll = clampScrollToIsoDiamond(
            scroll.x,
            scroll.y,
            view.viewW,
            view.viewH,
            getIsoOrigin(map).x,
            getIsoOrigin(map).y,
            isoBounds,
            map.camera?.boundsPad ?? 0,
        );
        clampedCenter = scrollToCenter(isoScroll.x, isoScroll.y, view.viewW, view.viewH);
    }

    return clampedCenter;
}

function getRailScrollBounds(map: RuntimeMap): CameraScrollBounds | null {
    const camera = map.camera;
    if (!camera) return null;
    if (!Number.isFinite(camera.railScrollMinX) || !Number.isFinite(camera.railScrollMaxX) || !Number.isFinite(camera.railScrollMinY) || !Number.isFinite(camera.railScrollMaxY)) {
        return null;
    }
    return {
        minX: camera.railScrollMinX ?? 0,
        maxX: camera.railScrollMaxX ?? 0,
        minY: camera.railScrollMinY ?? 0,
        maxY: camera.railScrollMaxY ?? 0,
    };
}

function computeCameraScrollBounds(map: RuntimeMap, zoom: number): CameraScrollBounds | null {
    const camera = map.camera;
    if (camera?.boundsEnabled) {
        const customBounds = getCustomScrollBounds(map, zoom);
        if (customBounds) return customBounds;
    }
    return computeAutoScrollBounds(map, zoom);
}

function getCustomScrollBounds(map: RuntimeMap, zoom: number): CameraScrollBounds | null {
    const camera = map.camera;
    if (!camera?.boundsEnabled) return null;
    if (!Number.isFinite(camera.boundsMinX) || !Number.isFinite(camera.boundsMaxX) || !Number.isFinite(camera.boundsMinY) || !Number.isFinite(camera.boundsMaxY)) {
        return null;
    }
    const view = getViewSize(zoom);
    return {
        minX: camera.boundsMinX ?? 0,
        maxX: (camera.boundsMaxX ?? 0) - view.viewW,
        minY: camera.boundsMinY ?? 0,
        maxY: (camera.boundsMaxY ?? 0) - view.viewH,
    };
}

function computeAutoScrollBounds(map: RuntimeMap, zoom: number): CameraScrollBounds | null {
    const bounds = getBoundsWorld(map);
    if (!bounds) return null;
    const view = getViewSize(zoom);
    const tightBounds = (map.camera?.boundsSource ?? 'layers') === 'map';
    const insetLeft = tightBounds ? 0 : Math.min(140, Math.max(0, view.viewW * 0.08));
    const insetRight = tightBounds ? 0 : Math.min(140, Math.max(0, view.viewW * 0.08));
    const freeInsetY = tightBounds ? 0 : Math.min(120, Math.max(0, view.viewH * 0.1));
    const roadInsetTop = tightBounds ? 0 : Math.min(16, Math.max(0, view.viewH * 0.02));
    const roadInsetBottom = tightBounds ? 0 : Math.min(56, Math.max(0, view.viewH * 0.04));
    const moveMode = map.camera?.moveMode ?? 'road-both';
    const insetTop = moveMode === 'free' ? freeInsetY : roadInsetTop;
    const insetBottom = moveMode === 'free' ? freeInsetY : roadInsetBottom;
    const pad = map.camera?.boundsPad ?? 0;
    return {
        minX: bounds.left + insetLeft - pad,
        maxX: bounds.right - view.viewW - insetRight + pad,
        minY: bounds.top + insetTop - pad,
        maxY: bounds.bottom - view.viewH - insetBottom + pad,
    };
}

function getActiveIsoBounds(map: RuntimeMap): CameraIsoBounds | null {
    const camera = map.camera;
    const baseIso = getBoundsIso(map);
    if (!baseIso) return null;
    if (camera?.boundsEnabled && Number.isFinite(camera.boundsMinA) && Number.isFinite(camera.boundsMaxA) && Number.isFinite(camera.boundsMinB) && Number.isFinite(camera.boundsMaxB)) {
        return {
            ...baseIso,
            minA: camera.boundsMinA ?? baseIso.minA,
            maxA: camera.boundsMaxA ?? baseIso.maxA,
            minB: camera.boundsMinB ?? baseIso.minB,
            maxB: camera.boundsMaxB ?? baseIso.maxB,
        };
    }
    if (camera?.isoClamp) {
        return baseIso;
    }
    return null;
}

function getBoundsWorld(map: RuntimeMap): { left: number; right: number; top: number; bottom: number } | null {
    const source = map.camera?.boundsSource ?? 'layers';
    if (source === 'none') return null;
    if (source === 'map') return computeMapWorldBounds(map);
    return computeLayerWorldBounds(map, map.layers?.ground) ?? computeMapWorldBounds(map);
}

function getBoundsIso(map: RuntimeMap): (CameraIsoBounds & { originX: number; originY: number }) | null {
    const source = map.camera?.boundsSource ?? 'layers';
    if (source === 'none') return null;
    if (source === 'map') return computeIsoBoundsFromMap(map);
    return computeIsoBoundsFromLayer(map, map.layers?.ground) ?? computeIsoBoundsFromMap(map);
}

function mapDiamondPoints(map: RuntimeMap): { top: ScenePoint; right: ScenePoint; bottom: ScenePoint; left: ScenePoint } | null {
    if (map.width <= 0 || map.height <= 0) return null;
    const halfW = map.tileWidth / 2;
    const halfH = map.tileHeight / 2;
    const lastX = map.width - 1;
    const lastY = map.height - 1;
    const c00 = tileToWorld(map, 0, 0);
    const cR0 = tileToWorld(map, lastX, 0);
    const cRR = tileToWorld(map, lastX, lastY);
    const c0B = tileToWorld(map, 0, lastY);
    return {
        top: { x: c00.x, y: c00.y - halfH },
        right: { x: cR0.x + halfW, y: cR0.y },
        bottom: { x: cRR.x, y: cRR.y + halfH },
        left: { x: c0B.x - halfW, y: c0B.y },
    };
}

function computeMapWorldBounds(map: RuntimeMap): { left: number; right: number; top: number; bottom: number } | null {
    const diamond = mapDiamondPoints(map);
    if (!diamond) return null;
    return {
        left: diamond.left.x,
        right: diamond.right.x,
        top: diamond.top.y,
        bottom: diamond.bottom.y,
    };
}

function computeLayerWorldBounds(
    map: RuntimeMap,
    layer: number[] | undefined,
): { left: number; right: number; top: number; bottom: number } | null {
    if (!layer) return null;
    const halfW = map.tileWidth / 2;
    const halfH = map.tileHeight / 2;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let found = false;
    for (let row = 0; row < map.height; row += 1) {
        for (let col = 0; col < map.width; col += 1) {
            if (getLayerCell(layer, map.width, col, row) <= 0) continue;
            found = true;
            const world = tileToWorld(map, col, row);
            minX = Math.min(minX, world.x - halfW);
            maxX = Math.max(maxX, world.x + halfW);
            minY = Math.min(minY, world.y - halfH);
            maxY = Math.max(maxY, world.y + halfH);
        }
    }
    if (!found) return null;
    return { left: minX, right: maxX, top: minY, bottom: maxY };
}

function computeIsoBoundsFromMap(map: RuntimeMap): (CameraIsoBounds & { originX: number; originY: number }) | null {
    const diamond = mapDiamondPoints(map);
    if (!diamond) return null;
    const origin = getIsoOrigin(map);
    const halfW = map.tileWidth / 2;
    const halfH = map.tileHeight / 2;
    const points = [diamond.top, diamond.right, diamond.bottom, diamond.left];
    return computeIsoBoundsFromPoints(points, origin.x, origin.y, halfW, halfH);
}

function computeIsoBoundsFromLayer(
    map: RuntimeMap,
    layer: number[] | undefined,
): (CameraIsoBounds & { originX: number; originY: number }) | null {
    if (!layer) return null;
    const origin = getIsoOrigin(map);
    const halfW = map.tileWidth / 2;
    const halfH = map.tileHeight / 2;
    const points: ScenePoint[] = [];
    for (let row = 0; row < map.height; row += 1) {
        for (let col = 0; col < map.width; col += 1) {
            if (getLayerCell(layer, map.width, col, row) <= 0) continue;
            const world = tileToWorld(map, col, row);
            points.push(
                { x: world.x, y: world.y - halfH },
                { x: world.x + halfW, y: world.y },
                { x: world.x, y: world.y + halfH },
                { x: world.x - halfW, y: world.y },
            );
        }
    }
    if (points.length === 0) return null;
    return computeIsoBoundsFromPoints(points, origin.x, origin.y, halfW, halfH);
}

function computeIsoBoundsFromPoints(
    points: ScenePoint[],
    originX: number,
    originY: number,
    halfW: number,
    halfH: number,
): CameraIsoBounds & { originX: number; originY: number } {
    let minA = Number.POSITIVE_INFINITY;
    let maxA = Number.NEGATIVE_INFINITY;
    let minB = Number.POSITIVE_INFINITY;
    let maxB = Number.NEGATIVE_INFINITY;
    for (const point of points) {
        const iso = worldToIso(point.x, point.y, originX, originY, halfW, halfH);
        minA = Math.min(minA, iso.a);
        maxA = Math.max(maxA, iso.a);
        minB = Math.min(minB, iso.b);
        maxB = Math.max(maxB, iso.b);
    }
    return { minA, maxA, minB, maxB, halfW, halfH, originX, originY };
}

function getRuntimeLimits(map: RuntimeMap, zoom: number): { left: number; right: number; top: number; bottom: number } | null {
    const rail = getRailScrollBounds(map);
    const view = getViewSize(zoom);
    if (rail) {
        return {
            left: rail.minX,
            right: rail.maxX + view.viewW,
            top: rail.minY,
            bottom: rail.maxY + view.viewH,
        };
    }
    const bounds = computeCameraScrollBounds(map, zoom);
    if (!bounds) return null;
    return {
        left: bounds.minX,
        right: bounds.maxX + view.viewW,
        top: bounds.minY,
        bottom: bounds.maxY + view.viewH,
    };
}

function tileToWorld(map: RuntimeMap, col: number, row: number): ScenePoint {
    return {
        x: (col - row) * (map.tileWidth / 2) + map.tileWidth / 2 + ISO_LAYER_X,
        y: (col + row) * (map.tileHeight / 2) + map.tileHeight / 2 + ISO_LAYER_Y,
    };
}

function worldToScreen(x: number, y: number): ScenePoint {
    return {
        x: GAME_W / 2 + (x - runtime.cameraCenter.x) * runtime.zoom,
        y: GAME_VIEW_H / 2 + (y - runtime.cameraCenter.y) * runtime.zoom,
    };
}

function getIsoOrigin(map: RuntimeMap): ScenePoint {
    return {
        x: map.tileWidth / 2 + ISO_LAYER_X,
        y: map.tileHeight / 2 + ISO_LAYER_Y,
    };
}

function worldToIso(x: number, y: number, originX: number, originY: number, halfW: number, halfH: number): { a: number; b: number } {
    const u = (x - originX) / halfW;
    const v = (y - originY) / halfH;
    return {
        a: u + v,
        b: v - u,
    };
}

function getLayerCell(layer: number[] | undefined, width: number, col: number, row: number): number {
    if (!layer) return 0;
    const index = row * width + col;
    const value = layer[index];
    return typeof value === 'number' ? (value | 0) : 0;
}

function projectPointToRail(px: number, py: number, rail: ScenePoint[]): ScenePoint {
    if (rail.length < 2) return { x: px, y: py };
    let bestX = rail[0].x;
    let bestY = rail[0].y;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < rail.length - 1; i += 1) {
        const from = rail[i];
        const to = rail[i + 1];
        const abX = to.x - from.x;
        const abY = to.y - from.y;
        const len2 = abX * abX + abY * abY;
        if (len2 <= 0.0001) continue;
        let t = ((px - from.x) * abX + (py - from.y) * abY) / len2;
        t = clampNumber(t, 0, 1);
        const qx = from.x + abX * t;
        const qy = from.y + abY * t;
        const dx = px - qx;
        const dy = py - qy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < bestDistance) {
            bestDistance = dist2;
            bestX = qx;
            bestY = qy;
        }
    }
    return { x: bestX, y: bestY };
}

function ensureTileImage(map: RuntimeMap, gid: number): ImageEntry | null {
    const ref = map.tiles?.[gid - 1];
    if (!ref) return null;
    const path = normalizeAssetPath(ref);
    if (!path) return null;
    const cached = runtime.images.get(path);
    if (cached) return cached;
    const img = new Image();
    const entry: ImageEntry = { img, ready: false, failed: false };
    runtime.images.set(path, entry);
    img.onload = () => {
        entry.ready = true;
    };
    img.onerror = () => {
        entry.failed = true;
    };
    img.src = toAssetUrl(path);
    return entry;
}

function primeTileImages(map: RuntimeMap): void {
    for (const layerName of TILE_LAYERS) {
        const layer = map.layers?.[layerName];
        if (!layer) continue;
        for (let i = 0; i < layer.length; i += 1) {
            const gid = layer[i] | 0;
            if (gid > 0) ensureTileImage(map, gid);
        }
    }
}

function primeWorldItemImages(map: RuntimeMap): void {
    const entries = [
        ...collectWorldItems(map.buildings, map.buildingTemplates, 'buildings', '#95f2af'),
        ...collectWorldItems(map.obstacles, map.obstacleTemplates, 'objects', '#ffb56d'),
        ...collectWorldItems(map.graphics, map.graphicTemplates, 'graphics', '#8ee8ff'),
    ];
    for (const entry of entries) {
        if (entry.asset) ensureRuntimeImage(entry.asset);
    }
}

function ensureRuntimeImage(ref: string): ImageEntry | null {
    const path = normalizeAssetPath(ref);
    if (!path) return null;
    const cached = runtime.images.get(path);
    if (cached) return cached;
    const img = new Image();
    const entry: ImageEntry = { img, ready: false, failed: false };
    runtime.images.set(path, entry);
    img.onload = () => {
        entry.ready = true;
    };
    img.onerror = () => {
        entry.failed = true;
    };
    img.src = toAssetUrl(path);
    return entry;
}

function collectWorldItems(
    items: WorldItem[] | undefined,
    templates: WorldItemTemplate[] | undefined,
    kind: 'buildings' | 'objects' | 'graphics',
    color: string,
): Array<{ item: WorldItem; asset: string; color: string; kind: 'buildings' | 'objects' | 'graphics' }> {
    if (!items || items.length === 0) return [];
    const templateMap = new Map<string, WorldItemTemplate>();
    for (const template of templates ?? []) {
        const keys = [template.fileName, template.template, template.name];
        for (const key of keys) {
            if (key) templateMap.set(String(key).toLowerCase(), template);
        }
    }

    return items.map((item) => {
        const key = String(item.template || item.fileName || item.name || '').toLowerCase();
        const template = templateMap.get(key);
        const asset = resolveWorldItemAsset(item, template, kind);
        return { item, asset, color, kind };
    });
}

function resolveWorldItemAsset(
    item: WorldItem,
    template: WorldItemTemplate | undefined,
    kind: 'buildings' | 'objects' | 'graphics',
): string {
    const explicit = normalizeAssetPath(String(item.asset || template?.asset || ''));
    if (explicit) return explicit;

    const fileName = String(item.template || item.fileName || template?.fileName || template?.template || item.name || '').trim();
    if (!fileName) return '';

    const normalized = normalizeAssetPath(fileName);
    if (normalized.includes('/')) return normalized;

    const lowerFile = fileName.toLowerCase();
    const candidates = kind === 'buildings'
        ? [
            ...(lowerFile.includes('citadel') ? [`assets/build/citadel/${fileName}`] : []),
            ...(lowerFile.includes('port') ? [`assets/build/port/${fileName}`] : []),
            `assets/build/${fileName}`,
            `assets/build/citadel/${fileName}`,
            `assets/build/port/${fileName}`,
            `assets/structures/${fileName}`,
            `assets/maps/${fileName}`,
        ]
        : kind === 'objects'
            ? [`assets/objects/${fileName}`, `assets/ball/${fileName}`]
            : [`assets/graphics/${fileName}`, `assets/Graphics/${fileName}`];

    let resolved = candidates[0] ?? '';
    if (resolved && !resolved.includes('.')) {
        resolved += '.png';
    }
    return resolved;
}

function normalizeAssetPath(ref: string): string {
    const raw = String(ref || '').trim().replace(/\\/g, '/');
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw.replace(/^\/+/, '');
}

function toAssetUrl(ref: string): string {
    const normalized = normalizeAssetPath(ref);
    if (!normalized) return '';
    if (/^https?:\/\//i.test(normalized)) return normalized;
    // Vite serves public as root, so just returning /path works best
    return '/' + normalized;
}

function diamondPath(x: number, y: number, halfW: number, halfH: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y - halfH);
    ctx.lineTo(x + halfW, y);
    ctx.lineTo(x, y + halfH);
    ctx.lineTo(x - halfW, y);
    ctx.closePath();
}

function isMoveKey(code: string): boolean {
    return code === 'ArrowUp'
        || code === 'ArrowDown'
        || code === 'ArrowLeft'
        || code === 'ArrowRight'
        || code === 'KeyW'
        || code === 'KeyA'
        || code === 'KeyS'
        || code === 'KeyD';
}

function clampNumber(value: number, min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return value;
    if (max < min) return (min + max) / 2;
    return Math.max(min, Math.min(max, value));
}
