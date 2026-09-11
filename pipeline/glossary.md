# Biome 中文站术语表与翻译契约

翻译前必读。所有子代理必须逐条遵守；术语冲突时以本表为准。

## 一、固定译法（首次出现用「中文（English）」，之后用中文）

| 英文 | 中文 | 说明 |
| --- | --- | --- |
| toolchain | 工具链 | |
| Biome | Biome | 品牌名，永不翻译、永不加空格以外的改动 |
| formatter | 格式化器 | 指组件；动作用「格式化」 |
| formatting | 格式化 | |
| linter | Linter | 保留英文（官方中文亦如此）；动词写「Lint」 |
| linting | Lint / 代码检查 | 首次可写「代码检查（linting）」 |
| assist / assist actions | Assist 辅助操作 | 产品功能名，保留 Assist |
| organize imports | 整理导入 | |
| diagnostic(s) | 诊断信息 | 不用「诊断报告」 |
| severity | 严重性等级 | |
| rule | 规则 | |
| rule group | 规则分组 | |
| recommended | 推荐 | `rules.recommended` 等键名不译 |
| nursery | nursery（实验分组） | 组名保留英文 |
| safe fix / unsafe fix | 安全修复 / 不安全修复 | |
| code fix | 代码修复 | |
| code action | 代码操作 | 编辑器语境 |
| action | 操作 | |
| suppression / suppress | 抑制 | 「抑制注释」= suppression comment |
| reason | 抑制原因 | |
| plugin | 插件 | |
| configuration file | 配置文件 | `biome.json` 不译 |
| zero configuration | 零配置 | |
| version pinning | 版本锁定 | |
| command-line interface (CLI) | 命令行接口（CLI） | |
| editor extension | 编辑器扩展 | |
| first-party / third-party | 第一方 / 第三方 | |
| Continuous Integration (CI) | 持续集成（CI） | |
| standalone executable | 独立可执行文件 | |
| daemon | 守护进程 | |
| parser | 解析器 | |
| CST / parse tree | 具体语法树（CST） | |
| error recovery | 错误恢复 | |
| lexer | 词法分析器 | |
| cache | 缓存 | |
| glob / globs | glob 模式 | 不译 glob |
| ignore / include | 忽略 / 包含 | 键名不译 |
| indentation / indent style | 缩进 / 缩进风格 | |
| line width | 行宽 | |
| quote style | 引号风格 | |
| semicolon | 分号 | |
| migrate | 迁移 | |
| project root | 项目根目录 | |
| workspace | 工作区 | |
| language support | 语言支持 | |
| playground | Playground（在线试用） | |
| suppressions | 抑制列表 | |
| domain（linter domain） | 规则域（domain） | Biome v2 概念，保留英文括注 |
| preset | 预设 | |
| schema | schema | 不译，`$schema` 键名保留 |
| contributor | 贡献者 | |
| maintainer | 维护者 | |

## 二、必须原样保留（一字不改）

- 所有代码块（``` 围栏）内的**命令、参数、配置键、URL、标识符、包名、版本号**。
  - 例外：代码块里的**英文注释**（`# ...`、`// ...`、`/* ... */`）翻译成中文，保留注释符号与缩进。
- 包管理器与工具名：npm、pnpm、yarn、bun、deno、npx、pnpx、bunx、ESLint、Prettier、TypeScript、JavaScript、JSX、TSX、JSON、JSONC、CSS、SCSS、GraphQL、Markdown、Handlebars、Vue、Svelte、Astro、HTML、GritQL、Git、GitHub、GitLab、VS Code、VSCodium、Cursor、Zed、Neovim、Vim、Sublime Text、JetBrains、IntelliJ IDEA、WebStorm、Rust、rust-analyzer、Node.js、Deno、Bun、WebAssembly、LSP。
- Biome 命令与子命令：`biome format`、`biome lint`、`biome check`、`biome ci`、`biome init`、`biome migrate`、`biome lsp-proxy`、`biome search`、`biome daemon-stop` 等。
- 规则名（camelCase）：`noDoubleEquals`、`useConst`、`noUnusedVariables` …… 全部原样。
- 配置键与枚举值：`linter.enabled`、`formatter.indentStyle`、`"tab"`、`"double"`、`"recommended"` 等。
- 文件与目录名：`biome.json`、`biome.jsonc`、`.gitignore`、`package.json`、`$schema`。
- 环境变量名：`BIOME_LOG_DIR` 等。
- 链接目标：``[文字](目标)` 的**圆括号内内容**、`[引用]: URL` 的 URL 行、锚点、图片地址，全部原样复制。
- frontmatter 中除 `title:`、`description:` 之外的所有键与值（尤其 `anchors: [...]` 必须逐字保留、顺序不变、元素个数不变）。
- 组件标签与其属性：`<Tabs>`、`<TabItem label="npm">`、`<Code ...>`、`<FileTree>`、`<Steps>`、`<Card title=...>`、`<PackageManagerCommand .../>`、`<PackageManagerBiomeCommand .../>`、`<EditorAction .../>`、`<EditorSettings .../>`、`<Diag label="...">`、`<Icon .../>`。标签名与属性一字不改，只翻译标签**内部的英文正文**。
- 指令块标记：`:::note`、`:::tip`、`:::caution`、`:::danger` 及其 `:::note[标题]` 形式；方括号内的标题要翻译，`:::` 与类型名不动。
- HTML 片段（`<div class="avatar-row">`、`<img ...>`、`<a href>`、`<video>`）整体原样复制。
- 徽章图片行（`[![...](...)](...)`）整行原样。
- Emoji：官方正文中的 🥳 等按原样保留在原来位置。

## 三、中文行文规范（硬约束）

1. **禁止破折号**：不得出现 `—`、`——`、`–`。需要停顿改用逗号、句号、冒号、括号或拆句。
2. **禁止装饰性编号**：标题不加 `01`、`壹`、`Ⅰ`；`##`/`###` 只翻译原标题文字。
3. 中英文之间、中文与数字之间、中文与半角括号/引号之外的代码之间加一个半角空格：`使用 Biome 检查 3 个文件`。代码与行内 `` `code` `` 两侧同样加空格。
4. 标点用全角（，。：；、）；英文句读保持在代码与技术串内部。
5. 人称用「你」，不用「您」。
6. 语气现代、直白、技术化。禁止文言腔与古风词（不用「呈上」「答曰」「归页」「方可」「即可予以」等），禁止营销浮夸词（不用「极致」「赋能」「打造」「一站式」「焕新」）。
7. 祈使句保留动词：`Run the command` → `运行该命令`。被动语态尽量转主动。
8. 长句拆分：单句超过 40 个汉字优先断句。
9. `Section titled "..."` 这类官方页脚噪音行直接删除。
10. 表格：表头翻译，单元格里的代码/规则名保留英文；对齐符号 `---` 行数量不变。
11. 不增不删：不得添加原文没有的段落、提示、勘误、译注；不得省略原文内容。技术名词后的官方链接保留在原位。
12. 数字与单位保持原样（`97%`、`500+`、`545`、`2.5.13`、`10ms`）。

## 四、产出格式

- 输出文件：UTF-8，无 BOM，LF 换行。
- 只写 Markdown/MDX 正文，不加 ``` 包裹整个文件，不加解释性前言。
- 标题层级与数量与源文件一致（源文件有 N 个 `##`/`###`，译文也必须正好 N 个，顺序一致）。
- 每个文件写完后自行核对：`anchors` 元素个数 == 源文件标题数；代码块 ``` 计数为偶数。
