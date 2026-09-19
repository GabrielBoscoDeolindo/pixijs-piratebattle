import { expect, test } from '@playwright/test';
import { advanceGame, gameSnapshot, openApp, startGame } from './helpers';

test('navigates, validates, saves, and restores options after refresh', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'OPTIONS' }).click();

  const duration = page.getByLabel('Game session time');
  const spawn = page.getByLabel('Enemy spawn time');
  await duration.fill('30');
  await spawn.fill('0');
  await page.getByRole('button', { name: 'SAVE' }).click();

  await expect(page.getByText('Choose a duration between 60 and 180 seconds.')).toBeVisible();
  await expect(page.getByText('Choose a spawn interval between 2 and 15 seconds.')).toBeVisible();

  await duration.fill('120');
  await spawn.fill('4');
  await page.getByLabel('Sound effects and ambience').uncheck();
  await page.getByRole('button', { name: 'SAVE' }).click();
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'OPTIONS' }).click();
  await expect(duration).toHaveValue('120');
  await expect(spawn).toHaveValue('4');
  await expect(page.getByLabel('Sound effects and ambience')).not.toBeChecked();
});

test('shows an asset failure and starts cleanly after retry', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__PIRATE_BATTLE_TEST__?.setAssetFailure(true);
  });
  await page.getByRole('button', { name: 'PLAY' }).click();

  await expect(page.getByText('The game assets could not be loaded.')).toBeVisible({
    timeout: 15_000,
  });
  await page.evaluate(() => {
    window.__PIRATE_BATTLE_TEST__?.setAssetFailure(false);
  });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByLabel('Match status')).toBeVisible({ timeout: 15_000 });

  const snapshot = await gameSnapshot(page);
  expect(snapshot.state.player.health).toBe(100);
  expect(snapshot.state.score).toBe(0);
});

test('abandons combat without recording it and supports repeated navigation', async ({ page }) => {
  await openApp(page);

  for (let cycle = 0; cycle < 2; cycle += 1) {
    await startGame(page);
    await page.getByRole('button', { name: 'Pause game' }).click();
    await page.getByRole('button', { name: 'MAIN MENU' }).click();
    await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();
  }

  const storedResult = await page.evaluate(() =>
    localStorage.getItem('pirate-battle:last-result:v1'),
  );
  expect(storedResult).toBeNull();
});

test('auto sail lets touch players move and fire without holding two buttons', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile-only touch behavior.');
  await openApp(page);
  await startGame(page);

  const autoSail = page.getByRole('button', { name: 'Auto sail' });
  const cannon = page.getByRole('button', { name: 'Fire front cannon' });
  await autoSail.click();
  await expect(autoSail).toHaveAttribute('aria-pressed', 'true');

  const before = await gameSnapshot(page);
  const cannonBox = await cannon.boundingBox();
  expect(cannonBox).not.toBeNull();
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      {
        x: cannonBox!.x + cannonBox!.width / 2,
        y: cannonBox!.y + cannonBox!.height / 2,
        id: 1,
      },
    ],
  });
  const during = await advanceGame(page, 0.2);
  await devtools.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  expect(during.state.player.x).toBeGreaterThan(before.state.player.x);
  expect(during.state.projectiles.some((projectile) => projectile.owner === 'player')).toBe(true);

  await autoSail.click();
  await expect(autoSail).toHaveAttribute('aria-pressed', 'false');
  const stopped = await gameSnapshot(page);
  const afterStop = await advanceGame(page, 0.2);
  expect(afterStop.state.player.x).toBeCloseTo(stopped.state.player.x, 4);
});
