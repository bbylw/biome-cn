// 找出移动宽度下造成横向溢出的元素
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/bbylw/.pwl/noop.js');
const { chromium } = require('playwright-core');

const PAGES = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/formatter/', '/guides/getting-started/', '/linter/domains/', '/reference/cli/', '/reference/configuration/', '/assist/javascript/actions/', '/internals/people-and-credits/', '/recipes/gritql-plugins/', '/nope/'];
const W = Number(process.env.W || 390);

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, reducedMotion: 'reduce' });
for (const p of PAGES) {
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8199' + p, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  const res = await page.evaluate((vw) => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') continue;
      if (r.right > vw + 1 || r.left < -1) {
        // 只报告没有可滚动祖先的（能横向滚的容器不算溢出）
        let a = el.parentElement, scrollable = false;
        while (a) {
          const s = getComputedStyle(a);
          if (/(auto|scroll)/.test(s.overflowX)) { scrollable = true; break; }
          a = a.parentElement;
        }
        if (!scrollable) bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').join('.')} right=${Math.round(r.right)} left=${Math.round(r.left)}`);
      }
    }
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bad: [...new Set(bad)].slice(0, 6) };
  }, W);
  console.log(`\n${p}  scrollWidth=${res.sw} client=${res.cw}`);
  if (res.bad.length) console.log('  ' + res.bad.join('\n  '));
  await page.close();
}
await browser.close();
