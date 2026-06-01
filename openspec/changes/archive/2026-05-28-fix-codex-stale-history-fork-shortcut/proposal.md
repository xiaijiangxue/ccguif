## Why

GitHub issue #623 的用户症状是：Codex 历史会话可以打开，但继续发送时失败，界面提示 `thread not found`。维护者现场经验表明，手动在会话工具菜单中执行 `Fork`，再在新会话里继续对话，是当前最稳定的恢复方式。

现有交互的问题不是没有恢复能力，而是正确路径被藏在菜单里；错误卡片仍以“恢复会话 / 恢复并发送上一条提示词”为主语，用户需要理解 stale thread、runtime rebind、fork continuation 的区别后才能自己操作。

## What Changes

- 将 `Codex` 历史会话 stale thread 的主恢复路径调整为 `Fork continuation`。
- 在幕布错误卡片中直接提供一键 `Fork 并继续` / `Fork 并发送上一条提示词` 行为，不要求用户去底部工具菜单找 `Fork`。
- 自动发送路径遇到 `thread not found` 且 verified rebind 失败时，优先尝试 `fork_thread`，成功后把当前 prompt 发送到 fork 出来的新 thread。
- 如果 `fork_thread` 不可用或失败，再保留现有 fresh-thread fallback。
- 文案必须明确这是“在 Fork 会话中继续”，不是“复活原 runtime thread”。

## Non-Goals

- 不重写 Codex 历史解析或 session storage。
- 不删除现有 `Fork` 菜单入口。
- 不把所有 runtime disconnect 都改成 fork；仅作用于 Codex stale history/thread binding 类错误。
- 不把低置信 rebind 持久化为 alias。

## Impact

- Frontend recovery card:
  - `src/features/messages/components/RuntimeReconnectCard.tsx`
  - `src/features/messages/components/Messages.runtime-reconnect.test.tsx`
  - `src/i18n/locales/*.part1.ts`
- Manual recovery orchestration:
  - `src/app-shell-parts/manualThreadRecovery.ts`
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
  - `src/app-shell-parts/useAppShellLayoutNodesSection.recovery.test.ts`
- Codex send recovery:
  - `src/features/threads/hooks/useThreadMessaging.ts`
  - `src/features/threads/hooks/useThreadMessaging.test.tsx`
- Tauri service surface reuse:
  - `src/services/tauri.ts` already exposes `forkThread`.

## Acceptance Criteria

1. 当 `Codex` 历史会话发送失败并识别为 `thread not found` / `session not found` 时，幕布错误卡片必须直接提供 `Fork` 继续入口。
2. 点击 `Fork` 入口后，系统必须优先 fork stale source thread，并把上一条用户 prompt 发送到 fork thread。
3. 自动发送遇到 stale thread 且 verified rebind 失败时，必须先尝试 fork，再退回 fresh thread。
4. fork continuation 必须显示 replayed prompt；不得因为跨 thread 重发而隐藏用户意图。
5. fork 失败必须保留现有 fresh-thread fallback 与失败可见性。
6. 非 Codex runtime reconnect、broken pipe、workspace not connected 路径不得被 fork 行为污染。

## Implementation Notes

2026-05-27 implementation wired the maintainer workaround into the product path:

- `recoverThreadBindingAndResendForManualRecovery(...)` now returns a classified `forked` outcome and tries `forkThreadForWorkspace(...)` after verified rebind fails for Codex stale history threads.
- `useThreadMessaging` now attempts Codex fork continuation after stale send rebind fails and before existing fresh-draft replacement fallback.
- `RuntimeReconnectCard` now recognizes `forked` recovery results and labels the stale-thread resend action as `Fork and resend previous prompt` / `Fork 并发送上一条提示词`.
- Existing recover-only semantics remain conservative: only verified `rebound` is presented as restored original binding.

## Validation

- `openspec validate fix-codex-stale-history-fork-shortcut --strict --no-interactive`
- `npx vitest run src/app-shell-parts/useAppShellLayoutNodesSection.recovery.test.ts`
- `npx vitest run src/features/messages/components/Messages.runtime-reconnect.test.tsx`
- `npx vitest run src/features/threads/hooks/useThreadMessaging.test.tsx`
- `npm run typecheck`
- targeted ESLint for touched Fork recovery files
- `git diff --check`
