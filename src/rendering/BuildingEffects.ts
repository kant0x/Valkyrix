export function drawCitadelAura(
    ctx: CanvasRenderingContext2D,
    nowMs: number
): void {
    void ctx;
    void nowMs;
}

type OrbitLayer = 'behind' | 'front';

export type CitadelOrbDescriptor = {
    slot: number;
    angle: number;
    depth: number;
    brightness: number;
    offsetX: number;
    offsetY: number;
    scale: number;
    isFront: boolean;
};

export type AttackTowerOrbDescriptor = {
    angle: number;
    offsetX: number;
    offsetY: number;
    scale: number;
};

export function getCitadelOrbDescriptors(
    nowMs: number,
    count = 2,
    width = 192,
    height = 192,
): CitadelOrbDescriptor[] {
    const now = nowMs / 1000;
    const descriptors: CitadelOrbDescriptor[] = [];
    const centerOffsetY = -height * 0.74;
    const orbitRadiusX = Math.max(22, width * 0.26);
    const orbitRadiusY = Math.max(10, height * 0.08);

    for (let i = 0; i < count; i += 1) {
        const angle = now * 0.9 + (i / count) * Math.PI * 2;
        const depth = Math.sin(angle);
        const brightness = (depth + 1) / 2;
        const xFactor = Math.cos(angle);
        const yFactor = Math.sin(angle);
        descriptors.push({
            slot: i,
            angle,
            depth,
            brightness,
            offsetX: xFactor * orbitRadiusX,
            offsetY: centerOffsetY + yFactor * orbitRadiusY,
            scale: 0.88 + brightness * 0.42,
            isFront: depth >= 0,
        });
    }

    return descriptors;
}

export function getAttackTowerOrbDescriptor(
    nowMs: number,
    width = 64,
    height = 96,
): AttackTowerOrbDescriptor {
    const now = nowMs / 1000;
    const angle = now * 2.4;
    const orbitRadiusX = Math.max(1.5, width * 0.035);
    const orbitRadiusY = Math.max(1, height * 0.012);
    const centerOffsetY = -height * 0.52;
    const depth = (Math.sin(angle) + 1) / 2;
    return {
        angle,
        offsetX: Math.cos(angle) * orbitRadiusX,
        offsetY: centerOffsetY + Math.sin(angle) * orbitRadiusY,
        scale: 0.88 + depth * 0.12,
    };
}

