## ADDED Requirements

### Requirement: Email-Driven Session Continuation SHALL Use Simple Bounded Replies

The system SHALL continue a mail-driven session only when an inbound email reply is bound to the latest actionable Moss email and contains one clear supported intent, either as a simple natural-language reply or as a structured command.

#### Scenario: mail-driven continuation is armed by selected completion email

- **WHEN** the user selects completion email sending for a session turn
- **THEN** the completion email SHALL be created as an actionable reply target for that bound session
- **AND** the next summary sent after an email-driven command completes SHALL remain actionable by default

#### Scenario: sessions without selected email are not enrolled

- **WHEN** a user has not selected completion email sending for a session turn
- **THEN** the system SHALL NOT create an executable inbound reply target for that session
- **AND** inbound continuation SHALL require a valid actionable context from a selected completion email

#### Scenario: simple NEXT reply continues the latest actionable session

- **WHEN** the user replies to the latest actionable Moss email with `继续`, `下一步`, `执行下一步`, `continue`, `next`, or equivalent supported short reply
- **AND** the reply passes session binding, sender, signature, expiry, and dedupe checks
- **THEN** the system SHALL route a continuation request to the bound workspace/thread/session
- **AND** the continuation SHALL use the latest email's first next-step recommendation as the requested action

#### Scenario: structured NEXT remains compatible

- **WHEN** the user replies to the latest actionable Moss email with `ACTION: NEXT`
- **AND** the reply passes all session binding checks
- **THEN** the system SHALL treat it as equivalent to the simple NEXT reply

#### Scenario: continue alias maps to NEXT

- **WHEN** the user's first effective reply line contains only `@moss: continue`
- **AND** the reply otherwise passes all session binding checks
- **THEN** the system MAY treat it as equivalent to `ACTION: NEXT`
- **AND** the alias SHALL NOT override a conflicting `ACTION` command in the same reply

#### Scenario: direct natural language becomes CHANGE detail

- **WHEN** the user replies with a non-empty natural-language request above the reply delimiter
- **AND** the reply does not contain a structured `ACTION`
- **AND** the reply passes all session binding checks
- **AND** the request is not high-risk, ambiguous, or out of the bound session scope
- **THEN** the system SHALL continue the bound session using that reply text as the next user instruction
- **AND** quoted original email content SHALL NOT be included in the instruction

#### Scenario: structured CHANGE command requires detail

- **WHEN** the user replies with `ACTION: CHANGE`
- **AND** the reply does not contain a non-empty `DETAIL` field in the user's newly added content
- **THEN** the system SHALL NOT execute the reply automatically
- **AND** the reply SHALL be marked `needs_confirmation` or equivalent recoverable state

#### Scenario: CHANGE detail becomes the next user instruction

- **WHEN** the user replies with `ACTION: CHANGE` and a non-empty `DETAIL`
- **AND** the reply passes all session binding checks
- **THEN** the system SHALL continue the bound session using the `DETAIL` content as the next user instruction
- **AND** quoted original email content SHALL NOT be included in the instruction

#### Scenario: PAUSE and STOP do not start new work

- **WHEN** the user replies with `ACTION: PAUSE` or `ACTION: STOP`
- **THEN** the system SHALL update the mail-driven session state without starting a new assistant turn
- **AND** `STOP` SHALL make the latest actionable reply token for that session unusable

#### Scenario: simple PAUSE STOP and STATUS replies are supported

- **WHEN** the user replies with `暂停`, `停止`, `状态`, `pause`, `stop`, `status`, or equivalent supported short reply
- **THEN** the system SHALL map the reply to the corresponding mail session action
- **AND** PAUSE, STOP, and STATUS SHALL NOT start a new assistant turn

#### Scenario: stop alias maps to STOP

- **WHEN** the user's first effective reply line contains only `@moss: stop`
- **THEN** the system MAY treat it as equivalent to `ACTION: STOP`
- **AND** the system SHALL NOT execute any additional natural-language content as a new assistant instruction

#### Scenario: missing or ambiguous action does not execute

- **WHEN** an inbound reply has no effective user-authored content, cannot be mapped to a supported natural-language intent, or contains multiple conflicting `ACTION` declarations
- **THEN** the system SHALL NOT execute the reply automatically
- **AND** the reply SHALL be surfaced as `needs_confirmation` when it is otherwise a valid Moss-related reply

#### Scenario: high-risk or out-of-scope detail requires confirmation

