# harden-client-runtime-environment-recovery Proposal

## Why

`~/.ccgui/error-log` 暴露出客户端当前存在四类稳定性问题：

1. `liquid-glass/apply-error` 高频刷屏：前端仍调用 `tauri-plugin-liquid-glass-api`，但 native plugin registration 已被注释，导致 optional visual capability 被当作 error 持续记录。
2. Codex runtime acquire / cleanup 竞争：`stale_reuse_cleanup`、`RUNTIME_RECOVERY_QUARANTINED`、`timed out waiting for concurrent runtime acquire` 表明 cleanup、recovery、model list、rate limit、history load 在争抢同一 workspace runtime。
3. stale session index / history missing：状态索引指向不存在的 rollout/session 文件，触发 `state db returned stale rollout path`、`Session file not found`、`target user message ordinal not found`。
4. engine/proxy environment drift：登录 shell 能找到 `codex`，但 GUI runtime 报 `Engine codex is not installed`；同时 ChatGPT backend request 失败，说明 GUI daemon 的 PATH/proxy 继承和诊断不可解释。

这些问题不是单纯本机配置错误。它们共同指向一个通用产品缺口：客户端没有把可选插件、runtime lease、历史文件、engine executable、network proxy 作为可漂移状态管理。

## What Changes

- 移除或 no-op 化 `liquid-glass` 调用链：
  - 若当前产品目标是关闭 native glass/blur，则前端不得继续调用 `tauri-plugin-liquid-glass-api`。
  - 缺失 optional visual capability 不得写入 error-log；最多记录一次 bounded debug/warn。
  - Windows/Linux/macOS 均保持安全降级。
- 加固 runtime lifecycle：
  - 为 workspace + engine runtime acquire 引入明确 lease / state transition。
  - `starting / ready / stopping / stopped / recovering / quarantined` 状态必须可区分。
  - `stopping` 或 `stale_reuse_cleanup` 期间的非关键读取请求不得触发 recovery 风暴。
  - model list、rate limit、history load 这类辅助请求必须支持 transient fallback。
- 增加 session index repair / prune 机制：
  - thread list / history hydrate 前校验 session 文件存在。
  - 缺失文件标记为 `missing` 或 `stale`，不得作为正常 thread 继续 fork/resume。
  - fork from message 前验证目标 message ordinal 存在；不存在时返回 typed error，并让 UI 禁用入口。
  - 提供 bounded repair 行为，清理 stale rollout path 或从 UI 隐藏不可恢复 session。
- 新增跨平台 Environment Doctor：
  - engine detection 不再只依赖 GUI process PATH。
  - macOS: configured path -> bundled/common paths -> `/opt/homebrew/bin` / `/usr/local/bin` -> login shell fallback。
  - Windows: configured path -> process PATH -> npm global bin -> `where.exe codex` -> PowerShell `Get-Command` fallback。
  - Linux: configured path -> process PATH -> common bins -> `$SHELL -lc 'command -v codex'` fallback。
  - proxy detection 区分 process env、system proxy、GUI explicit proxy，并返回可解释 diagnosis。
  - UI 不再只显示 “Codex is not installed”，而是显示具体 drift 原因。

## Out of Scope

- 不恢复或重新设计 liquid-glass 视觉风格。
- 不引入新的第三方 UI / runtime 依赖，除非 platform doctor 必须使用系统 API。
- 不自动删除用户真实 session 文件。
- 不改变 Codex / Claude / Gemini 的核心消息协议。
- 不做 active runtime 热替换；runtime 修复优先保证恢复策略稳定。

## Impacted Specs

- `client-error-log`: 错误日志应区分 actionable error、optional capability warning、transient runtime state。
- `runtime-lifecycle`: workspace runtime acquire、cleanup、recovery、quarantine 的状态机和并发边界。
- `session-history-recovery`: stale session index、missing rollout file、fork target validation。
- `engine-environment-doctor`: 跨平台 executable / PATH / proxy 探测与可解释诊断。

## Capabilities

### New Capabilities

- `client-optional-visual-effects`: 定义 optional native visual effect 的 no-op / degrade / logging 边界。
- `runtime-lifecycle-recovery-guard`: 定义 `workspace + engine + generation` runtime lifecycle guard 与辅助请求降级语义。
- `session-history-stale-index-repair`: 定义 stale session index、missing rollout file、fork target validation 的修复与 UI 降级语义。
- `engine-environment-doctor`: 定义跨平台 executable / PATH / proxy / network diagnosis contract。

### Modified Capabilities

- `client-global-error-log`: 后续实现需要让 error-log 区分 actionable error、optional warning 与 transient runtime state；本 change 的新 capability 先定义分类契约，再在实现中按现有日志通道接入。

## Impacted Code

- `src/features/app/hooks/useLiquidGlassEffect.ts`
- `src/app-shell.tsx`
- `src/features/app/hooks/useAppServerEvents.ts`
- `src/features/threads/hooks/useThreadActions*.ts`
- `src/features/threads/hooks/useThreads*.ts`
- `src/features/notifications/hooks/useErrorToasts.ts`
- `src/services/globalRuntimeNotices.ts`
- `src/services/tauri/workspaceRuntime.ts`
- `src/services/tauri/doctor.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/src/runtime/*`
- `src-tauri/src/codex/doctor.rs`
- `src-tauri/src/codex/session_runtime.rs`
- `src-tauri/src/engine/*`
- `src-tauri/src/engine/session_history_commands.rs`
- `src-tauri/src/client_error_log.rs`
- i18n locale files and related tests.

## Success Criteria

- 启动客户端后不再因 `liquid-glass` 缺失持续写入 `error-log`。
- runtime cleanup / recovery 期间不会因辅助请求产生 concurrent acquire 风暴。
- stale session / missing rollout path 不再导致反复 history hydrate error；UI 能解释并安全跳过。
- fork from message 在目标消息不存在时返回 typed error，前端不再重复触发同一失败。
- macOS、Windows、Linux 均能给出 Codex executable 探测结果与原因说明。
- proxy / network failure 能区分 missing proxy、proxy unreachable、DNS/TLS/timeout。
- 所有降级路径不影响已有正常会话发送、恢复、设置保存。
- `openspec validate --all --strict --no-interactive` 通过。
