import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function completeRecipe(page: Page, recipe: 'noodles' | 'fruit'): Promise<void> {
  const noodles = recipe === 'noodles';
  const id = noodles ? 'tomato_egg_noodles' : 'fruit_salad';
  const ingredients = noodles ? ['tomato', 'egg', 'noodles'] : ['apple', 'banana', 'grapes'];
  await page.goto(`/?recipe=${id}&delay=0`);
  await expect(page.getByTestId('start-game')).toBeEnabled();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('order-modal')).toBeHidden();
  await expect(page.getByTestId('current-task')).toContainText('点击柜台前的客人');
  const guestControl = page.getByRole('button', { name: '点击客人点餐', exact: true });
  await expect(guestControl).toBeEnabled();
  await guestControl.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('order-modal')).toBeVisible();
  await page.getByTestId('confirm-order').click();
  await page.mouse.click(220, 215);
  await expect(page.getByTestId('fridge-modal')).toBeVisible();

  // A wrong pick must not advance the order.
  await page.getByTestId(`ingredient-${ingredients[1]}`).click();
  await expect(page.getByTestId(`ingredient-${ingredients[0]}`)).toBeEnabled();
  await expect(page.getByTestId(`ingredient-${ingredients[0]}`)).toHaveClass(/target/);
  for (const ingredient of ingredients) {
    const button = page.getByTestId(`ingredient-${ingredient}`);
    await expect(button).toBeEnabled();
    await button.click();
  }
  await expect(page.getByTestId('fridge-modal')).toBeHidden();

  await page.screenshot({ path: `artifacts/${noodles ? '10-noodles-prep' : '11-fruit-prep'}.png` });
  await page.mouse.click(500, 82);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `artifacts/${noodles ? '14-noodles-knife-action' : '15-fruit-knife-action'}.png` });
  if (noodles) {
    await expect(page.getByTestId('current-task')).toContainText('灶台', { timeout: 20000 });
    await page.screenshot({ path: 'artifacts/12-noodles-pot.png' });
    await page.mouse.click(710, 220);
    await page.waitForTimeout(550);
    await page.screenshot({ path: 'artifacts/16-noodles-boiling.png' });
  } else {
    await expect(page.getByTestId('current-task')).toContainText('把菜端给', { timeout: 20000 });
    await page.screenshot({ path: 'artifacts/13-fruit-bowl.png' });
  }
  await expect(page.getByTestId('current-task')).toContainText('把菜端给', { timeout: 20000 });

  // The dish belongs to table 1; another table cannot accept it.
  await page.mouse.click(930, 600);
  await expect(page.locator('#coin-count')).toHaveText('100');
  await expect(page.getByTestId('current-task')).toContainText('把菜端给');
  await page.mouse.click(270, 600);
  await expect(page.locator('#coin-count')).toHaveText(noodles ? '130' : '125', { timeout: 35000 });
  await expect(page.locator('#word-count')).toHaveText(noodles ? '6/12' : '5/12');
  await page.screenshot({ path: `artifacts/${noodles ? '07-noodles' : '08-fruit'}-complete.png` });
}

test('tomato egg noodles: wrong ingredient, boiling, wrong table and payment', async ({ page }) => {
  test.setTimeout(120000);
  await mkdir('artifacts', { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await completeRecipe(page, 'noodles');
  expect(errors).toEqual([]);
});

test('fruit salad: chopping without heating and exact payment', async ({ page }) => {
  test.setTimeout(120000);
  await mkdir('artifacts', { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await completeRecipe(page, 'fruit');
  expect(errors).toEqual([]);
});
