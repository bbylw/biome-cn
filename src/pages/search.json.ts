import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { routeOf, groupOf } from '../lib/nav.mjs';

/** 站内搜索索引：标题、分组、描述、本页目录标题 */
export const GET: APIRoute = async () => {
  const entries = await getCollection('docs', ({ id }) => id !== '404');
  const pages = entries
    .map(e => ({
      title: e.data.title,
      href: routeOf(e.id),
      section: groupOf(e.id),
      description: e.data.description ?? '',
      headings: (e.data.toc ?? []).map(t => t.text),
    }))
    .sort((a, b) => a.href.localeCompare(b.href));
  return new Response(JSON.stringify({ pages }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
