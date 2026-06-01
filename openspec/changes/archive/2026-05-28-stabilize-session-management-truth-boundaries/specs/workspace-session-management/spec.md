## ADDED Requirements

### Requirement: Session Management Related Surface MUST Be Engine-Neutral

Session Management related sessions MUST be a project attribution surface, not a Codex-only history view. The system MUST support related entries from any engine that can provide inferred attribution evidence, while keeping strict project sessions separate.

#### Scenario: related surface includes non-Codex inferred sessions
- **WHEN** a Claude, OpenCode, Gemini, Codex, or equivalent engine session has inferred project attribution but does not satisfy strict membership
- **THEN** Session Management MUST be able to show that session in the related surface
- **AND** the row MUST include engine identity and inferred attribution evidence

#### Scenario: strict surface remains unchanged by related entries
- **WHEN** a session appears only in the related surface
- **THEN** the system MUST NOT mix that session into strict project sessions
- **AND** strict counts and default sidebar membership MUST remain based on strict projection truth

#### Scenario: engine filter does not hide supported related engines
- **WHEN** the user filters related sessions by a supported non-Codex engine
- **THEN** the frontend MUST request or display that engine's related entries
- **AND** it MUST NOT clear the surface solely because the engine is not Codex

### Requirement: Session Management Batch Mutations MUST Return Per-Entry Results

Batch archive, unarchive, delete, and folder assignment operations that target multiple sessions MUST return per-entry results for all resolvable entries. A failure in one owner workspace or one entry MUST NOT hide successful results for other entries.

#### Scenario: folder move partially fails across owner workspaces
- **WHEN** a batch folder assignment contains sessions from multiple owner workspaces
- **AND** one owner workspace mutation fails while another owner workspace succeeds
- **THEN** the response MUST include success results for the successful entries
- **AND** the response MUST include failure results for the failed entries with retryable error information
- **AND** the request MUST NOT collapse into a single opaque request-level error

#### Scenario: request-level error is reserved for global precondition failure
- **WHEN** a batch mutation request cannot be parsed, the target workspace does not exist, or the caller lacks a required global precondition
- **THEN** the backend MAY return a request-level error
- **AND** no partial success MUST be implied

#### Scenario: frontend keeps failed entries selected
- **WHEN** a batch mutation returns mixed success and failure results
- **THEN** the frontend MUST update or remove only successful entries
- **AND** failed entries MUST remain visible and selected when retry is possible

### Requirement: Session Management Page Size Caps MUST Be Explicit

Session Management MUST make backend page-size caps visible to the frontend when the requested limit exceeds the backend maximum or when a capped scan prevents complete results. The Settings management surface SHOULD request a large bounded window, currently `9999` sessions, rather than relying on user-visible pagination for ordinary management.

#### Scenario: requested page size exceeds backend cap
- **WHEN** the frontend requests a page size larger than the backend-supported maximum
- **THEN** the backend response MUST expose the effective limit, next cursor, capped status, or equivalent evidence
- **AND** the frontend MUST NOT present the current page as the complete result set unless completeness is proven

#### Scenario: management page can continue after capped page
- **WHEN** a management page response is capped but has more matching sessions
- **THEN** the response MUST provide a continuation cursor or equivalent next-page signal
- **AND** the UI MUST allow the user to continue loading or explain why the result is partial

#### Scenario: cap evidence is distinct from source failure
- **WHEN** results are capped only because the requested page size exceeded backend limits
- **THEN** the system MUST distinguish that cap from engine source failure
- **AND** it MUST NOT mark healthy engine sources as failed solely because a page limit was enforced

### Requirement: Successful Deletes MUST Clear Derived Session UI State

Session Management delete success MUST be treated as explicit removal evidence across Settings, Sidebar, workspace thread rows, and session curtain state. Degraded or uncertain source status MUST NOT override a successful delete result for the same session identity.

#### Scenario: deleted session is not revived by degraded fallback
- **WHEN** a session delete mutation succeeds
- **AND** the subsequent workspace catalog refresh is degraded, partial, or `uncertain_empty`
- **THEN** frontend continuity fallback MUST NOT reinsert the deleted session from last-good snapshots or cached summaries
- **AND** visible sidebar/workspace rows MUST remain without that session

#### Scenario: deleting the open session closes the Settings curtain
- **WHEN** the Settings session curtain is open or loading a session
- **AND** a delete mutation succeeds for that same session identity
- **THEN** the curtain MUST close or otherwise leave loading state
- **AND** stale async load results for the deleted session MUST NOT reopen or repopulate the curtain

### Requirement: Session Folder Deletion MUST Preserve Sessions By Promoting Assignments

Session Management folder deletion MUST delete only the organization container, never the session records. Deleting a folder MUST remove the target folder subtree. Any session assignment or metadata-only assignment pointing inside the deleted subtree MUST be promoted to the deleted folder's parent folder; when the deleted folder has no valid parent, those assignments MUST be removed so the sessions return to root/unclassified.

#### Scenario: top-level folder contains real sessions
- **WHEN** a top-level folder or any descendant folder has existing catalog entries assigned to it
- **THEN** deleting the folder MUST succeed
- **AND** the folder subtree MUST be removed
- **AND** sessions assigned inside that subtree MUST return to root/unclassified

#### Scenario: nested folder contains real sessions
- **WHEN** a nested folder has existing catalog entries assigned to it
- **THEN** deleting that nested folder MUST succeed
- **AND** sessions assigned inside the deleted subtree MUST move to the deleted folder's parent folder

#### Scenario: folder subtree contains stale assignment metadata
- **WHEN** `folderIdBySessionId` contains orphaned keys pointing inside the deleted subtree
- **THEN** deleting the folder MUST succeed
- **AND** stale assignment metadata MUST be promoted to the deleted folder's parent folder or removed when there is no valid parent
