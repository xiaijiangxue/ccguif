## 1. Contract And Backend

- [x] 1.1 Add `delete_mail_records` to the shared mail session mutation request type in `src/types.ts`; input is an action plus required `sessionId`, output remains the existing mail session mutation response.
- [x] 1.2 Implement backend `delete_mail_records` handling in `src-tauri/src/email/session_continuation.rs`; delete matching `outgoing` and `commands` ledger records, preserve `sessions`, save the ledger, and return refreshed projection.
- [x] 1.3 Add backend validation for missing `sessionId` on `delete_mail_records`; verify it returns a structured error and leaves ledger/workspace/thread/runtime data unchanged.
- [x] 1.4 Add focused Rust tests for delete-mail-records behavior: removes outgoing/inbound records, preserves session control records, rejects missing session id.

## 2. Settings UI Behavior

- [x] 2.1 Add local operation state in `EmailSenderSettings.tsx` for refreshing, cleaning, deleting row id, and mail-session notice feedback.
- [x] 2.2 Update `刷新会话` to show in-progress, success, and error feedback while reloading the mail session projection through the typed bridge.
- [x] 2.3 Update `清理已处理记录` to show in-progress, success, and error feedback while using the existing cleanup mutation and refreshing the projection.
- [x] 2.4 Add per-row `删除邮件信息` action; call `delete_mail_records` through `mutateEmailMailSession`, refresh projection on success, and close stale detail when deleting the selected session.
- [x] 2.5 Move `查看邮件` detail rendering above the session list; add selected row state, close action, and an internally scrollable detail content area.
- [x] 2.6 Preserve existing `打开会话` behavior and routing contract while adding the new row actions.

## 3. Styling And Copy

- [x] 3.1 Add scoped settings CSS for the mail session notice, selected row state, above-list detail panel, internal detail scroll area, and row-level danger action.
- [x] 3.2 Update Chinese and English i18n copy for refresh/cleanup notices, delete-mail-records action, delete safety wording, detail close label, and error fallbacks.
- [x] 3.3 Review responsive layout so action buttons remain usable and mail detail content does not push the list silently below the visible page.

## 4. Frontend Tests

- [x] 4.1 Extend `EmailSenderSettings.test.tsx` to verify refresh and cleanup controls show feedback and call typed bridge functions.
- [x] 4.2 Add tests for `查看邮件`: detail panel renders above the list, selected row state is applied, close action clears the panel, and long content uses the detail container.
- [x] 4.3 Add tests for `删除邮件信息`: payload uses `delete_mail_records`, successful deletion refreshes and closes current detail, failed deletion keeps the list visible with an error notice.
- [x] 4.4 Add regression coverage that `打开会话` still calls the existing handler with the unchanged session identity.

## 5. Validation

- [x] 5.1 Run `openspec validate "improve-email-mail-session-list-controls" --type change --strict --no-interactive`.
- [x] 5.2 Run focused frontend tests for `EmailSenderSettings`.
- [x] 5.3 Run focused Rust email/session continuation tests.
- [x] 5.4 Run `npm run typecheck` if TypeScript contracts or i18n types changed.
