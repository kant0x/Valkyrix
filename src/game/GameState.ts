import { extractOrderedPath } from './PathExtractor';
import type { GameState, PathNode } from './game.types';

const ISO_LAYER_X = 1152;

function normalizeRailNode(node: any): PathNode | null {
  if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return null;
  return { wx: node.x, wy: node.y };
}

function worldToTile(wx: number, wy: number, tileWidth: number, tileHeight: number): { col: number; row: number } {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  const localX = wx - ISO_LAYER_X - halfW;
  const localY = wy - halfH;
  return {
    col: Math.round((localX / halfW + localY / halfH) / 2),
    row: Math.round((localY / halfH - localX / halfW) / 2),
  };
}

function collectPathTileCenters(mapJson: any): PathNode[] {
  const pathLayer = mapJson.layers?.paths;
  const width = mapJson.width ?? 0;
  const height = mapJson.height ?? 0;
  const tileWidth = mapJson.tileWidth ?? 64;
  const tileHeight = mapJson.tileHeight ?? 32;
  if (!Array.isArray(pathLayer) || width <= 0 || height <= 0) return [];

  const nodes: PathNode[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const idx = row * width + col;
      if ((pathLayer[idx] | 0) <= 0) continue;
      nodes.push(tileToWorld(col, row, tileWidth, tileHeight));
    }
  }
  return nodes;
}

function isPathCell(pathLayer: number[], width: number, height: number, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= width || row >= height) return false;
  return (pathLayer[row * width + col] | 0) > 0;
}

function findNearestPathCell(
  pathLayer: number[],
  width: number,
  height: number,
  startCol: number,
  startRow: number,
  maxRadius = 8,
): { col: number; row: number } | null {
  if (isPathCell(pathLayer, width, height, startCol, startRow)) {
    return { col: startCol, row: startRow };
  }

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    let best: { col: number; row: number } | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let row = startRow - radius; row <= startRow + radius; row += 1) {
      for (let col = startCol - radius; col <= startCol + radius; col += 1) {
        if (!isPathCell(pathLayer, width, height, col, row)) continue;
        const dx = col - startCol;
        const dy = row - startRow;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          best = { col, row };
          bestDist = d2;
        }
      }
    }
    if (best) return best;
  }

  return null;
}

