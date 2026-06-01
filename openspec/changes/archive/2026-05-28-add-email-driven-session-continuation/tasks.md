## 1. Specification

- [x] 1.1 Add `email-driven-session-continuation` delta spec covering inbound intake, reply commands, session binding, storage, management UI, jump UX, and edge cases.
- [x] 1.2 Update `conversation-completion-email-notification` spec so completion email uses compact actionable summary plus machine-readable context instead of long final-answer body.
- [x] 1.3 Update `email-sending-settings` spec so Settings exposes send config, inbound listener, and mail session management tabs without storing unrelated mail.

## 2. Outbound Actionable Email

- [x] 2.1 Replace completion email body builder with compact sections: status, current user request, final visible assistant text, next suggestions, simple reply instructions, and Moss context block.
- [x] 2.2 Generate outgoing actionable metadata: message id, subject tag, session id, workspace id, thread id, turn id, reply token, expiry, and signature.
- [x] 2.3 Persist outgoing mail ledger with reply token hash and latest actionable status.
- [x] 2.4 Mark previous actionable mail for the same session as superseded when a new actionable summary is sent.
- [x] 2.5 Add `Reply above this line` delimiter and ensure only content above the delimiter is considered user-authored reply text.
- [x] 2.6 Arm actionable mail continuation when the user selects completion email for a session turn; do not enroll sessions that did not select completion email.
- [x] 2.7 Add redundant session anchors to actionable mail: `X-Moss-*` headers, Subject Tag, Body Anchor, and signed context block.
- [x] 2.8 Add readable subject builder with engine name, session name, workspace name, and char-safe ellipsis for long titles.
- [x] 2.9 Exclude file change cards, tool calls, diffs, command output, review/image cards, and reasoning/thinking sections from the email body.

## 3. Reply Command Protocol

- [x] 3.1 Implement parser for natural replies plus `ACTION: NEXT | CHANGE | PAUSE | STOP | STATUS`.
- [x] 3.2 Require non-empty `DETAIL` for `ACTION: CHANGE`.
- [x] 3.3 Strip quoted original text, email signatures, and forwarded content before parsing.
- [x] 3.4 Route missing/multiple/invalid actions to `needs_confirmation` instead of auto execution.
- [x] 3.5 Reject or quarantine auto-replies, delivery status notifications, and vacation responders before action parsing.
- [x] 3.6 Route high-risk or out-of-scope `DETAIL` content to `needs_confirmation`.
- [x] 3.7 Support `@moss: continue` and `@moss: stop` as compatible aliases when they are the only first-line instruction.
- [x] 3.8 Support low-friction replies such as `继续`, `下一步`, `暂停`, `停止`, `状态`, and direct natural-language change requests.

## 4. Inbound Mail Intake

- [x] 4.1 Add mailbox check path for recent/since-cursor messages using configured inbound settings in read-only mode.
- [x] 4.2 Filter by allowed sender before protocol parsing.
- [x] 4.3 Match `In-Reply-To` / `References` to outgoing mail ledger.
- [x] 4.4 Parse Moss headers, Subject Tag, Body Anchor, and fallback `MOSS CONTEXT` block.
- [x] 4.5 Verify signature, reply token, expiry, and latest actionable status.
- [x] 4.6 Ignore unrelated mail without storing raw message content.
- [x] 4.7 Persist local mailbox cursor/dedupe state without deleting, moving, or marking remote messages by default.
- [x] 4.8 Implement mailbox reader behind a trait with Memory mock coverage before wiring a concrete IMAP library.
- [x] 4.9 Wire concrete read-only IMAP reader for 126/163/QQ/custom provider defaults, including provider-compatible IMAP ID handshake where needed.

## 5. Minimal Storage And Deduplication

- [x] 5.1 Add inbound command ledger with sanitized command fields and no raw unrelated mail.
- [x] 5.2 Deduplicate by `mailMessageId + replyTokenHash + bodyHash`.
- [x] 5.3 Store quarantine entries only for Moss-related rejected candidates, with reject reason and sanitized metadata.
- [x] 5.4 Add retention/cleanup for processed commands and debug snippets if debug storage is enabled.

## 6. Session Continuation Runtime

- [x] 6.1 Route accepted `NEXT` and `CHANGE` commands to the matching workspace/thread/session queue.
- [x] 6.2 Queue replies received while the target session is running; execute them serially after the current run settles.
- [x] 6.3 Handle `PAUSE`, `STOP`, and `STATUS` without starting unintended work.
- [x] 6.4 After command execution completes, send the next compact actionable summary email.
- [x] 6.5 Ensure email side effects never regress conversation lifecycle settlement.
- [x] 6.6 Retry completion email body construction when the terminal event arrives before final user/assistant messages are visible, preventing first-turn selected email from being skipped.

## 7. Settings And Management UX

- [x] 7.1 Split email settings into `文档 | 发送配置 | 收信监听 | 邮件会话` tabs.
- [x] 7.2 Implement inbound listener settings and status panel with read-only hint, provider/IMAP fields, allowlist, polling interval, manual check, and queue/confirm/rejected counts.
- [x] 7.3 Implement mail session table grouped by session, not inbox message.
- [x] 7.4 Add session mail timeline drawer with outbound/inbound sanitized events.
- [x] 7.5 Add MVP actions: refresh sessions, view timeline, open bound session, and clean processed records; keep pause/close/resend/clarification as backend-supported recovery actions rather than default row buttons.
- [x] 7.6 Support jump to workspace/thread/turn anchor and graceful fallback when target is unavailable.
- [x] 7.7 Make selected completion email default to mail-driven continuation, while sessions without selected completion email remain unenrolled.

## 8. Validation

- [x] 8.1 Add unit tests for compact email template generation, final visible text extraction, subject builder, card/tool exclusion, and context block signing.
- [x] 8.2 Add parser tests for natural replies, ACTION commands, `@moss:` aliases, quoted content stripping, invalid/multiple actions, and CHANGE without DETAIL.
- [x] 8.3 Add backend tests for sender filtering, signature failure, expired token, stale token, duplicate reply, accepted command creation, unrelated mail ignore, read-only mailbox checks, and auto-reply/bounce rejection.
- [x] 8.4 Add frontend tests for email tabs, selected-email continuation arming, session aggregation, timeline drawer, rejected command visibility, read-only status, and jump actions.
- [x] 8.5 Add fallback binding tests for headers, RFC threading, Subject Tag, Body Anchor, and signed context block.
- [x] 8.6 Run focused frontend/backend tests plus `openspec validate --all --strict --no-interactive`.

## 9. Proposal Backwrite After Manual Validation

- [x] 9.1 Update proposal/design/specs to reflect the tested MVP: email selection arms reply continuation by default, not a separate per-session enable button.
- [x] 9.2 Document natural-language-first replies and keep structured ACTION as compatibility path.
- [x] 9.3 Document readable subject format: engine + session + workspace, with safe ellipsis for long names.
- [x] 9.4 Document final-visible-text email body extraction and explicit exclusion of file/tool/diff/command/card/thinking information.
- [x] 9.5 Document 126/163/QQ/custom IMAP provider behavior, read-only intake, allowlist filtering, and session timeline UX.
