---
date: 2026-06-17
topic: todolist-floating-window
---

## Summary

在消息区右上角添加一个可拖拽的 TodoList 浮动窗口，作为待办事项的主要展示入口。有 todo 时自动出现，全部完成时收起为标题栏摘要（显示"待办 x/y"），跟随主题切换，位置持久化到 localStorage。

---

## Key Decisions

**浮动窗为主入口，StatusPanel todo tab 保留为备用。** 用户已有通过底部 StatusPanel 访问 todo 的路径，不破坏该习惯。浮动窗提供更显眼的实时进度可见性。

**收起形态为标题栏摘要，非完全隐藏。** 收起后保留标题栏显示"待办 x/y"进度，用户始终能感知 todo 存在，无需主动查找。

**位置可拖拽，默认右上角，位置持久化。** 默认位置与用户截图中红框区域一致，拖拽后记住位置，跨会话恢复。

---

## Requirements

**展示与可见性**

- R1. 浮动窗在当前会话存在至少一个非 completed 的 todo 时自动显示，初始状态为收起
- R2. 当前会话所有 todo 均为 completed 时，浮动窗自动收起为标题栏摘要形态
- R3. 当前会话没有任何 todo 数据时，浮动窗不显示（不占用空间）
- R4. 标题栏摘要显示"待办 x/y"格式的进度文本，x 为已完成数，y 为总数

**展开与收起**

- R5. 标题栏显示展开/收起指示图标（chevron），点击标题栏可切换展开/收起状态，鼠标悬停时显示 cursor: pointer
- R6. 展开状态显示完整 todo 列表，每条显示状态图标（pending / in_progress / completed）和文本内容
- R7. 收起状态仅显示标题栏摘要，隐藏列表内容

**拖拽与定位**

- R8. 浮动窗支持鼠标拖拽移动，拖拽区域为标题栏
- R9. 默认位置为消息区右上角（距右侧和顶部各 16px）
- R10. 拖拽后的位置持久化到 localStorage，下次打开应用时恢复
- R11. 拖拽不应超出消息区 viewport 可见范围；拖拽过程中窗口位置应 clamp 使其始终完全可见

**会话跟随**

- R12. 切换会话时，浮动窗根据新会话的 todo 数据决定显示/隐藏
- R13. 切换会话时，若新会话有 todo 数据，浮动窗收起为标题栏摘要；若无 todo 数据，浮动窗完全隐藏

**主题与样式**

- R14. 浮动窗使用项目现有的 CSS 变量（`--surface-card`、`--text-stronger`、`--border-muted` 等），跟随主题自动切换
- R15. 浮动窗宽度固定约 280px，展开状态最大高度约 320px，超出部分可滚动
- R16. 浮动窗使用圆角卡片样式，带轻微阴影，与项目整体视觉风格一致

**与 StatusPanel 的关系**

- R17. StatusPanel 底部的 todo tab 继续保留，数据来源与浮动窗相同（均来自 `useStatusPanelData`）
- R18. 浮动窗和 StatusPanel todo tab 展示相同的数据，无独立数据源

---

## Scope Boundaries

**不在范围内：**

- 从浮动窗交互操作 todo 条目（勾选完成、修改状态）—— 仅展示，操作通过消息流进行
- 从浮动窗新增 todo 条目
- 浮动窗内的搜索或过滤功能
- 跨会话的 todo 汇总或历史查看

---

## Acceptance Examples

- AE1. **有活跃 todo 时自动出现**
  - **Given:** 当前会话有 3 个 todo（1 completed, 1 in_progress, 1 pending）
  - **When:** 消息区渲染完成
  - **Then:** 浮动窗以收起形态出现在右上角，标题栏显示"进程 1/3"

- AE2. **全部完成时收起**
  - **Given:** 浮动窗处于展开状态，显示 3 个 todo
  - **When:** 最后一个 todo 变为 completed
  - **Then:** 浮动窗自动收起为标题栏摘要，显示"进程 3/3"

- AE3. **无 todo 时完全隐藏**
  - **Given:** 当前会话没有任何 TodoWrite 工具调用
  - **When:** 消息区渲染
  - **Then:** 浮动窗不显示，不占用任何空间

- AE4. **切换会话后跟随**
  - **Given:** 会话 A 有活跃 todo，浮动窗已显示
  - **When:** 切换到会话 B（无 todo）
  - **Then:** 浮动窗隐藏；切换回会话 A 时，浮动窗重新显示并恢复之前的展开/收起状态

- AE5. **拖拽后位置记忆**
  - **Given:** 浮动窗在默认右上角位置
  - **When:** 用户将浮动窗拖拽到左下角，然后刷新页面
  - **Then:** 浮动窗出现在左下角（上次拖拽的位置）

---

## Outstanding Questions

**Resolve Before Planning**

- R13 vs AE4 展开/收起状态策略矛盾：R13 要求切换会话时重置为收起，AE4 要求恢复之前的展开/收起状态。需要决定：切换会话时展开/收起状态是重置还是按会话记忆？（涉及 scope-guardian, design-lens, product-lens, coherence, feasibility）

**Deferred to Planning**

- 问题陈述缺失：为什么 StatusPanel 底部的 todo tab 不够用？浮动窗解决了什么具体用户痛点？需要补充 Problem Frame（product-lens）
- 替代方案评估缺失：浮动窗的实现成本较高（拖拽、边界约束、z-index、持久化），更简单的替代方案（内联 banner、增强 StatusPanel tab）是否被考虑过？需要在 Key Decisions 中补充（product-lens）
