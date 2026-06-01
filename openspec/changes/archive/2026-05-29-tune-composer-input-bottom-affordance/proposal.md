## Why

主界面 Composer 输入框在实时对话场景里占用高度偏大，且折叠到底部只能依赖拖拽手势，用户很难快速把输入框收起以释放消息阅读空间。

本变更把 Composer 几何收得更紧，并补一个 hover-only 的显式折叠入口；目标是减少视觉占用，同时不改变发送、草稿、拖拽 resize 与折叠展开状态机。

## 目标与边界

- 降低主界面 Composer 底部外边距和默认编辑区域高度。
- 保留现有拖拽 resize、拖拽折叠、拖拽展开、键盘微调能力。
- 在顶部拖拽 grip 两侧提供对称的折叠到底部 icon，默认隐藏，hover/focus/resize 时显示。
- 对旧版 `chat-input-box:size-v2` 持久化高度做一次兼容迁移，避免已有用户升级后仍保持旧高度。
- 改动范围限定在主界面 `ChatInputBox` / Composer 布局，不影响 HomeChat 幕布输入框。

## 非目标

- 不重做 Composer footer 工具条。
- 不改变 send / stop / model selector / context chip 行为。
- 不新增前端依赖。
- 不改变折叠后的展开交互策略。
- 不引入全局布局系统重构。

## What Changes

- 主 Composer 容器底部 padding 从 `24px` 收到 `8px`，让输入框更贴近底部。
- `ChatInputBox` 默认最小编辑区高度从 `112px` 收到 `66px`，约减少两行。
- localStorage key 从 `chat-input-box:size-v2` 升为 `chat-input-box:size-v3`，读取旧值时减去两行高度并做下限 clamp。
- `useResizableChatInputBox` 暴露显式 `collapse()`，供顶部折叠按钮复用原折叠状态。
- 顶部 resize grip 左右各显示一个折叠 icon，默认隐藏；hover/focus/resize 时显示，点击即折叠到底部。

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A | 只改 CSS 高度与 padding | 最小改动 | 旧用户持久化高度不会自动变小；没有显式折叠入口 | 不采用 |
| B | 在现有 resize hook 上增加 `collapse()` 与 v3 高度迁移 | 复用状态机，兼容旧持久化，改动面可控 | 需要补 hook 测试 | 采用 |
| C | 重写 Composer resize / collapse 控件 | 可统一交互模型 | blast radius 过大，容易影响发送和草稿链路 | 不采用 |

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `composer-control-surface`: Composer geometry 增加主输入框高度收紧、底部贴近、hover-only 对称折叠入口与旧高度迁移要求。

## Impact

- Frontend:
  - `src/styles/composer.part1.css`
  - `src/features/composer/components/ChatInputBox/ChatInputBox.tsx`
  - `src/features/composer/components/ChatInputBox/ResizeHandles.tsx`
  - `src/features/composer/components/ChatInputBox/hooks/useResizableChatInputBox.ts`
  - `src/features/composer/components/ChatInputBox/styles/layout.css`
- Tests:
  - `src/features/composer/components/ChatInputBox/hooks/useResizableChatInputBox.test.ts`
- No backend, IPC, storage schema, or dependency changes.

## 验收标准

- 主界面 Composer 底部红框区域明显缩小。
- 默认未手动 resize 的 Composer 编辑区高度约减少两行。
- 已存在 v2 持久化高度的用户升级后，初始高度也同步减少两行，但不得低于最小高度。
- 顶部折叠 icon 默认隐藏，只在 hover/focus/resize 时显示。
- 左右折叠 icon 视觉对称，点击任一 icon 都能折叠到底部。
- 原拖拽 resize、拖拽折叠、拖拽展开行为保持可用。

