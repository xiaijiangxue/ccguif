---
title: "feat: 消息区 TodoList 浮动窗口"
type: feat
status: active
date: 2026-06-17
origin: docs/brainstorms/2026-06-17-todolist-floating-window-requirements.md
---

## Summary

在消息区添加可拖拽的 TodoList 浮动窗口，有活跃 todo 时自动显示、可展开/收起、位置跨会话持久化、展开状态按会话记忆，作为 todo 进度的显眼实时可见性入口。

---

## Problem Frame

StatusPanel 底部的 todo tab 虽然提供了 todo 数据访问路径，但处于右侧面板底部，用户需要主动切换 tab 才能看到进度。对于长时间运行的会话，todo 进度是用户最关心的实时信息之一，需要一个始终可见但不干扰的展示入口。浮动窗口通过在消息区右上角常驻显示，解决了"进度可见性需要主动查找"的痛点。

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
- R13. 切换会话时，若新会话有 todo 数据，浮动窗恢复该会话之前的展开/收起状态；若无 todo 数据，浮动窗完全隐藏（采纳 AE4，per-session 状态记忆）

**主题与样式**

- R14. 浮动窗使用项目现有的 CSS 变量（`--surface-card`、`--text-stronger`、`--border-muted` 等），跟随主题自动切换
- R15. 浮动窗宽度固定约 280px，展开状态最大高度约 320px，超出部分可滚动
- R16. 浮动窗使用圆角卡片样式，带轻微阴影，与项目整体视觉风格一致

**与 StatusPanel 的关系**

- R17. StatusPanel 底部的 todo tab 继续保留，数据来源与浮动窗相同（均来自 `useStatusPanelData`）
- R18. 浮动窗和 StatusPanel todo tab 展示相同的数据，无独立数据源

---

## Key Technical Decisions

**拖拽使用 framer-motion 的 drag prop。** 项目已安装 `framer-motion`（package.json），其 `drag` / `dragConstraints` / `dragMomentum={false}` 提供声明式拖拽实现，比原生 pointer events 手动管理更简洁，且内置边界约束能力。（对比：DesktopLayout 的分割线拖拽使用原生 pointer events，但那是更复杂的 resize 场景，浮动窗的简单拖拽不需要同等控制力。）

**组件归属 status-panel feature 目录。** 浮动窗与 StatusPanel 共享数据源（`useStatusPanelData`）、TodoItem 类型定义、TodoList 组件，概念上属于 todo 状态展示的一部分，而非独立 feature。放置在 `src/features/status-panel/components/` 下。

**per-session 展开/收起状态使用 session ID 作 key。** localStorage key 为 `ccgui.todoFloating.expand.<sessionId>`，值为 `"1"`/`"0"`。切换回历史会话时恢复之前的展开/收起状态，新会话默认收起。（采纳 AE4 行为，修正原 R13 中的"重置为收起"策略。）

---

## Implementation Units

### U1. useTodoFloatingState hook

**Goal:** 实现浮动窗口的全部状态逻辑——可见性判断、展开/收起（含 per-session 持久化）、位置（含 localStorage 持久化和边界 clamp）。

**Requirements:** R1, R2, R3, R4, R10, R11, R12, R13

**Dependencies:** 无（第一个实现单元）

**Files:**
- `src/features/status-panel/hooks/useTodoFloatingState.ts`（新建）
- `src/__tests__/hooks/useTodoFloatingState.test.ts`（新建）

**Approach:**
- 接收 `todos: TodoItem[]` 和 `sessionId: string` 参数
- 返回 `{ visibility, summaryText, isExpanded, toggleExpand, position, setPosition, dragProps, defaultPosition, dragConstraintsRef }`
- `visibility`: `"hidden"` | `"collapsed"` | `"expanded"`，基于 todos 数组自动计算
- 展开/收起状态存 localStorage（key 含 sessionId），切换会话时自动恢复
- 位置存 localStorage（全局 key，跨会话共享），提供默认位置（右上角 16px offset）
- `dragConstraintsRef` 绑定父容器 ref，配合 framer-motion 实现边界 clamp
- 使用 `useRef` + `useCallback` 保持引用稳定，避免不必要的重渲染

