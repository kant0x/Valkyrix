// Shared type contracts for Phase 3: Units, Buildings & Combat

export interface PathNode {
  wx: number;
  wy: number;
}

export type UnitRole = 'light' | 'heavy' | 'ranged' | 'collector';
export type UnitFaction = 'enemy' | 'ally';

export interface UnitDef {
  role: UnitRole;
  hp: number;
  speed: number;       // world units per second along path
  damage: number;      // per attack tick
  attackRate: number;  // attacks per second
  sprite: string;      // asset path
  faction: UnitFaction;
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
}

export interface Projectile {
  id: number;
  wx: number;
  wy: number;
  targetUnitId: number;
  speed: number;  // world units per second
  damage: number;
}

export interface GameState {
  phase: 'playing' | 'paused' | 'won' | 'lost';
  waveNumber: number;
  waveTimer: number;   // seconds until next wave
  spawnQueue: Array<{ defKey: string; delay: number }>;
  spawnTimer: number;
  units: Unit[];
  buildings: Building[];
  projectiles: Projectile[];
  citadelHp: number;
  citadelMaxHp: number;      // 500
  playerBaseHp: number;
  playerBaseMaxHp: number;   // 300
  resources: number;         // electrolatov
  nextId: number;            // auto-increment for unit/building IDs
  pathNodes: PathNode[];     // enemy direction: index 0 = portal, last = citadel
}

// Unit balance table — values from RESEARCH.md Phase 3 balance table
export const UNIT_DEFS: Record<string, UnitDef> = {
  'light-enemy': {
    role: 'light',
    hp: 40,
    speed: 80,
    damage: 8,
    attackRate: 1.0,
    sprite: 'public/assets/pers/viking/',
    faction: 'enemy',
  },
  'light-ally': {
    role: 'light',
    hp: 50,
    speed: 70,
    damage: 10,
    attackRate: 1.0,
    sprite: 'public/assets/pers/soldier/',
    faction: 'ally',
  },
  'heavy-enemy': {
    role: 'heavy',
    hp: 150,
    speed: 40,
    damage: 25,
    attackRate: 0.5,
    sprite: 'public/assets/pers/viking/',
    faction: 'enemy',
  },
  'ranged-enemy': {
    role: 'ranged',
    hp: 60,
    speed: 55,
    damage: 15,
    attackRate: 0.8,
    sprite: 'public/assets/pers/viking/',
    faction: 'enemy',
  },
};
