import type { PathNode } from './game.types';

// Must match ISO_LAYER_X constant in src/main.ts
const ISO_LAYER_X = 1152;

/**
 * Converts the flat paths layer from the map JSON into an ordered sequence
 * of world-coordinate PathNodes, sorted from the portal (spawn) outward using
 * a greedy nearest-neighbor algorithm.
 *
 * Call once at map load time; store result in GameState.pathNodes.
 * Enemy units traverse index 0 (portal) → last (citadel).
 * Ally units traverse in reverse direction.
 *
 * @param pathLayer - Flat tile array from map.layers.paths (length = width * height)
 * @param mapWidth  - Number of tile columns in the map
 * @param tileWidth - Tile width in pixels (active map: 64)
 * @param tileHeight - Tile height in pixels (active map: 32)
 * @param portalWx  - World X of the enemy spawn portal (from scene.portals[0].x)
 * @param portalWy  - World Y of the enemy spawn portal (from scene.portals[0].y)
 */
export function extractOrderedPath(
  pathLayer: number[],
  mapWidth: number,
  tileWidth: number,
  tileHeight: number,
  portalWx: number,
  portalWy: number,
): PathNode[] {
  // 1. Collect all non-zero path tiles and convert to world coords using tileToWorld formula
  const nodes: PathNode[] = [];
  for (let i = 0; i < pathLayer.length; i++) {
    if (!pathLayer[i]) continue;
    const col = i % mapWidth;
    const row = Math.floor(i / mapWidth);
    nodes.push({
      wx: (col - row) * (tileWidth / 2) + tileWidth / 2 + ISO_LAYER_X,
      wy: (col + row) * (tileHeight / 2) + tileHeight / 2,
    });
  }

  if (nodes.length === 0) return [];

  // 2. Greedy nearest-neighbor sort starting from portal world position
  // Seed point is the portal — first node picked will be nearest to portal
  const sorted: PathNode[] = [];
  const remaining = [...nodes];
  let current: { wx: number; wy: number } = { wx: portalWx, wy: portalWy };

  while (remaining.length > 0) {
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dx = remaining[i].wx - current.wx;
      const dy = remaining[i].wy - current.wy;
      const d = dx * dx + dy * dy; // squared distance — no sqrt needed for comparison
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }
    current = remaining[nearest];
    sorted.push(current);
    remaining.splice(nearest, 1);
  }

  return sorted;
}
