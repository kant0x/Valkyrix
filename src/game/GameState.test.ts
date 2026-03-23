import { describe, expect, it } from 'vitest';
import { createGameState } from './GameState';

describe('createGameState', () => {
  it('prefers the authored rail segment between the portal and citadel', () => {
    const state = createGameState({
      width: 8,
      height: 8,
      tileWidth: 64,
      tileHeight: 32,
      layers: {
        paths: Array(64).fill(0),
      },
      scene: {
        portals: [{ x: 2680, y: 1293 }],
        citadel: { x: 1122, y: 436 },
        cameraRail: [
          { x: 3072, y: 1280 },
          { x: 3040, y: 1296 },
          { x: 2720, y: 1232 },
          { x: 2400, y: 1072 },
          { x: 1120, y: 432 },
          { x: 864, y: 176 },
        ],
      },
    });

    expect(state.pathNodes).toEqual([
      { wx: 2680, wy: 1293 },
      { wx: 2720, wy: 1232 },
      { wx: 2400, wy: 1072 },
      { wx: 1120, wy: 432 },
      { wx: 1122, wy: 436 },
    ]);
  });

  it('uses the tile in front of an east-facing portal as the enemy spawn node', () => {
    const pathLayer = Array(80 * 30).fill(0);
    pathLayer[12 * 80 + 64] = 1;
    pathLayer[12 * 80 + 63] = 1;
    pathLayer[12 * 80 + 65] = 1;
    pathLayer[11 * 80 + 64] = 1;
    pathLayer[13 * 80 + 64] = 1;

    const state = createGameState({
      width: 80,
      height: 30,
      tileWidth: 64,
      tileHeight: 32,
      layers: {
        paths: pathLayer,
      },
      scene: {
        portals: [{ x: 2863, y: 1274, direction: 'east', col: 63, row: 12 }],
        citadel: { x: 1122, y: 436 },
        cameraRail: [
          { x: 2848, y: 1296 },
          { x: 2816, y: 1280 },
          { x: 2720, y: 1232 },
          { x: 2400, y: 1072 },
          { x: 1120, y: 432 },
        ],
      },
    });

    expect(state.pathNodes).toEqual([
      { wx: 2848, wy: 1232 },
      { wx: 2720, wy: 1232 },
      { wx: 2400, wy: 1072 },
      { wx: 1120, wy: 432 },
      { wx: 1122, wy: 436 },
    ]);
  });

  it('reverses the authored rail slice when portal comes later than the citadel', () => {
    const state = createGameState({
      width: 8,
      height: 8,
      tileWidth: 64,
      tileHeight: 32,
      layers: {
        paths: Array(64).fill(0),
      },
      scene: {
        portals: [{ x: 300, y: 300 }],
        citadel: { x: 100, y: 100 },
        cameraRail: [
          { x: 100, y: 100 },
          { x: 180, y: 180 },
          { x: 240, y: 240 },
          { x: 300, y: 300 },
        ],
      },
    });

    expect(state.pathNodes).toEqual([
      { wx: 300, wy: 300 },
      { wx: 240, wy: 240 },
      { wx: 180, wy: 180 },
      { wx: 100, wy: 100 },
    ]);
  });

  it('builds an ally path that starts from the citadel and skips the tiny vertical drop below it', () => {
    const state = createGameState({
      width: 8,
      height: 8,
      tileWidth: 64,
      tileHeight: 32,
      layers: {
        paths: Array(64).fill(0),
      },
      scene: {
        portals: [{ x: 2680, y: 1293 }],
        citadel: { x: 1122, y: 436 },
        cameraRail: [
          { x: 3072, y: 1280 },
          { x: 3040, y: 1296 },
          { x: 2720, y: 1232 },
          { x: 2400, y: 1072 },
          { x: 1184, y: 464 },
          { x: 1152, y: 448 },
          { x: 1120, y: 432 },
          { x: 864, y: 176 },
        ],
      },
    });

    expect(state.allyPathNodes?.[0]).toEqual({ wx: 1122, wy: 436 });
    expect(state.allyPathNodes?.[1]).toEqual({ wx: 1152, wy: 448 });
    expect(state.allyPathNodes).not.toContainEqual({ wx: 1120, wy: 432 });
  });

  it('falls back to extracting the path from the tile mask when authored rail data is unavailable', () => {
    const pathLayer = [
      1, 1, 0,
      0, 1, 0,
      0, 0, 1,
    ];

    const state = createGameState({
      width: 3,
      height: 3,
      tileWidth: 64,
      tileHeight: 32,
      layers: { paths: pathLayer },
      scene: {
        portals: [{ x: 1184, y: 16 }],
        citadel: { x: 1120, y: 80 },
      },
    });

    expect(state.pathNodes.length).toBeGreaterThanOrEqual(3);
    expect(state.pathNodes[0]).toEqual({ wx: 1184, wy: 16 });
    expect(state.pathNodes[state.pathNodes.length - 1]).toEqual({ wx: 1184, wy: 80 });
  });

  it('initializes crystals at zero for collector salvage flow', () => {
    const state = createGameState({
      width: 3,
      height: 3,
      tileWidth: 64,
      tileHeight: 32,
      layers: { paths: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      scene: {
        portals: [{ x: 1184, y: 16 }],
        citadel: { x: 1184, y: 80 },
      },
    });

    expect(state.crystals).toBe(0);
  });

  it('initializes phase as playing and bossNegotiation as undefined by default', () => {
    const state = createGameState({
      width: 3,
      height: 3,
      tileWidth: 64,
      tileHeight: 32,
      layers: { paths: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      scene: {
        portals: [{ x: 1184, y: 16 }],
        citadel: { x: 1184, y: 80 },
      },
    });

    expect(state.phase).toBe('playing');
    expect(state.bossNegotiation).toBeUndefined();
  });

  it('accepts negotiation as a valid phase value', () => {
    const state = createGameState({
      width: 3,
      height: 3,
      tileWidth: 64,
      tileHeight: 32,
      layers: { paths: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      scene: {
        portals: [{ x: 1184, y: 16 }],
        citadel: { x: 1184, y: 80 },
      },
    });

    // This is a TypeScript type-level check: assigning 'negotiation' to phase must compile.
    // At runtime we just verify it can be set without throwing.
    state.phase = 'negotiation';
    expect(state.phase).toBe('negotiation');
  });
});
