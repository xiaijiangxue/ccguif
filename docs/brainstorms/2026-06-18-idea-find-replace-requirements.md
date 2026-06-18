# IDEA 风格 Find/Replace 栏 — 需求文档

---

## Summary

将 CodeMirror 编辑器的内建搜索栏改造为 IntelliJ IDEA 风格。核心变化：两行布局（Find 行 + Replace 行）、选项从 checkbox 改为切换按钮、搜索图标、结果计数、面板浮动覆盖不推挤内容、字体统一。

---

## Problem Frame

当前搜索栏使用 CodeMirror 默认 SearchPanel，CSS 做了视觉定制但结构仍是单行 flex-wrap 布局。与 IDEA 相比存在以下差距：

1. **单行混排** — Find 和 Replace 元素挤在一行，flex-wrap 导致窄屏时换行位置不可控
2. **Checkbox 控件** — 原生 checkbox 与 IDEA 的文字切换按钮风格不一致
3. **缺少搜索图标** — IDEA 的搜索图标（🔍）提供视觉锚点，当前实现无此元素
4. **缺少结果计数** — "N 个结果" 提供即时反馈，当前缺失
5. **红色关闭按钮** — 当前红色圆圈过于醒目，IDEA 使用低调的灰色关闭按钮
6. **面板推挤内容** — 当前面板占据编辑器空间，IDEA 浮动覆盖更优雅
7. **字体不统一** — 搜索栏与编辑器/界面其他部分字体大小或族未完全一致

---

## Key Decisions

1. **自定义 `createPanel` 而非纯 CSS hack** — CodeMirror `search()` 扩展支持 `createPanel` 参数，允许完全自定义面板 DOM。这比用 CSS hack 重排 DOM 更干净可靠。

2. **保持 `name` 属性兼容** — CodeMirror 内部通过 `name` 属性匹配 input（`search`、`replace`），自定义 DOM 必须保留这些 name。

3. **面板浮动覆盖** — `position: absolute` 浮在编辑器顶部，不推挤内容。Escape 关闭。

4. **两行独立显示** — Find 单独一行，Replace 固定在下方。不使用折叠/展开交互（保持简单）。

5. **选项按钮用 CSS 改造 label** — 隐藏原生 checkbox，用 label + `:checked` 伪类样式化为 IDEA 风格切换按钮。

---

## Requirements

### R1: 两行布局

面板 DOM 分为两行：
- **Find 行**：搜索图标 | 输入框 | 大小写(Aa) | 全词(W) | 正则(*) | 结果计数 | 上一个(↑) | 下一个(↓) | 关闭(X)
- **Replace 行**：搜索图标 | 输入框 | 替换按钮 | 全部替换按钮

每行使用独立 flex 容器，行间距 ~4px。

### R2: 搜索图标

Find 行和 Replace 行左侧各有一个搜索/替换图标（使用 codicon），尺寸 ~14px，颜色为 `var(--fvp-reader-text)` 或类似 muted 色。

### R3: 选项切换按钮

隐藏原生 `<input type="checkbox">`，将 `<label>` 样式化为：
- **默认态**：透明背景，muted 文字，13px semibold
- **激活态**：背景 `color-mix(in srgb, var(--border-accent) 12%, transparent)`，文字变亮，微妙 accent 边框
- **Hover**：介于默认和激活之间的过渡态

使用 CSS `label:has(input:checked)` 选择器匹配激活态。

### R4: 结果计数

在选项按钮后显示 "N 个结果" 或 "0 个结果"（匹配当前语言）。使用 DOM 节点 + MutationObserver 或 input 事件监听来更新计数。

字体：13px，regular weight，muted 色。

### R5: 关闭按钮

去掉红色圆圈样式，改为：
- 24x24px，圆形
- 默认态：透明背景，muted 图标（codicon `close`）
- Hover：轻微背景高亮
- 不使用 `::before` 注入字符，改用 codicon 字体图标

### R6: 面板定位

- `position: absolute`，浮在编辑器顶部
- `z-index` 确保在行号上方
- 不推挤编辑器内容（`.cm-content` 的 padding-top 不变）
- 微妙底部边框分隔面板与内容

### R7: 字体统一

所有搜索面板元素（输入框、按钮、标签、计数）统一使用：
- `font-family: var(--ui-font-family)`
- `font-size: 13px`
- `line-height: 1.2`

### R8: 输入框样式

- 背景：`color-mix(in srgb, var(--surface-command) 88%, transparent)`
- 边框：1px subtle，圆角 6px
- Focus 态：accent 边框 + 微妙 glow
- 最小高度：28px（比当前 24px 略高，匹配 IDEA 行高）

### R9: 按钮样式

- 扁平按钮，无边框，透明背景
- Hover：轻微背景高亮
- Font：13px，semibold（导航按钮），regular（替换/全部替换）
- 替换按钮显示快捷键标签（可选，如 "替换" 而非 "replace"）

---

## Scope Boundaries

### In scope
- 自定义 `createPanel` 函数（TSX/JS）
- 搜索面板 CSS 全面重写
- `FileViewPanel.tsx` 接入自定义面板
- 字体统一

### Deferred
- 过滤器/范围选择器（IDEA 的漏斗图标功能）
- 搜索历史下拉
- 正则语法高亮
- 替换行折叠/展开交互

### Out of scope
- 全局搜索面板（WorkspaceSearchPanel）— 这是独立组件，不在本次范围内
- 搜索结果高亮样式 — 当前已足够好

---

## Success Criteria

1. Cmd+F 打开搜索栏，视觉风格接近 IDEA（两行、图标、切换按钮、结果计数）
2. Cmd+R 或 Replace 按钮展开替换行
3. 所有搜索功能正常工作（查找、替换、全部替换、大小写、全词、正则）
4. 字体在搜索栏内完全统一
5. 面板浮动覆盖，不推挤编辑器内容
