## Why

Phase 1 dry-run has now produced the exact stuck-turn signal it was designed to expose: scoped state evidence is still busy, progress is stale, terminal evidence is missing, and the pure helper returns `request-reconciliation`. The matching real sample from `2026-05-29` showed a Codex foreground turn stuck for roughly 10 minutes of stale progress while the UI continued loading.

Phase 2a implements the conservative next step: query backend/runtime status with strict conversation scope, then feed the scoped response back into the existing three-evidence helper. This avoids frontend-only timeout guessing while giving the client a way to distinguish a genuinely running turn from a runtime that already ended.

## What Changes

- Add a scoped backend/runtime turn status query command for three-evidence reconciliation.
- Track recent runtime-ended affected thread/turn scope so the status query can return `runtime-ended` only when the request scope matches affected work.
- Add frontend service mapping for bounded status-query request/response payloads.
- Wire the existing Phase 1 `request-reconciliation` path to invoke the query once per scoped turn suspicion.
- Record bounded diagnostics for query requested, resolved, rejected, and failed outcomes.
- Re-run the pure settlement helper with reconciliation evidence; Phase 2a still performs no cleanup or completion side effects.

## Non-Goals

- No Phase 2b guarded cleanup.
- No timeout-completed inference.
- No visible-text/history-content completion inference.
- No terminal replay.
- No generic runtime recovery state machine rewrite.

## Impact

- Frontend: `src/features/threads/hooks/useThreadEventHandlers.ts`, `src/services/tauri/workspaceRuntime.ts`, `src/types.ts`.
- Backend: runtime command and runtime manager scoped status/query helpers.
- Tests: focused frontend utility/hook/service tests and Rust runtime status-query tests.

## Acceptance

- `running` response keeps the turn active and logs resolved running.
- Scoped recent runtime end can produce `runtime-ended` evidence, then the helper returns `cleanup-residue` in diagnostics only.
- Unknown, failed, stale, or scope-mismatched query responses never complete the turn.
- Query attempts are throttled per workspace/engine/thread/turn suspicion.
- OpenSpec strict validation and focused automated tests pass.

## 2026-06-01 Evidence Logging Marker

Post-Phase2a reproduction showed stuck GUI symptoms without enough persisted evidence to decide Phase2b. This follow-up only strengthens the client error-log contract:

- persist `three-evidence-reconciliation-query-skipped` when dry-run arbitration does not issue a status query or the same scoped query is already in flight;
- persist all `three-evidence-reconciliation-query-resolved` outcomes, including `running` and `unknown`, so GO/NO-GO analysis can see why Phase2b did not start;
- persist `three-evidence-reconciliation-cleanup-skipped` when a resolved query is not eligible for `cleanup-residue`;
- include latest lifecycle evidence on `codex-no-progress-watchdog-fired`.

Boundary: this marker does not itself enable Phase2b, does not clear frontend loading residue, and does not infer completion from time or visible text. Follow-up evidence from `2026-06-01` showed a second valid Phase2b GO path: matched terminal evidence plus scoped busy residue may start Phase2b without a reconciliation query, provided `scopeMatch.matched = true`, terminal/state evidence are both accepted, `decisionAction = "cleanup-residue"`, and `activeTurnId` still matches the stuck `turnId`.
