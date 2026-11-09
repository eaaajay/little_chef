import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

test('phone landscape keeps touch targets usable and opens touch dialogs', async ({ page }) => {
  await page.goto('/?recipe=pizza&delay=0');
  await page.getByTestId('start-game').tap();
  await expect(page.getByTestId('current-task')).toContainText('点击柜台前的客人');
  const canvas = await page.locator('canvas').boundingBox();
  expect(canvas).not.toBeNull();
  await page.touchscreen.tap(canvas!.x + 480 * canvas!.width / 1200, canvas!.y + 500 * canvas!.height / 900);
  await expect(page.getByTestId('order-modal')).toBeVisible();
  await page.locator('.order-dialog').evaluate((dialog) => Promise.all(dialog.getAnimations().map((animation) => animation.finished)));

  const confirmBox = await page.getByTestId('confirm-order').boundingBox();
  expect(confirmBox!.height).toBeGreaterThanOrEqual(44);
  await page.getByTestId('confirm-order').tap();
  for (const selector of ['#sound-button', '#wordbook-button', '#reset-button']) {
    const box = await page.locator(selector).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await page.locator('#wordbook-button').tap();
  await expect(page.getByRole('dialog', { name: '英语单词收集册' })).toBeVisible();
  const closeBox = await page.locator('#wordbook-close').boundingBox();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight);
  expect(overflow).toBe(false);
});
