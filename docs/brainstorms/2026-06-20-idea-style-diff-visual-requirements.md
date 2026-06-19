---
date: 2026-06-20
topic: idea-style-diff-visual
---

## Summary

为 split 模式的 diff viewer 添加 IntelliJ IDEA 风格的视觉元素：左右 pane 间的梯形/多边形连接器、gutter 变更类型标记条、以及删除行颜色从红色调整为灰色。

---

## Requirements

### Divider 连接器

- R1. split 模式下，左右 pane 之间的 divider 区域渲染梯形/多边形色块，视觉连接对应的新增/删除/修改变更区域
- R2. 连接器颜色与对应行的 diff 类型一致（新增=绿色系，删除=灰色系，修改=蓝色系）
- R3. 连接器跟随滚动同步，位置与对应的 diff 行实时对齐
- R4. 未配对的变更区域（仅有左侧删除或仅有右侧新增）连接器从边缘延伸到 divider 边界
- R5. 连接器在 hover 时可轻微高亮或加粗，提供交互反馈

### Gutter 变更标记条

- R6. 每行右侧 gutter 渲染 2-3px 宽的彩色竖条，指示变更类型：新增=绿色，删除=灰色，修改=蓝色
- R7. 标记条颜色与行背景色同色系但更高饱和度，确保在浅/深色主题下均可辨识

### 删除行颜色调整

- R8. 删除行背景色从当前红色系改为 IDEA 风格灰色系（Light: `#9f9f9f` 系，Dark: `#656e76` 系），保持适度透明度
- R9. 删除行 gutter 文字颜色同步调整为灰色系

---

## Scope Boundaries

**Deferred for later:**
- 词级/字符级 inline diff 高亮（当前 DiffBlock 无字符级 diff 计算）
- 修改行的独立蓝色背景（当前 diff 解析器未区分 modified vs added）
- 色盲适配配色方案

---

## Sources / Research

- IDEA diff 颜色定义: `platform/platform-resources/src/DefaultColorSchemesManager.xml` (JetBrains/intellij-community)
- IDEA 分割线连接器: `platform/diff-impl/src/com/intellij/diff/util/DiffDividerDrawUtil.java`
- 当前 diff viewer 组件: `src/features/git/components/DiffBlock.tsx`
- 当前 diff viewer CSS: `src/styles/diff-viewer.css`
- 当前 split 行配对逻辑: `DiffBlock.tsx` → `buildSplitRows()`
