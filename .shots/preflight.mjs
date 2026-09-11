// UI 定量检查：可见文本的行文硬约束、CTA 单行、文字对比度、hero 视口适配、各节布局族。
// 这些是「靠肉眼很难发现、但一改样式就可能回退」的项，例如浅色档 --muted 一度只有 4.43:1。
// 动效类断言请勿在此脚本里做：它用 reducedMotion: 'reduce' 打开页面，
// 而 reduce 下很多动效是刻意关闭的（例如文档页阅读进度条）。
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';

const require = createRequire('C:/Users/bbylw/.pwl/noop.js');
const { chromium } = require('playwright-core');
const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:' + (process.env.PORT || 8199);
const W = Number(process.env.W || 1440);
const THEME = process.env.THEME || 'light';

/* ---------- 1. 静态：破折号与单行多中间点（与 pipeline/glossary.md 同源） ---------- */
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.html')) files.push(p);
  }
})('dist');

const visibleText = (html) => html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ');

const dashHits = [];
const dotHits = [];
for (const f of files) {
  const text = visibleText(readFileSync(f, 'utf8'));
  const dashes = text.match(/[—–]/g);
  if (dashes) dashHits.push(`${f} ×${dashes.length}`);
  for (const line of text.split('\n')) {
    const dots = (line.match(/·/g) || []).length;
    if (dots > 1) dotHits.push(`${f} ×${dots}`);
  }
}
console.log('破折号（可见文本）:', dashHits.length ? dashHits.join(', ') : '0 处');
console.log('单行多中间点:', dotHits.length ? dotHits.join(', ') : '0 处');

/* ---------- 2. 运行时（首页） ---------- */
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const ctx = await browser.newContext({ viewport: { width: W, height: 900 }, reducedMotion: 'reduce' });
await ctx.addInitScript((t) => { try { localStorage.setItem('biome-cn:theme', t); } catch {} }, THEME);
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(400);

const report = await page.evaluate(() => {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const root = getComputedStyle(document.documentElement);
  const tok = (n) => {
    const v = root.getPropertyValue(n).trim();
    if (v.startsWith('#')) {
      const h = v.slice(1);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    return parse(v);
  };
  const bgOf = (el) => {
    let n = el;
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(c)) return parse(c);
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  // 行数取文本自身的矩形数：按钮高度含内边距，拿高度除以行高会得到假阳性
  const lineCount = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const tops = [...r.getClientRects()].filter(x => x.width > 1).map(x => Math.round(x.top));
    return new Set(tops).size;
  };

  const ctas = [...document.querySelectorAll('.btn')].map(b => {
    const cs = getComputedStyle(b);
    const fg = parse(cs.color);
    const grad = cs.backgroundImage.includes('gradient');
    return {
      text: b.textContent.trim(),
      lines: lineCount(b),
      contrast: +(grad ? Math.min(ratio(fg, tok('--brand-1')), ratio(fg, tok('--brand-2'))) : ratio(fg, bgOf(b))).toFixed(2),
    };
  });

  const samples = ['.prose p', '.fact span', '.tiles .note', '.lanes .cmd', '.find__btn', '.footer__note', '.run__steps .k', '.swap__row > span']
    .map(sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { sel, contrast: +ratio(parse(cs.color), bgOf(el)).toFixed(2), size: cs.fontSize };
    })
    .filter(Boolean);

  // SVG 内文字：这里有个专属的坑 —— 样式表里的 fill 会覆盖 SVG 的 fill 呈现属性。
  // 断面图里那条命令一度就被 .pipeline text{fill:var(--muted)} 盖成了低对比度。
  const svgSamples = [
    ['.pipeline .pl-cmd', '--term-bg', '断面图命令药丸'],
    ['.pipeline .pl-strong', '--paper', '断面图小标题'],
    ['.pipeline text:not(.pl-cmd):not(.pl-strong)', '--surface', '断面图常规标注'],
  ].map(([sel, bgTok, label]) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return { label, sel, contrast: +ratio(parse(getComputedStyle(el).fill), tok(bgTok)).toFixed(2), size: getComputedStyle(el).fontSize };
  }).filter(Boolean);

  const h1 = document.querySelector('.hero h1');
  const lede = document.querySelector('.hero__lede');
  const cta = document.querySelector('.hero__cta');
  const hero = {
    h1Lines: lineCount(h1),
    ledeLines: lineCount(lede),
    ledeChars: lede.textContent.trim().length,
    ctaBottom: Math.round(cta.getBoundingClientRect().bottom),
    viewportH: innerHeight,
    textEls: document.querySelectorAll('.hero > *').length,
  };

  const families = [...document.querySelectorAll('main > section')]
    .map(s => [...s.querySelectorAll('.wrap > *')].map(k => k.className.split(' ')[0]).join(','));

  return { ctas, samples, svgSamples, hero, families };
});

console.log(`\nCTA（${THEME} / ${W}px）单行与对比度（AA 正文 4.5）：`);
for (const c of report.ctas) console.log(`  ${c.lines === 1 ? '通过' : '换行!'}  对比度 ${c.contrast}  「${c.text}」`);

console.log('\n正文/小字对比度：');
for (const s of report.samples) console.log(`  ${s.contrast >= 4.5 ? '通过' : (s.contrast >= 3 ? '仅达大字标准' : '不足')}  ${s.contrast}  ${s.sel} (${s.size})`);

console.log('\nSVG 内文字对比度（font-size 小于 18.66px 一律按 4.5 要求）：');
for (const s of report.svgSamples) console.log(`  ${s.contrast >= 4.5 ? '通过' : '不足'}  ${s.contrast}  ${s.label} (${s.size})`);

console.log('\nHero 视口适配：');
console.log(`  h1 ${report.hero.h1Lines} 行（≤2）  导语 ${report.hero.ledeLines} 行 / ${report.hero.ledeChars} 字  CTA 底边 ${report.hero.ctaBottom}px / 视口 ${report.hero.viewportH}px  hero 直接子元素 ${report.hero.textEls}（≤4）`);

console.log('\n各节顶部布局族（同一族不应出现两次）：');
report.families.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

await browser.close();
