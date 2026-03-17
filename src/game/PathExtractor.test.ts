import { describe, it, expect } from 'vitest';
import { extractOrderedPath } from './PathExtractor';

// tileToWorld formula (from src/main.ts):
//   wx = (col - row) * (tileWidth / 2) + tileWidth / 2 + 1152
//   wy = (col + row) * (tileHeight / 2) + tileHeight / 2
// Active map: tileWidth=64, tileHeight=32, ISO_LAYER_X=1152

const TW = 64;
const TH = 32;
const ISO = 1152;

function tileToWorld(col: number, row: number): { wx: number; wy: number } {
  return {
    wx: (col - row) * (TW / 2) + TW / 2 + ISO,
    wy: (col + row) * (TH / 2) + TH / 2,
  };
}

// Portal world coords matching active map
const PORTAL_WX = 2816;
const PORTAL_WY = 1216;

describe('extractOrderedPath', () => {
  it('returns empty array for empty pathLayer', () => {
    const result = extractOrderedPath([], 70, TW, TH, PORTAL_WX, PORTAL_WY);
    expect(result).toEqual([]);
  });

  it('returns single PathNode for single non-zero tile', () => {
    // Place a tile at col=10, row=5
    const mapWidth = 70;
    const layer = new Array(70 * 30).fill(0);
    layer[5 * mapWidth + 10] = 1; // row=5, col=10
    const expected = tileToWorld(10, 5);
    const result = extractOrderedPath(layer, mapWidth, TW, TH, PORTAL_WX, PORTAL_WY);
    expect(result).toHaveLength(1);
    expect(result[0].wx).toBeCloseTo(expected.wx);
    expect(result[0].wy).toBeCloseTo(expected.wy);
  });

  it('result length equals count of non-zero tiles in input', () => {
    const mapWidth = 70;
    const layer = new Array(70 * 30).fill(0);
    // Set 3 non-zero tiles
    layer[0 * mapWidth + 5] = 1;
    layer[1 * mapWidth + 6] = 1;
    layer[2 * mapWidth + 5] = 1;
    const result = extractOrderedPath(layer, mapWidth, TW, TH, PORTAL_WX, PORTAL_WY);
    expect(result).toHaveLength(3);
  });

  it('first node is nearest to portal (portalWx, portalWy)', () => {
    // Create two tiles: one far from portal, one close to portal
    // Close tile: col=60, row=12 — near portal at (2816, 1216)
    // Far tile: col=10, row=10 — much further from portal
    const mapWidth = 70;
    const layer = new Array(70 * 30).fill(0);
    const closeCol = 60;
    const closeRow = 12;
    const farCol = 10;
    const farRow = 10;
    layer[closeRow * mapWidth + closeCol] = 1;
    layer[farRow * mapWidth + farCol] = 1;
    const result = extractOrderedPath(layer, mapWidth, TW, TH, PORTAL_WX, PORTAL_WY);
    const closeWorld = tileToWorld(closeCol, closeRow);
    // First result node should be the close tile
    expect(result[0].wx).toBeCloseTo(closeWorld.wx);
    expect(result[0].wy).toBeCloseTo(closeWorld.wy);
  });

  it('three-tile L-shape: node nearest portal comes first, node farthest comes last', () => {
    // Three tiles in an L-shape:
    //   A = col=60, row=12  (near portal)
    //   B = col=55, row=12  (middle)
    //   C = col=10, row=10  (far from portal)
    const mapWidth = 70;
    const layer = new Array(70 * 30).fill(0);
    const tileA = { col: 60, row: 12 };
    const tileB = { col: 55, row: 12 };
    const tileC = { col: 10, row: 10 };
    layer[tileA.row * mapWidth + tileA.col] = 1;
    layer[tileB.row * mapWidth + tileB.col] = 1;
    layer[tileC.row * mapWidth + tileC.col] = 1;

    const result = extractOrderedPath(layer, mapWidth, TW, TH, PORTAL_WX, PORTAL_WY);
    expect(result).toHaveLength(3);

    // First node should be nearest to portal
    const worldA = tileToWorld(tileA.col, tileA.row);
    const worldC = tileToWorld(tileC.col, tileC.row);
    expect(result[0].wx).toBeCloseTo(worldA.wx);
    expect(result[0].wy).toBeCloseTo(worldA.wy);

    // Last node should be farthest (tileC)
    expect(result[2].wx).toBeCloseTo(worldC.wx);
    expect(result[2].wy).toBeCloseTo(worldC.wy);
  });
});
