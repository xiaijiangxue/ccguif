## Why

Composer 当前把 Context Ledger 的展开入口放在 readiness bar，把收起入口放在展开后的 ledger header，导致同一个 disclosure control 分裂到上下两个位置。管理便签、文件和 helper 上下文时，用户需要在不同区域来回找入口，操作路径不顺手。

## 目标与边界

- 将 Context Ledger 的展开 / 收起控制合并到 Composer 对话框右上角，也就是 readiness bar 的 context summary 操作区。
- 保留 readiness bar 的上下文摘要能力，并让它成为唯一 disclosure action owner。
- 保持 prompt assembly、memory injection、send payload、runtime lifecycle 不变。

## 非目标

- 不重做 Context Ledger 的分组、批量治理、来源详情或 pin/exclude 语义。
- 不新增持久化偏好或用户设置。
- 不改变 Composer 模型选择、模式选择、发送按钮或 queue/fuse 行为。

## What Changes

- `ComposerReadinessBar` 在右上角 context summary 操作区渲染唯一的 Context Ledger toggle。
- toggle 未展开时显示“展开”，展开后在同一位置显示“收起”。
- Context Ledger 详情展开后隐藏自身重复 header，避免下方再出现第二个“收起”。
- Focused tests 覆盖右上角 toggle 展开/收起，以及展开后的 detail panel 不再渲染重复 header。

## 技术方案

### 方案 A：让 readiness bar 右上角拥有展开/收起 toggle

- 做法：`ComposerReadinessBar` 继续接收 Context Ledger toggle callback 和 expanded state，按钮文案随状态在“展开 / 收起”之间切换。`ContextLedgerPanel` 只在 expanded 时渲染详情，并隐藏自身 header。
- 优点：符合截图目标位置，按钮始终贴在 Composer 对话框右上角；用户不用在上下两个区域找开关。
- 代价：readiness bar 需要继续承载一个轻量 disclosure action，但不承载详情管理逻辑。

### 方案 B：让 ContextLedgerPanel 自己拥有 collapsed / expanded header

- 做法：只要 projection visible，就在 composer 上方渲染 ledger collapsed header，展开和收起都在该 header 完成。
- 优点：disclosure ownership 更纯粹。
- 代价：按钮位置不符合图 2 目标，会新增一条上方 ledger header，占用更多垂直空间。

选择方案 A。该方案尊重当前 UI 目标：右上角是上下文摘要与 disclosure 的单一入口，Context Ledger 只负责展开后的详情与管理动作。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `context-ledger-surface`: Context Ledger expanded detail MUST NOT duplicate the disclosure header when readiness bar owns the toggle.
- `composer-send-readiness-ux`: Readiness context summary MUST own the single top-right Context Ledger expand/collapse toggle.

## Impact

- Frontend:
  - `src/features/composer/components/Composer.tsx`
  - `src/features/composer/components/ChatInputBox/ComposerReadinessBar.tsx`
  - `src/features/composer/components/ChatInputBox/**` prop plumbing for the unified toggle
  - `src/features/context-ledger/components/ContextLedgerPanel.tsx`
  - `src/features/composer/components/ChatInputBox/styles/banners.css` 保持既有 `.composer-readiness-expand` 样式，无净代码改动
- Tests:
  - `Composer.context-ledger-governance.test.tsx`
  - `Composer.context-ledger-transition.test.tsx`
  - `ComposerReadinessBar.test.tsx`
  - `ContextLedgerPanel.test.tsx`
- No backend, Tauri command, database, dependency, or prompt assembly change.

## 验收标准

- 当 Context Ledger 有内容但未展开时，Composer readiness bar 右上角显示“展开”。
- 用户点击右上角“展开”后，Context Ledger 详情在 Composer 上方展开。
- 展开后同一右上角按钮变为“收起”，点击后关闭详情。
- 展开的 Context Ledger 详情区域不再显示自身重复 header / 收起按钮。
- 发送消息后 ledger 状态仍按现有逻辑清空，不残留 stale disclosure state。

## 收口记录

- 2026-05-25：实现已按用户指定的图 2 位置调整为 readiness bar 右上角唯一 toggle；用户确认测试通过。
- 2026-05-25：已按 commit `e79604ab` 的实际 diff 复核 proposal：代码净变更集中在 Composer 状态切换、ChatInputBox prop plumbing、ReadinessBar 按钮双态、ContextLedgerPanel `hideHeader` presentation prop 与 focused tests；CSS 仅复用既有 class，无净变更。
- 2026-05-25：delta specs 已回写到 `openspec/specs/context-ledger-surface/spec.md` 与 `openspec/specs/composer-send-readiness-ux/spec.md`。
- 2026-05-25：Focused Vitest、ESLint、OpenSpec strict validate、large-file sentry、diff whitespace check、全量 `npm run typecheck` 已通过，详见 `verification.md`。
