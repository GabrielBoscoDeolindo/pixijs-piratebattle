import { expect, test } from '@playwright/test';
import type { EnemyState } from '../../src/game/types';
import {
  advanceGame,
  finishByTime,
  gameSnapshot,
  openApp,
  startGame,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await startGame(page);
});

test('ends by time, persists the result, and restarts with clean state', async ({ page }) => {
  await finishByTime(page);
  await expect(page.getByText('Voyage recorded')).toBeVisible();
  await expect(page.getByText('Time expired', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: "Time's Up!" })).toBeVisible();
  await expect(page.getByText('Voyage recorded')).toBeVisible();

  await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
  await page.waitForFunction(() => Boolean(window.__PIRATE_BATTLE_TEST__?.game));
  const restarted = await gameSnapshot(page);
  expect(restarted.state.player.health).toBe(100);
  expect(restarted.state.score).toBe(0);
  expect(restarted.state.match.phase).toBe('playing');
  expect(restarted.state.match.remainingSeconds).toBe(90);
  expect(restarted.state.enemies).toHaveLength(2);
});

test('ends by player death and freezes all simulation state', async ({ page }) => {
  const result = await page.evaluate(() => {
    const game = window.__PIRATE_BATTLE_TEST__?.game;
    if (!game) throw new Error('Game test controller is unavailable.');
    const collidingChaser: EnemyState = {
      id: 90,
      kind: 'chaser',
      x: 400,
      y: 450,
      rotation: 0,
      health: 75,
      maxHealth: 75,
      radius: 30,
      avoidanceDirection: 1,
      avoidanceTime: 0,
    };
    game.setup({
      player: { x: 400, y: 450, health: 20 },
      enemies: [collidingChaser],
      clearProjectiles: true,
    });
    const finished = game.advance(0.02);
    const frozen = game.advance(10);
    return { finished, frozen };
  });

  expect(result.finished.state.match.phase).toBe('finished');
  expect(result.finished.state.match.endReason).toBe('playerDestroyed');
  expect(result.finished.state.player.health).toBe(0);
  expect(result.finished.state.score).toBe(0);
  expect(result.frozen.state).toEqual(result.finished.state);
  await expect(page.getByRole('heading', { name: 'Ship Sunk!' })).toBeVisible();
});

test('pauses manually and on focus loss without accumulating time or held input', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.getByRole('dialog', { name: 'Game Paused' })).toBeVisible();
  const paused = await gameSnapshot(page);
  const afterWaiting = await advanceGame(page, 5);
  expect(afterWaiting.state.match.remainingSeconds).toBe(
    paused.state.match.remainingSeconds,
  );

  await page.keyboard.down('KeyW');
  await page.getByRole('button', { name: 'RESUME' }).click();
  const afterResume = await advanceGame(page, 0.4);
  await page.keyboard.up('KeyW');
  expect(afterResume.state.player.x).toBe(paused.state.player.x);

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByText('The game paused because the window lost focus.')).toBeVisible();
  const focusPaused = await gameSnapshot(page);
  const focusWaiting = await advanceGame(page, 3);
  expect(focusWaiting.state.match.remainingSeconds).toBe(
    focusPaused.state.match.remainingSeconds,
  );
  await page.getByRole('button', { name: 'RESUME' }).click();
  expect((await gameSnapshot(page)).state.match.phase).toBe('playing');
});
