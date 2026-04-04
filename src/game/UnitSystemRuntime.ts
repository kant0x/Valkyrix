import type { GameState, Unit, PathNode, UnitDef, DropPod } from './game.types';
import { UNIT_DEFS } from './game.types';
import { COLLECTOR_GUARD_DURATION, COLLECTOR_GUARD_TRIGGER_RADIUS } from './UnitDefense';

const MELEE_CONTACT_DISTANCE = 16;
const BASE_ATTACK_STANDOFF = 14;
const BASE_ATTACK_LANE_FACTOR = 0.03;
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
  private reversedPath: PathNode[] | null = null;

  private resolveAllyPath(state: GameState): PathNode[] {
    return state.allyPathNodes && state.allyPathNodes.length >= 2
      ? state.allyPathNodes
      : this.reversedPath!;
  }

  update(dt: number, state: GameState): void {
    if (this.reversedPath === null || this.reversedPath.length !== state.pathNodes.length) {
      this.reversedPath = [...state.pathNodes].reverse();
    }

    this.updateDropPods(state, dt);

    // Fighting melee units walk toward their opponent until contact distance
    for (const unit of state.units) {
      if (unit.state !== 'fighting' || (unit.fightingWith ?? 0) <= 0) continue;
      if (unit.def.attackRange) continue; // ranged — don't move
      const opponent = state.units.find(u => u.id === unit.fightingWith && u.hp > 0);
      if (!opponent) continue;
      const path = unit.faction === 'enemy' ? state.pathNodes : this.resolveAllyPath(state);
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
      // Boss holds position during negotiation phase
      if (state.phase === 'negotiation' && unit.def.role === 'boss' && unit.faction === 'enemy') {
        continue;
      }
      const path = unit.faction === 'enemy' ? state.pathNodes : this.resolveAllyPath(state);

      this.resyncUnitPathPositionIfDisplaced(unit, path);

      this.advanceUnit(unit, path, dt);
    }

    const spawned: number[] = [];
    for (let i = 0; i < state.spawnQueue.length; i += 1) {
      state.spawnQueue[i].delay -= dt;
      if (state.spawnQueue[i].delay <= 0) {
        const entry = state.spawnQueue[i];
        const def: UnitDef | undefined = UNIT_DEFS[entry.defKey];
        if (def) {
          const spawnDef = buildSpawnDef(def, entry.powerScale);
          const path = spawnDef.faction === 'enemy' ? state.pathNodes : this.resolveAllyPath(state);
          const startNode = path[0];
          const unitId = state.nextId++;
          const laneOffset = spawnDef.faction === 'enemy'
            ? this.pickEnemyLaneOffset(state, unitId)
            : (spawnDef.role === 'light' || spawnDef.role === 'heavy')
              ? this.pickAllyLaneOffset(unitId)
              : 0;
          const baseWx = startNode?.wx ?? 0;
          const baseWy = startNode?.wy ?? 0;
          const unit: Unit = {
            id: unitId,
            def: spawnDef,
            faction: spawnDef.faction,
            hp: spawnDef.hp,
            pathIndex: 0,
            pathT: 0,
            wx: baseWx,
            wy: baseWy,
            state: 'moving',
            fightingWith: null,
            attackCooldown: 0,
            laneOffset,
          };
          if (spawnDef.role === 'collector' && spawnDef.faction === 'ally') {
            this.updateCollectorOrbit(unit, state, 0);
          } else if (spawnDef.faction === 'enemy') {
            this.applyLanePosition(unit, path, 0);
          }
          state.units.push(unit);
        }
        spawned.push(i);
      }
    }

    for (let i = spawned.length - 1; i >= 0; i -= 1) {
      state.spawnQueue.splice(spawned[i], 1);
    }

    // Move dead lasers units to corpses before filtering
    const nowMs = Date.now();
    for (const u of state.units) {
      if (u.hp <= 0 && u.def.sprite === 'lasers') {
        state.corpses ??= [];
        if (!state.corpses.some((c) => c.id === u.id)) {
          state.corpses.push({ id: u.id, wx: u.wx, wy: u.wy, spriteKey: 'lasers', diedAtMs: nowMs });
        }
      }
    }

    state.units = state.units.filter((u) => u.hp > 0);
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
    let dtRemaining = dt;

    while (segIndex < path.length - 1 && dtRemaining > 0) {
      const a = path[segIndex];
      const b = path[segIndex + 1];
      const dx = b.wx - a.wx;
      const dy = b.wy - a.wy;
      const segLen = Math.hypot(dx, dy);

      if (segLen === 0) {
        segIndex += 1;
        t = 0;
        continue;
      }

      const speedMultiplier = Math.max(0.25, unit.speedBuff ?? 1);
      const distanceToCover = unit.def.speed * speedMultiplier * dtRemaining;
      const tAdvance = distanceToCover / segLen;

      if (t + tAdvance < 1) {
        t += tAdvance;
        dtRemaining = 0;
      } else {
        const tLeft = 1 - t;
        const dtUsed = (tLeft * segLen) / (unit.def.speed * speedMultiplier);
        dtRemaining -= dtUsed;
        segIndex += 1;
        t = 0;
      }
    }

    if (segIndex >= path.length - 1) {
      unit.state = 'attacking-base';
      unit.pathIndex = path.length - 1;
      unit.pathT = 0;
      this.applyBaseContactPosition(unit, path);
      return;
    }

    unit.pathIndex = segIndex;
    unit.pathT = t;
    this.applyLanePosition(unit, path, segIndex);
  }

  private updateCollectorOrbit(unit: Unit, state: GameState, dt: number): void {
    const anchor = this.resolveCollectorAnchor(state);
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
      // Idle: stand at fixed left/right positions flanking the citadel.
      // Slot is determined by order among alive collectors (first = left, second = right).
      const collectors = state.units.filter(
        u => u.def.role === 'collector' && u.faction === 'ally' && u.hp > 0,
      );
      const slotIndex = collectors.findIndex(u => u.id === unit.id);
      const slotSign = slotIndex <= 0 ? -1 : 1; // -1 = left side, +1 = right side
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

    // Active: orbit the anchor while harvesting crystals.
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

  private resolveCollectorAnchor(state: GameState): PathNode {
    return state.allyPathNodes?.[0]
      ?? state.pathNodes[state.pathNodes.length - 1]
      ?? { wx: 0, wy: 0 };
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
    const path = this.resolveAllyPath(state);
    const unitId = state.nextId++;

    // Snap to path at anchor (no lane X-bias that would pick the wrong segment).
    const anchorWx = pod.anchorWx ?? pod.wx;
    const anchorWy = pod.anchorWy ?? pod.wy + 24;
    const pathPosition = this.findClosestPathPosition(path, anchorWx, anchorWy);
    const a = path[pathPosition.pathIndex]!;
    const b = path[Math.min(pathPosition.pathIndex + 1, path.length - 1)]!;
    const spawnWx = a.wx + (b.wx - a.wx) * pathPosition.pathT;
    const spawnWy = a.wy + (b.wy - a.wy) * pathPosition.pathT;

    // Compute path perpendicular (same formula as applyLanePosition)
    const segDx = b.wx - a.wx;
    const segDy = b.wy - a.wy;
    const segLen = Math.hypot(segDx, segDy) || 1;
    const perpX = -segDy / segLen;
    const perpY = segDx / segLen;

    // Project pod's offset from anchor onto perpendicular → recover the pod's spread amount.
    // Dot product gives exact perpAmount when pod was offset in perpendicular direction.
    const podDx = pod.wx - anchorWx;
    const podDy = pod.wy + 24 - anchorWy; // +24 undoes the visual -24 float
    const podLane = podDx * perpX + podDy * perpY;

    // Small stagger so the 3 units from one pod don't stack exactly
    const stagger = [-18, 0, 18][releaseIndex % 3];

    state.units.push({
      id: unitId,
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
      laneOffset: podLane + stagger,
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
      const t = this.clamp01(rawT);
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

  private pickAllyLaneOffset(unitId: number): number {
    const lanes = [-20, 0, 20, -10, 10, -30, 30];
    const base = lanes[unitId % lanes.length];
    const jitter = this.seededNoise(unitId * 37.13 + 5.5) * 5;
    return base + jitter;
  }

  private pickEnemyLaneOffset(state: GameState, unitId: number): number {
    const offsets = state.enemyLaneOffsets && state.enemyLaneOffsets.length > 0
      ? state.enemyLaneOffsets
      : [0];
    if (offsets.length === 1) return offsets[0];

    const orderedOffsets = this.centerOutOffsets(offsets);
    const index = (Math.max(0, unitId - 1)) % orderedOffsets.length;
    const baseOffset = orderedOffsets[index];

    const spacing = this.resolveMinLaneSpacing(offsets);
    const jitterMax = Math.max(1, Math.min(4, spacing * 0.16));
    const jitterNoise = this.seededNoise(unitId * 53.91 + 11.7);
    return baseOffset + jitterNoise * jitterMax;
  }

  private applyLanePosition(unit: Unit, path: PathNode[], segIndex: number): void {
    if (segIndex >= path.length - 1) {
      this.applyBaseContactPosition(unit, path);
      return;
    }

    const laneOffset = unit.laneOffset ?? 0;
    const current = path[Math.min(segIndex, path.length - 1)] ?? { wx: 0, wy: 0 };
    const next = path[Math.min(segIndex + 1, path.length - 1)] ?? current;
    const prev = path[Math.max(segIndex - 1, 0)] ?? current;
    const target = next !== current ? next : prev;
    const baseX = segIndex >= path.length - 1
      ? current.wx
      : current.wx + unit.pathT * (target.wx - current.wx);
    const baseY = segIndex >= path.length - 1
      ? current.wy
      : current.wy + unit.pathT * (target.wy - current.wy);

    if (!laneOffset) {
      unit.wx = baseX;
      unit.wy = baseY;
      return;
    }

    const dx = target.wx - current.wx;
    const dy = target.wy - current.wy;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const laneFactor = this.resolveLaneSpreadFactor(unit, path, segIndex);
    unit.wx = baseX + perpX * laneOffset * laneFactor;
    unit.wy = baseY + perpY * laneOffset * laneFactor;
  }

  private resolveLaneSpreadFactor(unit: Unit, path: PathNode[], segIndex: number): number {
    if (unit.faction !== 'enemy') return 1;
    if (path.length < 2) return 1;

    if (segIndex >= path.length - 2) {
      const t = this.smoothstep(unit.pathT);
      return 1 + (BASE_ATTACK_LANE_FACTOR - 1) * t;
    }

    const emergenceDelay = 0.08 + this.unitVariance(unit.id, 17.7) * 0.08;
    const emergenceRamp = 0.58 + this.unitVariance(unit.id, 29.4) * 0.16;

    // Enemies emerge from the portal in a tighter stream and fan out gradually.
    if (segIndex === 0) {
      const t = this.clamp01((unit.pathT - emergenceDelay) / emergenceRamp);
      return this.smoothstep(t) * 0.5;
    }

    if (segIndex === 1) {
      const t = this.clamp01((unit.pathT - emergenceDelay * 0.28) / 0.92);
      return 0.5 + 0.24 * this.smoothstep(t);
    }

    if (segIndex === 2) {
      const t = this.clamp01((unit.pathT + 0.08) / 1.02);
      return 0.74 + 0.14 * this.smoothstep(t);
    }

    return 1;
  }

  private applyBaseContactPosition(unit: Unit, path: PathNode[]): void {
    const last = path[path.length - 1] ?? { wx: 0, wy: 0 };
    const prev = this.findMeaningfulCitadelApproachNode(path);
    const dx = last.wx - prev.wx;
    const dy = last.wy - prev.wy;
    const len = Math.hypot(dx, dy);

    if (len <= 0.001) {
      unit.wx = last.wx;
      unit.wy = last.wy;
      return;
    }

    const dirX = dx / len;
    const dirY = dy / len;
    const standOff = Math.min(Math.max(BASE_ATTACK_STANDOFF, len * 0.42), len * 0.8);
    const perpX = -dirY;
    const perpY = dirX;
    const laneOffset = (unit.laneOffset ?? 0) * BASE_ATTACK_LANE_FACTOR;

    unit.wx = last.wx - dirX * standOff + perpX * laneOffset;
    unit.wy = last.wy - dirY * standOff + perpY * laneOffset;
  }

  private findMeaningfulCitadelApproachNode(path: PathNode[]): PathNode {
    const last = path[path.length - 1] ?? { wx: 0, wy: 0 };
    const minApproachDistance = BASE_ATTACK_STANDOFF * 1.2;

    for (let i = path.length - 2; i >= 0; i -= 1) {
      const node = path[i];
      const dx = last.wx - node.wx;
      const dy = last.wy - node.wy;
      if (Math.hypot(dx, dy) >= minApproachDistance) {
        return node;
      }
    }

    return path[path.length - 2] ?? last;
  }

  private resolveMinLaneSpacing(offsets: number[]): number {
    const sorted = [...offsets].sort((a, b) => a - b);
    let minSpacing = Number.POSITIVE_INFINITY;
    for (let i = 1; i < sorted.length; i += 1) {
      const spacing = Math.abs(sorted[i] - sorted[i - 1]);
      if (spacing > 0 && spacing < minSpacing) minSpacing = spacing;
    }
    return Number.isFinite(minSpacing) ? minSpacing : 12;
  }

  private centerOutOffsets(offsets: number[]): number[] {
    const sorted = [...offsets].sort((a, b) => a - b);
    const result: number[] = [];
    let left = Math.floor((sorted.length - 1) / 2);
    let right = left + 1;

    if (sorted.length % 2 === 1) {
      result.push(sorted[left]);
      left -= 1;
    }

    while (left >= 0 || right < sorted.length) {
      if (left >= 0) {
        result.push(sorted[left]);
        left -= 1;
      }
      if (right < sorted.length) {
        result.push(sorted[right]);
        right += 1;
      }
    }

    return result;
  }

  private seededNoise(seed: number): number {
    const value = Math.sin(seed) * 43758.5453123;
    return (value - Math.floor(value)) * 2 - 1;
  }

  private unitVariance(unitId: number, salt: number): number {
    return (this.seededNoise(unitId * salt) + 1) * 0.5;
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private smoothstep(t: number): number {
    const clamped = this.clamp01(t);
    return clamped * clamped * (3 - 2 * clamped);
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
