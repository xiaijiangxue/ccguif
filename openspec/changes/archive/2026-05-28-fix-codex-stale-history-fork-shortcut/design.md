## Context

当前代码已经具备三段恢复基础：

- `RuntimeReconnectCard` 能识别 `thread-not-found` 并显示恢复卡片；
- `recoverThreadBindingAndResendForManualRecovery` 会先尝试 `refreshThread`，失败后可 `startThreadForWorkspace` fresh fallback；
- `useThreadMessaging` 在 Codex `sendUserMessage` 收到 stale binding error 时，会执行一次 retry，verified rebind 失败时对“空首轮 draft”走 fresh thread fallback。

 issue #623 暴露的交互缺口是：维护者推荐的稳定操作是 `Fork`，但自动恢复路径和幕布卡片都没有把 `Fork` 作为一等恢复动作。

## Design

### 1. Recovery result semantics

扩展 manual recovery outcome：

- `rebound`：verified stale thread rebind，语义仍是原绑定恢复；
- `forked`：基于 stale source thread 创建 fork thread，语义是 Fork continuation；
- `fresh`：普通新 Codex thread fallback；
- `failed`：恢复失败。

`forked` 与 `fresh` 都不是“原 thread 恢复”，但 `forked` 保留更多历史上下文，优先级高于 `fresh`。

### 2. Manual recovery orchestration

`recoverThreadBindingAndResendForManualRecovery` 的顺序调整为：

1. `refreshThread` verified rebind；
2. `forkThreadForWorkspace(workspaceId, staleThreadId)`；
3. `startThreadForWorkspace(... engine: codex)` fresh fallback；
4. 成功后把上一条 prompt 发送到目标 thread。

当结果为 `forked` 或 `fresh` 时，不得 suppress optimistic user bubble，因为新 thread 必须可见地展示 replayed prompt。

### 3. Automatic send recovery

`useThreadMessaging` 的 stale Codex retry 在 `refreshThread` 无法 rebind 时：

1. 对可恢复 stale binding error，先尝试 `forkThreadForMessageSend(workspaceId, threadId)`；
2. fork 成功则切 active thread、移动 optimistic user intent、重发当前 prompt；
3. fork 失败且满足现有 first-send draft 条件时，走 fresh fallback；
4. retry 仍受 `codexInvalidThreadRetryAttempted` 单次 guard 约束。

### 4. UI copy

`threadRecovery*` 文案调整为 fork 语义：

- 主按钮：`Fork 并发送上一条提示词`
- recover-only 可保持 `尝试恢复会话`，但 fresh/fork fallback 必须明确“原 thread 无法复活”。

### 5. Tests

Focused tests 覆盖：

- stale recovery card 显示 fork resend action；
- manual recovery rebind 失败后调用 fork 并发送；
- fork 失败后 fallback fresh thread；
- auto Codex send 在 stale error 后优先 fork；
- non-Codex runtime reconnect 不显示 fork 文案。
