## Context

主界面实时对话页的 Composer 是重复工作界面，不应长期占用过多垂直空间。现有输入框已经有 resize / collapse hook，因此本次设计以复用现有状态机为前提，只补几何参数、兼容迁移和显式折叠入口。

## Decisions

### Decision 1: 只调整主 Composer 外层 padding

`src/styles/composer.part1.css` 中 `.composer` 的底部 padding 从 `24px` 收到 `8px`。该样式属于主界面 Composer 容器，不触碰 HomeChat 幕布输入框，避免再次误改场景。

### Decision 2: 用 v3 storage key 做高度迁移

旧 `chat-input-box:size-v2` 可能保存了用户手动高度。直接降低默认最小高度不足以影响这些用户，因此新增 `chat-input-box:size-v3`，首次读取 v2 时将 `wrapperHeightPx` 减去 `46px` 并 clamp 到新最小高度 `66px`。

不直接覆盖 v2，避免破坏回滚或调试时的旧记录。

### Decision 3: 折叠按钮复用 resize hook 状态

`useResizableChatInputBox` 暴露 `collapse()`，内部读取当前 wrapper 高度并保存后设置 `isCollapsed: true`。按钮不自行操作 DOM，不另建折叠状态，确保拖拽折叠、按钮折叠与持久化路径一致。

### Decision 4: 顶部控件保持 hover-only

resize grip 和折叠 icon 默认 `opacity: 0`，只在 hover/focus/resize 时显示。左右两个 icon 仅用于视觉对称和点击便利，不改变折叠后展开策略；折叠状态下仍保留现有 grip 展开能力。

## Risks / Mitigations

- Risk: 显式折叠按钮和拖拽手势状态分叉。  
  Mitigation: 按钮只调用 hook 暴露的 `collapse()`。

- Risk: 已持久化用户高度导致默认高度收紧无效。  
  Mitigation: 使用 v3 key 迁移 v2 高度并减去两行。

- Risk: hover 控件默认可见改变原交互语义。  
  Mitigation: 默认 opacity 保持 0，hover/focus/resize 才显示。

## Validation Plan

- Focused hook test: `npx vitest run src/features/composer/components/ChatInputBox/hooks/useResizableChatInputBox.test.ts`
- Static gates: `npm run lint`, `npm run typecheck`
- OpenSpec gate: `openspec validate tune-composer-input-bottom-affordance --strict --no-interactive`

## Rollback

- 将 `.composer` bottom padding 恢复为 `24px`。
- 将 `DEFAULT_MIN_WRAPPER_HEIGHT_PX` 恢复为旧值并回退 storage key 到 v2。
- 移除 `collapse()`、折叠按钮 JSX 与对应 CSS。

