import type { GameState, Unit, PathNode, UnitDef } from './game.types';
import { UNIT_DEFS } from './game.types';

export class UnitSystem {
  /** Reversed path for ally units — computed lazily on first update call */
  private reversedPath: PathNode[] | null = null;

  /**
   * Advance all units along their path by dt seconds.
   * - Moving units: lerp between PathNodes using speed (world units/s)
   * - fighting / attacking-base units: not moved
   * - Dead units (hp <= 0): filtered from state.units at end
   * - spawnQueue: decrement delays; spawn units when delay <= 0
   */
  update(dt: number, state: GameState): void {
    // Ensure reversed path is cached
    if (this.reversedPath === null || this.reversedPath.length !== state.pathNodes.length) {
      this.reversedPath = [...state.pathNodes].reverse();
    }

    for (const unit of state.units) {
      if (unit.state !== 'moving') continue;

      const path = unit.faction === 'enemy' ? state.pathNodes : this.reversedPath!;
      this.advanceUnit(unit, path, dt);
    }

    // Process spawn queue
    const spawned: number[] = [];
    for (let i = 0; i < state.spawnQueue.length; i++) {
      state.spawnQueue[i].delay -= dt;
      if (state.spawnQueue[i].delay <= 0) {
        const entry = state.spawnQueue[i];
        const def: UnitDef | undefined = UNIT_DEFS[entry.defKey];
        if (def) {
          const path = def.faction === 'enemy' ? state.pathNodes : this.reversedPath!;
          const startNode = path[0];
          const unit: Unit = {
            id: state.nextId++,
            def,
            faction: def.faction,
            hp: def.hp,
            pathIndex: 0,
            pathT: 0,
            wx: startNode?.wx ?? 0,
            wy: startNode?.wy ?? 0,
            state: 'moving',
            fightingWith: null,
            attackCooldown: 0,
          };
          state.units.push(unit);
        }
        spawned.push(i);
      }
    }
    // Remove spawned entries (in reverse so indices stay valid)
    for (let i = spawned.length - 1; i >= 0; i--) {
      state.spawnQueue.splice(spawned[i], 1);
    }

    // Filter dead units
    state.units = state.units.filter(u => u.hp > 0);
  }

  private advanceUnit(unit: Unit, path: PathNode[], dt: number): void {
    if (path.length < 2) {
      unit.state = 'attacking-base';
      return;
    }

    let segIndex = unit.pathIndex;
    let t = unit.pathT;

    // Compute how much t to advance this tick.
    // segmentLength is the Euclidean distance between path[segIndex] and path[segIndex+1].
    // dt_remaining tracks any leftover time from crossing segment boundaries.
    let dtRemaining = dt;

    while (segIndex < path.length - 1 && dtRemaining > 0) {
      const a = path[segIndex];
      const b = path[segIndex + 1];
      const dx = b.wx - a.wx;
      const dy = b.wy - a.wy;
      const segLen = Math.sqrt(dx * dx + dy * dy);

      if (segLen === 0) {
        // Zero-length segment — skip it
        segIndex++;
        t = 0;
        continue;
      }

      // How many world units to advance: speed * dtRemaining
      const distanceToCover = unit.def.speed * dtRemaining;
      // How much t that represents
      const tAdvance = distanceToCover / segLen;

      if (t + tAdvance < 1) {
        t += tAdvance;
        dtRemaining = 0;
      } else {
        // We'll consume only the portion of dt needed to reach end of segment
        const tLeft = 1 - t;
        const dtUsed = (tLeft * segLen) / unit.def.speed;
        dtRemaining -= dtUsed;
        segIndex++;
        t = 0;
      }
    }

    // Check if we've walked off the end of the path
    if (segIndex >= path.length - 1) {
      unit.state = 'attacking-base';
      // Place unit at the final node
      const last = path[path.length - 1];
      unit.wx = last.wx;
      unit.wy = last.wy;
      unit.pathIndex = path.length - 1;
      unit.pathT = 0;
      return;
    }

    // Update unit position via lerp
    unit.pathIndex = segIndex;
    unit.pathT = t;
    const a = path[segIndex];
    const b = path[segIndex + 1];
    unit.wx = a.wx + t * (b.wx - a.wx);
    unit.wy = a.wy + t * (b.wy - a.wy);
  }
}
