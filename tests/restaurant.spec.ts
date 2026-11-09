import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('complete a pizza order, collect words and persist the wallet', async ({ page }) => {
  await mkdir('artifacts', { recursive: true });
  const errors: string[] = [];
  const failedResponses: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto('/?recipe=pizza&delay=0');
  await expect(page.getByTestId('start-game')).toBeEnabled();
  await page.locator('.welcome-card').evaluate((card) => Promise.all(card.getAnimations().map((animation) => animation.finished)));
  await page.screenshot({ path: 'artifacts/01-welcome.png' });
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('order-modal')).toBeHidden();
  await expect(page.getByTestId('current-task')).toContainText('点击柜台前的客人');
  const guestControl = page.getByRole('button', { name: '点击客人点餐', exact: true });
  await expect(guestControl).toBeEnabled();
  await guestControl.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('order-modal')).toBeVisible();
  await expect(page.locator('#order-sentence')).toHaveText('“I want pizza, please.”');
  await page.getByTestId('confirm-order').click();
  await expect(page.getByTestId('current-task')).toContainText('取面包');
  await page.screenshot({ path: 'artifacts/20-counter-assets.png' });

  await page.mouse.click(220, 215);
  await expect(page.getByTestId('fridge-modal')).toBeVisible();
  await page.screenshot({ path: 'artifacts/02-fridge.png' });
  for (const ingredient of ['bread', 'tomato', 'cheese']) {
    await page.getByTestId(`ingredient-${ingredient}`).click();
    await page.waitForTimeout(750);
  }
  await expect(page.getByTestId('fridge-modal')).toBeHidden();

  await page.mouse.click(500, 82);
  await expect(page.getByTestId('current-task')).toContainText('烤箱', { timeout: 20000 });
  await page.screenshot({ path: 'artifacts/09-pizza-ready-oven.png' });
  await page.mouse.click(930, 235);
  await expect(page.getByTestId('current-task')).toContainText('把菜端给', { timeout: 20000 });
  await page.screenshot({ path: 'artifacts/03-cooking.png' });

  await page.mouse.click(270, 600);
  await expect(page.locator('#coin-count')).toHaveText('130', { timeout: 35000 });
  await expect(page.locator('#word-count')).toHaveText('6/12');
  await page.screenshot({ path: 'artifacts/04-order-complete.png' });
  // The next guest also waits at the counter until explicitly activated.
  await expect(page.getByTestId('current-task')).toContainText('点击柜台前的客人', { timeout: 20000 });
  await expect(page.getByTestId('order-modal')).toBeHidden();
  await expect(guestControl).toBeEnabled();
  await guestControl.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('order-modal')).toBeVisible();
  await page.getByTestId('confirm-order').click();
  await page.locator('#wordbook-button').click();
  await expect(page.getByTestId('wordbook-modal')).toBeVisible();
  await expect(page.locator('.word-card:not(:disabled)')).toHaveCount(6);
  await page.screenshot({ path: 'artifacts/05-wordbook.png' });
  await page.locator('#wordbook-close').click();

  await page.reload();
  await expect(page.getByTestId('start-game')).toBeEnabled();
  await expect(page.locator('#coin-count')).toHaveText('130');
  await expect(page.locator('#word-count')).toHaveText('6/12');
  expect(errors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('iPad landscape layout and sound control', async ({ page }) => {
  await mkdir('artifacts', { recursive: true });
  await page.setViewportSize({ width: 1366, height: 1024 });
  await page.goto('/?recipe=fruit_salad&delay=0');
  await expect(page.getByTestId('start-game')).toBeEnabled();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('current-task')).toContainText('点击柜台前的客人');
  const gameCanvas = await page.locator('canvas').boundingBox();
  expect(gameCanvas).not.toBeNull();
  await page.mouse.click(gameCanvas!.x + 480 * gameCanvas!.width / 1200, gameCanvas!.y + 500 * gameCanvas!.height / 900);
  await expect(page.getByTestId('order-modal')).toBeVisible();
  await expect(page.locator('#order-sentence')).toHaveText('“I want fruit salad, please.”');
  await page.getByTestId('confirm-order').click();
  await page.locator('#sound-button').click();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-label', '打开声音');
  await page.screenshot({ path: 'artifacts/06-ipad-landscape.png' });
  const canvas = await page.locator('canvas').boundingBox();
  expect(canvas).not.toBeNull();
  expect(canvas!.width / canvas!.height).toBeCloseTo(4 / 3, 2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight);
  expect(overflow).toBe(false);
});
