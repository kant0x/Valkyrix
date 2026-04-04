export type CameraPoint = { x: number; y: number };

export type CameraViewSize = { viewW: number; viewH: number };

export type CameraScrollBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

export type CameraIsoBounds = {
    minA: number;
    maxA: number;
    minB: number;
    maxB: number;
    halfW: number;
    halfH: number;
};

export function computeViewSize(viewportWidth: number, viewportHeight: number, zoom: number): CameraViewSize {
    const z = Math.max(0.1, zoom);
    return {
        viewW: viewportWidth / z,
        viewH: viewportHeight / z,
    };
}

export function scrollToCenter(
    scrollX: number,
    scrollY: number,
    viewW: number,
    viewH: number,
    centerOffsetY = 0,
): CameraPoint {
    return {
        x: scrollX + viewW / 2,
        y: scrollY + viewH / 2 - centerOffsetY,
    };
}

export function centerToScroll(
    centerX: number,
    centerY: number,
    viewW: number,
    viewH: number,
    centerOffsetY = 0,
): CameraPoint {
    return {
        x: centerX - viewW / 2,
        y: centerY - viewH / 2 + centerOffsetY,
    };
}

export function clampCenterToScrollBounds(
    centerX: number,
    centerY: number,
    viewW: number,
    viewH: number,
    bounds: CameraScrollBounds,
    centerOffsetY = 0,
): CameraPoint {
    const minCenterX = bounds.minX + viewW / 2;
    const maxCenterX = bounds.maxX + viewW / 2;
    const minCenterY = bounds.minY + viewH / 2 - centerOffsetY;
    const maxCenterY = bounds.maxY + viewH / 2 - centerOffsetY;
    return {
        x: maxCenterX < minCenterX ? (minCenterX + maxCenterX) / 2 : clamp(centerX, minCenterX, maxCenterX),
        y: maxCenterY < minCenterY ? (minCenterY + maxCenterY) / 2 : clamp(centerY, minCenterY, maxCenterY),
    };
}

export function clampScrollToIsoDiamond(
    scrollX: number,
    scrollY: number,
    viewW: number,
    viewH: number,
    originX: number,
    originY: number,
    bounds: CameraIsoBounds,
    pad: number,
): CameraPoint {
    const viewport = getViewportIsoRange(scrollX, scrollY, viewW, viewH, originX, originY, bounds);
    const padA = Number.isFinite(pad) ? (pad / bounds.halfW + pad / bounds.halfH) : 0;
    const minAAllowed = bounds.minA - padA;
    const maxAAllowed = bounds.maxA + padA;
    const minBAllowed = bounds.minB - padA;
    const maxBAllowed = bounds.maxB + padA;
    const minDeltaA = minAAllowed - viewport.minA;
    const maxDeltaA = maxAAllowed - viewport.maxA;
    const minDeltaB = minBAllowed - viewport.minB;
    const maxDeltaB = maxBAllowed - viewport.maxB;
    const deltaA = (0 < minDeltaA) ? minDeltaA : (0 > maxDeltaA ? maxDeltaA : 0);
    const deltaB = (0 < minDeltaB) ? minDeltaB : (0 > maxDeltaB ? maxDeltaB : 0);
    const dx = (bounds.halfW / 2) * (deltaA - deltaB);
    const dy = (bounds.halfH / 2) * (deltaA + deltaB);
    return { x: scrollX + dx, y: scrollY + dy };
}

export function computeRoadViewOffset(
    zoom: number,
    topBarHeight: number,
    roadOffsetY: number,
    isFreeMode: boolean,
    isPreviewEnabled: boolean,
): number {
    if (isFreeMode) return 0;
    if (!isPreviewEnabled) return 0;
    return -(topBarHeight / Math.max(0.1, zoom)) + roadOffsetY;
}

function getViewportIsoRange(
    scrollX: number,
    scrollY: number,
    viewW: number,
    viewH: number,
    originX: number,
    originY: number,
    bounds: CameraIsoBounds,
): { minA: number; maxA: number; minB: number; maxB: number } {
    const corners = [
        { x: scrollX, y: scrollY },
        { x: scrollX + viewW, y: scrollY },
        { x: scrollX, y: scrollY + viewH },
        { x: scrollX + viewW, y: scrollY + viewH },
    ];
    let minA = Number.POSITIVE_INFINITY;
    let maxA = Number.NEGATIVE_INFINITY;
    let minB = Number.POSITIVE_INFINITY;
    let maxB = Number.NEGATIVE_INFINITY;
    for (const c of corners) {
        const u = (c.x - originX) / bounds.halfW;
        const v = (c.y - originY) / bounds.halfH;
        const a = u + v;
        const b = v - u;
        if (a < minA) minA = a;
        if (a > maxA) maxA = a;
        if (b < minB) minB = b;
        if (b > maxB) maxB = b;
    }
    return { minA, maxA, minB, maxB };
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
