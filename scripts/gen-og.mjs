// 由 public/og.html 渲染 1200×630 的 og.png（file:// 直读，字体走 @fontsource 本地文件）
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire('C:/Users/bbylw/.pwl/noop.js');
const { chromium } = require('playwright-core');

const src = path.resolve('public/og.html');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto('file:///' + src.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('public/og.png 已生成');
