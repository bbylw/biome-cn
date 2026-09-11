// 单页局部截图：看首屏与关键组件的实际观感
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire('C:/Users/bbylw/.pwl/noop.js');
const { chromium } = require('playwright-core');
mkdirSync('.shots/out/clip', { recursive: true });

const SHOTS = [
  ['/reference/configuration/', 'configuration', 'light', 1440, 0],
  ['/reference/configuration/', 'configuration-code', 'light', 1440, 1400],
  ['/reference/diagnostics/', 'diagnostics', 'dark', 1440, 200],
  ['/internals/people-and-credits/', 'people', 'light', 1440, 0],
  ['/assist/javascript/actions/', 'assist-actions', 'light', 1440, 0],
  ['/linter/domains/', 'domains', 'dark', 1440, 0],
  ['/', 'home-mob', 'light', 390, 0],
  ['/guides/getting-started/', 'gs-mob', 'dark', 390, 0],
  ['/formatter/differences-with-prettier/', 'diff-table', 'light', 1440, 0],
  ['/recipes/git-hooks/', 'hooks', 'light', 1440, 300],
];

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--force-prefers-reduced-motion'] });
for (const [path, name, theme, width, scroll] of SHOTS) {
  const h = width < 500 ? 844 : 900;
  const ctx = await browser.newContext({ viewport: { width, height: h }, reducedMotion: 'reduce' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('biome-cn:theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8199' + path, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  if (scroll) await page.evaluate(y => window.scrollTo(0, y), scroll);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `.shots/out/clip/${name}--${theme}-${width}.png` });
  await ctx.close();
}
await browser.close();
console.log('ok');
