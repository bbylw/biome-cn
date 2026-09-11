<div align="center">

# Biome · 中文文档站

社区中文翻译的 [Biome](https://biomejs.dev/) 文档与主页。
一条命令完成格式化、Lint 与整理导入的 Web 工具链。

[![CI](https://github.com/biomejs/biome/actions/workflows/main.yml/badge.svg)](https://github.com/biomejs/biome/actions/workflows/main.yml)
[![Biome](https://img.shields.io/npm/v/@biomejs/biome?label=Biome&color=60a5fa)](https://www.npmjs.com/package/@biomejs/biome)
[![Astro](https://img.shields.io/badge/Astro-7.3-7b2cd0)](https://astro.build/)

</div>

---

## 这是什么

- 45 篇中文文档：入门指南、格式化器、Linter、Assist 辅助操作、编辑器集成、CLI 与配置参考、配方、项目内部机制。
- 正文译自 [biomejs/website](https://github.com/biomejs/website) 的 `src/content/docs/en/**`，对应 Biome 2.5.13。
- 逐条规则的详情页不翻译（规则名与示例本就是英文），站内提供规则来源对照表，链接回指上游。
- 本站与 Biome 团队无隶属关系；译文沿用上游的 MIT 与 Apache-2.0 许可。

官方站虽有 `zh-cn` 路径，但正文与英文已明显脱节（例如入门指南仍是 v1 的结构与 `Node.js v14.18` 的说法），因此这里以英文源为准重新翻译。

## 本地开发

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # 产出 dist/
pnpm preview
pnpm check        # astro check 类型检查
```

### 预览

给人看的预览走本机 `portless`，拿命名 HTTPS 域名而不是裸端口：

```bash
portless biome-cn node .shots/serve.mjs
portless list                     # 读真实 URL（代理绑不上 443 时会退回高位端口）
```

无头验收脚本刻意走 `127.0.0.1` 直连源（免处理本地 CA），端口可指定：

```bash
PORT=8199 node .shots/serve.mjs &
SHOT_BASE=http://127.0.0.1:8199 node .shots/verify.mjs
```

## 内容管线

文档不是手抄，而是从上游可复现地生成。脚本在 `pipeline/` 下，从该目录执行（中间产物 `en/`、`work/` 不入库）：

```bash
cd pipeline
node pull-docs.mjs          # 1. 拉取官方英文 MDX（排除逐条规则页），落到 en/ 与 manifest.json
node preprocess.mjs         # 2. 归一化：删 import、展开生成组件、算英文锚点，落到 work/en/
node split.mjs <文件> <份数>  # 3. 超大文档按标题边界切分，供多个子代理并行翻译
#   （并行翻译：work/en/* → work/zh/*，契约见 pipeline/glossary.md）
node finalize.mjs           # 4. 拼接 work/zh/ → 硬校验 → 注入组件 import → 写 ../src/content/docs/
```

第 4 步的硬校验是这条管线存在的理由，任何一项不过即中断：

| 校验 | 作用 |
| --- | --- |
| 标题层级序列 | 译文没有增删小节 |
| 代码围栏计数 | 没有吞掉或拆坏代码块 |
| 链接目标集合 | 没有改写或丢失任何 URL 与锚点 |
| 组件标签多重集合 | 没有误删 `<Tabs>`、`<PackageManagerCommand>` 等结构 |
| 破折号与锚点条数 | 行文硬约束与目录对齐 |

翻译契约与术语固定见 `pipeline/glossary.md`（子代理逐条遵守：固定译法、原样保留清单、禁止破折号与装饰性编号）。

## 站内实现

官方文档用 Starlight 组件写作，本站不装 Starlight，而是按同名同参实现组件层，因此译文可以原样搬运：

`src/components/mdx/` 下的 `Tabs`、`TabItem`、`Code`、`Aside`、`Steps`、`FileTree`、`Card`、`CardGrid`、`Icon`、`Badge`、`Diag`、`PackageManagerCommand`、`PackageManagerBiomeCommand`、`EditorAction`、`EditorSettings`。

几个值得记录的实现点：

- **锚点**：标题 id 取英文原文的 GitHub slug（`go_to_definition` 这类下划线必须保留），中文标题照样渲染，站内与上游的 `#锚点` 因此都不失效。上游自身失效的锚点会被丢掉片段，只落到页面。
- **代码块**：带 `title=` / `ins=` 元数据的围栏转成 `<Code>` 组件由 shiki 高亮，其余交给 Astro 正文管线，两条路径共用同一套 vitesse 双主题与 `.codeblock` 样式。
- **主题**：所有可翻转的颜色都是 CSS 变量，`html[data-theme]` 一处切换；Shiki 写进行内的底色由令牌覆盖。
- **图标**：`scripts/gen-icons.mjs` 从 `@phosphor-icons/web` 只抽取站内用到的 25 个字形并只保留 woff2，避免整包 3.9 MB 的字体进产物。
- **无 JS**：标签页在脚本缺席时展开全部面板并各带标签名，正文、代码、目录照常可读。`astro build` 产出纯静态文件。

## 设计语言

「生境 / 地层」：Biome 的主张是一套基座供给多条通道，因此全站以地层断面为结构母题，三条通道（格式化 / Lint / Assist）由 `--lane-*` 令牌统一编码，同一组色值贯穿首页图形、侧栏、诊断样例与 OG 图。品牌渐变只在装饰面用亮档，承载文字的按钮与链接一律用深档以保证对比度。

首页的工具链断面图与终端面板都是代码绘制：图形是可缩放 SVG，终端里是 Biome 2.5.13 执行 `biome check` 的真实输出（只省略了两处 diff 正文）。

## 验收

```bash
node .shots/serve.mjs &        # 静态服务 dist/
node .shots/audit.mjs          # 断链、锚点、元信息、体积
node .shots/verify.mjs         # 主题/标签页/复制/搜索/抽屉/无 JS 回归
node .shots/shot.mjs           # 暗亮 × 桌面移动截图矩阵
node .shots/overflow.mjs       # 横向溢出定位
node scripts/gen-og.mjs        # 由 public/og.html 渲染 og.png
```

## 许可

译文与代码：MIT 或 Apache-2.0（与上游一致）。Biome 名称与标识归 Biome 贡献者所有。
