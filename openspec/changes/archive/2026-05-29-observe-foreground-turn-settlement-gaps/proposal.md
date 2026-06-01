## Why

Intermittent conversation turns can render final output while the client still shows `isProcessing` / "generating" state until the app is restarted. The current logs do not reliably prove whether the terminal event was missing, rejected by frontend lifecycle guards, deferred by blockers, or contradicted by runtime lease state.

## Target And Boundary

- Add structured, bounded diagnostics around foreground turn settlement gaps.
- Preserve the existing lifecycle behavior: frontend silence remains non-terminal, `turn/completed` remains the authoritative normal completion signal, and history evidence alone does not auto-settle active turns.
- Make the next occurrence diagnosable from local logs/tests without requiring the user to manually reproduce with a debugger.

## Non-Goals

- Do not introduce a new automatic "history-confirmed" completion path.
- Do not shorten or replace Codex no-progress windows.
- Do not change message rendering, Markdown parsing, file-change card layout, or provider protocol semantics.
- Do not add new dependencies or a new persistent incident store.

## What Changes

- Record frontend settlement diagnostics when a terminal turn event is received, deferred, accepted, rejected, or followed by residual processing state.
- Record progress-evidence snapshots that explain the last known activity source for a foreground turn.
- Extend runtime-ended / active-work logging with enough dimensions to compare frontend lifecycle state against backend foreground leases.
- Add focused tests that assert the diagnostics distinguish missing terminal events, rejected terminal events, deferred settlement, and successful terminal settlement.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-realtime-client-performance`: clarify required diagnostic dimensions for terminal settlement gaps.
- `codex-conversation-liveness`: clarify that Codex liveness diagnostics preserve last progress evidence and settlement source without terminalizing frontend suspicion.

## Impact

- Frontend lifecycle hooks: `useThreadEventHandlers`, `useThreadTurnEvents`, `useAppServerEvents`.
- Backend runtime diagnostics around `runtime/ended` / foreground active-work state if a minimal correlated log can be added without changing runtime behavior.
- Tests: focused Vitest suites for turn lifecycle handling and server-event bridging; Rust tests only if backend behavior code changes.
