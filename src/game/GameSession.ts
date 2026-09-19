import { circleIntersectsPolygon, circlesOverlap } from './collision';
import type { GameConfig } from './config';
import { forwardFromRotation, rotationToward } from './math';
import { SeededRandom } from './random';
import { updateChaser } from './systems/chaserSystem';
import { updateShooter } from './systems/shooterSystem';
import { findSafeSpawnPoint } from './systems/spawnSystem';
import type {
  EnemyState,
  GameState,
  InputState,
  MatchEndReason,
  PauseReason,
  ProjectileState,
  Vector2,
  WeaponType,
} from './types';

export interface GameSessionTestSetup {
  player?: Partial<GameState['player']>;
  enemies?: EnemyState[];
  match?: Partial<GameState['match']>;
  score?: number;
  spawnElapsed?: number;
  cooldowns?: Partial<WeaponCooldowns>;
  clearProjectiles?: boolean;
  clearEffects?: boolean;
}

export interface GameSessionTestSnapshot {
  state: GameState;
  cooldowns: WeaponCooldowns;
  spawnElapsed: number;
  config: GameConfig;
}

export interface WeaponCooldowns {
  front: number;
  left: number;
  right: number;
}

export class GameSession {
  readonly state: GameState;
  private readonly config: GameConfig;
  private readonly random: SeededRandom;
  private readonly cooldowns: WeaponCooldowns = {
    front: 0,
    left: 0,
    right: 0,
  };
  private nextProjectileId = 1;
  private nextEffectId = 1;
  private nextEnemyId = 3;
  private spawnElapsed = 0;

  constructor(config: GameConfig) {
    this.config = structuredClone(config);
    this.random = new SeededRandom(this.config.spawn.randomSeed);

    this.state = {
      player: {
        x: this.config.arena.width * 0.25,
        y: this.config.arena.height * 0.5,
        rotation: -Math.PI / 2,
        health: this.config.player.maxHealth,
      },
      projectiles: [],
      enemies: [
        {
          id: 1,
          kind: 'chaser',
          x: this.config.chaser.spawn.x,
          y: this.config.chaser.spawn.y,
          rotation: this.config.chaser.spawn.rotation,
          health: this.config.chaser.maxHealth,
          maxHealth: this.config.chaser.maxHealth,
          radius: this.config.chaser.radius,
          avoidanceDirection: 1,
          avoidanceTime: 0,
        },
        {
          id: 2,
          kind: 'shooter',
          x: this.config.shooter.spawn.x,
          y: this.config.shooter.spawn.y,
          rotation: this.config.shooter.spawn.rotation,
          health: this.config.shooter.maxHealth,
          maxHealth: this.config.shooter.maxHealth,
          radius: this.config.shooter.radius,
          avoidanceDirection: -1,
          avoidanceTime: 0,
          fireCooldown: this.config.shooter.fireCooldown * 0.5,
        },
      ],
      effects: [],
      score: 0,
      match: {
        phase: 'playing',
        elapsedSeconds: 0,
        remainingSeconds: this.config.match.durationSeconds,
        endReason: null,
        pauseReason: null,
      },
    };
  }

  update(deltaSeconds: number, input: InputState): void {
    if (this.state.match.phase !== 'playing') return;

    const safeDelta = Math.min(deltaSeconds, 0.05);
    this.state.match.elapsedSeconds += safeDelta;
    this.state.match.remainingSeconds = Math.max(
      0,
      this.state.match.remainingSeconds - safeDelta,
    );

    if (this.state.match.remainingSeconds <= 0) {
      this.finish('timeExpired');
      return;
    }

    this.updateCooldowns(safeDelta);
    this.updateEffects(safeDelta);

    const turnDirection = Number(input.turnRight) - Number(input.turnLeft);
    this.state.player.rotation +=
      turnDirection * this.config.player.rotationSpeed * safeDelta;

    if (input.forward) {
      this.movePlayer(safeDelta);
    }

    this.fireWeapons(input);
    this.updateProjectiles(safeDelta);
    if (this.state.player.health <= 0) {
      this.finish('playerDestroyed');
      return;
    }

    this.updateEnemies(safeDelta);
    if (this.state.player.health <= 0) {
      this.finish('playerDestroyed');
      return;
    }

    this.updateSpawning(safeDelta);
  }

