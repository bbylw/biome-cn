// 构建期管线模块：不做 JS 类型检查（tsconfig checkJs=false），入口类型由调用方保证
/**
 * docs.mjs — 文档正文的 remark 处理
 *  1. 标题锚点：按 frontmatter.anchors（英文原文 slug）依文档序赋值，保证与上游链接、站内 #anchor 一致
 *  2. 收集本页目录（h2/h3）到 file.data.headings
 *  3. 链接重写：站内已翻译的路径走本地，未收录的（规则详情页、schemas、playground 等）回指官方站
 *  4. 代码围栏 meta：抽出 title / ins，交给 shiki transformer 上色
 */
import { visit } from 'unist-util-visit';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const UPSTREAM = 'https://biomejs.dev';
const DOCS_DIR = path.join(process.cwd(), 'src/content/docs');

/** 由落盘文件推导站内路由集合与每页锚点 */
let ROUTES = null;
/** 每页可用锚点（来自各篇 frontmatter.anchors 与正文里的原始 HTML id） */
let IDS = null;

function loadDocs() {
  if (ROUTES) return;
  ROUTES = new Set();
  IDS = new Map();
  const acc = (dir, prefix = '') => {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) { acc(path.join(dir, e.name), prefix + e.name + '/'); continue; }
      if (!/\.mdx?$/.test(e.name)) continue;
      const base = (prefix + e.name.replace(/\.mdx?$/, '')).replace(/\/index$/, '');
      if (base === '404') continue;
      const route = '/' + base + '/';
      ROUTES.add(route);
      const raw = readFileSyncCached(path.join(dir, e.name));
      const anchors = /anchors:\s*(\[[^\n]*\])/.exec(raw)?.[1];
      const set = new Set();
      if (anchors) { try { for (const a of JSON.parse(anchors)) set.add(a); } catch { /* 忽略 */ } }
      for (const m of raw.matchAll(/\bid="([^"]+)"/g)) set.add(m[1]);
      IDS.set(route, set);
    }
  };
  acc(DOCS_DIR);
}

const readFileSyncCached = (() => {
  const cache = new Map();
  return (p) => {
    if (!cache.has(p)) cache.set(p, readFileSync(p, 'utf8'));
    return cache.get(p);
  };
})();

const routes = () => { loadDocs(); return ROUTES; };
const has = (p) => routes().has(p);
const hasAnchor = (p, anchor) => {
  loadDocs();
  const set = IDS.get(p);
  return !!set && !!anchor && set.has(anchor.slice(1));
};

/** 去掉扩展名与 locale 前缀，得到站内路径 */
function normalizeTarget(raw) {
  let t = raw.replace(/^\/zh-cn(?=\/|$)/, '');
  const [before, ...rest] = t.split('#');
  const anchor = rest.length ? '#' + rest.join('#') : '';
  let clean = before.replace(/\.(md|mdx)$/, '');
  if (!clean) return { path: '/', anchor, base: '/' };
  let p = clean.endsWith('/') ? clean : clean + '/';
  p = p.replace(/^\/?/, '/');
  if (/(\/index)?\/$/.test(p)) {
    const asDir = p.replace(/index\/$/, '');
    if (has(asDir)) return { path: asDir, anchor, base: p.replace(/^\//, '').replace(/\/$/, '') };
  }
  return { path: p, anchor, base: p.replace(/^\//, '').replace(/\/$/, '') };
}

function rewrite(url) {
  if (!url || /^[a-z]+:/i.test(url) || url.startsWith('#') || url.startsWith('mailto:')) {
    return { url, external: /^[a-z]+:/i.test(url ?? '') };
  }
  if (!url.startsWith('/')) return { url, external: false };
  const { path: p, anchor } = normalizeTarget(url);
  if (has(p)) {
    const keep = !anchor || hasAnchor(p, anchor);
    return { url: p + (keep ? anchor : ''), external: false };
  }
  // 站内未收录 → 官方站（保留原锚点写法）
  const up = url.replace(/\/+$/, '') + (anchor || '');
  return { url: UPSTREAM + up, external: true };
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[`*[\]()]/g, '')
    .replace(/[^一-鿿\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const textOf = (node) => {
  let out = '';
  visit(node, (n) => { if (n.type === 'text') out += n.value; });
  return out;
};

export function docsPlugin() {
  return (tree, file) => {
    const data = (file.data ??= {});
    const fm = data.astro?.frontmatter ?? data.frontmatter ?? {};
    /** @type {string[]} */
    const anchors = Array.isArray(fm.anchors) ? fm.anchors : (typeof fm.anchors === 'string' ? JSON.parse(fm.anchors) : []);
    /** @type {{level:number,text:string,id:string}[]} */
    const headings = [];
    let ai = 0;

    visit(tree, 'heading', (node) => {
      const text = textOf(node);
      let id;
      if (node.depth >= 2) {
        id = anchors[ai++];
      }
      if (!id) id = slugify(text);
      node.data = node.data ?? {};
      node.data.id = id;
      node.data.hProperties = { ...(node.data.hProperties || {}), id };
      if (node.depth >= 2 && node.depth <= 3) headings.push({ level: node.depth, text, id });
    });
    data.headings = headings;

    const fixLink = (url) => {
      const r = rewrite(url);
      if (r.external) data.__hasExternal = true;
      return r;
    };

    visit(tree, 'link', (node) => {
      const r = fixLink(node.url);
      node.url = r.url;
      node.data = node.data ?? {};
      node.data.hProperties = { ...(node.data.hProperties || {}), ...(r.external ? { target: '_blank', rel: 'noopener noreferrer' } : null) };
    });
    visit(tree, 'linkReference', (node) => { /* 引用式链接由 definition 处理 */ });
    visit(tree, 'definition', (node) => { node.url = fixLink(node.url).url; });
    visit(tree, 'image', (node) => { node.url = fixLink(node.url).url; });

    // 代码围栏 meta → data-*
    visit(tree, 'code', (node) => {
      if (!node.meta) return;
      const title = /title="([^"]+)"/.exec(node.meta);
      const ins = /ins=\{(\d+)\}/.exec(node.meta);
      const mark = /mark=\{\[([^\]]+)\]\}/.exec(node.meta);
      node.data = node.data ?? {};
      node.data.hProperties = { ...(node.data.hProperties || {}) };
      if (title) node.data.hProperties['data-title'] = title[1];
      if (ins) node.data.hProperties['data-ins'] = ins[1];
      if (mark) {
        try { node.data.hProperties['data-mark'] = JSON.parse('[' + mark[1].replace(/'/g, '"') + ']'); } catch { /* 保留原样 */ }
      }
      node.meta = '';
    });
  };
}

/**
 * shiki transformer：把围栏 meta 里的 title / ins 落到 <pre> 属性上。
 * remark 阶段的 hProperties 会被 Astro 的 shiki 分支丢弃，所以这里从 __block 兜底再取一次。
 * 插入行（ins）的高亮由 CSS :nth-last-child 完成，避免依赖不稳定的 shiki line 钩子。
 */
export function docsShikiTransformer() {
  return {
    name: 'biome-cn:code-meta',
    /** @param {import('hast').Element} node */
    pre(node) {
      // @ts-expect-error Astro 会把代码节点本身放进 meta.__block
      const block = this.options?.meta?.__block;
      const props = block?.data?.hProperties;
      if (!props) return;
      const title = props['data-title'];
      const ins = props['data-ins'];
      if (!title && !ins) return;
      node.properties = node.properties || {};
      if (title) node.properties['data-title'] = String(title);
      if (ins) node.properties['data-ins'] = String(ins);
    },
  };
}
