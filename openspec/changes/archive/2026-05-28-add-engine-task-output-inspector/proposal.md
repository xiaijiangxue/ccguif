## Why

Claude Code background tasks and delegated agents can keep consuming tokens while the user sees only a blocking wait state. Users need an explicit task-output observability surface to understand progress, recent output, elapsed time, and token usage before deciding whether to keep waiting or stop the task.

## Goals And Boundaries

- Provide an engine-agnostic task output inspector for Claude Code tasks and Codex-style delegated agents.
- Keep normal conversation streaming, history replay, and final assistant output behavior unchanged.
- Prefer existing conversation facts, status-panel subagent facts, and task notification cards first; when a task artifact path is already known, read only a bounded non-blocking tail for the inspector.
- Treat token and output telemetry as best-effort: unknown values must render as pending or unavailable, never as fake zeroes.

## Non-Goals

- Do not implement a full Claude Code `/tasks` clone in this change.
- Do not require `TaskOutput(block=true)` or any blocking polling loop from the UI.
- Do not duplicate full subagent transcripts into the parent conversation.
- Do not change engine send, interrupt, or history-loader behavior except for additive inspector entry points.

## What Changes

- Add a task output inspector surface reachable from the StatusPanel Subagents/Agents tab and from existing agent task notification cards.
- Normalize Claude task, Claude task-notification, and Codex delegated-agent facts into a shared view model.
- Show task identity, status, elapsed/last activity where available, recent output preview, output artifact name, and token usage when trustworthy telemetry exists.
- Refresh known task output artifacts only while the inspector is open, using a bounded tail read that fails closed to unavailable output.
- Preserve engine boundaries: Claude task targets use task/tool-use identity, while Codex targets continue to prefer thread navigation and only open the inspector when output metadata is available.
- Add focused tests for Claude/Codex target projection, fallback rendering, and non-regression of existing subagent navigation.

## Technical Options

| Option | Summary | Trade-off |
|---|---|---|
| A. Frontend projection over existing facts | Build inspector from current `ConversationItem`, `SubagentInfo`, `ThreadTokenUsage`, and `task-notification` data. | Lowest risk and no backend dependency, but live output is limited to data already present in the UI. |
| B. New runtime `TaskOutput(block=false)` bridge | Add Tauri/Rust command that queries engine task output directly and poll it from the inspector. | Better real-time output, but higher cross-layer risk and requires engine-specific runtime support. |
| C. Bounded artifact tail bridge | Read a known `<output-file>` artifact tail only while the inspector is open. | Useful live progress for Claude task notifications without engine RPC assumptions; limited to tasks that expose an output file. |

Chosen approach: start with Option A and design the view model so Option B can be added later without changing UI semantics. This delivers immediate observability while protecting the conversation hot path.

Second slice: add Option C as a narrow bridge. It does not call Claude `TaskOutput`, does not block the conversation, and does not create a general arbitrary-file reader. The inspector can tail a known artifact path and otherwise keeps the existing pending/unavailable fallback.

## Capabilities

### New Capabilities

- `engine-task-output-inspector`: Covers shared task output inspection for Claude Code tasks and Codex delegated agents, including status, recent output, telemetry fallback, and safe navigation boundaries.

### Modified Capabilities

- None. Existing subagent session tree and conversation tool-card capabilities remain unchanged; this change adds an inspector capability that consumes their facts.

## Impact

- Frontend: `src/features/status-panel/**`, `src/features/messages/**`, and a new feature-local inspector slice.
- Types: additive optional fields for subagent/task output projection.
- Styles/i18n: new inspector labels and compact metadata styles.
- Tests: focused Vitest coverage for projection, StatusPanel interactions, and message task card actions.
- Runtime/backend: first slice had no Rust command; second slice adds a bounded artifact-tail command used only by the inspector.

## Acceptance Criteria

- A Claude task row in StatusPanel can open an inspector without losing the current conversation context.
- A Claude `task-notification` card exposes an inspector entry point and still renders the final result as before.
- A Codex delegated agent keeps existing thread navigation semantics and can expose the same inspector only when output facts are available.
- Unknown token usage renders as pending/unavailable rather than `0`.
- The implementation does not introduce high-frequency polling or new work into the live message streaming hot path.
- Task artifact refresh runs only while an inspector is mounted and stops when it closes.
