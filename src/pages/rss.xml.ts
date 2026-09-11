import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { routeOf } from '../lib/nav.mjs';

const SITE = 'https://biome.ndjp.net';
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));

/** 文档更新订阅（按文件路径排序，纯静态生成，不引入额外依赖） */
export const GET: APIRoute = async ({ site }) => {
  const entries = await getCollection('docs', ({ id }) => id !== '404');
  const items = entries
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(e => {
      const url = new URL(routeOf(e.id), SITE).href;
      return [
        '    <item>',
        `      <title>${esc(e.data.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <description>${esc(e.data.description ?? '')}</description>`,
        '    </item>',
      ].join('\n');
    });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Biome 中文站 · 文档</title>',
    `    <link>${SITE}/</link>`,
    `    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />`,
    '    <description>Biome 工具链中文文档：格式化、Lint、Assist 与 CLI 参考。</description>',
    '    <language>zh-CN</language>',
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n');
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
