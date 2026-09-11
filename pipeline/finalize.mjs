/**
 * finalize.mjs — 拼接分片 → 硬校验 → 注入 MDX 组件 import → 落到 biome-cn/src/content/docs
 *
 * 校验不变量（与英文源逐条比对）：
 *   A. frontmatter anchors 数组必须一字不差
 *   B. 标题数量与层级序列一致
 *   C. ``` 围栏计数一致
 *   D. 链接目标集合（含引用式定义 URL）一致 → 抓漏译/改坏链接
 *   E. 代码围栏外的组件标签多重集合一致 → 抓误删组件
 *   F. 译文不得出现 — / —— / –
 *   G. 围栏外且无中字的整行英文（疑似漏译）→ 告警清单
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import manifest from './manifest.json' with { type: 'json' };

const EN = 'work/en', ZH = 'work/zh', DEST = '../src/content/docs';
/** 站内正文对应的 Biome 版本（与官方生成的 biome.json schema 版本一致） */
export const BIOME_VERSION = '2.5.13';
const SKIP = new Set(['index.mdx', '404.md']);
const rels = manifest.map(m => m.rel).filter(r => !SKIP.has(r));

/* ---------- utils ---------- */

function readFenceAware(text) {
  const lines = text.split(/\r?\n/);
  const flags = [];
  let f = null;
  for (const l of lines) {
    const open = /^\s{0,3}(`{3,}|~{3,})/.exec(l);
    if (f) {
      flags.push(true);
      if (l.trimStart().startsWith(f)) f = null;
    } else if (open) { flags.push(true); f = open[1]; }
    else flags.push(false);
  }
  return { lines, flags };
}

function splitFm(text) {
  const t = text.replace(/^\s*/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(t);
  return m ? { fm: m[0], body: t.slice(m[0].length) } : { fm: '', body: t };
}

const anchorsOf = (fm) => {
  const m = /^anchors:[ \t]*(\[[^\]]*\]).*$/m.exec(fm);
  return m ? m[1] : '[]';
};
const headingsOf = (text) => {
  const { lines, flags } = readFenceAware(text);
  const out = [];
  lines.forEach((l, i) => {
    if (flags[i]) return;
    const m = /^(#{1,6})\s+/.exec(l);
    if (m) out.push(m[1].length);
  });
  return out;
};
const fencesOf = (text) => (text.match(/^\s{0,3}(`{3,}|~{3,})/gm) || []).length;
const linkTargetsOf = (text) => {
  const out = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) out.push(m[1]);
  for (const m of text.matchAll(/^\[[^\]]+\]:\s*(\S+)\s*$/gm)) out.push(m[1]);
  return out.sort();
};
const tagsOf = (text) => {
  const { lines, flags } = readFenceAware(text);
  const out = [];
  lines.forEach((l, i) => {
    if (flags[i]) return;
    const stripped = l.replace(/`[^`]*`/g, '');
    for (const m of stripped.matchAll(/<\/?([A-Za-z][A-Za-z0-9-]*)/g)) out.push(m[1]);
  });
  return out.sort();
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 与官方（Starlight/GitHub slug）对齐：下划线保留，其余标点删除 */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[`*[\]()]/g, '')
    .replace(/[^一-鿿\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** 按文档序计算英文源的标题锚点，作为站内 id 的唯一真相 */
function anchorsFrom(body) {
  const out = [];
  const { lines, flags } = readFenceAware(body);
  lines.forEach((l, i) => {
    if (flags[i]) return;
    const m = /^(#{2,4})\s+(.+?)\s*$/.exec(l);
    if (m) out.push(slugify(m[2]));
  });
  return out;
}

/* ---------- assemble ---------- */

function loadZh(rel) {
  const direct = path.join(ZH, rel);
  if (existsSync(direct)) return readFileSync(direct, 'utf8');
  const parts = [];
  for (let k = 1; k <= 9; k++) {
    const p = path.join(ZH, '_split', `${rel}.part${k}.mdx`);
    if (existsSync(p)) parts.push(readFileSync(p, 'utf8'));
  }
  if (!parts.length) return null;
  // part1 带 frontmatter；后续分片直接续接，去掉分片首尾多余空行
  return parts.map((p, i) => (i === 0 ? p : p.replace(/^\s+/, '').replace(/\s+$/, ''))).join('\n\n');
}

/* ---------- MDX import 注入 ---------- */

const IMPORT_MAP = {
  Tabs: 'mdx/Tabs.astro', TabItem: 'mdx/TabItem.astro', Code: 'mdx/Code.astro',
  Aside: 'mdx/Aside.astro',
  FileTree: 'mdx/FileTree.astro', Steps: 'mdx/Steps.astro',
  Card: 'mdx/Card.astro', CardGrid: 'mdx/CardGrid.astro', Icon: 'mdx/Icon.astro',
  Badge: 'mdx/Badge.astro', Diag: 'mdx/Diag.astro',
  PackageManagerCommand: 'mdx/PackageManagerCommand.astro',
  PackageManagerBiomeCommand: 'mdx/PackageManagerBiomeCommand.astro',
  EditorAction: 'mdx/EditorAction.astro',
  EditorSettings: 'mdx/EditorSettings.astro',
};

function buildImports(body) {
  const used = new Set();
  for (const m of [...body.matchAll(/<\/?([A-Z][A-Za-z]*)/g)]) used.add(m[1]);
  /** @type {string[]} */
  const lines = [];
  for (const tag of [...used].sort()) {
    const mod = IMPORT_MAP[tag];
    if (!mod) continue;
    lines.push(`import ${tag} from "@/components/${mod}";`);
  }
  return lines;
}

/* ---------- MDX 归一化 ---------- */

/** :::type[标题] ... ::: → <Aside>；<Code code={`...`} .../> → 围栏代码块 */
function normalizeMdx(body) {
  const { lines, flags } = readFenceAware(body);
  /** @type {string[]} */
  const out = [];
  let open = null;      // { type, title, buf }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (flags[i]) { out.push(l); continue; }
    if (open) {
      if (/^:::\s*$/.test(l)) {
        out.push(`<Aside type="${open.type}"${open.title ? ` title="${open.title}"` : ''}>`, '', ...open.buf, '', '</Aside>');
        open = null;
      } else {
        open.buf.push(l);
      }
      continue;
    }
    const m = /^:::([a-zA-Z]+)(?:\[([^\]]*)\])?\s*$/.exec(l);
    if (m) { open = { type: m[1].toLowerCase(), title: m[2] ?? '', buf: [] }; continue; }
    out.push(l);
  }
  if (open) out.push(`:::${open.type}`, ...open.buf, ':::');
  let text = out.join('\n');

  // 属性式 <Code> → 围栏
  text = text.replace(/<Code\b([^>]*?)code=\{`([\s\S]*?)`\}([^>]*?)\/>/g, (_all, pre, code, post) => {
    const attrs = pre + post;
    const lang = /lang="([^"]+)"/.exec(attrs)?.[1] ?? 'text';
    const title = /title="([^"]+)"/.exec(attrs)?.[1];
    const ins = /ins=\{(\d+)\}/.exec(attrs)?.[1];
    const raw = code.replace(/^\r?\n/, '').replace(/\s+$/, '');
    const rows = raw.split(/\r?\n/);
    const indent = rows.filter(r => r.trim()).reduce((min, r) => Math.min(min, /^[\t ]*/.exec(r)[0].length), Infinity);
    const dedented = rows.map(r => r.slice(Number.isFinite(indent) ? indent : 0));
    const meta = [title ? `title="${title}"` : '', ins ? `ins={${ins}}` : ''].filter(Boolean).join(' ');
    return `\n\n\`\`\`${lang}${meta ? ' ' + meta : ''}\n${dedented.join('\n')}\n\`\`\`\n\n`;
  });
  // <FileTree> 内是紧贴标签的 markdown 列表，补空行才能被 MDX 当 markdown 解析
  text = text.replace(/<FileTree>([\s\S]*?)<\/FileTree>/g, (_m, inner) =>
    `\n\n<FileTree>\n\n${inner.trim()}\n\n</FileTree>\n\n`);
  // 表达式兜底：官方动态取版本的写法换成站内锁定版本
  text = text.replace(/^export const version = await getLatestVersion\([^)]*\);\s*$/gm, '');
  text = text.split('${version}').join(BIOME_VERSION);
  // 带 title / ins 元数据的围栏转成 <Code> 组件（Astro 的 shiki 分支不透传这类属性）
  {
    const lines = text.split('\n');
    /** @type {string[]} */
    const acc = [];
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = /^\s{0,3}(`{3,}|~{3,})([a-zA-Z0-9+#._-]*)(.*)$/.exec(line);
      if (inFence) {
        if (m && !m[2] && !m[3].trim()) inFence = false;
        acc.push(line);
        continue;
      }
      if (m) {
        const lang = m[2] || 'text';
        const meta = m[3] || '';
        if (/\b(title|ins)=/.test(meta)) {
          const title = /title="([^"]*)"/.exec(meta)?.[1];
          const ins = /ins=\{?(\d+)\}?/.exec(meta)?.[1];
          const blockLines = [];
          let j = i + 1;
          for (; j < lines.length; j++) {
            const c = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(lines[j]);
            if (c) break;
            blockLines.push(lines[j]);
          }
          const attrs = [
            `lang="${lang}"`,
            title ? `title="${(title ?? '').replace(/"/g, '&quot;')}"` : '',
            ins ? `ins={${ins}}` : '',
            `code={${JSON.stringify(blockLines.join('\n'))}}`,
          ].filter(Boolean).join(' ');
          acc.push('', `<Code ${attrs} />`, '');
          i = j;
          continue;
        }
        inFence = true;
      }
      acc.push(line);
    }
    text = acc.join('\n');
  }
  // 归一化因插入产生的多余空行
  text = text.replace(/\n{3,}/g, '\n\n');
  return text;
}

