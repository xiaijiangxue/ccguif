## ADDED Requirements

### Requirement: Mail Session Record Deletion MUST Be Ledger-Scoped
The system SHALL allow deleting mail records for one mail session from the local email ledger without deleting the real conversation session or remote mailbox messages.

#### Scenario: deleting mail records removes matching outgoing and inbound ledger records
- **WHEN** 用户对某个 mail session 执行 `删除邮件信息`
- **THEN** the backend MUST remove local outgoing mail records whose `session_id` matches that mail session
- **AND** the backend MUST remove local inbound command records whose `session_id` matches that mail session
- **AND** the backend MUST save the updated local email ledger
- **AND** the UI MUST refresh the mail session projection after the mutation completes

#### Scenario: deleting mail records preserves session control state
- **WHEN** 用户对某个 mail session 执行 `删除邮件信息`
- **THEN** the backend MUST NOT remove that session's control or state record from the ledger `sessions` collection
- **AND** pause, resume, close, confirm, ignore, or equivalent control semantics MUST remain governed by the existing session control data

#### Scenario: deleting mail records never deletes the real conversation
- **WHEN** 用户对某个 mail session 执行 `删除邮件信息`
- **THEN** the system MUST NOT delete workspace data
- **AND** the system MUST NOT delete thread transcripts
- **AND** the system MUST NOT delete turn records
- **AND** the system MUST NOT stop or remove runtime sessions beyond the existing mail control semantics

#### Scenario: deleting mail records does not touch the remote mailbox
- **WHEN** 用户对某个 mail session 执行 `删除邮件信息`
- **THEN** the system MUST NOT delete, archive, move, or mark as read any remote mailbox message
- **AND** the mutation MUST be limited to local Moss email ledger storage

### Requirement: Mail Session Record Deletion MUST Require A Target Session
The system SHALL reject delete-mail-records mutations that do not name a concrete mail session.

#### Scenario: delete mail records without session id is rejected
- **WHEN** a delete-mail-records mutation is submitted without a `sessionId`
- **THEN** the backend MUST return a structured error
- **AND** the backend MUST NOT modify outgoing records, inbound command records, session control records, workspace data, thread transcripts, or remote mailbox messages

### Requirement: Mail Session Management MUST Use The Existing Typed Command Boundary
The system SHALL route mail session list management through the existing typed frontend bridge and backend mutation command boundary.

#### Scenario: frontend uses typed bridge for mail session mutations
- **WHEN** Settings UI refreshes, cleans up, or deletes mail session records
- **THEN** feature components MUST use typed functions from `src/services/tauri.ts`
- **AND** feature components MUST NOT call Tauri `invoke()` directly

#### Scenario: backend reuses existing mail session mutation command
- **WHEN** the UI requests mail session cleanup or delete-mail-records behavior
- **THEN** the backend SHOULD handle the action through the existing mail session mutation command boundary
- **AND** the system MUST NOT add a parallel command path unless the existing boundary cannot express the operation

### Requirement: Mail Session Projection MUST Reflect Local Ledger Mutations
The system SHALL refresh projected mail session rows after local ledger management actions.

#### Scenario: deleting currently selected mail records closes stale detail
- **WHEN** 用户删除当前正在查看的 mail session 的邮件信息
- **THEN** Settings UI MUST close or clear the stale mail detail panel after the mutation succeeds
- **AND** Settings UI MUST render the refreshed projection from the backend

#### Scenario: failed delete keeps current list visible
- **WHEN** 用户执行 `删除邮件信息`
- **AND** the backend mutation fails
- **THEN** Settings UI MUST show a readable error notice
- **AND** Settings UI MUST keep the current mail session list visible
- **AND** Settings UI MUST NOT pretend the mail records were deleted