- **WHEN** a valid `ACTION: CHANGE` reply asks for work outside the bound session context or outside the latest email's stated next-step scope
- **THEN** the system SHALL NOT execute it automatically
- **AND** the command SHALL be marked `needs_confirmation` with enough sanitized detail for user review

### Requirement: Inbound Mail Intake SHALL Filter Before Storage

The system SHALL treat inbound mail as an untrusted control-plane input and SHALL store only Moss-related mail commands that pass protocol filters or need Moss-specific review.

#### Scenario: unrelated mail is ignored without storage

- **WHEN** the mailbox contains a message that does not match Moss reply headers, Moss context, or an existing outgoing actionable email
- **THEN** the system SHALL ignore the message
- **AND** the system SHALL NOT store its subject, body, attachments, or sender details in the mail command ledger

#### Scenario: sender must be allowed before command execution

- **WHEN** an inbound reply comes from an address outside the configured default recipient or explicit allowlist
- **THEN** the system SHALL NOT execute the reply
- **AND** the system SHALL NOT persist raw mail content

#### Scenario: Moss-like rejected mail is quarantined minimally

- **WHEN** an inbound message appears to be Moss-related but fails signature, expiry, stale token, or session state validation
- **THEN** the system MAY store a quarantine entry with sanitized metadata and reject reason
- **AND** the quarantine entry SHALL NOT include the complete raw email body, attachments, or secret values

#### Scenario: quoted original content is stripped before parsing

- **WHEN** an inbound reply includes quoted original mail text, forwarded content, or a signature footer
- **THEN** command parsing SHALL use only the user's newly added content where detectable
- **AND** quoted Moss context from the original email SHALL NOT be treated as a new user instruction

#### Scenario: reply-above-line delimiter bounds parsing

- **WHEN** an outbound actionable email includes a reply delimiter such as `Reply above this line`
- **THEN** inbound command parsing SHALL prefer content above that delimiter when present
- **AND** content below the delimiter SHALL NOT be treated as user-authored instruction

#### Scenario: automatic replies and bounces do not execute

- **WHEN** an inbound email is detected as an automatic reply, vacation responder, delivery status notification, bounce, or equivalent non-human response
- **THEN** the system SHALL NOT execute it as a session command
- **AND** the system SHALL avoid storing raw body content for that message

### Requirement: Session Binding SHALL Be Verified With Reply Tokens And Signatures

The system SHALL bind every actionable inbound reply to exactly one outgoing actionable Moss email before execution.

#### Scenario: reply chain and context identify the session

- **WHEN** an inbound reply is processed
- **THEN** the system SHALL match `In-Reply-To` or `References` against the outgoing mail ledger when available
- **AND** it SHALL verify Moss headers or the fallback `MOSS CONTEXT` block before routing the reply

#### Scenario: subject tag can identify candidate session

- **WHEN** custom headers and RFC thread references are unavailable
- **AND** the reply subject contains a valid Moss subject tag
- **THEN** the system MAY use the tag to locate a candidate outgoing mail record
- **AND** execution SHALL still require reply token, signature, latest actionable state, and sender validation

#### Scenario: body anchor can identify candidate session

- **WHEN** headers, RFC thread references, and subject tag are unavailable
- **AND** the reply body contains a valid Moss session anchor line
- **THEN** the system MAY use the body anchor to locate a candidate outgoing mail record
- **AND** quoted anchors below the reply delimiter SHALL NOT be treated as a new user instruction

#### Scenario: signature validation is required

- **WHEN** an inbound reply contains Moss session metadata
- **THEN** the system SHALL validate the metadata signature against local trusted state before execution
- **AND** signature failure SHALL result in a rejected or quarantined state rather than automatic execution

#### Scenario: stale actionable email cannot continue a session

- **WHEN** the user replies to an older Moss email whose reply token is no longer the latest actionable token for the session
- **THEN** the system SHALL NOT execute the reply
- **AND** the system SHOULD guide the user to reply to the latest Moss email when a safe response channel exists

#### Scenario: expired token cannot continue a session

- **WHEN** the reply token expiry has passed
- **THEN** the system SHALL NOT execute the reply
- **AND** the reply SHALL be marked expired or rejected with a recoverable reason

#### Scenario: duplicate reply executes at most once

