## Implementation Notes

### Optional Visual Effects

- Removed `tauri-plugin-liquid-glass-api` calls from the app shell hook.
- Removed the unused npm dependency, Tauri Rust dependency, and capability grant.
- Kept Tauri window effect cleanup as a bounded client warning path so unsupported visual effects no longer persist as `source: "error"`.

### Runtime Lifecycle Recovery Guard

- Reused the existing runtime guard architecture instead of adding a competing lock:
  - acquire gate: `RuntimeAcquireGate`
  - generation isolation: `runtime_generation`
  - quarantine/backoff: `record_recovery_failure_with_backoff`
  - predecessor diagnostics: lifecycle scenario matrix tests
- Verified the existing matrix with `cargo test --manifest-path src-tauri/Cargo.toml runtime_lifecycle --lib`.

### Session History Stale Index Repair

- Reused existing unified history recovery and degraded thread-list paths for stale catalog/index entries.
- Added a stable `[FORK_TARGET_NOT_FOUND]` backend error for missing Codex fork targets.
- Frontend now classifies missing fork targets as client stale-target diagnostics instead of generic retryable errors.

### Cross-Platform Environment Doctor

- Extended Windows executable classification to `.cmd`, `.bat`, `.ps1`, and `.exe`.
- Added `.ps1` launch support through PowerShell with explicit `-NoProfile -ExecutionPolicy Bypass -File`.
- Added environment diagnosis categories for configured-path misses, GUI PATH drift, resolver precedence differences, resolved, and not-found states.
- Added all-platform process proxy env evidence with credential redaction and local probe failure category mapping.
- Surfaced actionable environment/network diagnosis fields in the settings doctor UI while hiding successful `unknown` network state and unset proxy rows.
