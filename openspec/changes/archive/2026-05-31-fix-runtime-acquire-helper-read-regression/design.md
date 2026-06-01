## Overview

The log cluster has one shared runtime symptom chain: helper reads are surfacing `timed out waiting for concurrent runtime acquire`, then the shared recovery guard enters `RUNTIME_RECOVERY_QUARANTINED`. Desktop Tauri already protects `model_list` and `account_rate_limits` with `ensure_codex_session`; daemon mode directly calls `codex_core::*_core`, which requires an existing session and bypasses the acquire/recovery guard.

## Architecture

Use the existing daemon `ensure_codex_session_for_workspace` helper as the single guard entry for live Codex helper reads that require a runtime session.

Data flow:

```text
daemon RPC model_list/account_rate_limits
  -> ensure_codex_session_for_workspace
  -> connect_workspace / runtime guard
  -> codex_core live request
```

## Error Handling

If the runtime guard is quarantined, the helper read returns the existing quarantine diagnostic. This is intentional: the error now comes from the common runtime guard instead of an unguarded missing/stale session path.

`thread/list` already uses a bounded timeout and the desktop unified listing path has degraded local fallback. This change does not extend the timeout because that would mask the shared acquire contention rather than fixing the bypass.

## Testing

- Rust targeted tests for runtime recovery guard.
- Build/check for daemon code path through `cargo test --manifest-path src-tauri/Cargo.toml ...` focused tests.
- Manual static verification that daemon `model_list` and `account_rate_limits` call the ensure helper before `codex_core`.

## Rollback

Revert the daemon helper read additions. Runtime core API remains unchanged, so rollback is low risk.
