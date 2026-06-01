## 1. Implementation

- [x] 1.1 Locate the stale thread recovery card button path and the existing conversation Fork capability.
- [x] 1.2 Add a dedicated `onThreadRecoveryFork` callback path from app shell to `RuntimeReconnectCard`.
- [x] 1.3 Change stale thread recovery card action copy from `Fork and resend` to `Fork`.
- [x] 1.4 Route the stale thread recovery Fork action through the shared Fork callback instead of `onRecoverThreadRuntimeAndResend`.
- [x] 1.5 Keep non-stale runtime reconnect resend behavior unchanged.

## 2. Regression Coverage

- [x] 2.1 Update focused reconnect card tests so stale thread recovery asserts the shared Fork callback path.
- [x] 2.2 Assert stale thread Fork no longer calls `ensureRuntimeReady` or recover-and-resend.
- [x] 2.3 Run focused Vitest: `npm run test -- src/features/messages/components/Messages.runtime-reconnect.test.tsx`.
- [x] 2.4 Run TypeScript validation or record why it was deferred.

## 3. OpenSpec

- [x] 3.1 Create OpenSpec proposal/tasks/spec delta for `fix-thread-recovery-fork-shortcut`.
- [x] 3.2 Run `openspec validate fix-thread-recovery-fork-shortcut --strict --no-interactive`.
