## Why

Recent client error logs show `model/list`, `account/rateLimits/read`, and `thread/list` surfacing the same Codex runtime acquire failure chain as separate user-visible errors. The existing runtime guard already bounds acquire/recovery, but helper reads still need to consistently enter that shared guard instead of bypassing it in daemon mode.

## Goal And Boundaries

- Goal: keep Codex helper reads under the existing `workspace + engine` runtime acquire/recovery guard.
- Goal: preserve bounded degradation for passive reads instead of creating independent recovery storms.
- Boundary: fix the regression without changing frontend command names, payload shapes, or the runtime state-machine API.

## Non-Goals

- Do not increase live `thread/list` timeouts to hide acquire contention.
- Do not rewrite the runtime lifecycle coordinator.
- Do not change Codex app-server protocol behavior.

## What Changes

- Align daemon `model_list` and `account_rate_limits` helper reads with the desktop command path by ensuring a guarded Codex session before live requests.
- Keep `thread/list` as a bounded live read with existing fallback/degraded behavior.
- Add focused validation for the helper-read guard behavior.

## Technical Options

| Option | Trade-off | Decision |
|---|---|---|
| Patch each frontend caller to ignore these errors | Fast, but treats shared runtime failure as UI noise and leaves daemon bypass intact | Rejected |
| Route helper reads through the existing runtime guard before live requests | Small backend change, preserves current contracts, fixes common chain | Chosen |
| Redesign runtime acquire/recovery state machine | Broader cleanup, high regression risk for a focused log-derived bug | Rejected |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `runtime-lifecycle-recovery-guard`: helper reads must use the existing guarded runtime acquire/recovery path consistently across desktop and daemon surfaces.

## Impact

- Backend daemon helper read path under `src-tauri/src/bin/cc_gui_daemon/`.
- Runtime lifecycle behavior remains governed by the existing `runtime-lifecycle-recovery-guard` capability.
- No new dependencies.

## Acceptance Criteria

- `model_list` and `account_rate_limits` in daemon mode call the shared Codex session ensure path before sending live helper requests.
- `thread/list` remains bounded and does not solve acquire contention by increasing timeout.
- Existing Rust targeted tests for runtime acquire/recovery still pass.
