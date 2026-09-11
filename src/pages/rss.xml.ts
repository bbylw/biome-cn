import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { routeOf, groupOf, GROUPS } from '../lib/nav.mjs';
import { SITE } from '../lib/site.mjs';

const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
const rfc822 = (d: Date) => d.toUTCString();

/**
 * 文档更新订阅（纯静态生成，不引入额外依赖）。
 * 文档集没有单篇发布时间，因此只在频道上给真实的构建时间 lastBuildDate，
 * 不伪造每篇的 pubDate；分组作为 category 输出，便于按主题过滤。
 */
export const GET: APIRoute = async () => {
  const entries = await getCollection('docs', ({ id }) => id !== '404');
  // 顺序与站内侧栏一致，读者在阅读器里看到的排列与站内一致
  const order = GROUPS.flatMap(g => g.ids);
  const rank = new Map(order.map((id, i) => [id, i]));
  const items = entries
    .filter(e => rank.has(e.id))
    .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
    .map(e => {
      const url = new URL(routeOf(e.id), SITE).href;
      return [
        '    <item>',
        `      <title>${esc(e.data.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <category>${esc(groupOf(e.id))}</category>`,
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
    `    <lastBuildDate>${rfc822(new Date())}</lastBuildDate>`,
    '    <generator>Astro</generator>',
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n');

  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
