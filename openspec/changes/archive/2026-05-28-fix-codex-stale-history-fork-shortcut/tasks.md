## 1. Specification

- [x] 1.1 Add OpenSpec proposal/design/tasks/spec delta for Codex stale history fork shortcut.
- [x] 1.2 Validate the new OpenSpec change in strict mode.

## 2. Manual Recovery Path

- [x] 2.1 Extend manual recovery result semantics with `forked`.
- [x] 2.2 Add a fork callback to manual recover-and-resend orchestration before fresh fallback.
- [x] 2.3 Preserve visible replayed prompt for `forked` and `fresh` results.

## 3. Automatic Codex Send Recovery

- [x] 3.1 Inject fork callback into `useThreadMessaging`.
- [x] 3.2 On stale Codex binding failure, try verified rebind, then fork continuation, then existing fresh fallback.
- [x] 3.3 Keep single-shot retry guard and diagnostics.

## 4. UI Copy And Card Behavior

- [x] 4.1 Update stale thread recovery card labels and success details to fork continuation semantics.
- [x] 4.2 Ensure non-Codex runtime reconnect text remains unchanged.

## 5. Validation

- [x] 5.1 Add/update focused unit tests for card behavior.
- [x] 5.2 Add/update manual recovery orchestration tests.
- [x] 5.3 Add/update Codex auto-send stale recovery tests.
- [x] 5.4 Run focused tests.
- [x] 5.5 Run `npm run typecheck`.
