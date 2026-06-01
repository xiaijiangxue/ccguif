## Context

Foreground turn lifecycle currently spans three places:

- app-server event bridging decides whether `turn/completed`, `turn/error`, `turn/stalled`, and `runtime/ended` reached the frontend handlers.
- thread lifecycle handlers decide whether Codex terminal events are deferred, settled, quarantined, or ignored.
- turn reducer helpers decide whether the terminal event can clear `isProcessing` and `activeTurnId`.

The observed failure is intermittent and restart-visible: final content exists, but process-local foreground state remains busy. That makes the first implementation priority observability, not a new recovery policy.

## Goals / Non-Goals

**Goals:**

- Produce one correlated diagnostic trail for each foreground terminal-settlement attempt.
- Distinguish these cases: terminal event not seen, terminal event received, settlement deferred, settlement rejected by active-turn guard, settlement accepted but busy residue remains.
- Record last progress evidence source and current lifecycle snapshot without logging prompt/assistant content.
- Keep diagnostics best-effort and bounded.
- Cover the new observability with focused tests.

**Non-Goals:**

- No automatic settlement from history-only evidence.
- No behavior change to no-progress suspicion, Codex quarantines, or execution-active timeout.
- No new dependency, backend store, or user-facing diagnostic panel in this change.

## Decisions

### Decision 1: Use a shared frontend diagnostic helper instead of ad hoc logs

Add a small helper near the thread hooks that emits structured diagnostics through the existing frontend diagnostic channel already used by lifecycle tests. Each record carries a stable label, workspace/thread/turn, engine when known, active turn, processing state, and a reason.

Alternatives considered:

- Add `console.debug` at every branch. Rejected because it is not reliably testable and becomes noisy.
- Add a new persistent incident store. Rejected as overkill; this change is observation-only and should not introduce new lifecycle state.

### Decision 2: Instrument settlement edges, not every realtime event

Emit diagnostics at the edges where the stuck state can be explained:

- app-server receives a terminal event and routes it.
- Codex completion is deferred or bypasses deferral.
- turn settlement is accepted/rejected by active-turn guard.
- lifecycle state remains busy after terminal handling.
- progress evidence updates the latest known activity source.

Alternatives considered:

- Log all normalized events. Rejected because it increases volume without directly explaining stuck terminal state.
- Only log terminal rejects. Rejected because the missing-event case and deferred-settlement case would remain indistinguishable.

### Decision 3: Backend runtime logs remain summary-only

If Rust runtime code is touched, only add a summary diagnostic around `runtime/ended` / active lease dimensions that already exist in memory. Do not alter lease release, foreground work continuity, or terminal event generation.

Alternatives considered:

- Add backend repair logic on runtime end. Rejected because the current goal is to gather evidence before changing settlement policy.
- Skip backend visibility entirely. Rejected if the frontend sees `runtime/ended` but cannot compare it with backend active-work state.

## Risks / Trade-offs

- Diagnostic volume grows during high-frequency streaming -> emit only lifecycle-edge records and progress-source transitions, not full content events.
- Tests may couple to log labels -> use stable, contract-like labels and keep payload shape explicit.
- Observation can reveal missing settlement but not fix it immediately -> intentional; the next fix should be based on the captured failure class.

## Migration Plan

1. Add OpenSpec delta specs and tasks for observability.
2. Add minimal diagnostic helper / edge calls.
3. Add focused tests for terminal routing, rejection, deferral, and residual busy classification.
4. Run OpenSpec validation, targeted Vitest, and typecheck.

Rollback is a normal git revert of this change. Because no lifecycle state machine behavior changes are introduced, rollback should only remove diagnostics and tests.
