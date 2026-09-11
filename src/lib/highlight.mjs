// 构建期管线模块：不做 JS 类型检查（tsconfig checkJs=false），入口类型由调用方保证
import { createHighlighter } from 'shiki';

const THEMES = ['vitesse-light', 'vitesse-dark'];

/** @type {Awaited<ReturnType<typeof createHighlighter>> | null} */
let instance = null;
const getting = (() => {
  if (!instance) {
    instance = createHighlighter({
      themes: THEMES,
      langs: ['bash', 'shell', 'sh', 'json', 'jsonc', 'json5', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'markdown', 'yaml', 'toml', 'ini', 'text', 'diff'],
    });
  }
  return instance;
})();

/**
 * 与 Astro 正文围栏同源的高亮（同一套 vitesse 双主题、同一套 .line 结构）。
 * shiki 没有稳定的 pre 属性透传口子，因此高亮完成后再把 data-* 注入开标签。
 * @param {string} code
 * @param {string} lang
 * @param {{ title?: string, ins?: number | string }} [opts]
 */
export async function highlight(code, lang = 'text', opts = {}) {
  const h = await getting;
  const clean = code.replace(/^\n+/, '').replace(/\s+$/, '\n');
  const html = await h.codeToHtml(clean, {
    lang: h.getLoadedLanguages().includes(lang) ? lang : 'text',
    themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
    defaultColor: false,
  });
  const attrs = [
    opts.title ? ` data-title="${escapeAttr(opts.title)}"` : '',
    opts.ins ? ` data-ins="${String(opts.ins)}"` : '',
  ].join('');
  if (!attrs) return html;
  return html.replace(/<pre\b([^>]*)>/, (_m, rest) => `<pre${rest}${attrs}>`);
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