- **WHEN** equivalent inbound replies share the same message id, reply token, or normalized body hash
- **THEN** the system SHALL execute at most one command
- **AND** duplicate entries SHALL be marked duplicate without starting additional assistant turns

### Requirement: Mailbox Reading SHALL Be Read-Only By Default

The system SHALL read inbound mailbox state without mutating the user's remote mailbox unless a future explicit option defines otherwise.

#### Scenario: mailbox polling uses local cursor

- **WHEN** the system checks the mailbox for Moss replies
- **THEN** it SHALL track progress using local cursor, last checked time, UID, message id, or equivalent local state
- **AND** it SHALL NOT rely on deleting or moving remote mailbox messages for correctness

#### Scenario: default checks do not mutate remote messages

- **WHEN** inbound listener checks for new mail under default settings
- **THEN** it SHALL NOT delete, move, archive, or mark remote messages as read
- **AND** repeated checks SHALL remain idempotent through local dedupe state

### Requirement: Mail Command Ledger SHALL Store Minimal Auditable State

The system SHALL persist only the minimum state needed to audit and resume Moss mail commands.

#### Scenario: accepted command stores sanitized command fields

- **WHEN** an inbound reply is accepted as a Moss command
- **THEN** the ledger SHALL store command id, mail message id, linked outgoing mail id, session id, workspace id, thread id, turn id, reply token hash, action, sanitized detail, received time, body hash, and status
- **AND** the ledger SHALL NOT store SMTP/IMAP secrets or reply token plaintext

#### Scenario: raw mail storage is disabled by default

- **WHEN** inbound mail is processed under default settings
- **THEN** the system SHALL NOT persist complete raw email bodies or attachments
- **AND** any optional debug snippet storage SHALL be sanitized and retention-bound

#### Scenario: running session queues later replies

- **WHEN** a valid command arrives for a session that is already running
- **THEN** the command SHALL be stored as queued or pending
- **AND** it SHALL execute serially only after the current run reaches a terminal state

### Requirement: Mail Session Management UI SHALL Link Mail Events To Sessions

The system SHALL provide a settings management surface where Moss-related mail commands are grouped by session and can jump back to the corresponding conversation context.

#### Scenario: mail sessions are grouped by session

- **WHEN** the user opens the mail session management tab
- **THEN** the system SHALL show Moss mail activity grouped by session rather than as a generic inbox
- **AND** ordinary unrelated mailbox messages SHALL NOT appear in the list

#### Scenario: session row can jump to conversation

- **WHEN** a mail session row has valid workspace id, thread id, and turn id metadata
- **THEN** the UI SHALL provide an action to open the workspace, open the thread, and navigate to the turn anchor when available
- **AND** missing workspace/thread/turn targets SHALL be surfaced as unavailable rather than silently creating a new session

#### Scenario: session timeline shows sanitized mail events

- **WHEN** the user opens a session's mail timeline
- **THEN** the UI SHALL show outbound summaries, inbound commands, command status, reject reasons, and timestamps for that session
- **AND** the timeline SHALL NOT expose complete raw unrelated email content

#### Scenario: management actions are available for safe recovery

- **WHEN** a mail session has queued, paused, ambiguous, or rejected Moss-related commands
- **THEN** the UI SHALL offer relevant actions such as open session, view command, continue manually, pause, close, resend latest summary, request clarification, ignore, or clean processed records
- **AND** destructive or execution-starting actions SHALL be scoped to the selected session

### Requirement: Mail-Driven Session Continuation SHALL Remain Non-Blocking

The system SHALL treat mail-driven continuation and follow-up email delivery as side effects that must not corrupt existing conversation lifecycle state.

#### Scenario: inbound processing failure does not affect active conversation

- **WHEN** mailbox polling, parsing, signature validation, or storage fails
- **THEN** the current conversation lifecycle SHALL remain unchanged
- **AND** the failure SHALL be exposed through listener status, command status, or recoverable diagnostics

#### Scenario: follow-up summary is sent after command completion

- **WHEN** a mail-driven command finishes executing
- **THEN** the system SHALL send a new compact actionable summary when email sending is enabled and configured
- **AND** the new outgoing mail SHALL supersede earlier actionable reply tokens for the same mail-driven session

#### Scenario: email side effect failure does not hide assistant output

- **WHEN** a mail-driven session command completes but sending the follow-up summary fails
- **THEN** the assistant output SHALL remain visible in the bound session
- **AND** the mail session management UI SHALL expose the send failure as recoverable state
