import { test, expect } from '@playwright/test';

test('keyboard scene controls, dialog focus trap and Escape recovery', async ({ page }) => {
  await page.goto('/?recipe=pizza&delay=0');
  await page.getByTestId('start-game').click();
  const guestControl = page.getByRole('button', { name: '点击客人点餐', exact: true });
  await expect(guestControl).toBeEnabled();
  await guestControl.focus();
  await page.keyboard.press('Enter');

  const orderDialog = page.getByRole('dialog', { name: '客人点餐' });
  await expect(orderDialog).toBeVisible();
  const confirm = page.getByTestId('confirm-order');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#order-replay')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await confirm.click();

  const fridgeControl = page.getByRole('button', { name: '打开冰箱', exact: true });
  await expect(fridgeControl).toBeEnabled();
  await fridgeControl.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '冰箱食材' })).toBeVisible();
  await expect(page.getByTestId('ingredient-bread')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('fridge-modal')).toBeHidden();
  await expect(fridgeControl).toBeFocused();

  await page.keyboard.press('Enter');
  await page.getByTestId('ingredient-bread').click();
  await expect(page.getByTestId('ingredient-tomato')).toBeFocused();
  await page.keyboard.press('Escape');

  await page.locator('#wordbook-button').click();
  await expect(page.getByRole('dialog', { name: '英语单词收集册' })).toBeVisible();
  await expect(page.locator('#wordbook-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#wordbook-modal')).toBeHidden();
  await expect(page.locator('#wordbook-button')).toBeFocused();

  await page.locator('#reset-button').click();
  await expect(page.getByRole('dialog', { name: '确认重新开始' })).toBeVisible();
  await expect(page.locator('#reset-cancel')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#reset-modal')).toBeHidden();
  await expect(page.locator('#reset-button')).toBeFocused();
});
