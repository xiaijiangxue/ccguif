## 1. Optional Visual Effects Cleanup

- [x] 1.1 Remove runtime calls to `tauri-plugin-liquid-glass-api` from the app shell visual-effects path; output: no startup call can emit `liquid-glass/apply-error`; verify with focused hook tests.
- [x] 1.2 Clean or isolate unused `liquid-glass` dependency/capability references without breaking Tauri window effect cleanup; output: package/capability state matches implementation; verify with typecheck and targeted tests.
- [x] 1.3 Reclassify optional visual-effect failures as non-actionable bounded diagnostics; output: repeated unsupported visual capability does not persist as `source: "error"`; verify with error-log/filter tests.

## 2. Runtime Lifecycle Recovery Guard

- [x] 2.1 Audit current Codex runtime acquire, cleanup, model list, rate-limit, history-load, and thread-list call paths; output: affected functions and state transitions identified in implementation notes; verify with code references in review.
- [x] 2.2 Verify generation/state-aware guard behavior so stopping/stale runtime generations are not reused for foreground execution; output: user work starts or awaits a fresh guarded generation; verify with Rust targeted tests.
- [x] 2.3 Verify helper reads return typed transient/quarantine degraded outcomes instead of spawning concurrent automatic acquires; output: model/rate/history/list helper reads respect guard state; verify with Rust targeted tests.
- [x] 2.4 Preserve predecessor runtime diagnostics without poisoning successor generation state; output: late shutdown diagnostics are correlated to old generation only; verify with runtime lifecycle tests.

## 3. Session History Stale Index Repair

- [x] 3.1 Verify existence validation/degraded recovery for indexed rollout/session paths before thread list or history hydrate treats them as normal truth; output: missing files become degraded entries; verify with session-history tests.
- [x] 3.2 Verify conservative stale-index repair/prune metadata flow; output: stale catalog/index references can be hidden or marked without deleting session files; verify with backend tests.
- [x] 3.3 Validate fork-from-message targets before execution; output: missing message ordinal returns typed error and frontend stops retrying; verify with Codex fork tests.
- [x] 3.4 Surface stale/missing session degraded reasons in UI paths that expose history/fork actions; output: unavailable fork targets are disabled or explained; verify with frontend targeted tests.

## 4. Cross-Platform Environment Doctor

- [x] 4.1 Extract platform-aware engine executable resolver for Codex doctor; output: configured path, process PATH, common paths, and platform fallback are classified; verify with Rust resolver tests.
- [x] 4.2 Add Windows wrapper classification for `.exe`, `.cmd`, and `.ps1`; output: doctor reports wrapper kind instead of generic installed/not-installed; verify with platform-neutral unit fixtures.
- [x] 4.3 Add environment-drift diagnosis when fallback finds an executable missed by GUI PATH; output: UI can explain resolved path and missed source; verify with doctor tests.
- [x] 4.4 Add local probe/proxy diagnosis categories and redacted proxy evidence; output: local probe failures classify proxy/DNS/TLS/timeout/status-like details without noisy success-state UI; verify with Rust unit tests and UI tests.

## 5. Validation And Documentation

- [x] 5.1 Update frontend and backend tests for all changed contracts; output: focused Vitest/Rust suites cover visual cleanup, runtime guard, stale session, and doctor behavior.
- [x] 5.2 Run quality gates: `openspec validate harden-client-runtime-environment-recovery --strict --no-interactive`, focused tests, `npm run typecheck`, and relevant `cargo test`.
- [x] 5.3 Record implementation notes in the change artifacts if scope changes; output: proposal/design/specs stay aligned with the implemented behavior.
