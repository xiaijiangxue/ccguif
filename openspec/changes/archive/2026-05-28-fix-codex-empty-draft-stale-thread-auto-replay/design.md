## Context

The current code already contains a narrow Codex send-path recovery in `useThreadMessaging`: if `turn/start` fails with a recoverable stale binding signal, it can refresh/rebind or create a fresh Codex thread for local first-send draft replacement.

The incident shows a different entry path: a newly created Codex draft can lose its provisional backend identity before the first accepted turn, then the runtime/reconnect surface classifies the stale `threadId` and shows the recovery card. The core contract is already in `codex-conversation-liveness`, but the recovery/resume path can still bypass the draft replacement guard.

## Goals / Non-Goals

**Goals:**

- Make first-turn empty Codex draft replacement apply consistently to send, resume, and recovery-card resend paths.
- Preserve durable-safe behavior for any thread with accepted turns or durable local activity.
- Replay the current prompt at most once after a fresh replacement.
- Keep diagnostics explainable as draft replacement, not verified stale rebind.

**Non-Goals:**

- No runtime/proxy/websocket policy change.
- No broad stale-thread auto-replacement.
- No data migration.
- No new dependency.

## Decisions

### Decision 1: Guard on canonical draft facts, not raw error text

Use the existing `canUseLocalFirstSendCodexDraftReplacement` / accepted-turn fact helpers as the authority for deciding whether a stale Codex identity is disposable.

Alternative considered: replace on any `thread not found`. This is operationally tempting but wrong because durable stale conversations need verified rebind or explicit fresh continuation.

### Decision 2: Unify fresh replacement through the existing send fallback

The first-send fallback should remain a single semantic path: create fresh Codex thread, set it active, move the optimistic user intent, and send once. Recovery-card resend should reuse the same durable boundary logic instead of keeping a separate heuristic.

Alternative considered: make the card hide itself for empty drafts. That only changes presentation; it does not guarantee the prompt is delivered.

### Decision 3: Treat unknown durable boundary as durable-safe

If accepted-turn facts are unavailable and the current state does not match a local pre-accept first-send intent, keep the existing stale recovery card. This prevents silent data loss if history failed to load or local items are stale.

Alternative considered: infer emptiness from the visible message list. Rejected because render state can be filtered, stale, or not hydrated.

### Decision 4: Tighten legacy malformed-id fallback behind the same draft boundary

The legacy `invalid thread id` escape hatch is kept only for disposable Codex first-send drafts. Durable conversations with malformed local ids must no longer silently fresh-replace because the same data-safety boundary applies: invalid local identity is not proof that the existing user history is disposable.

Rollback marker: if this tightening causes a compatibility regression, revert only the malformed-id guard and the paired durable invalid-id test; the missing-thread refresh-throw fix remains independent.

## Risks / Trade-offs

- Duplicate first prompt replay -> Mitigation: retry only once through the existing send fallback and keep optimistic user intent movement explicit.
- Durable session misclassified as empty -> Mitigation: require no accepted turn and no durable local activity; unknown defaults to conservative recovery.
- Recovery-card path still bypasses fallback -> Mitigation: add focused reconnect/runtime test that verifies no stale card primary path for an empty draft first send.
- Alias pollution -> Mitigation: do not persist a durable stale alias when the source identity was never verified.
- Legacy malformed-id send now requires draft evidence -> Mitigation: empty first-send drafts still fresh-replay; durable malformed-id cases remain visible and recoverable instead of silent replacement.

## Migration Plan

1. Add focused tests that reproduce empty draft `thread not found` through the missing path.
2. Implement the shared guard/fallback in the narrow Codex hook surface.
3. Run focused Vitest suites and TypeScript check.
4. Rollback is a normal revert of this change; no persisted data shape changes are introduced.

## Open Questions

- None. The behavior boundary is already defined by the existing liveness and stale-thread specs.
