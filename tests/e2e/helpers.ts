import { expect, type Page } from '@playwright/test';
import type {
  GameSessionTestSetup,
  GameSessionTestSnapshot,
} from '../../src/game/GameSession';
import type { MockNetworkScenario } from '../../src/mocks/scenarios';
import type { PirateBattleBrowserTestApi } from '../../src/testing/browserTestApi';

declare global {
  interface Window {
    __PIRATE_BATTLE_TEST__?: PirateBattleBrowserTestApi;
  }
}

export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeVisible();
  await page.waitForFunction(() => window.__PIRATE_BATTLE_TEST__?.mockReady);
}

export async function setNetworkScenario(
  page: Page,
  scenario: MockNetworkScenario,
): Promise<void> {
  await page.evaluate((nextScenario) => {
    window.__PIRATE_BATTLE_TEST__?.setNetworkScenario(nextScenario);
  }, scenario);
}

export async function startGame(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => Boolean(window.__PIRATE_BATTLE_TEST__?.game));
  await expect(page.getByLabel('Match status')).toBeVisible();
}

export async function gameSnapshot(page: Page): Promise<GameSessionTestSnapshot> {
  return page.evaluate(() => {
    const game = window.__PIRATE_BATTLE_TEST__?.game;
    if (!game) throw new Error('Game test controller is unavailable.');
    return game.snapshot();
  });
}

export async function setupGame(
  page: Page,
  setup: GameSessionTestSetup,
): Promise<GameSessionTestSnapshot> {
  return page.evaluate((nextSetup) => {
    const game = window.__PIRATE_BATTLE_TEST__?.game;
    if (!game) throw new Error('Game test controller is unavailable.');
    return game.setup(nextSetup);
  }, setup);
}

export async function advanceGame(
  page: Page,
  seconds: number,
): Promise<GameSessionTestSnapshot> {
  return page.evaluate((duration) => {
    const game = window.__PIRATE_BATTLE_TEST__?.game;
    if (!game) throw new Error('Game test controller is unavailable.');
    return game.advance(duration);
  }, seconds);
}

export async function finishByTime(page: Page): Promise<void> {
  await setupGame(page, {
    enemies: [],
    clearProjectiles: true,
    clearEffects: true,
    match: { remainingSeconds: 0.02 },
  });
  await advanceGame(page, 0.05);
  await expect(page.getByRole('heading', { name: "Time's Up!" })).toBeVisible();
}

export async function readStorage<T>(page: Page, key: string): Promise<T | null> {
  return page.evaluate((storageKey) => {
    const value = localStorage.getItem(storageKey);
    return value ? JSON.parse(value) as T : null;
  }, key);
}