  pause(reason: PauseReason): void {
    if (this.state.match.phase !== 'playing') return;
    this.state.match.phase = 'paused';
    this.state.match.pauseReason = reason;
  }

  resume(): void {
    if (this.state.match.phase !== 'paused') return;
    this.state.match.phase = 'playing';
    this.state.match.pauseReason = null;
  }

  createTestSnapshot(): GameSessionTestSnapshot {
    return structuredClone({
      state: this.state,
      cooldowns: this.cooldowns,
      spawnElapsed: this.spawnElapsed,
      config: this.config,
    });
  }

  configureForTest(setup: GameSessionTestSetup): void {
    if (setup.player) Object.assign(this.state.player, setup.player);
    if (setup.enemies) {
      this.state.enemies = structuredClone(setup.enemies);
      this.nextEnemyId = Math.max(
        1,
        ...setup.enemies.map((enemy) => enemy.id + 1),
      );
    }
    if (setup.match) Object.assign(this.state.match, setup.match);
    if (setup.score !== undefined) this.state.score = setup.score;
    if (setup.spawnElapsed !== undefined) this.spawnElapsed = setup.spawnElapsed;
    if (setup.cooldowns) Object.assign(this.cooldowns, setup.cooldowns);
    if (setup.clearProjectiles) this.state.projectiles = [];
    if (setup.clearEffects) this.state.effects = [];
  }

  private finish(reason: MatchEndReason): void {
    this.state.match.phase = 'finished';
    this.state.match.endReason = reason;
    this.state.match.pauseReason = null;
  }

  private movePlayer(deltaSeconds: number): void {
    const previousX = this.state.player.x;
    const previousY = this.state.player.y;
    const distance = this.config.player.moveSpeed * deltaSeconds;
    const forward = this.getForwardVector();

    this.state.player.x += forward.x * distance;
    this.state.player.y += forward.y * distance;

    this.constrainPlayerToArena();

    if (this.collidesWithIsland()) {
      this.state.player.x = previousX;
      this.state.player.y = previousY;
    }
  }

  private fireWeapons(input: InputState): void {
    if (input.fireFront && this.cooldowns.front <= 0) {
      this.fireFront();
      this.cooldowns.front = this.config.weapons.frontCooldown;
    }

    if (input.fireLeft && this.cooldowns.left <= 0) {
      this.fireBroadside('leftBroadside');
      this.cooldowns.left = this.config.weapons.broadsideCooldown;
    }

    if (input.fireRight && this.cooldowns.right <= 0) {
      this.fireBroadside('rightBroadside');
      this.cooldowns.right = this.config.weapons.broadsideCooldown;
    }
  }

  private fireFront(): void {
    const forward = this.getForwardVector();
    this.spawnProjectile(
      'front',
      forward,
      this.config.player.radius + this.config.projectile.radius + 5,
      0,
    );
  }

  private fireBroadside(weapon: 'leftBroadside' | 'rightBroadside'): void {
    const forward = this.getForwardVector();
    const right = { x: -forward.y, y: forward.x };
    const direction = weapon === 'leftBroadside'
      ? { x: -right.x, y: -right.y }
      : right;
    const spacing = this.config.weapons.broadsideSpacing;

    for (const forwardOffset of [-spacing, 0, spacing]) {
      this.spawnProjectile(
        weapon,
        direction,
        this.config.player.radius + this.config.projectile.radius + 3,
        forwardOffset,
      );
    }
  }

  private spawnProjectile(
    weapon: WeaponType,
    direction: Vector2,
    directionOffset: number,
    forwardOffset: number,
  ): void {
    const player = this.state.player;
    const forward = this.getForwardVector();

    this.state.projectiles.push({
      id: this.nextProjectileId++,
      owner: 'player',
      x: player.x + direction.x * directionOffset + forward.x * forwardOffset,
      y: player.y + direction.y * directionOffset + forward.y * forwardOffset,
      velocityX: direction.x * this.config.projectile.speed,
      velocityY: direction.y * this.config.projectile.speed,
      age: 0,
      radius: this.config.projectile.radius,
      damage: this.config.projectile.damage,
      lifetime: this.config.projectile.lifetime,
      weapon,
    });
    this.createEffect(
      'muzzle',
      {
        x: player.x + direction.x * directionOffset + forward.x * forwardOffset,
        y: player.y + direction.y * directionOffset + forward.y * forwardOffset,
      },
      this.config.effects.muzzleDuration,
      player.rotation,
    );
  }

