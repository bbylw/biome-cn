// 静态审计：断链、锚点缺失、hreflang/meta 缺失、页面体量
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'dist';
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
};
walk(ROOT);
const norm = (f) => f.split('\\').join('/');
const html = files.map(norm).filter(f => f.endsWith('.html') && !f.endsWith('/og.html'));

const idsOf = (file) => new Set([...readFileSync(file, 'utf8').matchAll(/\bid="([^"+]+)"/g)].map(m => m[1]));
const byUrl = new Map();
for (const f of html) {
  let u = '/' + path.relative(ROOT, f).replace(/\\/g, '/');
  u = u.replace(/\/index\.html$/, '/');
  if (u === '/404.html') u = '/404/';
  byUrl.set(u, f);
}

const broken = [];
const brokenAnchor = [];
let links = 0;
for (const f of html) {
  const src = readFileSync(f, 'utf8');
  const srcUrl = '/' + path.relative(ROOT, f).replace(/\\/g, '/');
  for (const m of src.matchAll(/href="([^"]*)"/g)) {
    const raw = m[1];
    if (/^(https?:|mailto:|tel:|data:|#|vscodium:|vscode:)/.test(raw)) continue;
    links++;
    const [p, anchor] = raw.split('#');
    // 资源类链接按文件存在性校验，不参与页面路由表
    if (/\.[a-z0-9]{2,5}$/i.test(p)) {
      const asset = path.join(ROOT, p);
      if (!existsSync(asset)) broken.push(`${srcUrl} → ${raw}（资源缺失）`);
      continue;
    }
    let target = p.startsWith('/') ? p : path.posix.join(path.dirname(srcUrl), p);
    if (!target.endsWith('/')) target += '/';
    const file = byUrl.get(target);
    if (!file) { broken.push(`${srcUrl} → ${raw}`); continue; }
    if (anchor && !idsOf(file).has(anchor)) brokenAnchor.push(`${srcUrl} → ${raw}`);
  }
}

const missing = [];
for (const f of html) {
  const s = readFileSync(f, 'utf8');
  const u = '/' + path.relative(ROOT, f).replace(/\\/g, '/');
  if (!/<title>[^<]+<\/title>/.test(s)) missing.push(`${u} 无 title`);
  if (!/name="description" content="[^"]{4,}"/.test(s)) missing.push(`${u} 无 description`);
  if (!/rel="canonical"/.test(s)) missing.push(`${u} 无 canonical`);
  if (!/property="og:image"/.test(s)) missing.push(`${u} 无 og:image`);
  if (/class="[^"]*\blede\b/.test(s) === false && !/404/.test(u) && u !== '/index.html') missing.push(`${u} 无导语`);
}

// 同页重复 id：锚点必须唯一，否则目录与深链只能跳到第一个
const dupIds = [];
for (const f of html) {
  const ids = [...readFileSync(f, 'utf8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const seen = new Set();
  const dup = new Set();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  if (dup.size) dupIds.push(`${f} → ${[...dup].slice(0, 4).join(',')}`);
}

// 结构化数据：必须存在、可解析，且含站点级 WebSite 块
const ldBad = [];
for (const f of html) {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(readFileSync(f, 'utf8'));
  if (!m) { ldBad.push(`${f} 无 JSON-LD`); continue; }
  try {
    const blocks = JSON.parse(m[1]);
    const types = (Array.isArray(blocks) ? blocks : [blocks]).map(b => b['@type']);
    if (!types.includes('WebSite')) ldBad.push(`${f} 缺 WebSite 块`);
  } catch { ldBad.push(`${f} JSON-LD 解析失败`); }
}

// 行文硬约束（与 pipeline/glossary.md 同源）：可见文本里不得出现破折号，
// 正文之外的元信息行里中间点最多一个
const stripTags = (s) => s
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ');
const dashBad = [];
const dotBad = [];
for (const f of html) {
  const text = stripTags(readFileSync(f, 'utf8'));
  const dashes = text.match(/[—–]/g);
  if (dashes) dashBad.push(`${f} ×${dashes.length}`);
  for (const line of text.split('\n')) {
    const dots = (line.match(/·/g) || []).length;
    if (dots > 1) dotBad.push(`${f} ×${dots}`);
  }
}

console.log(`页面 ${html.length} 个，站内链接检查 ${links} 条`);
console.log('\n断链:', broken.length ? '' : '（无）');
console.log(broken.slice(0, 30).join('\n'));
console.log('\n锚点缺失:', brokenAnchor.length ? '' : '（无）');
console.log(brokenAnchor.slice(0, 30).join('\n'));
console.log('\n元信息:', missing.length ? '' : '（无）');
console.log(missing.slice(0, 20).join('\n'));
console.log('\n重复 id:', dupIds.length ? '' : '（无）');
console.log(dupIds.slice(0, 20).join('\n'));
console.log('\n结构化数据:', ldBad.length ? '' : '（无）');
console.log(ldBad.slice(0, 20).join('\n'));
console.log('\n破折号:', dashBad.length ? '' : '（无）');
console.log(dashBad.slice(0, 20).join('\n'));
console.log('\n单行多中间点:', dotBad.length ? '' : '（无）');
console.log(dotBad.slice(0, 20).join('\n'));
const big = files.filter(f => statSync(f).size > 400_000).map(f => `${f} ${(statSync(f).size / 1024).toFixed(0)}K`);
console.log('\n超大文件:', big.join(', ') || '（无）');
console.log('总产出体积', (files.reduce((a, f) => a + statSync(f).size, 0) / 1024 / 1024).toFixed(2), 'MB');
