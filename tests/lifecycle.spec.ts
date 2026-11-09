import { test, expect } from '@playwright/test';

test('audio and speech restrictions never block starting an order', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: class { constructor() { throw new Error('Audio is restricted'); } },
    });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
  });
  await page.goto('/?recipe=pizza&delay=0');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('current-task')).toContainText('点击柜台前的客人');
  const guestControl = page.getByRole('button', { name: '点击客人点餐', exact: true });
  await expect(guestControl).toBeEnabled();
  await guestControl.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('order-modal')).toBeVisible();
  await page.getByTestId('confirm-order').click();
  await expect(page.getByTestId('current-task')).toContainText('取面包');
  expect(errors).toEqual([]);
});

test('visibility changes suspend and resume audio and the scene safely', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const lifecycle = { resumeCalls: 0, suspendCalls: 0, hidden: false };
    (window as unknown as { __audioLifecycle: typeof lifecycle }).__audioLifecycle = lifecycle;
    const parameter = () => ({ setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined });
    const node = () => ({ connect: () => undefined, disconnect: () => undefined });
    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      resume() { lifecycle.resumeCalls += 1; return Promise.resolve(); }
      suspend() { lifecycle.suspendCalls += 1; return Promise.resolve(); }
      createOscillator() {
        return { ...node(), frequency: parameter(), start: () => undefined, stop: () => undefined };
      }
      createGain() { return { ...node(), gain: parameter() }; }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => lifecycle.hidden });
  });
  await page.goto('/?recipe=pizza&delay=0');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('current-task')).toContainText('点击柜台前的客人');
  await page.evaluate(() => {
    (window as unknown as { __audioLifecycle: { hidden: boolean } }).__audioLifecycle.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => (window as unknown as { __audioLifecycle: { suspendCalls: number } }).__audioLifecycle.suspendCalls === 1);
  await page.evaluate(() => {
    (window as unknown as { __audioLifecycle: { hidden: boolean } }).__audioLifecycle.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => (window as unknown as { __audioLifecycle: { resumeCalls: number } }).__audioLifecycle.resumeCalls >= 2);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.mouse.click(480, 500);
  await expect(page.getByTestId('order-modal')).toBeVisible();
  expect(errors).toEqual([]);
});
