## Context

`StatusPanel` already derives subagent facts from active conversation tool items and can navigate Claude task rows back to an agent task notification card. `Messages` already parses `<task-notification>` assistant messages and keeps task-card scroll refs by `taskId` / `toolUseId`. Codex delegated work is represented differently: child agents usually have thread identities and the existing UI should continue to prefer thread navigation.

The missing product layer is a non-blocking inspector that explains what a long-running delegated task is doing. The design must not put new heavy work into the live conversation render path, because existing frontend contracts explicitly protect streaming row rendering from parent-level recomputation.

## Goals / Non-Goals

**Goals:**

- Add a shared inspector UI for Claude Code task notifications and Codex delegated-agent output facts.
- Keep inspector state local and additive, with no change to message send, history load, or turn settlement.
- Normalize available facts into a small `EngineTaskOutputSnapshot` view model.
- Render missing telemetry as pending/unavailable rather than misleading zero values.

**Non-Goals:**

- No Claude `TaskOutput(block=true)` command.
- No automatic high-frequency polling.
- No duplication of full subagent transcripts inside parent messages.
- No change to existing Codex thread navigation when a child thread is the better target.

## Decisions

### Decision 1: Frontend Projection First

The first slice derives inspector snapshots from existing frontend facts:

- `SubagentInfo` from `useStatusPanelData`
- parsed `AgentTaskNotification` from message text
- optional `ThreadTokenUsage` for active-thread token usage
- current conversation tool output or notification result text

Alternative considered: add a runtime command that calls Claude `TaskOutput(block=false)`. That would provide better live output, but it adds cross-layer risk and requires engine-specific runtime support. The chosen design keeps this change additive and leaves the command bridge as a future compatible data source.

The second slice adds a smaller bridge: `engine_task_output_read_artifact`. It reads the tail of an already-known output artifact path and returns bounded text. This is deliberately not a Claude task RPC and not a general file browser. It gives users live-ish task progress for Claude task notifications that already disclose an output file while preserving the frontend projection fallback for all other cases.

### Decision 2: Engine-Agnostic View Model

The inspector consumes:

```ts
type EngineTaskOutputSnapshot = {
  id: string;
  engine: "claude" | "codex";
  title: string;
  description: string;
  status: "running" | "completed" | "error" | "unavailable";
  taskId: string | null;
  toolUseId: string | null;
  threadId: string | null;
  outputFileName: string | null;
  outputFilePath: string | null;
  recentOutput: string | null;
  tokenUsage: ThreadTokenUsage | null;
  telemetryStatus: "live" | "estimated" | "pending" | "unavailable";
};
```

Claude task targets primarily use `taskId/toolUseId`. Codex targets keep `threadId` when available. This avoids pretending Codex threads are Claude tasks while still allowing the same visual inspector to display delegated output facts.

### Decision 3: Inspector Entry Points Stay Outside The Streaming Hot Path

Message rows may expose a button on existing task notification cards, but the inspector state is owned above the message row. The card emits a small `onInspectAgentTask(snapshot)` callback. It must not trigger timeline regrouping, history reload, or Markdown reparsing.

StatusPanel rows similarly expose a click action. Existing thread navigation remains for Codex rows; Claude task rows open the inspector and may still scroll to the existing notification card where available.

### Decision 4: Artifact Tail Refresh Is Inspector-Scoped

The frontend adds a small hook that is active only while an inspector exists:

- no snapshot → no request
- no `outputFilePath` → no request
- inspector closes → request guard invalidates and interval cleanup runs
- running tasks refresh at a low cadence; completed/error tasks perform a single best-effort refresh

The hook calls the service wrapper, not `invoke()` directly. Errors are normalized into local inspector state and do not escape into the conversation render tree.

### Decision 5: Runtime Path Access Fails Closed

The Rust command accepts `workspaceId` and an absolute artifact path. Local mode validates that the workspace exists and that the canonical file is under either the workspace root or known temporary roots such as the OS temp directory. It returns:

- `exists=false` for a missing artifact
- bounded `content` and `truncated` for readable artifacts
- an error for invalid paths or disallowed roots

The frontend treats command errors as unavailable output. Remote mode forwards the same command name to the daemon; if unsupported, the frontend still degrades locally in the inspector.

## Risks / Trade-offs

- [Risk] The first slice may not show truly live output for every Claude task. → Mitigation: label telemetry source clearly and keep the view model ready for a future runtime bridge.
- [Risk] Adding metadata to subagent rows could regress compact panel layout. → Mitigation: render short chips only, truncate long output, and keep existing primary label/description.
- [Risk] Codex and Claude task semantics may drift. → Mitigation: represent engine-specific identity explicitly and avoid forcing Codex into `taskId` semantics.
- [Risk] User may expect Stop to kill a subtask specifically. → Mitigation: first slice labels stop/interrupt as unavailable unless an existing engine interruption callback is already wired.
- [Risk] Artifact path access could become a broad file read surface. → Mitigation: bounded tail size, workspace/temp-root validation, no write path, and UI fallback on denial.

## Migration Plan

1. Add OpenSpec specs and focused frontend implementation.
2. Add UI entry points behind existing StatusPanel and task notification surfaces.
3. Add the optional artifact-tail bridge and inspector-scoped refresh hook.
4. Run focused tests for service mapping, hook/component behavior, `StatusPanel`, `Messages`, and view-model helpers.
5. Rollback by removing inspector entry points and the feature-local inspector slice; no persisted data or backend schema migration is introduced.

## Open Questions

- Which runtime command should later expose true Claude `TaskOutput(block=false)` snapshots if the backend adds it?
- Should task output snapshots eventually be persisted for completed sessions, or remain derived from existing transcript/history facts?
