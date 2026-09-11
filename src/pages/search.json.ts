import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { routeOf, groupOf } from '../lib/nav.mjs';

/**
 * 站内搜索索引：标题、分组、描述 + 按 h2/h3 切分的正文节。
 * 只索引译文正文（不索引代码块），单节截断，控制索引体积。
 * 索引在首次打开搜索时才被请求，因此可以把正文一并带上。
 */

/** 单节正文上限：够命中关键词与出摘要，又不至于让索引失控 */
const SECTION_CHARS = 560;

interface Section { id: string; t: string; x: string }
interface TocItem { level: number; text: string; id: string }

/** 把 MDX 正文压成可检索的纯文本：去 import、去标签、链接留文字、折叠空白 */
function plain(s: string): string {
  return s
    .replace(/^(?:import|export)\s[^\n]*$/gm, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*:::\s*[a-z-]*\s*(?:\[[^\]]*\])?\s*$/gim, ' ')
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, ' ')
    .replace(/[*_`|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 按 h2/h3 切节；节 id 取 frontmatter.toc（与正文锚点一一对应） */
function sectionsOf(body: string, toc: TocItem[]): Section[] {
  const out: Section[] = [];
  let fence: string | null = null;
  let cur: { id: string; t: string; raw: string[] } | null = null;
  let ti = 0;

  const flush = () => {
    if (!cur) return;
    out.push({ id: cur.id, t: cur.t, x: plain(cur.raw.join('\n')).slice(0, SECTION_CHARS) });
  };

  for (const line of body.split(/\r?\n/)) {
    const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (line.trimStart().startsWith(fence)) fence = null;
      continue;
    }
    if (open) { fence = open[1]; continue; }

    const h = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (h) {
      flush();
      const item = toc[ti++];
      cur = { id: item?.id ?? '', t: h[2].replace(/[*_`]/g, '').trim(), raw: [] };
      continue;
    }
    if (cur) cur.raw.push(line);
  }
  flush();
  return out;
}

export const GET: APIRoute = async () => {
  const entries = await getCollection('docs', ({ id }) => id !== '404');
  const pages = entries
    .map(e => ({
      title: e.data.title,
      href: routeOf(e.id),
      section: groupOf(e.id),
      description: e.data.description ?? '',
      sections: sectionsOf(e.body ?? '', e.data.toc ?? []),
    }))
    .sort((a, b) => a.href.localeCompare(b.href));
  return new Response(JSON.stringify({ pages }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