function resolvePathFromMask(mapJson: any, spawnNode: PathNode | null): PathNode[] {
  const pathLayer = mapJson.layers?.paths;
  const width = mapJson.width ?? 0;
  const height = mapJson.height ?? 0;
  const tileWidth = mapJson.tileWidth ?? 64;
  const tileHeight = mapJson.tileHeight ?? 32;
  if (!Array.isArray(pathLayer) || width <= 0 || height <= 0) return [];

  const portal = mapJson.scene?.portals?.[0];
  const portalStep = resolvePortalStep(String(portal?.direction || '').toLowerCase());
  const spawnColGuess = Number.isFinite(portal?.col)
    ? portal.col + portalStep.dc
    : worldToTile(spawnNode?.wx ?? 0, spawnNode?.wy ?? 0, tileWidth, tileHeight).col;
  const spawnRowGuess = Number.isFinite(portal?.row)
    ? portal.row + portalStep.dr
    : worldToTile(spawnNode?.wx ?? 0, spawnNode?.wy ?? 0, tileWidth, tileHeight).row;

  const citadel = normalizeRailNode(mapJson.scene?.citadel);
  if (!citadel) return [];
  const citadelTile = worldToTile(citadel.wx, citadel.wy, tileWidth, tileHeight);

  const start = findNearestPathCell(pathLayer, width, height, spawnColGuess, spawnRowGuess, 6);
  const goal = findNearestPathCell(pathLayer, width, height, citadelTile.col, citadelTile.row, 10);
  if (!start || !goal) return [];

  const startKey = `${start.col},${start.row}`;
  const goalKey = `${goal.col},${goal.row}`;
  if (startKey === goalKey) return [tileToWorld(start.col, start.row, tileWidth, tileHeight)];

  const open: Array<{ col: number; row: number }> = [start];
  const parent = new Map<string, string>();
  const visited = new Set<string>([startKey]);
  const directions = [
    { dc: 1, dr: 0 }, { dc: -1, dr: 0 }, { dc: 0, dr: 1 }, { dc: 0, dr: -1 },
    { dc: 1, dr: 1 }, { dc: 1, dr: -1 }, { dc: -1, dr: 1 }, { dc: -1, dr: -1 },
  ];

  while (open.length > 0) {
    const current = open.shift()!;
    const key = `${current.col},${current.row}`;
    if (key === goalKey) break;

    for (const d of directions) {
      const col = current.col + d.dc;
      const row = current.row + d.dr;
      if (!isPathCell(pathLayer, width, height, col, row)) continue;
      const nextKey = `${col},${row}`;
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      parent.set(nextKey, key);
      open.push({ col, row });
    }
  }

  if (!visited.has(goalKey)) return [];

  const cells: Array<{ col: number; row: number }> = [];
  let cursor: string | undefined = goalKey;
  while (cursor) {
    const [colStr, rowStr] = cursor.split(',');
    cells.push({ col: Number(colStr), row: Number(rowStr) });
    if (cursor === startKey) break;
    cursor = parent.get(cursor);
  }
  cells.reverse();

  if (cells.length === 0) return [];

  return dedupeSequential(cells.map((cell) => tileToWorld(cell.col, cell.row, tileWidth, tileHeight)));
}

function snapNodeToPath(node: PathNode, pathTiles: PathNode[], maxDistance: number): PathNode {
  if (pathTiles.length === 0) return node;
  const maxDistanceSq = maxDistance * maxDistance;
  let best = node;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const tile of pathTiles) {
    const dx = tile.wx - node.wx;
    const dy = tile.wy - node.wy;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = tile;
    }
  }
  return bestDistanceSq <= maxDistanceSq ? best : node;
}

function tileToWorld(col: number, row: number, tileWidth: number, tileHeight: number): PathNode {
  return {
    wx: (col - row) * (tileWidth / 2) + tileWidth / 2 + ISO_LAYER_X,
    wy: (col + row) * (tileHeight / 2) + tileHeight / 2,
  };
}