**Patterns to follow:**
- 数据读取模式参考 `src/features/messages/constants/liveCanvasControls.ts` 的 `readLocalBooleanFlag`/`writeLocalBooleanFlag`（try-catch 包裹 localStorage）
- localStorage key 前缀约定：`ccgui.todoFloating.*`
- hook 导出为 named export，使用 `memo` 包裹时不需要（hook 本身无渲染）

**Test scenarios:**
- R3. todos 为空数组时，返回 visibility = "hidden"
- R1/R2. todos 含未完成项时返回 "collapsed"；全部 completed 时返回 "collapsed"（而非 "hidden"）
- R4. summaryText 格式为"待办 {completed}/{total}"
- R13. 不同 sessionId 返回各自独立的 isExpanded 状态
- R10. setPosition 后重新读取 hook 返回更新后的位置
- R11. 位置超出边界时被 clamp 到可见范围内
- R10. 无 localStorage 数据时返回默认位置（距右上角 16px）

**Verification:**
- hook 单元测试覆盖上述所有场景
- 不同 sessionId 的展开/收起状态互不干扰
- 位置持久化：写入 → 重新读取 → 值一致

---

### U2. TodoFloatingWindow 组件

**Goal:** 实现浮动窗口的 UI 渲染——标题栏（含摘要文本和 chevron 图标）、可滚动的 todo 列表、framer-motion 拖拽行为。

**Requirements:** R4, R5, R6, R7, R8, R9, R14, R15, R16

**Dependencies:** U1

**Files:**
- `src/features/status-panel/components/TodoFloatingWindow.tsx`（新建）
- `src/__tests__/components/TodoFloatingWindow.test.tsx`（新建）

**Approach:**
- 组件为 `memo` 包裹的函数组件，接收 `todos` 和 `sessionId` props
- 内部调用 `useTodoFloatingState` 获取状态
- 标题栏：显示"待办 x/y" + ChevronDown/ChevronRight 图标（lucide-react），点击触发 toggleExpand
- 展开时：渲染 todo 列表，复用现有 `TodoList` 组件（或内联渲染，因浮动窗样式与 StatusPanel 内的样式略有差异）
- 使用 framer-motion 的 `motion.div` + `drag` prop 实现标题栏拖拽
- `dragConstraints` 绑定父容器 ref 以实现边界 clamp
- `dragMomentum={false}` 防止惯性滑动
- 容器 ref 使用 `useRef<HTMLDivElement>`，通过 `useImperativeHandle` 或 props 回调暴露给父级供 dragConstraints 使用

**Patterns to follow:**
- TodoItem 渲染参考 `src/features/status-panel/components/TodoList.tsx` 的图标映射：Circle (pending)、Loader2 (in_progress)、CheckCircle2 (completed)
- lucide-react 图标导入方式：`import { ChevronDown } from 'lucide-react'`
- 组件命名：`TodoFloatingWindow`，Props 接口：`TodoFloatingWindowProps`

**Test scenarios:**
- R4. 标题栏显示"待办 1/3"格式文本
- R5. 标题栏包含 chevron 图标，点击后调用 toggleExpand
- R7. 收起状态时列表内容不可见
- R6. 展开状态时渲染完整 todo 列表，每条包含状态图标和文本
- R15. 展开时容器最大高度受限（约 320px），超出内容可滚动
- R16. 容器具有圆角卡片样式和阴影

**Verification:**
- 组件渲染测试覆盖收起/展开两种状态
- chevron 点击交互测试
- 滚动区域在内容超出时出现

---

### U3. CSS 样式与布局集成

**Goal:** 创建浮动窗口的样式文件，实现绝对定位挂载，确保与项目主题系统一致。

**Requirements:** R9, R14, R15, R16, R17, R18

**Dependencies:** U1, U2

**Files:**
- `src/styles/todo-floating-window.css`（新建）
- `src/features/messages/components/Messages.tsx`（修改：导入 CSS 并挂载浮动窗）
- `src/features/messages/components/MessagesTimeline.tsx` 或 `src/features/layout/hooks/useLayoutNodes.tsx`（修改：集成浮动窗到消息区布局）

