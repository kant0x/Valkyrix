import { extractOrderedPath } from './PathExtractor';
import type { GameState } from './game.types';

export function createGameState(mapJson: any): GameState {
  const portalWx = mapJson.scene?.portals?.[0]?.x ?? 2816;
  const portalWy = mapJson.scene?.portals?.[0]?.y ?? 1216;
  const pathNodes = extractOrderedPath(
    mapJson.layers?.paths ?? [],
    mapJson.width ?? 70,
    mapJson.tileWidth ?? 64,
    mapJson.tileHeight ?? 32,
    portalWx,
    portalWy,
  );
  return {
    phase: 'playing',
    waveNumber: 0,
    waveTimer: 15,
    spawnQueue: [],
    spawnTimer: 0,
    units: [],
    buildings: [],
    projectiles: [],
    citadelHp: 500,
    citadelMaxHp: 500,
    playerBaseHp: 300,
    playerBaseMaxHp: 300,
    resources: 100,
    nextId: 1,
    pathNodes,
  };
}
