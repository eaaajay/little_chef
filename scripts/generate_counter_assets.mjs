import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = ['register-back', 'flower-vase', 'menu-stand', 'napkin-holder'];
const out = path.join(root, 'public', 'assets', 'counter');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setViewportSize({ width: 800, height: 800 });

for (const name of names) {
  const svg = await readFile(path.join(root, 'artwork', 'counter', `${name}.svg`), 'utf8');
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  const png = path.join(out, `${name}.png`);
  const webp = path.join(out, `${name}.webp`);
  await page.locator('svg').screenshot({ path: png, omitBackground: true });
  const python = process.env.PYTHON ?? 'python3';
  execFileSync(python, ['-c', 'from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=90, method=6)', png, webp]);
  console.log(`generated ${name}.png / ${name}.webp`);
}
await browser.close();
