## Why

Project Map Auto Ingestion is currently evaluated inside the Project Knowledge Map view lifecycle. The setting appears to be a workspace-level background scheduler, but when the Project Map surface is not mounted, enabled Auto Ingestion can stop scanning Project Memory and stop enqueueing `kind="auto"` Project Map runs.

This is a functional bug: `enabled=true` plus `checkIntervalMinutes` describes a background execution contract. The scheduler should follow the active workspace lifecycle, not whether the user is currently looking at the Project Knowledge Map panel.

## 目标与边界

- Make Project Map Auto Ingestion evaluate from a workspace-level background scheduler.
- Keep the Project Map panel responsible for configuration, task visibility, and candidate review.
- Preserve the existing run queue, interval gate, threshold gate, duplicate-run guard, candidate safety, and success-only processed-marker semantics.
- Ensure returning to the Project Map panel shows the queued/running/completed auto runs through the existing lifecycle.

## 非目标

- Do not introduce a native daemon process.
- Do not change Project Memory or Project Map persistence schema.
- Do not scan arbitrary conversation history outside Project Memory.
- Do not auto-apply generated facts beyond the existing candidate-safety contract.
- Do not redesign the Project Map task drawer or generation worker.

## What Changes

- Auto Ingestion scheduling moves out of `useProjectMapDataset` view-owned lifecycle.
- A workspace-scoped scheduler hook/service will mount from an app/workspace layer that remains active while a workspace is selected.
- The scheduler will load the persisted Project Map dataset, evaluate existing Auto Ingestion settings, and enqueue the same Project Map `auto` run request used today.
- `ProjectMapPanel` will continue to read/persist settings and render queue state, but it will not be the only execution owner for background scheduling.
- Tests will cover the regression: Auto Ingestion can enqueue an auto run without rendering the Project Map panel.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-xray-panel`: Project Map Auto Ingestion must evaluate as a workspace background capability when enabled, regardless of whether the Project Knowledge Map panel is visible or mounted.

## Impact

- Affected frontend code:
  - `src/features/project-map/hooks/useProjectMapDataset.ts`
  - new or extracted Project Map Auto Ingestion scheduler hook/service
  - app shell or workspace-level mount point that owns active workspace lifecycle
  - Project Map focused tests
- Affected behavior:
  - Enabled Auto Ingestion continues checking Project Memory after the user leaves the Project Map surface.
  - Duplicate auto runs remain blocked while one is pending or running.
  - Interval and threshold gates remain unchanged.
  - Project Memory messages are marked processed only after successful worker completion.
- Dependencies:
  - No new external dependency.

## 验收标准

- Given Auto Ingestion is enabled and its interval has elapsed, when unprocessed Project Memory reaches the threshold and the Project Map panel is not rendered, the system queues a `kind="auto"` Project Map run.
- Given the Project Map panel is opened after a background auto run is queued, the existing task/run UI can render that run.
- Given an auto run is pending or running, background scheduling does not enqueue a duplicate run.
- Given the interval has not elapsed, background scheduling does not scan Project Memory again.
- Given an auto run fails or is cancelled, consumed messages remain eligible for retry after the interval gate.
