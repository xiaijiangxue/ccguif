## MODIFIED Requirements

### Requirement: Completion Email MUST Contain Compact Actionable Summary And Session Context

The system SHALL send a compact completion email that helps the user decide the next action and reply safely, instead of sending a long full transcript by default.

#### Scenario: completed turn sends compact fix summary

- **WHEN** a target turn reaches terminal completion
- **AND** the email sender is enabled and configured
- **THEN** the system MUST send an email to the configured default recipient
- **AND** the email body MUST include the turn status and a concise summary of the work completed in the turn
- **AND** the email body MUST include only the minimum fix or result information needed for the user to decide the next action
- **AND** the email body MUST include the current user request so the mailbox view preserves enough context without requiring the user to open Moss

#### Scenario: email includes next-step recommendations

- **WHEN** a completion email is sent
- **THEN** the email body MUST include a bounded next-step recommendation section
- **AND** the first recommendation MUST be safe to execute via `继续`, `下一步`, or `ACTION: NEXT` without requiring the client to infer unstated intent

#### Scenario: email includes simple reply instructions

- **WHEN** an actionable completion email is sent
- **THEN** the email body MUST tell the user they can reply with a short natural-language instruction above the delimiter
- **AND** the instructions MUST include simple examples for continue, direct change request, pause, stop, and status
- **AND** the instructions SHOULD avoid requiring the user to write machine-oriented `ACTION` syntax in the normal path

#### Scenario: structured commands remain compatible

- **WHEN** an actionable completion email is sent
- **THEN** the system MAY accept structured commands such as `ACTION: NEXT`, `ACTION: CHANGE`, `ACTION: PAUSE`, `ACTION: STOP`, and `ACTION: STATUS`
- **AND** the system MAY accept short aliases such as `@moss: continue` and `@moss: stop`
- **AND** canonical `ACTION` commands MUST remain available for explicit structured replies

#### Scenario: reply delimiter is present for mail clients

- **WHEN** an actionable completion email is sent
- **THEN** the email body MUST include a visible delimiter instructing the user to reply above it
- **AND** the inbound parser MUST be able to ignore quoted content below that delimiter

#### Scenario: machine context is included outside the human summary

- **WHEN** a completion email is sent
- **THEN** the system MUST attach session binding metadata through mail headers and a fallback `MOSS CONTEXT` block
- **AND** the context MUST include enough information to identify session id, workspace id, thread id, turn id, reply token, expiry, and signature
- **AND** the context block MUST be separate from the human summary so it can be parsed without treating it as user instruction

#### Scenario: redundant anchors survive common mail clients

- **WHEN** an actionable completion email is sent
- **THEN** the email MUST include a Moss subject tag and body anchor in addition to machine headers
- **AND** those anchors MUST be sufficient to locate a candidate session when a mail client drops custom headers
- **AND** those anchors MUST NOT by themselves authorize execution without token, signature, latest actionable state, and sender validation

#### Scenario: long assistant answer is not included by default

- **WHEN** the target turn contains a long assistant answer, command output, diff, review, generated image, or other verbose activity
- **THEN** the completion email MUST NOT include that full content by default
- **AND** the email SHOULD direct the user back to the bound client session for full details

#### Scenario: final visible assistant text is used without tool cards

- **WHEN** the target turn contains final assistant text plus file change cards, tool calls, diffs, command output, review cards, generated image cards, or reasoning/thinking sections
- **THEN** the completion email MUST use the final visible assistant text as the repair/result section
- **AND** the completion email MUST NOT include file change facts, tool invocation summaries, command output, diff content, card metadata, or reasoning/thinking text

#### Scenario: multiple visible assistant messages in one completed turn are preserved

- **WHEN** the target turn contains more than one assistant message after the current user request
- **AND** the last assistant final message is a short follow-up or confirmation
- **THEN** the completion email MUST anchor on the last completed assistant final message
- **AND** the repair/result section MUST include all non-empty assistant message text between the current user request and that final message, in visible order
- **AND** the completion email MUST still exclude tool cards, file change cards, diffs, command output, review cards, generated image cards, and reasoning/thinking text

#### Scenario: mail-driven continuation email does not reuse previous turn content

- **WHEN** a user reply email drives the same session into the next turn
- **THEN** the next completion email intent MUST bind to the new turn started by that reply
- **AND** the email body builder MUST only select an assistant final message completed after that intent was armed
- **AND** if the new turn completion event arrives before the new assistant final message is visible in client items, the system MUST retry email body construction
- **AND** the system MUST NOT reuse the previous turn's final assistant message to send a duplicate completion email

#### Scenario: subject identifies the engine session and workspace

- **WHEN** a completion email is sent
- **THEN** the visible subject MUST include the engine name, session name, and workspace name when available
- **AND** overly long session or workspace names MUST be truncated with a character-safe ellipsis
- **AND** actionable mail MUST still include a Moss subject tag for fallback session binding

### Requirement: Email Intent MUST Produce One Latest Actionable Reply Target

The system SHALL make each sent completion email either the latest actionable reply target for a mail-driven session or a non-actionable notification.

#### Scenario: new actionable summary supersedes older reply tokens

- **WHEN** a new actionable completion email is sent for the same mail-driven session
- **THEN** older actionable reply tokens for that session MUST be marked superseded or equivalent
- **AND** replies to older emails MUST NOT start new work automatically

#### Scenario: no selected completion email means no inbound continuation

- **WHEN** the user has not selected completion email sending for a session turn
- **THEN** the system MUST NOT create hidden inbound execution state for that thread
- **AND** inbound replies MUST NOT execute automatically without a valid actionable context created by a selected completion email

#### Scenario: actionable mode is visible to the user

- **WHEN** a completion email includes an executable reply target
- **THEN** the email MUST make clear that replying above the delimiter can continue the bound session
- **AND** replies received after a mail-driven command completes SHOULD keep the session in the same email-driven loop by sending the next actionable summary
