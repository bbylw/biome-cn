// 从 @phosphor-icons/web 的 SVG 字体中抽出站内实际用到的字形路径，
// 生成 src/styles/phosphor.css（mask 版图标，不再打包 147KB 的图标字体）。
//
// 为什么不用图标字体：
//   官方 woff2 是整族 3000+ 字形（147KB），本站只用 24 个。字体还会因
//   font-display: block 造成图标先空白后闪现。改成 mask + data-URI 后，
//   图标随 CSS 一起到达，可随 currentColor 变色、任意缩放不失真。
//
// 坐标：SVG 字体的 glyph 是 y 轴向上、基线在 0，ascent 之上为上边界；
//   因此渲染成 y 轴向下的 SVG 需要 translate(0, ascent) scale(1, -1)。
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'node_modules/@phosphor-icons/web/src/regular/Phosphor.svg';
const OUT = 'src/styles/phosphor.css';

// 站内用到的全部图标（来自 Icon.astro / Card.astro / Base.astro / Docs.astro / index.astro / docs.js）
const USE = [
  'arrow-left', 'arrow-right', 'arrows-clockwise', 'brackets-curly', 'check', 'check-circle',
  'circle', 'code', 'copy', 'gear', 'git-branch', 'info', 'keyboard', 'lightning', 'list',
  'magnifying-glass', 'moon', 'moon-stars', 'package', 'pencil-simple', 'sun',
  'terminal-window', 'warning', 'wrench',
];

const src = readFileSync(SRC, 'utf8');
const UPEM = Number(/\bunits-per-em="(\d+)"/.exec(src)?.[1] ?? 1024);
const ASCENT = Number(/\bascent="(-?\d+)"/.exec(src)?.[1] ?? UPEM);

/** glyph-name 可以是逗号分隔的别名，全部登记（首个出现的为准） */
const paths = new Map();
for (const m of src.matchAll(/<glyph\b[^>]*?>/g)) {
  const tag = m[0];
  const d = /\bd="([^"]*)"/.exec(tag)?.[1];
  if (!d) continue;
  const names = (/\bglyph-name="([^"]*)"/.exec(tag)?.[1] ?? '').split(',').map(s => s.trim()).filter(Boolean);
  for (const n of names) if (!paths.has(n)) paths.set(n, d);
}

const missing = USE.filter(u => !paths.has(u));

/**
 * 最小转义：只处理会截断 data-URI 或被 CSS 解析器误读的字符。
 * 整个 URL 用双引号包裹，因此空格与逗号可以原样保留（省下大量字节）。
 */
const encode = (s) => s
  .replace(/%/g, '%25')
  .replace(/</g, '%3C')
  .replace(/>/g, '%3E')
  .replace(/#/g, '%23')
  .replace(/"/g, '%22')
  .replace(/&/g, '%26');

/** 路径 → data-URI（只在 CSS 里用，做 mask，因此不需要颜色） */
function dataUri(d) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${UPEM} ${UPEM}">` +
    `<path transform="translate(0 ${ASCENT}) scale(1 -1)" d="${d}"/></svg>`;
  return `url("data:image/svg+xml,${encode(svg)}")`;
}

const rules = USE.filter(u => paths.has(u)).map(u => `.ph-${u} { --ph-i: ${dataUri(paths.get(u))}; }`);

writeFileSync(OUT, `/* 自动生成，勿手改：node scripts/gen-icons.mjs */
/* 图标以 mask 呈现：尺寸跟随 font-size（1em），颜色跟随 currentColor。 */
.ph {
  display: inline-block; width: 1em; height: 1em;
  vertical-align: -.125em; flex: none;
  background-color: currentColor;
  -webkit-mask: var(--ph-i) center / contain no-repeat;
  mask: var(--ph-i) center / contain no-repeat;
}
${rules.join('\n')}
`, 'utf8');

console.log(`写入 ${OUT}：${rules.length} 个图标${missing.length ? '，源字体缺失 ' + missing.join(',') : ''}`);