  private updateProjectiles(deltaSeconds: number): void {
    const activeProjectiles: ProjectileState[] = [];

    for (const projectile of this.state.projectiles) {
      projectile.x += projectile.velocityX * deltaSeconds;
      projectile.y += projectile.velocityY * deltaSeconds;
      projectile.age += deltaSeconds;

      if (!this.isProjectileActive(projectile)) continue;

      if (projectile.owner === 'player') {
        const enemy = this.state.enemies.find((candidate) =>
          circlesOverlap(
            projectile,
            projectile.radius,
            candidate,
            candidate.radius,
          ),
        );

        if (enemy) {
          this.createEffect(
            'impact',
            projectile,
            this.config.effects.impactDuration,
            0,
          );
          this.damageEnemy(enemy.id, projectile.damage);
          continue;
        }
      } else if (
        circlesOverlap(
          projectile,
          projectile.radius,
          this.state.player,
          this.config.player.radius,
        )
      ) {
        this.createEffect(
          'impact',
          projectile,
          this.config.effects.impactDuration,
          0,
        );
        this.state.player.health = Math.max(
          0,
          this.state.player.health - projectile.damage,
        );
        continue;
      }

      activeProjectiles.push(projectile);
    }

    this.state.projectiles = activeProjectiles;
  }

  private damageEnemy(enemyId: number, damage: number): void {
    const enemy = this.state.enemies.find((candidate) => candidate.id === enemyId);
    if (!enemy) return;

    enemy.health = Math.max(0, enemy.health - damage);
    if (enemy.health > 0) return;

    this.state.enemies = this.state.enemies.filter(
      (candidate) => candidate.id !== enemyId,
    );
    this.createEffect(
      'explosion',
      enemy,
      this.config.effects.explosionDuration,
      enemy.rotation,
    );
    this.state.score += 1;
  }

  private updateEnemies(deltaSeconds: number): void {
    const activeEnemies: EnemyState[] = [];

    for (const enemy of this.state.enemies) {
      if (enemy.kind === 'chaser') {
        updateChaser(enemy, this.state.player, deltaSeconds, this.config);
      } else if (
        enemy.kind === 'shooter' &&
        updateShooter(enemy, this.state.player, deltaSeconds, this.config)
      ) {
        this.fireEnemyProjectile(enemy);
      }

      if (
        enemy.kind === 'chaser' &&
        circlesOverlap(
          enemy,
          enemy.radius,
          this.state.player,
          this.config.player.radius,
        )
      ) {
        this.state.player.health = Math.max(
          0,
          this.state.player.health - this.config.chaser.collisionDamage,
        );
        this.createEffect(
          'explosion',
          enemy,
          this.config.effects.explosionDuration,
          enemy.rotation,
        );
        continue;
      }

      activeEnemies.push(enemy);
    }

    this.state.enemies = activeEnemies;
  }

  private fireEnemyProjectile(enemy: EnemyState): void {
    const direction = forwardFromRotation(enemy.rotation);
    const projectileConfig = this.config.shooter.projectile;
    const spawnOffset = enemy.radius + projectileConfig.radius + 5;

    this.state.projectiles.push({
      id: this.nextProjectileId++,
      owner: 'enemy',
      x: enemy.x + direction.x * spawnOffset,
      y: enemy.y + direction.y * spawnOffset,
      velocityX: direction.x * projectileConfig.speed,
      velocityY: direction.y * projectileConfig.speed,
      age: 0,
      radius: projectileConfig.radius,
      damage: projectileConfig.damage,
      lifetime: projectileConfig.lifetime,
      weapon: 'enemyFront',
    });
    this.createEffect(
      'muzzle',
      {
        x: enemy.x + direction.x * spawnOffset,
        y: enemy.y + direction.y * spawnOffset,
      },
      this.config.effects.muzzleDuration,
      enemy.rotation,
    );
  }

