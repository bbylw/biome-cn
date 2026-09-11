/**
 * preprocess.mjs — 把 Biome 官方英文 MDX 转成「翻译安全」的中间格式
 *
 * 产物 work/en/<rel> 只保留：frontmatter(title/description/anchors/原样透传键) + 正文
 * - 删除 import 行（构建期由 finalize.mjs 按实际用到的组件重新注入）
 * - <NumberOfRules /> → 真实数字（linter 545 / assist 10）
 * - <DiagnosticX /> → <Diag label="X"> + ```text 代码块（拉取官方生成样例并去 HTML）
 * - <Maintainers /> → 官方维护者链接列表
 * - 计算标题锚点表（英文 GitHub slug），写进 frontmatter.anchors，供渲染期按文档序复用
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import manifest from './manifest.json' with { type: 'json' };

const RAW = 'https://raw.githubusercontent.com/biomejs/website/main/src/components/';
const cache = new Map();
async function fetchText(relPath) {
  if (!cache.has(relPath)) {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(RAW + relPath);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        cache.set(relPath, await r.text());
        break;
      } catch (e) {
        if (i === 2) throw e;
        await new Promise(r => setTimeout(r, 600));
      }
    }
  }
  return cache.get(relPath);
}

const SKIP = new Set(['index.mdx']);

/* ---------- helpers ---------- */

