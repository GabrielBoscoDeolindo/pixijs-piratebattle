import type { GameConfig } from '../config';
import { smallestAngleDifference, rotationToward } from '../math';
import type { PlayerState, ShooterState } from '../types';
import { hasClearPath, steerEnemy } from './navigationSystem';

export function updateShooter(
  shooter: ShooterState,
  player: PlayerState,
  deltaSeconds: number,
  config: GameConfig,
): boolean {
  shooter.fireCooldown = Math.max(0, shooter.fireCooldown - deltaSeconds);

  const dx = player.x - shooter.x;
  const dy = player.y - shooter.y;
  const distanceSquared = dx * dx + dy * dy;
  const preferredDistanceSquared = config.shooter.preferredDistance ** 2;
  const hasClearShot = hasClearPath(
    shooter,
    player,
    config.shooter.projectile.radius,
    config,
  );

  steerEnemy(
    shooter,
    player,
    deltaSeconds,
    config.shooter.moveSpeed,
    config.shooter.rotationSpeed,
    distanceSquared > preferredDistanceSquared || !hasClearShot,
    config,
  );

  const desiredRotation = rotationToward(shooter, player);
  const isAimed =
    Math.abs(smallestAngleDifference(shooter.rotation, desiredRotation)) <=
    config.shooter.aimTolerance;
  const isInRange = distanceSquared <= config.shooter.attackRange ** 2;

  if (
    !isInRange ||
    !isAimed ||
    !hasClearShot ||
    shooter.fireCooldown > 0
  ) return false;

  shooter.fireCooldown = config.shooter.fireCooldown;
  return true;
}
