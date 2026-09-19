import { expect, test } from '@playwright/test';
import type { EnemyState } from '../../src/game/types';
import {
  advanceGame,
  gameSnapshot,
  openApp,
  setupGame,
  startGame,
} from './helpers';

function chaser(
  id: number,
  x: number,
  y: number,
  overrides: Partial<EnemyState> = {},
): EnemyState {
  return {
    id,
    kind: 'chaser',
    x,
    y,
    rotation: Math.PI / 2,
    health: 75,
    maxHealth: 75,
    radius: 30,
    avoidanceDirection: 1,
    avoidanceTime: 0,
    ...overrides,
  } as EnemyState;
}

function shooter(
  id: number,
  x: number,
  y: number,
  overrides: Partial<EnemyState> = {},
): EnemyState {
  return {
    id,
    kind: 'shooter',
    x,
    y,
    rotation: Math.PI / 2,
    health: 100,
    maxHealth: 100,
    radius: 30,
    avoidanceDirection: -1,
    avoidanceTime: 0,
    fireCooldown: 0,
    ...overrides,
  } as EnemyState;
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await startGame(page);
});

test('moves, rotates, respects arena bounds, and cannot cross the island', async ({ page }) => {
  const initial = await gameSnapshot(page);
  expect(initial.config.islands.map((island) => island.id)).toEqual([
    'central-island',
    'south-west-reef',
    'east-reef',
  ]);
  await page.keyboard.down('KeyW');
  const moved = await advanceGame(page, 0.5);
  await page.keyboard.up('KeyW');
  expect(moved.state.player.x).toBeGreaterThan(initial.state.player.x + 100);

  await page.keyboard.down('KeyD');
  const turned = await advanceGame(page, 0.4);
  await page.keyboard.up('KeyD');
  expect(turned.state.player.rotation).toBeGreaterThan(moved.state.player.rotation);

  await setupGame(page, {
    player: { x: 1_560, y: 100, rotation: -Math.PI / 2 },
    enemies: [],
    clearProjectiles: true,
  });
  await page.keyboard.down('KeyW');
  const bounded = await advanceGame(page, 2);
  await page.keyboard.up('KeyW');
  expect(bounded.state.player.x).toBeLessThanOrEqual(1_572);

  await setupGame(page, {
    player: { x: 600, y: 450, rotation: -Math.PI / 2 },
    enemies: [],
    clearProjectiles: true,
  });
  await page.keyboard.down('KeyW');
  const islandBlocked = await advanceGame(page, 0.8);
  await page.keyboard.up('KeyW');
  expect(islandBlocked.state.player.x).toBeLessThan(640);

  await setupGame(page, {
    player: { x: 235, y: 560, rotation: 0 },
    enemies: [],
    clearProjectiles: true,
  });
  await page.keyboard.down('KeyW');
  const smallIslandBlocked = await advanceGame(page, 0.7);
  await page.keyboard.up('KeyW');
  expect(smallIslandBlocked.state.player.y).toBeLessThan(600);
});

test('fires front and broadside weapons, applies cooldown, damage, and one score', async ({ page }) => {
  await setupGame(page, {
    player: { x: 400, y: 150, rotation: -Math.PI / 2 },
    enemies: [],
    clearProjectiles: true,
  });

  await page.keyboard.down('Space');
  const firstShot = await advanceGame(page, 0.01);
  const duringCooldown = await advanceGame(page, 0.2);
  const afterCooldown = await advanceGame(page, 0.25);
  await page.keyboard.up('Space');
  expect(firstShot.state.projectiles).toHaveLength(1);
  expect(duringCooldown.state.projectiles).toHaveLength(1);
  expect(afterCooldown.state.projectiles).toHaveLength(2);

  await setupGame(page, {
    enemies: [],
    clearProjectiles: true,
    clearEffects: true,
  });
  await page.keyboard.down('KeyQ');
  const broadside = await advanceGame(page, 0.01);
  await page.keyboard.up('KeyQ');
  expect(
    broadside.state.projectiles.filter(
      (projectile) => projectile.weapon === 'leftBroadside',
    ),
  ).toHaveLength(3);

  await setupGame(page, {
    player: { x: 400, y: 450, rotation: -Math.PI / 2 },
    enemies: [shooter(20, 600, 450, { health: 25 })],
    score: 0,
    cooldowns: { front: 0, left: 0, right: 0 },
    clearProjectiles: true,
    clearEffects: true,
  });
  await page.keyboard.down('Space');
  const destroyed = await advanceGame(page, 0.4);
  await page.keyboard.up('Space');
  expect(destroyed.state.enemies).toHaveLength(0);
  expect(destroyed.state.score).toBe(1);
  expect(destroyed.state.effects.some((effect) => effect.kind === 'explosion')).toBe(true);
});

