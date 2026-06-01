## Context

The current Auto Ingestion implementation satisfies the run-queue contract only while `useProjectMapDataset` is mounted. That hook is owned by `ProjectMapPanel`, so the scheduler is coupled to a UI surface that may be hidden, swapped out, or absent in some app layouts.

Desktop content layers may keep `ProjectMapPanel` mounted in common center-mode switches, but the behavior contract cannot rely on that layout detail. Auto Ingestion is configured per workspace and persisted in Project Map storage; its evaluator must be owned by the active workspace lifecycle.

## Decision 1: Extract scheduling from the Project Map view hook

Move the Auto Ingestion evaluation block out of `useProjectMapDataset` into a dedicated scheduler unit.

The scheduler owns:

- loading the current persisted Project Map dataset for the active workspace
- evaluating `enabled`, `checkIntervalMinutes`, `memoryCursor.lastCheckedAt`, and active auto run guards
- listing Project Memory only after interval/guard checks pass
- creating the same `kind="auto"` generation request and queued run metadata
- persisting `lastCheckedAt`, `pendingMessages`, and the queued run

`useProjectMapDataset` remains responsible for:

- manual generation actions
- task/run worker execution and completion persistence
- settings updates from the Project Map UI
- candidate confirmation/rejection and node deletion

## Decision 2: Mount the scheduler at workspace scope

Add the scheduler at an app shell or workspace-level mount point that exists whenever a workspace is active. It should not depend on `centerMode === "projectMap"` or a Project Map tab being selected.

The scheduler must be inert when there is no active workspace. Workspace changes should cancel any in-flight scan for the previous workspace before mutating state.

## Decision 3: Reuse existing queue and safety contracts

The fix must not introduce a second hidden ingestion path. The background scheduler should call the same request/run construction helpers already used by the Project Map hook, so task drawer rendering, worker processing, candidate safety, and processed marker updates stay consistent.

If extraction reveals duplicated helper code, prefer a small shared function such as `queueProjectMapAutoIngestionRun(...)` over copying the scheduling block into two hooks.

## Decision 4: Avoid duplicate schedulers

During migration, only one owner should evaluate background scheduling for a workspace. If `ProjectMapPanel` and the app-level scheduler can both mount, the view hook should no longer contain an independent Auto Ingestion scan effect.

Existing run-level duplicate guards remain necessary, but they should be a backstop rather than the normal coordination mechanism.

## Data And Compatibility

No persisted schema change is required. Existing files remain valid:

- `settings.json`
- `memory-ingestion/cursor.json`
- `memory-ingestion/processed.json`
- run metadata in the Project Map dataset

The scheduler should continue using sanitized persisted settings and the existing default storage location behavior.

## Failure Handling

- Project Memory list failures should surface through the scheduler's error channel or existing Project Map error state only when there is a user-visible surface to report it. Background failures must not corrupt persisted dataset state.
- A failed or cancelled worker run must not mark consumed messages processed.
- If persistence fails while enqueueing, no in-memory-only queued run should be treated as successful background work.

## Validation Strategy

- Unit test the scheduler without rendering `ProjectMapPanel`.
- Keep existing `useProjectMapDataset` tests for manual queue and run completion behavior.
- Add a regression test that mounts the workspace/app scheduler with Auto Ingestion enabled and asserts `projectMemoryList` and `writeProjectMapDataset` enqueue a `kind="auto"` run.
- Add a negative test for interval-not-elapsed or existing pending/running auto run.
- Run focused Project Map tests, typecheck, and strict OpenSpec validation.

## Rollback

Rollback is local and schema-safe:

- remove the workspace-level scheduler mount
- move the scheduling effect back into `useProjectMapDataset`
- keep persisted Project Map data unchanged

The rollback restores the previous view-owned scheduling limitation but does not require data migration.