  private updateSpawning(deltaSeconds: number): void {
    this.spawnElapsed += deltaSeconds;
    if (this.spawnElapsed < this.config.spawn.intervalSeconds) return;

    this.spawnElapsed %= this.config.spawn.intervalSeconds;
    if (this.state.enemies.length >= this.config.spawn.maximumEnemies) return;

    const kind = this.random.next() < this.config.spawn.chaserWeight
      ? 'chaser'
      : 'shooter';
    const radius = kind === 'chaser'
      ? this.config.chaser.radius
      : this.config.shooter.radius;
    const point = findSafeSpawnPoint(
      this.state.player,
      this.state.enemies,
      radius,
      this.config,
      this.random.integer(this.config.spawn.points.length),
    );

    if (!point) return;

    const baseEnemy = {
      id: this.nextEnemyId++,
      x: point.x,
      y: point.y,
      rotation: rotationToward(point, this.state.player),
      radius,
      avoidanceDirection: (this.nextEnemyId % 2 === 0 ? -1 : 1) as -1 | 1,
      avoidanceTime: 0,
    };

    if (kind === 'chaser') {
      this.state.enemies.push({
        ...baseEnemy,
        kind,
        health: this.config.chaser.maxHealth,
        maxHealth: this.config.chaser.maxHealth,
      });
    } else {
      this.state.enemies.push({
        ...baseEnemy,
        kind,
        health: this.config.shooter.maxHealth,
        maxHealth: this.config.shooter.maxHealth,
        fireCooldown: this.config.shooter.fireCooldown,
      });
    }
  }

  private updateEffects(deltaSeconds: number): void {
    for (const effect of this.state.effects) {
      effect.age += deltaSeconds;
    }

    this.state.effects = this.state.effects.filter(
      (effect) => effect.age < effect.duration,
    );
  }

  private createEffect(
    kind: 'explosion' | 'muzzle' | 'impact',
    position: Vector2,
    duration: number,
    rotation: number,
  ): void {
    this.state.effects.push({
      id: this.nextEffectId++,
      kind,
      x: position.x,
      y: position.y,
      age: 0,
      duration,
      rotation,
    });
  }

  private isProjectileActive(projectile: ProjectileState): boolean {
    const { width, height } = this.config.arena;
    const { radius } = projectile;

    if (projectile.age >= projectile.lifetime) return false;
    if (
      projectile.x < -radius ||
      projectile.x > width + radius ||
      projectile.y < -radius ||
      projectile.y > height + radius
    ) {
      return false;
    }

    const hitIsland = this.config.islands.some((island) =>
      circleIntersectsPolygon(
        projectile,
        radius,
        island,
        island.collisionPoints,
      ),
    );

    if (hitIsland) {
      this.createEffect(
        'impact',
        projectile,
        this.config.effects.impactDuration,
        0,
      );
      return false;
    }

    return true;
  }

  private updateCooldowns(deltaSeconds: number): void {
    this.cooldowns.front = Math.max(0, this.cooldowns.front - deltaSeconds);
    this.cooldowns.left = Math.max(0, this.cooldowns.left - deltaSeconds);
    this.cooldowns.right = Math.max(0, this.cooldowns.right - deltaSeconds);
  }

  private getForwardVector(): Vector2 {
    return forwardFromRotation(this.state.player.rotation);
  }

  private constrainPlayerToArena(): void {
    const { radius } = this.config.player;
    this.state.player.x = Math.max(
      radius,
      Math.min(this.config.arena.width - radius, this.state.player.x),
    );
    this.state.player.y = Math.max(
      radius,
      Math.min(this.config.arena.height - radius, this.state.player.y),
    );
  }

  private collidesWithIsland(): boolean {
    const { player } = this.state;

    return this.config.islands.some((island) =>
      circleIntersectsPolygon(
        player,
        this.config.player.radius,
        island,
        island.collisionPoints,
      ),
    );
  }
}
