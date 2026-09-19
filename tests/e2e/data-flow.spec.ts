import { expect, test } from '@playwright/test';
import type { MatchRecord, PlayerIdentity, StoredMatchResult } from '../../src/api/contracts';
import {
  finishByTime,
  openApp,
  readStorage,
  setNetworkScenario,
  startGame,
} from './helpers';

const PLAYER_KEY = 'pirate-battle:player:v1';
const PENDING_KEY = 'pirate-battle:pending-matches:v1';
const CONFIRMED_KEY = 'pirate-battle:mock-confirmed-matches:v1';

test('paginates ranking and exposes loading, empty, error, and retry states', async ({ page }) => {
  await openApp(page);
  await setNetworkScenario(page, 'slow');
  await page.getByRole('button', { name: 'RANKING' }).click();
  await expect(page.getByText('Loading captains…')).toBeVisible();
  await expect(page.locator('.ranking-list li')).toHaveCount(5);
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'NEXT' }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await expect(page.locator('.ranking-list li')).toHaveCount(3);

  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await setNetworkScenario(page, 'empty');
  await page.getByRole('button', { name: 'RANKING' }).click();
  await expect(page.getByText('No completed voyages for this configuration.')).toBeVisible();

  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await setNetworkScenario(page, 'rankingError');
  await page.getByRole('button', { name: 'RANKING' }).click();
  await expect(page.getByText('Ranking could not be loaded.')).toBeVisible();
  await setNetworkScenario(page, 'success');
  await page.getByRole('button', { name: 'TRY AGAIN' }).click();
  await expect(page.locator('.ranking-list li')).toHaveCount(5);
});

test('shows empty and error history states and recovers through retry', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'MATCH HISTORY' }).click();
  await expect(page.getByText('No completed voyages yet.')).toBeVisible();

  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await setNetworkScenario(page, 'historyError');
  await page.getByRole('button', { name: 'MATCH HISTORY' }).click();
  await expect(page.getByText('Match history could not be loaded.')).toBeVisible();
  await setNetworkScenario(page, 'success');
  await page.getByRole('button', { name: 'TRY AGAIN' }).click();
  await expect(page.getByText('No completed voyages yet.')).toBeVisible();
});

test('records one completed match and refreshes history and ranking', async ({ page }) => {
  await openApp(page);
  const player = await readStorage<PlayerIdentity>(page, PLAYER_KEY);
  expect(player).not.toBeNull();
  await startGame(page);
  await finishByTime(page);
  await expect(page.getByText('Voyage recorded')).toBeVisible();

  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await page.getByRole('button', { name: 'MATCH HISTORY' }).click();
  await expect(page.locator('.history-list li')).toHaveCount(1);
  await expect(page.getByText('0 pts')).toBeVisible();

  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await page.getByRole('button', { name: 'RANKING' }).click();
  await page.getByRole('button', { name: 'NEXT' }).click();
  await expect(page.getByText(player!.name)).toBeVisible();

  const confirmed = await readStorage<MatchRecord[]>(page, CONFIRMED_KEY);
  expect(confirmed).toHaveLength(1);
});

test('preserves an unavailable submission through refresh and syncs it later', async ({ page }) => {
  await openApp(page);
  await setNetworkScenario(page, 'submitUnavailable');
  await startGame(page);
  await finishByTime(page);
  await expect(page.getByText('Submission failed')).toBeVisible();

  const pendingBefore = await readStorage<StoredMatchResult[]>(page, PENDING_KEY);
  expect(pendingBefore).toHaveLength(1);
  await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
  await expect(page.getByLabel('Match status')).toBeVisible();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('button', { name: 'MAIN MENU' }).click();

  await setNetworkScenario(page, 'success');
  await page.reload();
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key) ?? '[]').length === 0,
    PENDING_KEY,
  );
  const confirmed = await readStorage<MatchRecord[]>(page, CONFIRMED_KEY);
  expect(confirmed).toHaveLength(1);
});

test('recovers from a timeout after commit without duplicating the match', async ({ page }) => {
  await openApp(page);
  await setNetworkScenario(page, 'submitTimeoutAfterCommit');
  await startGame(page);
  await finishByTime(page);
  await expect(page.getByText('Voyage recorded')).toBeVisible({ timeout: 5_000 });

  const confirmed = await readStorage<MatchRecord[]>(page, CONFIRMED_KEY);
  expect(confirmed).toHaveLength(1);
  expect(new Set(confirmed!.map((match) => match.matchId)).size).toBe(1);
  expect(await readStorage<StoredMatchResult[]>(page, PENDING_KEY)).toHaveLength(0);
});

test('produces deterministic out-of-order responses without mixing payloads', async ({ page }) => {
  await openApp(page);
  await setNetworkScenario(page, 'outOfOrder');

  const completionOrder = await page.evaluate(async () => {
    const order: number[] = [];
    const request = (pageNumber: number) =>
      fetch(`/api/ranking?durationSeconds=90&spawnIntervalSeconds=6&page=${pageNumber}&pageSize=5`)
        .then((response) => response.json())
        .then((payload: { page: number }) => {
          order.push(payload.page);
          return payload;
        });
    const first = request(1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = request(2);
    const [pageOne, pageTwo] = await Promise.all([first, second]);
    return { order, pageOne: pageOne.page, pageTwo: pageTwo.page };
  });

  expect(completionOrder.order).toEqual([2, 1]);
  expect(completionOrder.pageOne).toBe(1);
  expect(completionOrder.pageTwo).toBe(2);
});
