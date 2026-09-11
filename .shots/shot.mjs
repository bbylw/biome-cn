// 截图矩阵：暗/亮 × 桌面/移动，全页截图供人工验收
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire('C:/Users/bbylw/.pwl/noop.js');
const { chromium } = require('playwright-core');

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:' + (process.env.PORT || 8199);
const OUT = '.shots/out';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['home', '/'],
  ['getting-started', '/guides/getting-started/'],
  ['formatter', '/formatter/'],
  ['linter', '/linter/'],
  ['domains', '/linter/domains/'],
  ['cli', '/reference/cli/'],
  ['configuration', '/reference/configuration/'],
  ['diagnostics', '/reference/diagnostics/'],
  ['assist', '/assist/'],
  ['vscode', '/reference/vscode/'],
  ['git-hooks', '/recipes/git-hooks/'],
  ['philosophy', '/internals/philosophy/'],
  ['people', '/internals/people-and-credits/'],
  ['notfound', '/no-such-page/'],
];

const VIEWPORTS = [['desk', 1440, 900], ['mob', 390, 844]];

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--force-prefers-reduced-motion'],
});
for (const [theme] of [['light', ''], ['dark', '']]) {
  for (const [vname, w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('biome-cn:theme', t); } catch {} }, theme);
    for (const [name, path] of PAGES) {
      const page = await ctx.newPage();
      await page.goto(BASE + path, { waitUntil: 'load' });
      await page.waitForTimeout(320);
      const file = `${OUT}/${name}--${theme}-${vname}.png`;
      await page.screenshot({ path: file, fullPage: name !== 'home' });
      if (name === 'home') await page.screenshot({ path: `${OUT}/home--${theme}-${vname}-full.png`, fullPage: true });
      const metrics = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        dark: document.documentElement.dataset.theme,
      }));
      console.log(`${name} ${theme} ${vname} overflow=${metrics.sw - metrics.cw}px theme=${metrics.dark}`);
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
console.log('done');