function normalizeVector(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function resolvePortalForward(dir: string, tileWidth: number, tileHeight: number): { x: number; y: number } {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  switch (dir) {
    case 'west': return normalizeVector(-halfW, -halfH);
    case 'north': return normalizeVector(halfW, -halfH);
    case 'south': return normalizeVector(-halfW, halfH);
    case 'east':
    default:
      return normalizeVector(halfW, halfH);
  }
}

function resolvePortalStep(dir: string): { dc: number; dr: number } {
  switch (dir) {
    case 'west': return { dc: -1, dr: 0 };
    case 'north': return { dc: 0, dr: -1 };
    case 'south': return { dc: 0, dr: 1 };
    case 'east':
    default:
      return { dc: 1, dr: 0 };
  }
}

function resolvePortalLeadNodes(mapJson: any, maxSteps = 1): PathNode[] {
  const portal = mapJson.scene?.portals?.[0];
  const pathLayer = mapJson.layers?.paths;
  const width = mapJson.width ?? 0;
  const height = mapJson.height ?? 0;
  const tileWidth = mapJson.tileWidth ?? 64;
  const tileHeight = mapJson.tileHeight ?? 32;
  if (!portal || !Array.isArray(pathLayer) || !Number.isFinite(portal.col) || !Number.isFinite(portal.row)) {
    return [];
  }

  const step = resolvePortalStep(String(portal.direction || '').toLowerCase());
  const nodes: PathNode[] = [];
  for (let i = 1; i <= maxSteps; i += 1) {
    const col = portal.col + step.dc * i;
    const row = portal.row + step.dr * i;
    if (col < 0 || row < 0 || col >= width || row >= height) break;
    const idx = row * width + col;
    if ((pathLayer[idx] | 0) <= 0) break;
    nodes.push(tileToWorld(col, row, tileWidth, tileHeight));
  }
  return nodes;
}

function resolveEnemyLaneOffsets(mapJson: any, spawnNode: PathNode | null): number[] {
  const portal = mapJson.scene?.portals?.[0];
  const pathLayer = mapJson.layers?.paths;
  const width = mapJson.width ?? 0;
  const height = mapJson.height ?? 0;
  const tileWidth = mapJson.tileWidth ?? 64;
  const tileHeight = mapJson.tileHeight ?? 32;
  if (!portal || !spawnNode || !Array.isArray(pathLayer) || !Number.isFinite(portal.col) || !Number.isFinite(portal.row)) {
    return [0];
  }

  const forward = resolvePortalForward(String(portal.direction || '').toLowerCase(), tileWidth, tileHeight);
  const perp = { x: -forward.y, y: forward.x };
  const projections: number[] = [];

  for (let row = Math.max(0, portal.row - 5); row <= Math.min(height - 1, portal.row + 5); row += 1) {
    for (let col = Math.max(0, portal.col - 5); col <= Math.min(width - 1, portal.col + 5); col += 1) {
      const idx = row * width + col;
      if ((pathLayer[idx] | 0) <= 0) continue;
      const world = tileToWorld(col, row, tileWidth, tileHeight);
      const relX = world.wx - spawnNode.wx;
      const relY = world.wy - spawnNode.wy;
      const along = relX * forward.x + relY * forward.y;
      if (Math.abs(along) > tileWidth * 0.9) continue;
      const lateral = relX * perp.x + relY * perp.y;
      projections.push(lateral);
    }
  }

  if (projections.length === 0) return [0];

  const sorted = projections.sort((a, b) => a - b);
  const grouped: number[] = [];
  const mergeThreshold = Math.max(10, tileWidth * 0.2);
  for (const value of sorted) {
    const prev = grouped[grouped.length - 1];
    if (prev === undefined || Math.abs(value - prev) > mergeThreshold) {
      grouped.push(value);
    }
  }

  if (grouped.length === 0) return [0];

  // Keep lane spread readable near portal: clamp extremes and keep center-most lanes.
  const maxAbs = Math.max(tileWidth * 0.9, 20);
  const clamped = grouped.filter((value) => Math.abs(value) <= maxAbs);
  const base = clamped.length > 0 ? clamped : grouped;
  const maxLanes = 5;
  if (base.length <= maxLanes) return base;

  const center = [...base].sort((a, b) => Math.abs(a) - Math.abs(b)).slice(0, maxLanes);
  return center.sort((a, b) => a - b);
}

function resolvePortalSpawnNode(mapJson: any): PathNode | null {
  const portal = mapJson.scene?.portals?.[0];
  if (!portal) return null;

  const tileWidth = mapJson.tileWidth ?? 64;
  const tileHeight = mapJson.tileHeight ?? 32;
  const width = mapJson.width ?? 0;
  const height = mapJson.height ?? 0;
  const pathLayer = mapJson.layers?.paths;
  if (!Array.isArray(pathLayer) || !Number.isFinite(portal.col) || !Number.isFinite(portal.row)) {
    return normalizeRailNode(portal);
  }

  const dir = String(portal.direction || '').toLowerCase();
  const offsets: Record<string, Array<{ dc: number; dr: number }>> = {
    east: [{ dc: 1, dr: 0 }, { dc: 0, dr: 0 }, { dc: 1, dr: -1 }, { dc: 1, dr: 1 }],
    west: [{ dc: -1, dr: 0 }, { dc: 0, dr: 0 }, { dc: -1, dr: -1 }, { dc: -1, dr: 1 }],
    north: [{ dc: 0, dr: -1 }, { dc: 0, dr: 0 }, { dc: -1, dr: -1 }, { dc: 1, dr: -1 }],
    south: [{ dc: 0, dr: 1 }, { dc: 0, dr: 0 }, { dc: -1, dr: 1 }, { dc: 1, dr: 1 }],
  };
  const candidates = offsets[dir] ?? [{ dc: 0, dr: 0 }];

  for (const candidate of candidates) {
    const col = portal.col + candidate.dc;
    const row = portal.row + candidate.dr;
    if (col < 0 || row < 0 || col >= width || row >= height) continue;
    const idx = row * width + col;
    if ((pathLayer[idx] | 0) > 0) {
      return tileToWorld(col, row, tileWidth, tileHeight);
    }
  }

  return normalizeRailNode(portal);
}

function distance(a: { wx: number; wy: number }, b: { wx: number; wy: number }): number {
  return Math.hypot(a.wx - b.wx, a.wy - b.wy);
}

function dedupeSequential(nodes: PathNode[]): PathNode[] {
  const result: PathNode[] = [];
  for (const node of nodes) {
    const prev = result[result.length - 1];
    if (!prev || prev.wx !== node.wx || prev.wy !== node.wy) {
      result.push(node);
    }
  }
  return result;
}

function buildAllyPath(
  citadelNode: PathNode | null,
  pathNodes: PathNode[],
  tileWidth: number,
  tileHeight: number,
): PathNode[] {
  const reversed = [...pathNodes].reverse();
  if (!citadelNode) return reversed;
  if (reversed.length === 0) return [citadelNode];

  const minJoinDistance = Math.max(18, tileHeight * 0.85);
  const verticalTolerance = Math.max(10, tileWidth * 0.18);
  let joinIndex = 0;

  while (joinIndex < reversed.length - 1) {
    const candidate = reversed[joinIndex];
    const dx = candidate.wx - citadelNode.wx;
    const dy = candidate.wy - citadelNode.wy;
    const isTinyVerticalHop = Math.abs(dx) <= verticalTolerance && Math.hypot(dx, dy) < minJoinDistance;
    if (!isTinyVerticalHop) break;
    joinIndex += 1;
  }

  return dedupeSequential([citadelNode, ...reversed.slice(joinIndex)]);
}

function findNearestNodeIndex(nodes: PathNode[], target: PathNode): { index: number; distance: number } {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < nodes.length; i += 1) {
    const currentDistance = distance(nodes[i], target);
    if (currentDistance < bestDistance) {
      bestDistance = currentDistance;
      bestIndex = i;
    }
  }
  return { index: bestIndex, distance: bestDistance };
}

