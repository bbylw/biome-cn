// 交互回归：主题、标签页、复制、搜索、抽屉、TOC、无 JS 退化
import { createRequire } from 'node:module';

const require = createRequire('C:/Users/bbylw/.pwl/noop.js');
const { chromium } = require('playwright-core');
const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:' + (process.env.PORT || 8199);

const fail = [];
const ok = [];
const check = (name, cond, extra = '') => (cond ? ok : fail).push(`${name}${extra ? ' :: ' + extra : ''}`);

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

/* ---------- 1. 交互（真实动效环境） ---------- */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
await ctx.addInitScript(() => { try { localStorage.setItem('biome-cn:theme', 'light'); } catch {} });
await page.goto(BASE + '/guides/getting-started/', { waitUntil: 'load' });

// 主题切换
const t0 = await page.evaluate(() => document.documentElement.dataset.theme);
await page.click('[data-theme-toggle]');
const t1 = await page.evaluate(() => document.documentElement.dataset.theme);
check('主题切换', t0 === 'light' && t1 === 'dark', `${t0}→${t1}`);
await page.click('[data-theme-toggle]');

// 标签页：默认 npm，点 pnpm 生效，且跨标签组同步
const tabState = async () => page.evaluate(() => {
  const btns = [...document.querySelectorAll('.tabs__btn')];
  const sel = btns.filter(b => b.getAttribute('aria-selected') === 'true').map(b => b.dataset.label);
  const visible = [...document.querySelectorAll('.tabs__panel')].filter(p => !p.hidden).length;
  const total = document.querySelectorAll('.tabs__panel').length;
  return { sel, visible, total };
});
const before = await tabState();
check('标签页初始为 npm', before.sel.every(s => s === 'npm'), JSON.stringify(before.sel));
check('每组仅一个面板可见', before.visible === before.total / 5, `${before.visible}/${before.total}`);
await page.locator('.tabs__btn', { hasText: 'pnpm' }).first().click();
const after = await tabState();
check('切到 pnpm 全组同步', after.sel.length > 0 && after.sel.every(s => s === 'pnpm'), JSON.stringify(after.sel));
const code = (await page.locator('.tabs__panel:not([hidden]) pre').allInnerTexts()).join('\n');
check('pnpm 面板内容正确', code.includes('pnpm add -D -E @biomejs/biome') && code.includes('pnpx @biomejs/biome'), code.split('\n')[0]);

// 复制按钮存在且可点
await page.evaluate(() => navigator.clipboard?.writeText(''));
const copyCount = await page.locator('.codeblock .code-copy').count();
check('代码块复制按钮', copyCount >= 5, String(copyCount));

// 搜索：Ctrl+K 打开、有结果、回车可达
await page.keyboard.press('Control+k');
await page.waitForTimeout(120);
const dlgOpen = await page.evaluate(() => !document.querySelector('.find__dlg').hidden);
check('Ctrl+K 打开搜索', dlgOpen);
await page.fill('#find-input', 'indentStyle');
await page.waitForTimeout(400);
const hits = await page.locator('.find__results a').count();
check('搜索命中', hits > 0, `${hits} 条`);
const firstHref = await page.locator('.find__results a').first().getAttribute('href');
await page.locator('.find__results a').first().click();
await page.waitForTimeout(400);
check('搜索结果跳转', page.url().includes(firstHref.replace(/\/$/, '')), page.url());

// TOC 目录锚点全部存在
const tocBad = await page.evaluate(() => {
  return [...document.querySelectorAll('.rail--toc a[href^="#"]')]
    .map(a => a.getAttribute('href').slice(1))
    .filter(id => !document.getElementById(id));
});
check('本页目录锚点齐全', tocBad.length === 0, tocBad.join(','));

// 正文代码块无横向溢出容器
const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('桌面宽度无横向溢出', hOverflow <= 0, `${hOverflow}px`);

/* ---------- 2. 窄屏抽屉 ---------- */
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const mp = await m.newPage();
await mp.goto(BASE + '/formatter/', { waitUntil: 'load' });
const mobOverflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('移动宽度无横向溢出', mobOverflow <= 0, `${mobOverflow}px`);
await mp.click('[data-rail-toggle]');
await mp.waitForTimeout(360);
const railOpen = await mp.evaluate(() => document.documentElement.dataset.rail);
check('移动抽屉可打开', railOpen === 'open', String(railOpen));
await mp.keyboard.press('Escape');
await mp.waitForTimeout(360);
check('Esc 关闭抽屉', (await mp.evaluate(() => document.documentElement.dataset.rail)) === 'close');
const copyHiddenMob = await mp.locator('[data-rail-toggle]').isVisible();
check('移动有目录按钮', copyHiddenMob);

/* ---------- 3. 无 JS 退化 ---------- */
const nj = await browser.newContext({ viewport: { width: 1100, height: 900 }, javaScriptEnabled: false });
const np = await nj.newPage();
await np.goto(BASE + '/guides/getting-started/', { waitUntil: 'load' });
await np.screenshot({ path: '.shots/out/nojs-getting-started.png', fullPage: true });
const njText = await np.locator('body').innerText();
check('无 JS 仍含五种包管理器命令', ['npm i -D', 'pnpm add -D', 'bunx --bun', 'deno run -A', 'yarn exec'].every(k => njText.includes(k)));
check('无 JS 仍有正文与代码', njText.includes('biome.json') && njText.length > 1500, `${njText.length} 字`);
const njVis = await np.locator('.tabs__panel:not([hidden])').count();
check('无 JS 时所有面板展开', njVis === 15, String(njVis));

await browser.close();
console.log('通过：\n  ' + ok.join('\n  '));
if (fail.length) { console.log('\n失败：\n  ' + fail.join('\n  ')); process.exitCode = 1; }
else console.log('\n全部交互回归通过');