function splitFrontmatter(src) {
  const trimmed = src.replace(/^[\s]*/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(trimmed);
  if (!m) return { fm: '', body: trimmed };
  return { fm: m[1], body: trimmed.slice(m[0].length) };
}

function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

// 与官方（Starlight/GitHub slug）对齐：保留下划线
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[`*[\]()]/g, '')
    .replace(/[^\u4e00-\u9fa5\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** 遍历正文，区分代码围栏内外；返回 { lines, inFence } 序列 */
function scanLines(body) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let fence = null;
  for (const line of lines) {
    const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (line.trimStart().startsWith(fence)) fence = null;
      out.push({ line, inFence: true });
      continue;
    }
    if (open) { fence = open[1]; out.push({ line, inFence: true }); continue; }
    out.push({ line, inFence: false });
  }
  return out;
}

/* ---------- transforms ---------- */

async function transform(rel, src) {
  const { fm, body } = splitFrontmatter(src);
  let text = body;

  // 1. 去 import 行
  text = text.replace(/^import\s+\S[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, '');

  // 2. NumberOfRules
  const group = src.includes('generated/assist/NumberOfRules')
    ? 'assist'
    : src.includes('generated/linter/NumberOfRules') ? 'linter' : '';
  const NUM = { linter: '545', assist: '10' };
  text = text.replace(/<NumberOfRules\s*\/>/g, `**${NUM[group] ?? '545'}**`);

  // 3. Diagnostic* 生成样例 → <Diag>
  const diagNames = [...src.matchAll(/^import\s+(\w+)\s+from\s+"@\/components\/generated\/diagnostics\/(\w+)\.md"/gm)]
    .map(m => m[2]);
  for (const name of diagNames) {
    const raw = await fetchText(`generated/diagnostics/${name}.md`);
    const inner = raw.replace(/^<pre[^>]*><code[^>]*>/, '').replace(/<\/code><\/pre>\s*$/, '');
    const plain = stripHtml(inner).replace(/^\r?\n/, '').replace(/\s+$/, '');
    const label = name.replace(/^Diagnostic/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
    const repl = `<Diag label="${label}">\n\n\`\`\`text\n${plain}\n\`\`\`\n\n</Diag>`;
    text = text.replace(new RegExp(`<${name}\\s*\\/>`, 'g'), repl);
  }

  // 4. Maintainers → 链接列表
  if (/<Maintainers\s*\/>/.test(text)) {
    const raw = await fetchText('generated/Community.astro');
    const logins = [...raw.matchAll(/alt="User ([\w-]+)"/g)].map(m => m[1]);
    const uniq = [...new Set(logins)];
    const list = uniq.map(l => `[@${l}](https://github.com/${l})`).join('、');
    text = text.replace(/<Maintainers\s*\/>/g, list);
  }

  // 5. EditorSettings 对象 props → 字符串 props（官方为成对标签，一并吞掉结束标签）
  text = text.replace(/<EditorSettings\b[\s\S]*?>(?:[\s\S]*?<\/EditorSettings>)?/g, (tag) => {
    const zed = /zed=\{\{\s*name:\s*"([^"]+)",\s*value:\s*(?:"([^"]*)"|"((?:[^"\\]|\\.)*)")\s*\}\}/.exec(tag);
    const vs = /vsCode=\{\{\s*name:\s*"([^"]+)",\s*value:\s*(?:"([^"]*)"|"((?:[^"\\]|\\.)*)")\s*\}\}/.exec(tag);
    const pick = (m) => (m ? { name: m[1], value: (m[2] ?? m[3] ?? '').replace(/\\"/g, '"') } : null);
    const a = pick(zed), b = pick(vs);
    const esc = (s) => s.replace(/"/g, '&quot;');
    return `<EditorSettings${a ? ` zedName="${a.name}" zedValue="${esc(a.value)}"` : ''}${b ? ` vsName="${b.name}" vsValue="${esc(b.value)}"` : ''} />`;
  });

  // 6. 官方 <Image> 组件（import 已删）→ 原生 <img>
  text = text.replace(/<Image\b/g, '<img');

  // 7. 贡献者头像墙
  const avatarRow = (items) =>
    '<div class="avatar-row">\n' +
    items.map(i => `  <a href="${i.url}"><img src="${i.avatar}" alt="${i.login}" width="57" height="57" loading="lazy" /></a>`).join('\n') +
    '\n</div>';
  if (/<CoreContributors\s*\/>/.test(text)) {
    const raw = await fetchText('CoreContributors.astro');
    const handles = [...raw.matchAll(/handle="([\w-]+)"/g)].map(m => m[1]);
    text = text.replace(/<CoreContributors\s*\/>/g, avatarRow(
      handles.map(h => ({ login: h, url: `https://github.com/${h}`, avatar: `https://avatars.githubusercontent.com/${h}?v=4&size=57` })),
    ));
  }
  if (/<Contributors\s*\/>/.test(text)) {
    const raw = await fetchText('generated/Contributors.astro');
    const items = [...raw.matchAll(/href="([^"]+)">\s*<Image\s+src="([^"]+)"/g)]
      .map(m => ({ url: m[1], avatar: m[2] }))
      .filter(i => /^https:\/\/avatars/.test(i.avatar));
    const logins = [...raw.matchAll(/alt="User ([\w.\-]+)"/g)].map(m => m[1]);
    const top = items.slice(0, 30).map((i, n) => ({ ...i, login: logins[n] || 'contributor' }));
    text = text.replace(/<Contributors\s*\/>/g,
      `${avatarRow(top)}\n\n更多代码贡献者请见 [上游贡献者图表](https://github.com/biomejs/biome/graphs/contributors)。`);
  }

  // 8. 压缩 transform 造成的空行
  text = text.replace(/\n{3,}/g, '\n\n');

  // 9. 锚点表：二级及以下标题（跳过代码围栏）
  const anchors = [];
  for (const { line, inFence } of scanLines(text)) {
    if (inFence) continue;
    const m = /^#{2,4}\s+(.+?)\s*$/.exec(line);
    if (m) anchors.push(slugify(m[1]));
  }

  return { fm, anchors, text };
}

/* ---------- run ---------- */

const OUT = 'work/en';
const report = [];
for (const item of manifest) {
  const rel = item.rel;
  if (SKIP.has(rel)) continue;
  const src = readFileSync(path.join('en', rel), 'utf8').replace(/^﻿/, '');
  const { fm, anchors, text } = await transform(rel, src);
  const grab = (k) => {
    const m = new RegExp(`^${k}:[ \\t]*(.*)$`, 'm').exec(fm);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  const titleVal = grab('title');
  const descVal = grab('description');
  // 透传其余 frontmatter 行（sidebar 等），anchors 单独以 JSON 形式给出
  const passthrough = fm
    .split(/\r?\n/)
    .filter(l => l.trim() && !/^title:|^description:/.test(l))
    .join('\n');
  const head = [
    '---',
    `title: ${titleVal}`,
    `description: ${descVal}`,
    `anchors: ${JSON.stringify(anchors)}`,
    passthrough,
    '---',
    '',
  ].filter(l => l !== undefined);
  mkdirSync(path.join(OUT, path.dirname(rel)), { recursive: true });
  writeFileSync(path.join(OUT, rel), head.join('\n') + text, 'utf8');
  const leftover = [];
  for (const { line, inFence } of scanLines(text)) {
    if (inFence) continue;
    const stripped = line.replace(/`[^`]*`/g, '');
    for (const m of stripped.matchAll(/<([A-Z][A-Za-z]*)/g)) leftover.push(m[1]);
  }
  const unknown = [...new Set(leftover)].filter(t => !/^(Tabs|TabItem|Code|FileTree|Steps|Card|CardGrid|Icon|PackageManagerCommand|PackageManagerBiomeCommand|EditorAction|EditorSettings|Diag|Image|Video|Summary|Details|Badge|a|div|span|p|ul|li|h2|h3|table|thead|tbody|tr|td|th|pre|code|kbd|script|br|img)$/.test(t));
  report.push({ rel, anchors: anchors.length, unknown: unknown.join(',') });
}
console.log('file | anchors | 未知组件');
for (const r of report) console.log(`${r.rel} | ${r.anchors} | ${r.unknown}`);
console.log(`共 ${report.length} 个文件`);