function findRailEntryTowardCitadel(
  nodes: PathNode[],
  anchor: PathNode,
  citadel: PathNode,
  maxSnapDistance: number,
): { index: number; distance: number } {
  const toCitadel = normalizeVector(citadel.wx - anchor.wx, citadel.wy - anchor.wy);
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < nodes.length; i += 1) {
    const relX = nodes[i].wx - anchor.wx;
    const relY = nodes[i].wy - anchor.wy;
    const currentDistance = Math.hypot(relX, relY);
    if (currentDistance > maxSnapDistance) continue;

    const towardCitadel = relX * toCitadel.x + relY * toCitadel.y;
    if (towardCitadel <= 0) continue;

    const currentScore = towardCitadel / Math.max(currentDistance, 1);
    if (
      currentScore > bestScore
      || (Math.abs(currentScore - bestScore) < 1e-6 && currentDistance < bestDistance)
    ) {
      bestScore = currentScore;
      bestDistance = currentDistance;
      bestIndex = i;
    }
  }
  return bestIndex >= 0 ? { index: bestIndex, distance: bestDistance } : findNearestNodeIndex(nodes, anchor);
}

function resolveSceneRailPath(mapJson: any): PathNode[] {
  const rail = Array.isArray(mapJson.scene?.cameraRail)
    ? mapJson.scene.cameraRail.map(normalizeRailNode).filter(Boolean) as PathNode[]
    : [];
  if (rail.length < 2) return [];

  const portal = resolvePortalSpawnNode(mapJson);
  const leadNodes = resolvePortalLeadNodes(mapJson);
  const leadEnd = leadNodes[leadNodes.length - 1] ?? portal;
  const citadel = normalizeRailNode(mapJson.scene?.citadel);
  if (!portal || !leadEnd || !citadel) return [];

  const nearestCitadel = findNearestNodeIndex(rail, citadel);
  const maxSnapDistance = Math.max(mapJson.tileWidth ?? 64, mapJson.tileHeight ?? 32) * 3;
  const nearestPortal = findRailEntryTowardCitadel(rail, leadEnd, citadel, maxSnapDistance);

  if (
    nearestPortal.index < 0
    || nearestCitadel.index < 0
    || nearestPortal.index === nearestCitadel.index
    || nearestPortal.distance > maxSnapDistance
    || nearestCitadel.distance > maxSnapDistance
  ) {
    return [];
  }

  const start = Math.min(nearestPortal.index, nearestCitadel.index);
  const end = Math.max(nearestPortal.index, nearestCitadel.index);
  const segment = rail.slice(start, end + 1);
  const orderedSegment = nearestPortal.index <= nearestCitadel.index ? segment : [...segment].reverse();
  const pathTiles = collectPathTileCenters(mapJson);
  const snapDistance = Math.max(mapJson.tileWidth ?? 64, mapJson.tileHeight ?? 32) * 1.1;
  const snappedLead = leadNodes.map((node) => snapNodeToPath(node, pathTiles, snapDistance));
  const snappedRail = orderedSegment.map((node) => snapNodeToPath(node, pathTiles, snapDistance));
  return dedupeSequential([portal, ...snappedLead, ...snappedRail, citadel]);
}

