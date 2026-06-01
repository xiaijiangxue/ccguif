## Why

Codex stale thread recovery card previously exposed a primary action labelled `Fork 并重发` / `Fork and resend`. In real use, that icon button could appear clickable but fail to continue because it was wired to the recovery-card recover-and-resend path instead of the already-working conversation Fork capability.

This creates two problems:

- The user-facing label promises an automatic resend that the current stale-thread path cannot reliably fulfill.
- The UI duplicates fork semantics instead of reusing the existing dialog/composer Fork action that already owns the supported behavior.

The fix is to narrow the recovery card action back to a pure `Fork`: it should create a usable forked conversation through the existing Fork pathway and stop claiming that it will automatically resend the previous prompt.

## Goals And Boundaries

- Goal: change the stale Codex thread recovery card primary icon button from `Fork and resend` to `Fork`.
- Goal: route that button through the existing shared Fork callback / `/fork` composer action rather than reimplementing fork or using recover-and-resend.
- Goal: keep runtime reconnect and non-stale runtime resend behavior unchanged.
- Boundary: do not change backend Codex thread recovery, stale alias persistence, or runtime acquisition semantics.
- Boundary: do not remove recover-only behavior when a safe rebind callback exists.

## Non-Goals

- Do not introduce a new Fork implementation.
- Do not automatically resend the previous prompt from this recovery-card shortcut.
- Do not change assistant/user message tail fork or rewind placement beyond passing the shared fork callback to the recovery card.
- Do not change Claude, Gemini, OpenCode, or runtime-ended resend behavior.

## What Changes

- The stale thread recovery card recommendation copy tells the user to click `Fork`, not `Fork and resend`.
- The stale thread recovery card primary action label becomes `Fork`.
- The stale thread recovery card invokes a shared `onThreadRecoveryFork` callback that routes to the existing `/fork` action.
- The stale thread recovery Fork shortcut no longer calls `ensureRuntimeReady` or `onRecoverThreadRuntimeAndResend`.
- Focused message runtime reconnect tests are updated to assert the shared Fork callback path and to reject accidental calls to the old resend callback.

## Technical Options

| Option | Benefit | Risk | Decision |
|---|---|---|---|
| Keep `Fork and resend` and debug recover-and-resend | Preserves original promise | Continues to couple stale identity recovery with prompt replay; larger regression surface | Rejected |
| Reimplement fork inside the recovery card | Localizes the button behavior | Duplicates fork rules and risks drifting from the existing dialog/composer capability | Rejected |
| Route recovery-card shortcut to the existing Fork action and label it `Fork` | Smallest behavior surface; matches working capability; removes false resend promise | User must explicitly send/follow up after fork if needed | Chosen |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-stale-thread-binding-recovery`: stale thread recovery card Fork shortcut must be a pure Fork action that reuses the existing conversation Fork capability and must not use the recover-and-resend path.

## Impact

- Frontend:
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/messages/components/Messages.tsx`
  - `src/features/messages/components/MessagesTimeline.tsx`
  - `src/features/messages/components/MessagesRows.tsx`
  - `src/features/messages/components/RuntimeReconnectCard.tsx`
  - `src/features/messages/components/Messages.runtime-reconnect.test.tsx`
  - `src/i18n/locales/zh.part1.ts`
  - `src/i18n/locales/en.part1.ts`
- Backend: no backend changes.
- Storage / data model: no persistence changes.
- Dependencies: no new dependencies.

## Acceptance Criteria

- A Codex stale thread recovery card renders a primary `Fork` action, not `Fork and resend`.
- Clicking that `Fork` action calls the shared Fork callback that routes to the existing `/fork` capability.
- Clicking that `Fork` action does not call the stale recovery recover-and-resend callback.
- Clicking that `Fork` action does not require runtime reacquire before invoking the shared Fork callback.
- Recover-only stale thread action remains available when a rebind callback exists.
- Runtime reconnect resend behavior for non-stale runtime-ended/broken-pipe cards remains unchanged.
