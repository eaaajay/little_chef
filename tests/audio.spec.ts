import { test, expect } from '@playwright/test';

test('uses system TTS and calm music without requesting legacy voice assets', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: { text: string; rate: number; lang: string }[] = [];
    (window as unknown as { __spoken: typeof spoken }).__spoken = spoken;
    window.speechSynthesis.speak = (utterance) => {
      spoken.push({ text: utterance.text, rate: utterance.rate, lang: utterance.lang });
    };
    const NativeAudio = window.Audio;
    const media: HTMLAudioElement[] = [];
    (window as unknown as { __media: typeof media }).__media = media;
    window.Audio = function (...args) {
      const audio = new NativeAudio(...args);
      media.push(audio);
      return audio;
    } as typeof Audio;
  });
  const legacyAudioRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/\.(mp3|wav)(\?|$)/.test(url) && !url.endsWith('kitchen_loop_calm.mp3')) legacyAudioRequests.push(url);
  });

  await page.goto('/?recipe=fruit_salad&delay=0');
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('current-task')).toContainText('点击柜台前的客人');
  await expect(async () => {
    await page.mouse.click(480, 500);
    await expect(page.getByTestId('order-modal')).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 15000 });
  await page.waitForFunction(() => (window as unknown as { __spoken: { text: string }[] }).__spoken.some((item) => item.text === 'I want fruit salad, please.'));
  const orderSpeech = await page.evaluate(() => (window as unknown as { __spoken: { text: string; rate: number; lang: string }[] }).__spoken);
  expect(orderSpeech.some((item) => item.text === 'I want fruit salad, please.' && Math.abs(item.rate - 0.82) < 0.00001)).toBe(true);

  // Two immediate replay clicks must produce only one additional utterance.
  await page.waitForTimeout(650);
  await page.locator('#order-replay').click();
  await page.locator('#order-replay').click();
  await page.waitForTimeout(180);
  const afterReplay = await page.evaluate(() => (window as unknown as { __spoken: { text: string }[] }).__spoken);
  expect(afterReplay.filter((item) => item.text === 'I want fruit salad, please.')).toHaveLength(2);

  await page.getByTestId('confirm-order').click();
  await page.mouse.click(220, 215);
  await expect(page.getByTestId('fridge-modal')).toBeVisible();
  await page.getByTestId('ingredient-apple').click();
  await page.waitForFunction(() => (window as unknown as { __spoken: { text: string }[] }).__spoken.some((item) => item.text === 'apple'));
  const wordSpeech = await page.evaluate(() => (window as unknown as { __spoken: { text: string; rate: number; lang: string }[] }).__spoken);
  expect(wordSpeech.some((item) => item.text === 'apple' && Math.abs(item.rate - 0.82) < 0.00001)).toBe(true);

  const media = await page.evaluate(() => (window as unknown as { __media: HTMLAudioElement[] }).__media.map((audio) => ({ src: audio.src, rate: audio.playbackRate })));
  expect(media.some((item) => item.src.endsWith('kitchen_loop_calm.mp3') && item.rate === 1)).toBe(true);
  expect(legacyAudioRequests).toEqual([]);
});
