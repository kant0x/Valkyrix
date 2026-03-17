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
import { ScreenManager } from './screens/ScreenManager';
import { WalletSplashScreen } from './screens/WalletSplashScreen';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { EscMenuOverlay } from './screens/EscMenuOverlay';
import { HudOverlay } from './screens/HudOverlay';

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
    buildings?: WorldItem[];
    obstacles?: WorldItem[];
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
    keys: Set<string>;
    images: Map<string, ImageEntry>;
};

const GAME_W = 1280;
const GAME_H = 720;
const TOP_BAR_HEIGHT = 42;
const HUD_HEIGHT = 172;
const GAME_VIEW_H = GAME_H - TOP_BAR_HEIGHT - HUD_HEIGHT;
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
const STYLE_ID = 'valkyrix-runtime-style';

// Module-level references — initialized by GameScreen.mount()
let mapLabelEl: HTMLHeadingElement;
let modeChipEl: HTMLDivElement;
let statusEl: HTMLDivElement;
let mapStatsEl: HTMLPreElement;
let cameraStatsEl: HTMLPreElement;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let animating = false;

// Runtime state — initialized by GameScreen.mount()
let runtime: RuntimeState = {
    map: null,
    mapSource: '',
    mapName: 'active-map.json',
    cameraCenter: { x: 0, y: 0 },
    zoom: 1,
    status: 'Loading map...',
    error: null,
    showDebugMasks: true,
    lastFrameMs: performance.now(),
    dragging: false,
    dragX: 0,
    dragY: 0,
    keys: new Set<string>(),
    images: new Map<string, ImageEntry>(),
};

class GameScreen {
    private escMenu: EscMenuOverlay | null = null;
    private hud: HudOverlay | null = null;

    constructor(private readonly manager: ScreenManager) {}

    mount(container: HTMLElement): void {
        ensureRuntimeStyle();
        container.innerHTML = `
    <div class="vk-app">
        <section class="vk-shell">
            <header class="vk-topbar">
                <div>
                    <p class="vk-kicker">Valkyrix Runtime</p>
                    <h1 class="vk-title" id="vk-map-label">Loading active-map.json...</h1>
                </div>
                <div class="vk-chip" id="vk-mode-chip">camera</div>
            </header>
            <div class="vk-viewport-frame">
                <canvas id="vk-canvas"></canvas>
                <div class="vk-overlay">
                    <div class="vk-overlay-line" id="vk-status">Loading map...</div>
                    <div class="vk-overlay-line">WASD / arrows move camera, drag with mouse, F resets start, R reloads map, V toggles debug masks.</div>
                </div>
            </div>
            <footer class="vk-hud">
                <section class="vk-panel">
                    <h2>Map</h2>
                    <pre id="vk-map-stats">booting...</pre>
                </section>
                <section class="vk-panel">
                    <h2>Camera</h2>
                    <pre id="vk-camera-stats">booting...</pre>
                </section>
            </footer>
        </section>
    </div>
`;

        mapLabelEl = getRequiredElement<HTMLHeadingElement>('vk-map-label');
        modeChipEl = getRequiredElement<HTMLDivElement>('vk-mode-chip');
        statusEl = getRequiredElement<HTMLDivElement>('vk-status');
        mapStatsEl = getRequiredElement<HTMLPreElement>('vk-map-stats');
        cameraStatsEl = getRequiredElement<HTMLPreElement>('vk-camera-stats');
        canvas = getRequiredElement<HTMLCanvasElement>('vk-canvas');

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
            showDebugMasks: true,
            lastFrameMs: performance.now(),
            dragging: false,
            dragX: 0,
            dragY: 0,
            keys: new Set<string>(),
            images: new Map<string, ImageEntry>(),
        };

        bindInput();
        void loadMap();
        if (!animating) {
            animating = true;
            requestAnimationFrame(frame);
        }

        // Mount overlays on top of game canvas
        this.escMenu = new EscMenuOverlay(this.manager);
        this.escMenu.mount(container);

        this.hud = new HudOverlay();
        this.hud.mount(container);
    }

    unmount(): void {
        this.escMenu?.unmount();
        this.hud?.unmount();
        this.escMenu = null;
        this.hud = null;
        // Clear game DOM
        const container = document.getElementById('game-container');
        if (container) container.innerHTML = '';
    }
}

// ScreenManager initialization — two-step to resolve circular reference
const appContainer = document.getElementById('game-container');
if (!appContainer) {
    throw new Error('Missing #game-container');
}

let screenManager: ScreenManager;

const walletScreen = new WalletSplashScreen({ navigateTo: (s) => screenManager.navigateTo(s) } as ScreenManager);
const menuScreen = new MainMenuScreen({ navigateTo: (s) => screenManager.navigateTo(s) } as ScreenManager);
const gameScreen = new GameScreen({ navigateTo: (s) => screenManager.navigateTo(s) } as ScreenManager);

screenManager = new ScreenManager(appContainer, {
    wallet: walletScreen,
    menu: menuScreen,
    game: gameScreen,
});

