// 构建期管线模块：不做 JS 类型检查（tsconfig checkJs=false），入口类型由调用方保证
/** 包管理器标签页：与官方 PackageManagerCommand / PackageManagerBiomeCommand 的输出保持一致 */

export const PM_ORDER = ['npm', 'pnpm', 'bun', 'deno', 'yarn'];
export const PKG = '@biomejs/biome';
export const BIN = 'biome';

/** 运行期调用前缀（npx / pnpx / bunx --bun / deno run -A npm:… / yarn exec biome --） */
export const RUN_PREFIX = {
  npm: `npx ${PKG}`,
  pnpm: `pnpx ${PKG}`,
  bun: `bunx --bun ${PKG}`,
  deno: `deno run -A npm:${PKG}`,
  yarn: `yarn exec ${BIN} --`,
};

/** @param {Record<string, string[]>} props */
export function installTabs(props) {
  return PM_ORDER.map(pm => ({
    pm,
    code: (props[pm] ?? []).map(c => `${pm} ${c}`).join('\n'),
  }));
}

/** @param {string} command */
export function biomeTabs(command) {
  return PM_ORDER.map(pm => ({
    pm,
    code: `${RUN_PREFIX[pm]} ${command}`.trim(),
  }));
}