/* ---------- run ---------- */

const problems = [];
const warns = [];
let written = 0;

for (const rel of rels) {
  const enText = readFileSync(path.join(EN, rel), 'utf8');
  const zhRaw = loadZh(rel);
  if (!zhRaw) { problems.push(`${rel}: 缺译文`); continue; }
  const en = splitFm(enText), zh = splitFm(zhRaw);
  const outName = rel.replace(/\.md$/, '.mdx');

  // A anchors 条数（内容以英文源重算为准，见输出阶段）
  if (JSON.parse(anchorsOf(en.fm)).length !== JSON.parse(anchorsOf(zh.fm)).length) {
    problems.push(`${rel}: anchors 条数不一致`);
  }
  // B 标题
  const he = headingsOf(en.body), hz = headingsOf(zh.body);
  if (!eq(he, hz)) problems.push(`${rel}: 标题序列不一致 en=${he.length} zh=${hz.length}`);
  // C 围栏
  const fe = fencesOf(enText), fz = fencesOf(zhRaw);
  if (fe !== fz) problems.push(`${rel}: 围栏计数不一致 en=${fe} zh=${fz}`);
  // D 链接目标
  const le = linkTargetsOf(en.body), lz = linkTargetsOf(zh.body);
  const miss = le.filter(x => !lz.includes(x)), add = lz.filter(x => !le.includes(x));
  if (miss.length) problems.push(`${rel}: 丢失链接目标 ${miss.slice(0, 4).join(' ')}`);
  if (add.length) problems.push(`${rel}: 多出链接目标 ${add.slice(0, 4).join(' ')}`);
  // E 组件标签
  const te = tagsOf(en.body), tz = tagsOf(zh.body);
  if (!eq(te, tz)) {
    const d1 = te.filter((x, i) => x !== tz[i]);
    problems.push(`${rel}: 标签多重集合不一致 (${d1.slice(0, 6).join(',') || '顺序差异'})`);
  }
  // F 破折号
  const dash = zhRaw.match(/[—–]|(——)/g);
  if (dash) problems.push(`${rel}: 含破折号 ×${dash.length}`);
  // G 疑似漏译（围栏外、无中文、含 4+ 连续英文单词）
  const { lines, flags } = readFenceAware(zh.body);
  const suspect = [];
  lines.forEach((l, i) => {
    if (flags[i] || /^\s*[|:-]*\s*$/.test(l)) return;
    if (/[一-鿿]/.test(l)) return;
    if (/^\s*(import<\/?|---|<\s*\/?(div|a|img|span|p|ul|li|h2|h3|h4|table|thead|tbody|tr|td|th|kbd|details|summary|video|br)\b|<\/?$)/i.test(l)) return;
    if (/^\s*\[\d+\]:/ .test(l)) return;
    if (/<\/?(Tabs|TabItem|Code|FileTree|Steps|Step|Card|CardGrid|Icon|Badge|Diag|PackageManagerCommand|PackageManagerBiomeCommand|EditorAction|EditorSettings)\b/i.test(l)) return;
    if (/\{\/\*|\*\/|<!--|-->/.test(l)) return;
    const words = (l.replace(/\(.*?\)/g, '').match(/[A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*){4}/g) || []);
    if (words.length) suspect.push(`${i + 1}: ${l.trim().slice(0, 110)}`);
  });
  if (suspect.length) warns.push(`${rel} 疑似漏译 ${suspect.length} 行\n    ` + suspect.slice(0, 6).join('\n    '));

  // 输出
  const body = normalizeMdx(zh.body).replace(/^\s+/, '');
  const imports = buildImports(body);
  // 本页目录：层级 + 译文标题 + 与官方对齐的英文锚点（按英文源重算，避免中文 slug 破坏站内链接）
  const anchorList = anchorsFrom(en.body);
  if (anchorList.length !== JSON.parse(anchorsOf(zh.fm)).length) {
    problems.push(`${rel}: 译文 anchors 条数与英文源重算结果不一致`);
  }
  const toc = [];
  {
    let ai = 0;
    const { lines, flags } = readFenceAware(body);
    lines.forEach((l, i) => {
      if (flags[i]) return;
      const m = /^(#{2,4})\s+(.+?)\s*$/.exec(l);
      if (!m) return;
      const id = anchorList[ai++] ?? '';
      if (m[1].length <= 3) toc.push({ level: m[1].length, text: m[2].replace(/[*_`]/g, ''), id });
    });
  }
  const fm = zh.fm.replace(/\r\n/g, '\n').replace(/^---\r?\n([\s\S]*?)\r?\n---\s*$/m, (_m, block) => {
    const keep = String(block).split(/\r?\n/).filter(l => /^(title|description):/.test(l));
    keep.push(`anchors: ${JSON.stringify(anchorList)}`, `toc: ${JSON.stringify(toc)}`);
    return `---\n${keep.join('\n')}\n---`;
  });
  const out = fm + '\n' + (imports.length ? imports.join('\n') + '\n\n' : '') + body;
  const dest = path.join(DEST, outName);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, out.replace(/^\n+/, ''), 'utf8');
  written++;
}

console.log(`写入 ${written}/${rels.length} 篇`);
console.log('\n=== 硬校验失败 ===');
console.log(problems.length ? problems.join('\n') : '（无）');
console.log('\n=== 待人工复核 ===');
console.log(warns.length ? warns.join('\n') : '（无）');