export function drawCitadelOrbitingSwarm(
    ctx: CanvasRenderingContext2D,
    drawX: number,
    drawY: number,
    width: number,
    height: number,
    nowMs: number,
    layer: OrbitLayer
): void {
    const anchorX = drawX + width * 0.5;
    const anchorY = drawY + height;
    const descriptors = getCitadelOrbDescriptors(nowMs, 4, width, height);
    const sprites: Array<{
        x: number;
        y: number;
        depth: number;
        scale: number;
    }> = [];

    for (const descriptor of descriptors) {
        if ((layer === 'front') !== descriptor.isFront) continue;
        sprites.push({
            x: anchorX + descriptor.offsetX,
            y: anchorY + descriptor.offsetY,
            depth: descriptor.depth,
            scale: descriptor.scale,
        });
    }

    sprites.sort((a, b) => a.y - b.y);

    for (const sprite of sprites) {
        const depthUnit = (sprite.depth + 1) / 2;
        const alpha = layer === 'front'
            ? 0.34 + depthUnit * 0.34
            : 0.14 + depthUnit * 0.14;
        const radius = Math.max(4, width * 0.028 * sprite.scale);

        ctx.save();
        ctx.shadowColor = `rgba(94, 225, 255, ${alpha})`;
        ctx.shadowBlur = layer === 'front' ? 14 : 7;
        const grad = ctx.createRadialGradient(
            sprite.x - radius * 0.3,
            sprite.y - radius * 0.4,
            radius * 0.15,
            sprite.x,
            sprite.y,
            radius * 1.35,
        );
        grad.addColorStop(0, `rgba(236, 252, 255, ${alpha})`);
        grad.addColorStop(0.45, `rgba(98, 233, 255, ${alpha * 0.95})`);
        grad.addColorStop(1, `rgba(34, 120, 200, ${alpha * 0.25})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sprite.x, sprite.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(190, 248, 255, ${alpha * 0.85})`;
        ctx.lineWidth = Math.max(1, radius * 0.22);
        ctx.beginPath();
        ctx.arc(sprite.x, sprite.y, radius * 0.78, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

export function drawCitadelEnergyFlow(
    ctx: CanvasRenderingContext2D,
    drawX: number,
    drawY: number,
    width: number,
    height: number,
    nowMs: number
): void {
    const now = nowMs / 1000;
    const cx = drawX + width * 0.5;
    const topY = drawY + height * 0.06;
    const bottomY = drawY + height * 0.68;
    const columnHeight = Math.max(8, bottomY - topY);
    const topRadiusX = width * 0.038;
    const bottomRadiusX = width * 0.14;
    const topRadiusY = Math.max(2, width * 0.009);
    const bottomRadiusY = Math.max(5.2, width * 0.031);

    ctx.save();

    const bodyGrad = ctx.createLinearGradient(cx, topY, cx, bottomY);
    bodyGrad.addColorStop(0, 'rgba(126, 236, 255, 0.012)');
    bodyGrad.addColorStop(0.25, 'rgba(104, 222, 255, 0.03)');
    bodyGrad.addColorStop(0.58, 'rgba(82, 198, 255, 0.065)');
    bodyGrad.addColorStop(0.82, 'rgba(70, 168, 228, 0.05)');
    bodyGrad.addColorStop(1, 'rgba(36, 92, 160, 0.02)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(cx - topRadiusX, topY);
    ctx.bezierCurveTo(
        cx - topRadiusX * 1.04,
        topY + columnHeight * 0.2,
        cx - bottomRadiusX * 0.96,
        topY + columnHeight * 0.78,
        cx - bottomRadiusX,
        bottomY,
    );
    ctx.ellipse(cx, bottomY, bottomRadiusX, bottomRadiusY, 0, Math.PI, 0, true);
    ctx.bezierCurveTo(
        cx + bottomRadiusX * 0.96,
        topY + columnHeight * 0.78,
        cx + topRadiusX * 1.04,
        topY + columnHeight * 0.2,
        cx + topRadiusX,
        topY,
    );
    ctx.ellipse(cx, topY, topRadiusX, topRadiusY, 0, 0, Math.PI, true);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120, 228, 255, 0.075)';
    ctx.lineWidth = Math.max(1, width * 0.0065);
    ctx.beginPath();
    ctx.moveTo(cx - topRadiusX * 0.92, topY + topRadiusY * 0.45);
    ctx.bezierCurveTo(
        cx - topRadiusX,
        topY + columnHeight * 0.18,
        cx - bottomRadiusX * 0.78,
        topY + columnHeight * 0.8,
        cx - bottomRadiusX * 0.82,
        bottomY - bottomRadiusY * 0.45,
    );
    ctx.moveTo(cx + topRadiusX * 0.92, topY + topRadiusY * 0.45);
    ctx.bezierCurveTo(
        cx + topRadiusX,
        topY + columnHeight * 0.18,
        cx + bottomRadiusX * 0.78,
        topY + columnHeight * 0.8,
        cx + bottomRadiusX * 0.82,
        bottomY - bottomRadiusY * 0.45,
    );
    ctx.stroke();

    ctx.strokeStyle = 'rgba(170, 244, 255, 0.1)';
    ctx.lineWidth = Math.max(1, width * 0.005);
    ctx.beginPath();
    ctx.ellipse(cx, topY, topRadiusX, topRadiusY, 0, Math.PI, 0, true);
    ctx.stroke();

    const laneLerp = [-0.52, 0, 0.52];
    for (let lane = 0; lane < laneLerp.length; lane += 1) {
        const laneFactor = laneLerp[lane];
        for (let i = 0; i < 11; i += 1) {
            const progress = (now * 0.28 + i / 11 + lane * 0.17) % 1;
            const y = bottomY - progress * columnHeight;
            const laneRadius = bottomRadiusX + (topRadiusX - bottomRadiusX) * progress;
            const laneOffset = laneRadius * laneFactor;
            const drift = Math.sin(now * 1.5 + i * 0.9 + lane) * laneRadius * 0.06;
            const glyphSize = width * (lane === 1 ? 0.024 : 0.02);
            const alpha = lane === 1 ? 0.16 : 0.1;
            drawCitadelRuneGlyph(ctx, cx + laneOffset + drift, y, glyphSize, alpha);
        }
    }

    ctx.restore();
}

function drawCitadelRuneGlyph(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    alpha: number,
): void {
    const h = Math.max(3, size * 1.5);
    const w = Math.max(2, size * 0.72);

    ctx.save();
    ctx.strokeStyle = `rgba(162, 244, 255, ${alpha})`;
    ctx.lineWidth = Math.max(1, size * 0.18);
    ctx.lineCap = 'round';
    ctx.shadowColor = `rgba(86, 214, 255, ${alpha * 0.45})`;
    ctx.shadowBlur = size * 1.1;

    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.62);
    ctx.lineTo(x + w, y - h * 0.08);
    ctx.lineTo(x, y + h * 0.62);
    ctx.lineTo(x - w, y - h * 0.08);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.4);
    ctx.lineTo(x, y + h * 0.34);
    ctx.moveTo(x - w * 0.46, y - h * 0.04);
    ctx.lineTo(x + w * 0.46, y - h * 0.04);
    ctx.stroke();

    ctx.restore();
}
