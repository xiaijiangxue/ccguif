## 1. Frontend Settlement Diagnostics

- [x] 1.1 Add a bounded foreground settlement diagnostic helper. Input: lifecycle edge facts. Output: structured records without prompt/assistant/tool content. Validation: unit tests can assert emitted labels and payload keys.
- [x] 1.2 Instrument app-server terminal event bridging. Input: `turn/completed`, `turn/error`, `turn/stalled`, `runtime/ended`. Output: diagnostic record proving the event reached frontend routing. Validation: focused `useAppServerEvents` tests.
- [x] 1.3 Instrument thread lifecycle completion deferral and settlement completion. Input: Codex completion blockers, assistant ingress evidence, lifecycle snapshots. Output: deferred/bypassed/settled/residual-busy diagnostic records. Validation: focused `useThreadEventHandlers` tests.
- [x] 1.4 Instrument turn settlement guard acceptance and rejection. Input: incoming turn id, active turn id, alias target, processing state. Output: accepted/rejected terminal settlement diagnostics. Validation: focused `useThreadTurnEvents` tests.

## 2. Codex Progress Evidence Diagnostics

- [x] 2.1 Record latest Codex progress evidence source and timestamp in lifecycle diagnostics. Input: stream delta, heartbeat, status-active, item/tool/file-change/user-input evidence. Output: bounded latest-evidence snapshot. Validation: focused hook tests assert latest source is reflected in later settlement diagnostics.
- [x] 2.2 Preserve suspected-silent as non-terminal diagnostic state. Input: frontend no-progress suspicion. Output: diagnostic source `frontend-no-progress-suspected` without quarantine or terminal settlement side effects. Validation: existing/no-progress tests plus a focused assertion.

## 3. Runtime Summary Diagnostics

- [x] 3.1 Add summary-only backend runtime-ended active-work diagnostics if an existing log edge can be extended safely. Input: affected thread/turn ids and active lease facts. Output: structured log fields only. Validation: Rust test only if behavior code changes; otherwise TypeScript bridge tests cover frontend consumption.

## 4. Verification

- [x] 4.1 Run OpenSpec validation for this change. Input: proposal/design/spec/tasks. Output: strict validation passes or documented failure.
- [x] 4.2 Run focused frontend tests for touched lifecycle hooks. Input: modified test suites. Output: Vitest pass.
- [x] 4.3 Run `npm run typecheck`. Input: full TypeScript project. Output: typecheck pass or documented pre-existing blocker.
