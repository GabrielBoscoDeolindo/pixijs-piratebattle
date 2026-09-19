import { expect, test, type Page } from '@playwright/test';
import { finishByTime, openApp, startGame } from './helpers';

async function expectButtonTextInsideBounds(page: Page): Promise<void> {
  const overflow = await page.locator('button:visible').evaluateAll((buttons) =>
    buttons.flatMap((button) => {
      const text = (button.textContent ?? '').trim();
      if (!text) return [];

      const buttonBounds = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button);
      const contentBounds = range.getBoundingClientRect();
      const leaks =
        contentBounds.left < buttonBounds.left - 1 ||
        contentBounds.right > buttonBounds.right + 1 ||
        contentBounds.top < buttonBounds.top - 1 ||
        contentBounds.bottom > buttonBounds.bottom + 1;

      return leaks ? [{ text, buttonBounds, contentBounds }] : [];
    }),
  );

  expect(overflow).toEqual([]);
}

test('main menu visual baseline', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'MATCH HISTORY' })).toBeInViewport();
  await expect(page).toHaveScreenshot('main-menu.png');
});

test('stable arena visual baseline', async ({ page }) => {
  await openApp(page);
  await startGame(page);
  await expect(page).toHaveScreenshot('arena.png', {
    mask: [page.getByLabel('Frames per second')],
  });
});

test('result screen visual baseline', async ({ page }) => {
  await openApp(page);
  await startGame(page);
  await finishByTime(page);
  await expect(page.getByText('Voyage recorded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'PLAY AGAIN' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'MAIN MENU' })).toBeInViewport();
  await expect(page).toHaveScreenshot('result.png');
});

test('mobile landscape supporting screens fit the viewport', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile landscape regression.');
  await openApp(page);

  await page.getByRole('button', { name: 'OPTIONS' }).click();
  await expect(page.getByRole('button', { name: 'SAVE' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'CANCEL' })).toBeInViewport();
  await expect(page).toHaveScreenshot('options-landscape.png');

  await page.getByRole('button', { name: 'CANCEL' }).click();
  await page.getByRole('button', { name: 'RANKING' }).click();
  await expect(page.locator('.ranking-list')).toBeVisible();
  await expect(page.getByRole('button', { name: 'MAIN MENU' })).toBeInViewport();
  await expect(page).toHaveScreenshot('ranking-landscape.png');

  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await page.getByRole('button', { name: 'MATCH HISTORY' }).click();
  await expect(page.getByText('No completed voyages yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'MAIN MENU' })).toBeInViewport();
  await expect(page).toHaveScreenshot('history-landscape.png');

  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await startGame(page);
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.getByRole('button', { name: 'RESUME' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'MAIN MENU' })).toBeInViewport();
  await expect(page).toHaveScreenshot('pause-landscape.png', {
    mask: [page.getByLabel('Frames per second')],
  });
});

test('compact mobile landscape contains labels and exposes auto sail', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile landscape regression.');
  await page.setViewportSize({ width: 667, height: 375 });
  await openApp(page);
  await expectButtonTextInsideBounds(page);

  await page.getByRole('button', { name: 'OPTIONS' }).click();
  await expectButtonTextInsideBounds(page);
  await page.getByRole('button', { name: 'CANCEL' }).click();

  await startGame(page);
  const autoSail = page.getByRole('button', { name: 'Auto sail' });
  await expect(autoSail).toBeInViewport();
  await expect(autoSail).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Pause game' }).click();
  await expectButtonTextInsideBounds(page);
});
