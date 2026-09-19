import { circleIntersectsPolygon, circlesOverlap } from '../collision';
import type { GameConfig } from '../config';
import type { EnemyState, PlayerState, Vector2 } from '../types';

export function findSafeSpawnPoint(
  player: PlayerState,
  enemies: readonly EnemyState[],
  enemyRadius: number,
  config: GameConfig,
  startIndex: number,
): Vector2 | null {
  const { points, minimumPlayerDistance } = config.spawn;
  const minimumDistanceSquared = minimumPlayerDistance ** 2;

  for (let offset = 0; offset < points.length; offset += 1) {
    const point = points[(startIndex + offset) % points.length];
    const playerDx = point.x - player.x;
    const playerDy = point.y - player.y;

    if (playerDx * playerDx + playerDy * playerDy < minimumDistanceSquared) {
      continue;
    }

    const overlapsIsland = config.islands.some((island) =>
      circleIntersectsPolygon(
        point,
        enemyRadius,
        island,
        island.collisionPoints,
      ),
    );
    if (overlapsIsland) continue;

    const overlapsEnemy = enemies.some((enemy) =>
      circlesOverlap(point, enemyRadius + 24, enemy, enemy.radius),
    );
    if (overlapsEnemy) continue;

    return { x: point.x, y: point.y };
  }

  return null;
}
