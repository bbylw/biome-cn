// 构建期管线模块：不做 JS 类型检查（tsconfig checkJs=false），入口类型由调用方保证
/**
 * 侧栏信息架构：分组与顺序照搬官方站的文档结构（规则详情页除外），
 * 标题在构建期取每篇译文自己的 frontmatter.title，避免两处维护。
 */

/** @type {{title: string, tone?: string, ids: string[]}[]} */
export const GROUPS = [
  {
    title: '开始',
    ids: [
      'guides/getting-started',
      'guides/manual-installation',
      'guides/migrate-eslint-prettier',
      'guides/configure-biome',
      'guides/upgrade-to-biome-v2',
      'guides/big-projects',
      'guides/integrate-in-vcs',
      'guides/investigate-slowness',
    ],
  },
  {
    title: '核心能力',
    ids: [
      'formatter',
      'formatter/differences-with-prettier',
      'formatter/option-philosophy',
      'linter',
      'linter/domains',
      'linter/rules-sources',
      'linter/plugins',
      'assist',
      'assist/javascript/actions',
      'assist/json/actions',
      'assist/css/actions',
      'assist/graphql/actions',
      'assist/html/actions',
      'assist/markdown/actions',
      'assist/rules-sources',
      'analyzer/suppressions',
    ],
  },
  {
    title: '编辑器',
    ids: [
      'editors/introduction',
      'editors/first-party-extensions',
      'editors/third-party-extensions',
      'reference/vscode',
      'reference/zed',
    ],
  },
  {
    title: '参考',
    ids: [
      'reference/cli',
      'reference/configuration',
      'reference/diagnostics',
      'reference/environment-variables',
      'reference/daemon',
      'reference/gritql',
    ],
  },
  {
    title: '配方',
    ids: [
      'recipes/continuous-integration',
      'recipes/git-hooks',
      'recipes/gritql-plugins',
      'recipes/badges',
      'recipes/renovate',
    ],
  },
  {
    title: '关于项目',
    ids: [
      'internals/philosophy',
      'internals/architecture',
      'internals/language-support',
      'internals/versioning',
      'internals/people-and-credits',
    ],
  },
];

/** entry.id → 站内路径 */
export function routeOf(id) {
  const clean = id.replace(/^404$/, '404');
  if (clean.endsWith('/index')) return '/' + clean.slice(0, -6) + '/';
  return '/' + clean + '/';
}

/** 扁平顺序（上一篇/下一篇用） */
export const ORDER = GROUPS.flatMap(g => g.ids);

/** @param {string} id */
export function groupOf(id) {
  return GROUPS.find(g => g.ids.includes(id))?.title ?? '文档';
}
