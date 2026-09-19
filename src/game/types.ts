export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerState extends Vector2 {
  rotation: number;
  health: number;
}

export interface InputState {
  forward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
}

export type MatchPhase = 'playing' | 'paused' | 'finished';
export type MatchEndReason = 'timeExpired' | 'playerDestroyed';
export type PauseReason = 'manual' | 'focusLost';

export interface MatchState {
  phase: MatchPhase;
  elapsedSeconds: number;
  remainingSeconds: number;
  endReason: MatchEndReason | null;
  pauseReason: PauseReason | null;
}

export type WeaponType =
  | 'front'
  | 'leftBroadside'
  | 'rightBroadside'
  | 'enemyFront';
export type ProjectileOwner = 'player' | 'enemy';

export interface ProjectileState extends Vector2 {
  id: number;
  owner: ProjectileOwner;
  velocityX: number;
  velocityY: number;
  age: number;
  radius: number;
  damage: number;
  lifetime: number;
  weapon: WeaponType;
}

export interface NavigatingEnemy extends Vector2 {
  id: number;
  rotation: number;
  health: number;
  maxHealth: number;
  radius: number;
  avoidanceDirection: -1 | 1;
  avoidanceTime: number;
}

export interface ChaserState extends NavigatingEnemy {
  kind: 'chaser';
}

export interface ShooterState extends NavigatingEnemy {
  kind: 'shooter';
  fireCooldown: number;
}

export type EnemyState = ChaserState | ShooterState;

export interface EffectState extends Vector2 {
  id: number;
  kind: 'explosion' | 'muzzle' | 'impact';
  age: number;
  duration: number;
  rotation: number;
}

export interface GameState {
  player: PlayerState;
  projectiles: ProjectileState[];
  enemies: EnemyState[];
  effects: EffectState[];
  score: number;
  match: MatchState;
}