**Approach:**
- CSS 类名前缀：`tfw-`（todo floating window）
- 容器定位：`position: absolute`，挂载在 `.messages-shell` 内（该容器已有 `position: relative`）
- 默认位置：`top: 16px; right: 16px`
- z-index: 1000（高于内容面板 20-55，低于模态框 2000+）
- 使用 CSS 变量：`background: var(--surface-card)`、`border: 1px solid var(--border-muted)`、`color: var(--text-strong)` 等
- 宽度：`width: 280px`
- 展开状态：`max-height: 320px; overflow-y: auto`
- 圆角：`border-radius: 12px`（参考项目中卡片样式）
- 阴影：`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)`
- 拖拽区域（标题栏）：`cursor: grab`，拖拽中 `cursor: grabbing`
- 集成方式：在 Messages 组件的 JSX return 中，于 `.messages-shell` 内添加 `<TodoFloatingWindow />` 作为 `<MessagesTimeline>` 的兄弟节点

**Patterns to follow:**
- CSS 文件组织参考 `src/styles/status-panel.css`
- CSS 变量参考 `src/styles/themes.dark.css` / `src/styles/themes.light.css`
- 消息区 DOM 结构：`.messages-shell` > `.messages` > `.messages-full`，浮动窗挂载在 `.messages-shell` 层级

**Test scenarios:**
- R9. 浮动窗出现在消息区右上角（距右侧和顶部各 16px）
- R14. 切换主题（dark/light）时浮动窗样式跟随变化
- R15. 浮动窗宽度为 280px，展开时最大高度 320px
- R16. 浮动窗具有圆角和阴影
- R17. StatusPanel todo tab 仍然正常显示
- R18. 浮动窗与 StatusPanel todo tab 显示相同数据

**Test expectation:** 样式集成测试以视觉验证为主；定位和 z-index 通过 snapshot 或 computed style 测试。

**Verification:**
- 浮动窗在消息区中正确渲染，不遮挡消息内容
- 主题切换后样式正确跟随
- 拖拽后位置保持在消息区可见范围内

---

## Scope Boundaries

**不在范围内：**

- 从浮动窗交互操作 todo 条目（勾选完成、修改状态）—— 仅展示，操作通过消息流进行
- 从浮动窗新增 todo 条目
- 浮动窗内的搜索或过滤功能
- 跨会话的 todo 汇总或历史查看

**Deferred to Follow-Up Work:**

- 增强 StatusPanel todo tab 的功能（如进度条、筛选）
- 浮动窗的动画过渡效果（展开/收起的平滑动画）

---

## Acceptance Examples

- AE1. **有活跃 todo 时自动出现**
  - **Given:** 当前会话有 3 个 todo（1 completed, 1 in_progress, 1 pending）
  - **When:** 消息区渲染完成
  - **Then:** 浮动窗以收起形态出现在右上角，标题栏显示"待办 1/3"

- AE2. **全部完成时收起**
  - **Given:** 浮动窗处于展开状态，显示 3 个 todo
  - **When:** 最后一个 todo 变为 completed
  - **Then:** 浮动窗自动收起为标题栏摘要，显示"待办 3/3"

- AE3. **无 todo 时完全隐藏**
  - **Given:** 当前会话没有任何 TodoWrite 工具调用
  - **When:** 消息区渲染
  - **Then:** 浮动窗不显示，不占用任何空间

- AE4. **切换会话后跟随**
  - **Given:** 会话 A 有活跃 todo，浮动窗已展开
  - **When:** 切换到会话 B（无 todo），再切换回会话 A
  - **Then:** 会话 B 时浮动窗隐藏；切换回会话 A 时浮动窗重新显示并恢复展开状态

- AE5. **拖拽后位置记忆**
  - **Given:** 浮动窗在默认右上角位置
  - **When:** 用户将浮动窗拖拽到左下角，然后刷新页面
  - **Then:** 浮动窗出现在左下角（上次拖拽的位置）
