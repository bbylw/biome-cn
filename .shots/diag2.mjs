import { createRequire } from 'node:module';
const require = createRequire('C:/Users/bbylw/.pwl/noop.js');
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8199/guides/getting-started/', { waitUntil: 'networkidle' });
const snap = async (tag) => {
  const s = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('[data-tabs]')].map(g => ({
      key: g.getAttribute('data-tabs'),
      btns: [...g.querySelectorAll('.tabs__btn')].map(b => `${b.dataset.label}${b.getAttribute('aria-selected') === 'true' ? '*' : ''}`),
      vis: [...g.querySelectorAll('.tabs__panel')].filter(p => !p.hidden).map(p => p.dataset.label),
      pres: g.querySelectorAll('pre').length,
      visPres: [...g.querySelectorAll('.tabs__panel:not([hidden]) pre')].length,
      disp: getComputedStyle(g.querySelector('.tabs__panel:not([hidden]) pre') ?? document.body).display,
    }));
    return groups;
  });
  console.log(tag, JSON.stringify(s, null, 1));
};
await snap('before');
await page.locator('.tabs__btn', { hasText: 'pnpm' }).first().click();
await page.waitForTimeout(200);
await snap('after pnpm');
await browser.close();
