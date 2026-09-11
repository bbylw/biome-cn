// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { docsPlugin, docsShikiTransformer } from './src/plugins/docs.mjs';
import { SITE } from './src/lib/site.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export { SITE };

/** 代码高亮：浅/深双主题，具体配色由 CSS 变量与 data-theme 联动 */
const shikiConfig = {
  themes: {
    light: 'vitesse-light',
    dark: 'vitesse-dark',
  },
  wrap: false,
  transformers: [docsShikiTransformer()],
  // Shiki 无 grit 语法（官方站点亦不高亮），降级为纯文本
  langAlias: { grit: 'text', gritql: 'text' },
  langs: ['bash', 'shell', 'sh', 'json', 'jsonc', 'json5', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'markdown', 'yaml', 'toml', 'ini', 'diff', 'text', 'vue'],
};

export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [
    mdx({
      extendMarkdownConfig: true,
      shikiConfig,
    }),
    sitemap({
      filter: (p) => !p.endsWith('/404/'),
    }),
  ],
  markdown: {
    shikiConfig,
    processor: unified({
      remarkPlugins: [docsPlugin],
      rehypePlugins: [],
      smartypants: false,
      gfm: true,
    }),
  },
  vite: {
    resolve: {
      alias: { '@': path.join(root, 'src') },
    },
  },
});
