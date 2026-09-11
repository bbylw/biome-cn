import { createRequire } from 'node:module';
const require = createRequire('C:/Users/bbylw/.pwl/noop.js');
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', r => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
await page.goto('http://127.0.0.1:8199/guides/getting-started/', { waitUntil: 'networkidle' });
console.log('scripts in page:', await page.evaluate(() => [...document.querySelectorAll('script')].map(s => s.src || 'inline')));
console.log('tabsBtns:', await page.locator('.tabs__btn').count(), 'panels:', await page.locator('.tabs__panel').count());
console.log('html classList:', await page.evaluate(() => document.documentElement.className));
console.log('logs:\n' + logs.join('\n'));
await browser.close();
