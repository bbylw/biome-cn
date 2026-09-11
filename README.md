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

- **锚点**：标题 id 取英文原文的 GitHub slug（`go_to_definition` 这类下划线必须保留），中文标题照样渲染，站内与上游的 `#锚点` 因此都不失效。上游自身失效的锚点会被丢掉片段，只落到页面。同名小节（各配置项下的 Examples、各子命令下的同名选项）第 n 次出现追加 `-n`，否则同页重复 id 会让目录与深链全都跳到第一个。
- **代码块**：带 `title=` / `ins=` 元数据的围栏转成 `<Code>` 组件由 shiki 高亮，其余交给 Astro 正文管线，两条路径共用同一套 vitesse 双主题与 `.codeblock` 样式。
- **主题**：所有可翻转的颜色都是 CSS 变量，`html[data-theme]` 一处切换；Shiki 写进行内的底色由令牌覆盖。地址栏配色（`theme-color`）随主题同步。
- **图标**：`scripts/gen-icons.mjs` 从 `@phosphor-icons/web` 的 SVG 字体里抽出站内用到的 24 个字形路径，生成 `mask` 版 data-URI 写进 `phosphor.css`。因此产物里没有任何图标字体：少一次 147 KB 的字体请求，也没有图标先空白后闪现的问题，颜色随 `currentColor`、尺寸随 `font-size`。
- **搜索**：索引按需拉取（首次打开搜索才请求），按 h2/h3 分节全文检索，命中给出小节锚点与两行摘要。键盘走 combobox 模式：焦点留在输入框，`↓`/`↑` 移动、`Enter` 直达、`Esc` 关闭并回焦到触发按钮；`/?q=关键词` 可直接打开并回填。
- **无 JS**：标签页在脚本缺席时展开全部面板并各带标签名，正文、代码、目录照常可读。`astro build` 产出纯静态文件。

## 设计语言

「生境 / 地层」：Biome 的主张是一套基座供给多条通道，因此全站以地层断面为结构母题，三条通道（格式化 / Lint / Assist）由 `--lane-*` 令牌统一编码，同一组色值贯穿首页图形、侧栏、诊断样例与 OG 图。品牌渐变只在装饰面用亮档，承载文字的按钮与链接一律用深档以保证对比度。

首页的工具链断面图与终端面板都是代码绘制：图形是可缩放 SVG，终端里是 Biome 2.5.13 执行 `biome check` 的真实输出（只省略了两处 diff 正文）。

几条成文的约束，改动时请一并遵守：

- **圆角四档**：`--r-panel`（12 容器）/ `--r-code`（10 代码面）/ `--r-inner`（6 容器内小件）/ `--r-chip`（999 控件）。不要再写 3/5/7 这类临时值。
- **断点四档**：只允许 640 / 768 / 1024 / 1280，一律 `max-width` 书写（文档三栏是 1280 起的 `min-width`）。新增样式前先查 `@media` 是否落在既有档位上。
- **导航单行**：1024 以下先收 GitHub 与快捷键提示，768 以下再收主导航项，任何宽度都不允许折行。
- **首页各节不重复布局族**：通道行、整宽输出带、读数条、磁贴网格、迁移对照表、bento 索引各用一次；`sec-h` + `sec-p` 竖向叠放，不做「左大标题 + 右小解释」的分栏头。
- **不用渐变取字**：强调词用同族实色（`--brand-2`），不用 `background-clip: text`。
- **动效**：入场揭示是逐元素 `data-reveal` + IntersectionObserver（阈值调低，超高容器也不会卡在透明态），减弱动效下直接显示。文档页的阅读进度条走 CSS `animation-timeline: scroll(root)`，没有 `scroll` 监听。
  - 注意：`animation-timeline` 必须单独写成一条规则且换一个选择器，否则会被 CSS 压缩器折进 `animation` 简写而整条失效（`body .readbar` 这条就是这么来的）。
- **对比度**：浅色档的 `--muted` 取 `#5f6a77`，对 `--paper` 约 5.0:1，刚好越过 WCAG AA；再调浅就会掉到 4.4 以下。
- **SVG 里的文字用 class 上色，不要用 `fill` 呈现属性**：样式表里的 `fill` 会盖掉呈现属性。断面图那条命令一度被 `.pipeline text { fill: var(--muted) }` 覆盖，浅色主题下只剩 3.4:1。`preflight.mjs` 现在会把 SVG 文字一并纳入对比度检查。

## 验收

```bash
node .shots/serve.mjs &        # 静态服务 dist/
node .shots/audit.mjs          # 断链、锚点、元信息、重复 id、结构化数据、破折号、体积
node .shots/verify.mjs         # 主题/标签页/复制/搜索键盘与焦点/抽屉/目录高亮/图标/无 JS 回归
node .shots/preflight.mjs      # 文字对比度、CTA 单行、hero 视口适配、各节布局族（W= 可指定宽度）
node .shots/shot.mjs           # 暗亮 × 1440/1024/390 截图矩阵
node .shots/overflow.mjs       # 横向溢出定位（W= 可指定宽度）
node scripts/gen-og.mjs        # 由 public/og.html 渲染 og.png
```

`preflight.mjs` 读 `W`（宽度）与 `THEME`（light / dark），`overflow.mjs` 读 `W`。改断点或颜色后至少覆盖三档宽度与两种主题：

```bash
W=1024 node .shots/preflight.mjs
W=1024 node .shots/overflow.mjs
THEME=dark node .shots/preflight.mjs     # 对比度必须两种主题都过
```

## 许可

译文与代码：MIT 或 Apache-2.0（与上游一致）。Biome 名称与标识归 Biome 贡献者所有。
