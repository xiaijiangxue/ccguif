---
date: 2026-06-20
type: refactor
status: active
origin: docs/brainstorms/2026-06-20-idea-style-diff-visual-requirements.md
---

# refactor(diff-viewer): IDEA 风格 diff 视觉改造

为 split 模式的 diff viewer 添加 IntelliJ IDEA 风格的视觉元素，提升变更区域的可辨识度。

---

## Problem Frame

当前 diff viewer 的 split 模式仅有 1px border 分隔左右 pane，变更区域之间缺乏视觉连接。删除行使用红色背景，与 IDEA 灰色风格不一致。整体变更区域不够"明确"，需要通过连接器、标记条和颜色调整来增强可读性。

---

## Requirements

(see origin: `docs/brainstorms/2026-06-20-idea-style-diff-visual-requirements.md`)

**R1-R4** — split 模式下左右 pane 间渲染梯形/多边形色块连接对应变更区域，颜色与 diff 类型一致，跟随滚动同步。

**R5 (partial)** — 基本透明度变化已实现（0.35-0.45 → 0.55），hover 动效优化推迟。

**Gutter 变更标记条：** R6-R7 — 每行右侧 gutter 渲染 2-3px 宽的彩色竖条。

**删除行颜色调整：** R8-R9 — 删除行背景色从红色改为 IDEA 灰色系。

---

## Key Technical Decisions

**KTD1: 连接器采用 SVG overlay 方案。** 在 `.diff-block-split` 的 CSS grid 中插入第三个列（connector 列），内含绝对定位的 SVG 元素。SVG 绘制梯形/多边形路径连接对应变更块。理由：SVG 天然支持任意多边形绘制，与 CSS scroll 同步无障碍，性能优于 canvas（DOM 挂载在滚动容器内自动跟随）。IDEA 自身也是用 Java2D Path2D 绘制类似形状。

**KTD2: 连接器数据来源于现有 `splitPaneEntries`。** 不新增 diff 计算逻辑。遍历 `splitPaneEntries`，根据 left/right 的 line.type 判断变更类型和位置，计算梯形顶点坐标。context 行不绘制连接器，仅计算垂直偏移。

**KTD3: Gutter 标记条使用 CSS `::after` 伪元素。** 在 `.diff-line-add` / `.diff-line-del` 上添加 `::after` 伪元素，绝对定位在行右侧，渲染 2-3px 宽的彩色竖条。无需修改组件 JSX，纯 CSS 实现。

---

## High-Level Technical Design

### 分割线连接器布局

```
┌─────────────────────────────────────────────────────┐
│                  .diff-block-split                   │
│  ┌──────────────┬────────────┬──────────────┐       │
│  │  pane-old    │ connector  │  pane-new    │       │
│  │              │   (SVG)    │              │       │
│  │  1fr         │  12px      │  1fr         │       │
│  └──────────────┴────────────┴──────────────┘       │
└─────────────────────────────────────────────────────┘
```

### 连接器梯形计算

每个 `pair` 类型的 row，若 left（del）和 right（add）同时存在，计算：
- 左侧梯形：从左 pane 边缘 → connector 列左侧（删除=灰色，未配对新增=绿色）
- 右侧梯形：从 connector 列右侧 → 右 pane 边缘（绿色）
- 未配对行（left=null 或 right=null）：梯形从单侧边缘延伸到 connector 对侧边缘

```
  left pane        connector       right pane
  ┌────────┐      ╱╲╱╲╱╲         ┌────────┐
  │del line│─────╱    ╲──────────│add line│
  │        │────╱      ╲─────────│        │
  └────────┘   ╱  SVG   ╲       └────────┘
```

---

## Implementation Units

### U1. 删除行颜色调整

**Goal:** 将删除行背景色从红色系改为 IDEA 风格灰色系。

**Requirements:** R8, R9

**Dependencies:** 无

**Files:**
- `src/styles/diff-viewer.css` — 修改 CSS 变量

**Approach:**
修改 `.diff-viewer-output` 下的 CSS 变量：
- `--diff-line-del-bg`: 红色系 → 灰色系（Dark: `color-mix(in srgb, #656e76 24%, bg)`, Light: `color-mix(in srgb, #9f9f9f 14%, bg)`）
- `--diff-line-del-text`: 红色文字 → 中性文字（Dark: `rgba(200, 210, 220, 0.95)`, Light: `rgba(40, 40, 40, 0.96)`）
- `--diff-line-del-gutter`: 红色行号 → 灰色行号（Dark: `rgba(160, 170, 180, 0.85)`, Light: `rgba(100, 100, 100, 0.78)`）
- 同步更新 `[data-theme="light"]`、`[data-theme="dark"]`、`@media (prefers-color-scheme)` 下的覆盖

