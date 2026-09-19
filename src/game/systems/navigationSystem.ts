import {
  circleIntersectsPolygon,
  sweptCircleIntersectsPolygon,
} from '../collision';
import type { GameConfig } from '../config';
import { forwardFromRotation, rotateToward, rotationToward } from '../math';
import type { NavigatingEnemy, Vector2 } from '../types';

const AVOIDANCE_DURATION = 1.15;
const BLOCKED_TURN_MULTIPLIER = 2.4;
const AVOIDANCE_ANGLES = [
  Math.PI * 0.2,
  Math.PI * 0.3,
  Math.PI * 0.4,
  Math.PI * 0.5,
  Math.PI * 0.62,
] as const;

export function steerEnemy(
  enemy: NavigatingEnemy,
  target: Vector2,
  deltaSeconds: number,
  moveSpeed: number,
  rotationSpeed: number,
  shouldAdvance: boolean,
  config: GameConfig,
): void {
  const directRotation = rotationToward(enemy, target);

  if (!shouldAdvance) {
    enemy.rotation = rotateToward(
      enemy.rotation,
      directRotation,
      rotationSpeed * deltaSeconds,
    );
    enemy.avoidanceTime = Math.max(0, enemy.avoidanceTime - deltaSeconds);
    return;
  }

  const probeDistance = Math.max(enemy.radius * 3, moveSpeed * 0.72);
  const directPathClear = isHeadingClear(
    enemy,
    directRotation,
    probeDistance,
    config,
  );

  if (!directPathClear) enemy.avoidanceTime = AVOIDANCE_DURATION;

  const shouldAvoid = !directPathClear || enemy.avoidanceTime > 0;
  const targetRotation = shouldAvoid
    ? chooseAvoidanceRotation(enemy, directRotation, probeDistance, config)
    : directRotation;

  enemy.rotation = rotateToward(
    enemy.rotation,
    targetRotation,
    rotationSpeed * deltaSeconds,
  );

  const previousX = enemy.x;
  const previousY = enemy.y;
  const forward = forwardFromRotation(enemy.rotation);
  const distance = moveSpeed * deltaSeconds;

  enemy.x += forward.x * distance;
  enemy.y += forward.y * distance;

  if (isBlockedAt(enemy, enemy.radius, config)) {
    enemy.x = previousX;
    enemy.y = previousY;
    enemy.avoidanceTime = AVOIDANCE_DURATION;
    enemy.rotation = rotateToward(
      enemy.rotation,
      targetRotation,
      rotationSpeed * deltaSeconds * BLOCKED_TURN_MULTIPLIER,
    );
    return;
  }

  enemy.avoidanceTime = Math.max(0, enemy.avoidanceTime - deltaSeconds);
}

export function hasClearPath(
  start: Vector2,
  target: Vector2,
  radius: number,
  config: GameConfig,
): boolean {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return true;
  const outsideArena =
    target.x < radius ||
    target.x > config.arena.width - radius ||
    target.y < radius ||
    target.y > config.arena.height - radius;

  if (outsideArena) return false;

  return config.islands.every((island) =>
    !sweptCircleIntersectsPolygon(
      start,
      target,
      radius,
      island,
      island.collisionPoints,
    ),
  );
}

function chooseAvoidanceRotation(
  enemy: NavigatingEnemy,
  directRotation: number,
  probeDistance: number,
  config: GameConfig,
): number {
  const preferredRotation = findClearRotation(
    enemy,
    directRotation,
    enemy.avoidanceDirection,
    probeDistance,
    config,
  );
  if (preferredRotation !== null) return preferredRotation;

  const oppositeDirection = enemy.avoidanceDirection === 1 ? -1 : 1;
  const oppositeRotation = findClearRotation(
    enemy,
    directRotation,
    oppositeDirection,
    probeDistance,
    config,
  );
  if (oppositeRotation !== null) {
    enemy.avoidanceDirection = oppositeDirection;
    return oppositeRotation;
  }

  return directRotation + enemy.avoidanceDirection * Math.PI * 0.75;
}

function findClearRotation(
  enemy: NavigatingEnemy,
  directRotation: number,
  direction: -1 | 1,
  probeDistance: number,
  config: GameConfig,
): number | null {
  for (const angle of AVOIDANCE_ANGLES) {
    const candidateRotation = directRotation + direction * angle;
    if (isHeadingClear(enemy, candidateRotation, probeDistance, config)) {
      return candidateRotation;
    }
  }

  return null;
}

function isHeadingClear(
  enemy: NavigatingEnemy,
  rotation: number,
  probeDistance: number,
  config: GameConfig,
): boolean {
  const forward = forwardFromRotation(rotation);
  return hasClearPath(
    enemy,
    {
      x: enemy.x + forward.x * probeDistance,
      y: enemy.y + forward.y * probeDistance,
    },
    enemy.radius,
    config,
  );
}

function isBlockedAt(
  position: Vector2,
  radius: number,
  config: GameConfig,
): boolean {
  const outsideArena =
    position.x < radius ||
    position.x > config.arena.width - radius ||
    position.y < radius ||
    position.y > config.arena.height - radius;

  if (outsideArena) return true;

  return config.islands.some((island) =>
    circleIntersectsPolygon(
      position,
      radius,
      island,
      island.collisionPoints,
    ),
  );
}
