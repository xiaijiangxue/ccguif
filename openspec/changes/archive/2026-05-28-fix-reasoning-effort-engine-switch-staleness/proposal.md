## Why

Issue #619 reports that changing the CC GUI reasoning effort does not take effect. Current code already has Claude `effort` IPC mapping and CLI argument support, so the likely fracture is the engine-switch boundary: the composer can display one reasoning effort while send-time resolution reads stale, missing, or capability-gated state after switching engines.

This matters now because CodeMoss has moved from single-engine composer assumptions to shared engine selection, per-thread model/effort persistence, and engine capability matrix gating. Reasoning effort must be resolved from the same engine identity that will actually receive the next turn.

## 目标与边界

- 目标：把 reasoning effort 的 UI selection、thread/draft persistence、effective engine resolution 和 send payload 收敛成一条 deterministic contract。
- 目标：切换 `Codex` / `Claude` 后，composer MUST rebind reasoning options and selected effort to the new active engine before the next send.
- 目标：Claude Code 的 `low`、`medium`、`high`、`xhigh`、`max` 必须作为 supported runtime effort capability 进入 capability matrix，而不是靠 hard-coded UI branch 绕过矩阵。
- 目标：非支持 engine（Gemini、OpenCode）不得继承、显示或发送 stale reasoning effort。
- 边界：本 change 只修复 reasoning effort selection/effective-send consistency，不重构 model selector、session catalog、Claude command streaming 或 Codex collaboration mode。

## 非目标

- 不新增新的 reasoning effort 选项，也不改变 Claude CLI `--effort` allowlist。
- 不改变 Codex 既有 reasoning effort 语义、默认值策略或 external config 写入规则。
- 不把 reasoning effort 编码进 model id、prompt text、provider config 或 global default。
- 不为 Gemini、OpenCode 添加 reasoning effort control。

## What Changes

- Add an engine-switch reasoning-effort consistency contract: engine selection changes MUST synchronously invalidate or rebind stale effort state before send.
- Extend `claude-reasoning-effort-support` so Claude effort selection is resolved at send time from the active/effective engine, not from a stale composer snapshot.
- Modify `engine-capability-matrix` so Claude Code reports `reasoning.effort=supported` consistently across spec fixture, TypeScript runtime projection, and Rust `EngineFeatures`.
- Require per-engine/thread composer selection persistence to store effort only when it is valid for that engine, while preserving draft state across pending-to-real thread transitions.
- Add focused tests for engine switching, active thread selection, draft selection, non-supporting engine cleanup, IPC payload mapping, and backend capability parity.
- Lock the default reasoning trigger visual contract so the no-selection state stays icon+label without an extra chevron, matching the compact composer chrome.

## 技术方案取舍

### 方案 A：send-time effective engine + effort resolution

- 做法：在发送前根据 `activeEngine` / shared-session selected engine / active thread engine source 计算 `effectiveEngine`，再用该 engine 的 capability 和 options 解析 `effectiveEffort`。
- 优点：修复点贴近真实风险边界；UI 展示、持久化和发送参数共享同一决策；能覆盖 engine 切换、thread 切换和 pending thread finalize。
- 缺点：需要补齐 modelSelection、composer session selection、send handler 和 capability matrix 的跨层测试。

### 方案 B：每次切换 engine 后直接清空全局 effort state

- 做法：engine 切换时把 `selectedEffort` 置空，让用户重新选择。
- 优点：实现更短。
- 缺点：会丢失 Codex/Claude 各自合法的 per-thread selection；也不能保证 send path 不读到 thread-level stale effort；用户体验退化明显。

### 结论

选择方案 A。Reasoning effort 是 engine-scoped runtime option，正确边界是 send-time effective engine resolution，而不是简单清空 UI state。该方案能把 issue #619 的“看起来改了但没生效”转化为可验证的跨层契约。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `claude-reasoning-effort-support`: 增加 engine switching、send-time effective effort resolution、stale effort cleanup 与 thread/draft persistence 要求。
- `engine-capability-matrix`: 将 Claude Code `reasoning.effort` 声明为 supported，并要求 TS/Rust/spec fixture 三方一致。

## Impact

- Frontend model/effort selection: `src/app-shell-parts/modelSelection.ts`、`useSelectedComposerSession.ts`、composer send handler 需要统一使用 effective engine + capability-driven effort resolution。
- Composer UI: `ChatInputBox` 及 footer/header selector 需要在 engine 切换后立即展示新 engine 的 options、selected value 和 disabled/hidden state。
- Service/IPC: `src/services/tauri.ts` 应继续只传递有效 `effort`，并在非支持 engine 下发送 `null` 或省略有效值。
- Rust backend/capability: `src-tauri/src/engine/mod.rs` 与 `src-tauri/src/engine/capability_matrix.rs` 需要与 spec fixture 一致，Claude Code `reasoning_effort` 应反映已实现的 `--effort` support。
- Tests: focused Vitest + Rust tests + `npm run check:engine-capability-matrix` + OpenSpec strict validation。
- Dependencies: 不新增第三方依赖。

## 验收标准

- 从 Codex 切到 Claude 后选择 `high` 并发送，Claude send payload MUST include `effort: "high"`，Claude command MUST include `--effort high`。
- 从 Claude 切到 Codex 后选择 Codex effort 并发送，Codex MUST 使用 Codex effort path，且不得追加 Claude CLI `--effort`。
- 从 Claude/Codex 切到 Gemini 或 OpenCode 后，composer MUST hide or disable reasoning effort control，send payload MUST NOT carry stale effort.
- Thread A 与 Thread B 分别保存不同 engine/effort 时，切换 thread MUST restore only the effort valid for that thread's effective engine.
- Claude Code `reasoning.effort` 在 OpenSpec fixture、TypeScript matrix projection、Rust capability matrix 中一致为 `supported`。
- `openspec validate --all --strict --no-interactive`、focused frontend tests、focused Rust tests、`npm run check:engine-capability-matrix` 通过或记录明确阻塞原因。

## Implementation Closure

- 已落地 effective-engine effort resolver：`src/app-shell-parts/modelSelection.ts` 统一判断 Claude/Codex/Gemini/OpenCode 的 effort 支持边界。
- 已接入 composer engine switch：`src/app-shell.tsx` 在 model/effort selection 更新时按当前 effective engine 重新计算 effort。
- 已修复 Codex runtime model metadata 为空时的错误 fallback：内置 Codex model catalog 现在补齐 reasoning effort 元数据，避免 UI 倒灌 Claude `max`。
- 已补 thread-scoped persistence normalization：`selectedComposerSession.ts` 与 `useSelectedComposerSession.ts` 在读、写、draft 应用、pending-to-finalized migration 时过滤 unsupported/stale effort。
- 已补 send-time guard：`useThreadMessaging.ts` 在最终 dispatch engine 上再次清洗 effort，防止 UI 状态和发送引擎漂移。
- 已收紧默认 trigger 外观：`ReasoningSelect` 在默认态仅保留 icon+label，不再额外渲染 chevron。
- 已对齐 capability matrix：OpenSpec fixture、TypeScript capability tests、Rust `EngineFeatures::claude()`、daemon bridge 均声明 Claude `reasoning.effort=supported`。
- 未新增第三方依赖；未改变 Gemini/OpenCode 能力边界；未改变 Claude CLI allowlist。

验证证据见 `verification.md`：focused Vitest 60 tests、capability matrix check、Rust capability tests、`npm run typecheck`、OpenSpec strict validation 均已通过。