**Patterns to follow:** 现有 CSS 变量覆盖模式（`diff-viewer.css:1034-1124`）

**Test expectation: none** — 纯颜色调整，无行为变更

**Verification:** 打开 split 模式 diff，确认删除行背景为灰色调而非红色调，light/dark/system 三主题下均正确

---

### U2. Gutter 变更标记条

**Goal:** 在每行右侧添加彩色竖条，直观指示变更类型。

**Requirements:** R6, R7

**Dependencies:** 无

**Files:**
- `src/styles/diff-viewer.css` — 添加 `::after` 伪元素样式

**Approach:**
在 `.diff-line-add` 和 `.diff-line-del` 上添加 `::after` 伪元素：
- 绝对定位在行右侧（`right: 0`），宽 3px，高 100%
- 添加新的 CSS 变量 `--diff-line-add-marker` 和 `--diff-line-del-marker` 控制颜色
- 颜色比行背景色更高饱和度（Dark add: `#3fb950`, Dark del: `#8a9199`; Light add: `#16a34a`, Light del: `#767a8a`）
- 同步更新三主题下的变量值
- R6 的修改=蓝色标记暂不实现（与 U3 的 R2 修改连接器一致，待 diff 解析器区分 modified vs added 后补全）
- `.diff-line` 已有 `position: relative`（line 1132），`::after` 伪元素使用 `right: 0; top: 0; bottom: 0` 自然包含在元素边界内，无需添加 `overflow: hidden`（避免裁剪 annotation button 和长行水平滚动）

**Patterns to follow:** `.diff-line.is-selected::before` 已有类似的伪元素定位模式

**Test expectation: none** — 纯视觉元素，无行为变更

**Verification:** 打开 split/unified 模式 diff，确认新增行右侧有绿色竖条，删除行右侧有灰色竖条，hover 行时竖条可见

---

### U3. Divider 连接器

**Goal:** 在 split 模式左右 pane 之间渲染梯形/多边形色块，连接对应的变更区域。

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** 无（连接器颜色由 line.type 独立计算，不依赖 U1 的 CSS 变量）

**Files:**
- `src/features/git/components/DiffBlock.tsx` — 添加 connector 列和 SVG 渲染
- `src/styles/diff-viewer.css` — connector 列布局和 SVG 样式
- `src/features/git/components/DiffBlock.test.tsx` — 更新受新 connector 列影响的断言，添加 split 模式 connector 渲染测试

**Approach:**

*JSX 结构变更：*
在 `.diff-block-split` 的 CSS grid 中，于 `.diff-split-pane-old` 和 `.diff-split-pane-new` 之间插入 connector 列（DiffBlock.tsx split 渲染分支约 line 327 处）：
```jsx
<div className="diff-block-split">
  <div className="diff-split-pane diff-split-pane-old">...</div>
  <div className="diff-split-connector">
    <svg className="diff-connector-svg">
      {/* 梯形路径通过 useMemo 计算 */}
    </svg>
  </div>
  <div className="diff-split-pane diff-split-pane-new">...</div>
</div>
```

*连接器数据计算（useMemo）：*
1. 遍历 **所有** `splitPaneEntries`（包括 header-kind 行），记录每个变更块的起始/结束行索引。header-kind 行贡献 Y 偏移但不产生连接器 polygon
2. 根据 left.line.type / right.line.type 确定变更类型（add/del；modified 类型当前不存在，待 diff 解析器扩展后补全）
3. 计算每个变更块在 SVG 中的 Y 坐标（行索引 × 行高）
4. 输出 `ConnectorPath[]`：`{ type, leftY1, leftY2, rightY1, rightY2 }` 其中 type 决定颜色

*SVG 绘制：*
SVG 元素尺寸：`position: absolute; top: 0; left: 0; width: 100%; height: 100%`，不使用 viewBox，直接使用像素坐标。SVG 总高度由 grid 自动撑开（匹配两侧 pane 内容高度）。

每个连接器路径使用 `<polygon>` 元素：
- 颜色根据变更类型映射（add=绿色系，del=灰色系）
- R2 的修改=蓝色系暂不实现，因当前 split 行数据无 modified 类型，待 diff 解析器扩展后补全
- 透明度 0.35-0.45，hover 时提升到 0.55（通过 CSS `:hover` 或状态管理）
- 未配对删除：左侧梯形从 pane 边缘延伸到 connector 列中线
- 未配对新增：右侧梯形从 connector 列中线延伸到 pane 边缘
- 双侧都有：两个梯形对接在 connector 列中线