test('updates Chaser and Shooter behavior and performs deterministic safe spawning', async ({ page }) => {
  await setupGame(page, {
    player: { x: 400, y: 450, rotation: -Math.PI / 2 },
    enemies: [chaser(30, 1_100, 200)],
    clearProjectiles: true,
  });
  const chaserBefore = await gameSnapshot(page);
  const chaserAfter = await advanceGame(page, 1);
  const beforeDistance = Math.hypot(
    chaserBefore.state.enemies[0].x - chaserBefore.state.player.x,
    chaserBefore.state.enemies[0].y - chaserBefore.state.player.y,
  );
  const afterDistance = Math.hypot(
    chaserAfter.state.enemies[0].x - chaserAfter.state.player.x,
    chaserAfter.state.enemies[0].y - chaserAfter.state.player.y,
  );
  expect(afterDistance).toBeLessThan(beforeDistance);

  await setupGame(page, {
    player: { x: 400, y: 200 },
    enemies: [shooter(31, 700, 200)],
    clearProjectiles: true,
  });
  const shooterAfter = await advanceGame(page, 0.08);
  expect(
    shooterAfter.state.projectiles.some((projectile) => projectile.owner === 'enemy'),
  ).toBe(true);
  const afterEnemyFire = await advanceGame(page, 0.9);
  expect(afterEnemyFire.state.player.health).toBeLessThan(100);

  await setupGame(page, {
    player: { x: 400, y: 450 },
    enemies: [],
    spawnElapsed: 5.98,
    clearProjectiles: true,
  });
  const spawned = await advanceGame(page, 0.05);
  expect(spawned.state.enemies).toHaveLength(1);
  const enemy = spawned.state.enemies[0];
  expect(Math.hypot(enemy.x - 400, enemy.y - 450)).toBeGreaterThanOrEqual(480);
  expect(enemy.x < 620 || enemy.x > 980 || enemy.y < 270 || enemy.y > 630).toBe(true);
});

test('routes Chaser and Shooter around an island instead of staying blocked', async ({ page }) => {
  const player = { x: 1_100, y: 450, health: 100 };

  await setupGame(page, {
    player,
    enemies: [chaser(40, 500, 450, { rotation: -Math.PI / 2 })],
    spawnElapsed: -100,
    clearProjectiles: true,
    clearEffects: true,
  });
  const chaserAfter = await advanceGame(page, 8);
  const survivingChaser = chaserAfter.state.enemies[0];
  if (survivingChaser) {
    expect(
      Math.hypot(survivingChaser.x - 500, survivingChaser.y - 450),
    ).toBeGreaterThan(180);
    expect(
      Math.hypot(survivingChaser.x - player.x, survivingChaser.y - player.y),
      JSON.stringify(survivingChaser),
    ).toBeLessThan(420);
  } else {
    expect(chaserAfter.state.player.health).toBe(70);
  }

  await setupGame(page, {
    player,
    enemies: [shooter(41, 500, 450, {
      rotation: -Math.PI / 2,
      fireCooldown: 999,
    })],
    spawnElapsed: -100,
    clearProjectiles: true,
    clearEffects: true,
  });
  const shooterAfter = await advanceGame(page, 8);
  const routedShooter = shooterAfter.state.enemies[0];
  expect(
    Math.hypot(routedShooter.x - 500, routedShooter.y - 450),
  ).toBeGreaterThan(180);
  expect(
    Math.hypot(routedShooter.x - player.x, routedShooter.y - player.y),
  ).toBeLessThan(520);

  // This diagonal approach used to select a heading whose long-range probe
  // looked clear while its first few pixels still crossed the island edge.
  // The Chaser would reach the lower-left corner and remain there forever.
  const diagonalPlayer = { x: 1_250, y: 630, health: 100 };
  await setupGame(page, {
    player: diagonalPlayer,
    enemies: [chaser(42, 609.47, 340, {
      rotation: -1.16,
      avoidanceDirection: 1,
    })],
    spawnElapsed: -100,
    clearProjectiles: true,
    clearEffects: true,
  });
  const diagonalAfter = await advanceGame(page, 3);
  const navigatingChaser = diagonalAfter.state.enemies[0];
  expect(navigatingChaser).toBeDefined();
  expect(
    Math.hypot(navigatingChaser.x - 609.47, navigatingChaser.y - 340),
    JSON.stringify(navigatingChaser),
  ).toBeGreaterThan(180);
});