screenManager.navigateTo('wallet');

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
            background: transparent;
        }
        .vk-app {
            min-height: 100%;
            display: grid;
            place-items: center;
            padding: 18px;
        }
        .vk-shell {
            width: min(calc(100vw - 36px), calc((100vh - 36px) * ${GAME_W} / ${GAME_H}));
            aspect-ratio: ${GAME_W} / ${GAME_H};
            display: grid;
            grid-template-rows: ${TOP_BAR_HEIGHT}px 1fr ${HUD_HEIGHT}px;
            border: 1px solid rgba(151, 194, 235, 0.18);
            border-radius: 22px;
            overflow: hidden;
            background:
                linear-gradient(180deg, rgba(14, 24, 38, 0.96), rgba(6, 11, 19, 0.98)),
                linear-gradient(120deg, rgba(44, 85, 123, 0.2), transparent 50%);
            box-shadow:
                0 28px 60px rgba(0, 0, 0, 0.45),
                inset 0 0 0 1px rgba(255, 255, 255, 0.03);
        }
        .vk-topbar, .vk-hud {
            position: relative;
            z-index: 2;
            background:
                linear-gradient(180deg, rgba(10, 19, 30, 0.98), rgba(8, 13, 21, 0.96));
        }
        .vk-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 8px 18px;
            border-bottom: 1px solid rgba(120, 171, 214, 0.12);
        }
        .vk-kicker {
            margin: 0;
            font-size: 11px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #8fb9de;
        }
        .vk-title {
            margin: 1px 0 0;
            font-size: 18px;
            line-height: 1.1;
            color: #edf5ff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .vk-chip {
            padding: 7px 12px;
            border-radius: 999px;
            border: 1px solid rgba(126, 190, 240, 0.24);
            background: rgba(34, 57, 84, 0.72);
            color: #cde7ff;
            font-size: 12px;
            white-space: nowrap;
        }
        .vk-viewport-frame {
            position: relative;
            background:
                radial-gradient(circle at top, rgba(36, 61, 89, 0.3), transparent 42%),
                linear-gradient(180deg, #08101b 0%, #04070d 100%);
        }
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
            justify-content: space-between;
            padding: 12px 14px;
        }
        .vk-overlay-line {
            align-self: flex-start;
            max-width: min(100%, 820px);
            padding: 7px 10px;
            border-radius: 12px;
            background: rgba(5, 9, 15, 0.68);
            border: 1px solid rgba(139, 194, 235, 0.14);
            color: #d7e8fa;
            font-size: 12px;
            line-height: 1.4;
            backdrop-filter: blur(6px);
        }
        .vk-hud {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            padding: 12px 14px 14px;
            border-top: 1px solid rgba(120, 171, 214, 0.12);
        }
        .vk-panel {
            min-width: 0;
            padding: 12px 14px;
            border-radius: 16px;
            background: rgba(6, 11, 18, 0.9);
            border: 1px solid rgba(132, 185, 228, 0.12);
        }
        .vk-panel h2 {
            margin: 0 0 8px;
            font-size: 11px;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #8fb9de;
        }
        .vk-panel pre {
            margin: 0;
            white-space: pre-wrap;
            font-family: Consolas, "Courier New", monospace;
            font-size: 12px;
            line-height: 1.45;
            color: #d7e4f4;
        }
        @media (max-width: 960px) {
            .vk-app { padding: 10px; }
            .vk-shell {
                width: min(calc(100vw - 20px), calc((100vh - 20px) * ${GAME_W} / ${GAME_H}));
                border-radius: 18px;
            }
            .vk-hud {
                gap: 8px;
                padding: 10px;
            }
            .vk-panel {
                padding: 10px 12px;
            }
            .vk-panel pre {
                font-size: 11px;
            }
        }
    `;
    document.head.append(style);
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing required element #${id}`);
    return el as T;
}

function configureCanvas(target: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D): void {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    target.width = Math.round(GAME_W * dpr);
    target.height = Math.round(GAME_VIEW_H * dpr);
    targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    targetCtx.imageSmoothingEnabled = true;
}

function bindInput(): void {
    window.addEventListener('keydown', (event) => {
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
    });

    window.addEventListener('keyup', (event) => {
        runtime.keys.delete(event.code);
    });

    canvas.addEventListener('pointerdown', (event) => {
        runtime.dragging = true;
        runtime.dragX = event.clientX;
        runtime.dragY = event.clientY;
        canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
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
    });

    const endDrag = (event: PointerEvent) => {
        if (runtime.dragging) {
            runtime.dragging = false;
            if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId);
            }
        }
    };

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
}

async function loadMap(showReloadStatus = false): Promise<void> {
    runtime.error = null;
    runtime.status = showReloadStatus ? 'Reloading active map...' : 'Loading active map...';
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
        runtime.status = showReloadStatus ? 'Map reloaded from active-map.json.' : 'Map loaded.';
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
    if (moveX === 0 && moveY === 0) return;
    const len = Math.hypot(moveX, moveY) || 1;
    const nextCenter = {
        x: runtime.cameraCenter.x + (moveX / len) * MOVE_SPEED * dt,
        y: runtime.cameraCenter.y + (moveY / len) * MOVE_SPEED * dt,
    };
    runtime.cameraCenter = clampCameraCenter(runtime.map, runtime.zoom, nextCenter);
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
    drawSceneRail(runtime.map);
    drawSceneMarkers(runtime.map);
    drawWorldItems(runtime.map.graphics, '#8ee8ff');
    drawWorldItems(runtime.map.obstacles, '#ffb56d');
    drawWorldItems(runtime.map.buildings, '#95f2af');
    drawCameraFocus(runtime.map);
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

function drawWorldItems(items: WorldItem[] | undefined, color: string): void {
    if (!items || items.length === 0) return;
    ctx.save();
    ctx.fillStyle = color;
    for (const item of items) {
        if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
        const screen = worldToScreen(item.x ?? 0, item.y ?? 0);
        const width = Math.max(8, Math.min(34, (item.w ?? 22) * runtime.zoom * 0.16));
        const height = Math.max(8, Math.min(34, (item.h ?? 22) * runtime.zoom * 0.16));
        ctx.fillRect(screen.x - width / 2, screen.y - height / 2, width, height);
    }
    ctx.restore();
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
        TOP_BAR_HEIGHT,
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
    return new URL(normalized, window.location.href).toString();
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
