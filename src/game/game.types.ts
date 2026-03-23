// Shared type contracts for Phase 3: Units, Buildings & Combat

export interface PathNode {
  wx: number;
  wy: number;
}

export type UnitRole = 'light' | 'heavy' | 'ranged' | 'collector' | 'boss';
export type UnitFaction = 'enemy' | 'ally';

export interface UnitDef {
  role: UnitRole;
  hp: number;
  speed: number;       // world units per second along path
  damage: number;      // per attack tick
  attackRate: number;  // attacks per second
  sprite: string;      // asset path
  faction: UnitFaction;
  attackRange?: number; // world units — ranged units only; melee units use COLLISION_RADIUS
  enraged?: boolean;   // set by BossSystem when boss enters enraged state
}

export interface Unit {
  id: number;
  def: UnitDef;
  faction: UnitFaction;
  hp: number;
  pathIndex: number;          // current segment index into PathNode[]
  pathT: number;              // 0–1 progress within current segment
  wx: number;                 // current world X (interpolated)
  wy: number;                 // current world Y
  state: 'moving' | 'fighting' | 'attacking-base';
  fightingWith: number | null; // id of opponent unit
  attackCooldown: number;      // seconds until next attack
  speedBuff?: number;          // speed multiplier applied by buff towers each frame (1.25 = +25%)
  laneOffset?: number;         // signed world-space offset across road width for lane spreading
  lastWx?: number;             // previous frame world X for render-facing helpers
  lastWy?: number;             // previous frame world Y for render-facing helpers
  idlePhase?: number;          // low-frequency movement phase for hovering units
  firingFlash?: number;        // seconds remaining to show firing animation (ranged units)
}

export interface Building {
  id: number;
  type: 'attack' | 'buff';
  wx: number;
  wy: number;
  tileCol: number;
  tileRow: number;
  radius: number;       // world units — attack tower: 160, buff tower: 128
  damage: number;       // attack tower: 30 per shot; buff tower: 0
  attackRate: number;   // shots per second — attack tower: 1.0; buff tower: 0
  attackCooldown: number;
  buffValue: number;    // buff tower: 0.25 speed multiplier; attack tower: 0
  resourceRate: number; // electrolatov per second — attack tower: 5, buff tower: 3
  hp: number;           // current structural HP; reaches 0 when destroyed by enemies
  maxHp: number;
}

export interface Projectile {
  id: number;
  wx: number;
  wy: number;
  targetUnitId: number;
  speed: number;  // world units per second
  damage: number;
  kind?: 'bolt' | 'beam';
  source?: 'tower' | 'citadel' | 'ranged-unit';
  size?: number;
  ownerBuildingId?: number;
  beamSlot?: number;
  orbSlot?: number;
  aimWx?: number;
  aimWy?: number;
  turnRate?: number;
}

export interface ImpactMark {
  id: number;
  wx: number;
  wy: number;
  radius: number;
  ttl: number;
  maxTtl: number;
  source?: 'tower' | 'citadel' | 'ranged-unit';
}

export interface SpawnQueueEntry {
  defKey: string;
  delay: number;
  powerScale?: number;
}

export interface Corpse {
  id: number;
  wx: number;
  wy: number;
  spriteKey: string;
  diedAtMs: number;
}

export interface BossNegotiationState {
  active: boolean;
  triggered: boolean;   // true = negotiation has fired this session (prevents re-fire)
  outcome?: 'success' | 'failure';
}

export interface GameState {
  phase: 'playing' | 'paused' | 'won' | 'lost' | 'negotiation';
  waveNumber: number;
  waveTimer: number;   // seconds until next wave
  spawnQueue: SpawnQueueEntry[];
  spawnTimer: number;
  units: Unit[];
  buildings: Building[];
  projectiles: Projectile[];
  impactMarks?: ImpactMark[];
  corpses?: Corpse[];
  citadelHp: number;
  citadelMaxHp: number;      // 2000
  playerBaseHp: number;
  playerBaseMaxHp: number;   // 300
  resources: number;         // electrolatov
  crystals?: number;         // salvage dropped by enemies and processed by collectors
  bossNegotiation?: BossNegotiationState;  // populated by BossSystem during negotiation phase
  nextId: number;            // auto-increment for unit/building IDs
  pathNodes: PathNode[];     // enemy direction: index 0 = portal, last = citadel
  allyPathNodes?: PathNode[]; // ally direction: starts at citadel, then joins the reversed combat path
  enemyLaneOffsets?: number[]; // lateral lane offsets computed from the authored road width near spawn
}

// Unit balance table — values from RESEARCH.md Phase 3 balance table
export const UNIT_DEFS: Record<string, UnitDef> = {
  'light-enemy': {
    role: 'light',
    hp: 18,
    speed: 48,
    damage: 5,
    attackRate: 1.0,
    sprite: 'boits',      // fast weak enemy — boits spritesheet
    faction: 'enemy',
  },
  'heavy-enemy': {
    role: 'heavy',
    hp: 55,
    speed: 24,
    damage: 10,
    attackRate: 0.5,
    sprite: 'boits',      // reuses boits for now; Phase 4 gets robot sprite
    faction: 'enemy',
  },
  'boss-enemy': {
    role: 'boss',
    hp: 260,
    speed: 22,
    damage: 18,
    attackRate: 0.75,
    sprite: 'boits',
    faction: 'enemy',
  },
  'ranged-enemy': {
    role: 'ranged',
    hp: 24,
    speed: 34,
    damage: 7,
    attackRate: 0.8,
    sprite: 'lasers',
    faction: 'enemy',
    attackRange: 150,   // fires from 150 wu — never enters melee
  },
  'light-ally': {
    role: 'light',
    hp: 50,
    speed: 42,
    damage: 10,
    attackRate: 1.0,
    sprite: 'viking',     // viking defender
    faction: 'ally',
  },
  'heavy-ally': {
    role: 'heavy',
    hp: 95,
    speed: 30,
    damage: 18,
    attackRate: 0.8,
    sprite: 'viking',
    faction: 'ally',
  },
  'collector': {
    role: 'collector',
    hp: 30,
    speed: 120,
    damage: 0,
    attackRate: 0,
    sprite: 'collector',  // flying loot drone
    faction: 'ally',
  },
};
