import type { GameState, Unit, PathNode, UnitDef, DropPod } from './game.types';
import { UNIT_DEFS } from './game.types';
import { COLLECTOR_GUARD_DURATION, COLLECTOR_GUARD_TRIGGER_RADIUS } from './UnitDefense';

const BASE_ATTACK_STANDOFF = 14;
const COLLECTOR_ACTIVE_ORBIT_SPEED = 0.7;
const COLLECTOR_ACTIVE_RADIUS_X = 42;
const COLLECTOR_ACTIVE_RADIUS_Y = 20;
const COLLECTOR_IDLE_LIFT_Y = -18;
const LATFA_PICKUP_RADIUS = 20;
const DROP_POD_OPEN_TIME = 2.15;
const DROP_POD_RELEASE_INTERVAL = 0.28;
const DROP_POD_TOTAL_DURATION = 4.9;
const CYBERNETIC_DROP_SHIELD = 1.5;

function buildSpawnDef(baseDef: UnitDef, powerScale?: number): UnitDef {
  const scale = Math.max(0.6, powerScale ?? 1);
  if (Math.abs(scale - 1) < 0.0001) {
    return { ...baseDef };
  }

  const speedScale = 1 + (scale - 1) * 0.2;
  const attackRateScale = 1 + (scale - 1) * 0.12;
  return {
    ...baseDef,
    hp: Math.max(1, Math.round(baseDef.hp * scale)),
    damage: Math.max(0, Math.round(baseDef.damage * scale)),
    speed: Math.max(1, Number((baseDef.speed * speedScale).toFixed(2))),
    attackRate: baseDef.attackRate > 0 ? Number((baseDef.attackRate * attackRateScale).toFixed(3)) : 0,
  };
}

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

    this.updateDropPods(state, dt);

    for (const unit of state.units) {
      if (unit.state !== 'fighting' || (unit.fightingWith ?? 0) <= 0) continue;
      if (unit.def.attackRange) continue;
      const opponent = state.units.find(u => u.id === unit.fightingWith && u.hp > 0);
      if (!opponent) continue;
      const path = unit.faction === 'enemy' ? state.pathNodes : this.reversedPath!;
      const dx = opponent.wx - unit.wx;
      const dy = opponent.wy - unit.wy;
      const dist = Math.hypot(dx, dy);
      if (dist > MELEE_CONTACT_DISTANCE) {
        const step = Math.min(unit.def.speed * dt, dist - MELEE_CONTACT_DISTANCE);
        unit.lastWx = unit.wx;
        unit.lastWy = unit.wy;
        unit.wx += (dx / dist) * step;
        unit.wy += (dy / dist) * step;
        this.resyncUnitPathPosition(unit, path);
      }
    }

    for (const unit of state.units) {
      if (unit.state !== 'moving') continue;
      if (unit.def.role === 'collector' && unit.faction === 'ally') {
        this.updateCollectorOrbit(unit, state, dt);
        continue;
      }

      const path = unit.faction === 'enemy' ? state.pathNodes : this.reversedPath!;
      this.resyncUnitPathPositionIfDisplaced(unit, path);
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
          const spawnDef = buildSpawnDef(def, entry.powerScale);
          const path = spawnDef.faction === 'enemy' ? state.pathNodes : this.reversedPath!;
          const startNode = path[0];
          const unit: Unit = {
            id: state.nextId++,
            def: spawnDef,
            faction: spawnDef.faction,
            hp: spawnDef.hp,
            pathIndex: 0,
            pathT: 0,
            wx: startNode?.wx ?? 0,
            wy: startNode?.wy ?? 0,
            state: 'moving',
            fightingWith: null,
            attackCooldown: 0,
          };
          if (spawnDef.role === 'collector' && spawnDef.faction === 'ally') {
            this.updateCollectorOrbit(unit, state, 0);
          }
          state.units.push(unit);
        }
        spawned.push(i);
      }
    }
    // Remove spawned entries (in reverse so indices stay valid)
    for (let i = spawned.length - 1; i >= 0; i--) {
      state.spawnQueue.splice(spawned[i], 1);
    }

    // Move dead lasers units to corpses before filtering
    const now = Date.now();
    for (const u of state.units) {
      if (u.hp <= 0 && u.def.sprite === 'lasers') {
        state.corpses ??= [];
        if (!state.corpses.some(c => c.id === u.id)) {
          state.corpses.push({ id: u.id, wx: u.wx, wy: u.wy, spriteKey: 'lasers', diedAtMs: now });
        }
      }
    }

    // Filter dead units
    state.units = state.units.filter(u => u.hp > 0);
  }

  private advanceUnit(unit: Unit, path: PathNode[], dt: number): void {
    unit.lastWx = unit.wx;
    unit.lastWy = unit.wy;
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

      const speedMultiplier = Math.max(0.25, unit.speedBuff ?? 1);
      // How many world units to advance: speed * dtRemaining, including tower buffs.
      const distanceToCover = unit.def.speed * speedMultiplier * dtRemaining;
      // How much t that represents
      const tAdvance = distanceToCover / segLen;

      if (t + tAdvance < 1) {
        t += tAdvance;
        dtRemaining = 0;
      } else {
        // We'll consume only the portion of dt needed to reach end of segment
        const tLeft = 1 - t;
        const dtUsed = (tLeft * segLen) / (unit.def.speed * speedMultiplier);
        dtRemaining -= dtUsed;
        segIndex++;
        t = 0;
      }
    }

    // Check if we've walked off the end of the path
    if (segIndex >= path.length - 1) {
      unit.state = 'attacking-base';
      const last = path[path.length - 1];
      const prev = path[path.length - 2] ?? last;
      const dx = last.wx - prev.wx;
      const dy = last.wy - prev.wy;
      const len = Math.hypot(dx, dy);
      const standOff = len > 0.001 ? Math.min(BASE_ATTACK_STANDOFF, len * 0.45) : 0;
      const dirX = len > 0.001 ? dx / len : 0;
      const dirY = len > 0.001 ? dy / len : 0;
      unit.wx = last.wx - dirX * standOff;
      unit.wy = last.wy - dirY * standOff;
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

  private updateCollectorOrbit(unit: Unit, state: GameState, dt: number): void {
    const anchor = state.allyPathNodes?.[0] ?? state.pathNodes[state.pathNodes.length - 1] ?? { wx: 0, wy: 0 };
    const nearestDrop = this.findAssignedLatfaDrop(unit, state);
    const active = (state.crystals ?? 0) > 0;
    const speedMultiplier = Math.max(0.25, unit.speedBuff ?? 1);

    unit.lastWx = unit.wx;
    unit.lastWy = unit.wy;
    unit.pathIndex = 0;
    unit.pathT = 0;

    if (nearestDrop) {
      const dx = nearestDrop.wx - unit.wx;
      const dy = nearestDrop.wy - unit.wy;
      const distance = Math.hypot(dx, dy);
      const maxStep = unit.def.speed * speedMultiplier * dt * 0.72;
      if (distance <= LATFA_PICKUP_RADIUS) {
        state.latfaDrops = (state.latfaDrops ?? []).filter((drop) => drop.id !== nearestDrop.id);
        if (nearestDrop.kind === 'schematic') {
          state.schematics = (state.schematics ?? 0) + nearestDrop.value;
        } else {
          state.latfa = (state.latfa ?? 0) + nearestDrop.value;
        }
        this.updateCollectorReactiveShield(unit, state);
        return;
      }
      if (distance <= Math.max(maxStep, 0.001)) {
        unit.wx = nearestDrop.wx;
        unit.wy = nearestDrop.wy + COLLECTOR_IDLE_LIFT_Y * 0.3;
      } else {
        unit.wx += (dx / distance) * maxStep;
        unit.wy += (dy / distance) * maxStep;
      }
      this.updateCollectorReactiveShield(unit, state);
      return;
    }

    if (!active) {
      // Idle: fixed left/right positions flanking the citadel.
      const collectors = state.units.filter(
        u => u.def.role === 'collector' && u.faction === 'ally' && u.hp > 0,
      );
      const slotIndex = collectors.findIndex(u => u.id === unit.id);
      const slotSign = slotIndex <= 0 ? -1 : 1;
      const idleX = anchor.wx + slotSign * 50;
      const idleY = anchor.wy + COLLECTOR_IDLE_LIFT_Y;
      const dx = idleX - unit.wx;
      const dy = idleY - unit.wy;
      const distance = Math.hypot(dx, dy);
      const maxStep = unit.def.speed * speedMultiplier * dt * 0.4;
      if (distance <= Math.max(maxStep, 0.001)) {
        unit.wx = idleX;
        unit.wy = idleY;
      } else {
        unit.wx += (dx / distance) * maxStep;
        unit.wy += (dy / distance) * maxStep;
      }
      this.updateCollectorReactiveShield(unit, state);
      return;
    }

    // Active: orbit while harvesting crystals.
    unit.idlePhase = (unit.idlePhase ?? unit.id * 0.93) + dt * COLLECTOR_ACTIVE_ORBIT_SPEED;

    const target = {
      wx: anchor.wx + 18 + Math.cos(unit.idlePhase) * COLLECTOR_ACTIVE_RADIUS_X,
      wy: anchor.wy + COLLECTOR_IDLE_LIFT_Y + Math.sin(unit.idlePhase * 0.9) * COLLECTOR_ACTIVE_RADIUS_Y,
    };
    const dx = target.wx - unit.wx;
    const dy = target.wy - unit.wy;
    const distance = Math.hypot(dx, dy);
    const returnScale = distance > 120 ? 0.62 : distance > 60 ? 0.4 : 0.24;
    const maxStep = unit.def.speed * speedMultiplier * dt * returnScale;

    if (distance <= Math.max(maxStep, 0.001)) {
      unit.wx = target.wx;
      unit.wy = target.wy;
      this.updateCollectorReactiveShield(unit, state);
      return;
    }

    unit.wx += (dx / distance) * maxStep;
    unit.wy += (dy / distance) * maxStep;
    this.updateCollectorReactiveShield(unit, state);
  }

  private findAssignedLatfaDrop(unit: Unit, state: GameState) {
    const drops = state.latfaDrops ?? [];
    if (drops.length === 0) return null;

    const collectors = state.units
      .filter((candidate) => candidate.def.role === 'collector' && candidate.faction === 'ally' && candidate.hp > 0)
      .slice()
      .sort((a, b) => a.id - b.id);
    const remainingDrops = [...drops];

    for (const collector of collectors) {
      let bestDrop = remainingDrops[0] ?? null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const drop of remainingDrops) {
        const distance = Math.hypot(drop.wx - collector.wx, drop.wy - collector.wy);
        if (distance < bestDistance) {
          bestDrop = drop;
          bestDistance = distance;
        }
      }

      if (!bestDrop) continue;
      if (collector.id === unit.id) return bestDrop;
      const reservedIndex = remainingDrops.findIndex((drop) => drop.id === bestDrop.id);
      if (reservedIndex >= 0) {
        remainingDrops.splice(reservedIndex, 1);
      }
    }

    return null;
  }

  private updateDropPods(state: GameState, dt: number): void {
    const pods = state.dropPods ?? [];
    if (pods.length === 0) return;

    for (const pod of pods) {
      pod.elapsed += dt;
      const releasedCount = pod.releasedCount ?? 0;
      if (pod.spawnCount > 0 && pod.elapsed >= DROP_POD_OPEN_TIME) {
        const shouldHaveReleased = Math.min(
          pod.spawnCount,
          Math.floor((pod.elapsed - DROP_POD_OPEN_TIME) / DROP_POD_RELEASE_INTERVAL) + 1,
        );
        for (let i = releasedCount; i < shouldHaveReleased; i += 1) {
          this.deployCyberneticFromPod(state, pod, i);
        }
        pod.releasedCount = Math.max(releasedCount, shouldHaveReleased);
      }
    }

    state.dropPods = pods.filter((pod) => pod.elapsed < DROP_POD_TOTAL_DURATION);
  }

  private deployCyberneticFromPod(state: GameState, pod: DropPod, releaseIndex: number): void {
    const baseDef = UNIT_DEFS['cybernetic'];
    const path = this.reversedPath ?? [];
    const offsets = [-20, 0, 20];
    const spawnWx = pod.wx + offsets[releaseIndex % offsets.length];
    const spawnWy = pod.wy + COLLECTOR_IDLE_LIFT_Y * 0.2;
    const pathPosition = this.findClosestPathPosition(path, spawnWx, spawnWy);
    state.units.push({
      id: state.nextId++,
      def: { ...baseDef },
      faction: baseDef.faction,
      hp: baseDef.hp,
      pathIndex: pathPosition.pathIndex,
      pathT: pathPosition.pathT,
      wx: spawnWx,
      wy: spawnWy,
      state: 'moving',
      fightingWith: null,
      attackCooldown: 0,
      lastWx: spawnWx,
      lastWy: spawnWy,
      spawnShield: CYBERNETIC_DROP_SHIELD,
    });
  }

  private findClosestPathPosition(path: PathNode[], wx: number, wy: number): { pathIndex: number; pathT: number } {
    if (path.length < 2) return { pathIndex: 0, pathT: 0 };

    let bestIndex = 0;
    let bestT = 0;
    let bestDistanceSq = Number.POSITIVE_INFINITY;

    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const b = path[i + 1];
      const dx = b.wx - a.wx;
      const dy = b.wy - a.wy;
      const segmentLenSq = dx * dx + dy * dy;
      if (segmentLenSq <= 0.0001) continue;

      const rawT = ((wx - a.wx) * dx + (wy - a.wy) * dy) / segmentLenSq;
      const t = Math.max(0, Math.min(1, rawT));
      const px = a.wx + dx * t;
      const py = a.wy + dy * t;
      const distanceSq = (wx - px) * (wx - px) + (wy - py) * (wy - py);

      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestIndex = i;
        bestT = t;
      }
    }

    return { pathIndex: bestIndex, pathT: bestT };
  }

  private resyncUnitPathPositionIfDisplaced(unit: Unit, path: PathNode[]): void {
    const a = path[unit.pathIndex];
    const b = path[Math.min(unit.pathIndex + 1, path.length - 1)];
    if (!a || !b) return;

    const segDx = b.wx - a.wx;
    const segDy = b.wy - a.wy;
    const segLen = Math.hypot(segDx, segDy) || 1;
    const laneOffset = unit.laneOffset ?? 0;
    const expectedWx = a.wx + segDx * unit.pathT + (-segDy / segLen) * laneOffset;
    const expectedWy = a.wy + segDy * unit.pathT + (segDx / segLen) * laneOffset;
    if (Math.hypot(unit.wx - expectedWx, unit.wy - expectedWy) <= 38) return;

    this.resyncUnitPathPosition(unit, path);
  }

  private resyncUnitPathPosition(unit: Unit, path: PathNode[]): void {
    const closest = this.findClosestPathPosition(path, unit.wx, unit.wy);
    unit.pathIndex = closest.pathIndex;
    unit.pathT = closest.pathT;
  }

  private updateCollectorReactiveShield(unit: Unit, state: GameState): void {
    if (unit.def.role !== 'collector' || unit.faction !== 'ally') return;
    if ((unit.collectorShield ?? 0) > 0) return;
    const enemyNearby = state.units.some((candidate) =>
      candidate.faction === 'enemy'
      && candidate.hp > 0
      && Math.hypot(candidate.wx - unit.wx, candidate.wy - unit.wy) <= COLLECTOR_GUARD_TRIGGER_RADIUS,
    );
    if (!enemyNearby) return;
    unit.collectorShield = COLLECTOR_GUARD_DURATION;
  }
}
