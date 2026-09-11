// 从 @phosphor-icons/web 抽出站内实际用到的图标，生成最小 phosphor.css
// （官方整包会连带 ttf/svg 共 3.9MB，这里只保留一个 woff2 与用到的 20 个字形）
import { readFileSync, writeFileSync } from 'node:fs';

const CSS = 'node_modules/@phosphor-icons/web/src/regular/style.css';
const USE = [
  'arrow-left', 'arrow-right', 'brackets-curly', 'check', 'check-circle', 'circle',
  'code', 'copy', 'file-code', 'gear', 'git-branch', 'info', 'keyboard', 'lightning',
  'list', 'magnifying-glass', 'moon', 'moon-stars', 'package', 'pencil-simple',
  'sun', 'terminal-window', 'warning', 'wrench', 'arrows-clockwise',
];

const src = readFileSync(CSS, 'utf8');
const found = new Map();
for (const m of src.matchAll(/\.ph\.ph-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-f]+)"/g)) found.set(m[1], m[2]);

const missing = USE.filter(u => !found.has(u));
const rules = USE.filter(u => found.has(u)).map(u => `.ph-${u}:before { content: "\\${found.get(u)}"; }`);

writeFileSync('src/styles/phosphor.css', `/* 自动生成，勿手改：node scripts/gen-icons.mjs */
@font-face {
  font-family: "Phosphor";
  src: url("/fonts/Phosphor-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
.ph {
  font-family: "Phosphor" !important;
  font-weight: normal;
  font-style: normal;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
}
${rules.join('\n')}
`, 'utf8');

console.log(`写入 src/styles/phosphor.css：${rules.length} 个图标${missing.length ? '，缺失 ' + missing.join(',') : ''}`);
