/**
 * split.mjs — 把超大文档按二级标题边界切成若干份，供多个子代理并行翻译
 * 用法: node split.mjs <rel> <份数>
 * 产物: work/en/_split/<rel>.partN.mdx  (仅第一份带 frontmatter)
 *       work/parts.json 记录拼接顺序与每份的 anchors 切片
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const rel = process.argv[2];
const n = Number(process.argv[3] || 2);
if (!rel) { console.error('need rel'); process.exit(1); }

const src = readFileSync(path.join('work/en', rel), 'utf8');
const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
const fm = fmMatch ? fmMatch[0] : '';
const body = fmMatch ? src.slice(fm.length) : src;

const lines = body.split(/\r?\n/);
// 找出代码围栏外的顶层标题行（## 优先，不足则用 ###）
let level = 2;
let marks = lines.map((l, i) => ({ l, i })).filter(({ l }) => new RegExp(`^#{${level}}\\s`).test(l));
if (marks.length < n) { level = 3; marks = lines.map((l, i) => ({ l, i })).filter(({ l }) => /^#{3}\s/.test(l)); }

// 用累计字符长度选切点
const total = body.length;
const targets = Array.from({ length: n - 1 }, (_, k) => (total * (k + 1)) / n);
const cuts = [];
let cursor = 0;
let lastIdx = 0;
let fence = false;
const fenceAt = [];
{
  let f = null;
  for (const l of lines) {
    const open = /^\s{0,3}(`{3,}|~{3,})/.exec(l);
    if (f) { if (l.trimStart().startsWith(f)) f = null; fenceAt.push(!!f); }
    else { if (open) f = open[1]; fenceAt.push(!!f); }
  }
}

for (const t of targets) {
  let acc = 0, best = null;
  for (const m of marks) {
    if (m.i <= lastIdx) continue;
    if (fenceAt[m.i]) continue;
    acc = lines.slice(0, m.i).join('\n').length;
    if (best === null || Math.abs(acc - t) < Math.abs(best.acc - t)) best = { i: m.i, acc };
  }
  if (best) { cuts.push(best.i); lastIdx = best.i; }
}

const bounds = [0, ...cuts, lines.length];
mkdirSync(path.join('work/en/_split', path.dirname(rel)), { recursive: true });
const parts = [];
for (let k = 0; k < bounds.length - 1; k++) {
  const chunk = lines.slice(bounds[k], bounds[k + 1]).join('\n');
  const outPath = path.join('work/en/_split', `${rel}.part${k + 1}.mdx`);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, (k === 0 ? fm : '') + chunk, 'utf8');
  parts.push({ rel, part: k + 1, file: `_split/${rel}.part${k + 1}.mdx`, chars: chunk.length });
}

const pj = path.join('work', 'parts.json');
const all = (() => { try { return JSON.parse(readFileSync(pj, 'utf8')); } catch { return {}; } })();
all[rel] = parts;
writeFileSync(pj, JSON.stringify(all, null, 1));
console.log(parts.map(p => `${p.file} ${p.chars}`).join('\n'));