*CSS 布局：*
```css
.diff-block-split {
  grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
}
.diff-split-connector {
  position: relative;
  overflow: hidden;
}
/* 移除旧的 1px 分割线，角色由 connector 列接管 */
.diff-split-pane-old {
  border-right: none;
}
/* connector 列在未变更区域显示细分割线 */
.diff-split-connector::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--diff-split-divider);
  z-index: 1;
}
```

*连接器颜色 CSS 变量：*
在 `.diff-viewer-output` 下新增变量（三主题同步）：
- `--diff-connector-add-bg`: 绿色系，与 `--diff-line-add-bg` 同色系但更高不透明度（Dark: `rgba(63, 185, 80, 0.4)`, Light: `rgba(22, 163, 74, 0.35)`）
- `--diff-connector-del-bg`: 灰色系（Dark: `rgba(101, 110, 118, 0.4)`, Light: `rgba(159, 159, 159, 0.35)`）

*滚动同步：*
connector 列与两侧 pane 在同一个 `.diff-block-split` grid 内，父容器 `.diff-viewer`（`overflow-y: auto`）提供统一垂直滚动，两 pane 不独立垂直滚动，connector 天然垂直同步。水平滚动由 `.diff-split-pane` 的 `overflow-x: auto` 独立控制，connector 列不参与水平滚动（仅渲染变更区域的连接形状，不影响代码内容滚动）。

*行高同步：*
每行实际渲染高度 = `fontSize × lineHeightRatio + 4px`（上下 padding 各 2px，参见 `min-height: calc(1em * var(--code-line-height, 1.28) + 4px)`）。推荐通过 `getBoundingClientRect()` 在渲染时测量首行 `.diff-line` 的实际高度并缓存，而非使用固定公式，以应对未来 CSS 变量或 font-size 变化。SVG 中 polygon 的 Y 坐标使用 `rowIndex × measuredRowHeight`。

**Patterns to follow:** `.diff-block-split` 已有的 grid 布局模式

**Test scenarios:**
- 有新增行的 diff：确认绿色梯形连接从左侧（空）到右侧（新增行）的位置正确
- 有删除行的 diff：确认灰色梯形连接从左侧（删除行）到右侧（空）的位置正确
- 新增+删除混合 diff：确认梯形正确对接
- context 行区域：确认无连接器渲染
- 滚动时：确认连接器跟随行内容同步滚动
- split/unified 切换：确认 connector 列仅在 split 模式渲染

**Verification:** 打开含新增/删除行的 split diff，确认梯形连接器正确显示且颜色与行类型一致；滚动时连接器同步移动

---

## Scope Boundaries

**Deferred for later:**
- 词级/字符级 inline diff 高亮
- 修改行的独立蓝色背景（需 diff 解析器区分 modified vs added）
- 色盲适配配色方案
- 连接器 hover 动效优化（R5 仅实现基本透明度变化）

---

## Sources / Research

- IDEA 分割线连接器实现: `DiffDividerDrawUtil.java` (JetBrains/intellij-community)
- IDEA diff 颜色定义: `DefaultColorSchemesManager.xml` (JetBrains/intellij-community)
- 当前 diff 组件: `src/features/git/components/DiffBlock.tsx`
- 当前 split 行配对: `DiffBlock.tsx` → `buildSplitRows()` (line 74-159)
- 当前 CSS 变量: `src/styles/diff-viewer.css` (line 746-764, 1034-1124)

---

## Deferred / Open Questions

### From 2026-06-20 review

- **12px connector column too narrow for meaningful trapezoid shapes** — KTD1 / 高层技术设计 (P2, adversarial, confidence 75)

  IDEA 的 diff divider 通常 20-40px 宽。在 12px 下，梯形从一侧边缘到中点仅覆盖 6px 水平距离，行高约 20px 时产生高宽比约 3:1 的窄条，可能难以辨识为梯形形状。连接器的视觉辨识度（区别于普通分割线的核心特征）受到影响。建议考虑扩宽到 16-20px，或简化为三角形标记（删除指向左，新增指向右）。

  <!-- dedup-key: section="ktd1 / 高层技术设计" title="12px connector column too narrow for meaningful trapezoid shapes" evidence="grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr)" -->