export function createGameState(mapJson: any): GameState {
  const portalSpawn = resolvePortalSpawnNode(mapJson);
  const portalWx = portalSpawn?.wx ?? mapJson.scene?.portals?.[0]?.x ?? 2816;
  const portalWy = portalSpawn?.wy ?? mapJson.scene?.portals?.[0]?.y ?? 1216;
  const maskPath = resolvePathFromMask(mapJson, portalSpawn);
  const sceneRailPath = resolveSceneRailPath(mapJson);
  const enemyLaneOffsets = resolveEnemyLaneOffsets(mapJson, portalSpawn);
  const citadelNode = normalizeRailNode(mapJson.scene?.citadel);
  const tileWidth = mapJson.tileWidth ?? 64;
  const tileHeight = mapJson.tileHeight ?? 32;
  const pathNodes = maskPath.length >= 2
    ? maskPath
    : sceneRailPath.length >= 2
    ? sceneRailPath
    : extractOrderedPath(
        mapJson.layers?.paths ?? [],
        mapJson.width ?? 70,
        tileWidth,
        tileHeight,
        portalWx,
        portalWy,
      );
  const allyPathNodes = buildAllyPath(citadelNode, pathNodes, tileWidth, tileHeight);
  return {
    phase: 'playing',
    waveNumber: 0,
    waveTimer: 15,
    spawnQueue: [],
    spawnTimer: 0,
    units: [],
    buildings: [],
    projectiles: [],
    impactMarks: [],
    corpses: [],
    citadelHp: 2000,
    citadelMaxHp: 2000,
    playerBaseHp: 300,
    playerBaseMaxHp: 300,
    resources: 100,
    crystals: 0,
    elapsed: 0,
    nextId: 1,
    pathNodes,
    allyPathNodes,
    enemyLaneOffsets,
  };
}
