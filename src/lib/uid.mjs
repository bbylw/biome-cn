// 构建期管线模块：不做 JS 类型检查（tsconfig checkJs=false），入口类型由调用方保证
/**
 * 构建期自增序号。
 * 用途：同一页会出现多组同构组件（例如多个 PackageManagerCommand 各自的 npm/pnpm 面板），
 * 单纯用 label 生成 id 会重复，导致 aria-controls / aria-labelledby 指向歧义。
 * 模块级计数在一次构建内全局唯一，且不参与任何对外链接，因此无需跨构建稳定。
 */
let n = 0;

/** @param {string} [slug] 可读后缀 */
export function nextId(slug) {
  n += 1;
  return `p-${n}${slug ? '-' + slug : ''}`;
}
