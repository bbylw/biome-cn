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
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
  permissions: ['clipboard-read', 'clipboard-write'],
});
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

// 复制按钮存在且真的写入剪贴板（脚本补的按钮曾因委托选择器不匹配而失效）
const copyCount = await page.locator('.codeblock .code-copy').count();
check('代码块复制按钮', copyCount >= 5, String(copyCount));
await page.evaluate(() => navigator.clipboard?.writeText(''));
// 只看当前可见面板里的按钮：未选中的标签面板是 hidden 的
await page.locator('.codeblock:visible .code-copy').first().click();
await page.waitForTimeout(200);
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
check('复制写入剪贴板', clip.trim().length > 0, clip.split('\n')[0].slice(0, 48));

// 标签页键盘：Home / End 直达首末项
await page.locator('.tabs__btn').first().focus();
await page.keyboard.press('End');
check('标签页 End 到末项', (await page.evaluate(() => document.activeElement?.dataset.label)) === 'yarn');
await page.keyboard.press('Home');
check('标签页 Home 到首项', (await page.evaluate(() => document.activeElement?.dataset.label)) === 'npm');

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

// 搜索键盘导航：↓ 选中当前项、Enter 跳过去
await page.keyboard.press('Control+k');
await page.waitForTimeout(200);
await page.fill('#find-input', 'indentStyle');
await page.waitForTimeout(400);
await page.keyboard.press('ArrowDown');
const activeId = await page.evaluate(() => document.activeElement?.getAttribute('aria-activedescendant'));
check('搜索 ↓ 标记当前项', !!activeId, String(activeId));
const activeHref = await page.evaluate((id) => document.getElementById(id)?.getAttribute('href'), activeId);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('搜索 Enter 直达命中节', page.url().includes(activeHref.split('#')[0].replace(/\/$/, '')), page.url());
const deepAnchor = await page.evaluate(() => location.hash.length > 1);
check('搜索深链带小节锚点', deepAnchor, await page.evaluate(() => location.hash));

// 焦点管理：打开时落在输入框，Esc 后回到触发按钮
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check('跳转后弹层自动收起', await page.evaluate(() => document.querySelector('.find__dlg').hidden));
await page.click('[data-find-open]');
await page.waitForTimeout(250);
check('打开后焦点在输入框', await page.evaluate(() => document.activeElement?.id === 'find-input'));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Esc 后焦点回触发按钮', await page.evaluate(() => document.activeElement?.hasAttribute('data-find-open')));
check('Esc 后弹层隐藏', await page.evaluate(() => document.querySelector('.find__dlg').hidden));

// 本页目录高亮随滚动推进（滚动扫描而非固定 rootMargin）
await page.goto(BASE + '/reference/cli/', { waitUntil: 'load' });
await page.waitForTimeout(300);
const tocAt = async () => page.evaluate(() => document.querySelector('.rail--toc a[aria-current="true"]')?.getAttribute('href') ?? null);
const tocTop = await tocAt();
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55));
await page.waitForTimeout(400);
const tocMid = await tocAt();
check('目录高亮随滚动变化', !!tocTop && !!tocMid && tocTop !== tocMid, `${tocTop} → ${tocMid}`);

// 图标：以 mask 内联路径呈现（不再依赖图标字体）
const icon = await page.evaluate(() => {
  const el = document.querySelector('.ph');
  if (!el) return null;
  const s = getComputedStyle(el);
  return { svgMask: `${s.maskImage || ''}${s.webkitMaskImage || ''}`.includes('data:image/svg+xml'), w: s.width };
});
check('图标走 mask 内联路径', !!icon?.svgMask, JSON.stringify(icon));

// ?q= 深链：结构化数据里的 SearchAction 指向该入口
await page.goto(BASE + '/?q=indentStyle', { waitUntil: 'load' });
await page.waitForTimeout(700);
check('?q= 直接打开搜索', await page.evaluate(() => !document.querySelector('.find__dlg').hidden));
check('?q= 有结果', (await page.locator('.find__results a').count()) > 0);
check('?q= 关键词已回填', (await page.inputValue('#find-input')) === 'indentStyle');

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
